/**
 * 功能：登记 Agent 可发现的设置中心读取与单项更新工具。
 * 作用：模型按字段目录选择设置，写入由 Settings Owner 校验、保存并回读；Agent Loop 统一处理权限。
 * 关联文件：business-tools.ts、settings/settings/src/agent-settings.ts、agent-loop/execute-turn.ts。
 */
import Joi from "joi";
import { createHash, randomUUID } from "node:crypto";
import { listAgentSettings, updateAgentSetting } from "lfaa-settings/src/agent-settings.js";
import { getUserSettings, getUserSettingsSyncStatus } from "lfaa-settings/src/service.js";
import type { SettingsCategory } from "lfaa-util-values/src/settings-contract.js";
import { APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";
import { getAgentUsageControls, listManagedAgentUsageAccounts, saveAgentUsagePolicy } from "lfaa-identity-auth/src/account-agent-usage.js";
import { approveTrustedAccountRecovery, listTrustedContactSettings, removeTrustedContact } from "lfaa-identity-auth/src/service.js";
import { createAccountSnapshot, deleteAccountSnapshot, listAccountSnapshots, previewAccountArchive, readAccountSnapshot, restoreAccountArchive } from "lfaa-settings-snapshots";
import { SETTINGS_CENTER_MENUS, type SettingsMenuId } from "lfaa-util-values/src/settings-menu-catalog.js";
import { makeTool, parseWithSchema, strictObject, type AiBusinessTool } from "./tool-contract.js";

const SETTING_CATEGORIES: SettingsCategory[] = ["general", "appearance", "shortcuts", "ai-runtime", "minecraft-runtime", "git", "permissions", "plugins", "personalization", "computer-control", "browser-use", "mini", "canvas"];
const SETTING_MENU_IDS = SETTINGS_CENTER_MENUS.map(menu => menu.id) as SettingsMenuId[];
const pendingMiniWindowRequests = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();

if (typeof process.send === "function") {
  process.on("message", message => {
    if (!message || typeof message !== "object" || (message as Record<string, unknown>).type !== "lfaa:desktop-mini-result") return;
    const response = message as { requestId?: unknown; ok?: unknown; result?: unknown; error?: unknown };
    if (typeof response.requestId !== "string") return;
    const pending = pendingMiniWindowRequests.get(response.requestId);
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingMiniWindowRequests.delete(response.requestId);
    if (response.ok === true) pending.resolve(response.result);
    else pending.reject(new Error(typeof response.error === "string" ? response.error : "Mini 窗口 Host 执行失败。"));
  });
}

function requestDesktopMiniWindow(action: "open" | "close", settings?: unknown): Promise<unknown> {
  if (typeof process.send !== "function" || !process.connected) throw new Error("当前 Agent Host 未连接 Electron Mini 窗口 Owner；Web Host 不支持原生 Mini 窗口。");
  const requestId = randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingMiniWindowRequests.delete(requestId);
      reject(new Error("等待 Electron Mini 窗口 Owner 回执超时；不能确认窗口已打开或关闭。"));
    }, 10_000);
    pendingMiniWindowRequests.set(requestId, { resolve, reject, timer });
    process.send!({ type: "lfaa:desktop-mini-request", requestId, action, ...(settings ? { settings } : {}) }, error => {
      if (!error) return;
      clearTimeout(timer);
      pendingMiniWindowRequests.delete(requestId);
      reject(error);
    });
  });
}

