/**
 * 文件：completion.ts
 * 功能：通过当前用户已激活的 Provider 执行流式 AI Work 对话。
 * 作用：固定使用设置中心登记的 HTTPS 地址，服务端注入密钥并遵循模型目录/用户输出限制与响应体边界。
 * 不负责：会话所有权、持久化、工具执行或权限审批。
 * 关联文件：packages/settings/settings/src/service.ts、packages/core/session/src/sessions.ts、packages/api/gateway/src/index.ts。
 * 修改注意事项：不能把密钥、Provider 错误正文或模型隐藏推理内容发送给浏览器或写入日志。
 */
import type { ApplicationId } from "lfaa-settings/src/preferences/service.js";
import type { ActiveAiModelConfiguration, AiRuntimeSettings, PermissionSettings } from "lfaa-settings/src/service.js";
import { composeLfaaSystemPrompt } from "lfaa-system-prompt/src/index.js";

const disabledThinkingValues = new Set(["none", "off", "disabled"]);

export type AiCompletionContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } };

export interface AiCompletionMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null | AiCompletionContentPart[];
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  /** Provider 私有续接数据，只允许同 Provider/模型回传；不得进入 UI 或普通日志。 */
  providerReplay?: { accountId: string; providerId: string; modelId: string; reasoningContent: string };
}

export interface AiCompletionUsage {
  promptTokens: number | null;
  completionTokens: number | null;
  /** DeepSeek/兼容 Provider 返回的提示词缓存命中数；未上报时保持未知。 */
  cacheReadTokens: number | null;
}

export interface AiCompletionTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface AiCompletionToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface AiCompletionResult {
  usage: AiCompletionUsage;
  toolCalls: AiCompletionToolCall[];
  providerReplay?: NonNullable<AiCompletionMessage["providerReplay"]>;
}

/** 只有未收到正文或工具选择的失败可以在请求边界恢复，不能重放已提交工具。 */
export class AiRecoverableRequestError extends Error {
  constructor(message: string, readonly usage: AiCompletionUsage = { promptTokens: null, completionTokens: null, cacheReadTokens: null }) {
    super(message); this.name = "AiRecoverableRequestError";
  }
}

/** Provider 已明确截断输出；重试相同请求和上限只会重复消耗预算，不能视为完整回答。 */
export class AiOutputLimitError extends Error {
  constructor(readonly usage: AiCompletionUsage = { promptTokens: null, completionTokens: null, cacheReadTokens: null }) {
    super("Provider 因达到模型输出 token 上限而截断了响应。本轮内容不完整；可检查用户输出上限、模型目录能力或改用输出能力更高的模型。");
    this.name = "AiOutputLimitError";
  }
}

/** 0 表示自动：先用用户明确设置的上限，否则跟随模型目录；目录未知时不向 Provider 发送上限字段。 */
export function resolveAiCompletionMaxTokens(settings: AiRuntimeSettings, account: Pick<ActiveAiModelConfiguration, "maxOutputTokens">): number | undefined {
  const modelLimit = Number.isSafeInteger(account.maxOutputTokens) && Number(account.maxOutputTokens) > 0
    ? Number(account.maxOutputTokens)
    : undefined;
  const configuredLimit = Number.isSafeInteger(settings.maxOutputTokens) && settings.maxOutputTokens > 0
    ? settings.maxOutputTokens
    : undefined;
  let requestedLimit: number | undefined = configuredLimit ?? modelLimit;

  if (settings.speed === "fast") requestedLimit = Math.min(requestedLimit ?? 1024, 1024);

  return modelLimit === undefined
    ? requestedLimit
    : Math.min(requestedLimit ?? modelLimit, modelLimit);
}

function readUsage(value: unknown): AiCompletionUsage | null {
  if (typeof value !== "object" || value === null) return null;
  const usage = value as Record<string, unknown>;
  const promptTokens = usage.prompt_tokens;
  const completionTokens = usage.completion_tokens;
  if (typeof promptTokens !== "number" || !Number.isInteger(promptTokens) || promptTokens < 0) return null;
  if (typeof completionTokens !== "number" || !Number.isInteger(completionTokens) || completionTokens < 0) return null;
  const details = typeof usage.prompt_tokens_details === "object" && usage.prompt_tokens_details !== null
    ? usage.prompt_tokens_details as Record<string, unknown>
    : null;
  const nestedCacheReadTokens = details?.cached_tokens;
  const validCacheCount = (candidate: unknown): candidate is number => typeof candidate === "number" && Number.isSafeInteger(candidate) && candidate >= 0;
  const cacheMissTokens = usage.prompt_cache_miss_tokens;
  const cacheReadTokens = validCacheCount(usage.prompt_cache_hit_tokens)
    ? usage.prompt_cache_hit_tokens
    : validCacheCount(nestedCacheReadTokens) ? nestedCacheReadTokens
      : validCacheCount(cacheMissTokens) && cacheMissTokens <= promptTokens ? promptTokens - cacheMissTokens : null;
  return { promptTokens, completionTokens, cacheReadTokens };
}

