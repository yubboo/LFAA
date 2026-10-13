/**
 * 功能：提供把自包含子任务委派给子代理的模型工具。
 * 作用：模型选择驱动（默认进程内 LFAA 子 Agent，可选已登记的外部 CLI 驱动），前台等待其终态并回传结果。
 * 边界：委派本身不扩大权限；子任务执行仍走 LFAA 自身权限/审批。父运行取消会级联取消子任务。
 * 关联文件：subagent/manager.ts、subagent-in-process-driver、subagent-claude-code、subagent-codex。
 */
import type { Context } from "@deepseek-ai/cordis";
import type { AiBusinessTool } from "lfaa-tools/src/business-tools.js";
import { APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";
import { assertModelId } from "./invariant.js";
import { listAiAccounts, getUserSettings } from "lfaa-settings/src/service.js";
import { config } from "lfaa-launch-environment/src/config.js";
import { createHash } from "node:crypto";

function parseDelegation(value: unknown): { driver: string; description: string; prompt: string; model?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("委派参数必须是对象。");
  const record = value as Record<string, unknown>;
  const description = typeof record.description === "string" ? record.description.trim() : "";
  const prompt = typeof record.prompt === "string" ? record.prompt.trim() : "";
  const driver = typeof record.driver === "string" && record.driver.trim() ? record.driver.trim() : "in-process";
  const model = record.model === undefined ? undefined : String(record.model).trim();
  if (description.length < 1 || description.length > 120) throw new Error("description 为必填的 1-120 字简短任务标签。");
  if (prompt.length < 1 || prompt.length > 16_000) throw new Error("prompt 为必填的 1-16000 字自包含任务说明。");
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/u.test(driver)) throw new Error("driver 名称格式无效。");
  if (model !== undefined && model) assertModelId(model);
  return { driver, description, prompt, ...model ? { model } : {} };
}

export const name = "lfaaToolSubagent";
export const inject = ["lfaaTools", "lfaaSubagents"];

export function apply(ctx: Context): void {
  const tool: AiBusinessTool = {
    id: "subagent.delegate",
    name: "lfaa_delegate_subagent",
    description: "把一个自包含、边界清晰的子任务委派给独立子 Agent 在其自身上下文中执行（研究、有界实现、专项分析），避免占用主会话上下文。子 Agent 不共享本对话历史，因此 prompt 必须包含它完成任务所需的全部信息。默认使用进程内子 Agent；进程内可用 model 指定当前账户已保存的模型账户 ID 或唯一 provider/model；先用 lfaa_list_subagent_models 查询。外部 CLI 使用其自身模型配置。你只收到其最终结果，不包含中间步骤。",
    applicationIds: [...APPLICATION_IDS],
    createsSubagent: true,
    schema: {
      type: "object",
      properties: {
        description: { type: "string", minLength: 1, maxLength: 120 },
        prompt: { type: "string", minLength: 1, maxLength: 16000 },
        driver: { type: "string", maxLength: 41, description: "可选驱动名；省略时使用进程内子 Agent。" },
        model: { type: "string", maxLength: 300, description: "当前账户保存的模型账户 ID 或唯一 provider/model，实际用于子 Run。" }
      },
      required: ["description", "prompt"],
      additionalProperties: false
    },
    // 委派动作本身不直接读写用户数据；子任务内部的写/危险操作仍由 LFAA 权限系统逐项审批。
    risk: parameters => parameters.driver === "in-process" ? "read" : "dangerous",
    approval: parameters => ({ scopeKey: `subagent:${createHash("sha256").update(JSON.stringify([parameters.driver, parameters.prompt])).digest("hex")}`, scopeSummary: `子 Agent · ${parameters.driver}`, summary: "启动独立 CLI 执行子任务" }),
    parse: parseDelegation,
    async execute(parameters, context) {
      const { driver, description, prompt, model } = parameters as { driver: string; description: string; prompt: string; model?: string };
      if (!context.delegateSubagent) throw new Error("当前运行缺少父 Run 委派入口。");
      const accounts = listAiAccounts(context.userId);
      const matches = model ? accounts.filter(account => account.id === model || `${account.providerId}/${account.modelId}` === model) : [];
      if (model && matches.length !== 1) throw new Error("指定模型必须唯一匹配当前账户已保存的模型账户；请查询模型目录或在设置中心配置。");
      if (driver !== "in-process" && (!config.localHostExecution || !context.externalDelegationAllowed || getUserSettings(context.userId).permissions.mode !== "full_access" || model)) {
        throw new Error("外部 CLI 仅在本机完全权限下执行，模型由其自身配置负责；受限任务使用进程内驱动继承 LFAA 权限。");
      }
      return context.delegateSubagent({ task: prompt, ...(matches[0] ? { modelAccountId: matches[0].id } : {}) }, async startChild => {
      const handle = ctx.lfaaSubagents.start(
        { driver, description, prompt, appId: context.applicationId },
        { userId: context.userId, userRole: context.userRole, signal: context.signal, onProgress: context.onProgress, startChild }
      );
      const result = await handle.done;
      return {
        status: result.stopReason === "completed" ? "complete" : result.stopReason,
        runId: result.runId,
        driver,
        ...(model ? { requestedModel: model } : {}),
        stopReason: result.stopReason,
        answer: result.answer,
        ...(result.diagnostic ? { diagnostic: result.diagnostic } : {})
      };
      });
    }
  };
  ctx.lfaaTools.registerTool(ctx, tool);
  ctx.lfaaTools.registerTool(ctx, {
    id: "subagent.list-models", name: "lfaa_list_subagent_models", applicationIds: [...APPLICATION_IDS],
    description: "列出当前用户已保存的子 Agent 模型账户和已注册驱动，只返回模型元数据，不返回密钥。委派可将 accountId 原样传给 model。",
    schema: { type: "object", properties: {}, additionalProperties: false },
    parse(value) { if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length) throw new Error("模型目录参数必须为空对象。"); return {}; },
    risk: () => "read", approval: () => ({ scopeKey: "subagent-models", scopeSummary: "模型目录", summary: "查询子 Agent 模型" }),
    async execute(_parameters, context) {
      return { models: listAiAccounts(context.userId).map(account => ({ accountId: account.id, provider: account.providerId, model: account.modelId, displayName: account.displayName })), drivers: ctx.lfaaSubagents.listDrivers() };
    }
  });
}
