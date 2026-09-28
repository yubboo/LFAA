/**
 * 功能：注册 LFAA 控制端的健康、认证、账户、偏好与配置设置接口。
 * 作用：校验 HTTP 输入，将请求交给对应业务服务，并统一返回中文 JSON 响应。
 * 关联文件：server/src/index.ts、server/src/modules/auth/service.ts、server/src/modules/preferences/service.ts、server/src/modules/settings/service.ts。
 */
import { Router, type Request, type RequestHandler, type Response, type NextFunction } from "express";
import Joi from "joi";
import jwt from "jsonwebtoken";
import { timingSafeEqual } from "node:crypto";
import { config } from "../config.js";
import { database } from "../database.js";
import { logger } from "../logger.js";
import { ApiError } from "./http-error.js";
import { requireAuthentication, requireRole, setSessionCookie, clearSessionCookie } from "../middleware/auth.js";
import { createRateLimit } from "../middleware/rate-limit.js";
import { getDaemonNode, listDaemonNodes, recordDaemonHeartbeat } from "../modules/nodes/local-daemon.js";
import { claimNextMinecraftTask, appendMinecraftTaskLogs, completeMinecraftTask, getMinecraftTask, renewMinecraftTaskLeases, updateMinecraftTaskProgress } from "../modules/tasks/minecraft-queue.js";
import {
  backupMinecraftWorld,
  createMinecraftInstance,
  getMinecraftInstance,
  getMinecraftInstanceLogs,
  getMinecraftOverview,
  getMinecraftRelease,
  getMinecraftReleases,
  installMinecraftJava,
  listMinecraftInstances,
  listMinecraftJavaRuntimes,
  listMinecraftTaskRecords,
  startMinecraftInstance,
  stopMinecraftInstance,
  updateInstanceStatesFromDaemon,
  updateMinecraftServerProperties,
  validateMinecraftServerProperties
} from "../modules/games/minecraft/service.js";
import type { AiPluginHost } from "../ai/host.js";
import { streamAiCompletion } from "../ai/runtime.js";
import { createAiTurn, finishAiAssistantMessage, getAiSessionMessages, getAiUsageSummary, listAiSessions, recordAiUsage, setAiSessionArchived } from "../ai/sessions.js";
import { AiPermissionModeChangedError, decideAiToolApproval, listAiToolApprovals, listAiToolPermissionGrants, revokeAiToolPermissionGrant } from "../ai/permissions.js";
import {
  authenticateUser,
  createInitialAdmin,
  createSession,
  listUsers,
  requiresInitialSetup,
  revokeSession,
  resetPasswordWithRecoveryKey,
  setRecoveryKey,
  sessionLifetimeSeconds
} from "../modules/auth/service.js";
import {
  getUserPreferences,
  saveUserPreferences,
  type ApplicationId,
  type ApplicationMode
} from "../modules/preferences/service.js";
import {
  activateAiAccount,
  deleteAiAccount,
  deleteUserBackground,
  getUserBackground,
  getUserSettings,
  listUserBackgrounds,
  listAiAccounts,
  listAiProviders,
  probeAiProvider,
  reprobeAiAccount,
  resolveActiveAiModelConfiguration,
  saveAiAccount,
  saveUserBackground,
  saveUserSettings,
  updateAiAccountModel,
  type SettingsCategory,
  type ShortcutSettings
} from "../modules/settings/service.js";

type AsyncRequestHandler = (request: Request, response: Response, next: NextFunction) => Promise<void>;

function asyncHandler(handler: AsyncRequestHandler): RequestHandler {
  return (request, response, next) => {
    void handler(request, response, next).catch(next);
  };
}

function parseBody<T>(schema: Joi.ObjectSchema, value: unknown): T {
  const result = schema.validate(value, { abortEarly: false, convert: true });

  if (result.error) {
    throw new ApiError(400, "invalid_request", "提交内容格式不正确，请检查后重试。");
  }

  return result.value as T;
}

