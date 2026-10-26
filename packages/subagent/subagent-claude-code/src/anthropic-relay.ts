/**
 * 文件：anthropic-relay.ts
 * 功能：为单次 Claude SDK Run 提供仅 loopback 可达的 Messages API relay。
 * 作用：SDK 使用随机 Run token，真实账户 Key 只在 Host 调用 LLM Owner 时使用。
 * 不负责：操作授权、系统级网络隔离或对任意 URL 的代理。
 */
import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { once } from "node:events";
import { forwardAnthropicMessages, ANTHROPIC_MESSAGES_REQUEST_MAX_BYTES } from "lfaa-llm/src/anthropic-messages.js";
import type { AnthropicMessagesForwardRequest } from "lfaa-llm/src/anthropic-messages.js";

export const ANTHROPIC_RELAY_RESPONSE_MAX_BYTES = 8 * 1024 * 1024;
const MAX_ERROR_BODY_BYTES = 64 * 1024;
const MAX_CONCURRENT_REQUESTS = 1;
const MAX_REQUEST_SECONDS = 60;
const ANTHROPIC_API_VERSION = "2023-06-01";

function isAllowedMessagesRoute(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const route = new URL(value, "http://127.0.0.1");
    return route.origin === "http://127.0.0.1"
      && route.pathname === "/v1/messages"
      && (route.search === "" || route.search === "?beta=true");
  } catch { return false; }
}

type Forwarder = (input: AnthropicMessagesForwardRequest) => Promise<Response>;

export interface ClaudeAnthropicRelay {
  readonly baseUrl: string;
  readonly token: string;
  close(): Promise<void>;
}

function sendJson(response: ServerResponse, status: number, message: string): void {
  if (response.destroyed || response.headersSent) return;
  const body = JSON.stringify({ type: "error", error: { type: "api_error", message } });
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", connection: "close" });
  response.end(body);
}

function tokenMatches(actual: string | string[] | undefined, expected: string): boolean {
  if (typeof actual !== "string") return false;
  const actualBytes = Buffer.from(actual, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return actualBytes.byteLength === expectedBytes.byteLength && timingSafeEqual(actualBytes, expectedBytes);
}

function readRequestBody(request: IncomingMessage, response: ServerResponse): Promise<Buffer | null> {
  const contentLength = request.headers["content-length"];
  if (typeof contentLength === "string" && Number(contentLength) > ANTHROPIC_MESSAGES_REQUEST_MAX_BYTES) {
    sendJson(response, 413, "请求体超过允许大小。");
    request.resume();
    return Promise.resolve(null);
  }
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let exceeded = false;
    request.on("data", (chunk: Buffer | string) => {
      if (exceeded) return;
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.byteLength;
      if (size > ANTHROPIC_MESSAGES_REQUEST_MAX_BYTES) {
        exceeded = true;
        chunks.length = 0;
        sendJson(response, 413, "请求体超过允许大小。");
        request.resume();
        return;
      }
      chunks.push(bytes);
    });
    request.once("end", () => resolve(exceeded ? null : Buffer.concat(chunks, size)));
    request.once("error", reject);
    request.once("aborted", () => resolve(null));
  });
}

function redact(value: string, apiKey: string, token: string): string {
  return value.split(apiKey).join("[Anthropic API Key 已脱敏]").split(token).join("[relay token 已脱敏]");
}

async function readWithAbort<T>(read: () => Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw signal.reason ?? new DOMException("请求已取消", "AbortError");
  let abort: (() => void) | undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    abort = () => reject(signal.reason ?? new DOMException("请求已取消", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
  });
  try { return await Promise.race([read(), aborted]); }
  finally { if (abort) signal.removeEventListener("abort", abort); }
}

async function readErrorBody(response: Response, signal: AbortSignal): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await readWithAbort(() => reader.read(), signal);
      if (done) break;
      size += value.byteLength;
      if (size > MAX_ERROR_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return "";
      }
      chunks.push(value);
      if (signal.aborted) throw signal.reason ?? new DOMException("请求已取消", "AbortError");
    }
  } finally {
    if (signal.aborted) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(body);
}

async function waitForDrain(response: ServerResponse): Promise<void> {
  if (response.destroyed) throw new Error("SDK relay client disconnected");
  await new Promise<void>((resolve, reject) => {
    const onDrain = (): void => { cleanup(); resolve(); };
    const onClose = (): void => { cleanup(); reject(new Error("SDK relay client disconnected")); };
    const onError = (error: Error): void => { cleanup(); reject(error); };
    const cleanup = (): void => {
      response.off("drain", onDrain);
      response.off("close", onClose);
      response.off("error", onError);
    };
    response.once("drain", onDrain);
    response.once("close", onClose);
    response.once("error", onError);
  });
}

function safeResponseHeaders(upstream: Response): Record<string, string> {
  const headers: Record<string, string> = { "cache-control": "no-store", "x-content-type-options": "nosniff" };
  const contentType = upstream.headers.get("content-type");
  if (contentType && contentType.length <= 256) headers["content-type"] = contentType;
  for (const name of ["retry-after", "request-id", "x-request-id", "anthropic-organization-id"]) {
    const value = upstream.headers.get(name);
    if (value && value.length <= 256) headers[name] = value;
  }
  return headers;
}

