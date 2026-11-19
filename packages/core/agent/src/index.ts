// @lfaa/agent Host 侧 Cordis 服务：连接 llm/tools/memory/rules 四大能力并管理任务运行态、SSE 订阅与工具审批。
import { randomUUID } from "node:crypto";
import { type Context, Service } from "@deepseek-ai/cordis";
import "@lfaa/llm";
import "@lfaa/memory";
import "@lfaa/rules";
import "@lfaa/tools";
import {
  buildRunSummaryEntry,
  collectStepDigest,
  formatHistoryDigest,
  rollSessionSummary,
  type AgentStepTrace,
} from "@lfaa/memory";
import { executeAgentTaskLoop } from "./agent-loop";
import { readActivitySource } from "./activity-file";
import { registerAgentLibraryTools } from "./builtin-agent-tools";
import { normalizePermissionMode, SmartTrustStore } from "./permission-policy";
import { ensureProjectGitRepo } from "./project-git";
import { extractExplicitMemory } from "./memory-autosave";
import { resolveStepBudget } from "./step-budget";
import {
  maskRunId,
  type AgentStreamMetrics,
  type RunChunkRecord,
} from "./stream-journal";
import type { AgentPermissionMode, AgentRunEvent, AgentRunStatus, ApprovalAnswer, ResolvedSkillContext, StartAgentRunInput } from "./types";

export * from "./types";
export * from "./permission-policy";
export * from "./stream-journal";
export { createAgentHttpHandler } from "./http-handler";
export { executeAgentTaskLoop, type RunExecutionParams, type RunLoopDeps } from "./agent-loop";

/** 配置 Agent Host 存储及运行参数，供应用启动和隔离测试注入。 */
export interface AgentPluginConfig {
  smartTrustFilePath?: string;
}

interface PendingApprovalRecord {
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
  resolve: (answer: ApprovalAnswer) => void;
}

interface ActiveRunRecord {
  status: AgentRunStatus;
  controller: AbortController;
  listeners: Set<(event: AgentRunEvent) => void>;
  pendingApprovals: Map<string, PendingApprovalRecord>;
  permissionMode: AgentPermissionMode;
  chunks: RunChunkRecord[];
  persistChain: Promise<void>;
  lastPersistAt: number;
}

// Host 侧 Agent 任务调度服务。
export class AgentService extends Service {
  static inject = ["llm", "tools", "memory", "rules"];

  private readonly runs = new Map<string, ActiveRunRecord>();
  private readonly sessionTransitions = new Set<string>();
  private readonly trustStore: SmartTrustStore;
  private unregisterBuiltinTools: (() => void) | null = null;
  private skillResolver: ((skillIds: string[], projectRoots: string[]) => Promise<ResolvedSkillContext[]>) | null = null;
  private skillCatalogProvider: ((projectRoots: string[]) => Promise<Array<{ id: string; name: string; source: string; description: string }>>) | null = null;
  private totalRunsCount = 0;
  private totalReconnectsCount = 0;
  private replayedChunksCount = 0;
  private lastClientFpsValue: number | null = null;

  constructor(ctx: Context, config: AgentPluginConfig = {}) {
    super(ctx, "agent");
    this.trustStore = new SmartTrustStore(config.smartTrustFilePath);
    this.unregisterBuiltinTools = registerAgentLibraryTools(ctx);
  }

  protected stop(): void {
    this.unregisterBuiltinTools?.();
    this.unregisterBuiltinTools = null;
    this.skillResolver = null;
    this.skillCatalogProvider = null;
    for (const run of this.runs.values()) {
      run.controller.abort();
      for (const pending of run.pendingApprovals.values()) pending.resolve(false);
    }
    this.runs.clear();
  }

  /** 注册可选的技能摘要列表提供器，使 Agent 能感知已启用技能并按需调用 load_skill。 */
  setSkillCatalogProvider(
    provider: ((projectRoots: string[]) => Promise<Array<{ id: string; name: string; source: string; description: string }>>) | null,
  ): () => void {
    this.skillCatalogProvider = provider;
    return () => {
      if (this.skillCatalogProvider === provider) {
        this.skillCatalogProvider = null;
      }
    };
  }

