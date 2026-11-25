// 封装浏览器历史、下载记录、密码管理器、联系信息与系统目录选择器的前端 HTTP 客户端。
import type {
  BrowserContactItem,
  BrowserDownloadItem,
  BrowserHistoryItem,
  BrowserPasswordItem,
} from "@lfaa/browser/contract";

export type {
  BrowserContactItem,
  BrowserDownloadItem,
  BrowserHistoryItem,
  BrowserPasswordItem,
};

async function reqJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new Error(data.error || `请求失败 (${res.status})`);
  return data;
}

/** 优先调用 Electron 原生对话框，Web 端回退到缓存 DLL 的 Windows 原生资源管理器选择器。 */
export async function pickBrowserFolder(options?: { title?: string; initialDir?: string }): Promise<{ cancelled: boolean; path?: string; error?: string }> {
  const desktopDialog = typeof window !== "undefined"
    ? (window as unknown as { __LFAA_DESKTOP_DIALOG__?: { pickFolder: (opts?: { title?: string; defaultPath?: string }) => Promise<{ cancelled: boolean; path?: string; error?: string }> } }).__LFAA_DESKTOP_DIALOG__
    : undefined;
  if (desktopDialog) {
    return desktopDialog.pickFolder({
      ...(options?.title ? { title: options.title } : {}),
      ...(options?.initialDir ? { defaultPath: options.initialDir } : {}),
    });
  }
  return reqJson<{ cancelled: boolean; path?: string; error?: string }>("/api/workspace/pick-folder", {
    method: "POST",
    body: JSON.stringify(options ?? {}),
  });
}

export function clearBrowserData() {
  return reqJson<{ cleared: boolean }>("/api/browser/clear-data", { method: "POST" });
}

export function fetchBrowserHistory(q?: string) {
  const qs = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  return reqJson<{ items: BrowserHistoryItem[] }>(`/api/browser/history${qs}`);
}

export function deleteBrowserHistoryItem(id: string) {
  return reqJson<{ removed: boolean }>(`/api/browser/history/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function clearBrowserHistory() {
  return reqJson<{ cleared: boolean }>("/api/browser/history", { method: "DELETE" });
}

export function fetchBrowserDownloads(q?: string) {
  const qs = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  return reqJson<{ items: BrowserDownloadItem[] }>(`/api/browser/downloads${qs}`);
}

export function deleteBrowserDownloadItem(id: string) {
  return reqJson<{ removed: boolean }>(`/api/browser/downloads/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function clearBrowserDownloads() {
  return reqJson<{ cleared: boolean }>("/api/browser/downloads", { method: "DELETE" });
}

export function revealBrowserDownload(id: string) {
  return reqJson<{ opened: boolean }>(`/api/browser/downloads/${encodeURIComponent(id)}/reveal`, { method: "POST" });
}

export function fetchBrowserPasswords(q?: string) {
  const qs = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  return reqJson<{ items: BrowserPasswordItem[] }>(`/api/browser/passwords${qs}`);
}

export function saveBrowserPassword(input: { id?: string; origin: string; username: string; password: string }) {
  return reqJson<{ item: BrowserPasswordItem }>("/api/browser/passwords", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteBrowserPassword(id: string) {
  return reqJson<{ removed: boolean }>(`/api/browser/passwords/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function clearBrowserPasswords() {
  return reqJson<{ cleared: boolean }>("/api/browser/passwords", { method: "DELETE" });
}

export function importBrowserPasswordsCsv(csv: string) {
  return reqJson<{ imported: number }>("/api/browser/passwords/import", {
    method: "POST",
    body: JSON.stringify({ csv }),
  });
}

export function fetchBrowserContacts() {
  return reqJson<{ items: BrowserContactItem[] }>("/api/browser/contacts");
}

export function saveBrowserContact(input: Partial<BrowserContactItem> & { name: string }) {
  return reqJson<{ item: BrowserContactItem }>("/api/browser/contacts", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteBrowserContact(id: string) {
  return reqJson<{ removed: boolean }>(`/api/browser/contacts/${encodeURIComponent(id)}`, { method: "DELETE" });
}
