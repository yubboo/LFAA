/**
 * 功能：定义 LFAA Browser Provider 的稳定 ID。
 * 作用：让设置、Agent Tool、API 与 Client 使用同一份浏览器接入目录。
 * 关联文件：settings-contract.ts、browser-use/browser-use、client/connection。
 */
export const BROWSER_PROVIDER_IDS = ["lfaa-managed-edge", "lfaa-managed-chrome", "tabbit-personal"] as const;
export type BrowserProviderId = typeof BROWSER_PROVIDER_IDS[number];
