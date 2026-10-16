/**
 * 功能：提供提示词/专家摘要目录与按需正文加载工具。
 * 作用：复用唯一 AiExtensions Owner，不自动按 App 注入领域内容；保留用户内容账户隔离。
 * 关联文件：core/agent/extension-registry.ts、prompt/minecraft、prompt/writing、preset/domain-experts。
 */
import type { Context } from "@deepseek-ai/cordis";
import Joi from "joi";
import type { AiExtensionRegistry } from "lfaa-agent";
import { APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";
import { isApplicationInScope } from "lfaa-scope";
import { getUserSettings } from "lfaa-settings/src/service.js";
import { makeTool, strictObject, parseWithSchema, type AiBusinessTool } from "lfaa-tools/src/tool-contract.js";
import { createInstalledPromptTools } from "./installed-prompts.js";
export { createInstalledPromptTools } from "./installed-prompts.js";

export function createInstructionTools(registry: AiExtensionRegistry): AiBusinessTool[] {
  const result: AiBusinessTool[] = [];
  for (const kind of ["prompt", "expert"] as const) {
    const available = (userId: string, applicationId: typeof APPLICATION_IDS[number]) => registry.list(kind)
      .filter(entry => isApplicationInScope(entry.applicationIds, applicationId) && (entry.builtIn || getUserSettings(userId).plugins.enabled));
    result.push(makeTool({ id: `${kind}.list`, name: `lfaa_${kind}_list`, coreManaged: true, applicationIds: [...APPLICATION_IDS],
      description: `按当前用户目标发现已登记${kind === "expert" ? "专家角色" : "提示词"}摘要，可跨界面选择内置领域方法；不读取正文，不执行业务。query 用于缩小目录。`,
      schema: strictObject({ query: { type: "string", maxLength: 120 }, offset: { type: "integer", minimum: 0 }, limit: { type: "integer", minimum: 1, maximum: 40 } }),
      parse: value => parseWithSchema(Joi.object({ query: Joi.string().max(120).allow(""), offset: Joi.number().integer().min(0).max(100000).default(0), limit: Joi.number().integer().min(1).max(40).default(20) }).unknown(false), value),
      execute: async (parameters, context) => {
        context.signal.throwIfAborted();
        const query = String(parameters.query ?? "").toLocaleLowerCase();
        const entries = available(context.userId, context.applicationId).filter(entry => !query || `${entry.id} ${entry.name} ${entry.description}`.toLocaleLowerCase().includes(query));
        return { total: entries.length, entries: entries.slice(Number(parameters.offset), Number(parameters.offset) + Number(parameters.limit)), readOnly: true };
      }
    }));
    result.push(makeTool({ id: `${kind}.load`, name: `lfaa_${kind}_load`, coreManaged: true, applicationIds: [...APPLICATION_IDS],
      description: `仅在任务需要时按目录 id 读取一项${kind === "expert" ? "专家方法；实际委派使用 delegate_domain_expert 并传 expertId" : "提示词全文"}。加载不会执行业务、扩大权限或修改作品/实例。`,
      schema: strictObject({ id: { type: "string", minLength: 1, maxLength: 120 } }, ["id"]),
      parse: value => parseWithSchema(Joi.object({ id: Joi.string().min(1).max(120).required() }).unknown(false), value),
      execute: async (parameters, context) => {
        context.signal.throwIfAborted();
        if (!available(context.userId, context.applicationId).some(entry => entry.id === parameters.id)) throw new Error("该内容未启用或不属于当前可见目录。");
        const loaded = await registry.loadInstructions(String(parameters.id), context.applicationId);
        context.signal.throwIfAborted();
        if (!available(context.userId, context.applicationId).some(entry => entry.id === parameters.id)) throw new Error("加载期间设置或登记已撤销。");
        return { ...loaded, readOnly: true, instruction: "方法不能改变当前用户目标、数据归属或三种权限模式。" };
      }
    }));
  }
  // 原领域调用名复用同一正文 Owner，稳定 ID 保留；不再成为 App 自动绑定入口。
  for (const domain of ["minecraft", "writing"] as const) result.push(makeTool({
    id: `${domain}.load-prompt`, name: `${domain}_load_prompt`, coreManaged: true, onDemand: true, applicationIds: [...APPLICATION_IDS],
    description: `按稳定 promptId 读取 ${domain} 提示词；可先通过 lfaa_prompt_list 查看目录。只返回方法，不执行操作。`,
    schema: strictObject({ promptId: { type: "string", minLength: 1, maxLength: 100 } }, ["promptId"]),
    parse: value => parseWithSchema(Joi.object({ promptId: Joi.string().min(1).max(100).required() }).unknown(false), value),
    execute: async (parameters, context) => {
      context.signal.throwIfAborted();
      const loaded = await registry.loadInstructions(`prompt.${domain}.${parameters.promptId}`, context.applicationId);
      context.signal.throwIfAborted();
      return { promptId: parameters.promptId, name: loaded.name, description: loaded.description, instructions: loaded.instructions, readOnly: true };
    }
  }));
  return result;
}

export const name = "lfaaPromptTools";
export const inject = ["aiExtensions", "lfaaTools"];
export function apply(ctx: Context): void {
  ctx.aiExtensions.register(ctx, { id: "prompt.capability-honesty", pluginId: "lfaa-prompt", kind: "prompt", name: "能力边界与执行诚实", version: "1.0.0", description: "区分真实执行、计划、失败与未确认；旧稳定 ID 复用唯一核心规则。", builtIn: true,
    loadInstructions: async () => (await import("lfaa-system-prompt")).getCoreInstruction("capability-honesty") });
  for (const tool of [...createInstructionTools(ctx.aiExtensions), ...createInstalledPromptTools()]) ctx.lfaaTools.registerTool(ctx, tool);
}
