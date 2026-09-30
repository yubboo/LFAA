/** 功能：定义 HTTP 请求校验和共享响应合同。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。 */
import { type Request, type RequestHandler, type Response, type NextFunction } from "express";
import Joi from "joi";
import jwt from "jsonwebtoken";
import { timingSafeEqual } from "node:crypto";
import { config } from "lfaa-launch-environment/src/config.js";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import { setSessionCookie } from "lfaa-authorization/src/middleware.js";
import { type DaemonNode, type JavaRuntimeSummary } from "lfaa-host-daemon/src/local-daemon.js";
import { type MinecraftTask } from "lfaa-jobs/src/minecraft-queue.js";
import { createSession, sessionLifetimeSeconds } from "lfaa-identity-auth/src/service.js";
import { type ShortcutSettings } from "lfaa-settings/src/service.js";
export type AsyncRequestHandler = (request: Request, response: Response, next: NextFunction) => Promise<void>;

export function asyncHandler(handler: AsyncRequestHandler): RequestHandler {
  return (request, response, next) => {
    void handler(request, response, next).catch(next);
  };
}

export function parseBody<T>(schema: Joi.ObjectSchema, value: unknown): T {
  const result = schema.validate(value, { abortEarly: false, convert: true });

  if (result.error) {
    throw new ApiError(400, "invalid_request", "提交内容格式不正确，请检查后重试。");
  }

  return result.value as T;
}

export const requireLocalDaemon: RequestHandler = (request, response, next) => {
  const authorization = request.header("authorization") ?? "";
  const match = /^Bearer ([A-Za-z0-9_-]{32,128})$/u.exec(authorization);
  if (!match) {
    response.status(401).json({ error: "daemon_authentication_required", message: "本机 Daemon 身份校验失败。" });
    return;
  }
  const received = Buffer.from(match[1]!);
  const expected = Buffer.from(config.daemonToken);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    response.status(401).json({ error: "daemon_authentication_required", message: "本机 Daemon 身份校验失败。" });
    return;
  }
  next();
};

export function issueSession(response: Response, userId: string): void {
  const session = createSession(userId);
  const token = jwt.sign({ sid: session.sessionId }, config.jwtSecret, {
    algorithm: "HS256",
    audience: "lfaa-web",
    issuer: "lfaa-server",
    expiresIn: sessionLifetimeSeconds
  });

  setSessionCookie(response, token);
}

export function assertPasskeyRequestOrigin(request: Request): void {
  if (!config.webauthn.enabled || request.get("origin") !== config.webauthn.origin) {
    throw new ApiError(403, "passkey_origin_rejected", "请求来源与通行密钥配置不匹配。");
  }
}

export const accountCredentialsSchema = Joi.object({
  username: Joi.string().trim().min(3).max(32).pattern(/^[\p{L}\p{N}_.-]+$/u).required(),
  password: Joi.string().min(8).max(128).required()
}).unknown(false);

export const managedUserCreateSchema = Joi.object({
  username: Joi.string().trim().min(3).max(32).pattern(/^[\p{L}\p{N}_.-]+$/u).required(),
  password: Joi.string().min(8).max(128).required(),
  email: Joi.string().trim().email().max(254).allow("", null).default(null),
  role: Joi.string().valid("admin", "member").default("admin")
}).unknown(false);

export const managedUserUpdateSchema = Joi.object({
  username: Joi.string().trim().min(3).max(32).pattern(/^[\p{L}\p{N}_.-]+$/u).required(),
  email: Joi.string().trim().email().max(254).allow("", null).default(null),
  role: Joi.string().valid("admin", "member")
}).min(2).unknown(false);

export const userSearchSchema = Joi.object({
  search: Joi.string().trim().max(254),
  uid: Joi.number().integer().min(1),
  username: Joi.string().trim().max(32),
  email: Joi.string().trim().max(254),
  role: Joi.string().valid("super_admin", "admin", "member"),
  createdFrom: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u),
  createdTo: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u)
}).unknown(false);

