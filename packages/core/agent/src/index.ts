// @lfaa/agent Host 侧 Cordis 服务：连接 llm/tools/memory/rules 四大能力并管理任务运行态、SSE 订阅与工具审批。
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { type Context, Service } from "@deepseek-ai/cordis";
import "@lfaa/llm";
import "@lfaa/memory";
import "@lfaa/rules";
import "@lfaa/tools";
import type { AgentStepTrace } from "@lfaa/memory";
import { executeAgentTaskLoop } from "./agent-loop";
import { registerAgentLibraryTools } from "./builtin-agent-tools";
import { normalizePermissionMode, SmartTrustStore } from "./permission-policy";
import {
  maskRunId,
  type AgentStreamMetrics,
  type RunChunkRecord,
} from "./stream-journal";
import type { AgentPermissionMode, AgentRunEvent, AgentRunStatus, StartAgentRunInput } from "./types";

export * from "./types";
export * from "./permission-policy";
export * from "./stream-journal";
export { createAgentHttpHandler } from "./http-handler";

const execFileAsync = promisify(execFile);

/** 当用户在绑定项目中发起对话时，若项目目录尚未建立 .git 仓库则自动初始化并生成首个基线提交 */
async function ensureProjectGitRepo(rootPath: string): Promise<void> {
  if (!rootPath || !existsSync(rootPath)) return;
  const gitEnv = { ...process.env, GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" };
  const runGit = (args: string[]) =>
    execFileAsync("git", args, { cwd: rootPath, timeout: 10000, windowsHide: true, env: gitEnv });

  const isRepo = existsSync(join(rootPath, ".git"))
    || await runGit(["rev-parse", "--is-inside-work-tree"]).then(() => true).catch(() => false);

  if (!isRepo) {
    await runGit(["init"]).catch(() => {});
  }

  const hasName = await runGit(["config", "user.name"]).then((r) => Boolean(r.stdout.trim())).catch(() => false);
  if (!hasName) {
    await runGit(["config", "user.name", "LFAA User"]).catch(() => {});
  }
  const hasEmail = await runGit(["config", "user.email"]).then((r) => Boolean(r.stdout.trim())).catch(() => false);
  if (!hasEmail) {
    await runGit(["config", "user.email", "lfaa@local"]).catch(() => {});
  }

  const hasHead = await runGit(["rev-parse", "--verify", "HEAD"]).then(() => true).catch(() => false);
  if (!hasHead) {
    await runGit(["add", "-A"]).catch(() => {});
    await runGit(["commit", "--allow-empty", "-m", "chore: init project repository"]).catch(() => {});
  }
}

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
  resolve: (approved: boolean) => void;
}

interface ActiveRunRecord {
  status: AgentRunStatus;
  controller: AbortController;
  listeners: Set<(event: AgentRunEvent) => void>;
  pendingApprovals: Map<string, PendingApprovalRecord>;
  chunks: RunChunkRecord[];
  persistChain: Promise<void>;
  lastPersistAt: number;
}

// Host 侧 Agent 任务调度服务。
export class AgentService extends Service {
  static inject = ["llm", "tools", "memory", "rules"];

