/**
 * 功能：通过已有认证 API 调用 LFAA Agent 与会话。
 * 作用：提供提交/跟随/继续/澄清/审批/停止和历史页；不启动第二个宿主、不重试写请求、不代替用户批准。
 * 关联文件：sdk-protocol、api/session-controller；认证使用浏览器 Cookie 或调用方提供的当前登录 Cookie。
 */
import type { AiRunInput, AiRunView, AiSessionView, AiMessageView, ApplicationId, LfaaRunEvent } from "lfaa-sdk-protocol";
export type * from "lfaa-sdk-protocol";

export class LfaaApiError extends Error {
  constructor(readonly status: number) { super(`LFAA API 请求失败（HTTP ${status}）。`); this.name = "LfaaApiError"; }
}

export interface LfaaClientOptions {
  /** 明确的控制端 API 根地址，通常以 /api/ 结束。 */
  apiUrl: string;
  /** Node 客户端使用已登录 Cookie；只保存在调用方内存，不记录或自动获取用户密钥。 */
  authenticationHeaders?: () => NonNullable<Parameters<typeof globalThis.fetch>[1]>["headers"] | Promise<NonNullable<Parameters<typeof globalThis.fetch>[1]>["headers"]>;
  fetch?: typeof globalThis.fetch;
}

export class LfaaClient {
  private readonly root: URL;
  private readonly fetcher: typeof globalThis.fetch;
  constructor(private readonly options: LfaaClientOptions) {
    this.root = new URL(options.apiUrl.endsWith("/") ? options.apiUrl : `${options.apiUrl}/`);
    if (!["http:", "https:"].includes(this.root.protocol) || this.root.username || this.root.password || this.root.search || this.root.hash) throw new Error("SDK API 根地址无效，不得嵌入凭据或查询参数。");
    this.fetcher = options.fetch ?? globalThis.fetch;
  }
  private id(id: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(id)) throw new Error("SDK ID 必须是服务端返回的 UUID。");
    return encodeURIComponent(id);
  }
  private async response(path: string, method: string, body: unknown, signal?: AbortSignal): Promise<Response> {
    signal?.throwIfAborted();
    const headers = new Headers(await this.options.authenticationHeaders?.());
    headers.set("Accept", path.endsWith("/events") ? "text/event-stream" : "application/json");
    if (body !== undefined) headers.set("Content-Type", "application/json");
    const response = await this.fetcher(new URL(path, this.root), { method, headers, credentials: "include", redirect: "error", ...(signal ? { signal } : {}), ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) { await response.body?.cancel().catch(() => undefined); throw new LfaaApiError(response.status); }
    return response;
  }
  private async json<T>(path: string, method = "GET", body?: unknown, signal?: AbortSignal): Promise<T> {
    const response = await this.response(path, method, body, signal);
    if (!response.body) throw new Error("LFAA API 没有返回数据。");
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let bytes = 0, text = "";
    try {
      while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength; if (bytes > 8 * 1024 * 1024) throw new Error("SDK 响应超过大小限制，请使用分页。"); text += decoder.decode(part.value, { stream: true }); }
      text += decoder.decode();
      return JSON.parse(text) as T;
    } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  }
  listSessions(appId: ApplicationId, archived = false, signal?: AbortSignal): Promise<{ sessions: AiSessionView[] }> { return this.json(`ai/sessions?appId=${encodeURIComponent(appId)}&archived=${archived}`, "GET", undefined, signal); }
  messages(sessionId: string, input: { cursor?: string; limit?: number } = {}, signal?: AbortSignal): Promise<{ messages: AiMessageView[]; nextCursor: string | null }> {
    const limit = input.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || input.cursor !== undefined && !/^[A-Za-z0-9_-]{1,512}$/u.test(input.cursor)) throw new Error("SDK 消息分页参数无效。");
    return this.json(`ai/sessions/${this.id(sessionId)}/messages?limit=${limit}${input.cursor ? `&cursor=${encodeURIComponent(input.cursor)}` : ""}`, "GET", undefined, signal);
  }
  submit(input: AiRunInput, signal?: AbortSignal): Promise<{ run: AiRunView }> { return this.json("ai/runs", "POST", input, signal); }
  run(runId: string, signal?: AbortSignal): Promise<{ run: AiRunView }> { return this.json(`ai/runs/${this.id(runId)}`, "GET", undefined, signal); }
  steer(runId: string, content: string, signal?: AbortSignal): Promise<unknown> { return this.json(`ai/runs/${this.id(runId)}/input`, "POST", { content }, signal); }
  answer(runId: string, questionId: string, answer: string, skipped = false, signal?: AbortSignal): Promise<unknown> { return this.json(`ai/runs/${this.id(runId)}/answer`, "POST", { questionId, answer, skipped }, signal); }
  cancel(runId: string, signal?: AbortSignal): Promise<{ run: AiRunView }> { return this.json(`ai/runs/${this.id(runId)}/cancel`, "POST", undefined, signal); }
  approvals(signal?: AbortSignal): Promise<{ approvals: unknown[] }> { return this.json("ai/approvals", "GET", undefined, signal); }
  decideApproval(approvalId: string, decision: "approved" | "denied", remember = false, signal?: AbortSignal): Promise<unknown> { return this.json(`ai/approvals/${this.id(approvalId)}`, "PATCH", { decision, remember }, signal); }
  archive(sessionId: string, archived: boolean, signal?: AbortSignal): Promise<{ session: AiSessionView }> { return this.json(`ai/sessions/${this.id(sessionId)}/archive`, "PATCH", { archived }, signal); }
  /** 跟随现有运行；断开只取消订阅，停止必须显式调用 cancel，不重放提交。 */
  async *events(runId: string, signal?: AbortSignal): AsyncGenerator<LfaaRunEvent> {
    const response = await this.response(`ai/runs/${this.id(runId)}/events`, "GET", undefined, signal);
    if (!response.body || !response.headers.get("content-type")?.includes("text/event-stream")) throw new Error("LFAA 事件响应协议无效。");
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let buffer = "", completed = false;
    try {
      while (!completed) {
        const part = await reader.read();
        if (part.done) break;
        buffer += decoder.decode(part.value, { stream: true });
        let boundary: RegExpExecArray | null;
        while ((boundary = /\r?\n\r?\n/u.exec(buffer))) {
          const frame = buffer.slice(0, boundary.index); buffer = buffer.slice(boundary.index + boundary[0].length);
          if (frame.length > 1024 * 1024) throw new Error("SDK 事件超过大小限制。");
          const lines = frame.split(/\r?\n/u);
          const event = lines.find(line => line.startsWith("event:"))?.slice(6).trim() ?? "message";
          const data = lines.filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
          if (!data || event === "keepalive") continue;
          const payload: unknown = JSON.parse(data);
          if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("SDK 事件数据格式无效。");
          completed = event === "done";
          yield { event, data: payload as Record<string, unknown> };
          if (completed) break;
        }
        if (buffer.length > 1024 * 1024) throw new Error("SDK 事件缓冲超过大小限制。");
      }
      if (!completed) throw new Error("LFAA 事件流在完成通知前断开；可按同一 runId 查询或继续跟随，未重新提交任务。");
    } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  }
}
