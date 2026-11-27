// @lfaa/agent Host 侧 Cordis 服务：连接 llm/tools/memory/rules 四大能力并管理任务运行态、SSE 订阅与工具审批。
import { type Context, Service } from "@deepseek-ai/cordis";
import { createRoutedLlm, type AgentProfileService, type RunLlm } from "@lfaa/agent-profile";
import "@lfaa/llm";
import "@lfaa/memory";
import "@lfaa/rules";
import "@lfaa/tools";
import type { ChatSessionRecord } from "@lfaa/memory";
import { executeAgentTaskLoop } from "./run/agent-loop";
import { readFileActivity } from "./file-activity";
import { registerAgentLibraryTools } from "./tools/builtin-agent-tools";
import { registerAgentSessionTools, type SessionGoalSnapshot } from "./tools/session-tools";
import { SmartTrustStore } from "./tools/permission-policy";
import { beginAgentRun, type SkillCatalogProvider, type SkillResolver } from "./run/run-begin";
import { GoalContinuationScheduler, type GoalServicePort } from "./run/goal-scheduler";
import { pickRunOptions, resolveRunRouting, type RunOptionCache } from "./run/run-options";
import { RunWaiterRegistry } from "./run/run-waiters";
import { createToolPolicyResolver } from "./run/tool-policy";
import { resolveWorkspaceScope, type LeaseHolder } from "./run/workspace-lease";
import { PeerSessionRegistry } from "./run/peer-sessions";
import type { CompactionHook } from "./run/run-types";
import { pendingApprovalSummary, type ActiveRunRecord } from "./run/run-records";
import { maskRunId, type AgentStreamMetrics, type RunChunkRecord } from "./stream-journal";
import type { AgentAttentionItem, AgentPermissionMode, AgentRunEvent, AgentRunStatus, ProjectScope, StartAgentRunInput } from "./types";

export * from "./types";
export * from "./tools/permission-policy";
export * from "./stream-journal";
export { createAgentHttpHandler } from "./http-handler";
export { executeAgentTaskLoop, type RunExecutionParams, type RunLoopDeps } from "./run/agent-loop";

/** 配置 Agent Host 存储及运行参数，供应用启动和隔离测试注入。 */
export type { AgentPluginConfig } from "./plugin-config";

import type { AgentPluginConfig } from "./plugin-config";
import { SessionModulesHook } from "./session-modules-hook";

// Host 侧 Agent 任务调度服务。
export class AgentService extends Service {
  static inject = ["llm", "tools", "memory", "rules"];

  private readonly runs = new Map<string, ActiveRunRecord>();
  /** 群聊串行发言：等待某次运行收口。 */
  private readonly runWaiters = new RunWaiterRegistry();
  private readonly sessionTransitions = new Set<string>();
  /** 目标续跑调度器：运行收尾后按停止条件决定是否自动开下一轮。 */
  private readonly goalScheduler: GoalContinuationScheduler;
  /** 缓存每个会话最近一次运行的授权根，供续跑直接复用。 */
  private readonly sessionRootsCache = new Map<string, string[]>();
  /** 缓存每个会话最近一次的运行选项，供续跑沿用模型、预算与权限。 */
  private readonly sessionRunOptions = new Map<string, RunOptionCache>();
  /** 同工作区活跃会话登记表：支持多会话并行，并为各会话提供并发感知。 */
  private readonly workspaceLeases = new PeerSessionRegistry();
  private readonly trustStore: SmartTrustStore;
  private unregisterBuiltinTools: (() => void) | null = null;
  private unregisterSessionTools: (() => void) | null = null;
  private skillResolver: SkillResolver | null = null;
  private skillCatalogProvider: SkillCatalogProvider | null = null;
  private projectScopeProvider: ((projectId: string) => Promise<ProjectScope | null>) | null = null;
  private sessionRootsResolver: ((session: ChatSessionRecord) => Promise<string[] | null>) | null = null;
  /** 会话模块兼容器：装配完成后由 bundle 注入，避免 Loader 配置承载函数。 */
  private readonly sessionModulesHook: SessionModulesHook;
  private totalRunsCount = 0;
  private totalReconnectsCount = 0;
  private replayedChunksCount = 0;
  private lastClientFpsValue: number | null = null;

