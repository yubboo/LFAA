import { FILE_MANAGER_OPERATIONS } from "lfaa-util-values/src/file-manager-contract.js";
/** 功能：定义 HTTP 请求校验和共享响应合同。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。 */
import { type Request, type RequestHandler, type Response, type NextFunction } from "express";
import Joi from "joi";
import jwt from "jsonwebtoken";
import { timingSafeEqual } from "node:crypto";
import { config } from "lfaa-launch-environment/src/config.js";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import { setSessionCookie } from "lfaa-authorization/src/middleware.js";
import { type DaemonNode, type JavaRuntimeSummary } from "lfaa-host-daemon/src/local-daemon.js";
import { authenticateDaemonCredential, isRemoteDaemonIdentity } from "lfaa-host-daemon/src/node-credentials.js";
import { type MinecraftTask } from "lfaa-jobs/src/minecraft-queue.js";
import { createSession, sessionLifetimeSeconds } from "lfaa-identity-auth/src/service.js";
import { type ShortcutSettings } from "lfaa-settings/src/service.js";
import { APPLICATION_IDS } from "lfaa-util-values/src/application-id.js";
import { EXECUTION_SANDBOX_MODES } from "lfaa-util-values/src/sandbox-contract.js";
import { EASYTIER_RUNTIME_RELEASE } from "lfaa-game-connectivity/src/easytier-release.mjs";
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

export const typertRemoteCallSchema = Joi.object({ input: Joi.any().required() }).unknown(false);

