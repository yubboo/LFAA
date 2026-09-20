/**
 * 文件：work-canvas.model.ts
 * 作用：定义 Work Canvas 的初始视图模型模板。
 * 负责：节点/连线默认定义；这些定义包含默认坐标，但不拥有持久化状态。
 * 不负责：Run/Session 真值、localStorage、Pointer 交互。
 */
import type { InfiniteCanvasEdge, InfiniteCanvasNode } from "@lfaa/ui";

export const INITIAL_WORK_NODES: readonly InfiniteCanvasNode[] = [
  { id: "goal", kind: "goal", title: "一句话目标", description: "用户目标进入同一个 Agent Runtime。", status: "idle", x: 40, y: 70 },
  { id: "agent", kind: "agent", title: "主智能体", description: "使用当前配置模型推理、规划并调度能力。", status: "idle", x: 370, y: 70 },
  { id: "tools", kind: "tool", title: "Tools / Skills", description: "工具、技能、专家、命令与 MCP 按需装配。", status: "idle", x: 700, y: -20 },
  { id: "subagent", kind: "agent", title: "子智能体", description: "按 Harness Provider 委派并行任务。", status: "idle", x: 700, y: 150 },
  { id: "result", kind: "artifact", title: "最终产物", description: "文件、代码、报告与可验证结果回到同一 Run。", status: "idle", x: 1030, y: 70 },
];

export const INITIAL_WORK_EDGES: readonly InfiniteCanvasEdge[] = [
  { id: "goal-agent", from: "goal", to: "agent" },
  { id: "agent-tools", from: "agent", to: "tools" },
  { id: "agent-subagent", from: "agent", to: "subagent" },
  { id: "tools-result", from: "tools", to: "result" },
  { id: "subagent-result", from: "subagent", to: "result" },
];
