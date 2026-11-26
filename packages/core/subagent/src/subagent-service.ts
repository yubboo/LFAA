// 进程内子智能体调度核心：为子智能体创建隔离会话上下文、过滤权限边界与并发限流。
import { randomUUID } from "node:crypto";
import type { Context } from "@deepseek-ai/cordis";
import { executeAgentTaskLoop, SmartTrustStore } from "@lfaa/agent";
import type { ChatMessageRecord, MemoryService } from "@lfaa/memory";
import type { ToolsService, ToolExecutionContext } from "@lfaa/tools";
import type {
  InvokeSubagentInput,
  SubagentKind,
  SubagentMode,
  SubagentPluginConfig,
  SubagentStreamEvent,
  SubagentSummaryItem,
} from "./types";
import {
  buildBrowserSubagentPrompt,
  detectBrowserLabel,
  formatSubagentToolLabel,
  isBrowserSubagentTool,
} from "./browser-subagent";
import { resolveSubagentPreset } from "./subagent-presets";

const SUBAGENT_BLOCKED_TOOLS = new Set(["invoke_subagent", "message_subagent", "list_subagents", "stop_subagent"]);
const DEFAULT_MAX_CONCURRENT = 4;
// 子智能体默认 40 步硬上限；浏览器模式收紧为 15 步，强制按清单定向验证而非逐屏盲扫。
const DEFAULT_MAX_STEPS = 40;
const BROWSER_DEFAULT_MAX_STEPS = 15;

