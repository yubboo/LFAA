/**
 * 功能：管理独立于网页连接的 Agent 任务。
 * 作用：提供提交、账户隔离查询、事件跟随及显式取消；任务证据由 JSONL 会话服务保存。
 * 关联文件：execute-turn.ts、core/session/sessions.ts、api/session-controller；卸载由本包 index.ts 处理。
 */
import type { AiPluginHost } from "lfaa-app-boot/src/ai-host.js";
import type { UserRole } from "lfaa-identity-auth/src/service.js";
import type { ApplicationId } from "lfaa-settings/src/preferences/service.js";
import type { AgentDefaultModelResolver } from "lfaa-agent-default-model/src/index.js";
import type { UserApprovalNotifications } from "lfaa-user-approval/src/index.js";
import type { UserQuestionService } from "lfaa-user-questions/src/index.js";
import { getUserSettings } from "lfaa-settings/src/service.js";
import { appendAiSteeringInput, createAiTurn, getAiSessionPlanMode, getAiSideChatParentSessionId, getAiSessionWorkspaceContext, refreshAiTurnHistory, setAiSessionPlanMode, startQueuedAiTurn, finishAiAssistantMessage, getAiRun as readRun, interruptOrphanedAiRuns, listAiSessions, type AiModelMessage, type AiRunView } from "lfaa-session/src/sessions.js";
import { executeAiTurn } from "./execute-turn.js";
import { claimWorkspaceProjectApplication, getWorkspaceProject, type WorkspaceProjectApplicationId } from "lfaa-workspace-workspace/src/index.js";
import type { AiSessionProjectContext } from "lfaa-session/src/sessions.js";

export interface AiRunInput { appId: ApplicationId; sessionId: string | null; content: string; projectId?: string | null; planMode?: boolean }
interface AiUserQuestion { questionId: string; question: string; options: string[]; resolve: (value: { answer: string; skipped: boolean }) => void; signal: AbortSignal; abort: () => void }
type Listener = (event: string, data: Record<string, unknown>) => void;
interface LiveRun { userId: string; applicationId: ApplicationId; sessionId: string; canAskUser: boolean; controller: AbortController; listeners: Set<Listener>; completion: Promise<void>; content: string; inbox: AiModelMessage[]; pendingQuestion?: AiUserQuestion }
const liveRuns = new Map<string, LiveRun>();
let modelResolver: AgentDefaultModelResolver | undefined;
let approvalNotifications: UserApprovalNotifications | undefined;
let userQuestions: UserQuestionService | undefined;
let unregisterAgentRunQuestionAnswerer: (() => void) | undefined;

export function initializeAiRuns(resolver: AgentDefaultModelResolver, approvals: UserApprovalNotifications, questions: UserQuestionService): void {
  modelResolver = resolver;
  approvalNotifications = approvals;
  userQuestions = questions;
  unregisterAgentRunQuestionAnswerer?.();
  unregisterAgentRunQuestionAnswerer = questions.registerAnswerer({
    id: "agent-run",
    priority: 0,
    accepts: (input) => {
      const run = liveRuns.get(input.runId);
      return run?.canAskUser === true && run.userId === input.userId && run.applicationId === input.applicationId;
    },
    answer: (input) => {
      const run = liveRuns.get(input.runId);
      if (!run || !run.canAskUser || run.userId !== input.userId || run.applicationId !== input.applicationId) return Promise.resolve(undefined);
      return waitForUserInput(run, input, input.signal);
    }
  });
  interruptOrphanedAiRuns();
}
export function getAiRun(userId: string, runId: string): AiRunView | null { const run = readRun(userId, runId); const live = liveRuns.get(runId); return run && live?.userId === userId ? { ...run, message: { ...run.message, content: live.content } } : run; }

interface RunOptions { depth?: number; modelAccountId?: string; allowedToolNames?: string[]; systemPrompt?: string; delegationBudget?: { used: number; maximum: number }; writeGate?: { denied: boolean }; canAskUser?: boolean; memoryEligible?: boolean; workspaceProject?: AiSessionProjectContext | null }

const sideChatSystemPrompt = "你是当前 AI Work 会话的侧边解释助手。用户会在主任务仍可能执行时向你提问。你只解释侧边聊天创建时已记录的会话上下文和一般知识；不要执行或声称执行文件、命令、项目、Daemon、审批或工具操作，也不要改变主聊天任务。上下文快照不含主聊天未完成的流式输出和实时进度；遇到相关问题时请明确说明你看不到未记录的部分。";

