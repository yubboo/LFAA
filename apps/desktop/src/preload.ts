// LFAA 桌面端安全 Preload 桥：仅向渲染进程暴露原生内置浏览器 WebContentsView 的受控 IPC 接口。
import { contextBridge, ipcRenderer } from "electron";

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

contextBridge.exposeInMainWorld("__LFAA_DESKTOP_DIALOG__", {
  pickFolder: (options?: { title?: string; defaultPath?: string }): Promise<{ cancelled: boolean; path?: string; name?: string; error?: string }> =>
    ipcRenderer.invoke("lfaa:dialog:pickFolder", options ?? {}),
});

contextBridge.exposeInMainWorld("__LFAA_DESKTOP_BROWSER__", {
  supportsManagedDownloads: (): Promise<boolean> => ipcRenderer.invoke("lfaa:browser:managed"),
  syncBounds: (payload: DesktopBrowserSyncPayload): Promise<DesktopBrowserNavState | null> =>
    ipcRenderer.invoke("lfaa:browser:sync", payload),
  navigate: (url: string): Promise<DesktopBrowserNavState | null> =>
    ipcRenderer.invoke("lfaa:browser:navigate", url),
  nav: (action: "back" | "forward" | "reload"): Promise<DesktopBrowserNavState | null> =>
    ipcRenderer.invoke("lfaa:browser:nav", action),
  onStateChange: (listener: (state: DesktopBrowserNavState) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: DesktopBrowserNavState) => {
      listener(state);
    };
    ipcRenderer.on("lfaa:browser:state", handler);
    return () => ipcRenderer.removeListener("lfaa:browser:state", handler);
  },
});
