// LFAA 桌面端原生内置浏览器管理器：在主窗口右侧挂载 Electron 原生 WebContentsView（GPU 硬件合成、零截图压缩延迟）。
import { ipcMain, shell, WebContentsView, type BrowserWindow } from "electron";
import type { DesktopBrowserNavState, DesktopBrowserSyncPayload } from "./preload";

function isAllowedHttpUrl(rawUrl: string | undefined): rawUrl is string {
  if (!rawUrl) return false;
  try {
    const parsed = new URL(rawUrl.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** 为主窗口注册原生 WebContentsView 内置浏览器 IPC，并在窗口关闭时自动释放视图与监听器。 */
export function attachEmbeddedBrowser(mainWindow: BrowserWindow): () => void {
  let view: WebContentsView | null = null;
  let lastRequestedUrl = "";

  const readState = (): DesktopBrowserNavState | null => {
    if (!view || view.webContents.isDestroyed()) return null;
    const wc = view.webContents;
    return {
      url: wc.getURL(),
      title: wc.getTitle(),
      canGoBack: wc.navigationHistory.canGoBack(),
      canGoForward: wc.navigationHistory.canGoForward(),
    };
  };

  const emitState = () => {
    if (mainWindow.isDestroyed()) return;
    const state = readState();
    if (state) mainWindow.webContents.send("lfaa:browser:state", state);
  };

  const ensureView = (): WebContentsView => {
    if (view && !view.webContents.isDestroyed()) return view;
    view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        spellcheck: false,
      },
    });
    mainWindow.contentView.addChildView(view);
    view.setVisible(false);
    view.setBounds({ x: 0, y: 0, width: 0, height: 0 });

    const wc = view.webContents;
    wc.on("did-navigate", emitState);
    wc.on("did-navigate-in-page", emitState);
    wc.on("page-title-updated", emitState);
    wc.setWindowOpenHandler(({ url }) => {
      if (isAllowedHttpUrl(url)) void shell.openExternal(url);
      return { action: "deny" };
    });
    return view;
  };

  const hideView = () => {
    if (!view || view.webContents.isDestroyed()) return;
    view.setVisible(false);
    view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
  };

  ipcMain.handle("lfaa:browser:sync", (_event, payload: DesktopBrowserSyncPayload) => {
    if (mainWindow.isDestroyed()) return null;
    if (!payload?.visible || payload.width < 40 || payload.height < 40) {
      hideView();
      return readState();
    }
    const targetView = ensureView();
    const bounds = {
      x: Math.max(0, Math.round(payload.x)),
      y: Math.max(0, Math.round(payload.y)),
      width: Math.max(40, Math.round(payload.width)),
      height: Math.max(40, Math.round(payload.height)),
    };
    targetView.setBounds(bounds);
    targetView.setVisible(true);
    if (typeof payload.zoomFactor === "number" && Number.isFinite(payload.zoomFactor)) {
      const clampedZoom = Math.max(0.25, Math.min(2, payload.zoomFactor));
      if (Math.abs(targetView.webContents.getZoomFactor() - clampedZoom) > 0.01) {
        targetView.webContents.setZoomFactor(clampedZoom);
      }
    }
    if (isAllowedHttpUrl(payload.url) && payload.url !== lastRequestedUrl) {
      lastRequestedUrl = payload.url;
      if (targetView.webContents.getURL() !== payload.url) {
        void targetView.webContents.loadURL(payload.url).catch(() => {});
      }
    }
    return readState();
  });

  ipcMain.handle("lfaa:browser:navigate", (_event, rawUrl: string) => {
    if (mainWindow.isDestroyed() || !isAllowedHttpUrl(rawUrl)) return readState();
    const targetView = ensureView();
    lastRequestedUrl = rawUrl;
    void targetView.webContents.loadURL(rawUrl).catch(() => {});
    return readState();
  });

  ipcMain.handle("lfaa:browser:nav", (_event, action: "back" | "forward" | "reload") => {
    if (!view || view.webContents.isDestroyed()) return null;
    const wc = view.webContents;
    if (action === "back" && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
    else if (action === "forward" && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward();
    else if (action === "reload") wc.reload();
    return readState();
  });

  const dispose = () => {
    ipcMain.removeHandler("lfaa:browser:sync");
    ipcMain.removeHandler("lfaa:browser:navigate");
    ipcMain.removeHandler("lfaa:browser:nav");
    if (view && !view.webContents.isDestroyed()) {
      try {
        if (!mainWindow.isDestroyed()) mainWindow.contentView.removeChildView(view);
      } catch {
        // 窗口已销毁时忽略卸载错误
      }
      view.webContents.close();
    }
    view = null;
  };

  mainWindow.once("closed", dispose);
  return dispose;
}