export const loginSchema = Joi.object({
  username: Joi.string().trim().min(1).max(32).required(),
  password: Joi.string().min(1).max(128).required()
});

export const passwordRecoverySchema = Joi.object({
  username: Joi.string().trim().min(1).max(32).required(),
  recoveryKey: Joi.string().min(8).max(128).required(),
  newPassword: Joi.string().min(8).max(128).required()
}).unknown(false);

export const recoveryKeySchema = Joi.object({
  currentPassword: Joi.string().min(1).max(128).required(),
  recoveryKey: Joi.string().min(8).max(128).required()
}).unknown(false);

export const passwordChangeSchema = Joi.object({
  currentPassword: Joi.string().min(1).max(128).required(),
  newPassword: Joi.string().min(8).max(128).required()
}).unknown(false);

export const accountEmailSchema = Joi.object({
  currentPassword: Joi.string().min(1).max(128).required(),
  email: Joi.string().trim().email().max(254).allow("", null).required()
}).unknown(false);

export const passkeyRegistrationOptionsSchema = Joi.object({
  currentPassword: Joi.string().min(1).max(128).required()
}).unknown(false);

export const passkeyRegistrationVerificationSchema = Joi.object({
  flowId: Joi.string().guid({ version: ["uuidv4"] }).required(),
  name: Joi.string().trim().min(1).max(48).default("这台设备"),
  response: Joi.object({
    id: Joi.string().min(1).max(2048).pattern(/^[A-Za-z0-9_-]+$/u).required(),
    rawId: Joi.string().min(1).max(2048).pattern(/^[A-Za-z0-9_-]+$/u).required(),
    type: Joi.string().valid("public-key").required(),
    response: Joi.object().min(1).max(8).unknown(true).required(),
    clientExtensionResults: Joi.object().unknown(true).optional(),
    authenticatorAttachment: Joi.string().valid("platform", "cross-platform").allow(null).optional()
  }).unknown(false).required()
}).unknown(false);

export const passkeyAuthenticationVerificationSchema = Joi.object({
  flowId: Joi.string().guid({ version: ["uuidv4"] }).required(),
  response: Joi.object({
    id: Joi.string().min(1).max(2048).pattern(/^[A-Za-z0-9_-]+$/u).required(),
    rawId: Joi.string().min(1).max(2048).pattern(/^[A-Za-z0-9_-]+$/u).required(),
    type: Joi.string().valid("public-key").required(),
    response: Joi.object().min(1).max(8).unknown(true).required(),
    clientExtensionResults: Joi.object().unknown(true).optional(),
    authenticatorAttachment: Joi.string().valid("platform", "cross-platform").allow(null).optional()
  }).unknown(false).required()
}).unknown(false);

export const passkeyRemovalSchema = Joi.object({
  currentPassword: Joi.string().min(1).max(128).required()
}).unknown(false);

export const preferencesSchema = Joi.object({
  selectedApp: Joi.string().valid("steamcmd", "minecraft", "writing", "workspace").required(),
  selectedMode: Joi.string().valid("normal", "ai-work").required()
});

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
  confettiEnabled: Joi.boolean().required()
}).unknown(false);

export const aiRuntimeSettingsSchema = Joi.object({
  speed: Joi.string().valid("balanced", "fast", "deep").required(),
  promptSuggestions: Joi.boolean().required(),
  showContextUsage: Joi.boolean().required(),
  requestTimeoutSeconds: Joi.number().integer().min(10).max(300).required(),
  maxOutputTokens: Joi.number().integer().min(256).max(16384).required(),
  maxModelRequests: Joi.number().integer().min(1).max(100).default(12),
  maxToolCalls: Joi.number().integer().min(1).max(200).default(24),
  subagentAccountId: Joi.string().max(160).allow("").default(""),
  maxSubagents: Joi.number().integer().min(0).max(16).default(4),
  maxDelegationDepth: Joi.number().integer().min(0).max(4).default(2),
  voiceInputEnabled: Joi.boolean().default(false),
  readResponsesAloud: Joi.boolean().default(false)
}).unknown(false);