export const agentSettingsInstruction = [
  "用户提到设置中心中的菜单、开关或操作时，先调用 lfaa_settings_list 不带参数读取完整菜单目录；每项说明它由账户设置字段、专属 Owner 工具、只读信息、用户直接输入或当前未接入哪一类能力负责。用 menuId 读取准确菜单里的字段和值；有设置分类字段时，仅按用户目标用 lfaa_settings_update 写入一个精确叶字段。",
  "当用户要求读取菜单内的动态状态/数据、执行菜单中的领域动作，或菜单标为 tools / settings-and-tools / partial 时，按目录 toolSearchTerms（没有时用菜单名与目标对象）调用 lfaa_tools_list 搜索本 Run 当前真实登记的 Owner 工具，再 lfaa_tools_load 加载命中的精确工具合同并执行。必须看工具运行时返回的真实能力和结果；没有匹配工具或 Owner 拒绝时如实停止，不模拟 UI 点击，不用 Shell、任意 API 或数据库代替。只读、用户直接输入、未接入状态按目录边界处理；特别是密码、恢复密钥、邮箱验证、MCP 命令和秘密凭据不得放入 Agent 参数或会话。",
  "从当前话语和对话上下文判断准确菜单、字段和值。目标唯一清楚时直接做，不反复确认；若用户只说‘改一下外观’等，而主题、背景、字号等选择会改变结果，询问缺少的那一项。‘背景改成纯色’没有位置线索时询问背景位置，不能默认改全部六处。appearance.backgrounds.<target> 各自独立；none 的界面标签是‘纯色’，只改用户明确指定的 path。",
  "用户要求代码审查时，将它路由到当前 Agent Git 仓库的 project_file_operation：先 operation=diff 获取真实工作区差异，再围绕变更行读取必要上下文并检查缺陷、回归风险和缺失验证。没有绑定仓库或差异工具不可用时先说明；审查本身只读，用户未要求修复时不得修改代码、提交或推送。",
  "所有设置与 Owner 操作都遵循当前 permissions.mode 和 Agent Loop/Permission Owner：请求审批等待本次批准；替我审批只使用现有匹配范围授权记忆；完全访问按当前用户目标直接执行，不重复询问。permissions.mode 永远只由用户本人修改。电脑操控、Browser Use、扩展总开关用 lfaa_set_capability_enabled；个人浏览器连接、浏览历史和 Browser Vault 操作用 lfaa_browser_manage_settings。完成后按 Settings/领域 Owner 回读或动作返回值核实，不凭工具派发或页面文字声称成功。"
].join("\n");

function parse(schema: Joi.ObjectSchema, value: unknown): Record<string, unknown> {
  return parseWithSchema(schema, value);
}

function expandsAccess(path: string, value: unknown): boolean {
  if (value === true && [
    "browserUse.allowAgentHistoryAccess",
    "browserUse.developerMode",
    "browserUse.fullCdpAccess",
    "browserUse.useWebsiteToolsByDefault",
    "personalization.memoryEnabled",
    "personalization.memoryFromToolChats"
  ].includes(path)) return true;
  if (value === "allow" && path.startsWith("browserUse.sitePermissionDefaults.")) return true;
  if ((path === "browserUse.sitePermissionOverrides" || path === "browserUse.websiteToolOverrides") && Array.isArray(value)
    && value.some(item => item && typeof item === "object" && (item as Record<string, unknown>).decision === "allow")) return true;
  if (["browserUse.webUrlOpenLocation", "browserUse.localUrlOpenLocation"].includes(path) && value === "current-browser") return true;
  if (path === "browserUse.enabledProviderIds" && Array.isArray(value) && value.length > 0) return true;
  return false;
}