export function startAiRun(userId: string, userRole: UserRole, body: AiRunInput, aiPluginHost: AiPluginHost, options: RunOptions = {}): AiRunView {
  // 会话侧聊限制在唯一 Run Owner 执行，覆盖普通提交与 appendAiRunInput 的排队续问。
  const sideChat = Boolean(body.sessionId && getAiSideChatParentSessionId(userId, body.sessionId));
  const runOptions: RunOptions = sideChat ? {
    ...options,
    allowedToolNames: [],
    canAskUser: false,
    memoryEligible: false,
    systemPrompt: sideChatSystemPrompt
  } : options;
  const resolver = modelResolver;
  const approvals = approvalNotifications;
  const questions = userQuestions;
  if (!resolver || !approvals || !questions) throw new Error("Agent 模型账户、审批或用户问题插件尚未装载。");
  const account = resolver.resolve(userId, runOptions.modelAccountId);
  if (!account) throw new Error("请先在设置中心的“AI 与模型”启用一个 Provider 账户。");
  const settings = getUserSettings(userId);
  const depth = runOptions.depth ?? 0;
  const canAskUser = runOptions.canAskUser ?? depth === 0;
  const budget = runOptions.delegationBudget ?? { used: 0, maximum: settings.aiRuntime.maxSubagents };
  const writeGate = runOptions.writeGate ?? { denied: false };
  const previous = body.sessionId ? [...liveRuns.values()].filter(run => run.userId === userId && run.sessionId === body.sessionId).at(-1) : undefined;
  if (body.planMode !== undefined && sideChat) throw new Error("侧边聊天不能切换计划模式。");
  if (body.planMode !== undefined && previous) throw new Error("当前会话仍有活动任务，不能在排队消息中切换计划模式。");
  if (body.projectId && body.sessionId) throw new Error("只能为新会话选择项目；已有会话请从项目菜单切换。 ");
  if (body.projectId && body.appId !== "workspace" && body.appId !== "minecraft") throw new Error("当前应用不支持通用项目目录。 ");
  const projectAppId = body.appId === "workspace" || body.appId === "minecraft" ? body.appId as WorkspaceProjectApplicationId : undefined;
  let registeredProject = body.projectId && projectAppId ? getWorkspaceProject(userId, body.projectId, projectAppId) : null;
  if (body.projectId && !registeredProject) throw new Error("找不到此账户的项目目录。 ");
  if (registeredProject?.appId === null && projectAppId) {
    const usedByOtherApp = [...listAiSessions(userId, false), ...listAiSessions(userId, true)]
      .some(session => session.projectId === registeredProject!.id && session.appId !== projectAppId);
    if (usedByOtherApp) throw new Error("此旧项目已关联其他应用的会话。请在当前应用重新登记该文件夹，避免跨 App 共享项目。 ");
    registeredProject = claimWorkspaceProjectApplication(userId, registeredProject.id, projectAppId);
    if (!registeredProject) throw new Error("此项目已归属其他应用，不能在当前应用使用。 ");
  }
  if (runOptions.workspaceProject && runOptions.workspaceProject.appId !== body.appId) throw new Error("子 Agent 项目归属与当前应用不一致，已拒绝执行。 ");
  const workspaceProject = runOptions.workspaceProject ?? (registeredProject && projectAppId ? { id: registeredProject.id, appId: projectAppId, nodeId: registeredProject.nodeId, path: registeredProject.path, title: registeredProject.title } : null);
  const turn = createAiTurn(userId, body.appId, body.sessionId, body.content, Boolean(previous), workspaceProject);
  if (body.planMode !== undefined) setAiSessionPlanMode(userId, turn.session.id, body.planMode, { allowActiveRun: true });
  const id = turn.assistantMessage.id;
  const run: LiveRun = { userId, applicationId: body.appId, sessionId: turn.session.id, canAskUser, controller: new AbortController(), listeners: new Set(), completion: Promise.resolve(), content: "", inbox: [] };
  liveRuns.set(id, run);
  const emit: Listener = (event, data) => {
    if (event === "delta" && typeof data.delta === "string") run.content += data.delta;
    // 某个订阅者失败不能取消执行或阻断其他订阅者。
    for (const listener of run.listeners) { try { listener(event, data); } catch { run.listeners.delete(listener); } }
  };
  run.completion = (previous?.completion ?? Promise.resolve()).then(() => {
    if (run.controller.signal.aborted) { finishAiAssistantMessage(userId, turn.session.id, id, run.content, "interrupted"); emit("done", { status: "interrupted" }); return; }
    if (previous) startQueuedAiTurn(userId, turn.session.id, turn.userMessage.id, id);
    refreshAiTurnHistory(userId, turn);
    finishAiAssistantMessage(userId, turn.session.id, id, "", "streaming");
    return executeAiTurn({ userId, userRole, body, turn, aiPluginHost, abortController: run.controller, emit, takeInputs: () => run.inbox.splice(0), modelAccountId: account.accountId, modelResolver: resolver, approvalNotifications: approvals, writeGate, memoryEligible: runOptions.memoryEligible ?? (depth === 0 && !getAiSessionPlanMode(userId, turn.session.id)), planModeEnabled: depth === 0 && !sideChat,
      ...(canAskUser ? { requestUserInput: (input: { questionId: string; question: string; options: string[] }) => questions.ask({ userId, applicationId: body.appId, runId: id, ...input, signal: run.controller.signal }) } : {}),
      ...(runOptions.systemPrompt ? { systemPrompt: runOptions.systemPrompt } : {}),
      ...(runOptions.allowedToolNames ? { allowedToolNames: runOptions.allowedToolNames } : {}),
      delegate: async (parameters, available, onActivity) => {
        run.controller.signal.throwIfAborted();
        if (sideChat) throw new Error("侧边聊天不会创建子 Agent。");
        if (depth >= settings.aiRuntime.maxDelegationDepth || budget.used >= budget.maximum) throw new Error("已达到设置中心的子 Agent 数量或委派深度限制。");
        const requested = Array.isArray(parameters.toolNames) ? parameters.toolNames.map(String) : available;
        if (requested.some(name => !available.includes(name))) throw new Error("子 Agent 请求了父任务范围外的工具。");
        budget.used += 1;
        const child = startAiRun(userId, userRole, { appId: body.appId, sessionId: null, content: String(parameters.task) }, aiPluginHost, { depth: depth + 1, modelAccountId: settings.aiRuntime.subagentAccountId || account.accountId, allowedToolNames: requested, systemPrompt: "你是主 Agent 委派的子 Agent。围绕本次子任务自主选择工具、检查结果和完成验证；返回产物、执行证据和未解决事项。", delegationBudget: budget, writeGate, canAskUser: false, workspaceProject: getAiSessionWorkspaceContext(userId, turn.session.id) });
        const childLive = liveRuns.get(child.id)!;
        const abortChild = () => childLive.controller.abort();
        run.controller.signal.addEventListener("abort", abortChild, { once: true });
        const unsubscribe = subscribeAiRun(userId, child.id, (event, data) => {
          if (event === "activity") { const activity = data.activity as import("lfaa-session/src/sessions.js").AiActivityItem; onActivity({ ...activity, title: "子 Agent · " + activity.title }); }
        });
        try { await childLive.completion; }
        finally { unsubscribe(); run.controller.signal.removeEventListener("abort", abortChild); }
        const result = getAiRun(userId, child.id)!;
        return { childRunId: child.id, sessionId: child.sessionId, status: result.status, answer: result.message.content, evidence: result.message.activity };
      }
    });
  }).catch(error => {
    finishAiAssistantMessage(userId, turn.session.id, id, run.content, "error");
    emit("error", { message: error instanceof Error ? error.message : "任务运行失败。" });
    emit("done", { status: "error" });
  }).finally(() => { liveRuns.delete(id); run.listeners.clear(); });
  return readRun(userId, id)!;
}