  constructor(ctx: Context, private readonly config: AgentPluginConfig = {}) {
    super(ctx, "agent");
    this.sessionModulesHook = new SessionModulesHook(config.resolveSessionModules);
    this.trustStore = new SmartTrustStore(config.smartTrustFilePath);
    this.unregisterBuiltinTools = registerAgentLibraryTools(ctx);
    this.unregisterSessionTools = registerAgentSessionTools(ctx, {
      listSessions: (options) => ctx.memory.listSessions(options),
      getSession: (id) => ctx.memory.getSession(id),
      isRunning: (sessionId) => Boolean(this.getActiveRunForSession(sessionId)),
      listActiveGoals: async () => {
        const goalService = ctx.get("goal") as {
          list(filter: { status: "active" }): Promise<SessionGoalSnapshot[]>;
        } | undefined;
        return goalService ? goalService.list({ status: "active" }).catch(() => []) : [];
      },
    });
    this.goalScheduler = new GoalContinuationScheduler({
      memory: ctx.memory,
      resolveGoalService: () => ctx.get("goal") as GoalServicePort | undefined,
      isSessionRunning: (sessionId) => Boolean(this.getActiveRunForSession(sessionId)),
      startRun: (input) => this.startRun(input),
      getRoots: (sessionId) => this.sessionRootsCache.get(sessionId),
      getRunOptions: (sessionId) => this.sessionRunOptions.get(sessionId) ?? {},
      warn: (message) => console.warn(message),
    });
  }

  protected stop(): void {
    this.unregisterBuiltinTools?.();
    this.unregisterBuiltinTools = null;
    this.unregisterSessionTools?.();
    this.unregisterSessionTools = null;
    this.skillResolver = null;
    this.skillCatalogProvider = null;
    this.projectScopeProvider = null;
    this.sessionRootsResolver = null;
    for (const run of this.runs.values()) {
      run.controller.abort();
      for (const pending of run.pendingApprovals.values()) pending.resolve(false);
    }
    this.goalScheduler.dispose();
    this.runWaiters.clear();
    this.sessionRootsCache.clear();
    this.sessionRunOptions.clear();
    this.workspaceLeases.clear();
    this.runs.clear();
  }

  /** 注册可选的技能摘要列表提供器，使 Agent 能感知已启用技能并按需调用 load_skill。 */
  setSkillCatalogProvider(provider: SkillCatalogProvider | null): () => void {
    this.skillCatalogProvider = provider;
    return () => {
      if (this.skillCatalogProvider === provider) {
        this.skillCatalogProvider = null;
      }
    };
  }

  /** 注册可选的技能解析器，供应用装配层将 @lfaa/skills 接入运行前校验。 */
  setSkillResolver(resolver: SkillResolver | null): () => void {
    this.skillResolver = resolver;
    return () => {
      if (this.skillResolver === resolver) {
        this.skillResolver = null;
      }
    };
  }

  /** 注册项目范围提供器：绑定项目的会话据此获得项目名与简介，用于系统提示的范围锚定。 */
  setProjectScopeProvider(provider: ((projectId: string) => Promise<ProjectScope | null>) | null): () => void {
    this.projectScopeProvider = provider;
    return () => {
      if (this.projectScopeProvider === provider) {
        this.projectScopeProvider = null;
      }
    };
  }

