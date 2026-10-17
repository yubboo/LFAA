import type { AgentAssociations } from "lfaa-util-values/src/agent-associations.js";
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
import { appendAiSteeringInput, createAiSessionBranchWithMemory as persistAiSessionBranchWithMemory, createAiTurn, getAiSessionPlanMode, getAiSideChatParentSessionId, getAiSessionWorkspaceContext, prepareAiSessionBranchSeed, refreshAiTurnHistory, saveAiAssistantActivity, setAiSessionPlanMode, startQueuedAiTurn, finishAiAssistantMessage, getAiRun as readRun, interruptOrphanedAiRuns, listAiSessions, type AiModelMessage, type AiRunView, type AiSessionProjectContext } from "lfaa-session/src/sessions.js";
import { executeAiTurn } from "./execute-turn.js";
import { summarizeBranchMemory } from "./branch-memory.js";
import { AiRunPauseGate, type AiRunPauseState } from "./run-pause.js";
import { claimWorkspaceProjectApplication, getWorkspaceProject, type WorkspaceProjectApplicationId } from "lfaa-workspace-workspace/src/index.js";
import type { SessionReplyPart } from "lfaa-session/src/kernel.js";
import type { AiCompletionService } from "lfaa-llm/src/completion.js";

export interface AiRunInput { appId: ApplicationId; sessionId: string | null; content: string; projectId?: string | null; associations?: AgentAssociations; planMode?: boolean }
interface AiUserQuestion { questionId: string; question: string; options: string[]; resolve: (value: { answer: string; skipped: boolean }) => void; signal: AbortSignal; abort: () => void }
type Listener = (event: string, data: Record<string, unknown>) => void;
interface LiveRun { id: string; userId: string; applicationId: ApplicationId; sessionId: string; canAskUser: boolean; controller: AbortController; pauseGate: AiRunPauseGate; children: Set<string>; pendingApprovals: Set<string>; listeners: Set<Listener>; completion: Promise<void>; content: string; parts: SessionReplyPart[]; inbox: AiModelMessage[]; pendingQuestion?: AiUserQuestion }
const liveRuns = new Map<string, LiveRun>();
let modelResolver: AgentDefaultModelResolver | undefined;
let approvalNotifications: UserApprovalNotifications | undefined;
let userQuestions: UserQuestionService | undefined;
let unregisterAgentRunQuestionAnswerer: (() => void) | undefined;
let completionService: AiCompletionService | undefined;

