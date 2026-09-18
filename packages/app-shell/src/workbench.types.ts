import type { ReactNode } from "react";

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
  terminal?: ReactNode;
}
