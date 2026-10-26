/**
 * 功能：判断成功的 Agent 浏览器活动是否需要把 Browser Owner 当前页同步到工作区标签。
 * 作用：即使 Owner 标签列表未发生变化，也能将同一 Provider 的已存在页面显示到 Dock。
 * 关联文件：ApplicationWorkspace.tsx、apps/cli/tests/client-workspace-app-tabs.test.mjs。
 */
import type { BrowserDockAgentSyncRequest, BrowserDockTabsUpdate } from "lfaa-client-ui-sidebar-browser/src/browser-tabs-update.js";

export type { BrowserDockAgentSyncRequest } from "lfaa-client-ui-sidebar-browser/src/browser-tabs-update.js";

export function matchesAgentBrowserDockSyncRequest(
  pendingRequest: BrowserDockAgentSyncRequest | null,
  update: BrowserDockTabsUpdate,
): boolean {
  return Boolean(pendingRequest
    && update.providerId === pendingRequest.providerId
    && update.agentSyncRequest?.providerId === pendingRequest.providerId
    && update.agentSyncRequest.requestId === pendingRequest.requestId);
}

export function shouldSyncAgentBrowserDockPage(
  pendingRequest: BrowserDockAgentSyncRequest | null,
  update: BrowserDockTabsUpdate,
  hasActiveWorkspaceBrowserTab: boolean,
  hasActiveHttpPage: boolean,
  hasPendingBrowserOperation: boolean,
): boolean {
  return Boolean(matchesAgentBrowserDockSyncRequest(pendingRequest, update)
    && update.snapshotReady
    && hasActiveWorkspaceBrowserTab
    && hasActiveHttpPage
    && !hasPendingBrowserOperation);
}
