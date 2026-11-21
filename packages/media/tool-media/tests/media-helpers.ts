// 媒体包测试共用的 HTTP 假请求/假响应与 1×1 PNG 常量，供工具测试与接口测试复用。
import type { IncomingMessage, ServerResponse } from "node:http";

/** 1×1 透明 PNG（base64），用作落盘与读取测试的最小图片。 */
export const PNG_1X1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/** 记录状态码、响应头与响应体的假 ServerResponse。 */
export function fakeRes(): { res: ServerResponse; captured: { status: number; body: Buffer; headers: Record<string, string> } } {
  const captured = { status: 0, body: Buffer.alloc(0), headers: {} as Record<string, string> };
  const chunks: Buffer[] = [];
  const res = {
    setHeader(name: string, value: string) { captured.headers[name.toLowerCase()] = value; },
    end(chunk?: string | Buffer) {
      if (chunk !== undefined) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      captured.body = Buffer.concat(chunks);
      return res as unknown as ServerResponse;
    },
  } as unknown as ServerResponse;
  Object.defineProperty(res, "statusCode", {
    get: () => captured.status,
    set: (value: number) => { captured.status = value; },
  });
  return { res, captured };
}

/** 只带 URL、方法与可选请求头的假入参；GET/DELETE 处理器不读请求体。 */
export function fakeReq(url: string, method = "GET", headers: Record<string, string> = {}): IncomingMessage {
  return { url, method, headers } as unknown as IncomingMessage;
}

/** 带 JSON 请求体的假 POST 入参：处理器按异步迭代读取 body。 */
export function fakeJsonReq(url: string, payload: unknown): IncomingMessage {
  const body = Buffer.from(JSON.stringify(payload));
  return {
    url,
    method: "POST",
    async *[Symbol.asyncIterator]() { yield body; },
  } as unknown as IncomingMessage;
}

/** 带任意请求体与请求头的假入参，供二进制/JSON 上传处理器测试。 */
export function fakeBodyReq(
  url: string,
  body: Buffer | string,
  method = "POST",
  headers: Record<string, string> = {},
): IncomingMessage {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
  return {
    url,
    method,
    headers: { "content-type": "application/json", ...headers },
    async *[Symbol.asyncIterator]() { yield buffer; },
  } as unknown as IncomingMessage;
}