  private readonly runs = new Map<string, ActiveRunRecord>();
  private readonly trustStore: SmartTrustStore;
  private unregisterBuiltinTools: (() => void) | null = null;
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
    for (const run of this.runs.values()) {
      run.controller.abort();
      for (const pending of run.pendingApprovals.values()) pending.resolve(false);
    }
    this.runs.clear();
  }

  async startRun(input: StartAgentRunInput): Promise<{ runId: string; sessionId: string; assistantMessageId: string }> {
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

    const primaryProjectRoot = input.workspaceRoots?.[0];
    if ((input.projectId ?? session.projectId) && primaryProjectRoot) {
      await ensureProjectGitRepo(primaryProjectRoot).catch(() => {});
    }

    await this.ctx.memory.appendMessage(session.id, {
      id: userMessageId,
      role: "user",
      content: trimmedInput,
      createdAt: Date.now(),
    });
    await this.ctx.memory.appendMessage(session.id, {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      steps: [],
      status: "streaming",
      createdAt: Date.now(),
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
      } else if (rawEvent.type === "step_update") {
        const idx = record.status.steps.findIndex((s: AgentStepTrace) => s.id === rawEvent.step.id);
        if (idx >= 0) record.status.steps[idx] = rawEvent.step;
        else record.status.steps.push(rawEvent.step);
        scheduleStreamingPersist(true);
      }
      for (const listener of record.listeners) {
        listener(event);
      }
    };

    const permissionMode = normalizePermissionMode(input.permissionMode, input.autoApproveTools);

    queueMicrotask(() => {
      void (async () => {
        const runStartedAt = Date.now();
        try {
          emit({ type: "run_started", runId, sessionId: session.id, assistantMessageId });
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
              projectId: input.projectId ?? session.projectId,
              workspaceRoots: input.workspaceRoots ?? [],
              maxSteps: input.maxSteps ?? 10,
              permissionMode,
              signal: controller.signal,
              emit,
              requestApproval: (req) =>
                new Promise<boolean>((resolve) => {
                  record.pendingApprovals.set(req.approvalId, {
                    ...req,
                    resolve,
                  });
                  const onAbort = () => {
                    record.pendingApprovals.delete(req.approvalId);
                    resolve(false);
                  };
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

          record.status.status = "done";
          record.status.content = result.content;
          record.status.reasoning = result.reasoning;
          const reasoningDurationMs = result.reasoning ? Math.max(1000, Date.now() - runStartedAt) : undefined;
          await record.persistChain;
          await this.ctx.memory.updateMessage(session.id, assistantMessageId, {
            content: result.content,
            ...(result.reasoning ? { reasoning: result.reasoning } : {}),
            ...(reasoningDurationMs !== undefined ? { reasoningDurationMs } : {}),
            steps: result.steps,
            status: "done",
            ...(result.model ? { model: result.model } : {}),
          });
          // 后台生成完成先标记未读，若前端当前正停留在当前会话则由前端清除未读
          await this.ctx.memory.updateSession(session.id, { unread: true });
          emit({ type: "run_finished", runId, sessionId: session.id, assistantMessageId, status: "done" });
        } catch (error) {
          const aborted = controller.signal.aborted;
          const msg = error instanceof Error ? error.message : String(error);
          const finalStatus = aborted ? "aborted" : "error";
          record.status.status = finalStatus;
          record.status.error = msg;
          await record.persistChain;
          const persistedContent = record.status.content.trim()
            || (aborted ? "（任务已手动中止）" : `执行异常：${msg}`);
          const reasoningDurationMs = record.status.reasoning ? Math.max(1000, Date.now() - runStartedAt) : undefined;
          await this.ctx.memory.updateMessage(session.id, assistantMessageId, {
            content: persistedContent,
            ...(record.status.reasoning ? { reasoning: record.status.reasoning } : {}),
            ...(reasoningDurationMs !== undefined ? { reasoningDurationMs } : {}),
            steps: record.status.steps,
            status: finalStatus,
          });
          if (!aborted) {
            await this.ctx.memory.updateSession(session.id, { unread: true });
          }
          emit({
            type: "run_finished",
            runId,
            sessionId: session.id,
            assistantMessageId,
            status: finalStatus,
            error: msg,
          });
        }
      })();
    });

    return { runId, sessionId: session.id, assistantMessageId };
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

  resolveApproval(runId: string, approvalId: string, approved: boolean): boolean {
    const run = this.runs.get(runId);
    const pending = run?.pendingApprovals.get(approvalId);
    if (!pending) return false;
    run?.pendingApprovals.delete(approvalId);
    pending.resolve(approved);
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
}

export function agentPlugin(context: Context, config: AgentPluginConfig = {}): void {
  new AgentService(context, config);
}

agentPlugin.inject = ["llm", "tools", "memory", "rules"] as const;

declare module "@deepseek-ai/cordis" {
  interface Context {
    agent: AgentService;
  }
}
