// 跨会话可见性工具：列出同一项目的会话、读取最近事件、等待另一个会话结束。
// 只读、按项目隔离；供 Agent 判断「另一个会话在不在干活」，再决定等它还是换工作树。
import type { Context } from "@deepseek-ai/cordis";
import type { ChatSessionRecord, ChatSessionSummary } from "@lfaa/memory";
import type { GoalContinuationSnapshot } from "../run/goal-continuation";

/** 目标快照附带会话归属，便于按会话分组。 */
export interface SessionGoalSnapshot extends GoalContinuationSnapshot {
  sessionId?: string;
}

/** 工具依赖：由 AgentService 注入，测试可替换为最小实现。 */
export interface SessionToolDeps {
  listSessions(options: { includeArchived?: boolean }): Promise<ChatSessionSummary[]>;
  getSession(id: string): Promise<ChatSessionRecord | null>;
  isRunning(sessionId: string): boolean;
  /** 只返回 active 目标，避免把历史目标混进会话列表。 */
  listActiveGoals(): Promise<SessionGoalSnapshot[]>;
}

/** 目标会话与当前会话是否同一项目；未绑定项目时只允许同为未绑定。 */
export function sameProject(current: string | null | undefined, target: string | null | undefined): boolean {
  return (current ?? null) === (target ?? null);
}

