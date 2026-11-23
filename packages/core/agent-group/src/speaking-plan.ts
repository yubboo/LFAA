// @lfaa/agent-group 发言计划：代理人产出的「本轮谁发言、各自干什么」的严格契约与校验。
// 计划必须是 JSON；校验失败即整份作废（由编排层降级为代理人单答），绝不静默改计划。
export interface SpeakingPlanSpeaker {
  agentId: string;
  /** 必须具体到一件事；空任务的人不出场，这是群聊不变成互相客套的关键。 */
  task: string;
  /** 期望产出，供成员自检；可选。 */
  expect?: string;
}

export interface SpeakingPlan {
  speakers: SpeakingPlanSpeaker[];
  reason?: string;
}

/** 计划作废的原因；界面与日志直接展示，便于用户知道为什么「没按计划来」。 */
export type PlanIssue =
  | "not-json"
  | "empty"
  | "too-many"
  | "unknown-agent"
  | "missing-task"
  | "duplicate-agent";

export interface PlanValidation {
  ok: boolean;
  plan?: SpeakingPlan;
  issues: PlanIssue[];
}

/** 从模型输出里抠出 JSON：允许 ```json 围栏与前后解释文字。 */
export function extractPlanJson(raw: string): unknown {
  const text = raw.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/iu.exec(text);
  const candidate = (fenced?.[1] ?? text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return undefined;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

/** 校验一份计划：成员、任务必填、人数上限、同一人不得重复出场。 */
export function validateSpeakingPlan(
  raw: unknown,
  options: { members: readonly string[]; maxSpeakers: number },
): PlanValidation {
  const issues: PlanIssue[] = [];
  const record = raw as { speakers?: unknown; reason?: unknown } | undefined;
  if (!record || typeof record !== "object" || !Array.isArray(record.speakers)) {
    return { ok: false, issues: ["not-json"] };
  }
  const speakers: SpeakingPlanSpeaker[] = [];
  const seen = new Set<string>();
  for (const item of record.speakers) {
    if (typeof item !== "object" || item === null) continue;
    const entry = item as { agentId?: unknown; task?: unknown; expect?: unknown };
    const agentId = typeof entry.agentId === "string" ? entry.agentId.trim() : "";
    const task = typeof entry.task === "string" ? entry.task.trim() : "";
    if (!agentId || !options.members.includes(agentId)) {
      issues.push("unknown-agent");
      continue;
    }
    if (!task) {
      issues.push("missing-task");
      continue;
    }
    if (seen.has(agentId)) {
      issues.push("duplicate-agent");
      continue;
    }
    seen.add(agentId);
    speakers.push({
      agentId,
      task,
      ...(typeof entry.expect === "string" && entry.expect.trim() ? { expect: entry.expect.trim() } : {}),
    });
  }
  if (speakers.length === 0) issues.push("empty");
  if (speakers.length > options.maxSpeakers) issues.push("too-many");
  if (issues.length > 0) return { ok: false, issues: [...new Set(issues)] };
  return {
    ok: true,
    plan: {
      speakers,
      ...(typeof record.reason === "string" && record.reason.trim() ? { reason: record.reason.trim() } : {}),
    },
    issues: [],
  };
}

/** 给代理人/规划者的调度提示：只返回 JSON，不许解释。 */
export function buildPlanPrompt(input: {
  userMessage: string;
  members: ReadonlyArray<{ id: string; name: string; description?: string }>;
  maxSpeakers: number;
}): string {
  const roster = input.members
    .map((member) => `- ${member.id}（${member.name}）${member.description ? `：${member.description}` : ""}`)
    .join("\n");
  return [
    "你在一个多智能体群聊里担任调度者。请判断用户这条消息需要群里哪些成员出手、按什么顺序、各自负责什么。",
    "只输出一个 JSON 对象，不要任何解释、不要 Markdown 围栏：",
    '{"speakers":[{"agentId":"成员id","task":"具体到一件事","expect":"期望产出"}],"reason":"一句话理由"}',
    `硬性要求：1) agentId 只能取下列成员；2) 每个人必须有具体 task，没有明确职责的人不要列；3) 最多 ${input.maxSpeakers} 位；4) 同一个人只出现一次；5) 无法拆分或只需简单回答时，只列一位。`,
    "",
    "群成员：",
    roster,
    "",
    `用户消息：${input.userMessage}`,
  ].join("\n");
}