function mergeUsage(previous: AiCompletionUsage | null, next: AiCompletionUsage | null): AiCompletionUsage | null {
  if (!next) return previous;
  return {
    promptTokens: next.promptTokens,
    completionTokens: next.completionTokens,
    cacheReadTokens: next.cacheReadTokens ?? previous?.cacheReadTokens ?? null
  };
}

function readDelta(value: unknown): string {
  if (typeof value !== "object" || value === null) return "";
  const payload = value as Record<string, unknown>;
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const first = choices[0];
  if (typeof first !== "object" || first === null) return "";
  const delta = (first as Record<string, unknown>).delta ?? (first as Record<string, unknown>).message;
  if (typeof delta !== "object" || delta === null) return "";
  const content = (delta as Record<string, unknown>).content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const text = (item as Record<string, unknown>).text;
    return typeof text === "string" ? [text] : [];
  }).join("");
}

export interface AiCompletionInput {
  account: ActiveAiModelConfiguration;
  applicationId: ApplicationId;
  permissionMode: PermissionSettings["mode"];
  messages: AiCompletionMessage[];
  extensions: string[];
  settings: AiRuntimeSettings;
  signal: AbortSignal;
  tools?: AiCompletionTool[];
  systemPrompt?: string;
  context?: string;
  onRequest?: (request: { messages: AiCompletionMessage[]; tools: AiCompletionTool[]; maxTokens?: number; reasoningParameter: string | null; reasoningValue: unknown }) => void;
  onResponse?: (response: AiCompletionResult) => void;
  onDelta: (delta: string) => void;
  onProgress: (progress: "thinking" | "content") => void;
}