/** 从子智能体思考详情中提取最近一句可读摘要，供前端实时展示思考方向。 */
function summarizeSubagentThought(detail: string | undefined): string {
  const lines = (detail ?? "")
    .split(/\r?\n/u)
    .map((line) => line.replace(/^[-*#>\s]+/u, "").trim())
    .filter((line) => line.length >= 4);
  const latest = lines.at(-1);
  if (!latest) return "思考中";
  const compact = latest.replace(/\s+/gu, " ");
  return compact.length > 56 ? `${compact.slice(0, 55)}…` : compact;
}

interface SubagentRecord {
  item: SubagentSummaryItem;
  workspaceRoots: string[];
  history: ChatMessageRecord[];
  controller: AbortController | null;
  runningPromise: Promise<SubagentSummaryItem> | null;
  listeners: Set<(evt: SubagentStreamEvent) => void>;
  parentSignal?: AbortSignal | undefined;
  parentApproval?: InvokeSubagentInput["parentApproval"];
  parentProfileId?: string | undefined;
  allowsTool?: InvokeSubagentInput["allowsTool"];
  onSubagentActivity?: InvokeSubagentInput["onSubagentActivity"];
}

/** 子智能体写入团队记忆所需的最小身份信息。 */
export interface SubagentMemoryIdentity {
  role: string;
  kind?: SubagentKind;
  sessionId: string;
  parentRunId?: string;
}

/** 把子智能体的结论与失败点写成团队记忆：父级与兄弟子智能体下一轮即可召回，不必等父级转述。 */
export async function persistSubagentMemory(
  memory: MemoryService,
  identity: SubagentMemoryIdentity,
  result: { content: string; steps: ReadonlyArray<{ toolName?: string; status: string; detail?: string; title: string }> },
): Promise<void> {
  const { sessionId } = identity;
  const kindLabel = identity.kind ?? "general";
  const source = { sessionId, ...(identity.parentRunId ? { runId: identity.parentRunId } : {}) };
  const summary = result.content.replace(/\s+/gu, " ").trim();
  if (summary.length >= 20) {
    await memory.addMemory({
      kind: "fact",
      scope: "team",
      ownerId: sessionId,
      agentId: `subagent:${kindLabel}`,
      content: `[子智能体 ${identity.role}] ${summary.slice(0, 200)}`,
      tags: ["subagent", kindLabel],
      confidence: 0.7,
      source,
    }).catch(() => undefined);
  }
  const failure = result.steps.find((step) => step.status === "error" && step.toolName);
  if (!failure) return;
  await memory.addMemory({
    kind: "pitfall",
    scope: "team",
    ownerId: sessionId,
    agentId: `subagent:${kindLabel}`,
    content: `[子智能体 ${identity.role}] 调用 ${failure.toolName} 失败：${(failure.detail ?? failure.title).slice(0, 160)}`,
    tags: ["subagent", "failure", ...(failure.toolName ? [failure.toolName] : [])],
    confidence: 0.6,
    source,
  }).catch(() => undefined);
}

function emitStream(record: SubagentRecord, event: SubagentStreamEvent): void {
  for (const listener of record.listeners) {
    try {
      listener(event);
    } catch {
      // 忽略单个流订阅者的写入异常，避免中断子智能体主循环。
    }
  }
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

/** 构造受限的工具视图：阻断递归派发子智能体，并按只读/读写/浏览器专职模式过滤可用工具。 */
function createScopedToolsView(tools: ToolsService, mode: SubagentMode, parentAllows?: ToolExecutionContext["allowsTool"]): ToolsService {
  const isAllowed = (name: string): boolean => {
    if (SUBAGENT_BLOCKED_TOOLS.has(name) || parentAllows?.(name) === false) return false;
    const def = tools.getTool(name);
    if (!def) return false;
    if (mode === "browser") return isBrowserSubagentTool(name);
    return mode === "write" || def.permissionLevel === "read";
  };

  const view = Object.create(tools) as ToolsService;
  view.getTool = (name) => (isAllowed(name) ? tools.getTool(name) : undefined);
  view.getLlmToolSchemas = () => tools.getLlmToolSchemas().filter((schema) => isAllowed(schema.name));
  view.executeTool = async (name, args, execCtx) => {
    if (!isAllowed(name)) {
      return { ok: false, output: `子智能体当前模式 (${mode}) 不允许调用工具：${name}`, summary: "权限拦截" };
    }
    return tools.executeTool(name, args, { ...execCtx, allowsTool: isAllowed });
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
      if (rec.item.sessionId === sessionId && rec.controller) count += 1;
    }
    return count;
  }

  private runTurn(record: SubagentRecord, userPrompt: string, maxSteps: number): Promise<SubagentSummaryItem> {
    if (record.controller) throw new Error("子智能体已有任务正在运行。");
    const maxConc = this.config.maxConcurrentPerSession ?? DEFAULT_MAX_CONCURRENT;
    if (this.activeCount(record.item.sessionId) >= maxConc) {
      throw new Error(`当前会话并发子智能体已达上限 (${maxConc})，请等待已有子任务完成或停止后再试。`);
    }

    const controller = new AbortController();
    const { id, role } = record.item;
    const kind: SubagentKind = record.item.kind ?? (record.item.mode === "browser" ? "browser" : "general");
    const preset = resolveSubagentPreset(kind, record.item.mode);
    const browserLabel = record.item.browserLabel;
    const baseMeta = {
      id,
      role,
      kind,
      ...(browserLabel ? { browserLabel } : {}),
    };
    const report = record.onSubagentActivity;
    const abortChild = () => controller.abort();
    controller.signal.addEventListener("abort", () => {
      record.item = { ...record.item, status: "stopped", endedAt: Date.now() };
      report?.({ ...baseMeta, status: "stopped" });
      emitStream(record, { type: "run_finished", subagent: record.item, timestamp: Date.now() });
    }, { once: true });
    record.controller = controller;
    const { error: _prevErr, endedAt: _prevEnd, ...prevItem } = record.item;
    record.item = {
      ...prevItem,
      kind,
      status: "running",
      prompt: userPrompt,
      reasoning: "",
      output: "",
      steps: [],
      stepsCount: 0,
      startedAt: Date.now(),
    };
    emitStream(record, { type: "snapshot", subagent: record.item });
    let lastLiveAction = "思考中";
    report?.({ ...baseMeta, status: "running", liveAction: lastLiveAction });
    if (record.parentSignal?.aborted) controller.abort();
    else record.parentSignal?.addEventListener("abort", abortChild, { once: true });

    const isolatedTools = createScopedToolsView(this.ctx.tools, record.item.mode, record.allowsTool);
    const isolatedMemory = createIsolatedMemoryView(this.ctx.memory, record.history);
    const childUserMessage = kind === "browser"
      ? buildBrowserSubagentPrompt(record.item.role, userPrompt, browserLabel ?? "内置浏览器")
      : preset.buildPrompt(record.item.role, userPrompt);

    const browserSvc = kind === "browser"
      ? ((this.ctx as { get?: (name: string) => unknown }).get?.("browser") as { describeTakeoverHint?: (sid: string) => string } | undefined)
      : undefined;
    const task = executeAgentTaskLoop(
      {
        llm: this.ctx.llm,
        tools: isolatedTools,
        memory: isolatedMemory,
        rules: this.ctx.rules,
        trustStore: this.trustStore,
        ...(browserSvc?.describeTakeoverHint
          ? { dynamicSystemHint: () => browserSvc.describeTakeoverHint!(record.item.sessionId) }
          : {}),
      },
      {
        runId: `subrun-${randomUUID().slice(0, 8)}`,
        sessionId: record.item.sessionId,
        assistantMessageId: `submsg-${randomUUID().slice(0, 8)}`,
        userMessage: childUserMessage,
        workspaceRoots: record.workspaceRoots,
        ...(record.parentProfileId ? { profileId: record.parentProfileId } : {}),
        enableMemoryContext: kind !== "browser" && record.allowsTool?.("list_library_assets") !== false,
        maxSteps,
        getPermissionMode: () => {
          if (record.item.mode === "browser") return "full";
          return record.item.mode === "write" ? (record.parentApproval?.getPermissionMode() ?? "ask") : "ask";
        },
        signal: controller.signal,
        emit: (evt) => {
          if (controller.signal.aborted) return;
          if (evt.type === "delta" && evt.text) {
            if (evt.kind === "text") {
              record.item = { ...record.item, output: `${record.item.output}${evt.text}` };
            } else if (evt.kind === "reasoning") {
              record.item = { ...record.item, reasoning: `${record.item.reasoning ?? ""}${evt.text}` };
            }
            emitStream(record, { type: "delta", channel: evt.kind, delta: evt.text, timestamp: Date.now() });
            return;
          }
          if (evt.type === "step_update") {
            const existing = record.item.steps;
            const idx = existing.findIndex((s) => s.id === evt.step.id);
            const steps = idx >= 0
              ? existing.map((s, i) => (i === idx ? evt.step : s))
              : [...existing, evt.step];
            record.item = { ...record.item, steps, stepsCount: steps.length };
            emitStream(record, { type: "step_update", step: evt.step, timestamp: Date.now() });
            const { step } = evt;
            if (step.phase === "think" && (step.status === "running" || step.status === "done")) {
              const thoughtSummary = summarizeSubagentThought(step.detail);
              if (thoughtSummary !== lastLiveAction) {
                lastLiveAction = thoughtSummary;
                report?.({ ...baseMeta, status: "running", liveAction: lastLiveAction });
              }
              return;
            }
            // 同步用户可见的实际工具动作、目标与摘要结果。
            if (step.phase === "act" && step.toolName && existing[idx]?.status !== step.status) {
              const label = formatSubagentToolLabel(step.toolName);
              const target = step.toolTarget?.trim() ? step.toolTarget.trim().slice(0, 140) : undefined;
              lastLiveAction = step.status === "running" ? (target ? `${label} · ${target}` : label) : "思考中";
              report?.({
                ...baseMeta,
                status: "running",
                liveAction: lastLiveAction,
                activity: {
                  id: step.id,
                  name: step.toolName,
                  label,
                  ...(target ? { target } : {}),
                  ...(step.resultSummary ? { resultSummary: step.resultSummary.slice(0, 220) } : {}),
                  ...(step.browserEvidence ? { browserEvidence: step.browserEvidence } : {}),
                  ...(step.browserVerdict ? { browserVerdict: step.browserVerdict } : {}),
                  status: step.status,
                },
              });
            }
          }
        },
        requestApproval: (request) => record.parentApproval?.requestApproval(request, controller.signal) ?? Promise.resolve(false),
      },
    )
      .then(async (result) => {
        controller.signal.throwIfAborted();
        record.history.push(
          { id: randomUUID(), role: "user", content: userPrompt, createdAt: Date.now() },
          { id: randomUUID(), role: "assistant", content: result.content, createdAt: Date.now() },
        );
        await persistSubagentMemory(this.ctx.memory, { role: record.item.role, sessionId: record.item.sessionId, ...(record.item.kind ? { kind: record.item.kind } : {}), ...(record.item.parentRunId ? { parentRunId: record.item.parentRunId } : {}) }, result);
        record.item = {
          ...record.item,
          status: "done",
          output: result.content,
          steps: result.steps,
          stepsCount: result.steps.length,
          endedAt: Date.now(),
        };
        report?.({ ...baseMeta, status: "done", result: result.content });
        emitStream(record, { type: "run_finished", subagent: record.item, timestamp: Date.now() });
        return record.item;
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          const msg = error instanceof Error ? error.message : String(error);
          record.item = { ...record.item, status: "error", error: msg, output: msg, endedAt: Date.now() };
          report?.({ ...baseMeta, status: "error", result: msg });
          emitStream(record, { type: "run_finished", subagent: record.item, timestamp: Date.now() });
        }
        return record.item;
      }).finally(() => {
        record.parentSignal?.removeEventListener("abort", abortChild);
        record.controller = null;
        record.runningPromise = null;
        record.parentSignal = undefined;
        record.parentApproval = undefined;
        record.onSubagentActivity = undefined;
      });

    record.runningPromise = task;
    return task;
  }

  async invoke(input: InvokeSubagentInput): Promise<SubagentSummaryItem> {
    const preset = resolveSubagentPreset(input.kind, input.mode);
    const mode: SubagentMode = preset.mode;
    const kind: SubagentKind = preset.kind;
    const role = input.role.trim() || preset.defaultRole;
    const prompt = input.prompt.trim();
    if (!prompt) throw new Error("子智能体任务描述不能为空。");
    const id = `sub-${randomUUID().slice(0, 8)}`;
    if (mode === "write" && !input.parentApproval) throw new Error("写入子任务缺少父运行审批上下文。");
    const browserLabel = kind === "browser" ? await detectBrowserLabel(this.ctx) : undefined;
    const record: SubagentRecord = {
      item: {
        id,
        sessionId: input.sessionId,
        parentRunId: input.parentRunId,
        role,
        kind,
        ...(browserLabel ? { browserLabel } : {}),
        mode,
        status: "running",
        prompt,
        reasoning: "",
        output: "",
        stepsCount: 0,
        steps: [],
        startedAt: Date.now(),
      },
      workspaceRoots: input.workspaceRoots,
      history: [],
      controller: null,
      runningPromise: null,
      listeners: new Set(),
      parentProfileId: input.parentProfileId,
      allowsTool: input.allowsTool,
      onSubagentActivity: input.onSubagentActivity,
      ...(input.parentSignal ? { parentSignal: input.parentSignal } : {}),
      ...(input.parentApproval ? { parentApproval: input.parentApproval } : {}),
    };
    const defaultBudget = kind === "browser"
      ? BROWSER_DEFAULT_MAX_STEPS
      : (this.config.defaultMaxSteps ?? preset.maxSteps ?? DEFAULT_MAX_STEPS);
    const maxSteps = kind === "browser"
      ? Math.min(input.maxSteps ?? defaultBudget, BROWSER_DEFAULT_MAX_STEPS)
      : (input.maxSteps ?? defaultBudget);
    const promise = this.runTurn(record, prompt, maxSteps);
    this.records.set(id, record);
    return input.wait === false ? record.item : await promise;
  }

  async message(id: string, sessionId: string, prompt: string, wait = true, parent?: ToolExecutionContext): Promise<SubagentSummaryItem> {
    const record = this.records.get(id);
    if (!record || record.item.sessionId !== sessionId) {
      throw new Error(`当前会话找不到子智能体：${id}`);
    }
    if (record.item.status === "running" && record.runningPromise) {
      await record.runningPromise;
    }
    if (record.controller) throw new Error("子智能体正在结算。");
    if (record.item.mode === "write" && !parent?.parentApproval) throw new Error("写入子任务缺少父运行审批上下文。");
    record.parentSignal = parent?.signal;
    record.parentApproval = parent?.parentApproval;
    record.parentProfileId = parent?.parentProfileId;
    record.allowsTool = parent?.allowsTool;
    record.onSubagentActivity = parent?.onSubagentActivity;
    if (parent) record.item = { ...record.item, parentRunId: parent.runId };
    if (parent) record.workspaceRoots = parent.workspaceRoots;
    const trimmed = prompt.trim();
    if (!trimmed) throw new Error("补充任务描述不能为空。");
    const defaultBudget = record.item.kind === "browser"
      ? BROWSER_DEFAULT_MAX_STEPS
      : (this.config.defaultMaxSteps ?? DEFAULT_MAX_STEPS);
    const promise = this.runTurn(record, trimmed, defaultBudget);
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
    }
    return rec.item;
  }

  /** 供右侧标签页底部输入框发起追问（非阻塞，实时输出通过 SSE 推送）。 */
  async messageFromUser(id: string, prompt: string): Promise<SubagentSummaryItem> {
    const record = this.records.get(id);
    if (!record) throw new Error(`找不到子智能体：${id}`);
    if (record.controller) throw new Error("子智能体当前仍在运行，请等待完成或先停止后再追问。");
    const trimmed = prompt.trim();
    if (!trimmed) throw new Error("补充任务描述不能为空。");
    const defaultBudget = record.item.kind === "browser"
      ? BROWSER_DEFAULT_MAX_STEPS
      : (this.config.defaultMaxSteps ?? DEFAULT_MAX_STEPS);
    this.runTurn(record, trimmed, defaultBudget).catch(() => {});
    return record.item;
  }

  subscribe(id: string, listener: (evt: SubagentStreamEvent) => void): () => void {
    const record = this.records.get(id);
    if (!record) return () => {};
    record.listeners.add(listener);
    try {
      listener({ type: "snapshot", subagent: record.item });
    } catch {
      // 忽略首次快照写入异常。
    }
    return () => {
      record.listeners.delete(listener);
    };
  }

  disposeAll(): void {
    for (const rec of this.records.values()) {
      rec.controller?.abort();
      rec.listeners.clear();
    }
    this.records.clear();
  }
}
