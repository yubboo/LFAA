/**
 * 文件：workspace.types.ts
 * 作用：Chat / Work Workspace 共享的最小 UI ViewModel 契约。
 * 负责：只定义两种 Workspace 模式之间真正共享的 ViewModel。
 * 不负责：Provider 配置、Canvas Pointer 状态、Shell Chrome、宿主 Bridge。
 * 状态归属：无运行时状态；Run 真值由 Agent Runtime，视觉状态由各 Workspace 子模块拥有。
 * 对外接口：ChatMessageViewModel。
 * 关联文件：ChatWorkspace.tsx、useWorkspaceSessionController.ts。
 * 修改注意事项：只提升 Chat/Work 都需要的稳定契约，禁止把子模块私有 State 变成全局类型。
 */
import type { AgentWorkspaceMode } from "@lfaa/agent-runtime";

/**
 * Workbench 的三种用户工作方式。
 * Chat / Work 都是 Agent 自动化，只是交互表现不同；Manual 完全不启动模型。
 */
export type WorkspaceMode = AgentWorkspaceMode | "manual";

export interface ChatMessageViewModel {
  id: string;
  role: "user" | "assistant" | "error";
  text: string;
  runId?: string;
}
