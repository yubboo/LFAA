/**
 * 文件：anthropic-messages.ts
 * 功能：由 LLM Owner 发送固定 Anthropic Messages API 请求。
 * 作用：账户密钥留在 Host，限制请求地址、协议头、超时取消与请求体大小。
 * 不负责：凭据存储、用户授权、SDK 子进程或响应流解释。
 */

export const ANTHROPIC_MESSAGES_ENDPOINT = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_MESSAGES_REQUEST_MAX_BYTES = 8 * 1024 * 1024;
const ANTHROPIC_API_VERSION = "2023-06-01";
const MAX_API_KEY_CHARS = 4096;
const MAX_BETA_HEADER_CHARS = 2048;

export interface AnthropicMessagesForwardRequest {
  apiKey: string;
  body: Uint8Array;
  betaHeader?: string;
  signal: AbortSignal;
}

/** Sends one bounded SDK Messages request to Anthropic without following redirects. */
export async function forwardAnthropicMessages(
  input: AnthropicMessagesForwardRequest,
  fetcher: typeof fetch = fetch
): Promise<Response> {
  if (!input.apiKey || input.apiKey.length > MAX_API_KEY_CHARS || /[^\x21-\x7E]/u.test(input.apiKey)) {
    throw new Error("Anthropic Messages 请求缺少有效凭据。");
  }
  if (!(input.body instanceof Uint8Array) || input.body.byteLength === 0 || input.body.byteLength > ANTHROPIC_MESSAGES_REQUEST_MAX_BYTES) {
    throw new Error("Anthropic Messages 请求体为空或超过允许大小。");
  }
  if (input.betaHeader !== undefined
    && (input.betaHeader.length > MAX_BETA_HEADER_CHARS || !/^[A-Za-z0-9_, -]+$/u.test(input.betaHeader))) {
    throw new Error("Anthropic Messages beta 协议头无效。");
  }
  if (input.signal.aborted) throw input.signal.reason ?? new DOMException("请求已取消", "AbortError");

  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "text/event-stream",
    "anthropic-version": ANTHROPIC_API_VERSION,
    "x-api-key": input.apiKey
  };
  if (input.betaHeader) headers["anthropic-beta"] = input.betaHeader;

  return fetcher(ANTHROPIC_MESSAGES_ENDPOINT, {
    method: "POST",
    headers,
    body: Buffer.from(input.body),
    signal: input.signal,
    redirect: "error"
  });
}
