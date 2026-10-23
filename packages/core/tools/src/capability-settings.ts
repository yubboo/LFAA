/**
 * 功能：向模型提供真实能力开关与受审批约束的启用入口。
 * 作用：复用 Settings Owner 保存当前账户的有限开关，不修改权限、模型、凭据或能力范围。
 * 关联文件：business-tools.ts、registry.ts、agent-loop/execute-turn.ts；审批由既有工具管线处理。
 */
import Joi from "joi";
import { getUserSettings, saveUserSettings } from "lfaa-settings/src/service.js";
import { APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";
import { listRegisteredAiTools } from "./registry.js";
import type { AiBusinessTool, AiBusinessToolContext } from "./business-tools.js";

export const capabilitySettingsInstruction = "通用能力：按用户目标选择已登记能力。用户明确要求网页浏览而 Browser Use 关闭时，先检查 lfaa_capability_status，再按当前 permissions.mode 使用 lfaa_set_capability_enabled 开启 browserUse；不要为 LFAA 内置浏览器开启 computerControl，也不要要求用户单独接入内置浏览器。Browser Use 开启后先用 lfaa_browser_list_providers 检查当前 Host 实际可用的内置浏览器；用户在右侧浏览器 Dock 手动打开的页面与 Agent 使用同一个 Browser Owner 会话。用户要求打开当前会话工作区内的 HTML/HTM 时，使用 lfaa_browser_open_workspace_file 的相对路径，不要启动 Shell/Python 静态服务器。只有用户本轮明确点名 Tabbit、个人 Chrome/Edge 或要求访问自己的本机浏览器时才可读取个人页面，且还须启用 computerControl 并遵循当前 permissions.mode。打开现有应用不需要专属 MCP/Skill。开启设置或得到工具返回都不等于任务完成；必须检查浏览器当前页面的真实结果再报告。不得扩大用户目标或改变权限模式。";

function parse(schema: Joi.ObjectSchema, value: unknown): Record<string, unknown> {
  const result = schema.validate(value, { convert: false, abortEarly: false });
  if (result.error) throw new Error("能力开关参数无效。");
  return result.value as Record<string, unknown>;
}

/** 注册不等于设备就绪；不暴露服务地址、命令、凭据或其他账户配置。 */
export function capabilitySettingsStatus(context: Pick<AiBusinessToolContext, "userId" | "userRole" | "applicationId">): unknown {
  const settings = getUserSettings(context.userId);
  const canAdmin = context.userRole === "admin" || context.userRole === "super_admin";
  const registered = listRegisteredAiTools().filter(tool => tool.applicationIds.includes(context.applicationId) && (!tool.adminOnly || canAdmin));
  return {
    permissionMode: settings.permissions.mode,
    plugins: { enabled: settings.plugins.enabled, registeredToolCount: registered.filter(tool => !tool.coreManaged).length },
    computerControl: { enabled: settings.computerControl.enabled, registeredTools: registered.filter(tool => tool.requiresComputerControl).map(tool => tool.name), available: settings.computerControl.enabled && registered.some(tool => tool.requiresComputerControl) },
    browserUse: { enabled: settings.browserUse.enabled, enabledProviderIds: [...settings.browserUse.enabledProviderIds], registeredTools: registered.filter(tool => tool.requiresBrowserUse).map(tool => tool.name), available: settings.browserUse.enabled && registered.some(tool => tool.requiresBrowserUse) },
    mcpServers: settings.plugins.mcpServers.filter(server => server.applicationIds.includes(context.applicationId)).map(server => ({ id: server.id, name: server.name, enabled: server.enabled, computerUse: server.computerUse === true, blockedBy: [...(!settings.plugins.enabled ? ["plugins"] : []), ...(!server.enabled ? ["server"] : []), ...(server.computerUse && !settings.computerControl.enabled ? ["computerControl"] : [])] })),
    instruction: capabilitySettingsInstruction
  };
}

export const capabilitySettingsTools: AiBusinessTool[] = [
  {
    id: "capabilities.settings-status", name: "lfaa_capability_status", coreManaged: true, applicationIds: [...APPLICATION_IDS], activityTitle: "检查能力开关与可用范围",
    description: "读取当前账户/App 的插件、电脑操控、Browser Use 和已配置 MCP 服务开关与阻塞原因。不连接设备、不公开秘密。关闭能力可通过 lfaa_set_capability_enabled 按当前权限申请开启。",
    schema: { type: "object", properties: {}, additionalProperties: false },
    parse: value => parse(Joi.object({}).unknown(false), value), risk: () => "read",
    approval: () => ({ scopeKey: "capability-status", scopeSummary: "当前账户能力", summary: "查询能力状态" }),
    execute: async (_parameters, context) => capabilitySettingsStatus(context)
  },
  {
    id: "capabilities.settings-enable", name: "lfaa_set_capability_enabled", coreManaged: true, applicationIds: [...APPLICATION_IDS], activityTitle: "修改能力开关",
    description: "为当前目标开启或关闭当前账户的 plugins、computerControl、browserUse 或已配置的 mcpServer（先查询 serverId）。请求审批/替我审批沿用授权范围，完全权限直接执行。保存偏好后下一次模型请求刷新工具。不得修改权限、个人浏览器连接或安装未知服务。",
    schema: { type: "object", additionalProperties: false, properties: { capability: { type: "string", enum: ["plugins", "computerControl", "browserUse", "mcpServer"] }, enabled: { type: "boolean" }, serverId: { type: "string", maxLength: 64 } }, required: ["capability", "enabled"] },
    parse: value => parse(Joi.object({ capability: Joi.string().valid("plugins", "computerControl", "browserUse", "mcpServer").required(), enabled: Joi.boolean().required(), serverId: Joi.string().max(64).when("capability", { is: "mcpServer", then: Joi.required(), otherwise: Joi.forbidden() }) }).unknown(false), value),
    risk: parameters => parameters.enabled ? "dangerous" : "write",
    approval: (parameters, context) => ({ scopeKey: `capability:${context.userId}:${context.applicationId}:${parameters.capability}:${parameters.serverId ?? ""}:${parameters.enabled}`, scopeSummary: `当前账户 · ${parameters.capability}${parameters.serverId ? ` · ${parameters.serverId}` : ""}`, summary: `${parameters.enabled ? "开启" : "关闭"} ${parameters.capability}；保存后仅按当前用户目标选择能力` }),
    execute: async (parameters, context) => {
      context.signal.throwIfAborted();
      const current = getUserSettings(context.userId);
      const enabled = parameters.enabled === true;
      if (parameters.capability === "browserUse") {
        const registered = listRegisteredAiTools().some(tool => tool.requiresBrowserUse && tool.applicationIds.includes(context.applicationId) && (!tool.adminOnly || context.userRole === "admin" || context.userRole === "super_admin"));
        if (enabled && !registered) throw new Error("当前入口没有登记浏览器操作适配器；开启设置不能提供不存在的能力。");
        saveUserSettings(context.userId, "browser-use", { ...current.browserUse, enabled });
      } else if (parameters.capability === "computerControl") {
        const registered = listRegisteredAiTools().some(tool => tool.requiresComputerControl && tool.applicationIds.includes(context.applicationId) && (!tool.adminOnly || context.userRole === "admin" || context.userRole === "super_admin"));
        const configured = current.plugins.mcpServers.some(server => server.computerUse && server.applicationIds.includes(context.applicationId));
        if (enabled && !registered && !configured) throw new Error("当前入口没有登记电脑操控适配器或 Computer-Use MCP；开启设置不能提供不存在的能力。");
        saveUserSettings(context.userId, "computer-control", { ...current.computerControl, enabled });
      } else if (parameters.capability === "plugins") {
        saveUserSettings(context.userId, "plugins", { ...current.plugins, enabled });
      } else {
        const server = current.plugins.mcpServers.find(item => item.id === parameters.serverId && item.applicationIds.includes(context.applicationId));
        if (!server) throw new Error("当前账户/App 没有该 MCP 配置，未修改其他服务。");
        saveUserSettings(context.userId, "plugins", { ...current.plugins, mcpServers: current.plugins.mcpServers.map(item => item.id === server.id ? { ...item, enabled } : item) });
      }
      return { changed: true, status: capabilitySettingsStatus(context), note: "设置已保存；下一次模型请求刷新工具，尚未执行其他操作。" };
    }
  }
];