/** 长连接也复用节点身份与 TLS 检查；在派发和保活时重新检查，撤销/轮换立即失效。 */
export function validateDaemonRequest(request: Request): void {
  const authorization = request.header("authorization") ?? "";
  const match = /^Bearer ([A-Za-z0-9_-]{32,128})$/u.exec(authorization);
  if (!match) {
    throw new ApiError(401, "daemon_authentication_required", "本机 Daemon 身份校验失败。");
  }
  const received = Buffer.from(match[1]!);
  const expected = Buffer.from(config.daemonToken);
  const local = received.length === expected.length && timingSafeEqual(received, expected);
  const remote = local ? null : authenticateDaemonCredential(match[1]!);
  const requestedId = request.body?.nodeId ?? request.body?.id ?? request.query.nodeId;
  // 密钥绑定真实目标节点，不能拿节点 A 的凭据领取或回报节点 B 的任务。
  if ((!local && !remote) || remote && requestedId !== remote.nodeId || local && typeof requestedId === "string" && isRemoteDaemonIdentity(requestedId)) {
    throw new ApiError(401, "daemon_authentication_required", "本机 Daemon 身份校验失败。");
  }
  if (remote && !request.secure) {
    throw new ApiError(403, "daemon_tls_required", "远程节点必须通过 HTTPS 连接控制端。");
  }
}
export const requireLocalDaemon: RequestHandler = (request, _response, next) => {
  try { validateDaemonRequest(request); next(); } catch (error) { next(error); }
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

export const trustedContactInvitationSchema = Joi.object({ code: Joi.string().pattern(/^[A-Za-z0-9_-]{32,64}$/u).required() }).unknown(false);
export const trustedRecoveryStartSchema = Joi.object({
  username: Joi.string().trim().min(1).max(32).required(),
  contactUsername: Joi.string().trim().min(1).max(32).required()
}).unknown(false);
export const trustedRecoveryCodeSchema = Joi.object({ code: Joi.string().pattern(/^[A-Za-z0-9_-]{32,64}$/u).required() }).unknown(false);
export const trustedRecoveryCompleteSchema = Joi.object({
  code: Joi.string().pattern(/^[A-Za-z0-9_-]{32,64}$/u).required(),
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

export const accountUsernameSchema = Joi.object({
  currentPassword: Joi.string().min(1).max(128).required(),
  username: Joi.string().trim().min(3).max(32).pattern(/^[\p{L}\p{N}_.-]+$/u).required()
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
  selectedApp: Joi.string().valid(...APPLICATION_IDS).required(),
  selectedMode: Joi.string().valid("normal", "ai-work").required(),
  guidedEntryCompleted: Joi.boolean().required()
});

export const accountAgentUsagePolicySchema = Joi.object({
  enabled: Joi.boolean().required(),
  timezone: Joi.string().trim().min(1).max(80).required(),
  dailyLimitMinutes: Joi.number().integer().min(1).max(1440).required(),
  weeklyWindows: Joi.array().length(7).items(Joi.object({
    enabled: Joi.boolean().required(),
    start: Joi.string().pattern(/^(?:[01]\d|2[0-3]):[0-5]\d$/u).required(),
    end: Joi.string().pattern(/^(?:[01]\d|2[0-3]):[0-5]\d$/u).required()
  }).unknown(false)).required()
}).unknown(false);
export const accountSnapshotCreateSchema = Joi.object({ name: Joi.string().trim().min(1).max(120).required() }).unknown(false);
export const accountArchiveRestoreSchema = Joi.object({ settings: Joi.boolean().required(), memories: Joi.boolean().required(), sessions: Joi.boolean().required() })
  .or("settings", "memories", "sessions").unknown(false);

export { appearanceBackgroundIdSchema, generalSettingsSchema, aiRuntimeSettingsSchema, minecraftRuntimeSettingsSchema, gitSettingsSchema, permissionsSettingsSchema, pluginsSettingsSchema, personalizationSettingsSchema, conversationMemoriesSchema, computerControlSettingsSchema, browserUseSettingsSchema, miniSettingsSchema, canvasSettingsSchema, appearanceFontsSchema, appearanceModeStyleSchema, appearancePresetSchema, appearancePresetSnapshotSchema, appearanceSettingsSchema, shortcutBindingsSchema, shortcutsSchema } from "lfaa-settings/src/validation.js";

export const aiProbeSchema = Joi.object({
  providerId: Joi.string().valid("openai", "deepseek", "doubao", "qwen", "kimi", "zhipu", "xiaomi", "ark-agent-plan", "ark-coding-plan").required(),
  secret: Joi.string().trim().min(1).max(4096).required(),
  modelId: Joi.string().trim().min(1).max(160),
  options: Joi.object().pattern(/^[A-Za-z][A-Za-z0-9]{0,31}$/u, Joi.string().max(128)).default({}).unknown(false)
}).unknown(false);

export const aiAccountSchema = aiProbeSchema.keys({
  displayName: Joi.string().trim().min(1).max(48).required(),
  modelId: Joi.string().trim().min(1).max(160).required(),
  reasoningMode: Joi.string().trim().max(16).default("default"),
  verificationToken: Joi.string().trim().min(32).max(128)
});

export const aiAccountCredentialSchema = Joi.object({
  secret: Joi.string().trim().min(1).max(4096).required()
}).unknown(false);

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

export const agentAssociationsSchema = Joi.object({
  applicationIds: Joi.array().items(Joi.string().valid(...APPLICATION_IDS)).max(APPLICATION_IDS.length).unique().required(),
  capabilityIds: Joi.array().items(Joi.string().pattern(/^[A-Za-z0-9._:/-]{1,180}$/u)).max(16).unique().required()
}).unknown(false);

const aiWorkbenchViewSchema = Joi.object({
  rightPane: Joi.string().valid("browser", "new-tab", "git", "assets", "applications", "side-chat", "extension", "project-file", "application-tools").required(),
  rightPaneOpen: Joi.boolean().required(),
  bottomTerminalOpen: Joi.boolean().required(),
  browserUrl: Joi.string().uri({ scheme: ["http", "https"] }).max(2_048),
  canvas: Joi.object({
    applicationId: Joi.string().valid(...APPLICATION_IDS).required(),
    projectId: Joi.string().guid({ version: ["uuidv4", "uuidv5"] }).required(),
    title: Joi.string().trim().max(80).required(),
    updatedAt: Joi.string().isoDate().required()
  }).unknown(false),
  workflow: Joi.object({
    applicationId: Joi.string().valid(...APPLICATION_IDS).required(),
    workflowId: Joi.string().guid({ version: ["uuidv4", "uuidv5"] }).required(),
    title: Joi.string().trim().max(80).required(),
    updatedAt: Joi.string().isoDate().required()
  }).unknown(false),
  applicationProject: Joi.object({
    applicationId: Joi.string().valid(...APPLICATION_IDS).required(),
    projectId: Joi.string().guid({ version: ["uuidv4", "uuidv5"] }).required(),
    title: Joi.string().trim().max(80).required(),
    updatedAt: Joi.string().isoDate().required()
  }).unknown(false)
}).custom((value, helpers) => value.browserUrl !== undefined && (value.rightPane !== "browser" || !value.rightPaneOpen)
  ? helpers.error("any.invalid") : value).unknown(false);

export const aiChatMessageSchema = Joi.object({
  appId: Joi.string().valid(...APPLICATION_IDS).required(),
  sessionId: Joi.string().guid({ version: ["uuidv4", "uuidv5"] }).allow(null).default(null),
  projectId: Joi.string().guid({ version: ["uuidv4", "uuidv5"] }).allow(null),
  gitRepositoryId: Joi.string().guid({ version: ["uuidv4", "uuidv5"] }).allow(null),
  planMode: Joi.boolean(),
  associations: agentAssociationsSchema,
  /** 当前 Client 工作台的受限视图提示；只供本轮模型识别界面，不作为权限或执行依据。 */
  workspaceView: aiWorkbenchViewSchema,
  // 附件只传 ID：字节归附件 Owner，模型请求按需读取，会话不存图片内容。
  attachmentIds: Joi.array().items(Joi.string().guid({ version: ["uuidv4", "uuidv5"] })).max(4).unique(),
  /** 与 attachmentIds 对应的显示名；只用于消息展示，不改变附件归属。 */
  attachments: Joi.array().items(Joi.object({ id: Joi.string().guid({ version: ["uuidv4", "uuidv5"] }).required(), name: Joi.string().trim().min(1).max(128) }).unknown(false)).max(4),
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
export const aiSessionPlanModeSchema = Joi.object({ active: Joi.boolean().required() }).unknown(false);

export const aiSessionForkSchema = Joi.object({
  messageId: Joi.string().guid({ version: ["uuidv4"] }).required()
}).unknown(false);

export const aiMessageFeedbackSchema = Joi.object({
  rating: Joi.string().valid("positive", "negative").required(),
  reasons: Joi.array().items(Joi.string().trim().min(1).max(80)).max(6).unique().default([]),
  detail: Joi.string().trim().max(2000).default("")
}).custom((value, helpers) => value.reasons.length || value.detail ? value : helpers.error("any.invalid")).unknown(false);

export const aiApprovalDecisionSchema = Joi.object({ decision: Joi.string().valid("approved", "denied").required(), remember: Joi.boolean().default(false) }).unknown(false);

export const aiRunQuestionAnswerSchema = Joi.object({
  questionId: Joi.string().guid({ version: ["uuidv4"] }).required(),
  answer: Joi.string().trim().max(12000).allow("").required(),
  skipped: Joi.boolean().default(false)
}).unknown(false);

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
    capabilities: Joi.array().items(Joi.string().valid("minecraft-vanilla", "minecraft-native-v1", "minecraft-multicore-v1", "minecraft-interactive-console-v1", "minecraft-instance-archive-v1", "minecraft-server-properties-file-v1", "app-sandbox-windows-appcontainer-v1", "java-environment-manager-v1", "runtime-environment-v1", "minecraft-java-runtime-selection-v1", "node-filesystem-v1", "node-filesystem-v2", "node-filesystem-directory-size-v1", "node-filesystem-instance-v1", "node-filesystem-game-storage-v1", "node-filesystem-binary-transfer-v1", "steamcmd-ready-v1", "agent-shell-v1", "project-files-v1", EASYTIER_RUNTIME_RELEASE.installCapability, EASYTIER_RUNTIME_RELEASE.runtimeCapability)).max(20).unique().required(),
    javaRuntimes: Joi.array().items(Joi.object({
      distribution: Joi.string().valid("temurin", "zulu").optional(),
      version: Joi.string().max(80),
      architecture:Joi.string().max(80),
      os:Joi.string().max(80),
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
      state: Joi.string().valid("stopped", "running", "starting", "installing", "unknown").required(),
      sandboxStatus: Joi.string().valid("unsupported", "unprepared", "prepared", "running", "unknown").default("unknown")
    }).unknown(false)).max(500).required(),
    steamcmdServers: Joi.array().items(Joi.object({
      id: Joi.string().guid().required(),
      status: Joi.string().valid("unknown", "stopped", "running", "starting", "stopping").required(),
      processId: Joi.number().integer().min(1).allow(null).required()
    }).unknown(false)).max(500).default([])
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
      archived: Joi.boolean(),
      runtimeVendor: Joi.string().max(80),
      imageType: Joi.string().valid("jre", "jdk"),
      deploymentId: Joi.string().guid(),
      releaseId: Joi.string().max(120),
      coreType: Joi.string().max(32),
      coreBuild: Joi.string().max(120),
      executionMode: Joi.string().valid("native", "appcontainer"),
      processStarted: Joi.boolean(),
      serverReady: Joi.boolean(),
      locallyListening: Joi.boolean().allow(null),
      lanReachable:Joi.boolean().allow(null),
      externallyReachable: Joi.boolean().allow(null),
      clientLoginVerified:Joi.boolean(),
      outcome:Joi.string().valid("unknown","cancelled"),
      serverPort: Joi.number().integer().min(1024).max(65535),
      evidence: Joi.string().max(240),
      forced: Joi.boolean(),
      stopped: Joi.boolean(),
      exitCode: Joi.number().integer().allow(null),
      worldSaveConfirmed: Joi.boolean().allow(null),
      serverType: Joi.string().max(32),
      delivered: Joi.boolean(),
      verified: Joi.boolean(),
      note: Joi.string().max(240),
      properties: Joi.object({ serverPort: Joi.number().integer().min(1024).max(65535) }).unknown(false),
      serverProperties: Joi.object({
        motd: Joi.string().max(120).allow(""),
        difficulty: Joi.string().valid("peaceful", "easy", "normal", "hard"),
        gamemode: Joi.string().valid("survival", "creative", "adventure", "spectator"),
        maxPlayers: Joi.number().integer().min(1).max(200),
        serverPort: Joi.number().integer().min(1024).max(65535),
        viewDistance: Joi.number().integer().min(2).max(32),
        simulationDistance: Joi.number().integer().min(2).max(32),
        levelName: Joi.string().max(64),
        levelSeed: Joi.string().max(80).allow(""),
        pvp: Joi.boolean(),
        onlineMode: Joi.boolean(),
        whiteList: Joi.boolean()
      }).unknown(false),
      fileSnapshot: Joi.object({
        source: Joi.string().valid("node").required(),
        observedAt: Joi.string().isoDate().required(),
        entries: Joi.array().items(Joi.object({
          key: Joi.string().pattern(/^[A-Za-z0-9._-]{1,128}$/u).required(),
          value: Joi.string().max(4096).allow("", null).required(),
          sensitive: Joi.boolean().required()
        }).unknown(false)).max(256).required()
      }).unknown(false)
    }).unknown(false).default({})
  }).unknown(false);

export const fileOperationSchema = Joi.object({
    nodeId: Joi.string().guid().required(),
    operation: Joi.string().valid(...FILE_MANAGER_OPERATIONS).required(),
    path: Joi.string().max(1024).allow("").required(),
    query: Joi.string().trim().min(1).max(100).when("operation", { is: "search", then: Joi.required(), otherwise: Joi.forbidden() }),
    name: Joi.string().trim().min(1).max(255).when("operation", { is: Joi.valid("rename", "upload", "trash-restore", "trash-purge"), then: Joi.required(), otherwise: Joi.forbidden() }),
    destinationPath: Joi.string().max(1024).allow("").when("operation", { is: "move", then: Joi.required(), otherwise: Joi.forbidden() }),
    content: Joi.string().allow("").max(2 * 1024 * 1024).when("operation", { is: "write", then: Joi.required(), otherwise: Joi.forbidden() }),
    sha256: Joi.string().hex().length(64).lowercase().when("operation", { is: "upload", then: Joi.required(), otherwise: Joi.forbidden() }),
    expectedSha256: Joi.string().hex().length(64).lowercase().when("operation", { is: "write", then: Joi.required(), otherwise: Joi.forbidden() })
  }).unknown(false);

export const steamcmdConfigurationSettingsSchema = Joi.object({
    installMode: Joi.string().valid("online", "manual").required(),
    steamcmdDirectory: Joi.string().trim().min(1).max(512).required()
  }).unknown(false);

export const steamcmdStorageSettingsSchema = Joi.object({
    gameDirectory: Joi.string().trim().min(1).max(512).required()
  }).unknown(false);

export const steamcmdServerSchema = Joi.object({
    nodeId: Joi.string().guid().required(),
    name: Joi.string().trim().min(1).max(80).pattern(/^[^\u0000-\u001f\u007f]+$/u).required(),
    toolAppId: Joi.number().integer().min(1).max(2147483647).required(),
    installDirectory: Joi.string().trim().min(1).max(512).required(),
    executablePath: Joi.string().max(1024).allow("").default(""),
    launchArguments: Joi.array().items(Joi.string().max(1024).pattern(/^[^\r\n\u0000]*$/u)).max(64).default([]),
    stopCommand: Joi.string().max(120).pattern(/^[^\r\n\u0000-\u001f\u007f]*$/u).allow("").default(""),
    stopTimeoutSeconds: Joi.number().integer().min(5).max(300).default(60),
    eulaAccepted: Joi.boolean().required()
  }).unknown(false);

export const steamcmdDstClusterSchema = Joi.object({
    nodeId: Joi.string().guid().required(),
    clusterName: Joi.string().pattern(/^[A-Za-z0-9_-]{1,32}$/u).required(),
    toolAppId: Joi.number().integer().min(1).max(2147483647).required(),
    installDirectory: Joi.string().trim().min(1).max(512).required(),
    stopCommand: Joi.string().trim().min(1).max(120).pattern(/^[^\r\n\u0000-\u001f\u007f]+$/u).required(),
    stopTimeoutSeconds: Joi.number().integer().min(5).max(300).default(60),
    eulaAccepted: Joi.boolean().valid(true).required()
  }).unknown(false);

export const steamcmdServerTaskSchema = Joi.object({
    kind: Joi.string().valid("install-server", "update-server", "start-server", "stop-server").required()
  }).unknown(false);

export const minecraftStorageSettingsSchema = Joi.object({
    instanceDirectory: Joi.string().trim().min(1).max(512).required()
  }).unknown(false);

export const projectContentStorageSchema = Joi.object({
    contentDirectory: Joi.string().trim().min(1).max(2_048).required()
  }).unknown(false);

export const projectContentMigrationSchema = Joi.object({
    targetDirectory: Joi.string().trim().min(1).max(2_048).required()
  }).unknown(false);

export const projectContentArchiveImportSchema = Joi.object({
    targetDirectory: Joi.string().trim().min(1).max(2_048).required(),
    archivePath: Joi.string().trim().min(1).max(2_048).required()
  }).unknown(false);

export const dataDirectorySettingsSchema = Joi.object({
    directory: Joi.string().trim().min(1).max(2048).required(),
    mode: Joi.string().valid("copy", "adopt", "archive").default("copy"),
    archivePath: Joi.string().trim().max(2048).allow("").default("")
  }).unknown(false);

export const pluginRuntimeActionSchema = Joi.object({
    action: Joi.string().valid("start", "stop", "reload").required()
  }).unknown(false);

export const steamcmdTaskSchema = Joi.object({
    nodeId: Joi.string().guid().required(),
    kind: Joi.string().valid("install", "verify", "uninstall").required()
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
      verified: Joi.boolean(),
      installed: Joi.boolean(),
      toolAppId: Joi.number().integer().min(1).max(2147483647),
      installDirectory: Joi.string().max(512),
      processStarted: Joi.boolean(),
      processId: Joi.number().integer().min(1),
      stopped: Joi.boolean(),
      forced: Joi.boolean(),
      removed: Joi.boolean(),
      uninstalled: Joi.boolean()
    }).unknown(false).default({})
  }).unknown(false);

