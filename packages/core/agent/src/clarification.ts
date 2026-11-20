// 主 Agent 的澄清协议：模型提出问题后结束本次运行，等用户以新消息回答。
import type { UserClarification } from "@lfaa/memory";

export const clarificationTool = {
  name: "ask_user",
  description: "Ask one focused question when missing information would materially change the goal, target, scope, or a consequential action. Ends the turn before any other tools in the same batch execute.",
  parameters: {
    type: "object",
    properties: {
      question: { type: "string", description: "A short question in the user's language" },
      options: { type: "array", items: { type: "string" }, description: "Up to four distinct possible answers, if useful" },
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