  /** 注册可选的技能解析器，供应用装配层将 @lfaa/skills 接入运行前校验。 */
  setSkillResolver(
    resolver: ((skillIds: string[], projectRoots: string[]) => Promise<ResolvedSkillContext[]>) | null,
  ): () => void {
    this.skillResolver = resolver;
    return () => {
      if (this.skillResolver === resolver) {
        this.skillResolver = null;
      }
    };
  }

  /** 启动和改绑共用会话锁，审批中的任务继续使用启动时的授权目录。 */
  async withIdleSession<T>(sessionId: string, action: () => Promise<T>): Promise<T> {
    if (this.sessionTransitions.has(sessionId) || this.getActiveRunForSession(sessionId)) {
      throw new Error("这条会话仍有任务或项目切换在进行，请在结束后再操作。");
    }
    this.sessionTransitions.add(sessionId);
    try {
      return await action();
    } finally {
      this.sessionTransitions.delete(sessionId);
    }
  }

  /** Web 启动使用持久会话解析授权根，可信的本地调用仍可显式提供根目录。 */
  async startRun(input: StartAgentRunInput, resolveRoots?: (projectId: string | null) => Promise<string[]>) {
    return this.withIdleSession(input.sessionId, () => this.beginRun(input, resolveRoots));
  }