export const permissionsSettingsSchema = Joi.object({
  mode: Joi.string().valid("ask", "approve_remembered", "full_access").required()
}).unknown(false);

export const pluginsSettingsSchema = Joi.object({
  enabled: Joi.boolean().required(),
  mcpServers: Joi.array().max(16).unique("id").items(Joi.object({
    id: Joi.string().pattern(/^[a-z0-9][a-z0-9_-]{0,23}$/u).required(),
    name: Joi.string().trim().min(1).max(80).required(),
    url: Joi.string().max(1024).uri({ scheme: ["http", "https"] }).custom((value, helpers) => { const url = new URL(value); return url.username || url.password || url.search || url.hash ? helpers.error("any.invalid") : value; }).required(),
    enabled: Joi.boolean().required()
  }).unknown(false)).default([])
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
  overlay: Joi.number().integer().min(0).max(75).required(),
  blur: Joi.number().integer().min(0).max(32).required(),
  advanced: Joi.object({
    interfaceFontSize: Joi.number().integer().min(10).max(24).required(),
    codeFontSize: Joi.number().integer().min(8).max(24).required(),
    reducedMotion: Joi.string().valid("system", "on", "off").required(),
    separateModes: Joi.boolean().required(),
    fonts: appearanceFontsSchema.required(),
    modeStyles: Joi.object({
      light: appearanceModeStyleSchema.required(),
      dark: appearanceModeStyleSchema.required()
    }).unknown(false).required(),
    translucentSidebar: Joi.boolean().required(),
    contrast: Joi.number().integer().min(0).max(100).required(),
    diffMarkers: Joi.string().valid("color", "symbols").required(),
    pointerCursor: Joi.boolean().required()
  }).unknown(false).optional()
}).unknown(false);

export const shortcutBindingsSchema = Joi.array()
  .items(Joi.string().max(32).pattern(/^[\p{L}\p{N}\p{P} ]*$/u))
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
  switchAiWorkMode: shortcutBindingsSchema
}).unknown(false);

export const aiProbeSchema = Joi.object({
  providerId: Joi.string().valid("openai", "deepseek", "qwen", "kimi", "zhipu", "xiaomi").required(),
  secret: Joi.string().trim().min(1).max(4096).required(),
  options: Joi.object().pattern(/^[A-Za-z][A-Za-z0-9]{0,31}$/u, Joi.string().max(128)).default({}).unknown(false)
}).unknown(false);

export const aiAccountSchema = aiProbeSchema.keys({
  displayName: Joi.string().trim().min(1).max(48).required(),
  modelId: Joi.string().trim().min(1).max(160).required(),
  reasoningMode: Joi.string().trim().max(16).default("default")
});

export const aiModelSchema = Joi.object({ modelId: Joi.string().trim().min(1).max(160).required() }).unknown(false);

export const aiReasoningSchema = Joi.object({ reasoningMode: Joi.string().trim().max(16).required() }).unknown(false);

export const aiModelTestSchema = aiProbeSchema.keys({
  modelId: Joi.string().trim().min(1).max(160).required(),
  reasoningMode: Joi.string().trim().max(16).default("default")
});

export const backgroundUploadSchema = Joi.object({
  name: Joi.string().trim().max(180).default("自定义背景"),
  dataUrl: Joi.string().max(4_200_000).required()
}).unknown(false);

export const aiChatMessageSchema = Joi.object({
  appId: Joi.string().valid("steamcmd", "minecraft", "writing", "workspace").required(),
  sessionId: Joi.string().guid({ version: ["uuidv4", "uuidv5"] }).allow(null).default(null),
  content: Joi.string().trim().min(1).max(12000).required()
}).unknown(false);

export const writingBookSchema = Joi.object({ title: Joi.string().trim().min(1).max(80).required() }).unknown(false);

export const writingVolumeSchema = Joi.object({ title: Joi.string().trim().min(1).max(80).required() }).unknown(false);

