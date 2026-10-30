/**
 * 功能：为 Agent 提供 Settings Owner 管理的账户偏好目录与单项更新。
 * 作用：限制可见/可写路径、沿用类别校验与持久化，并把权限模式和领域配置留给其原 Owner。
 * 关联文件：core/tools/settings-tools.ts、service.ts、validation.ts。
 */
import { defaultSettings, getUserSettings, listAiAccounts, listAiModelRoutes, listUserBackgroundOptionMetadata, saveUserSettings } from "./service.js";
import type { SettingsCategory, UserSettings } from "lfaa-util-values/src/settings-contract.js";
import { appearanceBackgroundOptions, appearanceBackgroundTargets } from "lfaa-util-values/src/builtin-backgrounds.js";
import { SETTINGS_CENTER_MENUS, type SettingsCenterMenuDefinition, type SettingsMenuId } from "lfaa-util-values/src/settings-menu-catalog.js";
import { settingsSchemas } from "./validation.js";

type SettingsRoot = keyof UserSettings;
type JoiDescription = {
  type?: string;
  keys?: Record<string, JoiDescription>;
  allow?: unknown[];
  flags?: { only?: boolean };
  rules?: Array<{ name: string; args?: Record<string, unknown> }>;
  matches?: Array<{ schema?: JoiDescription }>;
  items?: JoiDescription[];
};

const categoryByRoot: Record<SettingsRoot, { category: SettingsCategory; label: string; menuIds: SettingsMenuId[] }> = {
  general: { category: "general", label: "常规", menuIds: ["general", "notifications"] },
  appearance: { category: "appearance", label: "外观", menuIds: ["appearance"] },
  shortcuts: { category: "shortcuts", label: "键盘快捷键", menuIds: ["shortcuts"] },
  aiRuntime: { category: "ai-runtime", label: "AI 与模型", menuIds: ["ai", "voice"] },
  minecraftRuntime: { category: "minecraft-runtime", label: "Minecraft 配置", menuIds: ["minecraft"] },
  git: { category: "git", label: "Git", menuIds: ["git"] },
  permissions: { category: "permissions", label: "用户与权限", menuIds: ["permissions"] },
  plugins: { category: "plugins", label: "AI 扩展与 MCP", menuIds: ["plugins", "profilePlugins", "connections"] },
  personalization: { category: "personalization", label: "个性化", menuIds: ["personalization"] },
  computerControl: { category: "computer-control", label: "电脑操控", menuIds: ["computerControl"] },
  browserUse: { category: "browser-use", label: "浏览器", menuIds: ["browser"] },
  mini: { category: "mini", label: "Mini 与虚拟宠物", menuIds: ["mini"] },
  canvas: { category: "canvas", label: "画布", menuIds: ["canvas"] }
};

function menuLabels(menuIds: readonly string[]): string[] {
  return menuIds.flatMap(id => {
    const menu = SETTINGS_CENTER_MENUS.find(item => item.id === id);
    return menu ? [menu.label] : [];
  });
}

