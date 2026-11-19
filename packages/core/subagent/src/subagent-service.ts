// 进程内子智能体调度核心：为子智能体创建隔离会话上下文、过滤权限边界与并发限流。
import { randomUUID } from "node:crypto";
import type { Context } from "@deepseek-ai/cordis";
import { executeAgentTaskLoop, SmartTrustStore } from "@lfaa/agent";
import type { ChatMessageRecord, MemoryService } from "@lfaa/memory";
import type { ToolsService } from "@lfaa/tools";
import type { InvokeSubagentInput, SubagentMode, SubagentPluginConfig, SubagentSummaryItem } from "./types";

const SUBAGENT_BLOCKED_TOOLS = new Set(["invoke_subagent", "message_subagent", "list_subagents", "stop_subagent"]);
const DEFAULT_MAX_CONCURRENT = 4;
// 子智能体默认 40 步硬上限：足够覆盖多文件调研与改造，但不参与主任务的自动延长。
const DEFAULT_MAX_STEPS = 40;

interface SubagentRecord {
  item: SubagentSummaryItem;
  workspaceRoots: string[];
  history: ChatMessageRecord[];
  controller: AbortController | null;
  runningPromise: Promise<SubagentSummaryItem> | null;
}

/** 构造隔离的记忆视图：共享长期记忆与资产库，但将对话历史隔离在子智能体私有数组中。 */
function createIsolatedMemoryView(memory: MemoryService, history: ChatMessageRecord[]): MemoryService {
  const view = Object.create(memory) as MemoryService;
  view.buildContextMessages = async (_sessionId, options) => {
    const maxRecent = options?.maxRecentMessages ?? 12;
    return {
      recentMessages: history.slice(-maxRecent),
    };
  };
  return view;
}

/** 构造受限的工具视图：阻断递归派发子智能体，并按只读/读写模式过滤可用工具。 */
function createScopedToolsView(tools: ToolsService, mode: SubagentMode): ToolsService {
  const isAllowed = (name: string): boolean => {
    if (SUBAGENT_BLOCKED_TOOLS.has(name)) return false;
    const def = tools.getTool(name);
    if (!def) return false;
    return mode === "write" || def.permissionLevel === "read";
  };

  const view = Object.create(tools) as ToolsService;
  view.getTool = (name) => (isAllowed(name) ? tools.getTool(name) : undefined);
  view.getLlmToolSchemas = () => tools.getLlmToolSchemas().filter((schema) => isAllowed(schema.name));
  view.executeTool = async (name, args, execCtx) => {
    if (!isAllowed(name)) {
      return { ok: false, output: `子智能体当前模式 (${mode}) 不允许调用工具：${name}`, summary: "权限拦截" };
    }
    return tools.executeTool(name, args, execCtx);
  };
  return view;
}

export class SubagentCoordinator {
  private readonly records = new Map<string, SubagentRecord>();
  private readonly trustStore = new SmartTrustStore();

  constructor(private readonly ctx: Context, private readonly config: SubagentPluginConfig = {}) {}

  private activeCount(sessionId: string): number {
    let count = 0;
    for (const rec of this.records.values()) {
      if (rec.item.sessionId === sessionId && rec.item.status === "running") count += 1;
    }
    return count;
  }