export const writingChapterSchema = Joi.object({
  title: Joi.string().trim().min(1).max(120).required(),
  content: Joi.string().max(1_500_000).required()
}).unknown(false);

export const writingOutlineSchema = Joi.object({ content: Joi.string().max(1_500_000).required() }).unknown(false);

export const writingChapterTitleSchema = Joi.object({
  title: Joi.string().trim().min(1).max(120).required(),
  volumeId: Joi.string().guid({ version: ["uuidv4"] }).optional()
}).unknown(false);

export const writingSelectionSchema = Joi.object({
  bookId: Joi.string().guid({ version: ["uuidv4"] }).allow(null).required(),
  chapterId: Joi.string().guid({ version: ["uuidv4"] }).allow(null).required()
}).unknown(false);

export const writingRouteIdSchema = Joi.object({ id: Joi.string().guid({ version: ["uuidv4"] }).required() }).unknown(false);

export const writingCatalogEntryCreateSchema = Joi.object({
  kind: Joi.string().valid(
    "world-rule", "world-faction", "world-geography", "world-history", "world-term", "world-realm", "world-item", "world-reveal",
    "character-protagonist", "character-major", "character-secondary", "character-extra",
    "plot-storyline", "plot-point", "plot-foreshadow", "plot-card", "material"
  ).required(),
  title: Joi.string().trim().min(1).max(120).required()
}).unknown(false);

export const writingCatalogEntrySchema = Joi.object({
  title: Joi.string().trim().min(1).max(120).required(),
  content: Joi.string().max(1_500_000).required()
}).unknown(false);

export const aiSessionArchiveSchema = Joi.object({ archived: Joi.boolean().required() }).unknown(false);

export const aiApprovalDecisionSchema = Joi.object({ decision: Joi.string().valid("approved", "denied").required(), remember: Joi.boolean().default(false) }).unknown(false);

export function shortcutIdentity(value: string): string {
  const parts = value.split("+").map((part) => part.trim().toLocaleLowerCase());
  const key = parts.pop() ?? "";
  return [...parts.sort(), key].join("+");
}

export function hasShortcutConflict(settings: ShortcutSettings): boolean {
  const identities = Object.values(settings).flat().filter(Boolean).map(shortcutIdentity);
  return new Set(identities).size !== identities.length;
}