const settingKeyLabels: Record<string, string> = {
  defaultMode: "默认工作模式", showServiceStatus: "显示服务状态", showBottomPanelControl: "显示底部面板控制", taskFolder: "默认任务目录",
  fileOpenLocation: "文件打开位置", agentEnvironment: "Agent 运行环境", integratedShell: "集成终端", language: "界面语言",
  defaultFullView: "默认完整视图", navigationLayout: "工作台导航布局", hiddenApplicationNavigationIds: "隐藏的应用菜单",
  cardMotionEffect: "卡片动效", dialogMotionEffect: "弹窗动效", terminalPosition: "终端位置", plainTextEditor: "纯文本编辑器",
  sendShortcut: "发送快捷键", followupBehavior: "后续消息处理方式", popupShortcut: "弹窗快捷键", defaultStandaloneChat: "默认独立聊天",
  notificationPopupsEnabled: "通知总开关", completionNotification: "回复完成通知", permissionNotifications: "权限请求提醒",
  questionNotifications: "澄清问题提醒", sessionIssueNotifications: "会话错误提醒", notificationSound: "通知提示音",
  notificationToastDurationSeconds: "通知提示卡时长", notificationToastEffect: "通知提示卡动效",
  aiProviderReminderEnabled: "AI Provider 提醒", setupReminderEnabled: "内容存储提醒", defaultAdminCredentialReminderEnabled: "默认管理员凭据提醒",
  confettiEnabled: "庆祝效果", theme: "主题", accentColor: "强调色", sidebarColor: "侧边栏颜色", backgrounds: "背景图片",
  wallpaperEngine: "动态壁纸", enabled: "启用状态", projectId: "壁纸项目", overlay: "背景遮罩透明度", blur: "玻璃模糊",
  updateSurfaceOpacity: "更新界面不透明度", advanced: "高级外观", interfaceFontSize: "界面字号", codeFontSize: "代码字号",
  reducedMotion: "减少动态效果", authTransitionPluginId: "登录转场动画", separateModes: "分别设置浅色和深色模式",
  fonts: "字体", interface: "界面字体", content: "内容字体", code: "代码字体", modeStyles: "主题样式",
  translucentSidebar: "半透明侧边栏", contrast: "对比度", diffMarkers: "差异标记", pointerCursor: "指针光标",
  aiWorkOutputFocusBlurEnabled: "空闲时虚化回复", aiWorkOutputFocusBlurPercent: "回复虚化程度",
  aiWorkOutputFocusBlurIdleSeconds: "回复虚化等待时间", aiWorkOutputFocusBlurAmount: "旧版回复虚化量",
  writingLightRaysEnabled: "写作光线背景",
  openSettings: "打开设置中心快捷键", openHome: "打开首页快捷键", openSteamcmd: "打开 SteamCMD 快捷键",
  openMinecraft: "打开 Minecraft 快捷键", openWriting: "打开写作快捷键", toggleSidebar: "切换侧栏快捷键",
  toggleContextPanel: "切换上下文面板快捷键", toggleBottomPanel: "切换底部面板快捷键", openTerminal: "打开终端快捷键",
  switchNormalMode: "切换常规模式快捷键", switchAiWorkMode: "切换 AI Work 模式快捷键", openSideChat: "打开侧聊快捷键",
  wallpaperSidebarToggle: "切换壁纸侧栏快捷键", speed: "Agent 响应速度", promptSuggestions: "提示建议", showContextUsage: "显示上下文使用情况",
  requestTimeoutSeconds: "模型无进展超时", requestRetries: "模型请求重试次数", retryDelaySeconds: "重试等待时间",
  maxOutputTokens: "最大输出 Token 数", maxModelRequests: "单轮模型请求预算", maxToolCalls: "单轮工具调用预算",
  subagentAccountId: "子 Agent 模型账户", imageGenerationMode: "图片生成方式", imageGenerationAccountId: "图片生成账户",
  imageGenerationModelId: "图片生成模型", imageGenerationLocalModelId: "本地图片模型", imageGenerationLocalTimeoutSeconds: "本地图片模型加载时限",
  imageGenerationUnloadAfterMinutes: "本地图片模型空闲释放时间", videoGenerationMode: "视频生成方式", videoGenerationLocalModelId: "本地视频模型",
  videoGenerationLocalTimeoutSeconds: "本地视频模型加载时限", videoGenerationUnloadAfterMinutes: "本地视频模型空闲释放时间",
  videoGenerationAccountId: "视频生成账户", videoGenerationModelId: "视频生成模型", videoTranscriptionAccountId: "视频语音识别账户", videoGenerationDurationSeconds: "视频时长",
  videoGenerationRatio: "视频画面比例", videoGenerationResolution: "视频分辨率", videoGenerationGenerateAudio: "生成视频音频",
  videoGenerationWatermark: "视频水印", maxSubagents: "最大子 Agent 数量", maxDelegationDepth: "最大委派深度",
  voiceInputEnabled: "语音输入", readResponsesAloud: "播报完成回复", commandTimeoutSeconds: "命令超时",
  contextWindowTokens: "上下文窗口 Token 数", autoCompaction: "自动压缩上下文", minecraftReadyTimeoutSeconds: "Minecraft 就绪等待时限",
  minecraftStopTimeoutSeconds: "Minecraft 停止时限", minecraftDefaultMemoryMb: "Minecraft 默认内存",
  minecraftDefaultPort: "Minecraft 默认端口", minecraftDownloadTimeoutSeconds: "Minecraft 下载时限",
  minecraftInstallTimeoutSeconds: "Minecraft 安装时限", minecraftExecutionMode: "Minecraft 执行方式",
  minecraftDefaultCore: "Minecraft 默认核心", minecraftBedrockDefaultPort: "Minecraft 基岩版默认端口",
  branchPrefix: "Git 分支名前缀", mode: "操作权限模式", skillDirectories: "Skill 来源目录", disabledSkillNames: "停用的 Skill",
  mcpServers: "MCP 服务", prompts: "提示词", memoryEnabled: "个性化记忆", memoryFromToolChats: "从工具对话整理记忆",
  webUrlOpenLocation: "网页打开位置", localUrlOpenLocation: "本地 URL 打开位置", enabledProviderIds: "个人浏览器连接",
  showFullUrl: "显示完整网址", recordRecentSites: "记录最近访问网站", allowAgentHistoryAccess: "允许 Agent 读取浏览历史",
  annotateScreenshots: "批注截图策略", useWebsiteToolsByDefault: "默认使用网站工具", websiteToolOverrides: "网站工具权限例外",
  askBeforeDownload: "下载前询问保存位置", sitePermissionDefaults: "网站权限默认值", sitePermissionOverrides: "网站权限例外",
  developerMode: "浏览器开发者模式", fullCdpAccess: "完整 CDP 访问权限", searchEngine: "默认搜索引擎",
  companion: "虚拟伙伴外观", showCompanion: "显示虚拟伙伴", alwaysOnTop: "Mini 窗口置顶", opacity: "Mini 窗口不透明度"
};

