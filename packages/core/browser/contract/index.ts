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
  updatedAt: number;
}

export interface BrowserSettingsConfig {
  preferredChannel: "auto" | "msedge" | "chrome";
  customExecutablePath: string;
  headless: boolean;
  autoApproveLocalhost: boolean;
}

export interface BrowserPluginConfig {
  storeFilePath?: string;
}