async function streamResponse(upstream: Response, response: ServerResponse, signal: AbortSignal): Promise<void> {
  if (!upstream.body) throw new Error("Anthropic Messages API did not return a body");
  const reader = upstream.body.getReader();
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await readWithAbort(() => reader.read(), signal);
      if (done) break;
      bytes += value.byteLength;
      if (bytes > ANTHROPIC_RELAY_RESPONSE_MAX_BYTES) throw new Error("Anthropic Messages response exceeded the relay limit");
      if (signal.aborted) throw signal.reason ?? new DOMException("请求已取消", "AbortError");
      if (!response.write(value)) await waitForDrain(response);
    }
    response.end();
  } finally {
    if (signal.aborted) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/** Creates a per-Run, fixed-route relay. No API key or destination is accepted from the SDK request. */
export async function createClaudeAnthropicRelay(
  apiKey: string,
  runSignal: AbortSignal,
  forwarder: Forwarder = input => forwardAnthropicMessages(input)
): Promise<ClaudeAnthropicRelay> {
  const token = randomBytes(32).toString("base64url");
  let activeRequests = 0;
  const server = createServer(async (request, response) => {
    if (!isAllowedMessagesRoute(request.url)) {
      request.resume();
      sendJson(response, 404, "不支持的 relay 路由。");
      return;
    }
    if (request.method !== "POST") {
      request.resume();
      response.setHeader("allow", "POST");
      sendJson(response, 405, "只支持 POST 请求。");
      return;
    }
    if (!tokenMatches(request.headers["x-api-key"], token)) {
      request.resume();
      sendJson(response, 401, "relay token 无效。");
      return;
    }
    if (request.headers["content-type"]?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
      request.resume();
      sendJson(response, 415, "只支持 JSON 请求。");
      return;
    }
    if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
      request.resume();
      sendJson(response, 429, "本次 Run 的模型请求并发额度已满。");
      return;
    }
    if (runSignal.aborted) {
      request.resume();
      sendJson(response, 503, "本次 Agent Run 已停止。");
      return;
    }

    activeRequests += 1;
    const clientController = new AbortController();
    const signal = AbortSignal.any([runSignal, clientController.signal]);
    const abortForDisconnect = (): void => clientController.abort(new DOMException("SDK relay client disconnected", "AbortError"));
    const abortForRun = (): void => clientController.abort(runSignal.reason ?? new DOMException("Agent Run stopped", "AbortError"));
    request.once("aborted", abortForDisconnect);
    response.once("close", () => { if (!response.writableEnded) abortForDisconnect(); });
    runSignal.addEventListener("abort", abortForRun, { once: true });
    request.setTimeout(MAX_REQUEST_SECONDS * 1000, () => request.destroy(new Error("SDK relay request timed out")));
    try {
      const body = await readRequestBody(request, response);
      if (!body || response.headersSent || signal.aborted) return;
      let parsed: unknown;
      try { parsed = JSON.parse(body.toString("utf8")) as unknown; }
      catch { sendJson(response, 400, "Anthropic Messages 请求 JSON 无效。"); return; }
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)
        || (parsed as Record<string, unknown>).stream !== true
        || !Array.isArray((parsed as Record<string, unknown>).messages)
        || typeof (parsed as Record<string, unknown>).model !== "string") {
        sendJson(response, 400, "只支持流式 Anthropic Messages 请求。");
        return;
      }
      const sdkVersion = request.headers["anthropic-version"];
      if (typeof sdkVersion !== "string" || sdkVersion !== ANTHROPIC_API_VERSION) {
        sendJson(response, 400, "Anthropic API 版本无效。");
        return;
      }
      const betaHeader = request.headers["anthropic-beta"];
      if (Array.isArray(betaHeader)) { sendJson(response, 400, "Anthropic beta 协议头无效。"); return; }

      let upstream: Response;
      try {
        upstream = await forwarder({
          apiKey,
          body,
          ...(betaHeader ? { betaHeader } : {}),
          signal
        });
      } catch {
        if (!response.destroyed && !signal.aborted) sendJson(response, 502, "无法连接 Anthropic Messages API。");
        return;
      }
      if (upstream.status >= 300 && upstream.status < 400) {
        await upstream.body?.cancel().catch(() => undefined);
        sendJson(response, 502, "Anthropic API 重定向已拒绝。");
        return;
      }
      if (!upstream.ok) {
        const raw = await readErrorBody(upstream, signal).catch(() => "");
        const isJson = upstream.headers.get("content-type")?.toLowerCase().includes("application/json") === true;
        const bodyText = isJson && raw ? redact(raw, apiKey, token) : JSON.stringify({
          type: "error",
          error: { type: "api_error", message: `Anthropic Messages API 返回 HTTP ${upstream.status}。` }
        });
        response.writeHead(upstream.status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", connection: "close" });
        response.end(bodyText);
        return;
      }
      const contentType = upstream.headers.get("content-type")?.toLowerCase() ?? "";
      if (upstream.status !== 200 || !contentType.startsWith("text/event-stream")) {
        await upstream.body?.cancel().catch(() => undefined);
        sendJson(response, 502, "Anthropic Messages API 未返回有效流式响应。");
        return;
      }
      response.writeHead(200, safeResponseHeaders(upstream));
      try { await streamResponse(upstream, response, signal); }
      catch {
        await upstream.body?.cancel().catch(() => undefined);
        if (!response.destroyed) response.destroy();
      }
    } catch {
      if (!response.headersSent && !response.destroyed && !signal.aborted) sendJson(response, 502, "Anthropic Messages relay 请求失败。");
    } finally {
      request.off("aborted", abortForDisconnect);
      runSignal.removeEventListener("abort", abortForRun);
      activeRequests = Math.max(0, activeRequests - 1);
    }
  });
  server.headersTimeout = 10_000;
  server.requestTimeout = MAX_REQUEST_SECONDS * 1000;
  server.keepAliveTimeout = 5_000;
  server.maxHeadersCount = 32;
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    await new Promise<void>(resolve => server.close(() => resolve()));
    throw new Error("无法为 Claude Agent SDK 分配本地 relay 端口。");
  }
  let closed = false;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    token,
    async close() {
      if (closed) return;
      closed = true;
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  };
}
