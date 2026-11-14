/** 功能：统一认证 HTTP 请求、二进制响应、只读请求合并和会话失效处理；不持有领域 API。 */
import { accountControllerRemoteMethods } from "lfaa-api-account-controller/src/client-contract.generated.js";

export class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

export const sessionExpiredEventName = "lfaa:session-expired";

const pendingReads = new Map<string, Promise<unknown>>();
export let authenticationGeneration = 0;
let pendingAuthenticationCheck: { generation: number; controller: AbortController; promise: Promise<boolean | null> } | null = null;

export function clearPendingReads(): void {
  pendingReads.clear();
}

export function isSessionAuthenticationError(status: number, code: string | undefined): boolean {
  return status === 401 && (code === "authentication_required" || code === "invalid_session");
}

function currentUserRemotePath(): string {
  const { namespace, method } = accountControllerRemoteMethods["auth/me"];
  return `/typert/${encodeURIComponent(namespace)}/${encodeURIComponent(method)}`;
}

function isCurrentUserRequest(path: string): boolean {
  return path === currentUserRemotePath() || path === "/auth/me";
}

export function advanceAuthenticationGeneration(): void {
  authenticationGeneration += 1;
  pendingAuthenticationCheck?.controller.abort();
  pendingAuthenticationCheck = null;
  pendingReads.clear();
}

function expireCurrentSession(generation: number): void {
  if (generation !== authenticationGeneration || typeof window === "undefined") return;
  advanceAuthenticationGeneration();
  window.dispatchEvent(new Event(sessionExpiredEventName));
}

// 非身份读取返回 401 时先用唯一账户 Remote 核对；并发复核合并，登录代次变化会撤销旧复核。
function checkCurrentSession(generation: number, requestPath: string): void {
  if (generation !== authenticationGeneration || typeof window === "undefined") return;
  pendingReads.clear();
  if (isCurrentUserRequest(requestPath)) {
    expireCurrentSession(generation);
    return;
  }

  if (pendingAuthenticationCheck?.generation === generation) return;
  const controller = new AbortController();
  const promise = fetch(`/api${currentUserRemotePath()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: {} }),
    credentials: "include",
    signal: controller.signal
  }).then(async (response): Promise<boolean | null> => {
    if (response.ok) return true;
    if (response.status !== 401) return null;
    try {
      const body: unknown = await response.json();
      if (typeof body !== "object" || body === null || !("error" in body) || typeof body.error !== "string") return null;
      return body.error === "authentication_required" || body.error === "invalid_session" ? false : null;
    } catch {
      return null;
    }
  }).catch(() => null);
  pendingAuthenticationCheck = { generation, controller, promise };
  void promise.then((valid) => {
    if (valid === false) expireCurrentSession(generation);
  }).finally(() => {
    if (pendingAuthenticationCheck?.promise === promise) pendingAuthenticationCheck = null;
  });
}

export function handleSessionAuthenticationFailure(path: string, generation: number): void {
  if (isCurrentUserRequest(path)) expireCurrentSession(generation);
  else checkCurrentSession(generation, path);
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  if (method !== "GET") {
    // 写入与身份切换前后清空共享登记，后续读取不能加入此前账户或旧状态的请求。
    pendingReads.clear();
    try { return await requestOnce<T>(path, options); }
    finally { pendingReads.clear(); }
  }
  // 只合并使用默认参数的查询；自定义 Header、取消信号等请求保持各自语义。
  if (Object.keys(options).length > 0) return requestOnce<T>(path, options);
  let pending = pendingReads.get(path);
  if (!pending) {
    pending = requestOnce<T>(path, options).finally(() => {
      if (pendingReads.get(path) === pending) pendingReads.delete(path);
    });
    pendingReads.set(path, pending);
  }
  // 仅共享传输，不长期缓存 API 数据，也不让某个组件修改其他调用者的响应对象。
  return structuredClone(await pending) as T;
}

async function requestOnce<T>(path: string, options: RequestInit): Promise<T> {
  const requestGeneration = authenticationGeneration;
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
    credentials: "include"
  });
  const rawBody = await response.text();
  let responseBody: unknown = undefined;

  if (rawBody.length > 0) {
    try {
      responseBody = JSON.parse(rawBody) as unknown;
    } catch {
      throw new ApiError(response.status, "服务返回了无法识别的数据。");
    }
  }

  if (!response.ok) {
    const message = typeof responseBody === "object" && responseBody !== null && "message" in responseBody
      && typeof responseBody.message === "string"
      ? responseBody.message
      : "请求失败，请稍后重试。";
    const code = typeof responseBody === "object" && responseBody !== null && "error" in responseBody
      && typeof responseBody.error === "string"
      ? responseBody.error
      : undefined;
    if (isSessionAuthenticationError(response.status, code)) {
      handleSessionAuthenticationFailure(path, requestGeneration);
    }

    throw new ApiError(response.status, message, code);
  }

  return responseBody as T;
}

export async function requestBinary(path: string, options: RequestInit = {}): Promise<Blob> {
  const requestGeneration = authenticationGeneration;
  const headers = new Headers(options.headers);
  const response = await fetch(`/api${path}`, { ...options, headers, credentials: "include" });
  if (!response.ok) {
    const rawBody = await response.text();
    let responseBody: unknown;
    try { responseBody = rawBody ? JSON.parse(rawBody) as unknown : undefined; } catch { responseBody = undefined; }
    const message = typeof responseBody === "object" && responseBody !== null && "message" in responseBody && typeof responseBody.message === "string"
      ? responseBody.message
      : "请求失败，请稍后重试。";
    const code = typeof responseBody === "object" && responseBody !== null && "error" in responseBody && typeof responseBody.error === "string"
      ? responseBody.error
      : undefined;
    if (isSessionAuthenticationError(response.status, code)) {
      handleSessionAuthenticationFailure(path, requestGeneration);
    }
    throw new ApiError(response.status, message, code);
  }
  return response.blob();
}