  /** 注册会话运行根解析器：绑定工作树时以其目录为授权根；返回 null 表示沿用项目根。 */
  setSessionRootsResolver(
    resolver: ((session: ChatSessionRecord) => Promise<string[] | null>) | null,
  ): () => void {
    this.sessionRootsResolver = resolver;
    return () => {
      if (this.sessionRootsResolver === resolver) {
        this.sessionRootsResolver = null;
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
    const session = await this.ctx.memory.getSession(input.sessionId);
    if (!session) throw new Error(`找不到聊天会话：${input.sessionId}`);
    const roots = input.workspaceRoots ?? (resolveRoots ? await resolveRoots(session.projectId) : []);
    const scope = resolveWorkspaceScope({
      worktreePath: session.worktree?.path,
      projectId: session.projectId,
      roots,
    });
    const started = await this.withIdleSession(input.sessionId, async () => {
      this.workspaceLeases.register(scope, session.id, session.title);
      try {
        return await this.beginRun(input, resolveRoots, scope);
      } catch (error) {
        this.workspaceLeases.release(session.id);
        throw error;
      }
    });
    if (started.workspaceRoots.length > 0) this.sessionRootsCache.set(input.sessionId, started.workspaceRoots);
    this.sessionRunOptions.set(input.sessionId, pickRunOptions(input));
    return started;
  }

  /** 当前工作区租约快照，供会话工具与状态展示读取。 */
  listWorkspaceLeases(): LeaseHolder[] {
    return this.workspaceLeases.list();
  }

  /** 运行收口后释放工作区租约并调度目标续跑；停止条件与延迟见 goal-scheduler.ts。 */
  private handleRunFinished(record: ActiveRunRecord): void {
    const sessionId = record.status.sessionId;
    this.workspaceLeases.release(sessionId);
    this.goalScheduler.schedule(sessionId, record.status.status === "done");
    // 群聊编排需要「这一轮说完再接下一个」，这里在收口时唤醒等待者，并在短缓冲后清理历史运行记录避免内存泄漏。
    this.runWaiters.wake(record.status.runId);
    const finishedRunId = record.status.runId;
    const cleanupTimer = setTimeout(() => {
      const current = this.runs.get(finishedRunId);
      if (current && current.status.status !== "running" && current.listeners.size === 0) this.runs.delete(finishedRunId);
    }, 60_000);
    cleanupTimer.unref?.();
  }

  /**
   * 等待一次运行收口（成功、失败或中断都算结束）；超时返回而不抛错，
   * 由调用方根据运行状态决定如何收尾。群聊串行编排依赖它。
   */
  async waitForRun(runId: string, timeoutMs = 15 * 60_000): Promise<void> {
    if (!this.isRunActive(runId)) return;
    await this.runWaiters.wait(runId, timeoutMs);
  }

  /** 运行是否仍在进行；已收口的运行立即返回 false，防止 waitForRun 死等。 */
  isRunActive(runId: string): boolean {
    return this.runs.get(runId)?.status.status === "running";
  }

  /**
   * 拒绝用生图/生视频/语音模型发起对话运行。走 agent 绑定时目标由派发层决定，
   * 这里不做全局推断——配了媒体模型会在模型调用阶段得到「请使用相应的生成入口」的明确报错。
   */
  private async assertChatModel(input: StartAgentRunInput, session?: ChatSessionRecord | null): Promise<void> {
    const agentProfile = this.ctx.get("agentProfile") as AgentProfileService | undefined;
    const bound = Boolean(agentProfile
      && (input.agentId ?? session?.agentId ?? input.bindingId ?? session?.bindingOverrideId));
    if (bound) return;
    const catalog = await this.ctx.llm.listPublicProfiles().catch(() => ({ activeProfileId: "", profiles: [] }));
    const profile = catalog.profiles.find((item) => item.id === (input.profileId ?? catalog.activeProfileId)) ?? catalog.profiles[0];
    const kind = profile?.availableModels?.find((model) => model.id === profile.model)?.modelKind;
    if (!kind || kind === "chat") return;
    const label = kind === "image" ? "生图" : kind === "video" ? "生视频" : "语音";
    throw new Error(`当前选中的是${label}模型，不能用于对话。请直接在输入框发送生成描述，或切换回对话模型后重试。`);
  }

  /**
   * 本次运行使用的模型入口：装配了 agent 定义与绑定服务时按绑定派发；
   * 未装配（隔离测试、旧装配）时原样返回 LlmService，行为与改造前完全一致。
   */
  private createRunLlm(input: StartAgentRunInput, session?: ChatSessionRecord | null): RunLlm {
    const agentProfile = this.ctx.get("agentProfile") as AgentProfileService | undefined;
    if (!agentProfile) return this.ctx.llm;
    // 会话级设置只在本次运行开始时读取一次，运行中改会话不会中途换模型。
    const routing = resolveRunRouting(input, session);
    return createRoutedLlm({
      llm: this.ctx.llm,
      bindings: agentProfile,
      ...(routing.agentId !== undefined ? { agentId: routing.agentId } : {}),
      ...(routing.bindingId !== undefined ? { bindingId: routing.bindingId } : {}),
    });
  }

  private async beginRun(input: StartAgentRunInput, resolveRoots?: (projectId: string | null) => Promise<string[]>, scope?: string) {
    const session = await this.ctx.memory.getSession(input.sessionId);
    await this.assertChatModel(input, session);
    const compaction = this.ctx.get("compaction") as CompactionHook | undefined;
    const prompt = this.ctx.get("prompt") as { compose(): Promise<string> } | undefined;
    const browser = this.ctx.get("browser") as { describeTakeoverHint?(sessionId: string): string } | undefined;
    const dynamicSystemHint = () => [
      browser?.describeTakeoverHint?.(input.sessionId) ?? "",
      scope ? this.workspaceLeases.describePeers(input.sessionId, scope, this.runs) : "",
    ].filter(Boolean).join("\n\n");
    const resolveSessionModules = this.sessionModulesHook.get();
    return beginAgentRun({
      llm: this.createRunLlm(input, session),
      tools: this.ctx.tools,
      memory: this.ctx.memory,
      rules: this.ctx.rules,
      trustStore: this.trustStore,
      resolveToolPolicy: createToolPolicyResolver(this.ctx), // agent 工具边界：只收窄
      ...(compaction ? { compaction } : {}),
      ...(prompt ? { extraSystemPrompt: () => prompt.compose() } : {}),
      dynamicSystemHint,
      skillResolver: this.skillResolver,
      skillCatalogProvider: this.skillCatalogProvider,
      ...(this.projectScopeProvider ? { resolveProjectScope: this.projectScopeProvider } : {}),
      ...(this.sessionRootsResolver ? { resolveSessionRoots: this.sessionRootsResolver } : {}),
      ...(resolveSessionModules ? { resolveSessionModules } : {}),
      onRunCreated: (record) => {
        this.runs.set(record.status.runId, record);
        this.totalRunsCount += 1;
      },
      onRunFinished: (record) => this.handleRunFinished(record),
    }, input, resolveRoots);
  }

  /** 装配完成后注入会话模块兼容器；返回注销函数。 */
  setResolveSessionModules(hook: NonNullable<AgentPluginConfig["resolveSessionModules"]>): () => void {
    return this.sessionModulesHook.set(hook);
  }

  /** 浏览器仅提交记录标识，文件路径解析见 file-activity。 */
  async readFileActivity(sessionId: string, messageId: string, stepId: string, resolveRoots: (projectId: string | null) => Promise<string[]>) {
    return readFileActivity({ getSession: (id) => this.ctx.memory.getSession(id), runs: this.runs }, sessionId, messageId, stepId, resolveRoots);
  }

  /** 把新问题追加到正在运行的对话（插话），不打断当前生成。 */
  async steerRun(runId: string, text: string): Promise<boolean> {
    const run = this.runs.get(runId);
    const content = text.trim();
    if (!run || run.status.status !== "running" || !content) return false;
    run.steering.push(content);
    // 同时落库为用户消息，刷新/断线后历史仍能看到这次插话。
    await this.ctx.memory.appendMessage(run.status.sessionId, {
      id: `steer-${runId}-${Date.now()}`,
      role: "user",
      content,
      createdAt: Date.now(),
    }).catch(() => {});
    return true;
  }

  getRunStatus(runId: string): AgentRunStatus | null {
    const run = this.runs.get(runId);
    if (!run) return null;
    const pendingApprovals = [...run.pendingApprovals.values()].map(pendingApprovalSummary);
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
        ...pendingApprovalSummary(pending),
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
    const cached = this.sessionRunOptions.get(run.status.sessionId);
    if (cached) cached.permissionMode = mode;
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

  /** 列出所有仍在运行的会话，供侧栏在切走会话后继续显示 Agent 工作状态。 */
  listRunningSessionIds(): string[] {
    const sessionIds = new Set<string>();
    for (const run of this.runs.values()) {
      if (run.status.status === "running") sessionIds.add(run.status.sessionId);
    }
    return [...sessionIds];
  }

  /** 用户跳过澄清时清除待回答状态；返回是否找到该会话。 */
  async dismissPendingQuestion(sessionId: string): Promise<boolean> {
    const updated = await this.ctx.memory.updateSession(sessionId, { pendingQuestion: null });
    return Boolean(updated);
  }

  /** 汇总需要用户处理的会话：等待工具审批，或等待回答澄清问题；同一会话优先返回审批。 */
  async listAttention(): Promise<AgentAttentionItem[]> {
    const items = new Map<string, AgentAttentionItem>();
    for (const run of this.runs.values()) {
      if (run.status.status !== "running" || run.pendingApprovals.size === 0) continue;
      const sessionId = run.status.sessionId;
      const pending = [...run.pendingApprovals.values()][0];
      items.set(sessionId, { sessionId, kind: "approval", ...(pending?.toolName ? { toolName: pending.toolName } : {}) });
    }
    const sessions = await this.ctx.memory.listSessions().catch(() => []);
    for (const session of sessions) {
      if (!session.pendingQuestion || items.has(session.id)) continue;
      items.set(session.id, {
        sessionId: session.id,
        kind: "question",
        question: session.pendingQuestion.question,
        options: [...session.pendingQuestion.options],
        messageId: session.pendingQuestion.messageId,
      });
    }
    return [...items.values()];
  }

  getReplayChunks(runId: string, afterSeq: number): RunChunkRecord[] {
    const run = this.runs.get(runId);
    if (!run) return [];
    return run.chunks.filter((chunk) => chunk.seq > afterSeq);
  }

  recordReconnect(runId: string, afterSeq: number, replayed: RunChunkRecord[]): void {
    this.totalReconnectsCount += 1;
    this.replayedChunksCount += replayed.length;
    const range = replayed.length > 0 ? `[${replayed[0]!.seq}..${replayed[replayed.length - 1]!.seq}]` : "[]";
    // 仅记录脱敏 runId、起始序号与补发区间，绝不记录用户/模型原文
    console.info(`[agent-stream] reconnect runId=${maskRunId(runId)} afterSeq=${afterSeq} replayed=${range}`);
  }

  recordClientFps(fps: number): void {
    if (Number.isFinite(fps) && fps > 0) this.lastClientFpsValue = Math.round(fps * 10) / 10;
  }

  getStreamMetrics(): AgentStreamMetrics {
    let activeStreams = 0;
    for (const run of this.runs.values()) {
      if (run.status.status === "running") activeStreams += 1;
    }
    const reconnectRate = this.totalRunsCount > 0 ? Math.round((this.totalReconnectsCount / this.totalRunsCount) * 1000) / 1000 : 0;
    return {
      activeStreams, totalRuns: this.totalRunsCount, totalReconnects: this.totalReconnectsCount,
      reconnectRate, replayedChunks: this.replayedChunksCount, lastClientFps: this.lastClientFpsValue,
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
    return out.content.trim() || out.reasoningContent?.trim() || "模型未返回内容。";
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
/** 默认导出插件本体，供 Cordis Loader 以包名直接装载。 */
export default agentPlugin;
