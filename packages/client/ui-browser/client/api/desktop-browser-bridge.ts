// 桌面端原生内置浏览器（Electron WebContentsView）渲染进程桥接探测与类型声明；普通浏览器环境返回 null。
export interface DesktopBrowserSyncPayload {
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  url?: string;
  sessionId?: string;
  zoomFactor?: number;
}

export interface DesktopBrowserNavState {
  url: string;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
}

export interface DesktopBrowserBridge {
  supportsManagedDownloads?: () => Promise<boolean>;
  syncBounds: (payload: DesktopBrowserSyncPayload) => Promise<DesktopBrowserNavState | null>;
  navigate: (url: string) => Promise<DesktopBrowserNavState | null>;
  nav: (action: "back" | "forward" | "reload") => Promise<DesktopBrowserNavState | null>;
  onStateChange: (listener: (state: DesktopBrowserNavState) => void) => () => void;
}

/** 仅在 LFAA Electron 桌面端窗口内返回原生 WebContentsView 桥接对象；Web 端返回 null。 */
export function getDesktopBrowserBridge(): DesktopBrowserBridge | null {
  if (typeof window === "undefined") return null;
  const candidate = (window as unknown as { __LFAA_DESKTOP_BROWSER__?: DesktopBrowserBridge }).__LFAA_DESKTOP_BROWSER__;
  return candidate && typeof candidate.syncBounds === "function" ? candidate : null;
}
