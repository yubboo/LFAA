// 封装浏览器面板与设置页共用的 HTTP API 请求辅助函数，支持多标签、动态视口、键鼠穿透与 DevTools 日志。
import type {
  BrowserConsoleItem,
  BrowserInputPayload,
  BrowserNetworkItem,
  BrowserSessionSnapshot,
  BrowserSettingsConfig,
  BrowserStreamFramePayload,
  BrowserTabItem,
} from "@lfaa/browser/contract";

export type {
  BrowserConsoleItem,
  BrowserInputPayload,
  BrowserNetworkItem,
  BrowserSessionSnapshot,
  BrowserSettingsConfig,
  BrowserStreamFramePayload,
  BrowserTabItem,
};

export function readClientBrowserAppearance(): { deviceScaleFactor: number; colorScheme: "dark" | "light" } {
  if (typeof window === "undefined") return { deviceScaleFactor: 2, colorScheme: "dark" };
  const rawDpr = Number(window.devicePixelRatio);
  const deviceScaleFactor = Number.isFinite(rawDpr) && rawDpr > 0 ? Math.max(1, Math.min(2.5, Math.round(rawDpr * 100) / 100)) : 2;
  const resolved = document.documentElement.dataset.resolvedTheme;
  const colorScheme: "dark" | "light" = resolved === "light" ? "light" : "dark";
  return { deviceScaleFactor, colorScheme };
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new Error(data.error || `请求失败 (${res.status})`);
  return data;
}

export function fetchBrowserState(sessionId: string) {
  return requestJson<{ state: BrowserSessionSnapshot }>(`/api/browser/state?sessionId=${encodeURIComponent(sessionId)}`);
}

export function setBrowserViewport(sessionId: string, width: number, height: number) {
  return requestJson<{ state: BrowserSessionSnapshot }>("/api/browser/viewport", {
    method: "POST",
    body: JSON.stringify({ sessionId, width, height, ...readClientBrowserAppearance() }),
  });
}

export function manageBrowserTab(
  sessionId: string,
  payload: { action: "new" | "activate" | "close"; tabId?: string; url?: string; viewport?: { width: number; height: number } },
) {
  return requestJson<{ state: BrowserSessionSnapshot }>("/api/browser/tabs", {
    method: "POST",
    body: JSON.stringify({ sessionId, ...readClientBrowserAppearance(), ...payload }),
  });
}

export function navigateBrowser(sessionId: string, url: string, viewport?: { width: number; height: number }) {
  return requestJson<{ state: BrowserSessionSnapshot }>("/api/browser/navigate", {
    method: "POST",
    body: JSON.stringify({ sessionId, url, ...readClientBrowserAppearance(), ...(viewport ? { viewport } : {}) }),
  });
}

export function subscribeBrowserStream(
  sessionId: string,
  onFrame: (frame: BrowserStreamFramePayload) => void,
  onStatusChange?: (connected: boolean) => void,
): () => void {
  if (typeof window === "undefined" || typeof EventSource === "undefined") return () => {};
  const { deviceScaleFactor, colorScheme } = readClientBrowserAppearance();
  const url = `/api/browser/stream?sessionId=${encodeURIComponent(sessionId)}&dpr=${deviceScaleFactor}&theme=${colorScheme}`;
  const es = new EventSource(url);
  es.onopen = () => onStatusChange?.(true);
  es.onerror = () => onStatusChange?.(false);
  es.addEventListener("frame", (event) => {
    try {
      const payload = JSON.parse((event as MessageEvent<string>).data) as BrowserStreamFramePayload;
      onStatusChange?.(true);
      onFrame(payload);
    } catch {
      // 忽略损坏的帧消息
    }
  });
  return () => {
    onStatusChange?.(false);
    es.close();
  };
}

export function controlBrowserNav(sessionId: string, action: "back" | "forward" | "reload" | "close") {
  return requestJson<{ state: BrowserSessionSnapshot }>(`/api/browser/${action}`, {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

/** 超轻量键鼠输入直通：后端直接走常驻 CDP 返回 204，不阻塞截图与 JSON 序列化。 */
export async function sendBrowserInput(sessionId: string, payload: BrowserInputPayload): Promise<void> {
  await fetch("/api/browser/input", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, ...payload }),
  });
}

export function toggleBrowserTakeover(sessionId: string, paused: boolean, openWindow = false) {
  return requestJson<{ state: BrowserSessionSnapshot }>("/api/browser/takeover", {
    method: "POST",
    body: JSON.stringify({ sessionId, paused, openWindow }),
  });
}

export function fetchBrowserConsole(sessionId: string) {
  return requestJson<{ items: BrowserConsoleItem[] }>(`/api/browser/console?sessionId=${encodeURIComponent(sessionId)}`);
}

export function fetchBrowserNetwork(sessionId: string) {
  return requestJson<{ items: BrowserNetworkItem[] }>(`/api/browser/network?sessionId=${encodeURIComponent(sessionId)}`);
}

export function clearBrowserLogs(sessionId: string) {
  return requestJson<{ cleared: boolean }>("/api/browser/logs/clear", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

/** 下载位置来源：system 跟随本机系统「下载」目录，custom 为用户自选目录。 */
export type DownloadDirSource = "system" | "custom";

export function fetchBrowserConfig() {
  return requestJson<{ config: BrowserSettingsConfig; downloadDirSource?: DownloadDirSource }>("/api/browser/config");
}

export function saveBrowserConfig(patch: Partial<BrowserSettingsConfig>) {
  return requestJson<{ config: BrowserSettingsConfig; downloadDirSource?: DownloadDirSource }>("/api/browser/config", {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}
