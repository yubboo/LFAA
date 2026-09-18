/**
 * 文件：workbench.types.ts
 * 作用：定义共享工作台壳对宿主暴露的最小数据契约。
 * 负责：开发资源条目类型、资源桥接状态、终端 ReactNode 插槽。
 * 不负责：UI 布局、业务状态持久化、终端实现。
 * 状态归属：类型契约，无运行时状态。
 * 对外接口：AgentWorkbenchProps、DevResourceItem、ResourceKind。
 * 关联文件：AgentWorkbench.tsx、apps/web/src/App.tsx。
 * 修改注意事项：新增字段时必须同步宿主 App 和工作台组件，避免把 Vite 专有实现泄漏到共享壳。
 */
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
