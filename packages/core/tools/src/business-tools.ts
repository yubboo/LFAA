/**
 * 功能：通用工具选择与账户范围。
 * 作用：按职责登记能力，业务与权限继续归原 Owner，正文由模型按需加载。
 * 关联文件：tool-contract.ts、registry.ts、领域工具插件。
 */
import Joi from "joi";
import { projectFileTool } from "./project-tools.js";
import { capabilitySettingsTools } from "./capability-settings.js";
import { settingsTools } from "./settings-tools.js";
import { listRegisteredAiTools } from "./registry.js";
import { createHash } from "node:crypto";
import { isApplicationInScope } from "lfaa-scope/src/index.js";
import { presentNativeFunctionTools } from "lfaa-agent-tool-presentation/src/index.js";
import { APPLICATION_IDS, type ApplicationId } from "lfaa-util-values/src/application-id.js";
import type { UserRole } from "lfaa-identity-auth/src/service.js";
import { systemFiles } from "lfaa-fs/src/library.js";
import { FILE_MANAGER_OPERATIONS, type FileManagerOperation } from "lfaa-util-values/src/file-manager-contract.js";
export type { AiBusinessTool, AiBusinessToolRisk, AiBusinessToolContext, AiExternalAgentToolDefinition, AiExternalAgentToolContent, AiExternalAgentToolDispatchResult, AiBusinessToolProjectedResult, AiWritingToolTarget } from "./tool-contract.js";
export { strictObject, parseWithSchema, idSchema, makeTool, waitForTask } from "./tool-contract.js";
import { objectValue, strictObject, parseWithSchema, makeTool, type AiBusinessTool, type AiWritingToolTarget } from "./tool-contract.js";
export interface AiCompletionTool { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } }
const allApplications: ApplicationId[] = [...APPLICATION_IDS];
const fileSchema = Joi.object({
  operation: Joi.string().valid(...FILE_MANAGER_OPERATIONS).required(), path: Joi.string().max(1024).allow("").required(),
  query: Joi.string().min(1).max(100), name: Joi.string().min(1).max(255), destinationPath: Joi.string().allow("").max(1024),
  content: Joi.string().allow("").max(2 * 1024 * 1024), expectedSha256: Joi.string().pattern(/^[a-f0-9]{64}$/u)
}).unknown(false);
const fileTool: AiBusinessTool = makeTool({
  id: "files.system-operation", name: "system_file_operation", applicationIds: allApplications, coreManaged: true, adminOnly: true,
  description: "统一文件管理，与文件页面调用同一服务。先 list 空路径：entries 是真实 data 文件，locations 是受管资源、游戏实例、应用 Owner 和显式磁盘来源；使用返回的 path 按目标进入。游戏实例按稳定 ID 由所属节点解析自定义目录，离线或不兼容不能伪装为空。没有游戏节点也可操作当前 data 文件。拒绝直接绝对路径和路径跳转，源码、账户私有数据、实例根/元数据、运行或未确认实例与扩展插件生命周期受 Owner 保护；插件安装更新卸载使用 capability 工具。write 携带最近 read 返回的 expectedSha256；delete 移入当前账户回收站。不同来源/实例/机器不能直接 move。upload/download 字节传输由文件页面提供，不向模型返回 Base64。仅超级管理员且 permissions.mode 为 full_access 可使用。",
  schema: strictObject({ operation: { type: "string", enum: FILE_MANAGER_OPERATIONS.filter(op => !["upload", "download"].includes(op)) }, path: { type: "string", maxLength: 1024 }, query: { type: "string", maxLength: 100 }, name: { type: "string", maxLength: 255 }, destinationPath: { type: "string", maxLength: 1024 }, content: { type: "string", maxLength: 2097152 }, expectedSha256: { type: "string", pattern: "^[a-f0-9]{64}$" } }, ["operation", "path"]),
  parse(value) {
    const input = parseWithSchema(fileSchema, value);
    if (["upload", "download"].includes(String(input.operation))) throw new Error("模型文件工具不传输文件字节，请使用文件页面。");
    if (input.operation === "write" && (typeof input.content !== "string" || !input.expectedSha256)) throw new Error("保存需要文本内容与最近读取的版本摘要。");
    if (input.operation === "move" && typeof input.destinationPath !== "string" || ["rename", "trash-restore", "trash-purge"].includes(String(input.operation)) && !input.name) throw new Error("文件操作目标参数缺失。");
    return input;
  },
  risk: parameters => ["delete", "trash-purge"].includes(String(parameters.operation)) ? "dangerous" : ["write", "create-file", "create-folder", "rename", "move", "trash-restore"].includes(String(parameters.operation)) ? "write" : "read",
  approval: parameters => ({ scopeKey: "files:" + createHash("sha256").update(JSON.stringify([parameters.operation, parameters.path, parameters.destinationPath ?? "", parameters.name ?? ""])).digest("hex"), scopeSummary: String(parameters.path).slice(0, 240), summary: `文件操作：${parameters.operation} · ${parameters.path || "文件总览"}` }),
  execute: async (parameters, context) => {
    const { operation, ...input } = parameters;
    return { result: await systemFiles.operate({ userId: context.userId, role: context.userRole, signal: context.signal }, operation as FileManagerOperation, input) };
  }
});

const delegationSchema = Joi.object({ task: Joi.string().trim().min(1).max(8000).required(), expertId: Joi.string().max(120), toolNames: Joi.array().items(Joi.string().min(1).max(120)).max(100) }).unknown(false);