export async function streamAiCompletion(input: AiCompletionInput): Promise<AiCompletionResult> {
  const maxTokens = resolveAiCompletionMaxTokens(input.settings, input.account);
  const composedSystemPrompt = composeLfaaSystemPrompt(input);
  // DSH 的 replay 接缝保留原生协议。LFAA 在现有 Owner 内适配，仅回传来源匹配的真实字段。
  const wireMessages = input.messages.map(({ providerReplay, ...message }) => ({
    ...message,
    ...(message.role === "assistant" && providerReplay && providerReplay.accountId === input.account.accountId && providerReplay.providerId === input.account.providerId && providerReplay.modelId === input.account.modelId
      ? { reasoning_content: providerReplay.reasoningContent } : {})
  }));
  const requestBody: Record<string, unknown> = {
    model: input.account.modelId,
    messages: [
      { role: "system", content: composedSystemPrompt },
      ...wireMessages
    ],
    stream: true,
    ...(maxTokens !== undefined ? { [input.account.maxTokensField]: maxTokens } : {})
  };
  if (input.tools?.length) {
    requestBody.tools = input.tools;
    requestBody.tool_choice = "auto";
  }
  // 只发送所选模型目录确认支持的官方思考参数；默认档位不发字段，留给 Provider 使用其模型默认值。
  if (input.account.reasoningMode !== "default" && !disabledThinkingValues.has(input.account.reasoningMode)
    && input.account.thinking?.kind === "effort" && input.account.thinking.values.includes(input.account.reasoningMode)) {
    requestBody[input.account.thinking.parameter] = input.account.reasoningMode;
  } else if (input.account.reasoningMode !== "default" && !disabledThinkingValues.has(input.account.reasoningMode)
    && input.account.thinking?.kind === "toggle" && input.account.thinking.values.includes(input.account.reasoningMode as "enabled" | "disabled")) {
    requestBody[input.account.thinking.parameter] = { type: input.account.reasoningMode };
  }

  // 在网络发送前记录实际模型可见上下文和工具协议；只暴露安全请求快照，不包含 URL、密钥或认证头。
  const reasoningParameter = input.account.thinking && input.account.thinking.kind !== "fixed"
    ? input.account.thinking.parameter
    : null;
  input.onRequest?.({
    // 请求观察者只接收可持久化的普通请求快照；私有续接数据在成功 response 中单独保存。
    messages: [{ role: "system", content: composedSystemPrompt }, ...input.messages.map(({ providerReplay: _replay, ...message }) => message)],
    tools: input.tools ?? [],
    ...(maxTokens !== undefined ? { maxTokens } : {}),
    reasoningParameter,
    reasoningValue: reasoningParameter ? requestBody[reasoningParameter] ?? null : null
  });

  let response: Response;
  try {
    response = await fetch(input.account.chatUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        [input.account.keyHeader]: `${input.account.keyPrefix}${input.account.secret}`
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.any([input.signal, AbortSignal.timeout(input.settings.requestTimeoutSeconds * 1000)]),
      redirect: "error"
    });
  } catch (error) {
    if (input.signal.aborted || (error instanceof Error && error.name === "AbortError")) throw error;
    if (error instanceof Error && error.name === "TimeoutError") throw error;
    throw new AiRecoverableRequestError("无法连接到模型 Provider，请检查网络、DNS、代理和账户区域设置。");
  }

  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    if (response.status === 401 || response.status === 403) throw new Error("Provider 拒绝了 API Key，请在“AI 与模型”检查密钥和区域。");
    if (response.status === 402) throw new Error("当前模型 Provider 的账户余额或可用额度不足（HTTP 402）。请为该 Provider 充值，或检查套餐/额度后重试。");
    if (response.status === 400 && input.messages.some(message => Array.isArray(message.content) && message.content.some(part => part.type === "image_url"))) {
      throw new Error("Provider 拒绝了包含屏幕截图的请求（HTTP 400）；请检查模型的图像输入能力和接口参数后重试。");
    }
    if (response.status === 400) throw new Error("Provider 拒绝了请求参数或对话协议（HTTP 400）。请检查模型参数、思考续接和工具消息配对；此状态不能直接判定为模型不支持工具。");
    if (response.status === 404) throw new Error("Provider 找不到所选模型或对话接口（HTTP 404），请重新拉取模型目录并选择可用型号。");
    if (response.status === 413) throw new Error("Provider 拒绝了过大的对话上下文（HTTP 413），请新建会话后重试。");
    if (response.status === 429) throw new AiRecoverableRequestError("Provider 请求过于频繁或账户额度不足（HTTP 429），请检查配额后重试。");
    if (response.status >= 500) throw new AiRecoverableRequestError(`Provider 暂时不可用（HTTP ${response.status}），请稍后重试。`);
    throw new Error(`Provider 返回 HTTP ${response.status}，请检查模型账户设置后重试。`);
  }
  if (!response.body) throw new Error("Provider 没有返回可读取的流式响应。");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let receivedBytes = 0;
  let usage: AiCompletionUsage | null = null;
  let done = false;
  let sawContent = false;
  let sawReasoning = false;
  let sawToolCalls = false;
  let reasoningContent: string | undefined;
  let finishReason: string | undefined;
  const jsonResponse = response.headers.get("content-type")?.toLowerCase().includes("application/json") === true;
  const toolCalls = new Map<number, AiCompletionToolCall>();

  const processLine = (line: string): boolean => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return false;
    const payloadText = trimmed.slice(5).trim();
    if (payloadText === "[DONE]") return true;
    if (!payloadText) return false;
    let payload: unknown;
    try { payload = JSON.parse(payloadText) as unknown; } catch { return false; }
    if (typeof payload === "object" && payload !== null && (payload as Record<string, unknown>).error != null) {
      // 错误帧可能包含请求正文或秘密；只报告协议失败，不能吞掉后继续把半截内容标为成功。
      throw new Error("Provider 流返回错误；本轮输出不完整，未派发其中的工具。请检查 Provider 状态与接口协议。");
    }
    usage = mergeUsage(usage, readUsage((payload as Record<string, unknown> | null)?.usage));
    const choices = Array.isArray((payload as Record<string, unknown> | null)?.choices) ? (payload as Record<string, unknown>).choices as unknown[] : [];
    const first = typeof choices[0] === "object" && choices[0] !== null ? choices[0] as Record<string, unknown> : null;
    if (typeof first?.finish_reason === "string") finishReason = first.finish_reason;
    const messageValue = first?.delta ?? first?.message;
    const deltaValue = typeof messageValue === "object" && messageValue !== null ? messageValue as Record<string, unknown> : null;
    const reasoning = deltaValue?.reasoning_content ?? deltaValue?.reasoning;
    if (typeof deltaValue?.reasoning_content === "string") reasoningContent = (reasoningContent ?? "") + deltaValue.reasoning_content;
    if (!sawReasoning && typeof reasoning === "string" && reasoning.length > 0) {
      sawReasoning = true;
      input.onProgress("thinking");
    }
    const delta = readDelta(payload);
    if (delta) {
      if (!sawContent) {
        sawContent = true;
        input.onProgress("content");
      }
      input.onDelta(delta);
    }
    const streamedCalls = deltaValue && Array.isArray(deltaValue.tool_calls) ? deltaValue.tool_calls : [];
    for (const rawCall of streamedCalls) {
      if (typeof rawCall !== "object" || rawCall === null) continue;
      const call = rawCall as Record<string, unknown>;
      const index = typeof call.index === "number" && Number.isInteger(call.index) && call.index >= 0 ? call.index : toolCalls.size;
      const existing = toolCalls.get(index) ?? { id: "", name: "", arguments: "" };
      if (typeof call.id === "string") existing.id += call.id;
      const fn = typeof call.function === "object" && call.function !== null ? call.function as Record<string, unknown> : null;
      if (typeof fn?.name === "string") existing.name += fn.name;
      if (typeof fn?.arguments === "string") existing.arguments += fn.arguments;
      if (existing.arguments.length > 32_768) throw new Error("模型生成的工具参数超过允许大小。");
      toolCalls.set(index, existing);
      sawToolCalls = true;
    }
    return false;
  };

  try {
    while (!done) {
      const chunk = await reader.read();
      if (chunk.done) break;
      receivedBytes += chunk.value.byteLength;
      if (receivedBytes > 8 * 1024 * 1024) throw new Error("Provider 流式响应超过允许大小。");
      buffer += decoder.decode(chunk.value, { stream: true });
      if (jsonResponse) continue;
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/u, "");
        buffer = buffer.slice(newline + 1);
        if (processLine(line)) { done = true; break; }
        newline = buffer.indexOf("\n");
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) {
      if (jsonResponse) { processLine(`data: ${buffer}`); done = true; }
      else if (processLine(buffer)) done = true;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }

  if (finishReason === "length") throw new AiOutputLimitError(usage ?? undefined);

  // EOF 只是传输结束，不能据此派发半截工具或把部分正文当完整回答。兼容有 finish_reason、无 [DONE] 的服务。
  if (!jsonResponse && !done && finishReason === undefined) {
    const message = "Provider 流在完成标记前中断；本轮输出不完整，未派发其中的工具。";
    if (!sawContent && !sawToolCalls) throw new AiRecoverableRequestError(message, usage ?? undefined);
    throw new Error(message);
  }
  if (finishReason !== undefined && !["stop", "tool_calls", "function_call"].includes(finishReason)) {
    throw new Error("Provider 未以正常回答或工具选择结束；本轮输出不完整，未派发其中的工具。");
  }

  if (!sawContent && !sawToolCalls) {
    const detail = sawReasoning ? "只返回了隐藏推理，没有最终回答或工具选择。" : "没有可读取的回答或工具选择，请检查接口响应协议。";
    throw new AiRecoverableRequestError(`Provider 已结束响应，${detail}`, usage ?? undefined);
  }

  const completedCalls = [...toolCalls.entries()].sort(([left], [right]) => left - right).map(([, call]) => {
    if (!call.id || !call.name) throw new Error("Provider 返回了不完整的工具调用。请切换到兼容 OpenAI 工具调用协议的模型。");
    return call;
  });
  const result: AiCompletionResult = {
    usage: usage ?? { promptTokens: null, completionTokens: null, cacheReadTokens: null }, toolCalls: completedCalls,
    ...(reasoningContent !== undefined ? { providerReplay: { accountId: input.account.accountId, providerId: input.account.providerId, modelId: input.account.modelId, reasoningContent } } : {})
  };
  input.onResponse?.(result);
  return result;
}