  private async beginRun(input: StartAgentRunInput, resolveRoots?: (projectId: string | null) => Promise<string[]>) {
    const session = await this.ctx.memory.getSession(input.sessionId);
    if (!session) {
      throw new Error(`找不到聊天会话：${input.sessionId}`);
    }

    const runId = randomUUID();
    const userMessageId = randomUUID();
    const assistantMessageId = randomUUID();
    const trimmedInput = input.userMessage.trim();
    if (!trimmedInput) {
      throw new Error("发送内容不能为空。");
    }

    const projectId = resolveRoots ? session.projectId : (input.projectId ?? session.projectId);
    const workspaceRoots = resolveRoots ? await resolveRoots(projectId) : (input.workspaceRoots ?? []);
    const resolvedSkills = input.skillIds && input.skillIds.length > 0 && this.skillResolver
      ? await this.skillResolver(input.skillIds, workspaceRoots)
      : [];
    const availableSkillCatalog = this.skillCatalogProvider
      ? await this.skillCatalogProvider(workspaceRoots).catch(() => [])
      : [];

    await this.ctx.memory.appendMessage(session.id, {
      id: userMessageId,
      role: "user",
      content: trimmedInput,
      createdAt: Date.now(),
    });
    const runStartedAt = Date.now();
    await this.ctx.memory.appendMessage(session.id, {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      steps: [],
      status: "streaming",
      createdAt: runStartedAt,
    });

    const controller = new AbortController();
    const record: ActiveRunRecord = {
      status: {
        runId,
        sessionId: session.id,
        assistantMessageId,
        status: "running",
        steps: [],
        content: "",
        reasoning: "",
        lastSeq: 0,
      },
      controller,
      listeners: new Set(),
      pendingApprovals: new Map(),
      permissionMode: normalizePermissionMode(input.permissionMode, input.autoApproveTools),
      chunks: [],
      persistChain: Promise.resolve(),
      lastPersistAt: 0,
    };
    this.runs.set(runId, record);
    this.totalRunsCount += 1;

    // 串行持久化增量，确保断线重连后任何已推送内容均已严格落盘
    const scheduleStreamingPersist = (force = false) => {
      const now = Date.now();
      if (!force && now - record.lastPersistAt < 180) return;
      record.lastPersistAt = now;
      const contentSnap = record.status.content;
      const reasoningSnap = record.status.reasoning;
      const stepsSnap = record.status.steps.slice();
      record.persistChain = record.persistChain
        .then(() =>
          this.ctx.memory.updateMessage(session.id, assistantMessageId, {
            content: contentSnap,
            ...(reasoningSnap ? { reasoning: reasoningSnap } : {}),
            steps: stepsSnap,
            status: "streaming",
          }).then(() => undefined),
        )
        .catch(() => undefined);
    };

    const emit = (rawEvent: AgentRunEvent) => {
      let event = rawEvent;
      if (rawEvent.type === "delta") {
        const seq = record.status.lastSeq + 1;
        record.status.lastSeq = seq;
        event = { ...rawEvent, seq };
        if (rawEvent.kind === "text") record.status.content += rawEvent.text;
        else record.status.reasoning += rawEvent.text;
        record.chunks.push({ seq, kind: rawEvent.kind, text: rawEvent.text, ts: Date.now() });
        // 保证先写入增量落盘队列再广播至 SSE 订阅者
        scheduleStreamingPersist(seq === 1);
      } else if (rawEvent.type === "run_usage") {
        // 实时用量只更新内存状态，最终仍以 run_finished 的消息落盘为准。
        record.status.tokenUsage = rawEvent.tokenUsage;
        record.status.metrics = rawEvent.metrics;
        if (rawEvent.cost) record.status.cost = rawEvent.cost;
      } else if (rawEvent.type === "step_update") {
        const idx = record.status.steps.findIndex((s: AgentStepTrace) => s.id === rawEvent.step.id);
        if (idx >= 0) record.status.steps[idx] = rawEvent.step;
        else record.status.steps.push(rawEvent.step);
        // 与增量正文共用节流窗口：命令输出高频到达时不再每个事件全量重写会话文件。
        // 审批等待与失败是断线恢复的关键节点，仍立即落盘。
        const critical = rawEvent.step.status === "waiting_approval" || rawEvent.step.status === "error";
        scheduleStreamingPersist(critical);
      }
      for (const listener of record.listeners) {
        listener(event);
      }
    };

    queueMicrotask(() => {
      void (async () => {
        try {
          emit({ type: "run_started", runId, sessionId: session.id, assistantMessageId });
          const primaryProjectRoot = projectId ? workspaceRoots[0] : undefined;
          // 默认 100 步软预算，用尽后仍有关键进展会自动延长；显式 maxSteps 保持硬上限语义。
          const stepBudget = resolveStepBudget(input.maxSteps);
          const requestedExtension = typeof input.autoExtendSteps === "number"
            ? Math.max(0, Math.floor(input.autoExtendSteps))
            : undefined;
          const autoExtendSteps = requestedExtension ?? stepBudget.autoExtendSteps;
          let gitStep: AgentStepTrace | undefined;
          if (primaryProjectRoot) {
            try {
              await ensureProjectGitRepo(primaryProjectRoot);
            } catch (error) {
              // Git 可用性问题写入现有运行轨迹，用户仍可得到模型答复。
              gitStep = {
                id: "project-git", iteration: 0, phase: "check", status: "error",
                title: "项目 Git 基线准备失败",
                detail: error instanceof Error ? error.message.trim().split(/\r?\n/u).slice(0, 2).join("\n") : String(error),
                timestamp: Date.now(),
              };
              emit({ type: "step_update", runId, step: gitStep });
            }
          }
          const result = await executeAgentTaskLoop(
            {
              llm: this.ctx.llm,
              tools: this.ctx.tools,
              memory: this.ctx.memory,
              rules: this.ctx.rules,
              trustStore: this.trustStore,
            },
            {
              runId,
              sessionId: session.id,
              assistantMessageId,
              userMessage: trimmedInput,
              ...(input.profileId !== undefined ? { profileId: input.profileId } : {}),
              ...(input.reasoningEffort !== undefined ? { reasoningEffort: input.reasoningEffort } : {}),
              projectId,
              workspaceRoots,
              ...(resolvedSkills.length > 0 ? { resolvedSkills } : {}),
              ...(availableSkillCatalog.length > 0 ? { availableSkillCatalog } : {}),
              maxSteps: stepBudget.budget,
              ...(autoExtendSteps > 0 ? { autoExtendSteps } : {}),
              ...(input.repeatToolThresholds !== undefined ? { repeatToolThresholds: input.repeatToolThresholds } : {}),
              getPermissionMode: () => record.permissionMode,
              signal: controller.signal,
              emit,
              requestApproval: (req) =>
                new Promise<ApprovalAnswer>((resolve) => {
                  if (controller.signal.aborted) { resolve(false); return; }
                  const onAbort = () => settle(false);
                  const settle = (answer: ApprovalAnswer) => {
                    if (!record.pendingApprovals.delete(req.approvalId)) return;
                    controller.signal.removeEventListener("abort", onAbort);
                    emit({ type: "approval_resolved", runId, approvalId: req.approvalId });
                    resolve(answer);
                  };
                  record.pendingApprovals.set(req.approvalId, { ...req, resolve: settle });
                  controller.signal.addEventListener("abort", onAbort, { once: true });
                  emit({
                    type: "approval_required",
                    runId,
                    approvalId: req.approvalId,
                    toolName: req.toolName,
                    permissionLevel: req.permissionLevel,
                    argsPreview: req.argsPreview,
                    permissionMode: req.permissionMode,
                    ...(req.approvalPattern !== undefined ? { approvalPattern: req.approvalPattern } : {}),
                    ...(req.approvalCount !== undefined ? { approvalCount: req.approvalCount } : {}),
                    ...(req.approvalThreshold !== undefined ? { approvalThreshold: req.approvalThreshold } : {}),
                    ...(req.highRisk !== undefined ? { highRisk: req.highRisk } : {}),
                    ...(req.riskReason !== undefined ? { riskReason: req.riskReason } : {}),
                  });
                }),
            },
          );

          const runDurationMs = Date.now() - runStartedAt;
          await record.persistChain;
          // 用户明确陈述的偏好/约定在模型未主动保存时自动沉淀，避免“记忆”只写不读或只读不写。
          const autoMemory = await this.sedimentExplicitMemory(session.id, projectId, trimmedInput, result.steps);
          const resultSteps = autoMemory ? [...result.steps, autoMemory] : result.steps;
          const saved = await this.ctx.memory.updateMessage(session.id, assistantMessageId, {
            content: result.content,
            ...(result.progressText ? { progressText: result.progressText } : {}),
            ...(result.reasoning ? { reasoning: result.reasoning } : {}),
            runDurationMs,
            steps: gitStep ? [gitStep, ...resultSteps] : resultSteps,
            status: "done",
            ...(result.model ? { model: result.model } : {}),
            ...(result.usage ? { tokenUsage: result.usage } : {}),
            metrics: result.metrics,
            ...(result.cost ? { cost: result.cost } : {}),
          });
          // 后台生成完成先标记未读，若前端当前正停留在当前会话则由前端清除未读。
          // 同时把本轮结论与真实工具轨迹滚动写入会话上下文摘要，长会话恢复时不再只有"较早已有 N 条消息"。
          const digestText = formatHistoryDigest(collectStepDigest(result.steps));
          const nextSummary = rollSessionSummary(session.contextSummary, buildRunSummaryEntry({
            userMessage: trimmedInput,
            content: result.content,
            ...(digestText ? { digest: digestText } : {}),
          }));
          await this.ctx.memory.updateSession(session.id, {
            unread: true,
            ...(nextSummary ? { contextSummary: nextSummary } : {}),
          });
          const message = saved.messages.find((item) => item.id === assistantMessageId);
          record.status.status = "done";
          record.status.content = result.content;
          record.status.reasoning = result.reasoning;
          if (result.usage) record.status.tokenUsage = result.usage;
          record.status.metrics = result.metrics;
          if (result.cost) record.status.cost = result.cost;
          if (message) record.status.message = message;
          emit({ type: "run_finished", runId, sessionId: session.id, assistantMessageId, status: "done", ...(message ? { message } : {}) });
        } catch (error) {
          const aborted = controller.signal.aborted;
          const msg = error instanceof Error ? error.message : String(error);
          const finalStatus = aborted ? "aborted" : "error";
          const finishedAt = Date.now();
          const steps = record.status.steps.map((step): AgentStepTrace =>
            step.status === "preparing" || step.status === "running" || step.status === "waiting_approval"
              ? { ...step, status: "error", detail: msg, timestamp: finishedAt }
              : step,
          );
          const boundary = steps.reduce((offset, step) => Math.max(offset, step.textOffset ?? 0), 0);
          const progressText = record.status.content.slice(0, boundary);
          const content = record.status.content.slice(boundary).trim();
          const persistedContent = content || (aborted ? "（任务已手动中止）" : `执行异常：${msg}`);
          await record.persistChain;
          const saved = await this.ctx.memory.updateMessage(session.id, assistantMessageId, {
            content: persistedContent,
            ...(progressText ? { progressText } : {}),
            ...(record.status.reasoning ? { reasoning: record.status.reasoning } : {}),
            runDurationMs: finishedAt - runStartedAt,
            steps,
            status: finalStatus,
          });
          if (!aborted) {
            await this.ctx.memory.updateSession(session.id, { unread: true });
          }
          const message = saved.messages.find((item) => item.id === assistantMessageId);
          record.status.status = finalStatus;
          record.status.error = msg;
          record.status.content = persistedContent;
          record.status.steps = steps;
          if (message) record.status.message = message;
          emit({
            type: "run_finished",
            runId,
            sessionId: session.id,
            assistantMessageId,
            status: finalStatus,
            ...(message ? { message } : {}),
            error: msg,
          });
        }
      })();
    });

    return { runId, sessionId: session.id, assistantMessageId };
  }

