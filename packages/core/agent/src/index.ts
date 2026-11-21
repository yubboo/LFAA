// @lfaa/agent Host 侧 Cordis 服务：连接 llm/tools/memory/rules 四大能力并管理任务运行态、SSE 订阅与工具审批。
import { type Context, Service } from "@deepseek-ai/cordis";
import "@lfaa/llm";
import "@lfaa/memory";
import "@lfaa/rules";
import "@lfaa/tools";
import { executeAgentTaskLoop } from "./agent-loop";
import { readActivitySource } from "./activity-file";
import { registerAgentLibraryTools } from "./builtin-agent-tools";
import { SmartTrustStore } from "./permission-policy";
import { beginAgentRun, type SkillCatalogProvider, type SkillResolver } from "./run-begin";
import type { CompactionHook } from "./run-types";
import { pendingApprovalSummary, type ActiveRunRecord } from "./run-records";
import {
  maskRunId,
  type AgentStreamMetrics,
  type RunChunkRecord,
} from "./stream-journal";
import type { AgentAttentionItem, AgentPermissionMode, AgentRunEvent, AgentRunStatus, StartAgentRunInput } from "./types";

export * from "./types";
export * from "./permission-policy";
export * from "./stream-journal";
export { createAgentHttpHandler } from "./http-handler";
export { executeAgentTaskLoop, type RunExecutionParams, type RunLoopDeps } from "./agent-loop";

/** 配置 Agent Host 存储及运行参数，供应用启动和隔离测试注入。 */
export interface AgentPluginConfig {
  smartTrustFilePath?: string;
  /** 装配层可兼容已存会话的旧预设组合。 */
  resolveSessionModules?: (presetId: string | undefined, modules: readonly string[]) => readonly string[];
}

// Host 侧 Agent 任务调度服务。
export class AgentService extends Service {
  static inject = ["llm", "tools", "memory", "rules"];

  private readonly runs = new Map<string, ActiveRunRecord>();
  private readonly sessionTransitions = new Set<string>();
  private readonly trustStore: SmartTrustStore;
  private unregisterBuiltinTools: (() => void) | null = null;
  private skillResolver: SkillResolver | null = null;
  private skillCatalogProvider: SkillCatalogProvider | null = null;
  private totalRunsCount = 0;
  private totalReconnectsCount = 0;
  private replayedChunksCount = 0;
  private lastClientFpsValue: number | null = null;

  constructor(ctx: Context, private readonly config: AgentPluginConfig = {}) {
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

  /** 拒绝用生图/生视频/语音模型发起对话运行，提示改用媒体直连或切换对话模型。 */
  private async assertChatModel(input: StartAgentRunInput): Promise<void> {
    const catalog = await this.ctx.llm.listPublicProfiles().catch(() => ({ activeProfileId: "", profiles: [] }));
    const profile = catalog.profiles.find((item) => item.id === (input.profileId ?? catalog.activeProfileId)) ?? catalog.profiles[0];
    const kind = profile?.availableModels?.find((model) => model.id === profile.model)?.modelKind;
    if (!kind || kind === "chat") return;
    const label = kind === "image" ? "生图" : kind === "video" ? "生视频" : "语音";
    throw new Error(`当前选中的是${label}模型，不能用于对话。请直接在输入框发送生成描述，或切换回对话模型后重试。`);
  }

  private async beginRun(input: StartAgentRunInput, resolveRoots?: (projectId: string | null) => Promise<string[]>) {
    await this.assertChatModel(input);
    const compaction = this.ctx.get("compaction") as CompactionHook | undefined;
    const prompt = this.ctx.get("prompt") as { compose(): Promise<string> } | undefined;
    return beginAgentRun({
      llm: this.ctx.llm,
      tools: this.ctx.tools,
      memory: this.ctx.memory,
      rules: this.ctx.rules,
      trustStore: this.trustStore,
      ...(compaction ? { compaction } : {}),
      ...(prompt ? { extraSystemPrompt: () => prompt.compose() } : {}),
      skillResolver: this.skillResolver,
      skillCatalogProvider: this.skillCatalogProvider,
      ...(this.config.resolveSessionModules ? { resolveSessionModules: this.config.resolveSessionModules } : {}),
      onRunCreated: (record) => {
        this.runs.set(record.status.runId, record);
        this.totalRunsCount += 1;
      },
    }, input, resolveRoots);
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

  /** 把新问题追加到正在运行的对话（插话），不打断当前生成。 */
  async steerRun(runId: string, text: string): Promise<boolean> {
    const run = this.runs.get(runId);
    const content = text.trim();
    if (!run || !content) return false;
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

  /** 汇总需要用户处理的会话：等待工具审批，或等待回答澄清问题；同一会话优先返回审批。 */
  async listAttention(): Promise<AgentAttentionItem[]> {
    const items = new Map<string, AgentAttentionItem>();
    for (const run of this.runs.values()) {
      if (run.status.status !== "running" || run.pendingApprovals.size === 0) continue;
      const sessionId = run.status.sessionId;
      const pending = [...run.pendingApprovals.values()][0];
      items.set(sessionId, {
        sessionId,
        kind: "approval",
        ...(pending?.toolName ? { toolName: pending.toolName } : {}),
      });
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
/** 默认导出插件本体，供 Cordis Loader 以包名直接装载。 */
export default agentPlugin;