/** 把消息正文压成单行摘要，避免把整段代码塞回模型上下文。 */
export function truncateText(text: string, max = 400): string {
  const normalized = text.replace(/\s+/gu, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max)}…` : normalized;
}

/** 有界等待另一个会话结束；timeout 后返回 timedOut，不抛异常。 */
export async function waitForSessionEnd(input: {
  isRunning: () => boolean;
  timeoutMs: number;
  intervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}): Promise<{ timedOut: boolean; waitedMs: number }> {
  const now = input.now ?? Date.now;
  const sleep = input.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const interval = Math.max(50, input.intervalMs ?? 250);
  const startedAt = now();
  while (input.isRunning()) {
    if (now() - startedAt >= input.timeoutMs) return { timedOut: true, waitedMs: now() - startedAt };
    await sleep(interval);
  }
  return { timedOut: false, waitedMs: now() - startedAt };
}

/** 会话行的统一格式：标题、状态、工作树、目标与更新时间。 */
export function formatSessionLine(
  session: ChatSessionSummary,
  options: { running: boolean; current: boolean; goal?: GoalContinuationSnapshot | undefined },
): string {
  const parts = [
    `${session.id} · ${session.title}`,
    options.running ? "运行中" : "空闲",
    ...(session.worktree ? [`工作树 ${session.worktree.branch}`] : []),
    ...(options.goal ? [`目标 [${options.goal.status}] ${options.goal.title}`] : []),
    `更新 ${new Date(session.updatedAt).toLocaleString("zh-CN")}`,
    ...(options.current ? ["当前会话"] : []),
  ];
  return `- ${parts.join(" · ")}`;
}

/** 注册三个会话可见性工具，返回卸载清理入口。 */
export function registerAgentSessionTools(ctx: Context, deps: SessionToolDeps): () => void {
  const offList = ctx.tools.registerTool({
    moduleName: "@lfaa/agent",
    name: "list_sessions",
    title: "查看项目会话",
    description: "列出同一项目下的会话、是否正在运行、绑定的工作树与进行中的目标，用于判断另一个会话是否在干活。",
    permissionLevel: "read",
    parameters: {
      type: "object",
      properties: {
        includeArchived: { type: "boolean", description: "是否包含已归档会话，默认 false" },
      },
    },
    execute: async (args, execCtx) => {
      const current = await deps.getSession(execCtx.sessionId);
      if (!current) return { ok: false, output: "找不到当前会话。", summary: "当前会话不存在" };
      const sessions = await deps.listSessions({ includeArchived: args.includeArchived === true });
      const scoped = sessions
        .filter((session) => sameProject(current.projectId, session.projectId))
        .sort((left, right) => Number(deps.isRunning(right.id)) - Number(deps.isRunning(left.id)) || right.updatedAt - left.updatedAt)
        .slice(0, 30);
      if (scoped.length === 0) {
        return { ok: true, output: "同一项目下没有其他会话。", summary: "没有会话" };
      }
      const goals = await deps.listActiveGoals().catch(() => []);
      const goalFor = (sessionId: string) => goals.find((goal) => goal.sessionId === sessionId);
      const lines = scoped.map((session) => formatSessionLine(session, {
        running: deps.isRunning(session.id),
        current: session.id === current.id,
        goal: goalFor(session.id),
      }));
      return { ok: true, output: lines.join("\n"), summary: `${scoped.length} 个会话` };
    },
  });

  const offRead = ctx.tools.registerTool({
    moduleName: "@lfaa/agent",
    name: "read_session_events",
    title: "读取会话最近事件",
    description: "读取同一项目另一个会话的最近消息与步骤摘要（只读），用于判断它做到哪一步、有没有卡住。",
    permissionLevel: "read",
    parameters: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "目标会话 id（来自 list_sessions）" },
        limit: { type: "number", description: "读取的消息条数，默认 10，最多 30" },
      },
      required: ["sessionId"],
    },
    execute: async (args, execCtx) => {
      const sessionId = typeof args.sessionId === "string" ? args.sessionId.trim() : "";
      if (!sessionId) return { ok: false, output: "缺少 sessionId。", summary: "参数缺失" };
      const [current, target] = await Promise.all([deps.getSession(execCtx.sessionId), deps.getSession(sessionId)]);
      if (!current || !target) return { ok: false, output: "找不到目标会话。", summary: "目标会话不存在" };
      if (!sameProject(current.projectId, target.projectId)) {
        return { ok: false, output: "只能读取同一项目的会话。", summary: "跨项目读取被拒绝" };
      }
      const limit = Math.min(30, Math.max(1, Math.floor(Number(args.limit) || 10)));
      const messages = target.messages.slice(-limit);
      const running = deps.isRunning(target.id);
      const header = [
        `会话：${target.title}（${running ? "运行中" : "空闲"}${target.pendingQuestion ? "，等待用户回答" : ""}）`,
        `最近 ${messages.length} 条消息：`,
      ];
      const lines = messages.map((message) => `- [${message.role}] ${truncateText(message.content) || "（空）"}`);
      const lastAssistant = [...target.messages].reverse().find((message) => message.role === "assistant" && message.steps?.length);
      const stepLines = lastAssistant?.steps?.slice(-12).map((step) => `- [${step.status}] ${step.title}${step.toolName ? `（${step.toolName}）` : ""}`) ?? [];
      return {
        ok: true,
        output: [...header, ...lines, ...(stepLines.length > 0 ? ["最近步骤：", ...stepLines] : [])].join("\n"),
        summary: `已读取 ${messages.length} 条消息`,
      };
    },
  });

  const offWait = ctx.tools.registerTool({
    moduleName: "@lfaa/agent",
    name: "wait_for_session",
    title: "等待会话结束",
    description: "有界等待同一项目的另一个会话结束（默认 30 秒，最多 120 秒），结束后返回状态；用于先等它收尾再接手。",
    permissionLevel: "read",
    parameters: {
      type: "object",
      properties: {
        sessionId: { type: "string", description: "目标会话 id" },
        timeoutMs: { type: "number", description: "最长等待毫秒数，默认 30000，最多 120000" },
      },
      required: ["sessionId"],
    },
    execute: async (args, execCtx) => {
      const sessionId = typeof args.sessionId === "string" ? args.sessionId.trim() : "";
      if (!sessionId) return { ok: false, output: "缺少 sessionId。", summary: "参数缺失" };
      if (sessionId === execCtx.sessionId) return { ok: false, output: "不能等待当前会话自己。", summary: "目标无效" };
      const [current, target] = await Promise.all([deps.getSession(execCtx.sessionId), deps.getSession(sessionId)]);
      if (!current || !target) return { ok: false, output: "找不到目标会话。", summary: "目标会话不存在" };
      if (!sameProject(current.projectId, target.projectId)) {
        return { ok: false, output: "只能等待同一项目的会话。", summary: "跨项目等待被拒绝" };
      }
      if (!deps.isRunning(target.id)) {
        return { ok: true, output: `会话「${target.title}」当前空闲。`, summary: "目标会话空闲" };
      }
      const timeoutMs = Math.min(120_000, Math.max(1_000, Math.floor(Number(args.timeoutMs) || 30_000)));
      const result = await waitForSessionEnd({ isRunning: () => deps.isRunning(target.id), timeoutMs });
      return result.timedOut
        ? { ok: true, output: `等待 ${Math.round(result.waitedMs / 1000)} 秒后「${target.title}」仍在运行。`, summary: "等待超时" }
        : { ok: true, output: `「${target.title}」已结束（等待 ${Math.round(result.waitedMs / 1000)} 秒）。`, summary: "目标会话已结束" };
    },
  });

  return () => {
    offWait();
    offRead();
    offList();
  };
}