const exactSettingLabels: Record<string, string> = {
  "appearance.backgrounds.login": "登录页（当前设备）背景图片",
  "appearance.backgrounds.appCenter": "小鱼智能体工作区背景图片",
  "appearance.backgrounds.steamcmd": "SteamCMD 工作区背景图片",
  "appearance.backgrounds.minecraft": "Minecraft 工作区背景图片",
  "appearance.backgrounds.writing": "写作工作区背景图片",
  "appearance.backgrounds.settings": "设置中心背景图片",
  "appearance.advanced.modeStyles.light.accentColor": "浅色模式强调色",
  "appearance.advanced.modeStyles.dark.accentColor": "深色模式强调色",
  "general.notificationPopupsEnabled": "通知总开关",
  "general.completionNotification": "小鱼智能体回复完成提醒",
  "general.permissionNotifications": "AI 工具权限请求提醒",
  "general.questionNotifications": "小鱼智能体澄清问题提醒",
  "general.sessionIssueNotifications": "小鱼智能体会话错误提醒",
  "general.notificationToastDurationSeconds": "Minecraft 操作提示卡时长",
  "general.notificationToastEffect": "Minecraft 操作提示卡动效",
  "browserUse.sitePermissionDefaults.camera": "摄像头网站权限默认值",
  "browserUse.sitePermissionDefaults.microphone": "麦克风网站权限默认值",
  "browserUse.sitePermissionDefaults.geolocation": "位置信息网站权限默认值",
  "browserUse.sitePermissionDefaults.notifications": "网站通知权限默认值",
  "canvas.defaultMode": "画布默认打开模式",
  "canvas.gridStyle": "画布网格样式",
  "canvas.snapToGrid": "画布拖动吸附网格",
  "canvas.showMiniMap": "画布小地图",
  "canvas.agentPanelDefaultOpen": "画布 Agent 面板默认展开"
};

const notificationSettingPaths = new Set([
  "general.notificationPopupsEnabled", "general.completionNotification", "general.permissionNotifications",
  "general.questionNotifications", "general.sessionIssueNotifications", "general.notificationSound",
  "general.notificationToastDurationSeconds", "general.notificationToastEffect"
]);

