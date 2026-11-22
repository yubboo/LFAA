// 浏览器端聊天操作共用的 JSON HTTP 封装：统一请求头、错误文案与离线提示。
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
  const payload = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) {
    throw new Error(payload.error || `请求失败 (${res.status})`);
  }
  return payload;
}