/** A provider-specific protocol implementation. The generic OpenAI-compatible stream remains the fallback. */
export interface AiCompletionAdapter {
  stream(input: AiCompletionInput): Promise<AiCompletionResult>;
}

/** Injectable LLM seam used by every inference consumer. Registrations live for their Cordis owner. */
export interface AiCompletionService {
  streamCompletion(input: AiCompletionInput): Promise<AiCompletionResult>;
  resolveMaxTokens(settings: AiRuntimeSettings, account: Pick<ActiveAiModelConfiguration, "maxOutputTokens">): number | undefined;
  registerAdapter(providerId: string, adapter: AiCompletionAdapter): () => void;
  listAdapters(): readonly string[];
}

export function createAiCompletionService(): AiCompletionService {
  const adapters = new Map<string, AiCompletionAdapter>();
  return {
    streamCompletion(input) {
      return (adapters.get(input.account.providerId)?.stream ?? streamAiCompletion)(input);
    },
    resolveMaxTokens: resolveAiCompletionMaxTokens,
    registerAdapter(providerId, adapter) {
      if (!/^[a-z][a-z0-9-]{0,63}$/u.test(providerId) || !adapter || typeof adapter.stream !== "function") {
        throw new Error("LLM Provider Adapter 登记无效。");
      }
      if (adapters.has(providerId)) throw new Error(`LLM Provider Adapter 重复登记：${providerId}`);
      adapters.set(providerId, adapter);
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        if (adapters.get(providerId) === adapter) adapters.delete(providerId);
      };
    },
    listAdapters: () => [...adapters.keys()]
  };
}