export const fileEntrySchema = Joi.object({
    name: Joi.string().max(255).required(),
    path: Joi.string().max(1024).required(),
    kind: Joi.string().valid("directory", "file").required(),
    size: Joi.number().integer().min(0).max(Number.MAX_SAFE_INTEGER).required(),
    modifiedAt: Joi.string().isoDate().required(),
    fileType: Joi.string().max(32),
    trashId: Joi.string().guid()
  }).unknown(false);

export const fileTaskCompletionSchema = Joi.object({
    nodeId: Joi.string().guid().required(),
    succeeded: Joi.boolean().required(),
    message: Joi.string().trim().min(1).max(240).required(),
    result: Joi.object({
      path: Joi.string().max(1024).allow(""),
      content: Joi.string().allow("").max(2 * 1024 * 1024),
      previewKind: Joi.string().valid("text", "image", "pdf"),
      mimeType: Joi.string().max(100),
      name: Joi.string().max(255),
      size: Joi.number().integer().min(0).max(Number.MAX_SAFE_INTEGER),
      transferId: Joi.string().guid(),
      sha256: Joi.string().hex().length(64).lowercase(),
      trashId: Joi.string().guid(),
      restored: Joi.boolean(),
      purged: Joi.boolean(),
      moved: Joi.boolean(),
      duplicate: Joi.boolean(),
      totalSize: Joi.number().integer().min(0).max(Number.MAX_SAFE_INTEGER),
      fileCount: Joi.number().integer().min(0).max(20_000),
      directoryCount: Joi.number().integer().min(0).max(20_000),
      skippedEntries: Joi.number().integer().min(0).max(20_000),
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
      stdout: Joi.string().allow("").max(1024 * 1024).required(),
      stderr: Joi.string().allow("").max(1024 * 1024).required(),
      exitCode: Joi.number().integer().allow(null).required(),
      timedOut: Joi.boolean().required(),
      outputTruncated: Joi.boolean().required(),
      cancelled: Joi.boolean().default(false),
      sandbox: Joi.object({
        mode: Joi.string().valid(...EXECUTION_SANDBOX_MODES).required(),
        enforcement: Joi.string().valid("full", "none").required(),
        denied: Joi.boolean().required(),
        providerId: Joi.string().trim().min(1).max(80).required(),
        hostVerified: Joi.boolean(),
        runnerFailed: Joi.boolean()
      }).unknown(false)
    }).unknown(false).required()
  }).unknown(false);
