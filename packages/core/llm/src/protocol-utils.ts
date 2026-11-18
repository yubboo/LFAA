// 提供 @lfaa/llm 的协议识别、校验、URL 规范化与 SSE 增量行解析工具。
import type { LlmApiProtocol, LlmProviderKind } from "./types";

const VALID_PROTOCOLS = new Set<LlmApiProtocol>([
  "openai-chat",
  "openai-responses",
  "anthropic-messages",
  "gemini-generate-content",
]);

export function asApiProtocol(raw: unknown): LlmApiProtocol | undefined {
  return typeof raw === "string" && VALID_PROTOCOLS.has(raw as LlmApiProtocol)
    ? (raw as LlmApiProtocol)
    : undefined;
}

// 根据显式协议字段、提供商 ID 与 Base URL 推断实际生效的线级通信协议。
export function resolveEffectiveProtocol(input: {
  apiProtocol?: LlmApiProtocol | undefined;
  providerId?: string | undefined;
  kind?: LlmProviderKind | undefined;
  baseUrl: string;
}): LlmApiProtocol {
  if (input.apiProtocol && VALID_PROTOCOLS.has(input.apiProtocol)) {
    return input.apiProtocol;
  }
  const lowerUrl = input.baseUrl.trim().toLowerCase();
  if (lowerUrl.includes("/anthropic") || lowerUrl.includes("api.anthropic.com") || input.providerId === "claude") {
    return "anthropic-messages";
  }
  if (
    (lowerUrl.includes("generativelanguage.googleapis.com") && !lowerUrl.includes("/openai"))
    || input.providerId === "gemini"
  ) {
    return "gemini-generate-content";
  }
  if (lowerUrl.endsWith("/responses")) {
    return "openai-responses";
  }
  return "openai-chat";
}

export function normalizeHttpBaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/u, "");
  const parsed = new URL(trimmed);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("模型服务地址仅支持 http 或 https 协议。");
  }
  return trimmed;
}

export function isDeepSeekEndpoint(kind: LlmProviderKind, baseUrl: string, providerId?: string): boolean {
  return kind === "deepseek" || providerId === "deepseek" || baseUrl.toLowerCase().includes("deepseek.com");
}

// 按行迭代 SSE `data:` 负载并回调解析出的 JSON 对象，忽略 `[DONE]` 终止符与心跳注释。
export async function iterateSseJsonPayloads(
  response: Response,
  onPayload: (payload: Record<string, unknown>, eventName?: string) => void,
): Promise<void> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent: string | undefined;

  const flushLine = (rawLine: string) => {
    const line = rawLine.trim();
    if (!line) {
      currentEvent = undefined;
      return;
    }
    if (line.startsWith("event:")) {
      currentEvent = line.slice(6).trim();
      return;
    }
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") return;
    try {
      const parsed = JSON.parse(data) as unknown;
      if (typeof parsed === "object" && parsed !== null) {
        onPayload(parsed as Record<string, unknown>, currentEvent);
      }
    } catch {
      // 忽略分片/不完整注释帧
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex >= 0) {
      flushLine(buffer.slice(0, newlineIndex));
      buffer = buffer.slice(newlineIndex + 1);
      newlineIndex = buffer.indexOf("\n");
    }
  }
  if (buffer.trim()) {
    flushLine(buffer);
  }
}
