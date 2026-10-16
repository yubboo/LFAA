/**
 * 功能：提供把自包含子任务委派给子代理的模型工具。
 * 作用：模型选择已登记驱动；前台等待终态，进程内后台任务立即返回来源标识并持久化真实结果。
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
import { saveAiSubagentTask, type AiSubagentTaskRecord } from "lfaa-session/src/sessions.js";

function parseDelegation(value: unknown): { driver: string; description: string; prompt: string; mode: "foreground" | "background"; model?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("委派参数必须是对象。");
  const record = value as Record<string, unknown>;
  const description = typeof record.description === "string" ? record.description.trim() : "";
  const prompt = typeof record.prompt === "string" ? record.prompt.trim() : "";
  const driver = typeof record.driver === "string" && record.driver.trim() ? record.driver.trim() : "in-process";
  const model = record.model === undefined ? undefined : String(record.model).trim();
  const mode = record.mode ?? "foreground";
  if (mode !== "foreground" && mode !== "background") throw new Error("mode 只支持 foreground 或 background。");
  if (description.length < 1 || description.length > 120) throw new Error("description 为必填的 1-120 字简短任务标签。");
  if (prompt.length < 1 || prompt.length > 16_000) throw new Error("prompt 为必填的 1-16000 字自包含任务说明。");
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/u.test(driver)) throw new Error("driver 名称格式无效。");
  if (model !== undefined && model) assertModelId(model);
  return { driver, description, prompt, mode, ...model ? { model } : {} };
}

export const name = "lfaaToolSubagent";
export const inject = ["lfaaTools", "lfaaSubagents", "lfaaSessions"];

export function apply(ctx: Context): void {
  const tool: AiBusinessTool = {
    id: "subagent.delegate",
    name: "lfaa_delegate_subagent",
    coreManaged: true,
    description: "委派一个自包含的子任务。prompt 必须写明目标、必要上下文、产物位置和验收要求；子 Agent 不共享父对话历史。foreground 等待结果；background 仅支持进程内驱动，立即返回真实任务标识，主任务正常结束后仍继续，可用 lfaa_get_subagent_result 查询或等待结果。并行修改代码前自行选择不冲突文件或隔离工作树，并核对差异和验证。模型与数量/深度/工具范围继续服从设置中心；model 可指定当前账户保存的模型账户 ID 或唯一 provider/model，先查询 lfaa_list_subagent_models。外部 CLI 使用自身模型配置。",
    applicationIds: [...APPLICATION_IDS],
    createsSubagent: true,
    schema: {
      type: "object",
      properties: {
        description: { type: "string", minLength: 1, maxLength: 120 },
        prompt: { type: "string", minLength: 1, maxLength: 16000 },
        driver: { type: "string", maxLength: 41, description: "可选驱动名；省略时使用进程内子 Agent。" },
        mode: { type: "string", enum: ["foreground", "background"], description: "省略时 foreground；background 返回后可继续独立任务，再回收真实结果。" },
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
      const { driver, description, prompt, mode, model } = parameters as { driver: string; description: string; prompt: string; mode: "foreground" | "background"; model?: string };
      if (!context.delegateSubagent) throw new Error("当前运行缺少父 Run 委派入口。");
      if (!context.sessionId) throw new Error("委派缺少可持久化的父会话来源。");
      if (mode === "background" && driver !== "in-process") throw new Error("此版本后台委派仅支持已接入的进程内驱动；外部 Coding Agent 后台协议尚未验收。");
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
      const record: AiSubagentTaskRecord = { runId: handle.runId, parentRunId: context.agentRunId, driver, description, mode, status: "running", startedAt: handle.startedAt, completedAt: null };
      try { saveAiSubagentTask(context.userId, context.sessionId!, record); }
      catch (error) { handle.cancel(); throw error; }
      // 结果落在原 Session 日志中，父回复完成后也不丢失；不创建续问或重放任务。
      const settled = handle.done.then(result => {
        const completed = { ...record, status: handle.status, completedAt: new Date().toISOString(), answer: result.answer, ...(result.diagnostic ? { diagnostic: result.diagnostic } : {}) };
        saveAiSubagentTask(context.userId, context.sessionId!, completed);
        return result;
      });
      if (mode === "background") {
        // 生命周期由现有 Manager/子 Run 管理；持久化失败转为原活动诊断，避免无观察 Promise。
        void settled.catch(() => { try { context.onProgress("子任务结果持久化失败，请核对其独立会话；不能将它记为已交付。"); } catch { /* 页面离开不影响任务清理。 */ } });
        return { status: "running", runId: handle.runId, sessionId: context.sessionId, driver, mode, message: "子任务已启动。使用 lfaa_get_subagent_result 回收结果，尚未完成验收。" };
      }
      const result = await settled;
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
    id: "subagent.list-models", name: "lfaa_list_subagent_models", coreManaged: true, applicationIds: [...APPLICATION_IDS],
    description: "列出当前用户已保存的子 Agent 模型账户和已注册驱动，只返回模型元数据，不返回密钥。委派可将 accountId 原样传给 model。",
    schema: { type: "object", properties: {}, additionalProperties: false },
    parse(value) { if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length) throw new Error("模型目录参数必须为空对象。"); return {}; },
    risk: () => "read", approval: () => ({ scopeKey: "subagent-models", scopeSummary: "模型目录", summary: "查询子 Agent 模型" }),
    async execute(_parameters, context) {
      return { models: listAiAccounts(context.userId).map(account => ({ accountId: account.id, provider: account.providerId, model: account.modelId, displayName: account.displayName })), drivers: ctx.lfaaSubagents.listDrivers() };
    }
  });
}