const exactOptionLabels: Record<string, Record<string, string>> = {
  "appearance.theme": { light: "浅色", dark: "深色", system: "跟随系统" },
  "general.defaultMode": { normal: "常规", "ai-work": "AI Work" },
  "general.fileOpenLocation": { system: "系统默认应用", ask: "每次询问" },
  "general.agentEnvironment": { system: "系统默认", "windows-native": "Windows 原生", wsl: "WSL", linux: "Linux" },
  "general.integratedShell": { system: "系统默认", powershell: "PowerShell", cmd: "命令提示符", bash: "Bash", zsh: "Zsh" },
  "general.language": { system: "跟随系统", "zh-CN": "简体中文", "en-US": "English" },
  "general.navigationLayout": { "left-two-column": "左侧双列", "three-column": "三列布局", "right-tools": "右侧工具", focus: "专注模式" },
  "general.sendShortcut": { enter: "Enter", "ctrl-enter": "Ctrl+Enter" },
  "general.followupBehavior": { queue: "加入队列", steer: "调整当前任务" },
  "general.completionNotification": { always: "始终", unfocused: "仅工作台未聚焦时", never: "关闭" },
  "general.notificationSound": { default: "默认", subtle: "轻柔", off: "关闭" },
  "general.notificationToastEffect": { fluid: "柔和流体", fade: "渐隐淡入", lift: "轻盈上浮", none: "静态" },
  "appearance.sidebarColor": { auto: "跟随主题" },
  "appearance.advanced.reducedMotion": { system: "跟随系统", on: "开启", off: "关闭" },
  "appearance.advanced.fonts.interface": { system: "系统默认", sans: "无衬线", serif: "衬线" },
  "appearance.advanced.fonts.content": { system: "系统默认", sans: "无衬线", serif: "衬线" },
  "appearance.advanced.fonts.code": { system: "系统默认", cascadia: "Cascadia Code", consolas: "Consolas", jetbrains: "JetBrains Mono" },
  "appearance.advanced.modeStyles.light.fonts.interface": { system: "系统默认", sans: "无衬线", serif: "衬线" },
  "appearance.advanced.modeStyles.light.fonts.content": { system: "系统默认", sans: "无衬线", serif: "衬线" },
  "appearance.advanced.modeStyles.light.fonts.code": { system: "系统默认", cascadia: "Cascadia Code", consolas: "Consolas", jetbrains: "JetBrains Mono" },
  "appearance.advanced.modeStyles.dark.fonts.interface": { system: "系统默认", sans: "无衬线", serif: "衬线" },
  "appearance.advanced.modeStyles.dark.fonts.content": { system: "系统默认", sans: "无衬线", serif: "衬线" },
  "appearance.advanced.modeStyles.dark.fonts.code": { system: "系统默认", cascadia: "Cascadia Code", consolas: "Consolas", jetbrains: "JetBrains Mono" },
  "appearance.advanced.diffMarkers": { color: "颜色", symbols: "+/− 标记" },
  "aiRuntime.speed": { balanced: "均衡", fast: "快速", deep: "深入" },
  "aiRuntime.imageGenerationMode": { provider: "远程服务商", local: "LFAA 本机模型" },
  "aiRuntime.videoGenerationMode": { provider: "远程服务商", local: "LFAA 本机模型" },
  "aiRuntime.videoGenerationRatio": { adaptive: "自适应", "16:9": "横屏 16:9", "9:16": "竖屏 9:16", "1:1": "正方形", "4:3": "横屏 4:3", "3:4": "竖屏 3:4" },
  "aiRuntime.videoGenerationResolution": { "480p": "480p", "720p": "720p", "1080p": "1080p" },
  "minecraftRuntime.minecraftExecutionMode": { native: "原生进程", appcontainer: "AppContainer 隔离" },
  "permissions.mode": { ask: "请求审批", approve_remembered: "替我审批", full_access: "完全访问" },
  "browserUse.webUrlOpenLocation": { lfaa: "LFAA 内置浏览器", "current-browser": "当前已打开的浏览器" },
  "browserUse.localUrlOpenLocation": { lfaa: "LFAA 内置浏览器", "current-browser": "当前已打开的浏览器" },
  "browserUse.annotateScreenshots": { always: "始终包含", "on-demand": "按需包含", never: "从不包含" },
  "browserUse.searchEngine": { bing: "Bing", google: "Google", duckduckgo: "DuckDuckGo" },
  "mini.companion": { moss: "苔影", cloud: "云朵", ember: "微光" },
  "canvas.defaultMode": { generate: "生成工作台", canvas: "画布编排" },
  "canvas.gridStyle": { dots: "点阵", lines: "线框", none: "关闭" }
};

const genericOptionLabels: Record<string, string> = { ask: "询问", allow: "允许", block: "阻止", true: "开启", false: "关闭" };

function allowedValuesFromSchema(schema: JoiDescription): unknown[] {
  if (schema.flags?.only && Array.isArray(schema.allow)) return schema.allow.filter(value => value !== null && ["string", "number", "boolean"].includes(typeof value));
  if (schema.type === "alternatives") return [...new Set((schema.matches ?? []).flatMap(match => match.schema ? allowedValuesFromSchema(match.schema) : []))];
  return [];
}

