/**
 * 功能：按 Browser Owner Session 代际与页面修订号接纳 Dock 快照。
 * 作用：同一 Session 丢弃迟到的旧响应；Session 重建后允许新快照从低 revision 开始。
 * 关联文件：BrowserPanel.tsx、packages/client/connection/src/api.ts。
 */
import type { BrowserSessionSnapshot } from "lfaa-client-connection/src/api.js";

export function preferCurrentBrowserSnapshot(current: BrowserSessionSnapshot | null, next: BrowserSessionSnapshot): BrowserSessionSnapshot {
  return current?.sessionId === next.sessionId && current.revision > next.revision ? current : next;
}

export function shouldRestoreBrowserDockPage(browserUrl: string | undefined, snapshotReady: boolean, snapshotUrl: string | undefined, hasNavigationRequest: boolean): boolean {
  return snapshotReady && /^https?:\/\//iu.test(browserUrl?.trim() ?? "")
    && (!snapshotUrl || snapshotUrl === "about:blank") && !hasNavigationRequest;
}