export function subscribeAiRun(userId: string, runId: string, listener: Listener): () => void {
  const snapshot = getAiRun(userId, runId);
  if (!snapshot) throw new Error("找不到当前账户的任务。");
  const live = liveRuns.get(runId);
  if (live?.userId === userId) live.listeners.add(listener);
  // 先发送原子快照，后续 delta 只包含快照之后的内容；持久化检查点来自模型请求与工具结果。
  listener("session", { runId, session: snapshot.session, userMessage: snapshot.userMessage, assistantMessage: snapshot.message });
  if (snapshot.status !== "streaming" && snapshot.status !== "queued") listener("done", { status: snapshot.status });
  return () => { live?.listeners.delete(listener); };
}

export function cancelAiRun(userId: string, runId: string): boolean {
  const run = liveRuns.get(runId);
  if (!run || run.userId !== userId || !readRun(userId, runId)) return false;
  run.controller.abort();
  if (readRun(userId, runId)?.status === "queued") {
    run.content = "此排队任务已由用户取消，尚未开始执行。不得继续该目标。";
    finishAiAssistantMessage(userId, run.sessionId, runId, run.content, "interrupted");
    for (const listener of run.listeners) { try { listener("done", { status: "interrupted" }); } catch { run.listeners.delete(listener); } }
  }
  return true;
}

