/** Web 开发期资源快照。正式资源状态未来由 Resource Registry 持有。 */
export type ResourceKind = "skills" | "experts" | "plugins" | "extensions" | "mcp";

export interface DevResourceItem {
  kind: ResourceKind;
  name: string;
  relativePath: string;
  entryType: "file" | "directory";
  updatedAt: number;
}

export interface AgentWorkbenchProps {
  resources?: readonly DevResourceItem[];
  resourceBridgeStatus?: "connected" | "refreshing" | "offline";
}
