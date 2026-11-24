// 定义 @lfaa/browser 的多标签快照、控制台与网络请求记录、人工接管状态及配置契约。

export interface BrowserInteractiveElement {
  ref: string;
  tag: string;
  role?: string;
  text: string;
  type?: string;
  placeholder?: string;
  href?: string;
}

export interface BrowserConsoleItem {
  level: "error" | "warning" | "log" | "network";
  text: string;
  url?: string;
  timestamp: number;
}

export interface BrowserNetworkItem {
  id: string;
  method: string;
  status: number;
  url: string;
  failed?: boolean;
  timestamp: number;
}

export interface BrowserTabItem {
  tabId: string;
  title: string;
  url: string;
  active: boolean;
}

export interface BrowserSessionSnapshot {
  sessionId: string;
  active: boolean;
  providerName?: string;
  executablePath?: string;
  activeTabId: string;
  tabs: BrowserTabItem[];
  viewport: { width: number; height: number };
  deviceScaleFactor?: number;
  colorScheme?: "dark" | "light";
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  takeoverPaused: boolean;
  headless: boolean;
  elements: BrowserInteractiveElement[];
  textExcerpt: string;
  consoleCount: number;
  networkCount: number;
  errorCount: number;
  screenshotBase64?: string;
  screenshotMime?: "image/png" | "image/jpeg";
  /** 主文档响应头未拦截 iframe 嵌入时为 true；用于自动决定是否启用原生直连。 */
  embeddable?: boolean;
  /** 最近一次驱动当前会话的操作方：用于 Agent 实操时自动切回协同视图。 */
  lastActor?: "user" | "agent";
  updatedAt: number;
  lastError?: string;
}

export interface BrowserStreamFramePayload {
  sessionId: string;
  tabId: string;
  data: string;
  mime: "image/jpeg" | "image/png";
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  errorCount: number;
  consoleCount: number;
  networkCount: number;
  viewport: { width: number; height: number };
  deviceScaleFactor: number;
  colorScheme: "dark" | "light";
  embeddable?: boolean;
  lastActor?: "user" | "agent";
  updatedAt: number;
}

/** 轻量直通输入事件负载：直接经由常驻 CDP 派发并返回 204，不触发整页截图序列化。 */
export type BrowserInputPayload =
  | { kind: "wheel"; x: number; y: number; deltaX: number; deltaY: number; modifiers?: number }
  | { kind: "mousemove"; x: number; y: number; buttons?: number; modifiers?: number }
  | {
      kind: "mousedown" | "mouseup";
      x: number;
      y: number;
      button?: "left" | "right" | "middle";
      clickCount?: number;
      buttons?: number;
      modifiers?: number;
    }
  | { kind: "keydown" | "keyup"; key: string; code?: string; text?: string; modifiers?: number }
  | { kind: "text"; text: string };

export interface BrowserSettingsConfig {
  preferredChannel: "auto" | "msedge" | "chrome";
  customExecutablePath: string;
  headless: boolean;
  autoApproveLocalhost: boolean;
}

export interface BrowserPluginConfig {
  storeFilePath?: string;
}