export function initializeAiRuns(resolver: AgentDefaultModelResolver, approvals: UserApprovalNotifications, questions: UserQuestionService, llm: AiCompletionService): void {
  modelResolver = resolver;
  approvalNotifications = approvals;
  userQuestions = questions;
  completionService = llm;
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
export function getAiRun(userId: string, runId: string): AiRunView | null { const run = readRun(userId, runId); const live = liveRuns.get(runId); return run && live?.userId === userId ? { ...run, message: { ...run.message, content: live.content, parts: live.parts.map(part => ({ ...part })) } } : run; }

interface RunOptions { depth?: number; modelAccountId?: string; allowedToolNames?: string[]; systemPrompt?: string; delegationBudget?: { used: number; maximum: number }; writeGate?: { denied: boolean }; canAskUser?: boolean; requestUserInput?: (input: { questionId: string; question: string; options: string[] }) => Promise<{ answer: string; skipped: boolean }>; memoryEligible?: boolean; workspaceProject?: AiSessionProjectContext | null }

const sideChatSystemPrompt = "你是当前 AI Work 会话的侧边解释助手。用户会在主任务仍可能执行时向你提问。你只解释侧边聊天创建时已记录的会话上下文和一般知识；不要执行或声称执行文件、命令、项目、Daemon、审批或工具操作，也不要改变主聊天任务。上下文快照不含主聊天未完成的流式输出和实时进度；遇到相关问题时请明确说明你看不到未记录的部分。";

/** 普通消息分支先由当前 Provider 整理有限记忆，再由 Session Owner 原子写入新会话。 */
export async function createAiSessionBranchWithMemory(
  userId: string,
  sessionId: string,
  assistantMessageId: string,
  options: { projectContext?: AiSessionProjectContext; signal?: AbortSignal } = {}
) {
  const resolver = modelResolver;
  const llm = completionService;
  if (!resolver || !llm) throw new Error("Agent 模型账户或 LLM Provider 尚未装载。");
  const settings = getUserSettings(userId);
  const account = resolver.resolve(userId);
  if (!account) throw new Error("请先在设置中心的“AI 与模型”启用一个 Provider 账户，再创建记忆分支。");
  const contextWindow = account.contextWindow ?? settings.aiRuntime.contextWindowTokens ?? 128_000;
  const seed = prepareAiSessionBranchSeed(userId, sessionId, assistantMessageId, Math.min(1_000_000, Math.max(1, Math.floor(contextWindow * 0.35 * 6))));
  if (!seed) return null;
  const signal = options.signal ?? new AbortController().signal;
  signal.throwIfAborted();
  const result = await summarizeBranchMemory({
    messages: seed.messages,
    account,
    applicationId: seed.appId,
    permissionMode: settings.permissions.mode,
    settings: settings.aiRuntime,
    signal,
    llm
  });
  signal.throwIfAborted();
  return persistAiSessionBranchWithMemory(userId, seed, result.summary, result.usage, options.projectContext);
}

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
  let registeredProject = body.projectId && projectAppId ? getWorkspaceProject(userId, body.projectId, projectAppId === "workspace" ? undefined : projectAppId) : null;
  if (body.projectId && !registeredProject) throw new Error("找不到此账户的项目目录。 ");
  if (registeredProject?.appId === null && projectAppId && projectAppId !== "workspace") {
    const usedByOtherApp = [...listAiSessions(userId, false), ...listAiSessions(userId, true)]
      .some(session => session.projectId === registeredProject!.id && session.appId !== projectAppId);
    if (usedByOtherApp) throw new Error("此旧项目已关联其他应用的会话。请在当前应用重新登记该文件夹，避免跨 App 共享项目。 ");
    registeredProject = claimWorkspaceProjectApplication(userId, registeredProject.id, projectAppId);
    if (!registeredProject) throw new Error("此项目已归属其他应用，不能在当前应用使用。 ");
  }
  if (runOptions.workspaceProject) {
    const owned = getWorkspaceProject(userId, runOptions.workspaceProject.id);
    if (!owned || owned.nodeId !== runOptions.workspaceProject.nodeId || owned.path !== runOptions.workspaceProject.path) throw new Error("子 Agent 项目不属于当前账户或节点目录已变更，已拒绝执行。");
  }
  const workspaceProject = runOptions.workspaceProject ?? (registeredProject && projectAppId ? { id: registeredProject.id, appId: projectAppId, nodeId: registeredProject.nodeId, path: registeredProject.path, title: registeredProject.title } : null);
  const turn = createAiTurn(userId, body.appId, body.sessionId, body.content, Boolean(previous), workspaceProject, body.associations);
  if (body.planMode !== undefined) setAiSessionPlanMode(userId, turn.session.id, body.planMode, { allowActiveRun: true });
  const id = turn.assistantMessage.id;
  let run!: LiveRun;
  const requestUserInput = runOptions.requestUserInput ?? (canAskUser
    ? (input: { questionId: string; question: string; options: string[] }) => questions.ask({ userId, applicationId: body.appId, runId: id, ...input, signal: run.controller.signal })
    : undefined);
  const emit: Listener = (event, data) => {
    if (event === "delta" && typeof data.delta === "string") {
      run.content += data.delta;
      if (typeof data.partId === "string" && typeof data.partStart === "number") {
        let part = run.parts.find(item => item.id === data.partId);
        if (!part) { part = { id: data.partId, start: data.partStart, end: run.content.length, kind: "commentary" }; run.parts.push(part); }
        part.end = run.content.length;
      }
    }
    if (event === "presentation" && Array.isArray(data.parts)) run.parts = data.parts.map(part => ({ ...part as SessionReplyPart }));
    if (event === "activity" && data.activity && typeof data.activity === "object") {
      const activity = data.activity as { approvalId?: unknown; status?: unknown };
      if (typeof activity.approvalId === "string") {
        if (activity.status === "approval_required") run.pendingApprovals.add(activity.approvalId);
        else run.pendingApprovals.delete(activity.approvalId);
      }
    }
    // 某个订阅者失败不能取消执行或阻断其他订阅者。
    for (const listener of run.listeners) { try { listener(event, data); } catch { run.listeners.delete(listener); } }
  };
  const pauseGate = new AiRunPauseGate(state => emit("pause-state", { runId: id, state }));
  run = { id, userId, applicationId: body.appId, sessionId: turn.session.id, canAskUser, controller: new AbortController(), pauseGate, children: new Set(), pendingApprovals: new Set(), listeners: new Set(), completion: Promise.resolve(), content: "", parts: [], inbox: [] };
  liveRuns.set(id, run);
  run.completion = (previous?.completion ?? Promise.resolve()).then(async () => {
    await run.pauseGate.checkpoint(run.controller.signal);
    if (run.controller.signal.aborted) { finishAiAssistantMessage(userId, turn.session.id, id, run.content, "interrupted"); emit("done", { status: "interrupted" }); return; }
    if (previous) startQueuedAiTurn(userId, turn.session.id, turn.userMessage.id, id);
    refreshAiTurnHistory(userId, turn);
    finishAiAssistantMessage(userId, turn.session.id, id, "", "streaming");
    return executeAiTurn({ userId, userRole, body, turn, aiPluginHost, abortController: run.controller, pauseGate: run.pauseGate, emit, takeInputs: () => run.inbox.splice(0), modelAccountId: account.accountId, modelResolver: resolver, approvalNotifications: approvals, writeGate, memoryEligible: runOptions.memoryEligible ?? (depth === 0 && !getAiSessionPlanMode(userId, turn.session.id)), planModeEnabled: depth === 0 && !sideChat,
      ...(requestUserInput ? { requestUserInput } : {}),
      ...(runOptions.systemPrompt ? { systemPrompt: runOptions.systemPrompt } : {}),
      ...(runOptions.allowedToolNames ? { allowedToolNames: runOptions.allowedToolNames } : {}),
      delegate: async (parameters, available, onActivity, execute) => {
        run.controller.signal.throwIfAborted();
        if (sideChat) throw new Error("侧边聊天不会创建子 Agent。");
        const currentRuntime = getUserSettings(userId).aiRuntime;
        if (depth >= currentRuntime.maxDelegationDepth || budget.used >= Math.min(budget.maximum, currentRuntime.maxSubagents)) throw new Error("已达到设置中心的子 Agent 数量或委派深度限制。");
        const requested = Array.isArray(parameters.toolNames) ? parameters.toolNames.map(String) : available;
        if (requested.some(name => !available.includes(name))) throw new Error("子 Agent 请求了父任务范围外的工具。");
        budget.used += 1;
        let childStarted = false; const startChild = async (signal?: AbortSignal) => { if (childStarted) throw new Error("同一委派只允许启动一个子任务。"); childStarted = true;
        run.controller.signal.throwIfAborted();
        signal?.throwIfAborted();
        const child = startAiRun(userId, userRole, { appId: body.appId, sessionId: null, content: String(parameters.task) }, aiPluginHost, { depth: depth + 1, modelAccountId: typeof parameters.modelAccountId === "string" ? parameters.modelAccountId : currentRuntime.subagentAccountId || account.accountId, allowedToolNames: requested, systemPrompt: ["你是主 Agent 委派的子 Agent。围绕本次子任务自主选择工具、检查结果和完成验证；返回产物、执行证据和未解决事项。", typeof parameters.expertInstructions === "string" ? parameters.expertInstructions : ""].filter(Boolean).join("\n\n"), delegationBudget: budget, writeGate, canAskUser: false, workspaceProject: getAiSessionWorkspaceContext(userId, turn.session.id) });
        const childLive = liveRuns.get(child.id)!;
        run.children.add(child.id);
        const abortChild = () => childLive.controller.abort();
        run.controller.signal.addEventListener("abort", abortChild, { once: true });
        signal?.addEventListener("abort", abortChild, { once: true });
        const unsubscribe = subscribeAiRun(userId, child.id, (event, data) => {
          if (event === "activity") { const activity = data.activity as import("lfaa-session/src/sessions.js").AiActivityItem; onActivity({ ...activity, title: "子 Agent · " + activity.title }); }
        });
        try { await childLive.completion; }
        finally { run.children.delete(child.id); unsubscribe(); run.controller.signal.removeEventListener("abort", abortChild); signal?.removeEventListener("abort", abortChild); }
        const result = getAiRun(userId, child.id)!;
        return { childRunId: child.id, sessionId: child.sessionId, status: result.status, answer: result.message.content, evidence: result.message.activity };
        };
        return execute ? execute(startChild) : startChild();
      }
    });
  }).catch(error => {
    const interrupted = run.controller.signal.aborted;
    finishAiAssistantMessage(userId, turn.session.id, id, run.content, interrupted ? "interrupted" : "error");
    if (!interrupted) emit("error", { message: error instanceof Error ? error.message : "任务运行失败。" });
    emit("done", { status: interrupted ? "interrupted" : "error" });
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
  listener("capability-settings", { changed: true });
  if (live?.userId === userId) listener("pause-state", { runId, state: live.pauseGate.state });
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

/** 在当前账户活动 Run 的 Agent 检查点请求暂停，不中断正在执行的 Provider 或工具操作。 */
export function pauseAiRun(userId: string, runId: string): AiRunPauseState | null {
  const run = liveRuns.get(runId);
  const snapshot = readRun(userId, runId);
  if (!run || run.userId !== userId || !snapshot || !["queued", "streaming"].includes(snapshot.status)) return null;
  setRunPauseRequested(run, true);
  return run.pauseGate.state;
}

/** 唤醒同一个 Run；取消尚未到达检查点的暂停请求也视为继续。 */
export function resumeAiRun(userId: string, runId: string): AiRunPauseState | null {
  const run = liveRuns.get(runId);
  const snapshot = readRun(userId, runId);
  if (!run || run.userId !== userId || !snapshot || !["queued", "streaming"].includes(snapshot.status)) return null;
  setRunPauseRequested(run, false);
  return run.pauseGate.state;
}

export function getAiRunPauseState(userId: string, runId: string): AiRunPauseState | null {
  const run = liveRuns.get(runId);
  return run?.userId === userId && readRun(userId, runId) ? run.pauseGate.state : null;
}

function setRunPauseRequested(run: LiveRun, paused: boolean, visited = new Set<string>()): void {
  if (visited.has(run.id)) return;
  visited.add(run.id);
  if (paused) {
    run.pauseGate.requestPause();
    const snapshot = readRun(run.userId, run.id);
    if (snapshot?.status === "queued" || run.pendingQuestion || run.pendingApprovals.size > 0) run.pauseGate.confirmPausedAtSafeWait();
  } else run.pauseGate.resume();
  for (const childId of run.children) {
    const child = liveRuns.get(childId);
    if (child?.userId === run.userId) setRunPauseRequested(child, paused, visited);
  }
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

/** 将澄清答案一次性绑定到当前活动 run；答案作为原问题工具的结果继续，不创建新用户轮次。 */
export function answerAiRunQuestion(userId: string, runId: string, questionId: string, answer: string, skipped: boolean) {
  const snapshot = getAiRun(userId, runId);
  const live = liveRuns.get(runId);
  const pending = live?.pendingQuestion;
  if (!snapshot || snapshot.status !== "streaming" || !live || live.userId !== userId || !pending || pending.questionId !== questionId) {
    throw new Error("澄清问题已处理、过期或不属于当前账户的活动任务。");
  }
  const visibleAnswer = skipped ? "跳过了这条澄清问题。" : answer.trim();
  if (!visibleAnswer) throw new Error("请先选择选项、填写回答或选择跳过。");
  const questionActivity = snapshot.message.activity.find(activity => activity.questionId === questionId && activity.status === "waiting_input");
  if (!questionActivity) throw new Error("当前澄清问题没有可更新的会话活动记录。");
  const completedAt = new Date().toISOString();
  const completedActivity = {
    ...questionActivity,
    status: "complete" as const,
    detail: skipped ? "你选择跳过了这条澄清问题。" : `你的回答：${answer.trim()}`,
    completedAt,
    durationMs: Math.max(0, Date.now() - Date.parse(questionActivity.startedAt))
  };
  saveAiAssistantActivity(userId, snapshot.sessionId, runId, snapshot.message.activity.map(activity => activity.id === questionActivity.id ? completedActivity : activity));
  delete live.pendingQuestion;
  pending.signal.removeEventListener("abort", pending.abort);
  for (const listener of live.listeners) { try { listener("activity", { messageId: runId, activity: completedActivity }); } catch { live.listeners.delete(listener); } }
  pending.resolve({
    answer: skipped ? "用户选择跳过这条澄清问题；请依据已有信息继续，并明确说明仍未确定的假设。" : answer.trim(),
    skipped
  });
  return { mode: "answered" as const };
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
  completionService = undefined;
  modelResolver = undefined;
  approvalNotifications = undefined;
  userQuestions = undefined;
}
