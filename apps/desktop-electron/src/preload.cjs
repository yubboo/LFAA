/**
 * 功能：向 LFAA 桌面前端开放受限的原生目录选择能力。
 * 作用：只把选择数据目录的 IPC 封装暴露给 React，不向页面提供 Node.js 或任意 IPC 访问。
 * 关联文件：apps/desktop-electron/src/main.mjs、packages/client/connection/src/api.ts、packages/client/ui-settings/src/SettingsPage.tsx。
 */
const { contextBridge, ipcRenderer } = require("electron");

const updatePromptListeners = new Set();
let queuedUpdatePrompt = null;
const updateAvailabilityListeners = new Set();
let queuedUpdateAvailability = null;
let hasQueuedUpdateAvailability = false;
const updateDownloadProgressListeners = new Set();
let queuedUpdateDownloadProgress = null;
let hasQueuedUpdateDownloadProgress = false;
const nativeBrowserStateListeners = new Set();
const nativeBrowserShortcutListeners = new Set();

ipcRenderer.on("lfaa:native-browser:state", (_event, state) => {
  for (const listener of nativeBrowserStateListeners) listener(state);
});

ipcRenderer.on("lfaa:native-browser:shortcut", (_event, shortcut) => {
  for (const listener of nativeBrowserShortcutListeners) listener(shortcut);
});

ipcRenderer.on("lfaa:desktop:update-prompt", (_event, prompt) => {
  if (updatePromptListeners.size === 0) {
    queuedUpdatePrompt = prompt;
    return;
  }
  for (const listener of updatePromptListeners) listener(prompt);
});

ipcRenderer.on("lfaa:desktop:update-availability", (_event, update) => {
  if (updateAvailabilityListeners.size === 0) {
    queuedUpdateAvailability = update;
    hasQueuedUpdateAvailability = true;
    return;
  }
  for (const listener of updateAvailabilityListeners) listener(update);
});

ipcRenderer.on("lfaa:desktop:update-download-progress", (_event, progress) => {
  if (updateDownloadProgressListeners.size === 0) {
    queuedUpdateDownloadProgress = progress;
    hasQueuedUpdateDownloadProgress = true;
    return;
  }
  for (const listener of updateDownloadProgressListeners) listener(progress);
});