function itemValuesFromSchema(schema: JoiDescription): unknown[] {
  return [...new Set((schema.items ?? []).flatMap(item => allowedValuesFromSchema(item)))];
}

function fieldMenuIds(path: string, category: SettingsCategory): SettingsMenuId[] {
  if (notificationSettingPaths.has(path)) return ["general", "notifications"];
  if (["aiRuntime.voiceInputEnabled", "aiRuntime.readResponsesAloud"].includes(path)) return ["voice"];
  if (path === "plugins.mcpServers") return ["connections"];
  if (path.startsWith("mini.")) return ["mini"];
  if (path.startsWith("plugins.")) return ["plugins", "profilePlugins"];
  return Object.values(categoryByRoot).find(item => item.category === category)?.menuIds.slice(0, 1) ?? [];
}

function fieldLabel(path: string, categoryLabel: string): string {
  if (exactSettingLabels[path]) return exactSettingLabels[path];
  const areaEffect = path.match(/^appearance\.areaEffects\.(login|appCenter|steamcmd|minecraft|writing|settings)\.(overlay|blur)$/u);
  if (areaEffect) {
    const area = appearanceBackgroundTargets.find(item => item.id === areaEffect[1])?.label ?? "此位置";
    return `${area} · ${areaEffect[2] === "overlay" ? "背景遮罩" : "玻璃模糊"}`;
  }
  const key = path.split(".").at(-1) ?? path;
  return `${categoryLabel} · ${settingKeyLabels[key] ?? key.replace(/([a-z0-9])([A-Z])/gu, "$1 $2")}`;
}

function fieldDescription(path: string, menus: string[]): string {
  if (path.startsWith("appearance.backgrounds.")) {
    const targetId = path.slice("appearance.backgrounds.".length);
    const target = appearanceBackgroundTargets.find(item => item.id === targetId);
    return `只控制${target?.label ?? "此背景位置"}；六个背景位置分别保存，更新这一项不会改动其他位置。none 对应“纯色”。登录页只允许选择内置背景。`;
  }
  if (path.startsWith("appearance.areaEffects.")) {
    const [, , targetId, effect] = path.split(".");
    const target = appearanceBackgroundTargets.find(item => item.id === targetId);
    return `只控制${target?.label ?? "此位置"}的${effect === "overlay" ? "背景遮罩" : "玻璃模糊"}；传 null 可清除区域覆盖并恢复继承全局 Appearance 值。`;
  }
  return `设置中心“${menus.join(" / ") || "账户设置"}”中的单项偏好；仅影响此字段。`;
}

function optionLabel(path: string, value: unknown): string {
  const text = String(value);
  if (path.startsWith("appearance.backgrounds.")) return appearanceBackgroundOptions.find(item => item.id === text)?.name ?? text;
  return exactOptionLabels[path]?.[text] ?? genericOptionLabels[text] ?? text;
}

const settingsToolOnlyPaths: Record<string, string> = {
  "permissions.mode": "权限模式由用户在设置中心掌握；Agent 只能按当前模式执行，不能替用户改模式。",
  "plugins.enabled": "扩展总开关由 lfaa_set_capability_enabled 管理，并验证当前真实能力。",
  "computerControl.enabled": "电脑操控开关由 lfaa_set_capability_enabled 管理，并验证当前真实能力。",
  "browserUse.enabled": "Browser Use 开关由 lfaa_set_capability_enabled 管理，并验证当前真实能力。",
  "browserUse.enabledProviderIds": "个人浏览器连接由 Browser Owner 管理，以便断开时关闭对应账户会话。"
};
const privateOwnerPaths = new Set(["plugins.mcpServers", "plugins.prompts", "plugins.skillDirectories"]);

function readPath(root: unknown, path: string): unknown {
  let value = root;
  for (const segment of path.split(".")) {
    if (!value || typeof value !== "object" || Array.isArray(value) || !Object.hasOwn(value, segment)) return undefined;
    value = (value as Record<string, unknown>)[segment];
  }
  return value;
}

