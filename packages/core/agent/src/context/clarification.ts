// 主 Agent 的澄清协议：模型提出问题后结束本次运行，等用户以新消息回答。
import type { UserClarification } from "@lfaa/memory";

export const clarificationTool = {
  name: "ask_user",
  description:
    "仅在缺少关键信息会实质性改变实施方向、且无法从对话上下文合理推断时，向用户提 1 个聚焦问题（调用后立即结束本轮）。严禁在以下情况调用：用户用序号或简短词回复你上一轮刚列出的编号事项/方案/建议（如「1」「2」「第1个」「都做」「好」「继续」「改吧」），此类回复意图明确，必须直接动手执行而不得反问确认。",
  parameters: {
    type: "object",
    properties: {
      question: { type: "string", description: "与用户语言一致的简短聚焦问题" },
      options: { type: "array", items: { type: "string" }, description: "最多 4 个互斥的具体选项（可选）" },
    },
    required: ["question"],
    additionalProperties: false,
  },
};

export function readClarification(json: string): UserClarification | undefined {
  try {
    const raw = JSON.parse(json) as { question?: unknown; options?: unknown } | null;
    if (typeof raw?.question !== "string" || !raw.question.trim()) return undefined;
    const options = Array.isArray(raw.options)
      ? [...new Set(raw.options.filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, 160)).filter(Boolean))].slice(0, 4)
      : [];
    return { question: raw.question.trim().slice(0, 600), options };
  } catch {
    return undefined;
  }
}
