/**
 * 功能：向 LFAA 桌面前端开放受限的原生目录选择能力。
 * 作用：只把选择数据目录的 IPC 封装暴露给 React，不向页面提供 Node.js 或任意 IPC 访问。
 * 关联文件：apps/desktop-electron/src/main.mjs、packages/client/connection/src/api.ts、packages/client/ui-settings/src/SettingsPage.tsx。
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("lfaaDesktop", {
  selectDataDirectory: () => ipcRenderer.invoke("lfaa:select-data-directory")
});