function collectLeaves(value: unknown, defaultValue: unknown, schema: JoiDescription, path: string, category: SettingsCategory, categoryLabel: string, userBackgrounds: Array<{ id: string; name: string }>, result: AgentSettingField[]): void {
  if (value && typeof value === "object" && !Array.isArray(value) && schema.keys) {
    const record = value as Record<string, unknown>;
    const defaults = defaultValue && typeof defaultValue === "object" && !Array.isArray(defaultValue) ? defaultValue as Record<string, unknown> : {};
    for (const [key, childSchema] of Object.entries(schema.keys)) {
      if (Object.hasOwn(record, key) || Object.hasOwn(defaults, key)) collectLeaves(record[key] ?? defaults[key], defaults[key], childSchema, path ? `${path}.${key}` : key, category, categoryLabel, userBackgrounds, result);
    }
    return;
  }
  const reason = settingsToolOnlyPaths[path];
  const writable = !reason;
  const rules = schema.rules ?? [];
  const minimum = rules.find(rule => rule.name === "min")?.args?.limit;
  const maximum = rules.find(rule => rule.name === "max")?.args?.limit;
  const menuIds = fieldMenuIds(path, category);
  const menuNames = menuLabels(menuIds);
  const label = fieldLabel(path, categoryLabel);
  const allowedValues = path.startsWith("appearance.backgrounds.")
    ? [
      ...appearanceBackgroundOptions.map(item => item.id),
      ...(path === "appearance.backgrounds.login" ? [] : userBackgrounds.map(item => item.id))
    ]
    : allowedValuesFromSchema(schema);
  const allowedOptions = path.startsWith("appearance.backgrounds.")
    ? [
      ...appearanceBackgroundOptions.map(item => ({ value: item.id, label: item.name })),
      ...(path === "appearance.backgrounds.login" ? [] : userBackgrounds.map(item => ({ value: item.id, label: `自定义 · ${item.name}` })))
    ]
    : allowedValues.map(option => ({ value: option, label: optionLabel(path, option) }));
  const allowedItemValues = itemValuesFromSchema(schema);
  result.push({
    path,
    category,
    categoryLabel,
    menuIds,
    menuLabels: menuNames,
    label,
    description: fieldDescription(path, menuNames),
    value,
    defaultValue,
    valueType: Array.isArray(value) ? "array" : value === null ? "null" : typeof value,
    ...(allowedValues.length > 0 ? { allowedValues, allowedOptions } : {}),
    ...(allowedItemValues.length > 0 ? { allowedItemValues, allowedItemOptions: allowedItemValues.map(option => ({ value: option, label: optionLabel(path, option) })) } : {}),
    ...(typeof minimum === "number" ? { minimum } : {}),
    ...(typeof maximum === "number" ? { maximum } : {}),
    writable,
    ...(reason ? { readOnlyReason: reason, ownerTool: path === "permissions.mode" ? "用户设置中心" : path === "browserUse.enabledProviderIds" ? "lfaa_browser_manage_settings" : "lfaa_set_capability_enabled" } : {})
  });
}

export interface AgentSettingField {
  path: string;
  category: SettingsCategory;
  categoryLabel: string;
  menuIds: SettingsMenuId[];
  menuLabels: string[];
  label: string;
  description: string;
  value: unknown;
  defaultValue: unknown;
  valueType: string;
  allowedValues?: unknown[];
  allowedOptions?: Array<{ value: unknown; label: string }>;
  allowedItemValues?: unknown[];
  allowedItemOptions?: Array<{ value: unknown; label: string }>;
  minimum?: number;
  maximum?: number;
  writable: boolean;
  readOnlyReason?: string;
  ownerTool?: string;
}

export interface AgentSettingsQuery {
  category?: SettingsCategory;
  menuId?: SettingsMenuId;
  query?: string;
  offset?: number;
  limit?: number;
}

export interface AgentSettingsDirectory {
  categories: Array<{ id: SettingsCategory; label: string; menuLabels: string[] }>;
  menus: SettingsCenterMenuDefinition[];
  total: number;
  offset: number;
  limit: number;
  entries: AgentSettingField[];
  modelRoutes?: ReturnType<typeof listAiModelRoutes>;
}

