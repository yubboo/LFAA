/**
 * 功能：工具公共合同、参数校验和任务观察。
 * 作用：按职责登记能力，业务与权限继续归原 Owner，正文由模型按需加载。
 * 关联文件：registry.ts、领域工具、Agent Loop。
 */
import Joi from "joi";
import type { ApplicationId } from "lfaa-util-values/src/application-id.js";
import type { UserRole } from "lfaa-identity-auth/src/service.js";
export type AiBusinessToolRisk = "read" | "write" | "dangerous";

export interface AiBusinessToolContext {
  /** 由父 Run 提供：统一委派预算、项目、工具范围及取消；插件不能自行重建根 Run。 */
  delegateSubagent?: (parameters: Record<string, unknown>, execute?: (startChild: (signal?: AbortSignal) => Promise<{ status: string; [key: string]: unknown }>) => Promise<{ status: string; [key: string]: unknown }>) => Promise<{ status: string; [key: string]: unknown }>;
  userId: string;
  userRole: UserRole;
  applicationId: ApplicationId;
  /** 由 Agent Loop 为一次助手运行生成；需要隔离临时资源的工具可据此绑定运行状态。 */
  agentRunId: string;
  /** 执行器绑定的真实来源，不允许从模型参数伪造。 */
  sessionId?: string;
  /** 当前模型实际可见的工具名，用于后续任务继承而非扩大范围。 */
  allowedToolNames?: readonly string[];
  externalDelegationAllowed?: boolean;
  /** 工具可登记一次性运行状态清理；Agent Loop 在该运行的 finally 中调用。 */
  onRunDispose?: (cleanup: () => void) => void;
  signal: AbortSignal;
  onProgress: (detail: string) => void;
  workspaceProject?: { nodeId: string; path: string; title: string } | null;
  /** Agent Git Workspace Owner 解析出的可信本机仓库上下文，与 workspaceProject/Daemon 节点无关。 */
  agentGitRepository?: { id: string; path: string; title: string } | null;
  /** 由 LFAA 本机 Host 注入的共享受限文件执行器；Daemon 模式下不提供。 */
  executeLocalProjectFile?: (input: Record<string, unknown>) => Promise<unknown>;
  /** Run 从 Writing Owner 重读当前账户上下文；参数由 Owner 决定，不接受模型注入 ID。 */
  refreshWritingContext?: () => void;
  /** 仅提供给明确声明问题通道的插件工具，回答仍由当前 Agent Run 管理。 */
  askUser?: (question: string, options: string[]) => Promise<{ answer: string; skipped: boolean }>;
}

export interface AiWritingToolTarget {
  bookId: string;
  chapterId: string | null;
}

export interface AiBusinessTool {
  id: string;
  name: string;
  /** LFAA 必需 Core 管理能力，不随账户的可选 AI 扩展开关关闭。 */
  coreManaged?: boolean;
  /** 仅模型在本次 Run 显式选择后向 Provider 暴露完整合同，不以 App 自动开启。 */
  onDemand?: boolean;
  /** 领域执行器重验互斥及状态的操作，可在不同写工具成功修复后重试已确认失败；未知结果始终禁止重放。 */
  retryAfterRecovery?: boolean;
  /** 本机桌面工具只进入显式启用电脑操控设置的 Agent Run。 */
  requiresComputerControl?: boolean;
  /** 浏览器工具只进入显式启用 Browser Use 设置的 Agent Run。 */
  requiresBrowserUse?: boolean;
  /** 可选角色闸门；默认 false，具体 Owner 仍须在执行时做业务授权。 */
  adminOnly?: boolean;
  description: string;
  applicationIds: ApplicationId[];
  schema: Record<string, unknown>;
  risk: (parameters: Record<string, unknown>) => AiBusinessToolRisk;
  approval: (parameters: Record<string, unknown>, context: Pick<AiBusinessToolContext, "userId" | "applicationId">) => { scopeKey: string; scopeSummary: string; summary: string };
  prepare?: (parameters: Record<string, unknown>, context: Pick<AiBusinessToolContext, "userId" | "workspaceProject" | "agentGitRepository">) => Record<string, unknown>;
  parse: (value: unknown) => Record<string, unknown>;
  execute: (parameters: Record<string, unknown>, context: AiBusinessToolContext) => Promise<unknown>;
  delegation?: "domain-expert";
  createsSubagent?: boolean;
  /** 该插件工具需要当前运行已绑定的交互问题通道。 */
  requiresQuestionChannel?: boolean;
  /** 可选的运行轨迹类型；当前仅允许问题工具使用 question。 */
  activityKind?: "question";
  /** 可选的运行轨迹中文标题。 */
  activityTitle?: string;
}

