// 定义 Agent 运行循环的依赖与输入契约，供循环主体与工具执行器共用，避免循环文件继续膨胀。
import type { LlmService } from "@lfaa/llm";
import type { MemoryService } from "@lfaa/memory";
import type { RulesService } from "@lfaa/rules";
import type { ToolsService } from "@lfaa/tools";
import type { SmartTrustStore } from "./permission-policy";
import type { AgentPermissionMode, AgentRunEvent, ApprovalAnswer, ResolvedSkillContext } from "./types";

/** 集中提供模型调用、工具执行、事件与持久化依赖，使循环可在测试中独立验证。 */
export interface RunLoopDeps {
  llm: LlmService;
  tools: ToolsService;
  memory: MemoryService;
  rules: RulesService;
  trustStore: SmartTrustStore;
}

/** 描述启动一次运行所需的会话信息与工具权限上下文。 */
export interface RunExecutionParams {
  enableClarification?: boolean;
  beforeWorkspaceMutation?: () => Promise<void>;
  runId: string;
  sessionId: string;
  assistantMessageId: string;
  userMessage: string;
  profileId?: string;
  reasoningEffort?: "minimal" | "low" | "medium" | "high" | "max";
  projectId?: string | null;
  workspaceRoots: string[];
  enableMemoryContext?: boolean;
  resolvedSkills?: ResolvedSkillContext[];
  availableSkillCatalog?: Array<{ id: string; name: string; source: string; description: string }>;
  maxSteps: number;
  /** 软预算用尽仍有进展时自动追加的步数；0 表示把 maxSteps 当作硬上限。 */
  autoExtendSteps?: number;
  /** 单次运行发送给模型的上下文字符预算；缺省 160,000。 */
  contextBudgetChars?: number;
  /** 连续相同工具调用的提醒阈值；空数组表示关闭。 */
  repeatToolThresholds?: number[];
  getPermissionMode: () => AgentPermissionMode;
  signal: AbortSignal;
  emit: (event: AgentRunEvent) => void;
  requestApproval: (params: {
    approvalId: string;
    toolName: string;
    permissionLevel: "write" | "exec";
    argsPreview: string;
    permissionMode: AgentPermissionMode;
    approvalPattern?: string;
    approvalCount?: number;
    approvalThreshold?: number;
    highRisk?: boolean;
    riskReason?: string;
  }, signal?: AbortSignal) => Promise<ApprovalAnswer>;
}
