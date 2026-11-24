// 定义 @lfaa/agent 的运行契约：权限模式、运行输入、Think/Act/Check 流式事件与人工审批句柄。
import type { AgentRunCost, AgentRunMetrics, AgentStepTrace, ChatMessageAttachment, ChatMessageRecord, ChatMessageReference, ChatTokenUsage, TodoItem } from "@lfaa/memory";

/** 定义输入栏与 Host 审批策略共用的三种权限模式。 */
export type AgentPermissionMode = "ask" | "smart" | "full";
export type ApprovalAnswer = boolean | "mode_changed";
/** 指定智能审批放行普通操作前必须累计的人工批准次数。 */
export const SMART_APPROVAL_THRESHOLD = 3;

/** 会话需要用户处理的状态：等待工具审批，或等待回答澄清问题。 */
export type AgentAttentionKind = "approval" | "question";

export interface AgentAttentionItem {
  sessionId: string;
  kind: AgentAttentionKind;
  /** 等待审批的工具名，供会话列表与通知文案使用。 */
  toolName?: string;
  /** 等待回答的澄清问题。 */
  question?: string;
  options?: string[];
  /** 产生问题的助手消息 id。 */
  messageId?: string;
}

/** 本轮运行解析到的技能正文摘要，仅注入当轮模型上下文。 */
export interface ResolvedSkillContext {
  id: string;
  name: string;
  revision: number;
  content: string;
}

/** 会话绑定的项目范围：名称与简介，用于把项目内会话约束在本项目内。 */
export interface ProjectScope {
  projectId: string;
  name: string;
  /** 项目目标与交付范围；缺省表示项目尚未填写简介。 */
  description?: string;
}

/** 描述创建运行接收的用户消息、会话上下文与配置。 */
export interface StartAgentRunInput {
  sessionId: string;
  /** 普通新消息；续写运行时由 continuation 替代。 */
  userMessage?: string;
  /** 从指定助手消息继续：不写用户消息，指令只进入模型上下文。 */
  continuation?: { assistantMessageId: string };
  /** 目标自动续跑：不写用户消息，把目标指令放进模型上下文（仅由 Host 内部发起）。 */
  goalContinuation?: { goalId: string; title: string; objective: string };
  profileId?: string;
  /** 本次运行使用的 agent 定义 id；缺省取会话绑定的 agent 或内置小鱼。 */
  agentId?: string;
  /** 会话级临时模型绑定覆盖，优先于 agent 自身绑定。 */
  bindingId?: string;
  /** 群聊发言者：写入助手消息的 authorAgentId，界面据此显示说话人。 */
  authorAgentId?: string;
  /** 群聊回合 id：同轮多条发言共享。 */
  turnId?: string;
  /** 本轮分给该成员的任务说明。 */
  speakerTask?: string;
  /** 群聊第 2..N 位发言者：用户消息已由本轮第一位写入，不再重复落盘。 */
  skipUserMessage?: boolean;
  reasoningEffort?: "minimal" | "low" | "medium" | "high" | "max";
  projectId?: string | null;
  workspaceRoots?: string[];
  /** 已经宿主校验的图片路径，供本轮生图使用。 */
  referenceImages?: string[];
  /** 宿主已校验的会话图片附件引用，写入本轮用户消息，供气泡显示缩略图。 */
  attachments?: ChatMessageAttachment[];
  /** 宿主已校验的引用图（会话内生成图片），写入本轮用户消息。 */
  references?: ChatMessageReference[];
  skillIds?: string[];
  maxSteps?: number;
  /** 与显式 maxSteps 搭配：软预算用尽后按该步数自动延长，0 表示硬上限。 */
  autoExtendSteps?: number;
  /** 连续相同工具调用的提醒阈值；空数组表示关闭提醒。 */
  repeatToolThresholds?: number[];
  permissionMode?: AgentPermissionMode;
  autoApproveTools?: boolean;
}

/** 定义流式运行可发给浏览器的事件变体。 */
export type AgentRunEvent =
  | { type: "run_started"; runId: string; sessionId: string; assistantMessageId: string }
  | { type: "delta"; runId: string; seq: number; kind: "reasoning" | "text"; text: string; iteration?: number }
  | { type: "step_update"; runId: string; step: AgentStepTrace }
  | { type: "todos"; runId: string; todos: TodoItem[] }
  | {
      type: "run_usage";
      runId: string;
      tokenUsage: ChatTokenUsage;
      metrics: AgentRunMetrics;
      cost?: AgentRunCost;
    }
  | { type: "approval_resolved"; runId: string; approvalId: string }
  | {
      type: "approval_required";
      runId: string;
      approvalId: string;
      toolName: string;
      permissionLevel: "write" | "exec";
      argsPreview: string;
      permissionMode?: AgentPermissionMode;
      approvalPattern?: string;
      approvalCount?: number;
      approvalThreshold?: number;
      highRisk?: boolean;
      riskReason?: string;
    }
  | { type: "run_finished"; runId: string; sessionId: string; assistantMessageId: string; status: "done" | "error" | "aborted"; message?: ChatMessageRecord; error?: string };

/** 收集暂停执行时向用户展示和恢复所需的工具请求信息。 */
export interface PendingToolApproval {
  approvalId: string;
  toolName: string;
  permissionLevel: "write" | "exec";
  argsPreview: string;
  permissionMode?: AgentPermissionMode;
  approvalPattern?: string;
  approvalCount?: number;
  approvalThreshold?: number;
  highRisk?: boolean;
  riskReason?: string;
}

/** 描述浏览器查询时可恢复的运行阶段、会话标识和待审批信息。 */
export interface AgentRunStatus {
  runId: string;
  sessionId: string;
  assistantMessageId: string;
  status: "running" | "done" | "error" | "aborted";
  steps: AgentStepTrace[];
  content: string;
  reasoning: string;
  lastSeq: number;
  /** 本轮运行累计的模型用量，供应商未返回时为 undefined。 */
  tokenUsage?: ChatTokenUsage;
  /** 本轮运行的耗时与上下文构成，供实时统计与断线恢复。 */
  metrics?: AgentRunMetrics;
  /** 本轮按模型单价换算的人民币成本。 */
  cost?: AgentRunCost;
  /** 当前会话的任务清单；运行中由 todo_write 更新，供断线重连恢复。 */
  todos?: TodoItem[];
  pendingApprovals?: PendingToolApproval[];
  message?: ChatMessageRecord;
  error?: string;
}