const noRisk: (parameters: Record<string, unknown>) => AiBusinessToolRisk = () => "read";
export const noApproval: AiBusinessTool["approval"] = () => ({ scopeKey: "read-only", scopeSummary: "只读查询", summary: "读取工作区信息" });

export function strictObject(properties: Record<string, unknown>, required: string[] = []): Record<string, unknown> {
  return { type: "object", properties, required, additionalProperties: false };
}

export function parseWithSchema(schema: Joi.ObjectSchema, value: unknown): Record<string, unknown> {
  const result = schema.validate(value, { abortEarly: false, convert: false, stripUnknown: false });
  if (result.error || typeof result.value !== "object" || result.value === null || Array.isArray(result.value)) {
    throw new Error(result.error?.details.map((detail) => detail.message).join("；") ?? "工具参数必须是 JSON 对象。");
  }
  return result.value as Record<string, unknown>;
}

export function objectValue(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("工具参数必须是 JSON 对象。");
  return value as Record<string, unknown>;
}

export function oneString(key: string, maxLength = 100): Joi.StringSchema {
  return Joi.string().trim().min(1).max(maxLength).required().messages({ "any.required": `${key} 为必填项。` });
}

export function idSchema(key: string): Joi.StringSchema {
  return Joi.string().guid({ version: ["uuidv4", "uuidv5"] }).required().messages({ "string.guid": `${key} 必须是系统返回的有效 ID。` });
}

export function makeTool(input: Omit<AiBusinessTool, "risk" | "approval"> & Partial<Pick<AiBusinessTool, "risk" | "approval">>): AiBusinessTool {
  return { ...input, risk: input.risk ?? noRisk, approval: input.approval ?? noApproval };
}

export function safeTaskView(task: Record<string, unknown>): Record<string, unknown> {
  const { payload: _payload, ...view } = task;
  return view;
}

export async function waitForTask<T extends { status: string; progress?: number; message: string }>(input: {
  read: () => T | null;
  signal: AbortSignal;
  onProgress: (detail: string) => void;
  missingMessage: string;
  timeoutMilliseconds?: number;
}): Promise<T> {
  // 轮询仅观察现有任务队列；取消聊天不会取消或重放已入队的 Daemon 操作。
  const startedAt = Date.now();
  let lastState = "";
  while (true) {
    if (input.signal.aborted) throw new DOMException("用户已停止 Agent 运行。", "AbortError");
    const task = input.read();
    if (!task) throw new Error(input.missingMessage);
    const state = `${task.status}:${task.progress ?? ""}:${task.message}`;
    if (state !== lastState) {
      lastState = state;
      input.onProgress(task.progress === undefined ? task.message : `${task.message}（${task.progress}%）`);
    }
    if (["succeeded", "failed", "cancelled"].includes(task.status)) return task;
    if (Date.now() - startedAt >= (input.timeoutMilliseconds ?? 10 * 60 * 1000)) return task;
    await new Promise<void>((resolve, reject) => {
      const finish = () => {
        input.signal.removeEventListener("abort", abort);
        resolve();
      };
      const abort = () => {
        clearTimeout(timer);
        input.signal.removeEventListener("abort", abort);
        reject(new DOMException("用户已停止 Agent 运行。", "AbortError"));
      };
      const timer = setTimeout(finish, 1000);
      input.signal.addEventListener("abort", abort, { once: true });
      if (input.signal.aborted) abort();
    });
  }
}