/** 按当前账户的已校验 Settings 与 Joi 合同生成有界字段目录；秘密/运行连接配置不进入模型上下文。 */
export function listAgentSettings(userId: string, input: AgentSettingsQuery = {}): AgentSettingsDirectory {
  if (input.category && !Object.values(categoryByRoot).some(item => item.category === input.category)) throw new Error("设置分类无效。");
  if (input.menuId && !SETTINGS_CENTER_MENUS.some(menu => menu.id === input.menuId)) throw new Error("设置菜单无效。");
  if (input.query !== undefined && (typeof input.query !== "string" || input.query.trim().length > 120)) throw new Error("设置搜索词无效。");
  const requestedOffset = input.offset ?? 0;
  const requestedLimit = input.limit ?? 30;
  if (!Number.isInteger(requestedOffset) || requestedOffset < 0 || requestedOffset > 1000 || !Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 50) throw new Error("设置目录分页参数无效。");
  const settings = getUserSettings(userId);
  const normalizedQuery = input.query?.trim().toLocaleLowerCase("zh-CN") ?? "";
  const userBackgrounds = input.category === "appearance" || input.menuId === "appearance" || /background|背景|外观|自定义/u.test(normalizedQuery) ? listUserBackgroundOptionMetadata(userId) : [];
  const fields: AgentSettingField[] = [];
  for (const root of Object.keys(categoryByRoot) as SettingsRoot[]) {
    const { category, label } = categoryByRoot[root];
    const schema = settingsSchemas[category].describe() as JoiDescription;
    collectLeaves(settings[root], defaultSettings[root], schema, root, category, label, userBackgrounds, fields);
  }
  const visible = fields.filter(field => !privateOwnerPaths.has(field.path));
  const query = normalizedQuery;
  const requestedCategory = input.category;
  const filtered = !requestedCategory && !input.menuId && !query ? [] : visible.filter(field => (!requestedCategory || field.category === requestedCategory)
    && (!input.menuId || field.menuIds.includes(input.menuId))
    && (!query || `${field.path} ${field.categoryLabel} ${field.menuLabels.join(" ")} ${field.label} ${field.description} ${(field.allowedOptions ?? []).map(option => `${option.value} ${option.label}`).join(" ")}`.toLocaleLowerCase("zh-CN").includes(query)));
  const allMenus: readonly SettingsCenterMenuDefinition[] = SETTINGS_CENTER_MENUS;
  const matchingMenus: SettingsCenterMenuDefinition[] = input.menuId
    ? allMenus.filter(menu => menu.id === input.menuId)
    : input.category
      ? allMenus.filter(menu => menu.settingsCategory === input.category)
      : query
        ? allMenus.filter(menu => `${menu.id} ${menu.label} ${menu.group} ${(menu.aliases ?? []).join(" ")} ${menu.description} ${(menu.toolSearchTerms ?? []).join(" ")}`.toLocaleLowerCase("zh-CN").includes(query))
        : [...allMenus];
  const offset = requestedOffset;
  const limit = requestedLimit;
  return {
    categories: Object.values(categoryByRoot).map(({ category, label, menuIds }) => ({ id: category, label, menuLabels: menuLabels(menuIds) })),
    menus: matchingMenus.map(menu => ({ ...menu })),
    total: filtered.length,
    offset,
    limit,
    entries: filtered.slice(offset, offset + limit),
    ...(input.category === "ai-runtime" ? { modelRoutes: listAiModelRoutes(userId) } : {})
  };
}