const delegationTool: AiBusinessTool = makeTool({
  id: "agent.delegate-domain-expert", name: "delegate_domain_expert", applicationIds: [...APPLICATION_IDS],
  description: "将明确任务委派给子 Agent；需要专业角色时先从 lfaa_expert_list 选择 expertId，不按界面 App 自动选专家。模型、数量、深度、继承工具范围和权限沿用设置中心。",
  schema: strictObject({ task: { type: "string", minLength: 1, maxLength: 8000 }, expertId: { type: "string", maxLength: 120 }, toolNames: { type: "array", items: { type: "string" }, maxItems: 100 } }, ["task"]),
  parse: (value) => parseWithSchema(delegationSchema, value),
  delegation: "domain-expert",
  execute: async () => { throw new Error("子 Agent 由 AI Runtime 调用循环执行。"); }
});

export function listAiBusinessTools(applicationId: ApplicationId, userRole: UserRole, writingTarget: AiWritingToolTarget | null = null, permissionMode: "ask" | "approve_remembered" | "full_access" = "ask", includeExtensions = false, includeInstalledPrompts = false, includeComputerControl = false, includeBrowserUse = false, includeBrowserHistoryAccess = false, includeBrowserWebsiteTools = false, includeBrowserDeveloperMode = false, includeBrowserFullCdpAccess = false): AiBusinessTool[] {
  const available = [...capabilitySettingsTools, ...settingsTools, projectFileTool, delegationTool, fileTool];
  const canAdmin = userRole === "admin" || userRole === "super_admin";
  const fullAccess = permissionMode === "full_access";
  // 完全权限由账户持有人显式启用后可调用当前应用的全部已登记控制工具；写作目标仍绑定调用账户自己的作品。
  const builtins = available
    .map((tool) => applicationId === "workspace" ? { ...tool, applicationIds: [...new Set([...tool.applicationIds, "workspace" as const])] } : tool)
    .filter((tool) => isApplicationInScope(tool.applicationIds, applicationId))
    .filter((tool) => !tool.adminOnly || canAdmin)
    .filter((tool) => tool.id !== "files.system-operation" || userRole === "super_admin" && fullAccess)
    // 项目文件和主机命令由 Agent 按目标调用；风险审批由执行循环根据完整参数处理，不能在模型看到工具前隐藏。
    .filter((tool) => tool.coreManaged || tool.id === "project.files" || tool.id === "host.execute-command" || tool.id === "host.cancel-task" || fullAccess || canAdmin || tool.id.startsWith("writing.") || tool.risk(objectValue({ operation: "read" })) === "read")
    .filter((tool) => fullAccess || canAdmin || !tool.id.startsWith("minecraft.") || !["minecraft.deploy", "minecraft.retry-deployment", "minecraft.start", "minecraft.stop", "minecraft.backup", "minecraft.update-properties"].includes(tool.id))
    .map((tool) => tool);
  // 已启用的扩展按声明的应用范围提供给模型；执行时仍由完整风险、参数和当前权限模式决定是否审批。
  const registered = listRegisteredAiTools(writingTarget).filter(tool => isApplicationInScope(tool.applicationIds, applicationId))
    .filter(tool => !["capabilities.prompts-list", "capabilities.prompt-load"].includes(tool.id) || includeInstalledPrompts)
    .filter(tool => !tool.onDemand || fullAccess || canAdmin || tool.id.startsWith("writing.") || tool.risk(objectValue({ operation: "read" })) === "read");
  const permitted = (tool: AiBusinessTool) => (!tool.requiresComputerControl || includeComputerControl)
    && (!tool.requiresBrowserUse || includeBrowserUse)
    && (!tool.requiresBrowserHistoryAccess || includeBrowserHistoryAccess)
    && (!tool.requiresBrowserWebsiteTools || includeBrowserWebsiteTools)
    && (!tool.requiresBrowserDeveloperMode || includeBrowserDeveloperMode)
    && (!tool.requiresBrowserFullCdpAccess || includeBrowserDeveloperMode && includeBrowserFullCdpAccess);
  const coreManaged = registered.filter(tool => tool.coreManaged && (!tool.adminOnly || canAdmin) && permitted(tool));
  const extensions = includeExtensions ? registered.filter(tool => !tool.coreManaged && permitted(tool)) : [];
  for (const tool of [...coreManaged, ...extensions]) if (builtins.some(item => item.id === tool.id || item.name === tool.name)) throw new Error(`插件工具与内置工具冲突：${tool.name}`);
  for (const coreTool of coreManaged) if (extensions.some(item => item.id === coreTool.id || item.name === coreTool.name)) throw new Error(`核心管理工具与扩展工具冲突：${coreTool.name}`);
  return [...builtins, ...coreManaged, ...extensions];
}

export function listAiBusinessFunctionTools(applicationId: ApplicationId, userRole: UserRole, writingTarget: AiWritingToolTarget | null = null, permissionMode: "ask" | "approve_remembered" | "full_access" = "ask"): AiCompletionTool[] {
  return presentNativeFunctionTools(listAiBusinessTools(applicationId, userRole, writingTarget, permissionMode));
}

export function findAiBusinessTool(applicationId: ApplicationId, userRole: UserRole, name: string, writingTarget: AiWritingToolTarget | null = null, permissionMode: "ask" | "approve_remembered" | "full_access" = "ask"): AiBusinessTool | null {
  return listAiBusinessTools(applicationId, userRole, writingTarget, permissionMode).find((tool) => tool.name === name) ?? null;
}

export function domainExpertName(_applicationId: ApplicationId): string {
  return "按目标选择的领域专家";
}