  // 用户明确陈述的偏好/约定在模型未主动保存时自动写入长期记忆，并在轨迹中留痕。
  private async sedimentExplicitMemory(
    sessionId: string,
    projectId: string | null | undefined,
    userMessage: string,
    steps: AgentStepTrace[],
  ): Promise<AgentStepTrace | null> {
    const content = extractExplicitMemory(userMessage);
    if (!content) return null;
    if (steps.some((step) => step.toolName === "save_memory" && step.status === "done")) return null;
    const scope = projectId ? "project" : "global";
    try {
      await this.ctx.memory.addMemory({
        scope,
        ...(projectId ? { projectId } : {}),
        content,
        tags: ["auto"],
        sourceSessionId: sessionId,
      });
    } catch {
      return null;
    }
    return {
      id: "memory-autosave",
      iteration: steps.reduce((max, step) => Math.max(max, step.iteration), 0) + 1,
      phase: "act",
      status: "done",
      title: "已自动沉淀长期记忆",
      detail: content,
      toolName: "save_memory",
      permissionLevel: "read",
      timestamp: Date.now(),
    };
  }

  /** 浏览器仅提交记录标识，文件路径取自会话的真实工具结果。 */
  async readFileActivity(    sessionId: string, messageId: string, stepId: string,
    resolveRoots: (projectId: string | null) => Promise<string[]>,
  ) {
    const session = await this.ctx.memory.getSession(sessionId);
    const step = session?.messages.find((message) => message.id === messageId && message.role === "assistant")
      ?.steps?.find((item) => item.id === stepId);
    if (!session || !step?.fileChange || step.phase !== "act" || step.status !== "done") return null;
    return readActivitySource(step.fileChange, await resolveRoots(session.projectId));
  }