/** 单字段写入经同一 Settings Owner 校验和账户持久化，拒绝权限模式及应走专用 Owner 的字段。 */
export function updateAgentSetting(userId: string, path: string, nextValue: unknown): { path: string; previousValue: unknown; value: unknown; changed: boolean } {
  if (typeof path !== "string" || path.length < 3 || path.length > 160) throw new Error("设置路径无效。未修改设置。");
  const current = getUserSettings(userId);
  const directory = listAgentSettings(userId, { query: path, limit: 50 });
  const field = directory.entries.find(entry => entry.path === path);
  if (!field) throw new Error("找不到该账户设置项；请先从 Settings Owner 的设置目录中查询精确路径。未修改设置。");
  if (!field.writable) throw new Error(field.readOnlyReason ?? "该设置由专属 Owner 管理，通用设置工具不会修改。");
  if (privateOwnerPaths.has(path)) throw new Error("该连接配置由专属 Owner 管理，通用设置工具不会读取或修改。");
  if (path.startsWith("appearance.backgrounds.") && !field.allowedValues?.includes(nextValue)) {
    throw new Error("背景只能选择当前设置目录中的内置图片或此账户已上传的图片；未修改设置。");
  }
  if (path === "browserUse.fullCdpAccess" && nextValue === true && !current.browserUse.developerMode) {
    throw new Error("完整 CDP 访问需要先由用户开启浏览器开发者模式；当前未修改设置。");
  }
  const routeOptions = listAiModelRoutes(userId);
  if (["aiRuntime.subagentAccountId", "aiRuntime.videoGenerationAccountId"].includes(path)
    && nextValue !== "" && (typeof nextValue !== "string" || !routeOptions.some(route => route.accountId === nextValue))) {
    throw new Error("AI 账户必须来自设置中心当前账户的真实模型路由目录；未修改设置。");
  }
  if (path === "aiRuntime.imageGenerationAccountId" && nextValue !== "") {
    const account = typeof nextValue === "string" ? listAiAccounts(userId).find(item => item.id === nextValue) : undefined;
    const hasPlanImageModel = account?.models.some(model => model.taskType === "image-generation" && (
      !model.planTiers?.length || !account.options.planTier || account.options.planTier === "unknown"
      || model.planTiers.includes(account.options.planTier as NonNullable<typeof model.planTiers>[number])
    ));
    if (!account?.hasSecret || account.providerId !== "openai" && account.providerId !== "doubao" && account.providerId !== "ark-agent-plan"
      || account.providerId === "ark-agent-plan" && !hasPlanImageModel) {
      throw new Error("图片生成账户必须是当前用户已保存且具有图像能力目录的 OpenAI、豆包或 Agent Plan 账户；未修改设置。");
    }
  }
  if (path === "aiRuntime.videoTranscriptionAccountId" && nextValue !== "") {
    const account = typeof nextValue === "string" ? listAiAccounts(userId).find(item => item.id === nextValue) : undefined;
    const model = account?.models.find(item => item.id === "doubao-seed-asr-2.0" && item.taskType === "speech-to-text");
    const tierAllowed = !model?.planTiers?.length || !account?.options.planTier || account.options.planTier === "unknown"
      || model.planTiers.includes(account.options.planTier as NonNullable<typeof model.planTiers>[number]);
    if (!account || account.providerId !== "ark-agent-plan" || !account.hasSecret || !model || !tierAllowed) {
      throw new Error("视频语音识别账户必须是当前账户真实可用且包含支持档位的 Ark Agent Plan 语音模型账户；未修改设置。");
    }
  }
  if (path === "aiRuntime.imageGenerationModelId" && nextValue !== "") {
    const accountId = readPath(current, "aiRuntime.imageGenerationAccountId");
    const account = typeof accountId === "string" ? listAiAccounts(userId).find(item => item.id === accountId) : undefined;
    const model = account?.models.find(item => item.id === nextValue);
    const tier = account?.options.planTier;
    const tierAllowed = !model?.planTiers?.length || !tier || tier === "unknown"
      || model.planTiers.includes(tier as NonNullable<typeof model.planTiers>[number]);
    if (!account?.hasSecret || !model || account.providerId === "ark-agent-plan" && model.taskType !== "image-generation" || !tierAllowed) {
      throw new Error("图片模型必须来自当前所选账户的真实图像能力目录及 Agent Plan 档位；未修改设置。");
    }
  }
  if (path === "aiRuntime.videoGenerationModelId" && nextValue !== "") {
    const accountPath = "aiRuntime.videoGenerationAccountId";
    const accountId = readPath(current, accountPath);
    if (typeof nextValue !== "string" || typeof accountId !== "string" || !routeOptions.some(route => route.accountId === accountId && route.modelId === nextValue)) {
      throw new Error("模型必须来自当前设置所选账户的真实模型目录；未修改设置。");
    }
  }

  const [root, ...segments] = path.split(".") as [SettingsRoot, ...string[]];
  const nextSettings = structuredClone(current) as unknown as Record<string, unknown>;
  let parent = nextSettings[root] as Record<string, unknown>;
  for (const segment of segments.slice(0, -1)) {
    const value = parent?.[segment];
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("该设置路径不是可写的叶节点；未修改设置。");
    parent = value as Record<string, unknown>;
  }
  if (segments.length === 0) throw new Error("不支持替换整个设置分类；请使用目录中的单项路径。");
  const leaf = segments.at(-1)!;
  const previousValue = parent[leaf];
  parent[leaf] = nextValue;
  const category = categoryByRoot[root].category;
  saveUserSettings(userId, category, nextSettings[root] as never);
  const value = readPath(getUserSettings(userId), path);
  return { path, previousValue, value, changed: JSON.stringify(previousValue) !== JSON.stringify(value) };
}
