// Agent 运行启动器：校验会话与授权根、落盘用户/助手消息、登记运行记录并把执行循环交给 agent-loop。
import { randomUUID } from "node:crypto";
import {
  buildRunSummaryEntry,
  collectStepDigest,
  formatHistoryDigest,
  rollSessionSummary,
  type AgentStepTrace,
  type MemoryService,
} from "@lfaa/memory";
import { executeAgentTaskLoop } from "./agent-loop";
import { ensureProjectGitRepo } from "./project-git";
import { extractExplicitMemory } from "./memory-autosave";
import { normalizePermissionMode } from "./permission-policy";
import { resolveStepBudget } from "./step-budget";
import type { ActiveRunRecord } from "./run-records";
import type { RunLoopDeps } from "./run-types";
import type { AgentRunEvent, ApprovalAnswer, ResolvedSkillContext, StartAgentRunInput } from "./types";
import type { RunChunkRecord } from "./stream-journal";

export type SkillResolver = (skillIds: string[], projectRoots: string[]) => Promise<ResolvedSkillContext[]>;
export type SkillCatalogProvider = (
  projectRoots: string[],
) => Promise<Array<{ id: string; name: string; source: string; description: string }>>;

export interface BeginRunDeps extends RunLoopDeps {
  skillResolver: SkillResolver | null;
  skillCatalogProvider: SkillCatalogProvider | null;
  /** 把新运行登记到服务层运行表并计数。 */
  onRunCreated: (record: ActiveRunRecord) => void;
}

// 用户明确陈述的偏好/约定在模型未主动保存时自动写入长期记忆，并在轨迹中留痕。
async function sedimentExplicitMemory(
  memory: MemoryService,
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
    await memory.addMemory({
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

/** 启动一次运行：校验、落盘、登记运行记录，然后在微任务里驱动执行循环并收口结果。 */
export async function beginAgentRun(
  deps: BeginRunDeps,
  input: StartAgentRunInput,
  resolveRoots?: (projectId: string | null) => Promise<string[]>,
): Promise<{ runId: string; sessionId: string; assistantMessageId: string }> {
  const session = await deps.memory.getSession(input.sessionId);
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
  // 旧会话没有已确认组合，沿用历史能力；新会话按已保存的组合执行。
  const modules = session.sessionModules ? new Set(session.sessionModules) : undefined;
  const tools = modules ? deps.tools.scope(modules, session.sessionPreset === "minimal") : deps.tools;
  const skillsAllowed = !modules || modules.has("@lfaa/skills");
  const memoryAllowed = !modules || modules.has("@lfaa/memory");
  if (!skillsAllowed && input.skillIds?.length) throw new Error("当前会话模式不支持技能。");
  const resolvedSkills = skillsAllowed && input.skillIds && input.skillIds.length > 0 && deps.skillResolver
    ? await deps.skillResolver(input.skillIds, workspaceRoots)
    : [];
  const availableSkillCatalog = skillsAllowed && deps.skillCatalogProvider
    ? await deps.skillCatalogProvider(workspaceRoots).catch(() => [])
    : [];

  await deps.memory.appendMessage(session.id, {
    id: userMessageId,
    role: "user",
    content: trimmedInput,
    createdAt: Date.now(),
  });
  const runStartedAt = Date.now();
  await deps.memory.appendMessage(session.id, {
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
  deps.onRunCreated(record);

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
        deps.memory.updateMessage(session.id, assistantMessageId, {
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
      record.chunks.push({ seq, kind: rawEvent.kind, text: rawEvent.text, ts: Date.now() } satisfies RunChunkRecord);
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
        let gitPrepared = false;
        const beforeWorkspaceMutation = async () => {
          if (!primaryProjectRoot || gitPrepared) return;
          gitPrepared = true;
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
        };
        const result = await executeAgentTaskLoop(
          {
            llm: deps.llm,
            tools,
            memory: deps.memory,
            rules: deps.rules,
            trustStore: deps.trustStore,
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
            enableClarification: true,
            beforeWorkspaceMutation,
            enableMemoryContext: memoryAllowed,
            ...(resolvedSkills.length > 0 ? { resolvedSkills } : {}),
            ...(availableSkillCatalog.length > 0 ? { availableSkillCatalog } : {}),
            maxSteps: stepBudget.budget,
            ...(autoExtendSteps > 0 ? { autoExtendSteps } : {}),
            ...(input.repeatToolThresholds !== undefined ? { repeatToolThresholds: input.repeatToolThresholds } : {}),
            getPermissionMode: () => record.permissionMode,
            signal: controller.signal,
            emit,
            requestApproval: (req, signal = controller.signal) =>
              new Promise<ApprovalAnswer>((resolve) => {
                if (controller.signal.aborted || signal.aborted) { resolve(false); return; }
                const onAbort = () => settle(false);
                const settle = (answer: ApprovalAnswer) => {
                  if (!record.pendingApprovals.delete(req.approvalId)) return;
                  signal.removeEventListener("abort", onAbort);
                  emit({ type: "approval_resolved", runId, approvalId: req.approvalId });
                  resolve(answer);
                };
                record.pendingApprovals.set(req.approvalId, { ...req, resolve: settle });
                signal.addEventListener("abort", onAbort, { once: true });
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

        // 同步关闭仍存活的子任务，在保存父消息之前记录真实停止状态。
        controller.abort();
        const runDurationMs = Date.now() - runStartedAt;
        await record.persistChain;
        // 用户明确陈述的偏好/约定在模型未主动保存时自动沉淀，避免“记忆”只写不读或只读不写。
        const autoMemory = memoryAllowed && !result.clarification
          ? await sedimentExplicitMemory(deps.memory, session.id, projectId, trimmedInput, result.steps)
          : null;
        const resultSteps = autoMemory ? [...result.steps, autoMemory] : result.steps;
        const saved = await deps.memory.updateMessage(session.id, assistantMessageId, {
          content: result.content,
          ...(result.progressText ? { progressText: result.progressText } : {}),
          ...(result.reasoning ? { reasoning: result.reasoning } : {}),
          runDurationMs,
          steps: gitStep ? [gitStep, ...resultSteps] : resultSteps,
          status: "done",
          ...(result.clarification ? { clarification: result.clarification } : {}),
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
        await deps.memory.updateSession(session.id, {
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
        controller.abort();
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
        const saved = await deps.memory.updateMessage(session.id, assistantMessageId, {
          content: persistedContent,
          ...(progressText ? { progressText } : {}),
          ...(record.status.reasoning ? { reasoning: record.status.reasoning } : {}),
          runDurationMs: finishedAt - runStartedAt,
          steps,
          status: finalStatus,
        });
        if (!aborted) {
          await deps.memory.updateSession(session.id, { unread: true });
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
      } finally {
        // 父运行结束后停止仍在运行的子任务，避免留下无人接收结果的执行。
        controller.abort();
      }
    })();
  });

  return { runId, sessionId: session.id, assistantMessageId };
}