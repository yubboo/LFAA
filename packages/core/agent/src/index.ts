// @lfaa/agent Host 侧 Cordis 服务：连接 llm/tools/memory/rules 四大能力并管理任务运行态、SSE 订阅与工具审批。
import { randomUUID } from "node:crypto";
import { type Context, Service } from "@deepseek-ai/cordis";
import "@lfaa/llm";
import "@lfaa/memory";
import "@lfaa/rules";
import "@lfaa/tools";
import type { AgentStepTrace } from "@lfaa/memory";
import { executeAgentTaskLoop } from "./agent-loop";
import type { AgentRunEvent, AgentRunStatus, StartAgentRunInput } from "./types";

export * from "./types";
export { createAgentHttpHandler } from "./http-handler";

interface PendingApprovalRecord {
  approvalId: string;
  toolName: string;
  permissionLevel: "write" | "exec";
  argsPreview: string;
  resolve: (approved: boolean) => void;
}

interface ActiveRunRecord {
  status: AgentRunStatus;
  controller: AbortController;
  listeners: Set<(event: AgentRunEvent) => void>;
  pendingApprovals: Map<string, PendingApprovalRecord>;
}

// Host 侧 Agent 任务调度服务。
export class AgentService extends Service {
  static inject = ["llm", "tools", "memory", "rules"];

  private readonly runs = new Map<string, ActiveRunRecord>();
  private unregisterMemoryTool: (() => void) | null = null;

  constructor(ctx: Context) {
    super(ctx, "agent");
    // 注册记忆写入工具，使 Agent 能在对话过程中自主沉淀长期事实。
    this.unregisterMemoryTool = ctx.tools.registerTool({
      name: "save_memory",
      title: "记录长期记忆",
      description: "将重要的项目约束或用户长期偏好保存至记忆库，供后续对话自动召回。",
      permissionLevel: "read",
      parameters: {
        type: "object",
        properties: {
          content: { type: "string", description: "简明清晰的事实或偏好描述" },
          scope: { type: "string", enum: ["global", "project"], description: "global 全局或 project 当前项目" },
          tags: { type: "array", items: { type: "string" }, description: "可选标签" },
        },
        required: ["content"],
      },
      execute: async (args, execCtx) => {
        const session = await ctx.memory.getSession(execCtx.sessionId);
        const scope = args.scope === "project" && session?.projectId ? "project" : "global";
        const entry = await ctx.memory.addMemory({
          scope,
          projectId: scope === "project" ? (session?.projectId ?? null) : null,
          content: typeof args.content === "string" ? args.content : "",
          tags: Array.isArray(args.tags) ? args.tags.filter((t): t is string => typeof t === "string") : [],
          sourceSessionId: execCtx.sessionId,
        });
        return {
          ok: true,
          output: `已保存记忆 (${entry.scope}): ${entry.content}`,
          summary: "已写入长期记忆",
        };
      },
    });
  }

  protected stop(): void {
    this.unregisterMemoryTool?.();
    this.unregisterMemoryTool = null;
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
      },
      controller,
      listeners: new Set(),
      pendingApprovals: new Map(),
    };
    this.runs.set(runId, record);

    const emit = (event: AgentRunEvent) => {
      if (event.type === "delta") {
        if (event.kind === "text") record.status.content += event.text;
        else record.status.reasoning += event.text;
      } else if (event.type === "step_update") {
        const idx = record.status.steps.findIndex((s: AgentStepTrace) => s.id === event.step.id);
        if (idx >= 0) record.status.steps[idx] = event.step;
        else record.status.steps.push(event.step);
      }
      for (const listener of record.listeners) {
        listener(event);
      }
    };

    queueMicrotask(() => {
      void (async () => {
        try {
          emit({ type: "run_started", runId, sessionId: session.id, assistantMessageId });
          const result = await executeAgentTaskLoop(
            {
              llm: this.ctx.llm,
              tools: this.ctx.tools,
              memory: this.ctx.memory,
              rules: this.ctx.rules,
            },
            {
              runId,
              sessionId: session.id,
              assistantMessageId,
              userMessage: trimmedInput,
              ...(input.profileId !== undefined ? { profileId: input.profileId } : {}),
              projectId: input.projectId ?? session.projectId,
              workspaceRoots: input.workspaceRoots ?? [],
              maxSteps: input.maxSteps ?? 10,
              autoApproveTools: input.autoApproveTools === true,
              signal: controller.signal,
              emit,
              requestApproval: ({ approvalId, toolName, permissionLevel, argsPreview }) =>
                new Promise<boolean>((resolve) => {
                  record.pendingApprovals.set(approvalId, {
                    approvalId,
                    toolName,
                    permissionLevel,
                    argsPreview,
                    resolve,
                  });
                  const onAbort = () => {
                    record.pendingApprovals.delete(approvalId);
                    resolve(false);
                  };
                  controller.signal.addEventListener("abort", onAbort, { once: true });
                  emit({
                    type: "approval_required",
                    runId,
                    approvalId,
                    toolName,
                    permissionLevel,
                    argsPreview,
                  });
                }),
            },
          );

          record.status.status = "done";
          record.status.content = result.content;
          record.status.reasoning = result.reasoning;
          await this.ctx.memory.updateMessage(session.id, assistantMessageId, {
            content: result.content,
            ...(result.reasoning ? { reasoning: result.reasoning } : {}),
            steps: result.steps,
            status: "done",
            ...(result.model ? { model: result.model } : {}),
          });
          emit({ type: "run_finished", runId, sessionId: session.id, assistantMessageId, status: "done" });
        } catch (error) {
          const aborted = controller.signal.aborted;
          const msg = error instanceof Error ? error.message : String(error);
          const finalStatus = aborted ? "aborted" : "error";
          record.status.status = finalStatus;
          record.status.error = msg;
          const persistedContent = record.status.content.trim()
            || (aborted ? "（任务已手动中止）" : `执行异常：${msg}`);
          await this.ctx.memory.updateMessage(session.id, assistantMessageId, {
            content: persistedContent,
            ...(record.status.reasoning ? { reasoning: record.status.reasoning } : {}),
            steps: record.status.steps,
            status: finalStatus,
          });
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
      ({ approvalId, toolName, permissionLevel, argsPreview }) => ({
        approvalId,
        toolName,
        permissionLevel,
        argsPreview,
      }),
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
      });
    }
    return () => {
      run.listeners.delete(listener);
    };
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
}

export function agentPlugin(context: Context): void {
  new AgentService(context);
}

agentPlugin.inject = ["llm", "tools", "memory", "rules"] as const;

declare module "@deepseek-ai/cordis" {
  interface Context {
    agent: AgentService;
  }
}