  getRunStatus(runId: string): AgentRunStatus | null {
    const run = this.runs.get(runId);
    if (!run) return null;
    const pendingApprovals = [...run.pendingApprovals.values()].map(
      ({ resolve: _resolve, ...rest }) => rest,
    );
    return {
      ...run.status,
      ...(pendingApprovals.length > 0 ? { pendingApprovals } : {}),
    };
  }

  // 新连接先收到仍待审批的请求，调用者关闭 SSE 连接时执行返回的取消订阅函数。
  subscribeRun(runId: string, listener: (event: AgentRunEvent) => void): () => void {
    const run = this.runs.get(runId);
    if (!run) return () => {};
    run.listeners.add(listener);
    for (const pending of run.pendingApprovals.values()) {
      listener({
        type: "approval_required",
        runId,
        approvalId: pending.approvalId,
        toolName: pending.toolName,
        permissionLevel: pending.permissionLevel,
        argsPreview: pending.argsPreview,
        ...(pending.permissionMode !== undefined ? { permissionMode: pending.permissionMode } : {}),
        ...(pending.approvalPattern !== undefined ? { approvalPattern: pending.approvalPattern } : {}),
        ...(pending.approvalCount !== undefined ? { approvalCount: pending.approvalCount } : {}),
        ...(pending.approvalThreshold !== undefined ? { approvalThreshold: pending.approvalThreshold } : {}),
        ...(pending.highRisk !== undefined ? { highRisk: pending.highRisk } : {}),
        ...(pending.riskReason !== undefined ? { riskReason: pending.riskReason } : {}),
      });
    }
    return () => {
      run.listeners.delete(listener);
    };
  }

  async getSmartTrustCounts(): Promise<Record<string, number>> {
    return this.trustStore.getAllCounts();
  }

