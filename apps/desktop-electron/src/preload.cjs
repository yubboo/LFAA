/**
 * 功能：向 LFAA 桌面前端开放受限的原生目录选择能力。
 * 作用：只把选择数据目录的 IPC 封装暴露给 React，不向页面提供 Node.js 或任意 IPC 访问。
 * 关联文件：apps/desktop-electron/src/main.mjs、packages/client/connection/src/api.ts、packages/client/ui-settings/src/SettingsPage.tsx。
 */
const { contextBridge, ipcRenderer } = require("electron");

const updatePromptListeners = new Set();
let queuedUpdatePrompt = null;

ipcRenderer.on("lfaa:desktop:update-prompt", (_event, prompt) => {
  if (updatePromptListeners.size === 0) {
    queuedUpdatePrompt = prompt;
    return;
  }
  for (const listener of updatePromptListeners) listener(prompt);
});

contextBridge.exposeInMainWorld("lfaaDesktop", {
  selectDataDirectory: () => ipcRenderer.invoke("lfaa:select-data-directory"),
  getUpdateRuntimeInfo: () => ipcRenderer.invoke("lfaa:desktop:update-runtime"),
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
  updatePromptUiReady: () => ipcRenderer.invoke("lfaa:desktop:update-prompt-ui-ready"),
  updatePromptUiNotReady: () => ipcRenderer.invoke("lfaa:desktop:update-prompt-ui-not-ready"),
  respondToUpdatePrompt: (requestId, action) => ipcRenderer.invoke("lfaa:desktop:update-prompt-response", { requestId, action })
});
