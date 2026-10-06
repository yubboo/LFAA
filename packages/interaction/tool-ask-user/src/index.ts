/**
 * 功能：提供向当前用户询问关键缺失信息的 Agent 工具插件。
 * 作用：通过既有 Agent Run 问题通道等待回答，并由 Cordis 工具注册表管理启停与卸载。
 * 不负责：问题持久化、账户认证、权限审批和界面呈现；这些仍归现有 Run、Session、权限与客户端 Owner。
 * 关联文件：packages/core/tools/src/business-tools.ts、packages/core/agent-loop/src/execute-turn.ts、packages/core/agent-loop/src/runs.ts。
 */
import type { Context } from "@deepseek-ai/cordis";
import type { AiBusinessTool } from "lfaa-tools/src/business-tools.js";
import { APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";

function parseQuestion(value: unknown): { question: string; options: string[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("问题参数无效：参数必须是对象。");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 2 || !Object.hasOwn(record, "question") || !Object.hasOwn(record, "options")) {
    throw new Error("问题参数无效：只接受 question 和 options 两个字段。");
  }
  const question = typeof record.question === "string" ? record.question.trim() : "";
  const options = Array.isArray(record.options) ? record.options.map(option => typeof option === "string" ? option.trim() : "") : [];
  if (!question || question.length > 1200 || options.length < 2 || options.length > 4 || options.some(option => !option || option.length > 200)) {
    throw new Error("问题参数无效：问题须为 1 至 1200 字，并提供 2 至 4 个各不超过 200 字的选项。");
  }
  return { question, options };
}

/** 只在当前 Run 已绑定问题通道时开放，调用结果由原模型循环接收。 */
export const askUserTool: AiBusinessTool = {
  id: "interaction.ask-user",
  name: "lfaa_ask_user",
  coreManaged: true,
  description: "当缺少的信息会实质影响目标、操作范围、安全或结果时，向用户提出一个简洁问题并给出 2 到 4 个互斥选项。此工具会暂停当前任务直到用户选择、补充或跳过；普通可逆实现细节可自行判断。",
  applicationIds: [...APPLICATION_IDS],
  schema: {
    type: "object",
    properties: {
      question: { type: "string", minLength: 1, maxLength: 1200 },
      options: { type: "array", minItems: 2, maxItems: 4, items: { type: "string", minLength: 1, maxLength: 200 } }
    },
    required: ["question", "options"],
    additionalProperties: false
  },
  requiresQuestionChannel: true,
  activityKind: "question",
  activityTitle: "需要你补充信息",
  risk: () => "read",
  approval: () => ({ scopeKey: "read-only", scopeSummary: "用户交互", summary: "等待用户回答 Agent 问题" }),
  parse(value) {
    return parseQuestion(value);
  },
  async execute(parameters, context) {
    if (!context.askUser) throw new Error("当前 Agent Run 未提供用户问题通道，已拒绝等待或伪造回答。");
    return context.askUser(String(parameters.question), parameters.options as string[]);
  }
};

declare module "@deepseek-ai/cordis" {
  interface Context {
    lfaaTools: typeof import("lfaa-tools/src/business-tools.js") & { registerTool: typeof import("lfaa-tools/src/registry.js").registerAiBusinessTool };
  }
}

export const name = "lfaaToolAskUser";
export const inject = ["lfaaTools"];

/** 插件卸载时由工具注册表撤销能力登记。 */
export function apply(ctx: Context): void {
  ctx.lfaaTools.registerTool(ctx, askUserTool);
}
