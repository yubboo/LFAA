// crew 串行执行器：按任务拓扑序接力子智能体，交接前验收，结束后归档运行期记忆。
import { randomUUID } from "node:crypto";
import type { MemoryService } from "@lfaa/memory";
import { buildGuardrail, checkDelivery } from "./guardrail";
import { dependencyIds, orderTasks } from "./task-graph";
import type { CrewRunResult, CrewRunSpec, CrewTaskResult, CrewTaskSpec } from "./types";

/** 执行一个任务所需的最小入参；由上层注入具体实现（子智能体 / 测试假件）。 */
export interface CrewTaskInvocation {
  taskId: string;
  title: string;
  role: string;
  prompt: string;
  maxSteps: number;
}

/** 执行器依赖：记忆服务与任务执行函数都由调用方注入，便于单测。 */
export interface CrewRunnerDeps {
  memory: Pick<MemoryService, "addMemory" | "archiveRunMemories">;
  runTask: (invocation: CrewTaskInvocation) => Promise<{ subagentId?: string; output: string }>;
  sessionId: string;
  signal?: AbortSignal;
  onTaskUpdate?: (result: CrewTaskResult) => void;
  now?: () => number;
}

/** 单任务默认步数上限；任务可覆盖。 */
const DEFAULT_TASK_STEPS = 20;
/** 验收失败后的重试次数：只重试一次，避免无限循环烧 token。 */
const RETRY_LIMIT = 1;

/** 组装任务提示：目标 + 交付要求 + 只读约束 + 上游已验收输出。 */
export function buildTaskPrompt(
  spec: CrewRunSpec,
  task: CrewTaskSpec,
  upstream: ReadonlyArray<{ taskId: string; output: string }>,
): string {
  const lines = [
    `你是「${task.title ?? task.id}」，在多智能体流水线里负责一个任务。`,
    "",
    `用户目标：${spec.goal}`,
    `任务：${task.description}`,
    `交付要求：${task.expectedOutput}`,
  ];
  if (upstream.length > 0) {
    lines.push("", "上游交付（只依据以下内容，不要编造未提供的事实）：");
    for (const item of upstream) {
      lines.push(`### ${item.taskId}`, item.output);
    }
  }
  lines.push(
    "",
    "约束：只读执行，不修改文件、不派发子智能体；直接给出交付物，不要寒暄，也不要复述任务描述。",
  );
  return lines.join("\n");
}

/** 执行一次 crew：校验→按序执行→验收→归档；任务级异常收敛为失败结果，非法任务图直接抛错。 */
export async function runCrew(deps: CrewRunnerDeps, spec: CrewRunSpec): Promise<CrewRunResult> {
  const now = deps.now ?? (() => Date.now());
  const runId = `crew-${randomUUID().slice(0, 8)}`;
  const ordered = orderTasks(spec.tasks);
  const results = new Map<string, CrewTaskResult>();

  for (const task of ordered) {
    const startedAt = now();
    if (deps.signal?.aborted) {
      const skipped = skip(task, startedAt, "运行已中止");
      results.set(task.id, skipped);
      deps.onTaskUpdate?.(skipped);
      continue;
    }

    const upstream = dependencyIds(task)
      .map((id) => results.get(id))
      .filter((item): item is CrewTaskResult => Boolean(item && item.status === "done"))
      .map((item) => ({ taskId: item.taskId, output: item.output }));
    const blocked = dependencyIds(task).some((id) => results.get(id)?.status !== "done");
    if (blocked) {
      const skipped = skip(task, startedAt, "上游任务未通过验收");
      results.set(task.id, skipped);
      deps.onTaskUpdate?.(skipped);
      continue;
    }

    const title = task.title ?? task.id;
    const role = `任务 · ${title}`;
    const guardrail = buildGuardrail(task.expectedOutput);
    let prompt = buildTaskPrompt(spec, task, upstream);
    let result: CrewTaskResult | null = null;

    for (let attempt = 0; attempt <= RETRY_LIMIT; attempt += 1) {
      let output = "";
      let subagentId: string | undefined;
      try {
        const invocation = await deps.runTask({
          taskId: task.id,
          title,
          role,
          prompt,
          maxSteps: task.maxSteps ?? DEFAULT_TASK_STEPS,
        });
        output = invocation.output.trim();
        subagentId = invocation.subagentId;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        result = {
          taskId: task.id,
          title,
          status: "failed",
          output: "",
          validation: { ok: false, reason, attempts: attempt + 1 },
          startedAt,
          endedAt: now(),
        };
        if (attempt >= RETRY_LIMIT) break;
        prompt = `${prompt}\n\n上一次执行失败：${reason}。请重试并直接给出交付物。`;
        continue;
      }

      const validation = checkDelivery(output, guardrail);
      result = {
        taskId: task.id,
        title,
        status: validation.ok ? "done" : "failed",
        output,
        validation: { ...validation, attempts: attempt + 1 },
        startedAt,
        endedAt: now(),
        ...(subagentId ? { subagentId } : {}),
      };
      if (validation.ok) break;
      if (attempt < RETRY_LIMIT) {
        prompt = `${prompt}\n\n上一次交付未通过校验：${validation.reason ?? "不符合交付要求"}。请补齐后重新交付。`;
      }
    }

    const settled = result ?? skip(task, startedAt, "任务未产生结果");
    results.set(task.id, settled);
    deps.onTaskUpdate?.(settled);
    if (settled.status === "done" && settled.output) {
      await deps.memory.addMemory({
        kind: "fact",
        scope: "run",
        ownerId: runId,
        agentId: `task:${task.id}`,
        content: `[${task.id}] ${settled.output}`.slice(0, 400),
        tags: ["crew"],
        confidence: 0.7,
        source: { sessionId: deps.sessionId, runId },
      }).catch(() => undefined);
    }
  }

  await deps.memory.archiveRunMemories(runId, deps.sessionId).catch(() => 0);
  const tasks = ordered.map((task) => results.get(task.id)).filter((item): item is CrewTaskResult => Boolean(item));
  const finalTask = [...tasks].reverse().find((item) => item.status === "done");
  return {
    runId,
    goal: spec.goal,
    ok: tasks.length > 0 && tasks.every((item) => item.status === "done"),
    tasks,
    finalOutput: finalTask?.output ?? "",
  };
}

/** 构造一个未执行的结果，状态统一为 skipped。 */
function skip(task: CrewTaskSpec, startedAt: number, reason: string): CrewTaskResult {
  return {
    taskId: task.id,
    title: task.title ?? task.id,
    status: "skipped",
    output: "",
    validation: { ok: false, reason, attempts: 0 },
    startedAt,
    endedAt: startedAt,
  };
}