export function writeSse(response: Response, event: string, value: unknown): void {
  if (response.destroyed || response.writableEnded) return;
  response.write(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`);
}

export function withoutJavaExecutablePath(runtime: JavaRuntimeSummary) {
  return {
    runtimeId: runtime.runtimeId,
    major: runtime.major,
    vendor: runtime.vendor,
    managed: runtime.managed,
    ...(runtime.source ? { source: runtime.source } : {})
  };
}

export function withoutJavaExecutablePaths(node: DaemonNode) {
  return { ...node, javaRuntimes: node.javaRuntimes.map(withoutJavaExecutablePath) };
}

export function withoutJavaTaskPath(task: MinecraftTask): MinecraftTask {
  if (task.kind !== "java-install" || typeof task.payload.executablePath !== "string") return task;
  const payload = { ...task.payload };
  delete payload.executablePath;
  return { ...task, payload };
}

export const daemonHeartbeatSchema = Joi.object({
    id: Joi.string().guid().required(),
    displayName: Joi.string().trim().min(1).max(80).required(),
    platform: Joi.string().valid("win32").required(),
    architecture: Joi.string().valid("x64").required(),
    version: Joi.string().trim().max(40).required(),
    dataRoot: Joi.string().trim().min(3).max(2048).pattern(/^(?:[a-z]:\\|\\\\)/iu).required(),
    capabilities: Joi.array().items(Joi.string().valid("minecraft-vanilla", "app-sandbox-windows-appcontainer-v1", "java-environment-manager-v1", "minecraft-java-runtime-selection-v1", "node-filesystem-v1", "steamcmd-ready-v1", "agent-shell-v1", "project-files-v1")).max(8).required(),
    javaRuntimes: Joi.array().items(Joi.object({
      runtimeId: Joi.string().max(80).required(),
      major: Joi.number().integer().min(8).max(40).required(),
      vendor: Joi.string().max(80).required(),
      managed: Joi.boolean().required(),
      source: Joi.string().valid("managed", "system", "custom").optional(),
      executablePath: Joi.string().max(2048).optional()
    }).unknown(false)).max(128).required(),
    activeTaskIds: Joi.array().items(Joi.string().guid()).max(32).unique().default([]),
    instances: Joi.array().items(Joi.object({
      id: Joi.string().guid().required(),
      state: Joi.string().valid("stopped", "running", "installing", "unknown").required(),
      sandboxStatus: Joi.string().valid("unsupported", "unprepared", "prepared", "running", "unknown").default("unknown")
    }).unknown(false)).max(500).required()
  }).unknown(false);

export const minecraftDeploymentSchema = Joi.object({
    nodeId: Joi.string().guid().required(),
    name: Joi.string().trim().min(1).max(48).required(),
    serverType: Joi.string().valid("vanilla").required(),
    releaseId: Joi.string().pattern(/^[0-9A-Za-z.-]{1,64}$/u).required()
  }).unknown(false);

export const minecraftDeploymentRegistrationSchema = Joi.object({
    memoryMb: Joi.number().integer().min(1024).max(32768).required(),
    eulaAccepted: Joi.boolean().valid(true).required(),
    javaRuntimeId: Joi.string().trim().min(1).max(80).allow(null).optional()
  }).unknown(false);

export const minecraftInstanceJavaRuntimeSchema = Joi.object({
    javaRuntimeId: Joi.string().trim().min(1).max(80).allow(null).required()
  }).unknown(false);

export const minecraftJavaInstallSchema = Joi.object({
    nodeId: Joi.string().guid().required(),
    major: Joi.number().integer().min(8).max(40).required()
  }).unknown(false);

export const minecraftJavaUninstallSchema = Joi.object({
    nodeId: Joi.string().guid().required(),
    major: Joi.number().integer().min(8).max(40).required()
  }).unknown(false);

export const minecraftJavaPathSchema = Joi.object({
    nodeId: Joi.string().guid().required(),
    executablePath: Joi.string().trim().min(1).max(2048).required(),
    runtimeId: Joi.string().trim().min(1).max(80).optional()
  }).unknown(false);

export const minecraftJavaPathRemovalSchema = Joi.object({
    nodeId: Joi.string().guid().required(),
    runtimeId: Joi.string().trim().min(1).max(80).required()
  }).unknown(false);

export const minecraftProgressSchema = Joi.object({
    nodeId: Joi.string().guid().required(),
    progress: Joi.number().integer().min(0).max(100).required(),
    message: Joi.string().trim().min(1).max(240).required()
  }).unknown(false);

export const minecraftLogBatchSchema = Joi.object({
    nodeId: Joi.string().guid().required(),
    instanceId: Joi.string().guid().required(),
    taskId: Joi.string().guid().allow(null).required(),
    stream: Joi.string().valid("stdout", "stderr", "system").required(),
    lines: Joi.array().items(Joi.string().max(4096)).min(1).max(200).required()
  }).unknown(false);

export const minecraftCompletionSchema = Joi.object({
    nodeId: Joi.string().guid().required(),
    succeeded: Joi.boolean().required(),
    message: Joi.string().trim().min(1).max(240).required(),
    result: Joi.object({
      javaMajor: Joi.number().integer().min(8).max(40),
      artifactName: Joi.string().max(120),
      backupName: Joi.string().max(120),
      runtimeVendor: Joi.string().max(80)
    }).unknown(false).default({})
  }).unknown(false);

export const fileOperationSchema = Joi.object({
    nodeId: Joi.string().guid().required(),
    operation: Joi.string().valid("list", "search", "read", "write", "create-file", "create-folder", "rename", "delete", "upload", "download").required(),
    path: Joi.string().max(1024).allow("").required(),
    query: Joi.string().trim().min(1).max(100).when("operation", { is: "search", then: Joi.required(), otherwise: Joi.forbidden() }),
    name: Joi.string().trim().min(1).max(255).when("operation", { is: Joi.valid("rename", "upload"), then: Joi.required(), otherwise: Joi.forbidden() }),
    content: Joi.string().allow("").max(2 * 1024 * 1024).when("operation", { is: "write", then: Joi.required(), otherwise: Joi.forbidden() }),
    dataBase64: Joi.string().allow("").max(4_194_304).when("operation", { is: "upload", then: Joi.required(), otherwise: Joi.forbidden() })
  }).unknown(false);

export const steamcmdConfigurationSettingsSchema = Joi.object({
    installMode: Joi.string().valid("online", "manual").required(),
    steamcmdDirectory: Joi.string().trim().min(1).max(512).required()
  }).unknown(false);

export const steamcmdStorageSettingsSchema = Joi.object({
    gameDirectory: Joi.string().trim().min(1).max(512).required()
  }).unknown(false);

export const minecraftStorageSettingsSchema = Joi.object({
    instanceDirectory: Joi.string().trim().min(1).max(512).required()
  }).unknown(false);

export const dataDirectorySettingsSchema = Joi.object({
    directory: Joi.string().trim().min(1).max(2048).required()
  }).unknown(false);

export const pluginRuntimeActionSchema = Joi.object({
    action: Joi.string().valid("start", "stop", "reload").required()
  }).unknown(false);

export const steamcmdTaskSchema = Joi.object({
    nodeId: Joi.string().guid().required(),
    kind: Joi.string().valid("install", "verify").required()
  }).unknown(false);

export const steamcmdProgressSchema = Joi.object({
    nodeId: Joi.string().guid().required(),
    progress: Joi.number().integer().min(0).max(99).required(),
    message: Joi.string().trim().min(1).max(240).required()
  }).unknown(false);

export const steamcmdCompletionSchema = Joi.object({
    nodeId: Joi.string().guid().required(),
    succeeded: Joi.boolean().required(),
    message: Joi.string().trim().min(1).max(240).required(),
    result: Joi.object({
      steamcmdDirectory: Joi.string().max(512),
      gameDirectory: Joi.string().max(512),
      version: Joi.string().max(120),
      verified: Joi.boolean()
    }).unknown(false).default({})
  }).unknown(false);

export const fileEntrySchema = Joi.object({
    name: Joi.string().max(255).required(),
    path: Joi.string().max(1024).required(),
    kind: Joi.string().valid("directory", "file").required(),
    size: Joi.number().integer().min(0).max(Number.MAX_SAFE_INTEGER).required(),
    modifiedAt: Joi.string().isoDate().required()
  }).unknown(false);

export const fileTaskCompletionSchema = Joi.object({
    nodeId: Joi.string().guid().required(),
    succeeded: Joi.boolean().required(),
    message: Joi.string().trim().min(1).max(240).required(),
    result: Joi.object({
      path: Joi.string().max(1024).allow(""),
      content: Joi.string().allow("").max(2 * 1024 * 1024),
      name: Joi.string().max(255),
      size: Joi.number().integer().min(0).max(Number.MAX_SAFE_INTEGER),
      dataBase64: Joi.string().allow("").max(4_194_304),
      entries: Joi.array().items(fileEntrySchema).max(500),
      truncated: Joi.boolean(),
      deleted: Joi.boolean(),
      kind: Joi.string().valid("directory", "file")
    }).unknown(false).default({})
  }).unknown(false);

export const aiHostTaskCompletionSchema = Joi.object({
    nodeId: Joi.string().guid().required(),
    succeeded: Joi.boolean().required(),
    message: Joi.string().trim().min(1).max(240).required(),
    result: Joi.object({
      stdout: Joi.string().max(1024 * 1024).required(),
      stderr: Joi.string().max(1024 * 1024).required(),
      exitCode: Joi.number().integer().allow(null).required(),
      timedOut: Joi.boolean().required(),
      outputTruncated: Joi.boolean().required()
    }).unknown(false).required()
  }).unknown(false);