  private runTurn(record: SubagentRecord, userPrompt: string, maxSteps: number): Promise<SubagentSummaryItem> {
    const maxConc = this.config.maxConcurrentPerSession ?? DEFAULT_MAX_CONCURRENT;
    if (this.activeCount(record.item.sessionId) >= maxConc) {
      throw new Error(`当前会话并发子智能体已达上限 (${maxConc})，请等待已有子任务完成或停止后再试。`);
    }

    const controller = new AbortController();
    record.controller = controller;
    const { error: _prevErr, ...prevItem } = record.item;
    record.item = {
      ...prevItem,
      status: "running",
      prompt: userPrompt,
    };

    const isolatedTools = createScopedToolsView(this.ctx.tools, record.item.mode);
    const isolatedMemory = createIsolatedMemoryView(this.ctx.memory, record.history);

    const task = executeAgentTaskLoop(
      {
        llm: this.ctx.llm,
        tools: isolatedTools,
        memory: isolatedMemory,
        rules: this.ctx.rules,
        trustStore: this.trustStore,
      },
      {
        runId: `subrun-${randomUUID().slice(0, 8)}`,
        sessionId: record.item.sessionId,
        assistantMessageId: `submsg-${randomUUID().slice(0, 8)}`,
        userMessage: `[子智能体角色：${record.item.role}]\n${userPrompt}`,
        workspaceRoots: record.workspaceRoots,
        maxSteps,
        getPermissionMode: () => (record.item.mode === "write" ? "full" : "ask"),
        signal: controller.signal,
        emit: (evt) => {
          if (evt.type === "step_update") {
            const existing = record.item.steps;
            const idx = existing.findIndex((s) => s.id === evt.step.id);
            const steps = idx >= 0
              ? existing.map((s, i) => (i === idx ? evt.step : s))
              : [...existing, evt.step];
            record.item = { ...record.item, steps, stepsCount: steps.length };
          }
        },
        requestApproval: async () => record.item.mode === "write",
      },
    )
      .then((result) => {
        record.history.push(
          { id: randomUUID(), role: "user", content: userPrompt, createdAt: Date.now() },
          { id: randomUUID(), role: "assistant", content: result.content, createdAt: Date.now() },
        );
        record.item = {
          ...record.item,
          status: "done",
          output: result.content,
          steps: result.steps,
          stepsCount: result.steps.length,
          endedAt: Date.now(),
        };
        record.controller = null;
        return record.item;
      })
      .catch((error) => {
        const stopped = controller.signal.aborted;
        const msg = error instanceof Error ? error.message : String(error);
        record.item = {
          ...record.item,
          status: stopped ? "stopped" : "error",
          error: msg,
          output: record.item.output || msg,
          endedAt: Date.now(),
        };
        record.controller = null;
        return record.item;
      });

    record.runningPromise = task;
    return task;
  }

  async invoke(input: InvokeSubagentInput): Promise<SubagentSummaryItem> {
    const role = input.role.trim() || "调研助手";
    const prompt = input.prompt.trim();
    if (!prompt) throw new Error("子智能体任务描述不能为空。");
    const id = `sub-${randomUUID().slice(0, 8)}`;
    const mode: SubagentMode = input.mode === "write" ? "write" : "read";
    const record: SubagentRecord = {
      item: {
        id,
        sessionId: input.sessionId,
        role,
        mode,
        status: "running",
        prompt,
        output: "",
        stepsCount: 0,
        steps: [],
        startedAt: Date.now(),
      },
      workspaceRoots: input.workspaceRoots,
      history: [],
      controller: null,
      runningPromise: null,
    };
    this.records.set(id, record);
    const promise = this.runTurn(record, prompt, input.maxSteps ?? this.config.defaultMaxSteps ?? DEFAULT_MAX_STEPS);
    return input.wait === false ? record.item : await promise;
  }

  async message(id: string, sessionId: string, prompt: string, wait = true): Promise<SubagentSummaryItem> {
    const record = this.records.get(id);
    if (!record || record.item.sessionId !== sessionId) {
      throw new Error(`当前会话找不到子智能体：${id}`);
    }
    if (record.item.status === "running" && record.runningPromise) {
      await record.runningPromise;
    }
    const promise = this.runTurn(record, prompt.trim(), this.config.defaultMaxSteps ?? DEFAULT_MAX_STEPS);
    return wait ? await promise : record.item;
  }

  async waitFor(ids: string[], sessionId: string): Promise<SubagentSummaryItem[]> {
    const targets = ids
      .map((id) => this.records.get(id))
      .filter((r): r is SubagentRecord => Boolean(r && r.item.sessionId === sessionId));
    await Promise.all(targets.map((r) => r.runningPromise));
    return targets.map((r) => r.item);
  }

  get(id: string, sessionId?: string): SubagentSummaryItem | null {
    const rec = this.records.get(id);
    if (!rec) return null;
    if (sessionId && rec.item.sessionId !== sessionId) return null;
    return rec.item;
  }

  list(sessionId?: string): SubagentSummaryItem[] {
    return [...this.records.values()]
      .map((r) => r.item)
      .filter((item) => !sessionId || item.sessionId === sessionId)
      .sort((a, b) => b.startedAt - a.startedAt);
  }

  stop(id: string, sessionId?: string): SubagentSummaryItem | null {
    const rec = this.records.get(id);
    if (!rec) return null;
    if (sessionId && rec.item.sessionId !== sessionId) return null;
    if (rec.item.status === "running") {
      rec.controller?.abort();
      rec.item = { ...rec.item, status: "stopped", endedAt: Date.now() };
    }
    return rec.item;
  }

  disposeAll(): void {
    for (const rec of this.records.values()) {
      rec.controller?.abort();
    }
    this.records.clear();
  }
}