const requireLocalDaemon: RequestHandler = (request, response, next) => {
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

function issueSession(response: Response, userId: string): void {
  const session = createSession(userId);
  const token = jwt.sign({ sid: session.sessionId }, config.jwtSecret, {
    algorithm: "HS256",
    audience: "lfaa-web",
    issuer: "lfaa-server",
    expiresIn: sessionLifetimeSeconds
  });

  setSessionCookie(response, token);
}

const accountCredentialsSchema = Joi.object({
  username: Joi.string().trim().min(3).max(32).pattern(/^[\p{L}\p{N}_.-]+$/u).required(),
  password: Joi.string().min(8).max(128).required()
}).unknown(false);

const accountSchema = accountCredentialsSchema.keys({
  recoveryKey: Joi.string().min(8).max(128).required()
});

const loginSchema = Joi.object({
  username: Joi.string().trim().min(1).max(32).required(),
  password: Joi.string().min(1).max(128).required()
});

const passwordRecoverySchema = Joi.object({
  username: Joi.string().trim().min(1).max(32).required(),
  recoveryKey: Joi.string().min(8).max(128).required(),
  newPassword: Joi.string().min(8).max(128).required()
}).unknown(false);

const recoveryKeySchema = Joi.object({
  currentPassword: Joi.string().min(1).max(128).required(),
  recoveryKey: Joi.string().min(8).max(128).required()
}).unknown(false);

const preferencesSchema = Joi.object({
  selectedApp: Joi.string().valid("steamcmd", "minecraft", "writing").required(),
  selectedMode: Joi.string().valid("normal", "ai-work").required()
});

const appearanceBackgroundIdSchema = Joi.alternatives().try(
  Joi.string().valid(
    "none", "service-room", "steamcmd-world", "minecraft-world", "writing-desk",
    "cherry-blossom-shore", "cherry-blossom-village", "flower-meadow-castle", "forest-bridge-evening",
    "golden-wheat-field", "lakeside-pagoda-morning", "ocean-cliff-sunset", "rainy-grassland",
    "snowy-cabin-interior", "tropical-coast-day"
  ),
  Joi.string().pattern(/^user-[0-9a-f-]{36}$/iu)
);

const generalSettingsSchema = Joi.object({
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
  notificationSound: Joi.string().valid("default", "subtle", "off").required(),
  confettiEnabled: Joi.boolean().required()
}).unknown(false);

const aiRuntimeSettingsSchema = Joi.object({
  speed: Joi.string().valid("balanced", "fast", "deep").required(),
  promptSuggestions: Joi.boolean().required(),
  showContextUsage: Joi.boolean().required(),
  requestTimeoutSeconds: Joi.number().integer().min(10).max(300).required(),
  maxOutputTokens: Joi.number().integer().min(256).max(16384).required()
}).unknown(false);

const permissionsSettingsSchema = Joi.object({
  mode: Joi.string().valid("ask", "approve_remembered", "full_access").required()
}).unknown(false);

const pluginsSettingsSchema = Joi.object({
  enabled: Joi.boolean().required()
}).unknown(false);

const appearanceFontsSchema = Joi.object({
  interface: Joi.string().valid("system", "sans", "serif").required(),
  content: Joi.string().valid("system", "sans", "serif").required(),
  code: Joi.string().valid("system", "cascadia", "consolas", "jetbrains").required()
}).unknown(false);

const appearanceModeStyleSchema = Joi.object({
  accentColor: Joi.string().valid("#3457d5", "#1687a7", "#27845b", "#8956bb", "#d05b37", "#d64d8f").required(),
  fonts: appearanceFontsSchema.required()
}).unknown(false);

const appearanceSettingsSchema = Joi.object({
  theme: Joi.string().valid("light", "dark", "system").required(),
  accentColor: Joi.string().valid("#3457d5", "#1687a7", "#27845b", "#8956bb", "#d05b37", "#d64d8f").required(),
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

const shortcutBindingsSchema = Joi.array()
  .items(Joi.string().max(32).pattern(/^[\p{L}\p{N}\p{P} ]*$/u))
  .max(4)
  .required();

const shortcutsSchema = Joi.object({
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

const aiProbeSchema = Joi.object({
  providerId: Joi.string().valid("openai", "deepseek", "qwen", "kimi", "zhipu", "xiaomi").required(),
  secret: Joi.string().trim().min(1).max(4096).required(),
  options: Joi.object().pattern(/^[A-Za-z][A-Za-z0-9]{0,31}$/u, Joi.string().max(128)).default({}).unknown(false)
}).unknown(false);

const aiAccountSchema = aiProbeSchema.keys({
  displayName: Joi.string().trim().min(1).max(48).required(),
  modelId: Joi.string().trim().min(1).max(160).required()
});

const aiModelSchema = Joi.object({ modelId: Joi.string().trim().min(1).max(160).required() }).unknown(false);

const backgroundUploadSchema = Joi.object({
  name: Joi.string().trim().max(180).default("自定义背景"),
  dataUrl: Joi.string().max(4_200_000).required()
}).unknown(false);

const aiChatMessageSchema = Joi.object({
  appId: Joi.string().valid("steamcmd", "minecraft", "writing").required(),
  sessionId: Joi.string().guid({ version: ["uuidv4", "uuidv5"] }).allow(null).default(null),
  content: Joi.string().trim().min(1).max(12000).required()
}).unknown(false);

const aiSessionArchiveSchema = Joi.object({ archived: Joi.boolean().required() }).unknown(false);
const aiApprovalDecisionSchema = Joi.object({ decision: Joi.string().valid("approved", "denied").required(), remember: Joi.boolean().default(false) }).unknown(false);

function shortcutIdentity(value: string): string {
  const parts = value.split("+").map((part) => part.trim().toLocaleLowerCase());
  const key = parts.pop() ?? "";
  return [...parts.sort(), key].join("+");
}

/** 保存前拒绝同一用户将相同组合键分配给多个导航动作。 */
function hasShortcutConflict(settings: ShortcutSettings): boolean {
  const identities = Object.values(settings).flat().filter(Boolean).map(shortcutIdentity);
  return new Set(identities).size !== identities.length;
}

function writeSse(response: Response, event: string, value: unknown): void {
  if (response.destroyed || response.writableEnded) return;
  response.write(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`);
}

export function createApiRouter(aiPluginHost: AiPluginHost): Router {
  const router = Router();
  const limitSetup = createRateLimit(5, 10 * 60 * 1000);
  const limitLogin = createRateLimit(30, 15 * 60 * 1000);
  const limitPasswordRecovery = createRateLimit(5, 15 * 60 * 1000);
  const limitRecoveryKeyChange = createRateLimit(10, 15 * 60 * 1000);
  const limitAiInference = createRateLimit(12, 60 * 1000);
  const daemonHeartbeatSchema = Joi.object({
    id: Joi.string().guid().required(),
    displayName: Joi.string().trim().min(1).max(80).required(),
    platform: Joi.string().valid("win32").required(),
    architecture: Joi.string().valid("x64").required(),
    version: Joi.string().trim().max(40).required(),
    capabilities: Joi.array().items(Joi.string().valid("minecraft-vanilla", "app-sandbox-windows-appcontainer-v1")).max(8).required(),
    javaRuntimes: Joi.array().items(Joi.object({
      runtimeId: Joi.string().max(80).required(),
      major: Joi.number().integer().min(8).max(40).required(),
      vendor: Joi.string().max(80).required(),
      managed: Joi.boolean().required()
    }).unknown(false)).max(32).required(),
    activeTaskIds: Joi.array().items(Joi.string().guid()).max(32).unique().default([]),
    instances: Joi.array().items(Joi.object({
      id: Joi.string().guid().required(),
      state: Joi.string().valid("stopped", "running", "installing", "unknown").required(),
      sandboxStatus: Joi.string().valid("unsupported", "unprepared", "prepared", "running", "unknown").default("unknown")
    }).unknown(false)).max(500).required()
  }).unknown(false);
  const minecraftCreateSchema = Joi.object({
    nodeId: Joi.string().guid().required(),
    name: Joi.string().trim().min(1).max(48).required(),
    releaseId: Joi.string().pattern(/^[0-9A-Za-z.-]{1,64}$/u).required(),
    memoryMb: Joi.number().integer().min(1024).max(32768).required(),
    eulaAccepted: Joi.boolean().valid(true).required()
  }).unknown(false);
  const minecraftJavaInstallSchema = Joi.object({
    nodeId: Joi.string().guid().required(),
    major: Joi.number().integer().min(8).max(40).required()
  }).unknown(false);
  const minecraftProgressSchema = Joi.object({
    nodeId: Joi.string().guid().required(),
    progress: Joi.number().integer().min(0).max(100).required(),
    message: Joi.string().trim().min(1).max(240).required()
  }).unknown(false);
  const minecraftLogBatchSchema = Joi.object({
    nodeId: Joi.string().guid().required(),
    instanceId: Joi.string().guid().required(),
    taskId: Joi.string().guid().allow(null).required(),
    stream: Joi.string().valid("stdout", "stderr", "system").required(),
    lines: Joi.array().items(Joi.string().max(4096)).min(1).max(200).required()
  }).unknown(false);
  const minecraftCompletionSchema = Joi.object({
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

  router.get("/health", (_request, response) => {
    try {
      database.prepare("SELECT 1 AS ready").get();
      response.json({
        status: "ok",
        service: "lfaa-server",
        persistence: "ready",
        timestamp: new Date().toISOString()
      });
    } catch {
      response.status(503).json({
        status: "error",
        service: "lfaa-server",
        persistence: "unavailable",
        timestamp: new Date().toISOString()
      });
    }
  });

  router.post("/daemon/heartbeat", requireLocalDaemon, (request, response) => {
    const body = parseBody<Parameters<typeof recordDaemonHeartbeat>[0] & {
      activeTaskIds: string[];
      instances: Array<{ id: string; state: "stopped" | "running" | "installing" | "unknown"; sandboxStatus: "unsupported" | "unprepared" | "prepared" | "running" | "unknown" }>;
    }>(daemonHeartbeatSchema, request.body);
    const { activeTaskIds, instances, ...heartbeat } = body;
    recordDaemonHeartbeat(heartbeat);
    renewMinecraftTaskLeases(body.id, activeTaskIds);
    updateInstanceStatesFromDaemon(body.id, instances);
    response.json({ receivedAt: new Date().toISOString() });
  });

  router.post("/daemon/tasks/claim", requireLocalDaemon, (request, response) => {
    const body = parseBody<{ nodeId: string }>(Joi.object({ nodeId: Joi.string().guid().required() }).unknown(false), request.body);
    const node = getDaemonNode(body.nodeId);
    if (!node || node.status !== "online" || node.platform !== "win32" || node.architecture !== "x64") {
      throw new ApiError(409, "daemon_node_not_ready", "本机 Daemon 尚未登记或平台不受支持。");
    }
    response.json({ task: claimNextMinecraftTask(body.nodeId, node.capabilities.includes("app-sandbox-windows-appcontainer-v1")) });
  });

  router.post("/daemon/tasks/:taskId/progress", requireLocalDaemon, (request, response) => {
    const body = parseBody<{ nodeId: string; progress: number; message: string }>(minecraftProgressSchema, request.body);
    const task = getMinecraftTask(request.params.taskId);
    if (!task || task.nodeId !== body.nodeId) throw new ApiError(404, "daemon_task_not_found", "找不到此节点上的 Minecraft 任务。");
    if (!updateMinecraftTaskProgress(request.params.taskId, body.progress, body.message)) {
      throw new ApiError(409, "daemon_task_not_running", "任务已结束或不处于执行状态。");
    }
    response.status(204).end();
  });

  router.post("/daemon/tasks/:taskId/logs", requireLocalDaemon, (request, response) => {
    const body = parseBody<{ nodeId: string; instanceId: string; taskId: string | null; stream: "stdout" | "stderr" | "system"; lines: string[] }>(minecraftLogBatchSchema, request.body);
    const instance = getMinecraftInstance(body.instanceId);
    if (!instance || instance.nodeId !== body.nodeId) throw new ApiError(404, "minecraft_instance_not_found", "找不到此节点上的 Minecraft 实例。");
    if (request.params.taskId !== String(body.taskId)) throw new ApiError(400, "daemon_log_task_mismatch", "Minecraft 日志任务编号不一致。");
    if (body.taskId) {
      const task = getMinecraftTask(body.taskId);
      if (!task || task.nodeId !== body.nodeId || task.instanceId !== body.instanceId) throw new ApiError(404, "daemon_task_not_found", "找不到此节点上的 Minecraft 任务。");
    }
    appendMinecraftTaskLogs(body.instanceId, body.taskId, body.stream, body.lines);
    response.status(204).end();
  });

  router.post("/daemon/tasks/:taskId/complete", requireLocalDaemon, (request, response) => {
    const body = parseBody<{ nodeId: string; succeeded: boolean; message: string; result: Record<string, unknown> }>(minecraftCompletionSchema, request.body);
    if (!listDaemonNodes().some((node) => node.id === body.nodeId && node.status === "online")) {
      throw new ApiError(409, "daemon_node_not_ready", "本机 Daemon 尚未登记。");
    }
    const task = getMinecraftTask(request.params.taskId);
    if (!task || task.nodeId !== body.nodeId) throw new ApiError(404, "daemon_task_not_found", "找不到此节点上的 Minecraft 任务。");
    if (!completeMinecraftTask(request.params.taskId, body.nodeId, body.succeeded, body.message, body.result)) {
      throw new ApiError(409, "daemon_task_not_running", "任务已结束或不处于执行状态。");
    }
    response.status(204).end();
  });

  router.get("/auth/setup-status", (_request, response) => {
    response.json({ requiresSetup: requiresInitialSetup() });
  });

  router.post("/auth/setup", limitSetup, asyncHandler(async (request, response) => {
    const body = parseBody<{ username: string; password: string; recoveryKey: string }>(accountSchema, request.body);
    const user = await createInitialAdmin(body.username, body.password, body.recoveryKey);
    issueSession(response, user.id);
    response.status(201).json({ user });
  }));

  router.post("/auth/login", limitLogin, asyncHandler(async (request, response) => {
    const body = parseBody<{ username: string; password: string }>(loginSchema, request.body);
    const user = await authenticateUser(body.username, body.password);

    if (!user) {
      throw new ApiError(401, "invalid_credentials", "用户名或密码不正确。");
    }

    issueSession(response, user.id);
    response.json({ user });
  }));

  router.post("/auth/recovery", limitPasswordRecovery, asyncHandler(async (request, response) => {
    const body = parseBody<{ username: string; recoveryKey: string; newPassword: string }>(passwordRecoverySchema, request.body);
    const recovered = await resetPasswordWithRecoveryKey(body.username, body.recoveryKey, body.newPassword);
    if (!recovered) {
      throw new ApiError(400, "recovery_failed", "用户名或恢复密钥不正确；升级前创建的账户可先登录并在设置中补设恢复密钥。");
    }
    response.json({ message: "密码已重置，请使用新密码登录。" });
  }));

  router.put("/auth/recovery-key", requireAuthentication, limitRecoveryKeyChange, asyncHandler(async (request, response) => {
    const body = parseBody<{ currentPassword: string; recoveryKey: string }>(recoveryKeySchema, request.body);
    const saved = await setRecoveryKey(request.auth!.user.id, body.currentPassword, body.recoveryKey);
    if (!saved) {
      throw new ApiError(401, "invalid_current_password", "当前登录密码不正确。");
    }
    response.json({ message: "恢复密钥已更新。" });
  }));

  router.get("/auth/me", requireAuthentication, (request, response) => {
    response.json({ user: request.auth?.user });
  });

  router.post("/auth/logout", requireAuthentication, (request, response) => {
    if (request.auth) {
      revokeSession(request.auth.sessionId);
    }
    clearSessionCookie(response);
    response.status(204).end();
  });

  router.get("/preferences", requireAuthentication, (request, response) => {
    response.json({ preferences: getUserPreferences(request.auth!.user.id) });
  });

  router.put("/preferences", requireAuthentication, (request, response) => {
    const body = parseBody<{ selectedApp: ApplicationId; selectedMode: ApplicationMode }>(preferencesSchema, request.body);
    const preferences = saveUserPreferences(request.auth!.user.id, body);
    response.json({ preferences });
  });

  router.get("/settings", requireAuthentication, (request, response) => {
    response.json({ settings: getUserSettings(request.auth!.user.id) });
  });

  router.put("/settings/:category", requireAuthentication, (request, response) => {
    const category = request.params.category as SettingsCategory;
    const schemas = {
      general: generalSettingsSchema,
      appearance: appearanceSettingsSchema,
      shortcuts: shortcutsSchema,
      "ai-runtime": aiRuntimeSettingsSchema,
      permissions: permissionsSettingsSchema,
      plugins: pluginsSettingsSchema
    };
    const schema = schemas[category];
    if (!schema) throw new ApiError(404, "settings_category_not_found", "找不到此设置分类。");
    const value = parseBody<Record<string, unknown>>(schema, request.body);
    if (category === "shortcuts" && hasShortcutConflict(value as unknown as ShortcutSettings)) {
      throw new ApiError(400, "shortcut_conflict", "快捷键重复，请为每个动作设置不同的组合键。");
    }
    if (category === "appearance") {
      const appearance = value as { backgrounds: Record<string, string> };
      if (appearance.backgrounds.login.startsWith("user-")) {
        throw new ApiError(400, "appearance_login_background_must_be_builtin", "登录页背景只能使用内置图片。");
      }
      const uploadedIds = new Set(listUserBackgrounds(request.auth!.user.id).map((background) => background.id));
      if (Object.values(appearance.backgrounds).some((backgroundId) => backgroundId.startsWith("user-") && !uploadedIds.has(backgroundId))) {
        throw new ApiError(400, "appearance_background_not_owned", "背景设置引用了当前账户没有的图片。");
      }
    }
    saveUserSettings(request.auth!.user.id, category, value as never);
    response.json({ settings: getUserSettings(request.auth!.user.id) });
  });

  router.get("/ai/extensions", requireAuthentication, (_request, response) => {
    response.json({ plugins: aiPluginHost.listPlugins(), extensions: aiPluginHost.listExtensions(), hooks: aiPluginHost.listHooks() });
  });

  router.get("/ai/sessions", requireAuthentication, (request, response) => {
    const archivedValue = request.query.archived;
    const appValue = request.query.appId;
    if (archivedValue !== undefined && archivedValue !== "true" && archivedValue !== "false") throw new ApiError(400, "invalid_archived_filter", "归档筛选值无效。");
    if (appValue !== undefined && !["steamcmd", "minecraft", "writing"].includes(String(appValue))) throw new ApiError(400, "invalid_application_filter", "应用筛选值无效。");
    response.json({ sessions: listAiSessions(request.auth!.user.id, archivedValue === "true", appValue as "steamcmd" | "minecraft" | "writing" | undefined) });
  });

  router.get("/ai/sessions/:sessionId/messages", requireAuthentication, (request, response) => {
    const messages = getAiSessionMessages(request.auth!.user.id, request.params.sessionId);
    if (!messages) throw new ApiError(404, "ai_session_not_found", "找不到此 AI 会话。");
    response.json({ messages });
  });

  router.patch("/ai/sessions/:sessionId/archive", requireAuthentication, (request, response) => {
    const body = parseBody<{ archived: boolean }>(aiSessionArchiveSchema, request.body);
    const session = setAiSessionArchived(request.auth!.user.id, request.params.sessionId, body.archived);
    if (!session) throw new ApiError(404, "ai_session_not_found", "找不到此 AI 会话。");
    response.json({ session });
  });

  router.get("/ai/usage", requireAuthentication, (request, response) => {
    response.json({ usage: getAiUsageSummary(request.auth!.user.id) });
  });

  router.get("/ai/approvals", requireAuthentication, (request, response) => {
    response.json({ approvals: listAiToolApprovals(request.auth!.user.id, "pending") });
  });

  router.get("/ai/permissions/grants", requireAuthentication, (request, response) => {
    response.json({ grants: listAiToolPermissionGrants(request.auth!.user.id) });
  });

  router.delete("/ai/permissions/grants/:grantId", requireAuthentication, (request, response) => {
    if (!revokeAiToolPermissionGrant(request.auth!.user.id, request.params.grantId)) {
      throw new ApiError(404, "ai_permission_grant_not_found", "找不到此账户的记忆授权。");
    }
    response.status(204).end();
  });

  router.patch("/ai/approvals/:approvalId", requireAuthentication, (request, response) => {
    const body = parseBody<{ decision: "approved" | "denied"; remember: boolean }>(aiApprovalDecisionSchema, request.body);
    if (body.remember && body.decision !== "approved") throw new ApiError(400, "invalid_ai_approval_memory", "拒绝操作时不能保存记忆授权。");
    if (body.remember && getUserSettings(request.auth!.user.id).permissions.mode !== "approve_remembered") {
      throw new ApiError(409, "ai_permission_mode_changed", "请先保存“替我审批”模式，再记住此类操作。");
    }
    let approval;
    try {
      approval = decideAiToolApproval(request.auth!.user.id, request.params.approvalId, body.decision, body.remember);
    } catch (error) {
      if (error instanceof AiPermissionModeChangedError) throw new ApiError(409, "ai_permission_mode_changed", error.message);
      throw error;
    }
    if (!approval) throw new ApiError(409, "ai_approval_not_pending", "审批请求已处理或不存在。");
    response.json({ approval });
  });

  router.post("/ai/chat/stream", requireAuthentication, limitAiInference, asyncHandler(async (request, response) => {
    const body = parseBody<{ appId: "steamcmd" | "minecraft" | "writing"; sessionId: string | null; content: string }>(aiChatMessageSchema, request.body);
    const userId = request.auth!.user.id;
    const account = resolveActiveAiModelConfiguration(userId);
    if (!account) throw new ApiError(409, "ai_provider_required", "请先在设置中心的“AI 与模型”添加并启用一个 Provider 账户。");

    let turn: ReturnType<typeof createAiTurn>;
    try {
      turn = createAiTurn(userId, body.appId, body.sessionId, body.content);
    } catch (error) {
      const message = error instanceof Error ? error.message : "无法创建 AI 会话。";
      throw new ApiError(message.includes("已归档") ? 409 : 404, message.includes("已归档") ? "ai_session_archived" : "ai_session_not_found", message);
    }

    response.status(200);
    response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders();
    writeSse(response, "session", { session: turn.session, userMessage: turn.userMessage, assistantMessage: turn.assistantMessage });

    const abortController = new AbortController();
    response.on("close", () => { if (!response.writableEnded) abortController.abort(); });
    let answer = "";
    let inferenceStatus: "complete" | "error" | "interrupted" = "error";
    let promptTokens: number | null = null;
    let completionTokens: number | null = null;
    try {
      const settings = getUserSettings(userId);
      const beforeHooks = aiPluginHost.runBeforeInference({
        requestId: turn.assistantMessage.id,
        applicationId: body.appId,
        providerId: account.providerId,
        modelId: account.modelId,
        messageCount: turn.history.length
      });
      if (beforeHooks.failedHookIds.length) logger.warn("AI Runtime beforeInference Hook 执行失败", { failedHookIds: beforeHooks.failedHookIds });
      const usage = await streamAiCompletion({
        account,
        applicationId: body.appId,
        messages: turn.history,
        extensions: settings.plugins.enabled ? aiPluginHost.getSystemInstructions(body.appId) : [],
        settings: settings.aiRuntime,
        signal: abortController.signal,
        onDelta: (delta) => {
          answer += delta;
          if (answer.length > 2_000_000) throw new Error("模型输出超过允许大小。");
          writeSse(response, "delta", { messageId: turn.assistantMessage.id, delta });
        }
      });
      finishAiAssistantMessage(userId, turn.session.id, turn.assistantMessage.id, answer, "complete");
      recordAiUsage(userId, turn.session.id, turn.assistantMessage.id, account.providerId, account.modelId, usage.promptTokens, usage.completionTokens);
      promptTokens = usage.promptTokens;
      completionTokens = usage.completionTokens;
      inferenceStatus = "complete";
      writeSse(response, "usage", { messageId: turn.assistantMessage.id, promptTokens: usage.promptTokens, completionTokens: usage.completionTokens, providerId: account.providerId, modelId: account.modelId });
      writeSse(response, "done", { status: "complete" });
    } catch (error) {
      const interrupted = abortController.signal.aborted || (error instanceof Error && error.name === "AbortError");
      inferenceStatus = interrupted ? "interrupted" : "error";
      finishAiAssistantMessage(userId, turn.session.id, turn.assistantMessage.id, answer, interrupted ? "interrupted" : "error");
      if (!interrupted) {
        const errorMessage = error instanceof Error && error.name === "TimeoutError"
          ? "模型请求超时，请在“AI 与模型”调整超时时间或检查 Provider 状态。"
          : error instanceof Error ? error.message : "模型请求失败，请检查 Provider 配置后重试。";
        writeSse(response, "error", { message: errorMessage });
      }
      writeSse(response, "done", { status: interrupted ? "interrupted" : "error" });
    } finally {
      const afterHooks = aiPluginHost.runAfterInference({
        requestId: turn.assistantMessage.id,
        applicationId: body.appId,
        providerId: account.providerId,
        modelId: account.modelId,
        messageCount: turn.history.length,
        status: inferenceStatus,
        promptTokens,
        completionTokens
      });
      if (afterHooks.failedHookIds.length) logger.warn("AI Runtime afterInference Hook 执行失败", { failedHookIds: afterHooks.failedHookIds });
      if (!response.writableEnded) response.end();
    }
  }));

  router.get("/settings/backgrounds", requireAuthentication, (request, response) => {
    response.json({ backgrounds: listUserBackgrounds(request.auth!.user.id) });
  });

  router.post("/settings/backgrounds", requireAuthentication, (request, response) => {
    const body = parseBody<{ name: string; dataUrl: string }>(backgroundUploadSchema, request.body);
    try {
      response.status(201).json({ background: saveUserBackground(request.auth!.user.id, body.dataUrl, body.name) });
    } catch (error) {
      throw new ApiError(422, "appearance_background_invalid", error instanceof Error ? error.message : "背景图片无法保存。");
    }
  });

  router.get("/settings/backgrounds/:backgroundId", requireAuthentication, (request, response) => {
    const image = getUserBackground(request.auth!.user.id, request.params.backgroundId);
    if (!image) throw new ApiError(404, "appearance_background_not_found", "找不到这张背景图片。");
    response.setHeader("Content-Type", image.mimeType);
    response.setHeader("Content-Length", image.data.length);
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "private, no-store");
    response.end(image.data);
  });

  router.delete("/settings/backgrounds/:backgroundId", requireAuthentication, (request, response) => {
    deleteUserBackground(request.auth!.user.id, request.params.backgroundId);
    response.status(204).end();
  });

  router.get("/settings/ai/providers", requireAuthentication, (_request, response) => {
    response.json({ providers: listAiProviders() });
  });

  router.get("/settings/ai/accounts", requireAuthentication, (request, response) => {
    response.json({ accounts: listAiAccounts(request.auth!.user.id) });
  });

  router.post("/settings/ai/probe", requireAuthentication, asyncHandler(async (request, response) => {
    const body = parseBody<{ providerId: string; secret: string; options: Record<string, string> }>(aiProbeSchema, request.body);
    try {
      response.json({ result: await probeAiProvider(body) });
    } catch (error) {
      throw new ApiError(422, "ai_provider_probe_failed", error instanceof Error ? error.message : "Provider 连接测试失败。");
    }
  }));

  router.post("/settings/ai/accounts", requireAuthentication, asyncHandler(async (request, response) => {
    const body = parseBody<{ providerId: string; secret: string; options: Record<string, string>; displayName: string; modelId: string }>(aiAccountSchema, request.body);
    try {
      const account = await saveAiAccount(request.auth!.user.id, body);
      response.status(201).json({ account });
    } catch (error) {
      throw new ApiError(422, "ai_account_save_failed", error instanceof Error ? error.message : "AI 账户保存失败。");
    }
  }));

  router.post("/settings/ai/accounts/:accountId/retest", requireAuthentication, asyncHandler(async (request, response) => {
    try {
      response.json({ result: await reprobeAiAccount(request.auth!.user.id, request.params.accountId) });
    } catch (error) {
      throw new ApiError(422, "ai_account_probe_failed", error instanceof Error ? error.message : "AI 账户重测失败。");
    }
  }));

  router.put("/settings/ai/accounts/:accountId/model", requireAuthentication, (request, response) => {
    const body = parseBody<{ modelId: string }>(aiModelSchema, request.body);
    try {
      response.json({ account: updateAiAccountModel(request.auth!.user.id, request.params.accountId, body.modelId) });
    } catch (error) {
      throw new ApiError(422, "ai_account_model_failed", error instanceof Error ? error.message : "AI 模型更新失败。");
    }
  });

  router.post("/settings/ai/accounts/:accountId/activate", requireAuthentication, (request, response) => {
    try {
      response.json({ account: activateAiAccount(request.auth!.user.id, request.params.accountId) });
    } catch (error) {
      throw new ApiError(404, "ai_account_activation_failed", error instanceof Error ? error.message : "AI 账户激活失败。");
    }
  });

  router.delete("/settings/ai/accounts/:accountId", requireAuthentication, (request, response) => {
    deleteAiAccount(request.auth!.user.id, request.params.accountId);
    response.status(204).end();
  });

  router.get("/users", requireAuthentication, requireRole("admin"), (_request, response) => {
    response.json({ users: listUsers() });
  });

  router.get("/minecraft/overview", requireAuthentication, asyncHandler(async (_request, response) => {
    response.json({ overview: await getMinecraftOverview() });
  }));

  router.get("/minecraft/nodes", requireAuthentication, (_request, response) => {
    response.json({ nodes: listDaemonNodes() });
  });

  router.get("/minecraft/releases", requireAuthentication, asyncHandler(async (_request, response) => {
    response.json({ catalog: await getMinecraftReleases() });
  }));

  router.get("/minecraft/releases/:releaseId", requireAuthentication, asyncHandler(async (request, response) => {
    response.json({ release: await getMinecraftRelease(request.params.releaseId) });
  }));

  router.get("/minecraft/java", requireAuthentication, (_request, response) => {
    response.json({ nodes: listMinecraftJavaRuntimes() });
  });

  router.post("/minecraft/java/install", requireAuthentication, requireRole("admin"), (request, response) => {
    const body = parseBody<{ nodeId: string; major: number }>(minecraftJavaInstallSchema, request.body);
    response.status(202).json({ task: installMinecraftJava(body.nodeId, request.auth!.user.id, body.major) });
  });

  router.get("/minecraft/instances", requireAuthentication, (_request, response) => {
    response.json({ instances: listMinecraftInstances() });
  });

  router.post("/minecraft/instances", requireAuthentication, requireRole("admin"), asyncHandler(async (request, response) => {
    const body = parseBody<{ nodeId: string; name: string; releaseId: string; memoryMb: number; eulaAccepted: true }>(minecraftCreateSchema, request.body);
    response.status(202).json({ ...await createMinecraftInstance({ ...body, userId: request.auth!.user.id }) });
  }));

  router.get("/minecraft/instances/:instanceId", requireAuthentication, (request, response) => {
    const instance = getMinecraftInstance(request.params.instanceId);
    if (!instance) throw new ApiError(404, "minecraft_instance_not_found", "找不到这个 Minecraft 实例。");
    response.json({ instance });
  });

  router.get("/minecraft/instances/:instanceId/logs", requireAuthentication, (request, response) => {
    response.json({ logs: getMinecraftInstanceLogs(request.params.instanceId) });
  });

  router.post("/minecraft/instances/:instanceId/start", requireAuthentication, requireRole("admin"), (request, response) => {
    response.status(202).json({ task: startMinecraftInstance(request.params.instanceId, request.auth!.user.id) });
  });

  router.post("/minecraft/instances/:instanceId/stop", requireAuthentication, requireRole("admin"), (request, response) => {
    response.status(202).json({ task: stopMinecraftInstance(request.params.instanceId, request.auth!.user.id) });
  });

  router.post("/minecraft/instances/:instanceId/backup", requireAuthentication, requireRole("admin"), (request, response) => {
    response.status(202).json({ task: backupMinecraftWorld(request.params.instanceId, request.auth!.user.id) });
  });

  router.patch("/minecraft/instances/:instanceId/properties", requireAuthentication, requireRole("admin"), (request, response) => {
    const body = parseBody<{ properties: unknown }>(Joi.object({
      properties: Joi.object().min(1).required()
    }).unknown(false), request.body);
    const properties = validateMinecraftServerProperties(body.properties);
    response.status(202).json({ task: updateMinecraftServerProperties(request.params.instanceId, request.auth!.user.id, properties) });
  });

  router.get("/minecraft/tasks", requireAuthentication, (_request, response) => {
    response.json({ tasks: listMinecraftTaskRecords() });
  });

  return router;
}
