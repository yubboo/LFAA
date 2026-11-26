// 运行收口后的长期记忆沉淀：显式偏好正则与每轮模型提炼并行推进，统一返回追加到轨迹的步骤。
import type { RunLlm } from "@lfaa/agent-profile";
import type { AgentStepTrace, MemoryService } from "@lfaa/memory";
import { extractExplicitMemory } from "./memory-autosave";
import { extractRoundMemories } from "./memory-writer";

export interface RunMemoryInput {
  sessionId: string;
  projectId?: string | null;
  userMessage: string;
  answer: string;
  steps: ReadonlyArray<AgentStepTrace>;
  signal?: AbortSignal;
}

/** 用户明确陈述的偏好/约定在模型未主动保存时自动写入长期记忆，并在轨迹中留痕。 */
async function sedimentExplicitMemory(
  memory: MemoryService,
  input: RunMemoryInput,
  steps: AgentStepTrace[],
): Promise<AgentStepTrace | null> {
  const content = extractExplicitMemory(input.userMessage);
  if (!content) return null;
  if (steps.some((step) => step.toolName === "save_memory" && step.status === "done")) return null;
  const scope = input.projectId ? "project" : "global";
  try {
    await memory.addMemory({
      scope,
      ...(input.projectId ? { projectId: input.projectId } : {}),
      content,
      tags: ["auto"],
      sourceSessionId: input.sessionId,
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

/**
 * 收口时落一次长期记忆：先按显式偏好正则兜底，再用模型提炼结构化记忆。
 * 两条路径互不影响，任一失败都只丢对应步骤，不打断运行收口。
 */
export async function settleRunMemories(
  deps: { memory: MemoryService; llm: RunLlm },
  input: RunMemoryInput,
): Promise<AgentStepTrace[]> {
  const autoMemory = await sedimentExplicitMemory(deps.memory, input, [...input.steps]);
  const extracted = await extractRoundMemories(deps.memory, deps.llm, {
    sessionId: input.sessionId,
    ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
    userMessage: input.userMessage,
    answer: input.answer,
    steps: input.steps,
    ...(input.signal ? { signal: input.signal } : {}),
  }).catch(() => null);
  return [autoMemory, extracted].filter((step): step is AgentStepTrace => step !== null);
}