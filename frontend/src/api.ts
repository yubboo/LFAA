/**
 * 功能：定义前端与 LFAA 控制端之间的 API 类型和请求函数。
 * 作用：统一处理同源请求、HttpOnly Cookie、JSON 响应和服务端错误。
 * 关联文件：frontend/src/App.tsx、frontend/src/components/AdminUsersPage.tsx、frontend/src/components/SettingsPage.tsx。
 */
export type ApplicationId = "steamcmd" | "minecraft" | "writing";
export type ApplicationMode = "normal" | "ai-work";
export type UserRole = "admin" | "member";

export interface User {
  id: string;
  username: string;
  role: UserRole;
  createdAt: string;
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
    notificationSound: "default" | "subtle" | "off";
    confettiEnabled: boolean;
  };
  appearance: AppearanceSettings;
  shortcuts: { openSettings: string[]; openHome: string[]; openSteamcmd: string[]; openMinecraft: string[]; openWriting: string[]; toggleSidebar: string[]; toggleContextPanel: string[]; toggleBottomPanel: string[]; openTerminal: string[]; switchNormalMode: string[]; switchAiWorkMode: string[] };
  aiRuntime: { speed: "balanced" | "fast" | "deep"; promptSuggestions: boolean; showContextUsage: boolean; requestTimeoutSeconds: number; maxOutputTokens: number };
  permissions: { mode: "ask" | "approve_remembered" | "full_access" };
  plugins: { enabled: boolean };
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
}

export interface AiProviderProbe {
  status: "connected" | "unverified";
  message: string;
  models: AiModel[];
}

export interface AiAccount {
  id: string;
  providerId: string;
  displayName: string;
  modelId: string;
  models: AiModel[];
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
  enabled: boolean;
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

export interface AiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "complete" | "streaming" | "interrupted" | "error";
  createdAt: string;
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
  javaRuntimes: Array<{ runtimeId: string; major: number; vendor: string; managed: boolean }>;
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
  releaseId: string;
  javaMajor: number;
  memoryMb: number;
  state: "installing" | "stopped" | "starting" | "running" | "stopping" | "error" | "unknown";
  sandboxAvailable: boolean;
  sandboxStatus: "unsupported" | "unprepared" | "prepared" | "running" | "unknown";
  eulaAcceptedAt: string;
  serverProperties: MinecraftServerProperties;
  createdAt: string;
  updatedAt: string;
}

export interface MinecraftTask {
  id: string;
  nodeId: string;
  instanceId: string | null;
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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
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
      window.dispatchEvent(new Event(sessionExpiredEventName));
    }

    throw new ApiError(response.status, message, code);
  }

  return responseBody as T;
}

export function loadHealth(): Promise<ServerHealth> {
  return request<ServerHealth>("/health");
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

export function loadMinecraftInstanceLogs(instanceId: string): Promise<{ logs: MinecraftLog[] }> {
  return request(`/minecraft/instances/${encodeURIComponent(instanceId)}/logs`);
}

export function loadMinecraftTasks(): Promise<{ tasks: MinecraftTask[] }> {
  return request("/minecraft/tasks");
}

export function createMinecraftInstance(input: { nodeId: string; name: string; releaseId: string; memoryMb: number; eulaAccepted: true }): Promise<{ instance: MinecraftInstance; task: MinecraftTask }> {
  return request("/minecraft/instances", { method: "POST", body: JSON.stringify(input) });
}

export function installMinecraftJava(input: { nodeId: string; major: number }): Promise<{ task: MinecraftTask }> {
  return request("/minecraft/java/install", { method: "POST", body: JSON.stringify(input) });
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

export function initializeAdmin(username: string, password: string, recoveryKey: string): Promise<{ user: User }> {
  return request<{ user: User }>("/auth/setup", {
    method: "POST",
    body: JSON.stringify({ username, password, recoveryKey })
  });
}

export function login(username: string, password: string): Promise<{ user: User }> {
  return request<{ user: User }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
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

export function loadAiExtensions(): Promise<{ plugins: AiRuntimePlugin[]; extensions: AiExtension[]; hooks: AiRuntimeHookInfo[] }> {
  return request<{ plugins: AiRuntimePlugin[]; extensions: AiExtension[]; hooks: AiRuntimeHookInfo[] }>("/ai/extensions");
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

export function loadAiUsage(): Promise<{ usage: AiUsageSummary }> {
  return request<{ usage: AiUsageSummary }>("/ai/usage");
}

export async function streamAiChat(input: {
  appId: ApplicationId;
  sessionId: string | null;
  content: string;
  signal: AbortSignal;
  onSession: (value: { session: AiSession; userMessage: AiMessage; assistantMessage: AiMessage }) => void;
  onDelta: (value: { messageId: string; delta: string }) => void;
  onUsage: (value: { messageId: string; promptTokens: number | null; completionTokens: number | null; providerId: string; modelId: string }) => void;
  onError: (message: string) => void;
  onDone: (status: "complete" | "interrupted" | "error") => void;
}): Promise<void> {
  const response = await fetch("/api/ai/chat/stream", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ appId: input.appId, sessionId: input.sessionId, content: input.content }),
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
    if (eventName === "session") input.onSession(payload as unknown as Parameters<typeof input.onSession>[0]);
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

export function saveAiAccount(input: { providerId: string; secret: string; options: Record<string, string>; displayName: string; modelId: string }): Promise<{ account: AiAccount }> {
  return request<{ account: AiAccount }>("/settings/ai/accounts", { method: "POST", body: JSON.stringify(input) });
}

export function reprobeAiAccount(accountId: string): Promise<{ result: AiProviderProbe }> {
  return request<{ result: AiProviderProbe }>(`/settings/ai/accounts/${encodeURIComponent(accountId)}/retest`, { method: "POST" });
}

export function updateAiAccountModel(accountId: string, modelId: string): Promise<{ account: AiAccount }> {
  return request<{ account: AiAccount }>(`/settings/ai/accounts/${encodeURIComponent(accountId)}/model`, { method: "PUT", body: JSON.stringify({ modelId }) });
}

export function activateAiAccount(accountId: string): Promise<{ account: AiAccount }> {
  return request<{ account: AiAccount }>(`/settings/ai/accounts/${encodeURIComponent(accountId)}/activate`, { method: "POST" });
}

export function deleteAiAccount(accountId: string): Promise<void> {
  return request<void>(`/settings/ai/accounts/${encodeURIComponent(accountId)}`, { method: "DELETE" });
}

export function loadUsers(): Promise<{ users: User[] }> {
  return request<{ users: User[] }>("/users");
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "发生了未知错误，请重试。";
}
