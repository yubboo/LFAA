// 每轮运行收口时的长期记忆提炼器：把本轮结论、决策与踩坑压成结构化记忆，做去重与冲突替代后写入。
import type { RunLlm } from "@lfaa/agent-profile";
import type { AgentStepTrace, MemoryKind, MemoryService } from "@lfaa/memory";

/** 单轮最多沉淀几条记忆，避免把对话流水账整段搬进记忆库。 */
const MAX_CANDIDATES = 3;
/** 单条记忆正文上限，与人工写入的约定保持一致。 */
const MAX_CONTENT_CHARS = 200;
/** 提炼调用的超时时间：超时直接放弃本轮提炼，不阻塞收口。 */
const EXTRACT_TIMEOUT_MS = 8000;
/** 用户消息过短且没有工具调用时跳过提炼，省掉一次无意义的小模型调用。 */
const MIN_USER_MESSAGE_CHARS = 40;

const KINDS: readonly MemoryKind[] = ["preference", "fact", "decision", "pitfall", "convention"];

/** 提炼出的候选记忆，字段与 addMemory 的输入对齐。 */
export interface MemoryCandidate {
  kind: MemoryKind;
  content: string;
  tags: string[];
  confidence: number;
}

/** 提炼输入：本轮用户消息、最终答复、工具轨迹与作用域。 */
export interface ExtractMemoryInput {
  sessionId: string;
  projectId?: string | null;
  userMessage: string;
  answer: string;
  steps: ReadonlyArray<AgentStepTrace>;
  signal?: AbortSignal;
}

const SYSTEM_PROMPT = [
  "你是 LFAA 的长期记忆提炼器。只输出 JSON 数组，不要输出解释、前言或代码块围栏。",
  "从这一轮对话里提炼值得跨会话保留的记忆，最多 3 条；没有值得记的就输出 []。",
  "每条格式：{\"kind\":\"preference|fact|decision|pitfall|convention\",\"content\":\"一句话\",\"tags\":[\"短标签\"],\"confidence\":0.0-1.0}",
  "只记：用户偏好与约定、项目决策与理由、反复会踩的坑、稳定事实（技术栈、路径约定、接口约定）。",
  "严禁记录：本次任务的进度或中间结果、一次性命令输出、临时文件路径、密钥与凭据、模型猜测、下一步计划。",
  "content 必须能独立复述，不超过 80 字，不要写成对话口吻，不要包含「用户说」「本轮」等指代。",
].join("\n");

/** 容错解析：允许模型在 JSON 前后夹带解释文字，只截取首个数组。 */
export function parseMemoryCandidates(raw: string): MemoryCandidate[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const candidates: MemoryCandidate[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const content = typeof record.content === "string" ? record.content.trim().slice(0, MAX_CONTENT_CHARS) : "";
    if (content.length < 4) continue;
    const kind = KINDS.find((value) => value === record.kind) ?? "fact";
    const tags = Array.isArray(record.tags)
      ? record.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0).slice(0, 4)
      : [];
    const confidence = typeof record.confidence === "number" && Number.isFinite(record.confidence)
      ? Math.min(1, Math.max(0, record.confidence))
      : 0.7;
    candidates.push({ kind, content, tags, confidence });
    if (candidates.length >= MAX_CANDIDATES) break;
  }
  return candidates;
}

/** 把工具轨迹压成几行摘要，让提炼器知道本轮实际发生了什么。 */
function summarizeSteps(steps: ReadonlyArray<AgentStepTrace>): string {
  return steps
    .filter((step) => step.toolName && step.status === "done")
    .slice(-6)
    .map((step) => `- ${step.toolName}: ${step.title}${step.detail ? `（${step.detail.slice(0, 120)}）` : ""}`)
    .join("\n");
}

/** 调用模型提炼一条候选数组；超时或失败返回空数组。 */
async function requestCandidates(llm: RunLlm, input: ExtractMemoryInput): Promise<MemoryCandidate[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EXTRACT_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  input.signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const stepDigest = summarizeSteps(input.steps);
    const output = await llm.complete({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            `用户消息：${input.userMessage.slice(0, 1200)}`,
            `助手答复：${input.answer.slice(0, 1600)}`,
            stepDigest ? `工具轨迹：\n${stepDigest}` : "工具轨迹：无",
          ].join("\n\n"),
        },
      ],
      maxTokens: 400,
      temperature: 0.1,
      signal: controller.signal,
    });
    return parseMemoryCandidates(output.content);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
    input.signal?.removeEventListener("abort", onAbort);
  }
}

/**
 * 提炼并写入本轮记忆：返回一条用户可见的轨迹步骤，未提炼出内容或失败时返回 null。
 * 该函数不抛异常，调用方不必包 try/catch，也不会阻塞运行收口。
 */
export async function extractRoundMemories(
  memory: MemoryService,
  llm: RunLlm,
  input: ExtractMemoryInput,
): Promise<AgentStepTrace | null> {
  const settings = await memory.getMemorySettings().catch(() => null);
  if (settings && !settings.autoExtract) return null;
  if (input.userMessage.trim().length < MIN_USER_MESSAGE_CHARS && input.steps.length === 0) return null;
  if (input.answer.trim().length < 20) return null;

  const candidates = await requestCandidates(llm, input);
  if (candidates.length === 0) return null;

  const scope = input.projectId ? "project" : "global";
  const saved: string[] = [];
  for (const candidate of candidates) {
    try {
      await memory.addMemory({
        kind: candidate.kind,
        scope,
        ...(input.projectId ? { projectId: input.projectId } : {}),
        agentId: "main",
        content: candidate.content,
        tags: [...candidate.tags, "auto"],
        confidence: candidate.confidence,
        source: { sessionId: input.sessionId },
      });
      saved.push(candidate.content);
    } catch {
      // 单条写入失败不影响其它候选，也不阻塞收口。
    }
  }
  if (saved.length === 0) return null;
  return {
    id: "memory-extract",
    iteration: input.steps.reduce((max, step) => Math.max(max, step.iteration), 0) + 1,
    phase: "act",
    status: "done",
    title: "已自动提炼长期记忆",
    detail: saved.join("；").slice(0, 200),
    toolName: "save_memory",
    permissionLevel: "read",
    timestamp: Date.now(),
  };
}