// 浏览器运行时内部类型：单标签条目、会话状态与日志条数上限，供运行时、标签监听与快照组装共享。
import type { BrowserContext, Page } from "playwright-core";
import type { BrowserConsoleItem, BrowserNetworkItem } from "../types";

export const MAX_LOG_ITEMS = 120;

export interface BrowserTabEntry {
  tabId: string;
  page: Page;
  title: string;
  history: string[];
  historyIndex: number;
  /** 最近一次主文档导航是否允许 iframe 嵌入（解析 X-Frame-Options 与 CSP frame-ancestors）。 */
  embeddable?: boolean | undefined;
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
  /** 最近一次主动驱动该浏览器会话的角色，前端据此在 Agent 实操时切回协同画面。 */
  lastActor?: "user" | "agent" | undefined;
  consoleItems: BrowserConsoleItem[];
  networkItems: BrowserNetworkItem[];
  lastError?: string;
  updatedAt: number;
}