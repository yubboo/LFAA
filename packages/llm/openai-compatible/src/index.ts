/**
 * 文件：index.ts
 * 作用：把 OpenAI-compatible Provider 连接转换成 LFAA 的统一文本模型流式调用。
 * 负责：协议路由、模型参数映射、SSE 流解析、HTTP 状态归一化、Provider 文本响应解析。
 * 不负责：账户/Secret 持久化、Run 生命周期、Session 历史、Vite/HTTP Controller。
 * 状态归属：无持久状态；每次调用只消费显式参数，流式增量通过 onTextDelta 向 Agent Runtime 上报。
 * 对外接口：callOpenAiCompatibleTextModel、LlmConversationMessage。
 * 关联文件：packages/api/agent-controller/src/agent-runtime-bridge.ts、packages/settings/config-system/src/settings/ai/。
 * 修改注意事项：不得把远端响应体或认证值拼入错误；Provider 特有参数必须来自 Config System capability 描述；支持流式的官方接口必须优先真实流式。
 */
import {
  AiProviderRegistry,
  builtinAiProviderPlugins,
  type AiAccountRecord,
  type AiModelSettingValue,
} from "@lfaa/config-system";
import type { AgentRunRequest } from "@lfaa/agent-runtime";

export type LlmConversationMessage = { role: "user" | "assistant"; content: string };
type ProviderMessage = { role: "system" | "user" | "assistant"; content: string };
type JsonRecord = Record<string, unknown>;

const REASONING_BOOST_INSTRUCTION =
  "Use a more deliberate verification pass before answering. Keep internal reasoning private and return only the final answer.";

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function setRequestPath(target: Record<string, unknown>, path: string, value: AiModelSettingValue): void {
  const parts = path.split(".").filter(Boolean);
  if (!parts.length) return;
  let cursor = target;
  for (const part of parts.slice(0, -1)) {
    const existing = cursor[part];
    if (!existing || typeof existing !== "object" || Array.isArray(existing)) cursor[part] = {};
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]!] = value;
}

function responseText(payload: unknown): string {
  if (!isRecord(payload)) throw new Error("Provider 返回了无效响应。");
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  const choices = payload.choices;
  if (Array.isArray(choices)) {
    const first = choices[0];
    if (isRecord(first)) {
      const message = first.message;
      if (isRecord(message)) {
        const content = message.content;
        if (typeof content === "string" && content.trim()) return content.trim();
      }
    }
  }
  const output = payload.output;
  if (Array.isArray(output)) {
    const text = output.flatMap((item) => {
      if (!isRecord(item) || !Array.isArray(item.content)) return [];
      return item.content.flatMap((part) => isRecord(part) && typeof part.text === "string" ? [part.text] : []);
    }).join("");
    if (text.trim()) return text.trim();
  }
  throw new Error("Provider 响应没有可显示的文本。");
}

function streamDelta(payload: unknown, eventName: string | null): string | null {
  if (!isRecord(payload)) return null;
  const type = typeof payload.type === "string" ? payload.type : eventName;
  if (type === "response.output_text.delta" && typeof payload.delta === "string") return payload.delta;
  const choices = payload.choices;
  if (Array.isArray(choices) && isRecord(choices[0])) {
    const delta = choices[0].delta;
    if (isRecord(delta) && typeof delta.content === "string") return delta.content;
  }
  return null;
}

async function readSseText(response: Response, onTextDelta?: (delta: string) => void): Promise<string> {
  if (!response.body) throw new Error("Provider 声明流式响应，但没有返回响应流。");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let done = false;

  const consumeBlock = (block: string) => {
    let eventName: string | null = null;
    const dataLines: string[] = [];
    for (const rawLine of block.split(/\r?\n/u)) {
      if (!rawLine || rawLine.startsWith(":")) continue;
      if (rawLine.startsWith("event:")) eventName = rawLine.slice(6).trim();
      else if (rawLine.startsWith("data:")) dataLines.push(rawLine.slice(5).trimStart());
    }
    if (!dataLines.length) return;
    const data = dataLines.join("\n");
    if (data === "[DONE]") { done = true; return; }
    let payload: unknown;
    try { payload = JSON.parse(data); }
    catch { return; }
    const delta = streamDelta(payload, eventName);
    if (!delta) return;
    text += delta;
    onTextDelta?.(delta);
  };

  while (!done) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    while (true) {
      const match = /\r?\n\r?\n/u.exec(buffer);
      if (!match || match.index === undefined) break;
      consumeBlock(buffer.slice(0, match.index));
      buffer = buffer.slice(match.index + match[0].length);
      if (done) break;
    }
  }
  buffer += decoder.decode();
  if (!done && buffer.trim()) consumeBlock(buffer);
  if (!text.trim()) throw new Error("Provider 流已结束，但没有返回可显示文本。");
  return text.trim();
}

export async function callOpenAiCompatibleTextModel(options: {
  account: AiAccountRecord;
  request: AgentRunRequest;
  credential: string;
  history: readonly LlmConversationMessage[];
  signal: AbortSignal;
  onTextDelta?: (delta: string) => void;
}): Promise<string> {
  const registry = new AiProviderRegistry(builtinAiProviderPlugins);
  const provider = registry.get(options.account.providerId);
  const connection = provider.resolveConnection({ authMethodId: options.account.authMethodId, settings: options.account.settings });
  if (connection.protocol !== "openai-compatible" || !connection.baseUrl || !connection.authHeader) {
    throw new Error("当前认证方式尚未接入本地 API Runtime；ChatGPT 套餐由 OpenAI 官方账户 Runtime 承担。");
  }

  const authValue = connection.authHeader.scheme ? `${connection.authHeader.scheme} ${options.credential}` : options.credential;
  const headers = {
    "content-type": "application/json",
    accept: "text/event-stream, application/json",
    [connection.authHeader.name]: authValue,
  };
  const capability = provider.describeModel(options.request.model.modelId);
  const settings = options.request.model.settings ?? {};
  const providerHistory: readonly ProviderMessage[] = options.request.executionHints?.reasoningBoost
    ? [{ role: "system", content: REASONING_BOOST_INSTRUCTION }, ...options.history]
    : options.history;

  let url: string;
  const body: Record<string, unknown> = { model: options.request.model.modelId, stream: true };
  if (options.account.providerId === "openai") {
    url = `${connection.baseUrl.replace(/\/$/, "")}/responses`;
    body.input = providerHistory.map((message) => ({ role: message.role, content: message.content }));
  } else {
    url = `${connection.baseUrl.replace(/\/$/, "")}/chat/completions`;
    body.messages = providerHistory;
  }

  for (const field of capability?.settings ?? []) {
    const value = settings[field.id];
    if (value !== undefined) setRequestPath(body, field.requestPath, value);
  }

  const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: options.signal });
  if (!response.ok) {
    if (response.status === 401) throw new Error("Provider 认证失败（HTTP 401），请重新验证当前账户凭据。");
    if (response.status === 429) throw new Error("Provider 当前限流或额度不足（HTTP 429）。");
    throw new Error(`Provider 调用失败（HTTP ${response.status}）。`);
  }
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("text/event-stream")) return readSseText(response, options.onTextDelta);
  return responseText(await response.json());
}
