/**
 * 文件：runtime.ts
 * 功能：通过当前用户已激活的 Provider 执行流式 AI Work 对话。
 * 作用：固定使用设置中心登记的 HTTPS 地址，服务端注入密钥并限制超时、输出量和响应体大小。
 * 不负责：会话所有权、持久化、工具执行或权限审批。
 * 关联文件：server/src/modules/settings/service.ts、server/src/ai/sessions.ts、server/src/api/routes.ts。
 * 修改注意事项：不能把密钥、Provider 错误正文或模型隐藏推理内容发送给浏览器或写入日志。
 */
import type { ApplicationId } from "../modules/preferences/service.js";
import type { ActiveAiModelConfiguration, AiRuntimeSettings } from "../modules/settings/service.js";

export interface AiCompletionMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiCompletionUsage {
  promptTokens: number | null;
  completionTokens: number | null;
}

function systemInstruction(applicationId: ApplicationId, extensions: string[]): string {
  const applicationContext: Record<ApplicationId, string> = {
    steamcmd: "当前应用是 SteamCMD 游戏服务器工作区。可提供知识、规划和文本建议；当前未连接服务器操作工具。",
    minecraft: "当前应用是 Minecraft 工作区。可提供知识、规划和文本建议；当前未连接实例操作工具。",
    writing: "当前应用是 AI 写作工作区。可提供构思和写作协助；当前未连接作品文件读写工具。"
  };
  return [
    "你是 LFAA AI Work 中的对话助手。请用用户使用的语言回答，清楚区分建议、计划与已执行操作。",
    applicationContext[applicationId],
    ...extensions
  ].join("\n\n");
}

function readUsage(value: unknown): AiCompletionUsage | null {
  if (typeof value !== "object" || value === null) return null;
  const usage = value as Record<string, unknown>;
  const promptTokens = usage.prompt_tokens;
  const completionTokens = usage.completion_tokens;
  if (typeof promptTokens !== "number" || !Number.isInteger(promptTokens) || promptTokens < 0) return null;
  if (typeof completionTokens !== "number" || !Number.isInteger(completionTokens) || completionTokens < 0) return null;
  return { promptTokens, completionTokens };
}

function readDelta(value: unknown): string {
  if (typeof value !== "object" || value === null) return "";
  const payload = value as Record<string, unknown>;
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const first = choices[0];
  if (typeof first !== "object" || first === null) return "";
  const delta = (first as Record<string, unknown>).delta;
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

export async function streamAiCompletion(input: {
  account: ActiveAiModelConfiguration;
  applicationId: ApplicationId;
  messages: AiCompletionMessage[];
  extensions: string[];
  settings: AiRuntimeSettings;
  signal: AbortSignal;
  onDelta: (delta: string) => void;
}): Promise<AiCompletionUsage> {
  const requestedTokens = input.settings.speed === "fast"
    ? Math.min(input.settings.maxOutputTokens, 1024)
    : input.settings.speed === "deep"
      ? Math.max(input.settings.maxOutputTokens, 4096)
      : input.settings.maxOutputTokens;
  const maxTokens = Math.min(16384, requestedTokens);
  const requestBody: Record<string, unknown> = {
    model: input.account.modelId,
    messages: [
      { role: "system", content: systemInstruction(input.applicationId, input.extensions) },
      ...input.messages
    ],
    stream: true,
    [input.account.providerId === "xiaomi" ? "max_completion_tokens" : "max_tokens"]: maxTokens
  };

  const response = await fetch(input.account.chatUrl, {
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

  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    if (response.status === 401 || response.status === 403) throw new Error("Provider 拒绝了 API Key，请在“AI 与模型”检查密钥和区域。");
    throw new Error(`Provider 返回 HTTP ${response.status}，请检查模型账户设置后重试。`);
  }
  if (!response.body) throw new Error("Provider 没有返回可读取的流式响应。");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let receivedBytes = 0;
  let usage: AiCompletionUsage | null = null;
  let done = false;

  const processLine = (line: string): boolean => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return false;
    const payloadText = trimmed.slice(5).trim();
    if (payloadText === "[DONE]") return true;
    if (!payloadText) return false;
    let payload: unknown;
    try { payload = JSON.parse(payloadText) as unknown; } catch { return false; }
    usage = readUsage((payload as Record<string, unknown> | null)?.usage) ?? usage;
    const delta = readDelta(payload);
    if (delta) input.onDelta(delta);
    return false;
  };

  try {
    while (!done) {
      const chunk = await reader.read();
      if (chunk.done) break;
      receivedBytes += chunk.value.byteLength;
      if (receivedBytes > 8 * 1024 * 1024) throw new Error("Provider 流式响应超过允许大小。");
      buffer += decoder.decode(chunk.value, { stream: true });
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/u, "");
        buffer = buffer.slice(newline + 1);
        if (processLine(line)) { done = true; break; }
        newline = buffer.indexOf("\n");
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) processLine(buffer);
  } finally {
    if (!done) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }

  return usage ?? { promptTokens: null, completionTokens: null };
}
