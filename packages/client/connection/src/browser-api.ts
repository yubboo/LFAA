/** 功能：浏览器工作区、标签、凭据视图与活动读取/控制请求；复用统一认证请求 Owner。 */
import type { BrowserProviderId } from "lfaa-util-values/src/browser-provider.js";
import type { UserSettings } from "lfaa-util-values/src/settings-contract.js";
import { ApiError, authenticationGeneration, handleSessionAuthenticationFailure, isSessionAuthenticationError, request } from "./http-client.js";
export interface BrowserProviderSummary {
  id: BrowserProviderId;
  name: string;
  available: boolean;
  reason?: string;
  isolation: "app-session" | "new-profile" | "user-profile";
}
export interface BrowserTabSummary { tabId: number; title: string; url: string; active: boolean; state: string }
export interface BrowserSessionSnapshot {
  sessionId: string;
  providerId: BrowserProviderId;
  revision: number;
  url: string;
  title: string;
  loading: boolean;
  pageText: string;
  controls: Array<{ role: string; name: string; type?: string; disabled: boolean }>;
  tabs: Array<{ id: string; title: string; url: string; active: boolean }>;
  viewport?: { width: number; height: number } | null;
  screenshot: { mimeType: "image/jpeg"; dataBase64: string; width: number; height: number } | null;
}
export interface BrowserRevision { revision: number; url: string; title: string }
export interface BrowserRecentSite { url: string; visitedAt: string }
export interface BrowserVaultEntry { id: string; kind: "password" | "contact"; title: string; origin?: string; username?: string; email?: string; phone?: string; updatedAt: string }
export interface NativeBrowserTab {
  id: string;
  targetId: string;
  title: string;
  url: string;
  loading: boolean;
  error: string | null;
  canGoBack: boolean;
  canGoForward: boolean;
  zoomFactor: number;
  active: boolean;
}
export interface NativeBrowserState { tabs: NativeBrowserTab[]; activeTabId: string | null; visible: boolean }
export interface NativeBrowserDownload {
  id: string;
  fileName: string;
  source: string;
  startedAt: string;
  status: "in-progress" | "completed" | "cancelled" | "interrupted";
}
export interface NativeBrowserDownloadSettings { directory: string; systemDirectory: string; usingSystemDirectory: boolean }
export interface NativeBrowserExtension {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  loaded: boolean;
  configurable: boolean;
  warning: string | null;
}
export interface NativeBrowserInspection {
  url: string;
  title: string;
  text: string;
  controls: Array<{ role: string; name: string; type: string; disabled: boolean }>;
}

export function loadBrowserProviders(signal?: AbortSignal): Promise<{ providers: BrowserProviderSummary[]; personalBrowsersInspected: false }> {
  return request("/browser/providers", signal ? { signal } : {});
}

export function loadBrowserRecentSites(limit = 12, signal?: AbortSignal): Promise<{ sites: BrowserRecentSite[] }> {
  return request(`/browser/recent-sites?${new URLSearchParams({ limit: String(limit) })}`, signal ? { signal } : {});
}

export function recordBrowserRecentSites(urls: string[], signal?: AbortSignal): Promise<{ recorded: number }> {
  return request("/browser/recent-sites", { method: "POST", body: JSON.stringify({ urls }), ...(signal ? { signal } : {}) });
}

export function clearBrowserRecentSites(): Promise<{ cleared: true }> {
  return request("/browser/recent-sites", { method: "DELETE" });
}

export function clearBrowserData(): Promise<{ cleared: true; sessionsCleared: number }> {
  return request("/browser/data", { method: "DELETE" });
}

export function loadBrowserCredentials(): Promise<{ passwords: BrowserVaultEntry[]; contacts: BrowserVaultEntry[] }> {
  return request("/browser/credentials");
}

export function saveBrowserPassword(input: { title: string; origin: string; username: string; password: string }): Promise<{ entry: BrowserVaultEntry }> {
  return request("/browser/credentials/passwords", { method: "POST", body: JSON.stringify(input) });
}

export function saveBrowserContact(input: { title: string; name: string; address: string; email: string; phone: string }): Promise<{ entry: BrowserVaultEntry }> {
  return request("/browser/credentials/contacts", { method: "POST", body: JSON.stringify(input) });
}

export function deleteBrowserCredential(id: string, kind: "password" | "contact"): Promise<{ deleted: boolean }> {
  return request(`/browser/credentials/${encodeURIComponent(id)}?${new URLSearchParams({ kind })}`, { method: "DELETE" });
}

export function autofillBrowserPassword(id: string, providerId: BrowserProviderId): Promise<{ filled: string[]; origin: string }> {
  return request(`/browser/credentials/passwords/${encodeURIComponent(id)}/autofill`, { method: "POST", body: JSON.stringify({ providerId }) });
}

export function autofillBrowserContact(id: string, providerId: BrowserProviderId): Promise<{ filled: string[]; origin: string }> {
  return request(`/browser/credentials/contacts/${encodeURIComponent(id)}/autofill`, { method: "POST", body: JSON.stringify({ providerId }) });
}