  async resetSmartTrust(): Promise<void> {
    await this.trustStore.resetAll();
  }

  // 用运行和审批 ID 定位等待中的工具请求，消费该决策后继续执行流程。
  resolveApproval(runId: string, approvalId: string, approved: boolean): boolean {
    const run = this.runs.get(runId);
    const pending = run?.pendingApprovals.get(approvalId);
    if (!pending) return false;
    pending.resolve(approved);
    return true;
  }

  /** 本轮后续操作使用新策略，旧策略产生的待审批交回执行循环重新判断。 */
  setRunPermissionMode(runId: string, mode: AgentPermissionMode): boolean {
    const run = this.runs.get(runId);
    if (!run || run.status.status !== "running" || run.controller.signal.aborted) return false;
    if (run.permissionMode === mode) return true;
    run.permissionMode = mode;
    for (const pending of run.pendingApprovals.values()) pending.resolve("mode_changed");
    return true;
  }

  abortRun(runId: string): boolean {
    const run = this.runs.get(runId);
    if (!run || run.status.status !== "running") return false;
    run.controller.abort();
    return true;
  }

  getActiveRunForSession(sessionId: string): AgentRunStatus | null {
    for (const run of this.runs.values()) {
      if (run.status.sessionId === sessionId && run.status.status === "running") {
        return this.getRunStatus(run.status.runId);
      }
    }
    return null;
  }

  getReplayChunks(runId: string, afterSeq: number): RunChunkRecord[] {
    const run = this.runs.get(runId);
    if (!run) return [];
    return run.chunks.filter((chunk) => chunk.seq > afterSeq);
  }

  recordReconnect(runId: string, afterSeq: number, replayed: RunChunkRecord[]): void {
    this.totalReconnectsCount += 1;
    this.replayedChunksCount += replayed.length;
    const range = replayed.length > 0
      ? `[${replayed[0]!.seq}..${replayed[replayed.length - 1]!.seq}]`
      : "[]";
    // 仅记录脱敏 runId、起始序号与补发区间，绝不记录用户/模型原文
    console.info(`[agent-stream] reconnect runId=${maskRunId(runId)} afterSeq=${afterSeq} replayed=${range}`);
  }

  recordClientFps(fps: number): void {
    if (Number.isFinite(fps) && fps > 0) {
      this.lastClientFpsValue = Math.round(fps * 10) / 10;
    }
  }

  getStreamMetrics(): AgentStreamMetrics {
    let activeStreams = 0;
    for (const run of this.runs.values()) {
      if (run.status.status === "running") activeStreams += 1;
    }
    const reconnectRate = this.totalRunsCount > 0
      ? Math.round((this.totalReconnectsCount / this.totalRunsCount) * 1000) / 1000
      : 0;
    return {
      activeStreams,
      totalRuns: this.totalRunsCount,
      totalReconnects: this.totalReconnectsCount,
      reconnectRate,
      replayedChunks: this.replayedChunksCount,
      lastClientFps: this.lastClientFpsValue,
    };
  }

  /** 在不写入主对话历史的情况下，基于当前规则与可选上下文快速回答右侧栏轻量提问。 */
  async answerSideQuestion(question: string, contextHint = "", profileId?: string): Promise<string> {
    const { systemPrompt } = await this.ctx.rules.composeSystemPrompt({});
    const out = await this.ctx.llm.complete({
      ...(profileId ? { profileId } : {}),
      messages: [
        { role: "system", content: `${systemPrompt}\n\n请以简明准确的中文直接回答右侧栏快捷提问。` },
        ...(contextHint.trim() ? [{ role: "system" as const, content: `当前上下文摘要：\n${contextHint.slice(0, 3000)}` }] : []),
        { role: "user", content: question },
      ],
    });
    return out.content.trim() || "模型未返回内容。";
  }
}

/** 通过 Cordis 安装 Agent 服务，由已注入的模型、工具和记忆服务支撑运行。 */
export function agentPlugin(context: Context, config: AgentPluginConfig = {}): void {
  new AgentService(context, config);
}

agentPlugin.inject = ["llm", "tools", "memory", "rules"] as const;

declare module "@deepseek-ai/cordis" {
  interface Context {
    agent: AgentService;
  }
}