/** 跟进方式由账户设置决定；引导输入持久化后只在下次模型请求消费。 */
export function appendAiRunInput(userId: string, userRole: UserRole, runId: string, content: string, aiHost: AiPluginHost) {
  const snapshot = getAiRun(userId, runId);
  const live = liveRuns.get(runId);
  if (!snapshot || !live || live.userId !== userId) throw new Error("找不到当前账户的活动任务。");
  const mode = getUserSettings(userId).general.followupBehavior;
  if (mode === "queue" || snapshot.status === "queued") {
    const run = startAiRun(userId, userRole, { appId: snapshot.appId, sessionId: snapshot.sessionId, content }, aiHost);
    return { mode: "queue" as const, run, userMessage: run.userMessage };
  }
  const userMessage = appendAiSteeringInput(userId, runId, content);
  live.inbox.push({ role: "user", content });
  for (const listener of live.listeners) { try { listener("input", { userMessage }); } catch { live.listeners.delete(listener); } }
  return { mode: "steer" as const, run: snapshot, userMessage };
}

/** 将澄清答案一次性绑定到当前活动 run，并以会话用户消息形式留下记录。 */
export function answerAiRunQuestion(userId: string, runId: string, questionId: string, answer: string, skipped: boolean) {
  const snapshot = getAiRun(userId, runId);
  const live = liveRuns.get(runId);
  const pending = live?.pendingQuestion;
  if (!snapshot || snapshot.status !== "streaming" || !live || live.userId !== userId || !pending || pending.questionId !== questionId) {
    throw new Error("澄清问题已处理、过期或不属于当前账户的活动任务。");
  }
  const visibleAnswer = skipped ? "跳过了这条澄清问题。" : answer.trim();
  if (!visibleAnswer) throw new Error("请先选择选项、填写回答或选择跳过。");
  const userMessage = appendAiSteeringInput(userId, runId, visibleAnswer);
  delete live.pendingQuestion;
  pending.signal.removeEventListener("abort", pending.abort);
  pending.resolve({
    answer: skipped ? "用户选择跳过这条澄清问题；请依据已有信息继续，并明确说明仍未确定的假设。" : answer.trim(),
    skipped
  });
  for (const listener of live.listeners) { try { listener("input", { userMessage }); } catch { live.listeners.delete(listener); } }
  return { mode: "answered" as const, userMessage };
}

function waitForUserInput(live: LiveRun, input: { questionId: string; question: string; options: readonly string[] }, signal: AbortSignal): Promise<{ answer: string; skipped: boolean }> {
  if (signal.aborted) return Promise.reject(new DOMException("用户已停止 Agent 运行。", "AbortError"));
  if (live.pendingQuestion) return Promise.reject(new Error("当前 Agent Run 已有一条待回答问题。"));
  return new Promise((resolve, reject) => {
    const abort = () => {
      if (live.pendingQuestion?.questionId === input.questionId) delete live.pendingQuestion;
      reject(new DOMException("用户已停止 Agent 运行。", "AbortError"));
    };
    live.pendingQuestion = { ...input, options: [...input.options], resolve, signal, abort };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}

/** 卸载取消 Agent 等待；已派发的节点任务仍按其真实执行状态回报。 */
export async function closeAiRuns(): Promise<void> {
  const runs = [...liveRuns.values()];
  for (const run of runs) run.controller.abort();
  await Promise.allSettled(runs.map(run => run.completion));
  unregisterAgentRunQuestionAnswerer?.();
  unregisterAgentRunQuestionAnswerer = undefined;
  modelResolver = undefined;
  approvalNotifications = undefined;
  userQuestions = undefined;
}