export function deleteBrowserRecentSite(url: string): Promise<{ deleted: boolean }> {
  return request("/browser/recent-sites/item", { method: "DELETE", body: JSON.stringify({ url }) });
}

export function loadBrowserSession(sessionId: string, providerId: BrowserProviderId, signal?: AbortSignal): Promise<{ session: BrowserSessionSnapshot | null }> {
  return request(`/browser/sessions/${encodeURIComponent(sessionId)}?${new URLSearchParams({ providerId })}`, signal ? { signal } : {});
}

/** 浏览器工作区由认证用户直接操控；不因 Agent Provider 未启用而要求额外接入。 */
export function loadBrowserDockSession(sessionId: string, providerId: BrowserProviderId, signal?: AbortSignal): Promise<{ session: BrowserSessionSnapshot | null }> {
  return request(`/browser/dock/sessions/${encodeURIComponent(sessionId)}?${new URLSearchParams({ providerId })}`, signal ? { signal } : {});
}

export type BrowserDockFrame = { dataBase64: string; width: number; height: number };

export async function streamBrowserDockFrames(
  sessionId: string,
  providerId: BrowserProviderId,
  signal: AbortSignal,
  onFrame: (frame: BrowserDockFrame) => void
): Promise<void> {
  const path = `/browser/dock/sessions/${encodeURIComponent(sessionId)}/stream?${new URLSearchParams({ providerId })}`;
  const requestGeneration = authenticationGeneration;
  const response = await fetch(`/api${path}`, { credentials: "include", headers: { Accept: "text/event-stream" }, signal });
  if (!response.ok) {
    const rawBody = await response.text();
    let responseBody: unknown;
    try { responseBody = rawBody ? JSON.parse(rawBody) as unknown : undefined; } catch { responseBody = undefined; }
    const message = typeof responseBody === "object" && responseBody !== null && "message" in responseBody && typeof responseBody.message === "string"
      ? responseBody.message : "浏览器实时画面连接失败。";
    const code = typeof responseBody === "object" && responseBody !== null && "error" in responseBody && typeof responseBody.error === "string"
      ? responseBody.error : undefined;
    if (isSessionAuthenticationError(response.status, code)) handleSessionAuthenticationFailure(path, requestGeneration);
    throw new ApiError(response.status, message, code);
  }
  if (!response.headers.get("content-type")?.includes("text/event-stream") || !response.body) throw new ApiError(response.status, "浏览器实时画面服务没有返回有效数据流。" );

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (!signal.aborted) {
      const result = await reader.read();
      if (result.done) break;
      buffer += decoder.decode(result.value, { stream: true });
      if (buffer.length > 5_500_000) throw new ApiError(502, "浏览器实时画面数据超过允许大小。" );
      let delimiter = buffer.indexOf("\n\n");
      while (delimiter >= 0) {
        const event = buffer.slice(0, delimiter);
        buffer = buffer.slice(delimiter + 2);
        const eventName = /^event:\s*(\S+)/mu.exec(event)?.[1];
        const data = event.split(/\r?\n/u).filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
        if (eventName === "frame" && data.length <= 4_000_000) {
          const value: unknown = JSON.parse(data);
          if (typeof value === "object" && value !== null && "dataBase64" in value && typeof value.dataBase64 === "string" && value.dataBase64.length > 0
            && "width" in value && typeof value.width === "number" && Number.isInteger(value.width) && value.width > 0
            && "height" in value && typeof value.height === "number" && Number.isInteger(value.height) && value.height > 0) {
            onFrame(value as BrowserDockFrame);
          }
        } else if (eventName === "error") {
          let message = "浏览器实时画面连接失败，请重试。";
          try {
            const value = JSON.parse(data) as { message?: unknown };
            if (typeof value.message === "string") message = value.message;
          } catch { /* 忽略无效服务错误载荷。 */ }
          throw new ApiError(502, message);
        }
        delimiter = buffer.indexOf("\n\n");
      }
    }
  } catch (error) {
    if (!signal.aborted) throw error;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export function loadBrowserDockRevision(sessionId: string, providerId: BrowserProviderId, signal?: AbortSignal): Promise<{ session: BrowserRevision | null }> {
  return request(`/browser/dock/sessions/${encodeURIComponent(sessionId)}/revision?${new URLSearchParams({ providerId })}`, signal ? { signal } : {});
}

export function waitForBrowserDockRevision(sessionId: string, providerId: BrowserProviderId, revision: number, signal?: AbortSignal): Promise<{ session: BrowserRevision | null }> {
  const query = new URLSearchParams({ providerId, revision: String(revision) });
  return request(`/browser/dock/sessions/${encodeURIComponent(sessionId)}/wait?${query}`, signal ? { signal } : {});
}

export function navigateBrowserDock(sessionId: string, providerId: BrowserProviderId, url: string, signal?: AbortSignal): Promise<{ session: BrowserSessionSnapshot }> {
  return request(`/browser/dock/sessions/${encodeURIComponent(sessionId)}/navigate`, { method: "POST", body: JSON.stringify({ providerId, url }), ...(signal ? { signal } : {}) });
}

export function resizeBrowserDockViewport(sessionId: string, providerId: BrowserProviderId, width: number, height: number, signal?: AbortSignal): Promise<{ session: BrowserSessionSnapshot | null }> {
  return request(`/browser/dock/sessions/${encodeURIComponent(sessionId)}/viewport`, { method: "POST", body: JSON.stringify({ providerId, width, height }), ...(signal ? { signal } : {}) });
}

export function actOnBrowserDock(sessionId: string, providerId: BrowserProviderId, action: BrowserActionRequest, signal?: AbortSignal): Promise<{ session: BrowserSessionSnapshot }> {
  return request(`/browser/dock/sessions/${encodeURIComponent(sessionId)}/action`, { method: "POST", body: JSON.stringify({ providerId, ...action }), ...(signal ? { signal } : {}) });
}

export function closeBrowserDockSession(sessionId: string, providerId: BrowserProviderId): Promise<{ closed: boolean }> {
  return request(`/browser/dock/sessions/${encodeURIComponent(sessionId)}?${new URLSearchParams({ providerId })}`, { method: "DELETE" });
}

export function loadBrowserTabs(sessionId: string, providerId: BrowserProviderId, signal?: AbortSignal): Promise<{ tabs: BrowserTabSummary[] }> {
  return request(`/browser/tabs/${encodeURIComponent(sessionId)}?${new URLSearchParams({ providerId })}`, signal ? { signal } : {});
}

export function connectTabbitBrowser(sessionId: string): Promise<{ tabs: BrowserTabSummary[]; settings: UserSettings }> {
  return request("/browser/providers/tabbit-personal/connect", { method: "POST", body: JSON.stringify({ sourceSessionId: sessionId }) });
}

export function closeBrowserProviderSessions(providerId: BrowserProviderId): Promise<{ closed: boolean }> {
  return request(`/browser/providers/${encodeURIComponent(providerId)}/sessions`, { method: "DELETE" });
}

export function claimBrowserTab(sessionId: string, providerId: BrowserProviderId, tabId: number, signal?: AbortSignal): Promise<{ session: BrowserSessionSnapshot }> {
  return request(`/browser/sessions/${encodeURIComponent(sessionId)}/claim`, { method: "POST", body: JSON.stringify({ providerId, tabId }), ...(signal ? { signal } : {}) });
}

export function loadBrowserRevision(sessionId: string, providerId: BrowserProviderId, signal?: AbortSignal): Promise<{ session: BrowserRevision | null }> {
  return request(`/browser/sessions/${encodeURIComponent(sessionId)}/revision?${new URLSearchParams({ providerId })}`, signal ? { signal } : {});
}

export function setNativeBrowserActiveTarget(sessionId: string, targetId: string, signal?: AbortSignal): Promise<{ active: true }> {
  return request(`/browser/sessions/${encodeURIComponent(sessionId)}/native-active`, { method: "POST", body: JSON.stringify({ providerId: "lfaa-native-browser", targetId }), ...(signal ? { signal } : {}) });
}

export function navigateBrowser(sessionId: string, providerId: BrowserProviderId, url: string, signal?: AbortSignal): Promise<{ session: BrowserSessionSnapshot }> {
  return request(`/browser/sessions/${encodeURIComponent(sessionId)}/navigate`, { method: "POST", body: JSON.stringify({ providerId, url }), ...(signal ? { signal } : {}) });
}

export function resizeBrowserViewport(sessionId: string, providerId: BrowserProviderId, width: number, height: number, signal?: AbortSignal): Promise<{ session: BrowserSessionSnapshot | null }> {
  return request(`/browser/sessions/${encodeURIComponent(sessionId)}/viewport`, { method: "POST", body: JSON.stringify({ providerId, width, height }), ...(signal ? { signal } : {}) });
}

export type BrowserActionRequest =
  | { action: "back" | "forward" | "reload" }
  | { action: "clickAt"; x: number; y: number; includeScreenshot?: boolean }
  | { action: "dragAt"; x: number; y: number; points: Array<{ x: number; y: number; delayMs: number }>; includeScreenshot?: boolean }
  | { action: "typeText"; text: string; includeScreenshot?: boolean }
  | { action: "pressKey"; key: string; includeScreenshot?: boolean }
  | { action: "scroll"; direction: "up" | "down"; amount: number; includeScreenshot?: boolean };

export function actOnBrowser(sessionId: string, providerId: BrowserProviderId, action: BrowserActionRequest, signal?: AbortSignal): Promise<{ session: BrowserSessionSnapshot }> {
  return request(`/browser/sessions/${encodeURIComponent(sessionId)}/action`, { method: "POST", body: JSON.stringify({ providerId, ...action }), ...(signal ? { signal } : {}) });
}

export function closeBrowserSession(sessionId: string, providerId: BrowserProviderId): Promise<{ closed: boolean }> {
  return request(`/browser/sessions/${encodeURIComponent(sessionId)}?${new URLSearchParams({ providerId })}`, { method: "DELETE" });
}

