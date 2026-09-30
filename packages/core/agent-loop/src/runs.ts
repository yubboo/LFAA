/**
 * 功能：管理独立于网页连接的 Agent 任务。
 * 作用：提供提交、账户隔离查询、事件跟随及显式取消；任务证据由 JSONL 会话服务保存。
 * 关联文件：execute-turn.ts、core/session/sessions.ts、api/session-controller；卸载由本包 index.ts 处理。
 */
import type { AiPluginHost } from "lfaa-app-boot/src/ai-host.js";
import type { UserRole } from "lfaa-identity-auth/src/service.js";
import type { ApplicationId } from "lfaa-settings/src/preferences/service.js";
import { getUserSettings, resolveActiveAiModelConfiguration } from "lfaa-settings/src/service.js";
import { appendAiSteeringInput, createAiTurn, refreshAiTurnHistory, finishAiAssistantMessage, getAiRun as readRun, interruptOrphanedAiRuns, type AiModelMessage, type AiRunView } from "lfaa-session/src/sessions.js";
import { executeAiTurn } from "./execute-turn.js";

export interface AiRunInput { appId: ApplicationId; sessionId: string | null; content: string }
type Listener = (event: string, data: Record<string, unknown>) => void;
type LiveRun = { userId: string; sessionId: string; controller: AbortController; listeners: Set<Listener>; completion: Promise<void>; content: string; inbox: AiModelMessage[] };
const liveRuns = new Map<string, LiveRun>();

export function initializeAiRuns(): void { interruptOrphanedAiRuns(); }
export function getAiRun(userId: string, runId: string): AiRunView | null { const run = readRun(userId, runId); const live = liveRuns.get(runId); return run && live?.userId === userId ? { ...run, message: { ...run.message, content: live.content } } : run; }

interface RunOptions { depth?: number; modelAccountId?: string; allowedToolNames?: string[]; systemPrompt?: string; delegationBudget?: { used: number; maximum: number }; writeGate?: { denied: boolean } }

export function startAiRun(userId: string, userRole: UserRole, body: AiRunInput, aiPluginHost: AiPluginHost, options: RunOptions = {}): AiRunView {
  const account = resolveActiveAiModelConfiguration(userId, options.modelAccountId);
  if (!account) throw new Error("请先在设置中心的“AI 与模型”启用一个 Provider 账户。");
  const settings = getUserSettings(userId);
  const depth = options.depth ?? 0;
  const budget = options.delegationBudget ?? { used: 0, maximum: settings.aiRuntime.maxSubagents };
  const writeGate = options.writeGate ?? { denied: false };
  const previous = body.sessionId ? [...liveRuns.values()].filter(run => run.userId === userId && run.sessionId === body.sessionId).at(-1) : undefined;
  const turn = createAiTurn(userId, body.appId, body.sessionId, body.content, Boolean(previous));
  const id = turn.assistantMessage.id;
  const run: LiveRun = { userId, sessionId: turn.session.id, controller: new AbortController(), listeners: new Set(), completion: Promise.resolve(), content: "", inbox: [] };
  liveRuns.set(id, run);
  const emit: Listener = (event, data) => {
    if (event === "delta" && typeof data.delta === "string") run.content += data.delta;
    // 某个订阅者失败不能取消执行或阻断其他订阅者。
    for (const listener of run.listeners) { try { listener(event, data); } catch { run.listeners.delete(listener); } }
  };
  run.completion = (previous?.completion ?? Promise.resolve()).then(() => {
    if (run.controller.signal.aborted) { finishAiAssistantMessage(userId, turn.session.id, id, run.content, "interrupted"); emit("done", { status: "interrupted" }); return; }
    refreshAiTurnHistory(userId, turn);
    finishAiAssistantMessage(userId, turn.session.id, id, "", "streaming");
    return executeAiTurn({ userId, userRole, body, turn, aiPluginHost, abortController: run.controller, emit, takeInputs: () => run.inbox.splice(0), modelAccountId: account.accountId, writeGate,
      ...(options.systemPrompt ? { systemPrompt: options.systemPrompt } : {}),
      ...(options.allowedToolNames ? { allowedToolNames: options.allowedToolNames } : {}),
      delegate: async (parameters, available, onActivity) => {
        run.controller.signal.throwIfAborted();
        if (depth >= settings.aiRuntime.maxDelegationDepth || budget.used >= budget.maximum) throw new Error("已达到设置中心的子 Agent 数量或委派深度限制。");
        const requested = Array.isArray(parameters.toolNames) ? parameters.toolNames.map(String) : available;
        if (requested.some(name => !available.includes(name))) throw new Error("子 Agent 请求了父任务范围外的工具。");
        budget.used += 1;
        const child = startAiRun(userId, userRole, { appId: body.appId, sessionId: null, content: String(parameters.task) }, aiPluginHost, { depth: depth + 1, modelAccountId: settings.aiRuntime.subagentAccountId || account.accountId, allowedToolNames: requested, systemPrompt: "你是主 Agent 委派的子 Agent。围绕本次子任务自主选择工具、检查结果和完成验证；返回产物、执行证据和未解决事项。", delegationBudget: budget, writeGate });
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

/** 卸载取消 Agent 等待；已派发的节点任务仍按其真实执行状态回报。 */
export async function closeAiRuns(): Promise<void> {
  const runs = [...liveRuns.values()];
  for (const run of runs) run.controller.abort();
  await Promise.allSettled(runs.map(run => run.completion));
}
