/**
 * 功能：提供账户设置写入的服务端权威校验。
 * 作用：HTTP 与 Settings Owner 复用同一分类 Schema；旧记录补默认值仍由 service.ts 处理。
 * 关联文件：service.ts、api/remotes/src/route-contracts.ts、api/settings-controller/src/index.ts。
 */
import Joi from "joi";
import { AI_RUNTIME_MAX_MODEL_REQUESTS_PER_RUN, AI_RUNTIME_MAX_TOOL_CALLS_PER_RUN, CARD_MOTION_EFFECT_IDS, UI_MOTION_EFFECT_IDS, DEFAULT_USER_SETTINGS } from "lfaa-util-values/src/settings-contract.js";
import { APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";
import type { SettingsCategory } from "lfaa-util-values/src/settings-contract.js";

export const appearanceBackgroundIdSchema = Joi.alternatives().try(
  Joi.string().valid(
    "none", "service-room", "steamcmd-world", "minecraft-world", "writing-desk",
    "cherry-blossom-shore", "cherry-blossom-village", "flower-meadow-castle", "forest-bridge-evening",
    "golden-wheat-field", "lakeside-pagoda-morning", "ocean-cliff-sunset", "rainy-grassland",
    "snowy-cabin-interior", "tropical-coast-day"
  ),
  Joi.string().pattern(/^user-[0-9a-f-]{36}$/iu)
);

export const generalSettingsSchema = Joi.object({
  defaultMode: Joi.string().valid("normal", "ai-work").required(),
  showServiceStatus: Joi.boolean().required(),
  showBottomPanelControl: Joi.boolean().required(),
  taskFolder: Joi.string().max(512).allow("").required(),
  fileOpenLocation: Joi.string().valid("system", "ask").required(),
  agentEnvironment: Joi.string().valid("system", "windows-native", "wsl", "linux").required(),
  integratedShell: Joi.string().valid("system", "powershell", "cmd", "bash", "zsh").required(),
  language: Joi.string().valid("system", "zh-CN", "en-US").required(),
  defaultFullView: Joi.boolean().required(),
  navigationLayout: Joi.string().valid("left-two-column", "three-column", "right-tools", "focus").required(),
  cardMotionEffect: Joi.string().valid(...CARD_MOTION_EFFECT_IDS),
  dialogMotionEffect: Joi.string().valid(...UI_MOTION_EFFECT_IDS),
  terminalPosition: Joi.string().valid("bottom", "right").required(),
  plainTextEditor: Joi.boolean().required(),
  sendShortcut: Joi.string().valid("enter", "ctrl-enter").required(),
  followupBehavior: Joi.string().valid("queue", "steer").required(),
  popupShortcut: Joi.string().max(48).allow("").required(),
  defaultStandaloneChat: Joi.boolean().required(),
  completionNotification: Joi.string().valid("always", "unfocused", "never").required(),
  permissionNotifications: Joi.boolean().required(),
  questionNotifications: Joi.boolean().required(),
  sessionIssueNotifications: Joi.boolean().required(),
  notificationSound: Joi.string().valid("default", "subtle", "off").required(),
  setupReminderEnabled: Joi.boolean().required(),
  defaultAdminCredentialReminderEnabled: Joi.boolean().required(),
  confettiEnabled: Joi.boolean().required()
}).unknown(false);

export const aiRuntimeSettingsSchema = Joi.object({
  speed: Joi.string().valid("balanced", "fast", "deep").required(),
  promptSuggestions: Joi.boolean().required(),
  showContextUsage: Joi.boolean().required(),
  requestTimeoutSeconds: Joi.number().integer().min(10).max(300).required(),
  requestRetries: Joi.number().integer().min(0).max(3).default(1),
  retryDelaySeconds: Joi.number().integer().min(0).max(30).default(1),
  maxOutputTokens: Joi.number().integer().min(0).max(Number.MAX_SAFE_INTEGER).required(),
  maxModelRequests: Joi.number().integer().min(0).max(AI_RUNTIME_MAX_MODEL_REQUESTS_PER_RUN).default(0),
  maxToolCalls: Joi.number().integer().min(0).max(AI_RUNTIME_MAX_TOOL_CALLS_PER_RUN).default(0),
  subagentAccountId: Joi.string().max(160).allow("").default(""),
  imageGenerationAccountId: Joi.string().max(160).allow("").optional(),
  imageGenerationModelId: Joi.string().max(160).allow("").optional(),
  videoGenerationAccountId: Joi.string().max(160).allow("").required(),
  videoGenerationModelId: Joi.string().max(160).allow("").required(),
  videoGenerationDurationSeconds: Joi.number().integer().min(1).max(15).required(),
  videoGenerationRatio: Joi.string().valid("adaptive", "16:9", "9:16", "1:1", "4:3", "3:4").required(),
  videoGenerationResolution: Joi.string().valid("480p", "720p", "1080p").required(),
  videoGenerationGenerateAudio: Joi.boolean().required(),
  videoGenerationWatermark: Joi.boolean().required(),
  maxSubagents: Joi.number().integer().min(0).max(16).default(4),
  maxDelegationDepth: Joi.number().integer().min(0).max(4).default(2),
  voiceInputEnabled: Joi.boolean().default(false),
  readResponsesAloud: Joi.boolean().default(false),
  commandTimeoutSeconds: Joi.number().integer().min(0).max(1800).default(0),
  contextWindowTokens: Joi.number().integer().min(4096).max(2000000).default(32768),
  autoCompaction: Joi.boolean().default(true),
  // 暂兼容已打开的旧客户端；保存层会将这些键拆到 minecraft-runtime，绝不回写 ai-runtime。
  minecraftReadyTimeoutSeconds: Joi.number().integer().min(10).max(900).optional(),
  minecraftStopTimeoutSeconds: Joi.number().integer().min(5).max(300).optional(),
  minecraftDefaultMemoryMb: Joi.number().integer().min(1024).max(32768).optional(),
  minecraftDefaultPort: Joi.number().integer().min(1024).max(65535).optional(),
  minecraftDownloadTimeoutSeconds: Joi.number().integer().min(30).max(7200).optional(),
  minecraftInstallTimeoutSeconds: Joi.number().integer().min(30).max(7200).optional(),
  minecraftExecutionMode: Joi.string().valid("native", "appcontainer").optional(),
  minecraftDefaultCore: Joi.string().min(1).max(32).optional(),
  minecraftBedrockDefaultPort: Joi.number().integer().min(1024).max(65535).optional()
}).unknown(false);

export const minecraftRuntimeSettingsSchema = Joi.object({
  minecraftReadyTimeoutSeconds: Joi.number().integer().min(10).max(900).required(),
  minecraftStopTimeoutSeconds: Joi.number().integer().min(5).max(300).required(),
  minecraftDefaultMemoryMb: Joi.number().integer().min(1024).max(32768).required(),
  minecraftDefaultPort: Joi.number().integer().min(1024).max(65535).required(),
  minecraftDownloadTimeoutSeconds: Joi.number().integer().min(30).max(7200).required(),
  minecraftInstallTimeoutSeconds: Joi.number().integer().min(30).max(7200).required(),
  minecraftExecutionMode: Joi.string().valid("native", "appcontainer").required(),
  minecraftDefaultCore: Joi.string().min(1).max(32).required(),
  minecraftBedrockDefaultPort: Joi.number().integer().min(1024).max(65535).required()
}).unknown(false);

export const gitSettingsSchema = Joi.object({
  branchPrefix: Joi.string().trim().min(2).max(65).pattern(/^[A-Za-z0-9][A-Za-z0-9._/-]{0,63}\/$/u).custom((value, helpers) => {
    const segments = value.slice(0, -1).split("/");
    return value.includes("..") || value.includes("@{") || segments.some((segment: string) => !segment || segment.startsWith(".") || segment.endsWith(".") || segment.toLocaleLowerCase("en-US").endsWith(".lock"))
      ? helpers.error("any.invalid") : value;
  }).required()
}).unknown(false);

export const permissionsSettingsSchema = Joi.object({
  mode: Joi.string().valid("ask", "approve_remembered", "full_access").required()
}).unknown(false);

export const pluginsSettingsSchema = Joi.object({
  enabled: Joi.boolean().required(),
  skillDirectories: Joi.array().max(16).unique().items(Joi.string().trim().min(1).max(32760).custom((value, helpers) => /^(?:[A-Za-z]:[\\/]|\/|\\\\)/u.test(value) && !value.includes("\0") ? value : helpers.error("any.invalid"))).default([]),
  mcpServers: Joi.array().max(16).unique("id").items(Joi.alternatives().try(
    Joi.object({
      id: Joi.string().pattern(/^[a-z0-9][a-z0-9_-]{0,23}$/u).required(),
      name: Joi.string().trim().min(1).max(80).required(),
      transport: Joi.string().valid("streamable-http"),
      url: Joi.string().max(1024).uri({ scheme: ["http", "https"] }).custom((value, helpers) => { const url = new URL(value); return url.username || url.password || url.search || url.hash ? helpers.error("any.invalid") : value; }).required(),
      enabled: Joi.boolean().required(),
      applicationIds: Joi.array().unique().items(Joi.string().valid(...APPLICATION_IDS)).max(APPLICATION_IDS.length).default(["workspace"]),
      manifestSha256: Joi.string().pattern(/^[a-f0-9]{64}$/u),
      computerUse: Joi.boolean().valid(false)
    }).unknown(false),
    Joi.object({
      id: Joi.string().pattern(/^[a-z0-9][a-z0-9_-]{0,23}$/u).required(),
      name: Joi.string().trim().min(1).max(80).required(),
      transport: Joi.string().valid("stdio").required(),
      command: Joi.string().trim().min(1).max(1024).custom((value, helpers) => value.includes("\0") ? helpers.error("any.invalid") : value).required(),
      args: Joi.array().max(32).items(Joi.string().max(1024).custom((value, helpers) => value.includes("\0") ? helpers.error("any.invalid") : value)).required(),
      enabled: Joi.boolean().required(),
      applicationIds: Joi.array().unique().items(Joi.string().valid(...APPLICATION_IDS)).max(APPLICATION_IDS.length).default(["workspace"]),
      manifestSha256: Joi.string().pattern(/^[a-f0-9]{64}$/u),
      computerUse: Joi.boolean().default(false)
    }).unknown(false)
  )).default([]),
  prompts: Joi.array().max(16).unique("id").items(Joi.object({
    id: Joi.string().pattern(/^prompt-[a-f0-9]{20}$/u).required(),
    name: Joi.string().trim().min(1).max(120).required(),
    description: Joi.string().max(500).required(),
    applicationId: Joi.string().valid(...APPLICATION_IDS).required(),
    sourceRepository: Joi.string().pattern(/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u).required(),
    sourcePath: Joi.string().trim().min(1).max(512).custom((value, helpers) => value.split("/").some((part: string) => !part || part === "." || part === ".." || part.includes("\\")) ? helpers.error("any.invalid") : value).required(),
    license: Joi.string().allow(null).required(),
    commit: Joi.string().pattern(/^[a-f0-9]{40}$/iu).required(),
    archiveSha256: Joi.string().pattern(/^[a-f0-9]{64}$/u).required(),
    contentSha256: Joi.string().pattern(/^[a-f0-9]{64}$/u).required(),
    content: Joi.string().max(24 * 1024).required(),
    enabled: Joi.boolean().required(),
    createdAt: Joi.string().isoDate().required()
  }).unknown(false))
}).unknown(false);

export const personalizationSettingsSchema = Joi.object({
  memoryEnabled: Joi.boolean().required(),
  memoryFromToolChats: Joi.boolean().required()
}).unknown(false);

export const conversationMemoriesSchema = Joi.object({
  revision: Joi.number().integer().min(0).max(Number.MAX_SAFE_INTEGER).required(),
  memories: Joi.array().items(Joi.string().trim().min(1).max(240)).max(16).required()
}).unknown(false);

export const computerControlSettingsSchema = Joi.object({
  enabled: Joi.boolean().required()
}).unknown(false);

export const appearanceFontsSchema = Joi.object({
  interface: Joi.string().valid("system", "sans", "serif").required(),
  content: Joi.string().valid("system", "sans", "serif").required(),
  code: Joi.string().valid("system", "cascadia", "consolas", "jetbrains").required()
}).unknown(false);

export const appearanceModeStyleSchema = Joi.object({
  accentColor: Joi.string().valid("#3457d5", "#1687a7", "#27845b", "#8956bb", "#d05b37", "#d64d8f").required(),
  fonts: appearanceFontsSchema.required()
}).unknown(false);

export const appearanceSettingsSchema = Joi.object({
  updateSurfaceOpacity: Joi.number().integer().min(70).max(100).optional(),
  theme: Joi.string().valid("light", "dark", "system").required(),
  accentColor: Joi.string().valid("#3457d5", "#1687a7", "#27845b", "#8956bb", "#d05b37", "#d64d8f").required(),
  sidebarColor: Joi.alternatives().try(
    Joi.string().valid("auto"),
    Joi.string().pattern(/^#[0-9a-f]{6}$/iu)
  ).required(),
  backgrounds: Joi.object({
    login: appearanceBackgroundIdSchema.default("forest-bridge-evening"),
    appCenter: appearanceBackgroundIdSchema.required(),
    steamcmd: appearanceBackgroundIdSchema.required(),
    minecraft: appearanceBackgroundIdSchema.required(),
    writing: appearanceBackgroundIdSchema.required(),
    settings: appearanceBackgroundIdSchema.required()
  }).unknown(false).required(),
  wallpaperEngine: Joi.object({
    enabled: Joi.boolean().default(false),
    projectId: Joi.string().allow("").max(180).pattern(/^[A-Za-z0-9_-]+$/u).default("")
  }).unknown(false).default({ enabled: false, projectId: "" }),
  overlay: Joi.number().integer().min(0).max(75).required(),
  blur: Joi.number().integer().min(0).max(32).required(),
  advanced: Joi.object({
    interfaceFontSize: Joi.number().integer().min(10).max(24).required(),
    codeFontSize: Joi.number().integer().min(8).max(24).required(),
    reducedMotion: Joi.string().valid("system", "on", "off").required(),
    authTransitionPluginId: Joi.string().trim().min(1).max(180).pattern(/^[A-Za-z0-9@._:/-]+$/u).default("builtin"),
    separateModes: Joi.boolean().required(),
    fonts: appearanceFontsSchema.required(),
    modeStyles: Joi.object({
      light: appearanceModeStyleSchema.required(),
      dark: appearanceModeStyleSchema.required()
    }).unknown(false).required(),
    translucentSidebar: Joi.boolean().required(),
    contrast: Joi.number().integer().min(0).max(100).required(),
    diffMarkers: Joi.string().valid("color", "symbols").required(),
    pointerCursor: Joi.boolean().required(),
    aiWorkOutputFocusBlurEnabled: Joi.boolean().default(true),
    aiWorkOutputFocusBlurPercent: Joi.number().integer().min(0).max(100).optional(),
    aiWorkOutputFocusBlurIdleSeconds: Joi.number().integer().min(60).max(3600).multiple(60).default(60),
    aiWorkOutputFocusBlurAmount: Joi.number().integer().min(0).max(24).optional()
  }).unknown(false).optional()
}).unknown(false);

export const shortcutBindingsSchema = Joi.array()
  .items(Joi.string().max(32).pattern(/^[\p{L}\p{N}\p{P} +`]*$/u))
  .max(4)
  .required();

export const shortcutsSchema = Joi.object({
  openSettings: shortcutBindingsSchema,
  openHome: shortcutBindingsSchema,
  openSteamcmd: shortcutBindingsSchema,
  openMinecraft: shortcutBindingsSchema,
  openWriting: shortcutBindingsSchema,
  toggleSidebar: shortcutBindingsSchema,
  toggleContextPanel: shortcutBindingsSchema,
  toggleBottomPanel: shortcutBindingsSchema,
  openTerminal: shortcutBindingsSchema,
  switchNormalMode: shortcutBindingsSchema,
  switchAiWorkMode: shortcutBindingsSchema,
  openSideChat: shortcutBindingsSchema.optional().default(DEFAULT_USER_SETTINGS.shortcuts.openSideChat),
  wallpaperSidebarToggle: shortcutBindingsSchema.optional().default(DEFAULT_USER_SETTINGS.shortcuts.wallpaperSidebarToggle)
}).unknown(false);


export const settingsSchemas = {
  "general": generalSettingsSchema,
  "appearance": appearanceSettingsSchema,
  "shortcuts": shortcutsSchema,
  "ai-runtime": aiRuntimeSettingsSchema,
  "minecraft-runtime": minecraftRuntimeSettingsSchema,
  "git": gitSettingsSchema,
  "permissions": permissionsSettingsSchema,
  "plugins": pluginsSettingsSchema,
  "personalization": personalizationSettingsSchema,
  "computer-control": computerControlSettingsSchema
};

/** 写入严格拒绝未知字段和非法值，不将失败保存伪装成成功后回退。 */
export function validateSettingsInput(category: SettingsCategory, value: unknown): Record<string, unknown> {
  const schema = Object.hasOwn(settingsSchemas, category) ? settingsSchemas[category] : undefined;
  if (!schema) throw new Error("找不到此设置分类。");
  const result = schema.validate(value, { abortEarly: false, convert: false });
  if (result.error) throw new Error("设置内容格式不正确，请检查后重试。");
  return result.value as Record<string, unknown>;
}
