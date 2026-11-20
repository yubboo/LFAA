// 浏览器运行时内部类型：单标签条目、会话状态与日志条数上限，供运行时、标签监听与快照组装共享。
import type { BrowserContext, Page } from "playwright-core";
import type { BrowserConsoleItem, BrowserNetworkItem } from "./types";

export const MAX_LOG_ITEMS = 120;

export interface BrowserTabEntry {
  tabId: string;
  page: Page;
  title: string;
  history: string[];
  historyIndex: number;
  lastScreenshotBase64?: string;
  lastScreenshotMime?: "image/png" | "image/jpeg";
}

export interface SessionBrowserState {
  sessionId: string;
  context: BrowserContext;
  tabs: Map<string, BrowserTabEntry>;
  activeTabId: string;
  viewport: { width: number; height: number };
  deviceScaleFactor: number;
  colorScheme: "dark" | "light";
  internalPageOpening: number;
  takeoverPaused: boolean;
  consoleItems: BrowserConsoleItem[];
  networkItems: BrowserNetworkItem[];
  lastError?: string;
  updatedAt: number;
}