export const settingsTools: AiBusinessTool[] = [
  makeTool({
    id: "settings.mini.window", name: "lfaa_settings_mini_window", coreManaged: true, applicationIds: [...APPLICATION_IDS], activityTitle: "操作桌面 Mini 窗口",
    description: "在当前 LFAA Electron 桌面 Host 打开或关闭独立 Mini 窗口。打开时读取当前账户已保存的伙伴显示、置顶与透明度偏好；工具等待 Electron Host 的真实回执。Web Host 会返回不支持错误，不会伪称完成。",
    schema: strictObject({ action: { type: "string", enum: ["open", "close"] } }, ["action"]),
    parse: value => parse(Joi.object({ action: Joi.string().valid("open", "close").required() }).unknown(false), value),
    risk: () => "write",
    approval: (parameters, context) => ({ scopeKey: `settings:mini-window:${context.userId}:${String(parameters.action)}`, scopeSummary: `Mini 窗口 · ${String(parameters.action)}`, summary: `${parameters.action === "open" ? "打开" : "关闭"}当前 LFAA Electron Mini 窗口` }),
    execute: async (parameters, context) => {
      context.signal.throwIfAborted();
      const action = String(parameters.action) as "open" | "close";
      const result = await requestDesktopMiniWindow(action, action === "open" ? getUserSettings(context.userId).mini : undefined);
      context.signal.throwIfAborted();
      return { source: "electron-mini-window-owner", action, result };
    }
  }),
  makeTool({
    id: "settings.sync.status", name: "lfaa_settings_sync_status", coreManaged: true, applicationIds: [...APPLICATION_IDS], activityTitle: "读取自托管设置同步状态",
    description: "读取当前账户在本机 LFAA 自托管控制端已保存的设置分类与最近更新时间，不返回设置值、凭据或记忆正文。该服务会在登录同一控制端的设备间共享账户设置；不同控制端之间不会自动同步。",
    schema: strictObject({}), parse: value => parse(Joi.object({}).unknown(false), value), risk: () => "read",
    execute: async (_parameters, context) => { context.signal.throwIfAborted(); return getUserSettingsSyncStatus(context.userId); }
  }),
  makeTool({
    id: "settings.list", name: "lfaa_settings_list", coreManaged: true, applicationIds: [...APPLICATION_IDS], activityTitle: "读取设置中心目录",
    description: "从当前账户 Settings Owner 查询完整设置中心菜单目录和账户字段。无参数时返回全部菜单的状态/Owner 路由、工具搜索词、设置分类，以及最多 50 项字段；指定 menuId 可读取某菜单的字段和接入边界，指定 category 或 query 可筛选分类/菜单/字段/中文选项。普通字段返回中文标签、当前值、默认值、类型、有效选项和范围；背景选项包含纯色、内置图及当前账户自定义图。AI 与模型菜单还返回账户已配置的真实模型路由。不返回凭据、MCP 命令/URL、插件来源目录或提示词正文。",
    schema: strictObject({ category: { type: "string", enum: SETTING_CATEGORIES }, menuId: { type: "string", enum: SETTING_MENU_IDS }, query: { type: "string", maxLength: 120 }, offset: { type: "integer", minimum: 0, maximum: 1000 }, limit: { type: "integer", minimum: 1, maximum: 50 } }),
    parse: value => parse(Joi.object({ category: Joi.string().valid(...SETTING_CATEGORIES), menuId: Joi.string().valid(...SETTING_MENU_IDS), query: Joi.string().trim().max(120), offset: Joi.number().integer().min(0).max(1000), limit: Joi.number().integer().min(1).max(50) }).unknown(false), value),
    risk: () => "read",
    execute: async (parameters, context) => {
      context.signal.throwIfAborted();
      return listAgentSettings(context.userId, parameters as { category?: SettingsCategory; menuId?: SettingsMenuId; query?: string; offset?: number; limit?: number });
    }
  }),
  makeTool({
    id: "settings.update", name: "lfaa_settings_update", coreManaged: true, applicationIds: [...APPLICATION_IDS], activityTitle: "更新设置中心偏好",
    description: "按 lfaa_settings_list 返回的精确 path 更新当前账户的单项设置；value 必须符合该字段当前账户的真实中文选项与 Settings Owner 校验。背景图片每个位置独立，只改指定 path。禁止改 permissions.mode。电脑操控、Browser Use、扩展总开关需使用 lfaa_set_capability_enabled；秘密、MCP/插件连接和来源目录不接受通用写入。调用按请求审批/替我审批/完全权限由 Agent Loop 的统一 Permission Owner 授权。",
    schema: strictObject({ path: { type: "string", minLength: 3, maxLength: 160 }, value: {} }, ["path", "value"]),
    parse: value => parse(Joi.object({ path: Joi.string().trim().min(3).max(160).required(), value: Joi.any().required() }).unknown(false), value),
    risk: parameters => expandsAccess(String(parameters.path), parameters.value) ? "dangerous" : "write",
    approval: (parameters, context) => {
      const valueHash = createHash("sha256").update(JSON.stringify(parameters.value) ?? "undefined").digest("hex");
      return { scopeKey: `settings:${context.userId}:${context.applicationId}:${String(parameters.path)}:${valueHash}`, scopeSummary: String(parameters.path).slice(0, 180), summary: `更新设置中心：${String(parameters.path).slice(0, 120)}` };
    },
    execute: async (parameters, context) => {
      context.signal.throwIfAborted();
      const result = updateAgentSetting(context.userId, String(parameters.path), parameters.value);
      return { ...result, source: "settings-owner", note: "只更新并回读了返回的这一项账户设置。" };
    }
  }),
  makeTool({
    id: "settings.runtime-hooks", name: "lfaa_settings_runtime_hooks_list", coreManaged: true, applicationIds: [...APPLICATION_IDS], activityTitle: "读取运行时钩子",
    description: "读取当前 LFAA Host 中由 Cordis 受信任插件真实登记的 AI Runtime Hook ID 与事件名称。只返回目录元数据，不返回或调用插件回调，不创建或修改钩子。若当前 Host 没有提供该 Owner 状态，必须报告不可用。",
    schema: strictObject({}),
    parse: value => parse(Joi.object({}).unknown(false), value),
    risk: () => "read",
    execute: async (_parameters, context) => {
      context.signal.throwIfAborted();
      if (!context.listRuntimeHooks) throw new Error("当前 Agent Host 没有提供 AI Runtime Hook Owner；未读取或修改钩子。");
      const hooks = context.listRuntimeHooks();
      return { source: "ai-runtime-hook-owner", count: hooks.length, hooks };
    }
  }),
  makeTool({
    id: "settings.parental.list", name: "lfaa_settings_parental_list", coreManaged: true, applicationIds: [...APPLICATION_IDS], activityTitle: "读取家长控制与使用时长",
    description: "通过账户使用控制 Owner 读取当前账户的使用时段、每日 Agent 用量；管理员可列出普通成员账户并查看指定成员策略。不会读取会话内容或更改限制。",
    schema: strictObject({ accountId: { type: "string", minLength: 1, maxLength: 160 } }),
    parse: value => parse(Joi.object({ accountId: Joi.string().trim().min(1).max(160) }).unknown(false), value),
    risk: () => "read",
    execute: async (parameters, context) => {
      context.signal.throwIfAborted();
      const accountId = typeof parameters.accountId === "string" ? parameters.accountId : context.userId;
      const controls = getAgentUsageControls(context.userId, accountId);
      return {
        source: "account-agent-usage-owner",
        controls,
        ...(accountId === context.userId && controls.account.role !== "member" ? { manageableAccounts: listManagedAgentUsageAccounts(context.userId) } : {})
      };
    }
  }),
  makeTool({
    id: "settings.parental.update", name: "lfaa_settings_parental_update", coreManaged: true, applicationIds: [...APPLICATION_IDS], activityTitle: "更新家长控制",
    description: "仅管理员可为普通成员账户设置 Agent 每周使用时段、时区和每日使用时长。调整通过账户使用控制 Owner 验证并回读；用户请求审批/替我审批/完全访问统一由 Agent Loop 的 Permission Owner 执行。",
    schema: strictObject({ accountId: { type: "string", minLength: 1, maxLength: 160 }, policy: { type: "object", properties: { enabled: { type: "boolean" }, timezone: { type: "string", minLength: 1, maxLength: 80 }, dailyLimitMinutes: { type: "integer", minimum: 1, maximum: 1440 }, weeklyWindows: { type: "array", minItems: 7, maxItems: 7, items: { type: "object", properties: { enabled: { type: "boolean" }, start: { type: "string", pattern: "^(?:[01]\\d|2[0-3]):[0-5]\\d$" }, end: { type: "string", pattern: "^(?:[01]\\d|2[0-3]):[0-5]\\d$" } }, required: ["enabled", "start", "end"], additionalProperties: false } } }, required: ["enabled", "timezone", "dailyLimitMinutes", "weeklyWindows"], additionalProperties: false } }, ["accountId", "policy"]),
    parse: value => parse(Joi.object({ accountId: Joi.string().trim().min(1).max(160).required(), policy: Joi.object({ enabled: Joi.boolean().required(), timezone: Joi.string().trim().min(1).max(80).required(), dailyLimitMinutes: Joi.number().integer().min(1).max(1440).required(), weeklyWindows: Joi.array().length(7).items(Joi.object({ enabled: Joi.boolean().required(), start: Joi.string().pattern(/^(?:[01]\d|2[0-3]):[0-5]\d$/u).required(), end: Joi.string().pattern(/^(?:[01]\d|2[0-3]):[0-5]\d$/u).required() }).unknown(false)).required() }).unknown(false).required() }).unknown(false), value),
    risk: () => "dangerous",
    approval: (parameters, context) => ({ scopeKey: `settings:parental:${context.userId}:${String(parameters.accountId)}:${createHash("sha256").update(JSON.stringify(parameters.policy)).digest("hex")}`, scopeSummary: `家长控制 · ${String(parameters.accountId).slice(0, 120)}`, summary: `更新普通账户 ${String(parameters.accountId).slice(0, 80)} 的 Agent 使用限制` }),
    execute: async (parameters, context) => {
      context.signal.throwIfAborted();
      const result = saveAgentUsagePolicy(context.userId, String(parameters.accountId), parameters.policy);
      return { source: "account-agent-usage-owner", updated: true, controls: result };
    }
  }),
  makeTool({
    id: "settings.trusted-contacts.list", name: "lfaa_settings_trusted_contacts_list", coreManaged: true, applicationIds: [...APPLICATION_IDS], activityTitle: "读取受信联系人与恢复请求",
    description: "读取当前账户的受信联系人、信任当前账户的人及未过期的本机密码恢复请求；不返回邀请码、恢复码、密码或任何凭据。",
    schema: strictObject({}), parse: value => parse(Joi.object({}).unknown(false), value), risk: () => "read",
    execute: async (_parameters, context) => { context.signal.throwIfAborted(); return { source: "identity-auth-owner", ...listTrustedContactSettings(context.userId) }; }
  }),
  makeTool({
    id: "settings.trusted-contacts.remove", name: "lfaa_settings_trusted_contact_remove", coreManaged: true, applicationIds: [...APPLICATION_IDS], activityTitle: "撤销受信联系人关系",
    description: "撤销当前账户与指定本机账户之间的受信关系，并使双方未完成的恢复请求失效。邀请码只能由用户在设置页创建或输入，Agent 不接收邀请码。",
    schema: strictObject({ contactId: { type: "string", minLength: 36, maxLength: 36, pattern: "^[0-9a-f-]{36}$" } }, ["contactId"]),
    parse: value => parse(Joi.object({ contactId: Joi.string().guid({ version: ["uuidv4", "uuidv5"] }).required() }).unknown(false), value),
    risk: () => "dangerous",
    approval: (parameters, context) => ({ scopeKey: `settings:trusted-contact:remove:${context.userId}:${String(parameters.contactId)}`, scopeSummary: `撤销受信联系人 · ${String(parameters.contactId)}`, summary: `撤销当前账户与本机账户 ${String(parameters.contactId)} 的受信恢复关系` }),
    execute: async (parameters, context) => {
      context.signal.throwIfAborted();
      if (!removeTrustedContact(context.userId, String(parameters.contactId))) throw new Error("找不到当前账户与该本机账户之间的受信关系。");
      return { source: "identity-auth-owner", removed: true, ...listTrustedContactSettings(context.userId) };
    }
  }),
  makeTool({
    id: "settings.trusted-recovery.approve", name: "lfaa_settings_trusted_recovery_approve", coreManaged: true, applicationIds: [...APPLICATION_IDS], activityTitle: "批准本机账户恢复请求",
    description: "由当前已认证的受信联系人批准一条精确的本机账户密码恢复请求。不会接触恢复码或新密码；恢复码由申请人自行保管并在登录页完成重置。",
    schema: strictObject({ requestId: { type: "string", minLength: 36, maxLength: 36, pattern: "^[0-9a-f-]{36}$" } }, ["requestId"]),
    parse: value => parse(Joi.object({ requestId: Joi.string().guid({ version: ["uuidv4", "uuidv5"] }).required() }).unknown(false), value),
    risk: () => "dangerous",
    approval: (parameters, context) => ({ scopeKey: `settings:trusted-recovery:approve:${context.userId}:${String(parameters.requestId)}`, scopeSummary: `批准账户恢复 · ${String(parameters.requestId)}`, summary: `批准本机受信联系人恢复请求 ${String(parameters.requestId)}` }),
    execute: async (parameters, context) => {
      context.signal.throwIfAborted();
      const request = approveTrustedAccountRecovery(context.userId, String(parameters.requestId));
      if (!request) throw new Error("恢复请求已过期、已经处理或不属于当前账户。");
      return { source: "identity-auth-owner", approved: true, request };
    }
  }),
  makeTool({
    id: "settings.snapshots.list", name: "lfaa_settings_snapshot_list", coreManaged: true, applicationIds: [...APPLICATION_IDS], activityTitle: "读取账户快照列表",
    description: "读取当前账户已有快照的名称、创建时间、大小和设置/记忆/会话数量，不返回对话正文。",
    schema: strictObject({}), parse: value => parse(Joi.object({}).unknown(false), value), risk: () => "read",
    execute: async (_parameters, context) => { context.signal.throwIfAborted(); return { source: "settings-snapshots-owner", snapshots: listAccountSnapshots(context.userId) }; }
  }),
  makeTool({
    id: "settings.snapshots.create", name: "lfaa_settings_snapshot_create", coreManaged: true, applicationIds: [...APPLICATION_IDS], activityTitle: "创建账户资料快照",
    description: "为当前账户创建包含可移植设置、会话记忆和公开对话文本的真实持久化快照。权限模式、凭据、插件/MCP 连接、浏览器/电脑访问权限、本机路径、图片素材与运行中任务不会进入快照。返回写入后回读的摘要。",
    schema: strictObject({ name: { type: "string", minLength: 1, maxLength: 120 } }, ["name"]),
    parse: value => parse(Joi.object({ name: Joi.string().trim().min(1).max(120).required() }).unknown(false), value),
    risk: () => "write",
    approval: (parameters, context) => ({ scopeKey: `settings:snapshot:create:${context.userId}:${String(parameters.name).trim().slice(0, 120)}`, scopeSummary: `创建账户快照 · ${String(parameters.name).slice(0, 80)}`, summary: `为当前账户创建资料快照“${String(parameters.name).slice(0, 80)}”` }),
    execute: async (parameters, context) => { context.signal.throwIfAborted(); return { source: "settings-snapshots-owner", snapshot: createAccountSnapshot(context.userId, String(parameters.name)) }; }
  }),
  makeTool({
    id: "settings.snapshots.preview", name: "lfaa_settings_snapshot_preview", coreManaged: true, applicationIds: [...APPLICATION_IDS], activityTitle: "预览账户快照恢复范围",
    description: "读取快照的账户归属和完整性，并预览设置变更、记忆条数、会话冲突数；不会返回会话正文或写入。",
    schema: strictObject({ snapshotId: { type: "string", minLength: 36, maxLength: 36, pattern: "^[0-9a-f-]{36}$" } }, ["snapshotId"]),
    parse: value => parse(Joi.object({ snapshotId: Joi.string().guid({ version: ["uuidv4", "uuidv5"] }).required() }).unknown(false), value),
    risk: () => "read",
    execute: async (parameters, context) => {
      context.signal.throwIfAborted();
      const snapshot = readAccountSnapshot(context.userId, String(parameters.snapshotId));
      if (!snapshot) throw new Error("找不到当前账户的该快照。");
      return { source: "settings-snapshots-owner", snapshot: snapshot.summary, preview: previewAccountArchive(context.userId, snapshot.archive) };
    }
  }),
  makeTool({
    id: "settings.snapshots.restore", name: "lfaa_settings_snapshot_restore", coreManaged: true, applicationIds: [...APPLICATION_IDS], activityTitle: "恢复账户资料快照",
    description: "按用户明确选择恢复设置、会话记忆和/或会话。会话恢复为已归档的独立会话并跳过同 ID 冲突；设置恢复不改权限模式、插件/MCP 连接、电脑/浏览器访问权限或秘密凭据。调用前必须先读取对应快照并预览变更。",
    schema: strictObject({ snapshotId: { type: "string", minLength: 36, maxLength: 36, pattern: "^[0-9a-f-]{36}$" }, settings: { type: "boolean" }, memories: { type: "boolean" }, sessions: { type: "boolean" } }, ["snapshotId", "settings", "memories", "sessions"]),
    parse: value => parse(Joi.object({ snapshotId: Joi.string().guid({ version: ["uuidv4", "uuidv5"] }).required(), settings: Joi.boolean().required(), memories: Joi.boolean().required(), sessions: Joi.boolean().required() }).unknown(false), value),
    risk: () => "dangerous",
    approval: (parameters, context) => ({ scopeKey: `settings:snapshot:restore:${context.userId}:${String(parameters.snapshotId)}:${String(parameters.settings)}:${String(parameters.memories)}:${String(parameters.sessions)}`, scopeSummary: `恢复账户快照 · ${String(parameters.snapshotId)}`, summary: `恢复账户快照并应用用户选择的设置/记忆/会话范围` }),
    execute: async (parameters, context) => {
      context.signal.throwIfAborted();
      const snapshot = readAccountSnapshot(context.userId, String(parameters.snapshotId));
      if (!snapshot) throw new Error("找不到当前账户的该快照。");
      const result = restoreAccountArchive(context.userId, snapshot.archive, { settings: Boolean(parameters.settings), memories: Boolean(parameters.memories), sessions: Boolean(parameters.sessions) });
      return { source: "settings-snapshots-owner", snapshot: snapshot.summary, result };
    }
  }),
  makeTool({
    id: "settings.snapshots.delete", name: "lfaa_settings_snapshot_delete", coreManaged: true, applicationIds: [...APPLICATION_IDS], activityTitle: "删除账户资料快照",
    description: "永久删除当前账户选定的本地资料快照。删除后不能从 LFAA 快照列表恢复；原始设置、记忆和会话不受影响。",
    schema: strictObject({ snapshotId: { type: "string", minLength: 36, maxLength: 36, pattern: "^[0-9a-f-]{36}$" } }, ["snapshotId"]),
    parse: value => parse(Joi.object({ snapshotId: Joi.string().guid({ version: ["uuidv4", "uuidv5"] }).required() }).unknown(false), value),
    risk: () => "dangerous",
    approval: (parameters, context) => ({ scopeKey: `settings:snapshot:delete:${context.userId}:${String(parameters.snapshotId)}`, scopeSummary: `删除账户快照 · ${String(parameters.snapshotId)}`, summary: `删除当前账户快照 ${String(parameters.snapshotId)}` }),
    execute: async (parameters, context) => {
      context.signal.throwIfAborted();
      if (!deleteAccountSnapshot(context.userId, String(parameters.snapshotId))) throw new Error("找不到当前账户的该快照。");
      return { source: "settings-snapshots-owner", deleted: true, snapshotId: String(parameters.snapshotId), remaining: listAccountSnapshots(context.userId).length };
    }
  })
];
