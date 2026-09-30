/**
 * 功能：定义前端与 LFAA 控制端之间的 API 类型和请求函数。
 * 作用：统一处理同源请求、HttpOnly Cookie、JSON 响应和服务端错误，合并同时发生的相同只读查询。
 * 关联文件：packages/client/ui-renderer/src/App.tsx、packages/client/ui-settings-account/src/AuthView.tsx、packages/client/ui-settings-account/src/PasskeyManager.tsx、packages/client/ui-settings-account/src/PasskeySetupPrompt.tsx、packages/client/ui-minecraft/src/MinecraftWorkspace.tsx、packages/client/ui-sidebar-files/src/FileManagerPage.tsx、packages/client/ui-settings-account/src/AdminUsersPage.tsx、packages/client/ui-settings/src/SettingsPage.tsx、apps/desktop-electron/src/preload.cjs、apps/desktop-tauri/src-tauri/src/main.rs、packages/api/gateway/src/index.ts。
 */
import {
  startAuthentication,
  startRegistration,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON
} from "@simplewebauthn/browser";
import { isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export type ApplicationId = "steamcmd" | "minecraft" | "writing" | "workspace";
export type ApplicationMode = "normal" | "ai-work";
export type UserRole = "super_admin" | "admin" | "member";

export function hasAdminAccess(role: UserRole): boolean {
  return role === "super_admin" || role === "admin";
}

export function userRoleLabel(role: UserRole): string {
  if (role === "super_admin") return "超级管理员";
  return role === "admin" ? "管理员" : "普通账户";
}

export interface User {
  id: string;
  uid: number;
  username: string;
  email: string | null;
  role: UserRole;
  createdAt: string;
}

export interface UserSearchFilters {
  search?: string;
  uid?: number;
  username?: string;
  email?: string;
  role?: UserRole;
  createdFrom?: string;
  createdTo?: string;
}

export interface ManagedUserInput {
  username: string;
  email: string | null;
  role?: Exclude<UserRole, "super_admin">;
}

export interface PasskeyAvailability {
  enabled: boolean;
  available: boolean;
  origin: string | null;
}

export interface PasskeySummary {
  id: string;
  name: string;
  deviceType: "singleDevice" | "multiDevice";
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface UserPreferences {
  selectedApp: ApplicationId;
  selectedMode: ApplicationMode;
}

export type AppearanceTextFont = "system" | "sans" | "serif";
export type AppearanceCodeFont = "system" | "cascadia" | "consolas" | "jetbrains";

export interface AppearanceFonts {
  interface: AppearanceTextFont;
  content: AppearanceTextFont;
  code: AppearanceCodeFont;
}

export interface AppearanceModeStyle {
  accentColor: string;
  fonts: AppearanceFonts;
}

export interface AppearanceAdvancedSettings {
  interfaceFontSize: number;
  codeFontSize: number;
  reducedMotion: "system" | "on" | "off";
  separateModes: boolean;
  fonts: AppearanceFonts;
  modeStyles: { light: AppearanceModeStyle; dark: AppearanceModeStyle };
  translucentSidebar: boolean;
  contrast: number;
  diffMarkers: "color" | "symbols";
  pointerCursor: boolean;
}

export interface AppearanceSettings {
  theme: "light" | "dark" | "system";
  accentColor: string;
  sidebarColor: string;
  backgrounds: { login: string; appCenter: string; steamcmd: string; minecraft: string; writing: string; settings: string };
  overlay: number;
  blur: number;
  advanced: AppearanceAdvancedSettings;
}

export const DEFAULT_APPEARANCE_ADVANCED_SETTINGS: AppearanceAdvancedSettings = {
  interfaceFontSize: 14,
  codeFontSize: 12,
  reducedMotion: "system",
  separateModes: false,
  fonts: { interface: "system", content: "system", code: "system" },
  modeStyles: {
    light: { accentColor: "#3457d5", fonts: { interface: "system", content: "system", code: "system" } },
    dark: { accentColor: "#3457d5", fonts: { interface: "system", content: "system", code: "system" } }
  },
  translucentSidebar: false,
  contrast: 60,
  diffMarkers: "color",
  pointerCursor: false
};

export interface UserSettings {
  general: {
    defaultMode: ApplicationMode;
    showServiceStatus: boolean;
    showBottomPanelControl: boolean;
    taskFolder: string;
    fileOpenLocation: "system" | "ask";
    agentEnvironment: "system" | "windows-native" | "wsl" | "linux";
    integratedShell: "system" | "powershell" | "cmd" | "bash" | "zsh";
    language: "system" | "zh-CN" | "en-US";
    defaultFullView: boolean;
    navigationLayout: "left-two-column" | "three-column" | "right-tools" | "focus";
    terminalPosition: "bottom" | "right";
    plainTextEditor: boolean;
    sendShortcut: "enter" | "ctrl-enter";
    followupBehavior: "queue" | "steer";
    popupShortcut: string;
    defaultStandaloneChat: boolean;
    completionNotification: "always" | "unfocused" | "never";
    permissionNotifications: boolean;
    questionNotifications: boolean;
    sessionIssueNotifications: boolean;
    notificationSound: "default" | "subtle" | "off";
    setupReminderEnabled: boolean;
    confettiEnabled: boolean;
  };
  appearance: AppearanceSettings;
  shortcuts: { openSettings: string[]; openHome: string[]; openSteamcmd: string[]; openMinecraft: string[]; openWriting: string[]; toggleSidebar: string[]; toggleContextPanel: string[]; toggleBottomPanel: string[]; openTerminal: string[]; switchNormalMode: string[]; switchAiWorkMode: string[] };
  aiRuntime: { speed: "balanced" | "fast" | "deep"; promptSuggestions: boolean; showContextUsage: boolean; requestTimeoutSeconds: number; maxOutputTokens: number; maxModelRequests: number; maxToolCalls: number; subagentAccountId: string; maxSubagents: number; maxDelegationDepth: number; voiceInputEnabled: boolean; readResponsesAloud: boolean };
  permissions: { mode: "ask" | "approve_remembered" | "full_access" };
  plugins: { enabled: boolean; mcpServers: Array<{ id: string; name: string; url: string; enabled: boolean }> };
}

export interface AppearanceBackground {
  id: string;
  name: string;
  mimeType: string;
  url: string;
  createdAt: string;
}

export interface AiProvider {
  id: string;
  name: string;
  description: string;
  options: Array<{ id: string; label: string; choices: Array<{ value: string; label: string }> }>;
  discovery: "api" | "official-list";
}

export interface AiModel {
  id: string;
  name: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  thinking: AiModelThinkingControl | null;
}

export type AiModelThinkingControl =
  | { kind: "effort"; parameter: "reasoning_effort"; values: string[]; defaultValue?: string }
  | { kind: "toggle"; parameter: "thinking"; values: Array<"enabled" | "disabled">; defaultValue?: "enabled" | "disabled" }
  | { kind: "fixed"; value: string };

export interface AiProviderProbe {
  status: "connected" | "unverified";
  message: string;
  models: AiModel[];
}

export interface AiModelTestResult {
  status: "connected";
  modelId: string;
  elapsedMs: number;
  sample: string;
}

export interface AiAccount {
  id: string;
  providerId: string;
  displayName: string;
  modelId: string;
  models: AiModel[];
  reasoningMode: string;
  active: boolean;
  createdAt: string;
  hasSecret: true;
}

export interface AiExtension {
  id: string;
  pluginId: string;
  kind: "agent" | "llm-provider" | "skill" | "prompt" | "expert" | "tool";
  name: string;
  version: string;
  description: string;
  applicationIds?: ApplicationId[];
  toolPolicy?: { risk: "read" | "write" | "dangerous"; workspaceBound: boolean };
}

export interface AiRuntimeHookInfo {
  id: string;
  events: Array<"beforeInference" | "afterInference">;
}

export interface AiToolApproval {
  id: string;
  sessionId: string;
  appId: ApplicationId;
  toolId: string;
  toolVersion: string;
  risk: "read" | "write" | "dangerous";
  summary: string;
  scopeSummary: string;
  status: "pending" | "approved" | "denied" | "consumed" | "expired";
  requestedAt: string;
  expiresAt: string;
  decidedAt: string | null;
}

export interface AiToolPermissionGrant {
  id: string;
  appId: ApplicationId;
  toolId: string;
  toolVersion: string;
  risk: "write" | "dangerous";
  summary: string;
  scopeSummary: string;
  createdAt: string;
}

export interface AiRuntimePlugin {
  id: string;
  name: string;
  enabled: boolean;
  disabled: boolean;
  required: boolean;
  profileDisabled: boolean;
  canToggle: boolean;
  canReload: boolean;
  state: string;
}

export interface AiSession {
  id: string;
  appId: ApplicationId;
  title: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AiHostTask {
  id: string; nodeId: string; shell: string; workingDirectory: string; status: "queued" | "running" | "succeeded" | "failed"; message: string; createdAt: string;
  result?: { stdout: string; stderr: string; exitCode: number | null; timedOut: boolean; outputTruncated: boolean } | null;
}
export function loadAiHostTasks(): Promise<{ tasks: AiHostTask[] }> { return request("/ai/host-tasks"); }
export function loadAiHostTask(taskId: string): Promise<{ task: AiHostTask }> { return request(`/ai/host-tasks/${encodeURIComponent(taskId)}`); }

export interface WritingBook {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface WritingVolume {
  id: string;
  title: string;
  sortOrder: number;
}

export interface WritingChapterSummary {
  id: string;
  volumeId: string;
  title: string;
  sortOrder: number;
  updatedAt: string;
  wordCount: number;
}

export interface WritingChapter extends WritingChapterSummary {
  bookId: string;
  content: string;
  createdAt: string;
}

export interface WritingChapterRevision {
  id: string;
  title: string;
  createdAt: string;
  wordCount: number;
}

export interface WritingBookOutlineRevision {
  id: string;
  title: string;
  createdAt: string;
  wordCount: number;
}

export type WritingCatalogKind =
  | "world-rule" | "world-faction" | "world-geography" | "world-history" | "world-term" | "world-realm" | "world-item" | "world-reveal"
  | "character-protagonist" | "character-major" | "character-secondary" | "character-extra"
  | "plot-storyline" | "plot-point" | "plot-foreshadow" | "plot-card" | "material";

export interface WritingCatalogSummary {
  id: string;
  kind: WritingCatalogKind;
  title: string;
  updatedAt: string;
  wordCount: number;
}

export interface WritingCatalogEntry extends WritingCatalogSummary {
  bookId: string;
  content: string;
  createdAt: string;
}

export interface WritingWorkspace {
  books: WritingBook[];
  volumes: WritingVolume[];
  chapters: WritingChapterSummary[];
  activeBookId: string | null;
  activeBookOutline: string;
  activeChapterId: string | null;
  activeChapter: WritingChapter | null;
  catalogEntries: WritingCatalogSummary[];
}

export interface AiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "complete" | "queued" | "streaming" | "interrupted" | "error";
  createdAt: string;
  activity: AiActivityItem[];
}

export interface AiActivityItem {
  id: string;
  kind: "status" | "skill" | "tool" | "command" | "agent";
  title: string;
  status: "running" | "approval_required" | "complete" | "error" | "unavailable";
  detail: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  approvalId?: string;
}

export interface AiUsageSummary {
  requestCount: number;
  promptTokens: number | null;
  completionTokens: number | null;
  providers: Array<{ providerId: string; modelId: string; requestCount: number; promptTokens: number | null; completionTokens: number | null }>;
}

export interface ServerHealth {
  status: "ok" | "error";
  service: string;
  persistence: "ready" | "unavailable";
  timestamp: string;
}

export interface MinecraftNode {
  id: string;
  displayName: string;
  platform: string;
  architecture: string;
  version: string;
  status: "online" | "offline";
  capabilities: string[];
  javaRuntimes: Array<{ runtimeId: string; major: number; vendor: string; managed: boolean; source?: "managed" | "system" | "custom"; executablePath?: string }>;
  lastSeenAt: string;
}

export interface MinecraftRelease {
  id: string;
  type: "release";
  releaseTime: string;
}

export interface MinecraftCatalog {
  latestRelease: string;
  releases: MinecraftRelease[];
}

export interface MinecraftServerProperties {
  motd?: string;
  difficulty?: "peaceful" | "easy" | "normal" | "hard";
  gamemode?: "survival" | "creative" | "adventure" | "spectator";
  maxPlayers?: number;
  serverPort?: number;
  onlineMode?: boolean;
  pvp?: boolean;
  whiteList?: boolean;
  viewDistance?: number;
  simulationDistance?: number;
  levelName?: string;
  levelSeed?: string;
}

export interface MinecraftInstance {
  id: string;
  nodeId: string;
  nodeName: string;
  nodeStatus: "online" | "offline";
  name: string;
  storageDirectory: string;
  releaseId: string;
  javaMajor: number;
  javaRuntimeId: string | null;
  memoryMb: number;
  state: "installing" | "stopped" | "starting" | "running" | "stopping" | "error" | "unknown";
  sandboxAvailable: boolean;
  sandboxStatus: "unsupported" | "unprepared" | "prepared" | "running" | "unknown";
  eulaAcceptedAt: string;
  serverProperties: MinecraftServerProperties;
  createdAt: string;
  updatedAt: string;
}

export interface MinecraftDeployment {
  id: string;
  nodeId: string;
  nodeName: string;
  nodeStatus: "online" | "offline";
  name: string;
  storageDirectory: string;
  serverType: "vanilla";
  releaseId: string;
  javaMajor: number;
  state: "queued" | "downloading" | "ready" | "failed" | "registering" | "registered";
  instanceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MinecraftTask {
  id: string;
  nodeId: string;
  instanceId: string | null;
  deploymentId: string | null;
  createdBy: string;
  kind: "install" | "start" | "stop" | "properties" | "backup" | "java-install";
  status: "queued" | "running" | "succeeded" | "failed";
  progress: number;
  message: string;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface FileManagerNode {
  id: string;
  displayName: string;
  platform: string;
  architecture: string;
  version: string;
  status: "online" | "offline";
  capabilities: string[];
  lastSeenAt: string;
}

export interface SteamcmdSettingsNode extends FileManagerNode {
  dataRoot: string | null;
  configurationConfigured: boolean;
  storageConfigured: boolean;
  steamcmdInstalled: boolean;
  configuration: {
    nodeId: string;
    installMode: "online" | "manual";
    steamcmdDirectory: string;
  };
  storage: {
    nodeId: string;
    gameDirectory: string;
  };
}

export interface SteamcmdTask {
  id: string;
  nodeId: string;
  createdBy: string;
  kind: "install" | "verify";
  status: "queued" | "running" | "succeeded" | "failed";
  progress: number;
  message: string;
  result: Record<string, unknown> | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface MinecraftStorageNode extends FileManagerNode {
  dataRoot: string | null;
  settingsConfigured: boolean;
  instanceDirectory: string;
}

export interface MinecraftStorageSettings {
  instanceDirectory: string;
}

export interface DataDirectorySettings {
  currentDirectory: string;
  pendingDirectory: string | null;
  pendingError: string | null;
  editable: boolean;
  unavailableReason: string | null;
}

declare global {
  interface Window {
    lfaaDesktop?: {
      selectDataDirectory: () => Promise<string | null>;
    };
  }
}

export interface ManagedFileEntry {
  name: string;
  path: string;
  kind: "directory" | "file";
  size: number;
  modifiedAt: string;
}

export type FileManagerOperation = "list" | "search" | "read" | "write" | "create-file" | "create-folder" | "rename" | "delete" | "upload" | "download";

export interface FileManagerTask {
  id: string;
  nodeId: string;
  createdBy: string;
  operation: FileManagerOperation;
  status: "queued" | "running" | "succeeded" | "failed";
  progress: number;
  message: string;
  result: Record<string, unknown> | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface MinecraftLog {
  id: number;
  stream: string;
  line: string;
  createdAt: string;
}

export class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

export const sessionExpiredEventName = "lfaa:session-expired";

const pendingReads = new Map<string, Promise<unknown>>();

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  if (method !== "GET") {
    // 写入与身份切换前后清空共享登记，后续读取不能加入此前账户或旧状态的请求。
    pendingReads.clear();
    try { return await requestOnce<T>(path, options); }
    finally { pendingReads.clear(); }
  }
  // 只合并使用默认参数的查询；自定义 Header、取消信号等请求保持各自语义。
  if (Object.keys(options).length > 0) return requestOnce<T>(path, options);
  let pending = pendingReads.get(path);
  if (!pending) {
    pending = requestOnce<T>(path, options).finally(() => {
      if (pendingReads.get(path) === pending) pendingReads.delete(path);
    });
    pendingReads.set(path, pending);
  }
  // 仅共享传输，不长期缓存 API 数据，也不让某个组件修改其他调用者的响应对象。
  return structuredClone(await pending) as T;
}

async function requestOnce<T>(path: string, options: RequestInit): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
    credentials: "include"
  });
  const rawBody = await response.text();
  let responseBody: unknown = undefined;

  if (rawBody.length > 0) {
    try {
      responseBody = JSON.parse(rawBody) as unknown;
    } catch {
      throw new ApiError(response.status, "服务返回了无法识别的数据。");
    }
  }

  if (!response.ok) {
    const message = typeof responseBody === "object" && responseBody !== null && "message" in responseBody
      && typeof responseBody.message === "string"
      ? responseBody.message
      : "请求失败，请稍后重试。";
    const code = typeof responseBody === "object" && responseBody !== null && "error" in responseBody
      && typeof responseBody.error === "string"
      ? responseBody.error
      : undefined;
    const isSessionExpired = response.status === 401
      && (code === "authentication_required" || code === "invalid_session");

    // 只有明确的会话鉴权失败才通知全局登出，密码错误等其他 401 仍由当前表单处理。
    if (isSessionExpired && typeof window !== "undefined") {
      pendingReads.clear();
      window.dispatchEvent(new Event(sessionExpiredEventName));
    }

    throw new ApiError(response.status, message, code);
  }

  return responseBody as T;
}

export function loadHealth(): Promise<ServerHealth> {
  return request<ServerHealth>("/health");
}

export function loadFileManagerNodes(): Promise<{ nodes: FileManagerNode[] }> {
  return request("/files/nodes");
}

export function submitFileManagerTask(input: {
  nodeId: string;
  operation: FileManagerOperation;
  path: string;
  query?: string;
  name?: string;
  content?: string;
  dataBase64?: string;
}): Promise<{ task: FileManagerTask }> {
  return request("/files/tasks", { method: "POST", body: JSON.stringify(input) });
}

export function loadFileManagerTask(taskId: string): Promise<{ task: FileManagerTask }> {
  return request(`/files/tasks/${encodeURIComponent(taskId)}`);
}

export interface SteamcmdConfigurationValues {
  installMode: "online" | "manual";
  steamcmdDirectory: string;
}

export interface SteamcmdStorageValues {
  gameDirectory: string;
}

export function loadSteamcmdSettings(): Promise<{
  nodes: SteamcmdSettingsNode[];
  configurationDefaults: SteamcmdConfigurationValues;
  configurationDefaultsConfigured: boolean;
  storageDefaults: SteamcmdStorageValues;
  storageDefaultsConfigured: boolean;
}> {
  return request("/steamcmd/settings");
}

export function saveSteamcmdNodeConfiguration(nodeId: string, settings: SteamcmdConfigurationValues): Promise<{ settings: SteamcmdConfigurationValues & { nodeId: string } }> {
  return request(`/steamcmd/configuration-settings/${encodeURIComponent(nodeId)}`, { method: "PUT", body: JSON.stringify(settings) });
}

export function saveSteamcmdConfigurationDefaults(settings: SteamcmdConfigurationValues): Promise<{ settings: SteamcmdConfigurationValues }> {
  return request("/steamcmd/configuration-settings/defaults", { method: "PUT", body: JSON.stringify(settings) });
}

export function saveSteamcmdNodeStorageSettings(nodeId: string, settings: SteamcmdStorageValues): Promise<{ settings: SteamcmdStorageValues & { nodeId: string } }> {
  return request(`/steamcmd/storage-settings/${encodeURIComponent(nodeId)}`, { method: "PUT", body: JSON.stringify(settings) });
}

export function saveSteamcmdStorageDefaults(settings: SteamcmdStorageValues): Promise<{ settings: SteamcmdStorageValues }> {
  return request("/steamcmd/storage-settings/defaults", { method: "PUT", body: JSON.stringify(settings) });
}

export function loadMinecraftStorageSettings(): Promise<{ nodes: MinecraftStorageNode[]; defaults: MinecraftStorageSettings; defaultsConfigured: boolean }> {
  return request("/minecraft/storage-settings");
}

export function saveMinecraftStorageDefaults(settings: MinecraftStorageSettings): Promise<{ settings: MinecraftStorageSettings }> {
  return request("/minecraft/storage-settings/defaults", { method: "PUT", body: JSON.stringify(settings) });
}

export function saveMinecraftNodeStorageSettings(nodeId: string, settings: MinecraftStorageSettings): Promise<{ settings: MinecraftStorageSettings & { nodeId: string } }> {
  return request(`/minecraft/storage-settings/${encodeURIComponent(nodeId)}`, { method: "PUT", body: JSON.stringify(settings) });
}

export function loadDataDirectorySettings(): Promise<{ settings: DataDirectorySettings }> {
  return request("/data-directory");
}

export function saveDataDirectorySettings(directory: string): Promise<{ settings: DataDirectorySettings }> {
  return request("/data-directory", { method: "PUT", body: JSON.stringify({ directory }) });
}

export function cancelDataDirectorySettingsChange(): Promise<{ settings: DataDirectorySettings }> {
  return request("/data-directory", { method: "DELETE" });
}

export function isDesktopApp(): boolean {
  return typeof window !== "undefined" && (Boolean(window.lfaaDesktop) || isTauri());
}

export async function selectDesktopDataDirectory(): Promise<string | null> {
  if (window.lfaaDesktop) return window.lfaaDesktop.selectDataDirectory();
  if (!isTauri()) return null;
  const selectedDirectory = await open({ multiple: false, directory: true });
  return typeof selectedDirectory === "string" ? selectedDirectory : null;
}

export function createSteamcmdTask(input: { nodeId: string; kind: "install" | "verify" }): Promise<{ task: SteamcmdTask }> {
  return request("/steamcmd/tasks", { method: "POST", body: JSON.stringify(input) });
}

export function loadSteamcmdTask(taskId: string): Promise<{ task: SteamcmdTask }> {
  return request(`/steamcmd/tasks/${encodeURIComponent(taskId)}`);
}

export function loadMinecraftOverview(): Promise<{ overview: { latestRelease: string; node: MinecraftNode | null; instanceCount: number; runningCount: number; activeTaskCount: number } }> {
  return request("/minecraft/overview");
}

export function loadMinecraftNodes(): Promise<{ nodes: MinecraftNode[] }> {
  return request("/minecraft/nodes");
}

export function loadMinecraftReleases(): Promise<{ catalog: MinecraftCatalog }> {
  return request("/minecraft/releases");
}

export function loadMinecraftJava(): Promise<{ nodes: Array<{ nodeId: string; nodeName: string; nodeStatus: string; runtimes: MinecraftNode["javaRuntimes"] }> }> {
  return request("/minecraft/java");
}

export function loadMinecraftInstances(): Promise<{ instances: MinecraftInstance[] }> {
  return request("/minecraft/instances");
}

export function loadMinecraftDeployments(): Promise<{ deployments: MinecraftDeployment[] }> {
  return request("/minecraft/deployments");
}

export function loadMinecraftInstanceLogs(instanceId: string): Promise<{ logs: MinecraftLog[] }> {
  return request(`/minecraft/instances/${encodeURIComponent(instanceId)}/logs`);
}

export function loadMinecraftTasks(): Promise<{ tasks: MinecraftTask[] }> {
  return request("/minecraft/tasks");
}

export function createMinecraftDeployment(input: { nodeId: string; name: string; serverType: "vanilla"; releaseId: string }): Promise<{ deployment: MinecraftDeployment; task: MinecraftTask }> {
  return request("/minecraft/deployments", { method: "POST", body: JSON.stringify(input) });
}

export function retryMinecraftDeployment(deploymentId: string): Promise<{ task: MinecraftTask }> {
  return request(`/minecraft/deployments/${encodeURIComponent(deploymentId)}/retry`, { method: "POST" });
}

export function registerMinecraftDeployment(deploymentId: string, input: { memoryMb: number; eulaAccepted: true; javaRuntimeId: string | null }): Promise<{ instance: MinecraftInstance; task: MinecraftTask }> {
  return request(`/minecraft/deployments/${encodeURIComponent(deploymentId)}/instance`, { method: "POST", body: JSON.stringify(input) });
}

export function setMinecraftInstanceJavaRuntime(instanceId: string, javaRuntimeId: string | null): Promise<{ instance: MinecraftInstance }> {
  return request(`/minecraft/instances/${encodeURIComponent(instanceId)}/java-runtime`, { method: "PATCH", body: JSON.stringify({ javaRuntimeId }) });
}

export function installMinecraftJava(input: { nodeId: string; major: number }): Promise<{ task: MinecraftTask }> {
  return request("/minecraft/java/install", { method: "POST", body: JSON.stringify(input) });
}

export function uninstallMinecraftJava(input: { nodeId: string; major: number }): Promise<{ task: MinecraftTask }> {
  return request("/minecraft/java/uninstall", { method: "POST", body: JSON.stringify(input) });
}

export function saveMinecraftJavaPath(input: { nodeId: string; executablePath: string; runtimeId?: string }): Promise<{ task: MinecraftTask }> {
  return request("/minecraft/java/paths", { method: "POST", body: JSON.stringify(input) });
}

export function forgetMinecraftJavaPath(nodeId: string, runtimeId: string): Promise<{ task: MinecraftTask }> {
  return request(`/minecraft/java/paths/${encodeURIComponent(runtimeId)}`, { method: "DELETE", body: JSON.stringify({ nodeId }) });
}

export function runMinecraftInstanceAction(instanceId: string, action: "start" | "stop" | "backup"): Promise<{ task: MinecraftTask }> {
  return request(`/minecraft/instances/${encodeURIComponent(instanceId)}/${action}`, { method: "POST" });
}

export function saveMinecraftServerProperties(instanceId: string, properties: MinecraftServerProperties): Promise<{ task: MinecraftTask }> {
  return request(`/minecraft/instances/${encodeURIComponent(instanceId)}/properties`, { method: "PATCH", body: JSON.stringify({ properties }) });
}

export function loadSetupStatus(): Promise<{ requiresSetup: boolean }> {
  return request<{ requiresSetup: boolean }>("/auth/setup-status");
}

export function loadCurrentUser(): Promise<{ user: User }> {
  return request<{ user: User }>("/auth/me");
}

export function initializeAdmin(username: string, password: string): Promise<{ user: User }> {
  return request<{ user: User }>("/auth/setup", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
}

export function login(username: string, password: string): Promise<{ user: User }> {
  return request<{ user: User }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
}

export function loadPasskeyAvailability(): Promise<PasskeyAvailability> {
  return request("/auth/passkeys/availability");
}

export function loadUserPasskeys(): Promise<{ passkeys: PasskeySummary[] }> {
  return request("/auth/passkeys");
}

export async function loginWithPasskey(): Promise<{ user: User }> {
  const { flowId, options } = await request<{
    flowId: string;
    options: PublicKeyCredentialRequestOptionsJSON;
  }>("/auth/passkeys/authentication/options", { method: "POST", body: "{}" });
  const response: AuthenticationResponseJSON = await startAuthentication({ optionsJSON: options });
  return request("/auth/passkeys/authentication/verify", {
    method: "POST",
    body: JSON.stringify({ flowId, response })
  });
}

export async function registerPasskey(currentPassword: string, name: string): Promise<{ passkey: PasskeySummary }> {
  const { flowId, options } = await request<{
    flowId: string;
    options: PublicKeyCredentialCreationOptionsJSON;
  }>("/auth/passkeys/registration/options", {
    method: "POST",
    body: JSON.stringify({ currentPassword })
  });
  const response: RegistrationResponseJSON = await startRegistration({ optionsJSON: options });
  return request("/auth/passkeys/registration/verify", {
    method: "POST",
    body: JSON.stringify({ flowId, name, response })
  });
}

export function removePasskey(credentialId: string, currentPassword: string): Promise<void> {
  return request(`/auth/passkeys/${encodeURIComponent(credentialId)}`, {
    method: "DELETE",
    body: JSON.stringify({ currentPassword })
  });
}

export function recoverPassword(input: { username: string; recoveryKey: string; newPassword: string }): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/recovery", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function saveRecoveryKey(input: { currentPassword: string; recoveryKey: string }): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/recovery-key", {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

export function changeCurrentPassword(input: { currentPassword: string; newPassword: string }): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/password", {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

export function updateCurrentUserEmail(input: { currentPassword: string; email: string | null }): Promise<{ user: User }> {
  return request<{ user: User }>("/auth/email", {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

export function logout(): Promise<void> {
  return request<void>("/auth/logout", { method: "POST" });
}

export function loadPreferences(): Promise<{ preferences: UserPreferences }> {
  return request<{ preferences: UserPreferences }>("/preferences");
}

export function savePreferences(preferences: UserPreferences): Promise<{ preferences: UserPreferences }> {
  return request<{ preferences: UserPreferences }>("/preferences", {
    method: "PUT",
    body: JSON.stringify(preferences)
  });
}

export function loadSettings(): Promise<{ settings: UserSettings }> {
  return request<{ settings: UserSettings }>("/settings");
}

export function saveSettings<K extends keyof UserSettings>(category: K, value: UserSettings[K]): Promise<{ settings: UserSettings }> {
  const serverCategory = category === "aiRuntime" ? "ai-runtime" : category;
  return request<{ settings: UserSettings }>(`/settings/${serverCategory}`, {
    method: "PUT",
    body: JSON.stringify(value),
    keepalive: true
  });
}

export function loadAppearanceBackgrounds(): Promise<{ backgrounds: AppearanceBackground[] }> {
  return request<{ backgrounds: AppearanceBackground[] }>("/settings/backgrounds");
}

export async function uploadAppearanceBackground(file: File): Promise<{ background: AppearanceBackground }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("无法读取所选图片。"));
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("图片读取结果无效。"));
    reader.readAsDataURL(file);
  });
  return request<{ background: AppearanceBackground }>("/settings/backgrounds", {
    method: "POST",
    body: JSON.stringify({ name: file.name, dataUrl })
  });
}

export function deleteAppearanceBackground(id: string): Promise<void> {
  return request<void>(`/settings/backgrounds/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function loadAiProviders(): Promise<{ providers: AiProvider[] }> {
  return request<{ providers: AiProvider[] }>("/settings/ai/providers");
}

export function loadAiAccounts(): Promise<{ accounts: AiAccount[] }> {
  return request<{ accounts: AiAccount[] }>("/settings/ai/accounts");
}

export function loadAiExtensions(): Promise<{ plugins: AiRuntimePlugin[]; extensions: AiExtension[]; hooks: AiRuntimeHookInfo[]; hotReloadEnabled: boolean }> {
  return request<{ plugins: AiRuntimePlugin[]; extensions: AiExtension[]; hooks: AiRuntimeHookInfo[]; hotReloadEnabled: boolean }>("/ai/extensions");
}

export function manageAiRuntimePlugin(pluginId: string, action: "start" | "stop" | "reload"): Promise<{ plugins: AiRuntimePlugin[]; hotReloadEnabled: boolean }> {
  return request<{ plugins: AiRuntimePlugin[]; hotReloadEnabled: boolean }>(`/settings/runtime-plugins/${encodeURIComponent(pluginId)}/actions`, {
    method: "POST",
    body: JSON.stringify({ action })
  });
}

export function loadAiApprovals(): Promise<{ approvals: AiToolApproval[] }> {
  return request<{ approvals: AiToolApproval[] }>("/ai/approvals");
}

export function loadAiPermissionGrants(): Promise<{ grants: AiToolPermissionGrant[] }> {
  return request<{ grants: AiToolPermissionGrant[] }>("/ai/permissions/grants");
}

export function revokeAiPermissionGrant(grantId: string): Promise<void> {
  return request<void>(`/ai/permissions/grants/${encodeURIComponent(grantId)}`, { method: "DELETE" });
}

export function decideAiApproval(approvalId: string, decision: "approved" | "denied", remember = false): Promise<{ approval: AiToolApproval }> {
  return request<{ approval: AiToolApproval }>(`/ai/approvals/${encodeURIComponent(approvalId)}`, { method: "PATCH", body: JSON.stringify({ decision, remember }) });
}

export function loadAiSessions(options: { archived?: boolean; appId?: ApplicationId } = {}): Promise<{ sessions: AiSession[] }> {
  const query = new URLSearchParams();
  if (options.archived !== undefined) query.set("archived", String(options.archived));
  if (options.appId) query.set("appId", options.appId);
  return request<{ sessions: AiSession[] }>(`/ai/sessions${query.size ? `?${query}` : ""}`);
}

export function loadAiMessages(sessionId: string): Promise<{ messages: AiMessage[] }> {
  return request<{ messages: AiMessage[] }>(`/ai/sessions/${encodeURIComponent(sessionId)}/messages`);
}

export function archiveAiSession(sessionId: string, archived: boolean): Promise<{ session: AiSession }> {
  return request<{ session: AiSession }>(`/ai/sessions/${encodeURIComponent(sessionId)}/archive`, { method: "PATCH", body: JSON.stringify({ archived }) });
}

export function loadWritingWorkspace(): Promise<{ workspace: WritingWorkspace }> {
  return request<{ workspace: WritingWorkspace }>("/writing/workspace");
}

export function createWritingBook(title: string): Promise<{ workspace: WritingWorkspace }> {
  return request<{ workspace: WritingWorkspace }>("/writing/books", { method: "POST", body: JSON.stringify({ title }) });
}

export function createWritingVolume(bookId: string, title: string): Promise<{ workspace: WritingWorkspace }> {
  return request<{ workspace: WritingWorkspace }>(`/writing/books/${encodeURIComponent(bookId)}/volumes`, { method: "POST", body: JSON.stringify({ title }) });
}

export function renameWritingBook(bookId: string, title: string): Promise<{ book: WritingBook }> {
  return request<{ book: WritingBook }>(`/writing/books/${encodeURIComponent(bookId)}`, { method: "PATCH", body: JSON.stringify({ title }) });
}

export function saveWritingBookOutline(bookId: string, content: string): Promise<{ outline: { bookId: string; content: string; updatedAt: string; wordCount: number } }> {
  return request<{ outline: { bookId: string; content: string; updatedAt: string; wordCount: number } }>(`/writing/books/${encodeURIComponent(bookId)}/outline`, { method: "PATCH", body: JSON.stringify({ content }) });
}

export function loadWritingBookOutlineRevisions(bookId: string): Promise<{ revisions: WritingBookOutlineRevision[] }> {
  return request<{ revisions: WritingBookOutlineRevision[] }>(`/writing/books/${encodeURIComponent(bookId)}/outline/revisions`);
}

export function restoreWritingBookOutlineRevision(bookId: string, revisionId: string): Promise<{ outline: { bookId: string; content: string; updatedAt: string; wordCount: number } }> {
  return request<{ outline: { bookId: string; content: string; updatedAt: string; wordCount: number } }>(`/writing/books/${encodeURIComponent(bookId)}/outline/revisions/${encodeURIComponent(revisionId)}/restore`, { method: "POST", body: JSON.stringify({}) });
}

export function deleteWritingBook(bookId: string): Promise<void> {
  return request<void>(`/writing/books/${encodeURIComponent(bookId)}`, { method: "DELETE" });
}

export function createWritingChapter(bookId: string, title: string, volumeId?: string): Promise<{ workspace: WritingWorkspace }> {
  return request<{ workspace: WritingWorkspace }>(`/writing/books/${encodeURIComponent(bookId)}/chapters`, { method: "POST", body: JSON.stringify({ title, ...(volumeId ? { volumeId } : {}) }) });
}

export function saveWritingChapter(chapterId: string, title: string, content: string): Promise<{ chapter: WritingChapter }> {
  return request<{ chapter: WritingChapter }>(`/writing/chapters/${encodeURIComponent(chapterId)}`, { method: "PATCH", body: JSON.stringify({ title, content }) });
}

export function deleteWritingChapter(chapterId: string): Promise<{ workspace: WritingWorkspace }> {
  return request<{ workspace: WritingWorkspace }>(`/writing/chapters/${encodeURIComponent(chapterId)}`, { method: "DELETE" });
}

export function selectWritingLocation(bookId: string | null, chapterId: string | null): Promise<{ workspace: WritingWorkspace }> {
  return request<{ workspace: WritingWorkspace }>("/writing/workspace/selection", { method: "PATCH", body: JSON.stringify({ bookId, chapterId }) });
}

export function loadWritingChapterRevisions(chapterId: string): Promise<{ revisions: WritingChapterRevision[] }> {
  return request<{ revisions: WritingChapterRevision[] }>(`/writing/chapters/${encodeURIComponent(chapterId)}/revisions`);
}

export function restoreWritingChapterRevision(chapterId: string, revisionId: string): Promise<{ chapter: WritingChapter }> {
  return request<{ chapter: WritingChapter }>(`/writing/chapters/${encodeURIComponent(chapterId)}/revisions/${encodeURIComponent(revisionId)}/restore`, { method: "POST", body: JSON.stringify({}) });
}

export function createWritingCatalogEntry(bookId: string, kind: WritingCatalogKind, title: string): Promise<{ entry: WritingCatalogEntry }> {
  return request<{ entry: WritingCatalogEntry }>(`/writing/books/${encodeURIComponent(bookId)}/catalog`, { method: "POST", body: JSON.stringify({ kind, title }) });
}

export function loadWritingCatalogEntry(entryId: string): Promise<{ entry: WritingCatalogEntry }> {
  return request<{ entry: WritingCatalogEntry }>(`/writing/catalog/${encodeURIComponent(entryId)}`);
}

export function saveWritingCatalogEntry(entryId: string, title: string, content: string): Promise<{ entry: WritingCatalogEntry }> {
  return request<{ entry: WritingCatalogEntry }>(`/writing/catalog/${encodeURIComponent(entryId)}`, { method: "PATCH", body: JSON.stringify({ title, content }) });
}

export function deleteWritingCatalogEntry(entryId: string): Promise<void> {
  return request<void>(`/writing/catalog/${encodeURIComponent(entryId)}`, { method: "DELETE" });
}

export function loadAiUsage(): Promise<{ usage: AiUsageSummary }> {
  return request<{ usage: AiUsageSummary }>("/ai/usage");
}

/** 显式停止后台 Agent；断开流式连接只结束订阅。 */
export function cancelAiRun(runId: string): Promise<unknown> { return request(`/ai/runs/${encodeURIComponent(runId)}/cancel`, { method: "POST" }); }

export function appendAiRunInput(runId: string, content: string): Promise<{ mode: "queue" | "steer"; run: { id: string; message: AiMessage }; userMessage: AiMessage }> { return request(`/ai/runs/${encodeURIComponent(runId)}/input`, { method: "POST", body: JSON.stringify({ content }) }); }

export async function streamAiChat(input: {
  runId?: string;
  appId: ApplicationId;
  sessionId: string | null;
  content: string;
  signal: AbortSignal;
  onSession: (value: { session: AiSession; userMessage: AiMessage; assistantMessage: AiMessage }) => void;
  onInput?: (message: AiMessage) => void;
  onActivity: (value: { messageId: string; activity: AiActivityItem }) => void;
  onDelta: (value: { messageId: string; delta: string }) => void;
  onUsage: (value: { messageId: string; promptTokens: number | null; completionTokens: number | null; providerId: string; modelId: string }) => void;
  onError: (message: string) => void;
  onDone: (status: "complete" | "interrupted" | "error") => void;
}): Promise<void> {
  const response = await fetch(input.runId ? `/api/ai/runs/${encodeURIComponent(input.runId)}/events` : "/api/ai/chat/stream", {
    method: input.runId ? "GET" : "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    ...(!input.runId ? { body: JSON.stringify({ appId: input.appId, sessionId: input.sessionId, content: input.content }) } : {}),
    signal: input.signal
  });

  if (!response.ok) {
    let result: { message?: string; error?: string } = {};
    try { result = await response.json() as typeof result; } catch { /* 非 JSON 错误由通用 API 错误承载。 */ }
    if (response.status === 401 && (result.error === "authentication_required" || result.error === "invalid_session")) {
      window.dispatchEvent(new Event(sessionExpiredEventName));
    }
    throw new ApiError(response.status, result.message ?? "AI Work 请求失败，请重试。", result.error);
  }
  if (!response.body) throw new ApiError(response.status, "浏览器无法读取 AI Work 流式响应。");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "message";
  let dataLines: string[] = [];
  const dispatch = () => {
    if (dataLines.length === 0) { eventName = "message"; return; }
    let payload: Record<string, unknown>;
    try { payload = JSON.parse(dataLines.join("\n")) as Record<string, unknown>; }
    catch { eventName = "message"; dataLines = []; return; }
    if (eventName === "input" && payload.userMessage) input.onInput?.(payload.userMessage as AiMessage);
    if (eventName === "session") input.onSession(payload as unknown as Parameters<typeof input.onSession>[0]);
    if (eventName === "activity" && typeof payload.messageId === "string" && typeof payload.activity === "object" && payload.activity !== null) {
      input.onActivity({ messageId: payload.messageId, activity: payload.activity as AiActivityItem });
    }
    if (eventName === "delta" && typeof payload.messageId === "string" && typeof payload.delta === "string") input.onDelta({ messageId: payload.messageId, delta: payload.delta });
    if (eventName === "usage" && typeof payload.providerId === "string" && typeof payload.modelId === "string") input.onUsage({ messageId: typeof payload.messageId === "string" ? payload.messageId : "", promptTokens: typeof payload.promptTokens === "number" ? payload.promptTokens : null, completionTokens: typeof payload.completionTokens === "number" ? payload.completionTokens : null, providerId: payload.providerId, modelId: payload.modelId });
    if (eventName === "error" && typeof payload.message === "string") input.onError(payload.message);
    if (eventName === "done" && (payload.status === "complete" || payload.status === "interrupted" || payload.status === "error")) input.onDone(payload.status);
    eventName = "message";
    dataLines = [];
  };

  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/u, "");
        buffer = buffer.slice(newline + 1);
        if (line === "") dispatch();
        else if (line.startsWith("event:")) eventName = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
        newline = buffer.indexOf("\n");
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) {
      if (buffer.startsWith("data:")) dataLines.push(buffer.slice(5).trimStart());
      dispatch();
    }
  } finally {
    reader.releaseLock();
  }
}

export function probeAiProvider(input: { providerId: string; secret: string; options: Record<string, string> }): Promise<{ result: AiProviderProbe }> {
  return request<{ result: AiProviderProbe }>("/settings/ai/probe", { method: "POST", body: JSON.stringify(input) });
}

export function testAiProviderModel(input: { providerId: string; secret: string; options: Record<string, string>; modelId: string; reasoningMode: string }): Promise<{ result: AiModelTestResult }> {
  return request<{ result: AiModelTestResult }>("/settings/ai/test-model", { method: "POST", body: JSON.stringify(input) });
}

export function saveAiAccount(input: { providerId: string; secret: string; options: Record<string, string>; displayName: string; modelId: string; reasoningMode: string }): Promise<{ account: AiAccount }> {
  return request<{ account: AiAccount }>("/settings/ai/accounts", { method: "POST", body: JSON.stringify(input) });
}

export function reprobeAiAccount(accountId: string): Promise<{ result: AiProviderProbe }> {
  return request<{ result: AiProviderProbe }>(`/settings/ai/accounts/${encodeURIComponent(accountId)}/retest`, { method: "POST" });
}

export function updateAiAccountModel(accountId: string, modelId: string): Promise<{ account: AiAccount }> {
  return request<{ account: AiAccount }>(`/settings/ai/accounts/${encodeURIComponent(accountId)}/model`, { method: "PUT", body: JSON.stringify({ modelId }) });
}

export function updateAiAccountReasoningMode(accountId: string, reasoningMode: string): Promise<{ account: AiAccount }> {
  return request<{ account: AiAccount }>(`/settings/ai/accounts/${encodeURIComponent(accountId)}/reasoning`, { method: "PUT", body: JSON.stringify({ reasoningMode }) });
}

export function activateAiAccount(accountId: string): Promise<{ account: AiAccount }> {
  return request<{ account: AiAccount }>(`/settings/ai/accounts/${encodeURIComponent(accountId)}/activate`, { method: "POST" });
}

export function deleteAiAccount(accountId: string): Promise<void> {
  return request<void>(`/settings/ai/accounts/${encodeURIComponent(accountId)}`, { method: "DELETE" });
}

export function loadUsers(filters: UserSearchFilters = {}): Promise<{ users: User[] }> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const encodedFilters = query.toString();
  const suffix = encodedFilters ? `?${encodedFilters}` : "";
  return request<{ users: User[] }>(`/users${suffix}`);
}

export function createManagedUser(input: ManagedUserInput & { password: string }): Promise<{ user: User }> {
  return request<{ user: User }>("/users", { method: "POST", body: JSON.stringify(input) });
}

export function updateManagedUser(userId: string, input: ManagedUserInput): Promise<{ user: User }> {
  return request<{ user: User }>(`/users/${encodeURIComponent(userId)}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteManagedUser(userId: string): Promise<void> {
  return request<void>(`/users/${encodeURIComponent(userId)}`, { method: "DELETE" });
}

export function transferSuperAdmin(userId: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/users/${encodeURIComponent(userId)}/transfer-super-admin`, { method: "POST" });
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "发生了未知错误，请重试。";
}
