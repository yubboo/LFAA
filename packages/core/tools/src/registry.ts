/**
 * 功能：登记插件提供的真实可执行工具。
 * 作用：维护运行期实现与卸载清理，拒绝同名覆盖；模型选择、参数校验和审批继续由 Agent 循环负责。
 * 关联文件：business-tools.ts、index.ts、core/agent-loop/execute-turn.ts；扩展元数据不等于执行实现。
 */
import type { Context } from "@deepseek-ai/cordis";
import type { AiBusinessTool, AiBusinessToolContext } from "./business-tools.js";
import { APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";

const tools = new Map<string, AiBusinessTool>();

/** 插件必须显式提供参数解析、风险、审批范围和执行函数，不允许只有成功占位。 */
export function registerAiBusinessTool(owner: Context, tool: AiBusinessTool): void {
  owner.effect(() => {
    if (!/^[a-z0-9][a-z0-9._-]{1,119}$/u.test(tool.id) || !/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/u.test(tool.name)) throw new Error("可执行工具标识格式无效。");
    if (!tool.applicationIds.length || !tool.applicationIds.every(id => APPLICATION_IDS.includes(id))) throw new Error("可执行工具必须声明有效应用范围。");
    if (!tool.description || tool.schema.type !== "object" || [tool.parse, tool.risk, tool.approval, tool.execute].some(fn => typeof fn !== "function") || tool.delegation) throw new Error("插件工具必须提供完整执行、校验和权限合同。");
    if (tools.has(tool.id) || [...tools.values()].some(item => item.name === tool.name)) throw new Error("可执行工具 ID 或模型调用名称重复。");
    const registered: AiBusinessTool = Object.freeze({ ...tool, applicationIds: [...tool.applicationIds], schema: structuredClone(tool.schema), execute: async (parameters: Record<string, unknown>, context: AiBusinessToolContext) => {
      if (tools.get(tool.id) !== registered) throw new Error("工具所属插件已卸载，已拒绝继续执行。");
      return tool.execute(parameters, context);
    } });
    tools.set(tool.id, registered);
    return () => { if (tools.get(tool.id) === registered) tools.delete(tool.id); };
  }, `ai-executable-tool:${tool.id}`);
}

export function listRegisteredAiTools(): AiBusinessTool[] { return [...tools.values()]; }
