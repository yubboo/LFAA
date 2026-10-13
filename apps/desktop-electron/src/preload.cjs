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
  selectDataDirectory: () => ipcRenderer.invoke("lfaa:select-data-directory"),
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
