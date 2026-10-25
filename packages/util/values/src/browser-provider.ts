/**
 * 功能：定义 LFAA Browser Provider 的稳定 ID。
 * 作用：让设置、Agent Tool、API 与 Client 使用同一份浏览器接入目录。
 * 关联文件：settings-contract.ts、browser-use/browser-use、client/connection。
 */
export const BROWSER_PROVIDER_IDS = ["lfaa-native-browser", "lfaa-managed-edge", "lfaa-managed-chrome", "tabbit-personal"] as const;
export type BrowserProviderId = typeof BROWSER_PROVIDER_IDS[number];

/** LFAA Dock 可打开并复用的内置 Provider；个人 Tabbit 页面不会镜像到 Dock。 */
export function isBuiltinBrowserProvider(providerId: BrowserProviderId | undefined): providerId is Exclude<BrowserProviderId, "tabbit-personal"> {
  return providerId === "lfaa-native-browser" || providerId === "lfaa-managed-edge" || providerId === "lfaa-managed-chrome";
}

// 登录账户内的内置浏览器工作区标识；聊天会话切换时页面和标签仍属于同一个浏览器。
export const BUILTIN_BROWSER_WORKSPACE_ID = "builtin-browser-workspace";