contextBridge.exposeInMainWorld("lfaaDesktop", {
  nativeBrowser: {
    getState: () => ipcRenderer.invoke("lfaa:native-browser:state"),
    ensureTab: () => ipcRenderer.invoke("lfaa:native-browser:ensure"),
    createTab: (url) => ipcRenderer.invoke("lfaa:native-browser:create-tab", url),
    selectTab: (id) => ipcRenderer.invoke("lfaa:native-browser:select-tab", id),
    closeTab: (id) => ipcRenderer.invoke("lfaa:native-browser:close-tab", id),
    navigate: (id, url) => ipcRenderer.invoke("lfaa:native-browser:navigate", { id, url }),
    back: (id) => ipcRenderer.invoke("lfaa:native-browser:back", id),
    forward: (id) => ipcRenderer.invoke("lfaa:native-browser:forward", id),
    reload: (id) => ipcRenderer.invoke("lfaa:native-browser:reload", id),
    stop: (id) => ipcRenderer.invoke("lfaa:native-browser:stop", id),
    copyAddress: (id) => ipcRenderer.invoke("lfaa:native-browser:copy-address", id),
    find: (id, text, forward) => ipcRenderer.invoke("lfaa:native-browser:find", { id, text, forward }),
    inspect: (id) => ipcRenderer.invoke("lfaa:native-browser:inspect", id),
    clearData: () => ipcRenderer.invoke("lfaa:native-browser:clear-data"),
    setPreferences: (preferences) => ipcRenderer.invoke("lfaa:native-browser:preferences", preferences),
    getDownloadSettings: () => ipcRenderer.invoke("lfaa:native-browser:download-settings"),
    chooseDownloadDirectory: () => ipcRenderer.invoke("lfaa:native-browser:choose-download-directory"),
    useSystemDownloadDirectory: () => ipcRenderer.invoke("lfaa:native-browser:use-system-download-directory"),
    getDownloadHistory: () => ipcRenderer.invoke("lfaa:native-browser:download-history"),
    removeDownloadHistory: (id) => ipcRenderer.invoke("lfaa:native-browser:download-history:remove", id),
    clearDownloadHistory: () => ipcRenderer.invoke("lfaa:native-browser:download-history:clear"),
    getBrowserExtensions: () => ipcRenderer.invoke("lfaa:native-browser:extensions"),
    chooseBrowserExtension: () => ipcRenderer.invoke("lfaa:native-browser:extensions:add"),
    setBrowserExtensionEnabled: (id, enabled) => ipcRenderer.invoke("lfaa:native-browser:extensions:enabled", { id, enabled }),
    removeBrowserExtension: (id) => ipcRenderer.invoke("lfaa:native-browser:extensions:remove", id),
    configureBrowserExtension: (id) => ipcRenderer.invoke("lfaa:native-browser:extensions:configure", id),
    setZoom: (id, zoom) => ipcRenderer.invoke("lfaa:native-browser:zoom", { id, zoom }),
    print: (id) => ipcRenderer.invoke("lfaa:native-browser:print", id),
    setBounds: (bounds) => ipcRenderer.invoke("lfaa:native-browser:bounds", bounds),
    setVisible: (visible) => ipcRenderer.invoke("lfaa:native-browser:visible", visible),
    onState: (listener) => {
      if (typeof listener !== "function") throw new TypeError("浏览器状态监听器必须是函数。");
      nativeBrowserStateListeners.add(listener);
      return () => nativeBrowserStateListeners.delete(listener);
    },
    onShortcut: (listener) => {
      if (typeof listener !== "function") throw new TypeError("浏览器快捷键监听器必须是函数。");
      nativeBrowserShortcutListeners.add(listener);
      return () => nativeBrowserShortcutListeners.delete(listener);
    }
  },
  selectDataDirectory: () => ipcRenderer.invoke("lfaa:select-data-directory"),
  selectWorkspaceDirectory: () => ipcRenderer.invoke("lfaa:select-workspace-directory"),
  mini: {
    open: (settings) => ipcRenderer.invoke("lfaa:mini:open", settings),
    close: () => ipcRenderer.invoke("lfaa:mini:close")
  },
  getUpdateRuntimeInfo: () => ipcRenderer.invoke("lfaa:desktop:update-runtime"),
  getUpdatePreferences: () => ipcRenderer.invoke("lfaa:desktop:update-preferences"),
  setAutoUpdateAndInstall: (enabled) => ipcRenderer.invoke("lfaa:desktop:update-preferences:set-auto", enabled),
  getUpdateAvailability: () => ipcRenderer.invoke("lfaa:desktop:update-availability"),
  getUpdateDownloadProgress: () => ipcRenderer.invoke("lfaa:desktop:update-download-progress"),
  cancelUpdateDownload: () => ipcRenderer.invoke("lfaa:desktop:update-download-cancel"),
  checkForUpdates: () => ipcRenderer.invoke("lfaa:desktop:check-updates"),
  onUpdatePrompt: (listener) => {
    if (typeof listener !== "function") throw new TypeError("更新提示监听器必须是函数。");
    updatePromptListeners.add(listener);
    if (queuedUpdatePrompt) {
      listener(queuedUpdatePrompt);
      queuedUpdatePrompt = null;
    }
    return () => updatePromptListeners.delete(listener);
  },
  onUpdateAvailable: (listener) => {
    if (typeof listener !== "function") throw new TypeError("更新状态监听器必须是函数。");
    updateAvailabilityListeners.add(listener);
    if (hasQueuedUpdateAvailability) {
      listener(queuedUpdateAvailability);
      queuedUpdateAvailability = null;
      hasQueuedUpdateAvailability = false;
    }
    return () => updateAvailabilityListeners.delete(listener);
  },
  onUpdateDownloadProgress: (listener) => {
    if (typeof listener !== "function") throw new TypeError("更新下载进度监听器必须是函数。");
    updateDownloadProgressListeners.add(listener);
    if (hasQueuedUpdateDownloadProgress) {
      listener(queuedUpdateDownloadProgress);
      queuedUpdateDownloadProgress = null;
      hasQueuedUpdateDownloadProgress = false;
    }
    return () => updateDownloadProgressListeners.delete(listener);
  },
  updatePromptUiReady: () => ipcRenderer.invoke("lfaa:desktop:update-prompt-ui-ready"),
  updatePromptUiNotReady: () => ipcRenderer.invoke("lfaa:desktop:update-prompt-ui-not-ready"),
  respondToUpdatePrompt: (requestId, action) => ipcRenderer.invoke("lfaa:desktop:update-prompt-response", { requestId, action })
});
