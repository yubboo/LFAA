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
  /** 本次导航触发了附件下载，文件保存由下载任务状态单独反映。 */
  downloadStarted?: boolean;
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

export type BrowserPolicyDecision = "ask" | "allow" | "block";
export type BrowserPermissionSetting = "ask" | "allow" | "block";

export interface BrowserSiteRule {
  id: string;
  pattern: string;
  browse: BrowserPolicyDecision;
  download: BrowserPolicyDecision;
}

export interface BrowserSitePermissions {
  location: BrowserPermissionSetting;
  camera: BrowserPermissionSetting;
  microphone: BrowserPermissionSetting;
  notifications: BrowserPermissionSetting;
  embeddedContent: BrowserPermissionSetting;
  thirdPartyCookies: "allow" | "block_incognito" | "block";
  javascript: "allow" | "block";
  images: "allow" | "block";
  popups: "allow" | "block";
  autoRevokeUnused: boolean;
}

export interface BrowserPasswordSettings {
  offerToSave: boolean;
  autoCreatePasskey: boolean;
  autoSignIn: boolean;
}

export interface BrowserExtensionItem {
  id: string;
  name: string;
  path: string;
  enabled: boolean;
}

export interface BrowserHistoryItem {
  id: string;
  url: string;
  title: string;
  visitedAt: number;
  byAgent: boolean;
}

export interface BrowserDownloadItem {
  id: string;
  filename: string;
  url: string;
  savePath: string;
  sizeBytes?: number;
  downloadedAt: number;
  deleted?: boolean;
}

/** 下载任务的临时状态；成功文件仍由下载历史接口持久化读取。 */
export interface BrowserDownloadStatus {
  id: string;
  sessionId: string;
  filename: string;
  url: string;
  directory: string;
  chooseLocation: boolean;
  state: "checking" | "awaiting" | "transferring" | "saved" | "blocked" | "cancelled" | "failed";
  startedAt: number;
  reason?: "busy" | "closed" | "policy" | "timeout" | "settings" | "transfer" | "destination" | "history";
  savePath?: string;
}

export interface BrowserPasswordItem {
  id: string;
  origin: string;
  username: string;
  password: string;
  updatedAt: number;
}

export interface BrowserContactItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
}

export interface BrowserSettingsConfig {
  enabled?: boolean;
  preferredChannel: "auto" | "msedge" | "chrome";
  customExecutablePath: string;
  headless: boolean;
  autoApproveLocalhost: boolean;
  webLinkOpenMode?: "external" | "builtin";
  localUrlOpenMode?: "builtin" | "external";
  showFullUrl?: boolean;
  annotationScreenshotMode?: "always" | "selection_only";
  /** 下载目录：空串表示跟随系统「下载」目录，服务端读取时解析为本机真实路径。 */
  downloadDir?: string;
  askBeforeDownload?: boolean;
  historyAccessPolicy?: "ask" | "allow" | "deny";
  enableWebsiteTools?: boolean;
  defaultBrowsePolicy?: BrowserPolicyDecision;
  defaultDownloadPolicy?: BrowserPolicyDecision;
  siteRules?: BrowserSiteRule[];
  enableFullCdp?: boolean;
  sitePermissions?: BrowserSitePermissions;
  passwordSettings?: BrowserPasswordSettings;
  extensions?: BrowserExtensionItem[];
}

export interface BrowserPluginConfig {
  storeFilePath?: string;
}
