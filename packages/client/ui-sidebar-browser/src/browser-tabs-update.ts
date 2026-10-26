/**
 * 功能：定义 Browser Owner 页面快照传给工作区 Dock 的结构化消息。
 * 作用：把标签、Provider、快照就绪状态及单次 Agent 联动标记放在同一个对象中传递。
 * 关联文件：BrowserPanel.tsx、NativeBrowserPanel.tsx、packages/client/ui-workspace/src/ApplicationWorkspace.tsx。
 */
import type { BrowserProviderId } from "lfaa-client-connection/src/api.js";

export type BrowserDockAgentSyncRequest = {
  providerId: BrowserProviderId;
  requestId: number;
};

export type BrowserDockOpenTab = {
  id: string;
  title: string;
  url: string;
  active: boolean;
};

export type BrowserDockTabsUpdate = {
  tabs: BrowserDockOpenTab[];
  providerId?: BrowserProviderId;
  snapshotReady: boolean;
  agentSyncRequest?: BrowserDockAgentSyncRequest;
};
