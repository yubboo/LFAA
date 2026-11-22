// 浏览器端聊天操作共用的 JSON HTTP 封装：统一请求头、错误文案与离线提示。
/** 带 HTTP 状态与业务错误码的客户端错误，供 409 工作区占用等分支判断。 */
export interface ChatHttpError extends Error {
  status?: number;
  code?: string;
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      ...init,
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("无法连接本地 LFAA 后台服务（请确认 `pnpm lfaa web` 正在运行后刷新页面重试）。");
    }
    throw error;
  }
  const payload = (await res.json().catch(() => ({}))) as { error?: string; code?: string } & T;
  if (!res.ok) {
    const error = new Error(payload.error || `请求失败 (${res.status})`) as ChatHttpError;
    error.status = res.status;
    if (typeof payload.code === "string") error.code = payload.code;
    throw error;
  }
  return payload;
}