// 定义 Agent 运行循环的依赖与输入契约，供循环主体与工具执行器共用，避免循环文件继续膨胀。
import type { RunLlm } from "@lfaa/agent-profile";
import type { LlmMessage, LlmUsage } from "@lfaa/llm";
import type { AgentRunCost, AgentRunMetrics, AgentStepTrace, MemoryService, SessionWorktree, UserClarification } from "@lfaa/memory";
import type { RulesService } from "@lfaa/rules";
import type { ToolsService } from "@lfaa/tools";
import type { SmartTrustStore } from "../tools/permission-policy";
import type { AgentPermissionMode, AgentRunEvent, ApprovalAnswer, ProjectScope, ResolvedSkillContext } from "../types";

/** Agent 单次运行的最终结果：正文、轨迹、用量与成本；澄清时附带待回答的问题。 */
export interface AgentRunResult {
  content: string;
  progressText: string;
  reasoning: string;
  steps: AgentStepTrace[];
  model?: string;
  usage?: LlmUsage;
  metrics: AgentRunMetrics;
  cost?: AgentRunCost;
  clarification?: UserClarification;
}

/** 压缩实现的结构化契约：可由 @lfaa/compaction-basic 服务提供，缺省回落到内置函数。 */
export interface CompactionHook {
  compact(
    messages: ReadonlyArray<LlmMessage>,
    options: { budgetChars: number; toolCapChars?: number; keepRecentRounds?: number },
  ): { messages: LlmMessage[]; compacted: boolean; truncatedResults: number; droppedMessages: number };
}

/** 集中提供模型调用、工具执行、事件与持久化依赖，使循环可在测试中独立验证。 */
export interface RunLoopDeps {
  /** 模型调用入口：可能是按绑定派发的包装器，也可能是原始 LlmService。 */
  llm: RunLlm;
  tools: ToolsService;
  memory: MemoryService;
  rules: RulesService;
  trustStore: SmartTrustStore;
  /** 可选压缩服务；未挂载 @lfaa/compaction-basic 时使用内置实现。 */
  compaction?: CompactionHook;
  /** 可选：由 @lfaa/system-prompt 合成的追加段落，每轮运行取一次。 */
  extraSystemPrompt?: () => Promise<string>;
  /** 可选：取出运行期间追加的用户消息（插话），在下一轮模型调用前并入对话。 */
  drainSteering?: () => string[];
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
  /** 会话绑定项目的名称与简介，用于系统提示的范围锚定。 */
  projectScope?: ProjectScope;
  /** 会话绑定的工作树快照；缺省表示使用项目主目录。 */
  worktree?: SessionWorktree;
  workspaceRoots: string[];
  referenceImages?: string[];
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
