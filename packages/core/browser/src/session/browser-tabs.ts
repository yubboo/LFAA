// 浏览器标签监听：为新建 Page 挂 Console/网络/导航/关闭事件并维护会话状态里的标签表。
import { randomUUID } from "node:crypto";
import type { Page } from "playwright-core";
import { MAX_LOG_ITEMS, type BrowserTabEntry, type SessionBrowserState } from "./browser-session-types";
import type { BrowserConsoleItem, BrowserNetworkItem } from "../types";

/** 解析主文档响应头，判断目标网页是否允许被浏览器 iframe 原生嵌入。 */
export function isHeadersEmbeddable(headers: Record<string, string>): boolean {
  const xfo = (headers["x-frame-options"] ?? "").trim().toLowerCase();
  if (xfo === "deny" || xfo === "sameorigin" || xfo.startsWith("allow-from")) {
    return false;
  }
  const csp = headers["content-security-policy"] ?? "";
  if (csp) {
    const directives = csp.split(";").map((part) => part.trim()).filter(Boolean);
    for (const directive of directives) {
      if (!/^frame-ancestors\b/iu.test(directive)) continue;
      const tokens = directive.replace(/^frame-ancestors\b/iu, "").trim().toLowerCase().split(/\s+/u).filter(Boolean);
      // 只有显式放行 * 或 http:/https: 通配才视为允许跨源嵌入，其余（'none'、'self'、白名单域）统一回退 CDP。
      if (!tokens.some((token) => token === "*" || token === "http:" || token === "https:")) {
        return false;
      }
    }
  }
  return true;
}

/** 给新页面注册监听并放入会话标签表，返回可被快照读取的标签条目。 */
export function attachTabListeners(state: SessionBrowserState, page: Page, tabId: string): BrowserTabEntry {
  const entry: BrowserTabEntry = {
    tabId,
    page,
    title: "",
    history: [],
    historyIndex: -1,
  };
  const pushConsole = (item: BrowserConsoleItem) => {
    state.consoleItems.push(item);
    if (state.consoleItems.length > MAX_LOG_ITEMS) {
      state.consoleItems.splice(0, state.consoleItems.length - MAX_LOG_ITEMS);
    }
    state.updatedAt = Date.now();
  };
  const pushNetwork = (item: BrowserNetworkItem) => {
    state.networkItems.push(item);
    if (state.networkItems.length > MAX_LOG_ITEMS) {
      state.networkItems.splice(0, state.networkItems.length - MAX_LOG_ITEMS);
    }
    state.updatedAt = Date.now();
  };

  page.on("console", (msg) => {
    const type = msg.type();
    const level = type === "error" ? "error" : type === "warning" ? "warning" : "log";
    pushConsole({ level, text: msg.text().slice(0, 500), timestamp: Date.now() });
  });
  page.on("pageerror", (err) => {
    pushConsole({ level: "error", text: err.message.slice(0, 500), timestamp: Date.now() });
  });
  page.on("response", (res) => {
    const url = res.url();
    const status = res.status();
    if (res.request().isNavigationRequest() && res.frame() === page.mainFrame()) {
      entry.embeddable = isHeadersEmbeddable(res.headers());
    }
    pushNetwork({
      id: randomUUID(),
      method: res.request().method(),
      status,
      url,
      failed: status >= 400,
      timestamp: Date.now(),
    });
    if (status >= 400) {
      pushConsole({ level: "network", text: `HTTP ${status} ${url}`, url, timestamp: Date.now() });
    }
  });
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) {
      const landed = frame.url();
      if (!landed || landed === "about:blank") {
        entry.embeddable = undefined;
      } else if (entry.history[entry.historyIndex] === landed) {
        // 已对齐当前历史指针，无需修改。
      } else if (entry.historyIndex > 0 && entry.history[entry.historyIndex - 1] === landed) {
        // 后退导航命中前一条历史：回退指针而非截断并重复追加，保证前进/后退栈完整。
        entry.historyIndex -= 1;
      } else if (entry.historyIndex + 1 < entry.history.length && entry.history[entry.historyIndex + 1] === landed) {
        entry.historyIndex += 1;
      } else {
        entry.history = entry.history.slice(0, entry.historyIndex + 1);
        entry.history.push(landed);
        entry.historyIndex = entry.history.length - 1;
      }
    }
  });
  page.on("close", () => {
    state.tabs.delete(tabId);
    if (state.activeTabId === tabId) {
      const next = state.tabs.keys().next().value;
      state.activeTabId = typeof next === "string" ? next : "";
    }
  });
  state.tabs.set(tabId, entry);
  return entry;
}

/** 打开会话内页面，并用计数避免把内部 newPage 误判成网页弹窗。 */
export async function openInternalPage(state: SessionBrowserState): Promise<Page> {
  state.internalPageOpening += 1;
  try {
    return await state.context.newPage();
  } finally {
    state.internalPageOpening -= 1;
  }
}

/** Edge 下载浮层等浏览器内部页面没有可交互的网页内容。 */
export function isBrowserChrome(url: string): boolean {
  return /^(?:edge|chrome|chrome-extension|chrome-untrusted|devtools):/iu.test(url);
}

/** 捕获网页内 window.open 或 target="_blank" 新开窗口。 */
export function attachPopupHandler(state: SessionBrowserState): void {
  state.context.on("page", (popup) => {
    if (state.internalPageOpening > 0) return;
    if (isBrowserChrome(popup.url())) {
      void popup.close().catch(() => {});
      return;
    }
    for (const item of state.tabs.values()) {
      if (item.page === popup) return;
    }
    const previousTab = state.activeTabId;
    const tabId = `tab-${randomUUID().slice(0, 6)}`;
    void popup.setViewportSize(state.viewport).catch(() => {});
    attachTabListeners(state, popup, tabId);
    popup.on("framenavigated", (frame) => {
      if (frame !== popup.mainFrame() || !isBrowserChrome(frame.url())) return;
      if (state.activeTabId === tabId && state.tabs.has(previousTab)) state.activeTabId = previousTab;
      state.tabs.delete(tabId);
      void popup.close().catch(() => {});
    });
    state.activeTabId = tabId;
    state.updatedAt = Date.now();
  });
}