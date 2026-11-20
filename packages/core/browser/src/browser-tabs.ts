// 浏览器标签监听：为新建 Page 挂 Console/网络/导航/关闭事件并维护会话状态里的标签表。
import { randomUUID } from "node:crypto";
import type { Page } from "playwright-core";
import { MAX_LOG_ITEMS, type BrowserTabEntry, type SessionBrowserState } from "./browser-session-types";
import type { BrowserConsoleItem, BrowserNetworkItem } from "./types";

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
      if (landed && landed !== "about:blank" && entry.history[entry.historyIndex] !== landed) {
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