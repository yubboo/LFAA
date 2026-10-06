/**
 * 文件：service.ts
 * 作用：保存用户设置并安全管理 AI Provider 账户与模型目录。
 * 负责：设置默认值、白名单 Provider 连接检测、模型发现、密钥加密和账户生命周期。
 * 不负责：前端页面、AI 推理、插件执行或主机节点操作。
 * 状态归属：用户设置与偏好存于账户文件；背景图片为文件素材，Provider 与 AI 密钥仍由 SQLite/凭据 Owner 管理。
 * 关联文件：packages/storage/storage-sqlite/src/database.ts、packages/api/gateway/src/index.ts、packages/client/connection/src/api.ts、packages/client/ui-settings/src/SettingsPage.tsx。
 * 修改注意事项：Provider 地址必须来自固定登记表；不得接受任意 URL 或将明文密钥写入数据库、日志和 API 响应。
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { database } from "lfaa-storage-sqlite/src/database.js";
import { configuration, ConfigurationConflict } from "lfaa-storage-domain/src/configuration.js";
import { config } from "lfaa-launch-environment/src/config.js";
import { resolveUserDataPaths } from "lfaa-home-paths/src/data-layout.mjs";
import { atomicWrite, atomicWriteBytes, decode } from "lfaa-storage-json/src/index.js";
import { withControlLock } from "lfaa-storage-domain/src/control-lock.js";
import { APPLICATION_IDS, type ApplicationId } from "lfaa-util-values/src/application-id.js";
import { credentialReference, normalizeCredentialRecord, type CredentialRecord, type CredentialRecordMetadata } from "lfaa-credentials/src/index.js";
import { defaultReasoningMode, isSelectableReasoningMode, normalizeAccountReasoningMode, normalizeProviderModelThinking, normalizeStoredModelThinking, PROVIDER_MODEL_CAPABILITY_SOURCE } from "./model-capabilities.js";
import type { AiModelCatalogEntry, AiModelThinkingControl } from "./model-capabilities.js";
export type { AiModelCatalogEntry, AiModelThinkingControl } from "./model-capabilities.js";

export type SettingsCategory = "general" | "appearance" | "shortcuts" | "ai-runtime" | "minecraft-runtime" | "git" | "permissions" | "plugins" | "personalization" | "computer-control";

export interface GeneralSettings {
  defaultMode: "normal" | "ai-work";
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
}

export interface AppearanceSettings {
  theme: "light" | "dark" | "system";
  accentColor: string;
  sidebarColor: string;
  backgrounds: {
    login: string;
    appCenter: string;
    steamcmd: string;
    minecraft: string;
    writing: string;
    settings: string;
  };
  wallpaperEngine: { enabled: boolean; projectId: string };
  overlay: number;
  blur: number;
  advanced: AppearanceAdvancedSettings;
}

export interface AppearanceFonts {
  interface: "system" | "sans" | "serif";
  content: "system" | "sans" | "serif";
  code: "system" | "cascadia" | "consolas" | "jetbrains";
}

export interface AppearanceAdvancedSettings {
  interfaceFontSize: number;
  codeFontSize: number;
  reducedMotion: "system" | "on" | "off";
  separateModes: boolean;
  fonts: AppearanceFonts;
  modeStyles: {
    light: { accentColor: string; fonts: AppearanceFonts };
    dark: { accentColor: string; fonts: AppearanceFonts };
  };
  translucentSidebar: boolean;
  contrast: number;
  diffMarkers: "color" | "symbols";
  pointerCursor: boolean;
  aiWorkOutputFocusBlurEnabled: boolean;
  aiWorkOutputFocusBlurPercent: number;
  aiWorkOutputFocusBlurIdleSeconds: number;
}

export interface AppearanceBackgroundView {
  id: string;
  name: string;
  mimeType: string;
  url: string;
  createdAt: string;
}

export interface ShortcutSettings {
  openSettings: string[];
  openHome: string[];
  openSteamcmd: string[];
  openMinecraft: string[];
  openWriting: string[];
  toggleSidebar: string[];
  toggleContextPanel: string[];
  toggleBottomPanel: string[];
  openTerminal: string[];
  switchNormalMode: string[];
  switchAiWorkMode: string[];
  openSideChat: string[];
  wallpaperSidebarToggle: string[];
}

export interface UserSettings {
  general: GeneralSettings;
  appearance: AppearanceSettings;
  shortcuts: ShortcutSettings;
  aiRuntime: AiRuntimeSettings;
  minecraftRuntime: MinecraftRuntimeSettings;
  git: GitSettings;
  permissions: PermissionSettings;
  plugins: PluginSettings;
  personalization: PersonalizationSettings;
  computerControl: ComputerControlSettings;
}

export interface ComputerControlSettings {
  enabled: boolean;
}

export interface PersonalizationSettings {
  memoryEnabled: boolean;
  memoryFromToolChats: boolean;
}

export interface AiRuntimeSettings {
  speed: "balanced" | "fast" | "deep";
  promptSuggestions: boolean;
  showContextUsage: boolean;
  requestTimeoutSeconds: number;
  maxOutputTokens: number;
  maxModelRequests: number;
  maxToolCalls: number;
  subagentAccountId: string;
  maxSubagents: number;
  maxDelegationDepth: number;
  voiceInputEnabled: boolean;
  readResponsesAloud: boolean;
  commandTimeoutSeconds: number;
}

export interface MinecraftRuntimeSettings {
  minecraftReadyTimeoutSeconds: number;
  minecraftStopTimeoutSeconds: number;
  minecraftDefaultMemoryMb: number;
  minecraftDefaultPort: number;
  minecraftDownloadTimeoutSeconds: number;
  minecraftInstallTimeoutSeconds: number;
  minecraftExecutionMode: "native" | "appcontainer";
  minecraftDefaultCore: string;
  minecraftBedrockDefaultPort: number;
}

export interface GitSettings {
  branchPrefix: string;
}

export interface PermissionSettings {
  mode: "ask" | "approve_remembered" | "full_access";
}

export interface UserCapabilityPrompt {
  id: string;
  name: string;
  description: string;
  applicationId: ApplicationId;
  sourceRepository: string;
  sourcePath: string;
  license: string | null;
  commit: string;
  archiveSha256: string;
  contentSha256: string;
  content: string;
  enabled: boolean;
  createdAt: string;
}

export interface PluginSettings {
  enabled: boolean;
  mcpServers: Array<{ id: string; name: string; url: string; enabled: boolean; applicationIds: ApplicationId[]; manifestSha256?: string }>;
  prompts?: UserCapabilityPrompt[];
}

export const defaultSettings: UserSettings = {
  general: {
    defaultMode: "normal",
    showServiceStatus: true,
    showBottomPanelControl: true,
    taskFolder: "",
    fileOpenLocation: "system",
    agentEnvironment: "system",
    integratedShell: "system",
    language: "system",
    defaultFullView: true,
    navigationLayout: "three-column",
    terminalPosition: "bottom",
    plainTextEditor: true,
    sendShortcut: "enter",
    followupBehavior: "queue",
    popupShortcut: "",
    defaultStandaloneChat: false,
    completionNotification: "unfocused",
    permissionNotifications: true,
    questionNotifications: true,
    sessionIssueNotifications: true,
    notificationSound: "default",
    setupReminderEnabled: true,
    confettiEnabled: false
  },
  appearance: { theme: "system", accentColor: "#3457d5", sidebarColor: "auto", backgrounds: { login: "forest-bridge-evening", appCenter: "cherry-blossom-shore", steamcmd: "ocean-cliff-sunset", minecraft: "cherry-blossom-village", writing: "snowy-cabin-interior", settings: "lakeside-pagoda-morning" }, wallpaperEngine: { enabled: false, projectId: "" }, overlay: 37, blur: 14, advanced: { interfaceFontSize: 14, codeFontSize: 12, reducedMotion: "system", separateModes: false, fonts: { interface: "system", content: "system", code: "system" }, modeStyles: { light: { accentColor: "#3457d5", fonts: { interface: "system", content: "system", code: "system" } }, dark: { accentColor: "#3457d5", fonts: { interface: "system", content: "system", code: "system" } } }, translucentSidebar: false, contrast: 60, diffMarkers: "color", pointerCursor: false, aiWorkOutputFocusBlurEnabled: true, aiWorkOutputFocusBlurPercent: 33, aiWorkOutputFocusBlurIdleSeconds: 60 } },
  shortcuts: { openSettings: ["Ctrl+,"], openHome: ["Alt+0"], openSteamcmd: ["Ctrl+Alt+1"], openMinecraft: ["Ctrl+Alt+2"], openWriting: ["Ctrl+Alt+3"], toggleSidebar: ["Ctrl+B"], toggleContextPanel: ["Ctrl+Alt+B"], toggleBottomPanel: ["Ctrl+J"], openTerminal: ["Ctrl+`"], switchNormalMode: ["Alt+1"], switchAiWorkMode: ["Alt+2"], openSideChat: ["Ctrl+Alt+S"], wallpaperSidebarToggle: [] },
  aiRuntime: { speed: "balanced", promptSuggestions: true, showContextUsage: false, requestTimeoutSeconds: 90, maxOutputTokens: 2048, maxModelRequests: 12, maxToolCalls: 24, subagentAccountId: "", maxSubagents: 4, maxDelegationDepth: 2, voiceInputEnabled: false, readResponsesAloud: false, commandTimeoutSeconds: 0 },
  minecraftRuntime: { minecraftReadyTimeoutSeconds: 120, minecraftStopTimeoutSeconds: 30, minecraftDefaultMemoryMb: 4096, minecraftDefaultPort: 25565, minecraftDownloadTimeoutSeconds: 1800, minecraftInstallTimeoutSeconds: 900, minecraftExecutionMode: "native", minecraftDefaultCore: "Paper", minecraftBedrockDefaultPort: 19132 },
  git: { branchPrefix: "codex/" },
  permissions: { mode: "ask" },
  plugins: { enabled: false, mcpServers: [], prompts: [] },
  personalization: { memoryEnabled: false, memoryFromToolChats: false },
  computerControl: { enabled: false }
};

const allowedAccentColors = new Set(["#3457d5", "#1687a7", "#27845b", "#8956bb", "#d05b37", "#d64d8f"]);

export function getUserSettings(userId: string): UserSettings {
  const rows = configuration.all("user_settings", row => (row.user_id === userId)) as Array<{ category: SettingsCategory; value_json: string }>;
  const result = structuredClone(defaultSettings);
  for (const row of rows) {
    try {
      const value = JSON.parse(row.value_json) as Record<string, unknown>;
      if (row.category === "general") result.general = readGeneralSettings(value) ?? result.general;
      if (row.category === "appearance") {
        const appearance = readAppearanceSettings(value);
        if (appearance) result.appearance = appearance;
      }
    if (row.category === "shortcuts") result.shortcuts = readShortcutSettings(value) ?? result.shortcuts;
    if (row.category === "ai-runtime") result.aiRuntime = readAiRuntimeSettings(value) ?? result.aiRuntime;
    if (row.category === "minecraft-runtime") result.minecraftRuntime = readMinecraftRuntimeSettings(value);
    if (row.category === "git") result.git = readGitSettings(value);
    if (row.category === "permissions") result.permissions = readPermissionSettings(value) ?? result.permissions;
    if (row.category === "plugins") result.plugins = readPluginSettings(value) ?? result.plugins;
    if (row.category === "personalization") result.personalization = readPersonalizationSettings(value);
    if (row.category === "computer-control") result.computerControl = readComputerControlSettings(value);
    } catch {
      // 损坏的单项设置回退到默认值，不影响其他设置分类读取。
    }
  }
  return result;
}

function readGitSettings(value: Record<string, unknown>): GitSettings {
  const prefix = typeof value.branchPrefix === "string" ? value.branchPrefix.trim() : "";
  const segments = prefix.slice(0, -1).split("/");
  const valid = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,63}\/$/u.test(prefix) && !prefix.includes("..") && !prefix.includes("@{")
    && !segments.some(segment => !segment || segment.startsWith(".") || segment.endsWith(".") || segment.toLocaleLowerCase("en-US").endsWith(".lock"));
  return { branchPrefix: valid ? prefix : defaultSettings.git.branchPrefix };
}

function readGeneralSettings(value: Record<string, unknown>): GeneralSettings | null {
  if ((value.defaultMode !== "normal" && value.defaultMode !== "ai-work") || typeof value.showServiceStatus !== "boolean") return null;
  const defaults = defaultSettings.general;
  const choose = <T extends string>(candidate: unknown, options: readonly T[], fallback: T): T =>
    typeof candidate === "string" && (options as readonly string[]).includes(candidate) ? candidate as T : fallback;
  return {
    ...defaults,
    defaultMode: value.defaultMode,
    showServiceStatus: value.showServiceStatus,
    showBottomPanelControl: typeof value.showBottomPanelControl === "boolean" ? value.showBottomPanelControl : defaults.showBottomPanelControl,
    taskFolder: typeof value.taskFolder === "string" && value.taskFolder.length <= 512 ? value.taskFolder : defaults.taskFolder,
    fileOpenLocation: choose(value.fileOpenLocation, ["system", "ask"], defaults.fileOpenLocation),
    agentEnvironment: choose(value.agentEnvironment, ["system", "windows-native", "wsl", "linux"], defaults.agentEnvironment),
    integratedShell: choose(value.integratedShell, ["system", "powershell", "cmd", "bash", "zsh"], defaults.integratedShell),
    language: choose(value.language, ["system", "zh-CN", "en-US"], defaults.language),
    defaultFullView: typeof value.defaultFullView === "boolean" ? value.defaultFullView : defaults.defaultFullView,
    navigationLayout: choose(value.navigationLayout, ["left-two-column", "three-column", "right-tools", "focus"], defaults.navigationLayout),
    terminalPosition: choose(value.terminalPosition, ["bottom", "right"], defaults.terminalPosition),
    plainTextEditor: typeof value.plainTextEditor === "boolean" ? value.plainTextEditor : defaults.plainTextEditor,
    sendShortcut: choose(value.sendShortcut, ["enter", "ctrl-enter"], defaults.sendShortcut),
    followupBehavior: choose(value.followupBehavior, ["queue", "steer"], defaults.followupBehavior),
    popupShortcut: typeof value.popupShortcut === "string" && value.popupShortcut.length <= 48 ? value.popupShortcut : defaults.popupShortcut,
    defaultStandaloneChat: typeof value.defaultStandaloneChat === "boolean" ? value.defaultStandaloneChat : defaults.defaultStandaloneChat,
    completionNotification: choose(value.completionNotification, ["always", "unfocused", "never"], defaults.completionNotification),
    permissionNotifications: typeof value.permissionNotifications === "boolean" ? value.permissionNotifications : defaults.permissionNotifications,
    questionNotifications: typeof value.questionNotifications === "boolean" ? value.questionNotifications : defaults.questionNotifications,
    sessionIssueNotifications: typeof value.sessionIssueNotifications === "boolean" ? value.sessionIssueNotifications : defaults.sessionIssueNotifications,
    notificationSound: choose(value.notificationSound, ["default", "subtle", "off"], defaults.notificationSound),
    setupReminderEnabled: typeof value.setupReminderEnabled === "boolean" ? value.setupReminderEnabled : defaults.setupReminderEnabled,
    confettiEnabled: typeof value.confettiEnabled === "boolean" ? value.confettiEnabled : defaults.confettiEnabled
  };
}

function readAiRuntimeSettings(value: Record<string, unknown>): AiRuntimeSettings | null {
  const choose = <T extends string>(candidate: unknown, options: readonly T[], fallback: T): T =>
    typeof candidate === "string" && (options as readonly string[]).includes(candidate) ? candidate as T : fallback;
  return {
    speed: choose(value.speed, ["fast", "balanced", "deep"], defaultSettings.aiRuntime.speed),
    promptSuggestions: typeof value.promptSuggestions === "boolean" ? value.promptSuggestions : defaultSettings.aiRuntime.promptSuggestions,
    showContextUsage: typeof value.showContextUsage === "boolean" ? value.showContextUsage : defaultSettings.aiRuntime.showContextUsage,
    requestTimeoutSeconds: typeof value.requestTimeoutSeconds === "number" && Number.isInteger(value.requestTimeoutSeconds) && value.requestTimeoutSeconds >= 10 && value.requestTimeoutSeconds <= 300 ? value.requestTimeoutSeconds : defaultSettings.aiRuntime.requestTimeoutSeconds,
    maxOutputTokens: typeof value.maxOutputTokens === "number" && Number.isInteger(value.maxOutputTokens) && value.maxOutputTokens >= 256 && value.maxOutputTokens <= 16384 ? value.maxOutputTokens : defaultSettings.aiRuntime.maxOutputTokens,
    // 旧账户只补齐执行预算，保留模型、权限与其他偏好。
    voiceInputEnabled: typeof value.voiceInputEnabled === "boolean" ? value.voiceInputEnabled : defaultSettings.aiRuntime.voiceInputEnabled,
    readResponsesAloud: typeof value.readResponsesAloud === "boolean" ? value.readResponsesAloud : defaultSettings.aiRuntime.readResponsesAloud,
    // AI 节点命令时限只影响 AI Work 发起的主机命令。
    commandTimeoutSeconds: typeof value.commandTimeoutSeconds === "number" && Number.isInteger(value.commandTimeoutSeconds) && value.commandTimeoutSeconds >= 0 && value.commandTimeoutSeconds <= 1800 ? value.commandTimeoutSeconds : defaultSettings.aiRuntime.commandTimeoutSeconds,
    maxModelRequests: typeof value.maxModelRequests === "number" && Number.isInteger(value.maxModelRequests) && value.maxModelRequests >= 1 && value.maxModelRequests <= 100 ? value.maxModelRequests : defaultSettings.aiRuntime.maxModelRequests,
    maxToolCalls: typeof value.maxToolCalls === "number" && Number.isInteger(value.maxToolCalls) && value.maxToolCalls >= 1 && value.maxToolCalls <= 200 ? value.maxToolCalls : defaultSettings.aiRuntime.maxToolCalls,
    subagentAccountId: typeof value.subagentAccountId === "string" && value.subagentAccountId.length <= 160 ? value.subagentAccountId : defaultSettings.aiRuntime.subagentAccountId,
    maxSubagents: typeof value.maxSubagents === "number" && Number.isInteger(value.maxSubagents) && value.maxSubagents >= 0 && value.maxSubagents <= 16 ? value.maxSubagents : defaultSettings.aiRuntime.maxSubagents,
    maxDelegationDepth: typeof value.maxDelegationDepth === "number" && Number.isInteger(value.maxDelegationDepth) && value.maxDelegationDepth >= 0 && value.maxDelegationDepth <= 4 ? value.maxDelegationDepth : defaultSettings.aiRuntime.maxDelegationDepth
  };
}

const MINECRAFT_RUNTIME_FIELDS = [
  "minecraftReadyTimeoutSeconds", "minecraftStopTimeoutSeconds", "minecraftDefaultMemoryMb", "minecraftDefaultPort",
  "minecraftDownloadTimeoutSeconds", "minecraftInstallTimeoutSeconds", "minecraftExecutionMode", "minecraftDefaultCore",
  "minecraftBedrockDefaultPort"
] as const;

function readMinecraftRuntimeSettings(value: Record<string, unknown>): MinecraftRuntimeSettings {
  const defaults = defaultSettings.minecraftRuntime;
  return {
    minecraftReadyTimeoutSeconds: typeof value.minecraftReadyTimeoutSeconds === "number" && Number.isInteger(value.minecraftReadyTimeoutSeconds) && value.minecraftReadyTimeoutSeconds >= 10 && value.minecraftReadyTimeoutSeconds <= 900 ? value.minecraftReadyTimeoutSeconds : defaults.minecraftReadyTimeoutSeconds,
    minecraftStopTimeoutSeconds: typeof value.minecraftStopTimeoutSeconds === "number" && Number.isInteger(value.minecraftStopTimeoutSeconds) && value.minecraftStopTimeoutSeconds >= 5 && value.minecraftStopTimeoutSeconds <= 300 ? value.minecraftStopTimeoutSeconds : defaults.minecraftStopTimeoutSeconds,
    minecraftDefaultMemoryMb: typeof value.minecraftDefaultMemoryMb === "number" && Number.isInteger(value.minecraftDefaultMemoryMb) && value.minecraftDefaultMemoryMb >= 1024 && value.minecraftDefaultMemoryMb <= 32768 ? value.minecraftDefaultMemoryMb : defaults.minecraftDefaultMemoryMb,
    minecraftDefaultPort: typeof value.minecraftDefaultPort === "number" && Number.isInteger(value.minecraftDefaultPort) && value.minecraftDefaultPort >= 1024 && value.minecraftDefaultPort <= 65535 ? value.minecraftDefaultPort : defaults.minecraftDefaultPort,
    minecraftDownloadTimeoutSeconds: typeof value.minecraftDownloadTimeoutSeconds === "number" && Number.isInteger(value.minecraftDownloadTimeoutSeconds) && value.minecraftDownloadTimeoutSeconds >= 30 && value.minecraftDownloadTimeoutSeconds <= 7200 ? value.minecraftDownloadTimeoutSeconds : defaults.minecraftDownloadTimeoutSeconds,
    minecraftInstallTimeoutSeconds: typeof value.minecraftInstallTimeoutSeconds === "number" && Number.isInteger(value.minecraftInstallTimeoutSeconds) && value.minecraftInstallTimeoutSeconds >= 30 && value.minecraftInstallTimeoutSeconds <= 7200 ? value.minecraftInstallTimeoutSeconds : defaults.minecraftInstallTimeoutSeconds,
    minecraftExecutionMode: value.minecraftExecutionMode === "appcontainer" ? "appcontainer" : defaults.minecraftExecutionMode,
    minecraftDefaultCore: typeof value.minecraftDefaultCore === "string" && value.minecraftDefaultCore.length > 0 && value.minecraftDefaultCore.length <= 32 ? value.minecraftDefaultCore : defaults.minecraftDefaultCore,
    minecraftBedrockDefaultPort: typeof value.minecraftBedrockDefaultPort === "number" && Number.isInteger(value.minecraftBedrockDefaultPort) && value.minecraftBedrockDefaultPort >= 1024 && value.minecraftBedrockDefaultPort <= 65535 ? value.minecraftBedrockDefaultPort : defaults.minecraftBedrockDefaultPort
  };
}

/** 将旧 ai-runtime 混存的 Minecraft 字段一次性搬入独立账户分类；存在新分类时以其为准。 */
function migrateLegacyMinecraftRuntimeSettings(): void {
  const rows = configuration.all("user_settings", row => row.category === "ai-runtime") as Array<{ user_id: string; category: string; value_json: string }>;
  const pending: Array<{ row: typeof rows[number]; aiValue: Record<string, unknown>; minecraftValue: Record<string, unknown> }> = [];
  for (const row of rows) {
    try {
      const value = JSON.parse(row.value_json) as Record<string, unknown>;
      const minecraftValue = Object.fromEntries(MINECRAFT_RUNTIME_FIELDS.filter(field => Object.hasOwn(value, field)).map(field => [field, value[field]]));
      if (!Object.keys(minecraftValue).length) continue;
      const aiValue = { ...value };
      for (const field of MINECRAFT_RUNTIME_FIELDS) delete aiValue[field];
      pending.push({ row, aiValue, minecraftValue });
    } catch {
      // 损坏的旧 JSON 不参与迁移，保留原记录供现有读取错误恢复处理。
    }
  }
  if (!pending.length) return;
  for (const { row, aiValue, minecraftValue } of pending) {
    configuration.transaction(() => {
      const existing = configuration.get("user_settings", item => item.user_id === row.user_id && item.category === "minecraft-runtime") as { value_json?: string } | undefined;
      let existingValue: Record<string, unknown> = {};
      try { if (existing?.value_json) existingValue = JSON.parse(existing.value_json) as Record<string, unknown>; } catch { /* 使用可恢复的旧值补齐损坏的新记录。 */ }
      configuration.save("user_settings", { user_id: row.user_id, category: "minecraft-runtime", value_json: JSON.stringify(readMinecraftRuntimeSettings({ ...minecraftValue, ...existingValue })) });
      configuration.save("user_settings", { user_id: row.user_id, category: "ai-runtime", value_json: JSON.stringify(aiValue) });
    });
  }
}

migrateLegacyMinecraftRuntimeSettings();

function readPermissionSettings(value: Record<string, unknown>): PermissionSettings | null {
  if (value.mode === "ask" || value.mode === "approve_remembered" || value.mode === "full_access") return { mode: value.mode };
  if (value.defaultPermission === "ask") return { mode: "ask" };
  // 旧版工作区授权不带可审计的目标范围，迁移为首次需审批的记忆模式，不能继续静默放行。
  if (value.defaultPermission === "workspace") return { mode: "approve_remembered" };
  return null;
}

function readPersonalizationSettings(value: Record<string, unknown>): PersonalizationSettings {
  return {
    memoryEnabled: typeof value.memoryEnabled === "boolean" ? value.memoryEnabled : defaultSettings.personalization.memoryEnabled,
    memoryFromToolChats: typeof value.memoryFromToolChats === "boolean" ? value.memoryFromToolChats : defaultSettings.personalization.memoryFromToolChats
  };
}

function readComputerControlSettings(value: Record<string, unknown>): ComputerControlSettings {
  return { enabled: typeof value.enabled === "boolean" ? value.enabled : defaultSettings.computerControl.enabled };
}

function readPluginSettings(value: Record<string, unknown>): PluginSettings | null {
  if (typeof value.enabled !== "boolean") return null;
  const validApplicationIds = new Set<ApplicationId>(APPLICATION_IDS);
  const mcpServers = Array.isArray(value.mcpServers) ? value.mcpServers.flatMap((item): PluginSettings["mcpServers"] => {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || !/^[a-z0-9][a-z0-9_-]{0,23}$/u.test(item.id) || typeof item.name !== "string" || !item.name.trim() || item.name.length > 80 || typeof item.enabled !== "boolean" || typeof item.url !== "string" || item.url.length > 1024) return [];
    if (item.manifestSha256 !== undefined && (typeof item.manifestSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(item.manifestSha256))) return [];
    try { const url = new URL(item.url); if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) return []; } catch { return []; }
    const applicationIds: ApplicationId[] = [];
    if (Array.isArray(item.applicationIds)) {
      for (const candidate of item.applicationIds as unknown[]) {
        if (typeof candidate !== "string" || !validApplicationIds.has(candidate as ApplicationId)) continue;
        const applicationId = candidate as ApplicationId;
        if (!applicationIds.includes(applicationId)) applicationIds.push(applicationId);
      }
    } else {
      applicationIds.push("workspace");
    }
    return [{ id: item.id, name: item.name, url: item.url, enabled: item.enabled, applicationIds, ...(typeof item.manifestSha256 === "string" ? { manifestSha256: item.manifestSha256 } : {}) }];
  }).slice(0, 16) : [];
  const prompts = Array.isArray(value.prompts) ? value.prompts.flatMap((item): UserCapabilityPrompt[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const prompt = item as Record<string, unknown>;
    if (typeof prompt.id !== "string" || !/^prompt-[a-f0-9]{20}$/u.test(prompt.id)
      || typeof prompt.name !== "string" || !prompt.name.trim() || prompt.name.length > 120
      || typeof prompt.description !== "string" || prompt.description.length > 500
      || typeof prompt.applicationId !== "string" || !validApplicationIds.has(prompt.applicationId as ApplicationId)
      || typeof prompt.sourceRepository !== "string" || !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(prompt.sourceRepository)
      || typeof prompt.sourcePath !== "string" || !prompt.sourcePath || prompt.sourcePath.length > 512
      || !(typeof prompt.license === "string" || prompt.license === null)
      || typeof prompt.commit !== "string" || !/^[a-f0-9]{40}$/iu.test(prompt.commit)
      || typeof prompt.archiveSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(prompt.archiveSha256)
      || typeof prompt.contentSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(prompt.contentSha256)
      || typeof prompt.content !== "string" || Buffer.byteLength(prompt.content, "utf8") > 24 * 1024
      || createHash("sha256").update(prompt.content).digest("hex") !== prompt.contentSha256
      || typeof prompt.enabled !== "boolean" || typeof prompt.createdAt !== "string" || !Number.isFinite(Date.parse(prompt.createdAt))) return [];
    return [{
      id: prompt.id, name: prompt.name.trim(), description: prompt.description, applicationId: prompt.applicationId as ApplicationId,
      sourceRepository: prompt.sourceRepository, sourcePath: prompt.sourcePath, license: prompt.license,
      commit: prompt.commit.toLocaleLowerCase("en-US"), archiveSha256: prompt.archiveSha256, contentSha256: prompt.contentSha256,
      content: prompt.content, enabled: prompt.enabled, createdAt: prompt.createdAt
    }];
  }).filter((prompt, index, all) => all.findIndex(candidate => candidate.id === prompt.id) === index).slice(0, 16) : [];
  return { enabled: value.enabled, mcpServers, prompts };
}

export function saveUserSettings(
  userId: string,
  category: SettingsCategory,
  value: GeneralSettings | AppearanceSettings | ShortcutSettings | AiRuntimeSettings | MinecraftRuntimeSettings | GitSettings | PermissionSettings | PluginSettings | PersonalizationSettings | ComputerControlSettings
): void {
  if (category === "appearance") {
    const normalized = readAppearanceSettings(value as unknown as Record<string, unknown>);
    if (!normalized) throw new Error("外观设置无效。");
    configuration.save("user_settings", { user_id: userId, category, value_json: JSON.stringify(normalized) });
    return;
  }
  if (category === "plugins") {
    const input = value as PluginSettings;
    const current = getUserSettings(userId).plugins;
    const normalized = readPluginSettings({ ...input, ...(Object.hasOwn(input, "prompts") ? {} : { prompts: current.prompts ?? [] }) });
    if (!normalized) throw new Error("AI 扩展设置无效。");
    configuration.save("user_settings", { user_id: userId, category, value_json: JSON.stringify(normalized) });
    return;
  }
  if (category === "personalization") {
    const normalized = readPersonalizationSettings(value as unknown as Record<string, unknown>);
    configuration.save("user_settings", { user_id: userId, category, value_json: JSON.stringify(normalized) });
    return;
  }
  if (category === "computer-control") {
    const normalized = readComputerControlSettings(value as unknown as Record<string, unknown>);
    configuration.save("user_settings", { user_id: userId, category, value_json: JSON.stringify(normalized) });
    return;
  }
  if (category !== "ai-runtime") {
    configuration.save("user_settings", { user_id: userId, category, value_json: JSON.stringify(value) });
    return;
  }
  const input = value as AiRuntimeSettings & Partial<MinecraftRuntimeSettings>;
  const aiValue = { ...input } as Record<string, unknown>;
  const minecraftValue = Object.fromEntries(MINECRAFT_RUNTIME_FIELDS.filter(field => Object.hasOwn(input, field)).map(field => [field, input[field]]));
  for (const field of MINECRAFT_RUNTIME_FIELDS) delete aiValue[field];
  configuration.transaction(() => {
    if (Object.keys(minecraftValue).length) {
      const existing = configuration.get("user_settings", row => row.user_id === userId && row.category === "minecraft-runtime") as { value_json?: string } | undefined;
      let existingValue: Record<string, unknown> = {};
      try { if (existing?.value_json) existingValue = JSON.parse(existing.value_json) as Record<string, unknown>; } catch { /* 旧分类随本次有效提交修复。 */ }
      configuration.save("user_settings", { user_id: userId, category: "minecraft-runtime", value_json: JSON.stringify(readMinecraftRuntimeSettings({ ...existingValue, ...minecraftValue })) });
    }
    configuration.save("user_settings", { user_id: userId, category, value_json: JSON.stringify(aiValue) });
  });
}

/** 使用设置 Owner 原子登记固定来源的提示词，不静默覆盖已有来源。 */
export function installUserCapabilityPrompt(userId: string, prompt: UserCapabilityPrompt): UserCapabilityPrompt {
  let installed: UserCapabilityPrompt | undefined;
  configuration.transaction(() => {
    const current = getUserSettings(userId).plugins;
    const prompts = current.prompts ?? [];
    if (prompts.length >= 16) throw new Error("当前账户最多保存 16 个已安装提示词；请先移除不再使用的条目。");
    if (prompts.some(item => item.id === prompt.id)) throw new Error("同一提示词来源已在此账户与 App 登记；不会覆盖现有版本，请先移除再重新检查。");
    const normalized = readPluginSettings({ ...current, prompts: [...prompts, prompt] });
    if (!normalized || normalized.prompts?.length !== prompts.length + 1) throw new Error("提示词未通过设置 Owner 的来源、范围或内容摘要校验。");
    installed = normalized.prompts.at(-1);
    configuration.save("user_settings", { user_id: userId, category: "plugins", value_json: JSON.stringify(normalized) });
  });
  if (!installed) throw new Error("设置 Owner 未确认提示词登记。");
  return installed;
}

/** 启停只匹配当前账户内同一 App 的提示词记录。 */
export function setUserCapabilityPromptEnabled(userId: string, id: string, applicationId: ApplicationId, enabled: boolean): UserCapabilityPrompt {
  return updateUserCapabilityPrompt(userId, id, applicationId, prompt => ({ ...prompt, enabled }));
}

/** 移除只作用于当前账户和 App 的一条提示词来源登记。 */
export function removeUserCapabilityPrompt(userId: string, id: string, applicationId: ApplicationId): UserCapabilityPrompt {
  return updateUserCapabilityPrompt(userId, id, applicationId, prompt => prompt, true);
}

function updateUserCapabilityPrompt(userId: string, id: string, applicationId: ApplicationId, update: (prompt: UserCapabilityPrompt) => UserCapabilityPrompt, remove = false): UserCapabilityPrompt {
  let result: UserCapabilityPrompt | undefined;
  configuration.transaction(() => {
    const current = getUserSettings(userId).plugins;
    const prompts = current.prompts ?? [];
    const matched = prompts.find(prompt => prompt.id === id && prompt.applicationId === applicationId);
    if (!matched) throw new Error("当前账户或 App 中找不到该提示词。");
    result = update(matched);
    const next = remove ? prompts.filter(prompt => prompt !== matched) : prompts.map(prompt => prompt === matched ? result! : prompt);
    const normalized = readPluginSettings({ ...current, prompts: next });
    if (!normalized) throw new Error("提示词设置更新未通过 Owner 校验。");
    configuration.save("user_settings", { user_id: userId, category: "plugins", value_json: JSON.stringify(normalized) });
  });
  if (!result) throw new Error("设置 Owner 未确认提示词状态。");
  return result;
}

function imageDimensions(data: Buffer, mimeType: string): { width: number; height: number } {
  // 根据文件头与编码尺寸复核图片内容，不能只信任浏览器声明的 MIME 类型或像素值。
  if (mimeType === "image/png") {
    if (data.length < 24 || data.toString("hex", 0, 8) !== "89504e470d0a1a0a") throw new Error("PNG 图片头无效。");
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  }
  if (mimeType === "image/jpeg") {
    if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) throw new Error("JPEG 图片头无效。");
    let offset = 2;
    while (offset + 4 < data.length) {
      if (data[offset] !== 0xff) { offset += 1; continue; }
      const marker = data[offset + 1];
      offset += 2;
      if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > data.length) break;
      const length = data.readUInt16BE(offset);
      if (length < 2 || offset + length > data.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        if (length < 7) break;
        return { width: data.readUInt16BE(offset + 5), height: data.readUInt16BE(offset + 3) };
      }
      offset += length;
    }
    throw new Error("无法读取 JPEG 图片尺寸。");
  }
  if (data.length < 30 || data.toString("ascii", 0, 4) !== "RIFF" || data.toString("ascii", 8, 12) !== "WEBP") throw new Error("WebP 图片头无效。");
  const chunk = data.toString("ascii", 12, 16);
  if (chunk === "VP8X") return { width: 1 + data.readUIntLE(24, 3), height: 1 + data.readUIntLE(27, 3) };
  if (chunk === "VP8 ") return { width: data.readUInt16LE(26) & 0x3fff, height: data.readUInt16LE(28) & 0x3fff };
  if (chunk === "VP8L" && data[20] === 0x2f) {
    const bits = data.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  throw new Error("无法读取 WebP 图片尺寸。");
}

export function listUserBackgrounds(userId: string): AppearanceBackgroundView[] {
  const rows = database.prepare("SELECT id, display_name, mime_type, image_data, created_at FROM appearance_backgrounds WHERE user_id = ? ORDER BY created_at DESC").all(userId) as Array<{ id: string; display_name: string; mime_type: string; image_data: Uint8Array; created_at: string }>;
  for (const row of rows) readOrMigrateBackground(userId, row);
  return rows.map((image) => ({ id: image.id, name: image.display_name, mimeType: image.mime_type, url: `/api/settings/backgrounds/${image.id}`, createdAt: image.created_at }));
}

const backgroundExtensions: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

function backgroundPath(userId: string, id: string, mimeType: string): string {
  const extension = backgroundExtensions[mimeType];
  if (!extension || !/^user-[0-9a-f-]{36}$/iu.test(id)) throw new Error("背景素材标识无效。");
  return resolve(resolveUserDataPaths(config.dataDirectory, userId).backgrounds, `${id}.${extension}`);
}

function backgroundMetadataPath(userId: string, id: string, mimeType: string): string {
  return backgroundPath(userId, id, mimeType).replace(/\.(?:png|jpg|webp)$/u, ".meta.json");
}

function readBackgroundFile(path: string): Buffer | null {
  if (!existsSync(path)) return null;
  const file = lstatSync(path);
  if (!file.isFile() || file.isSymbolicLink()) throw new Error("背景素材文件类型无效；拒绝跟随链接读取。");
  return readFileSync(path);
}

function readOrMigrateBackground(userId: string, row: { id: string; mime_type: string; image_data: Uint8Array }): Buffer {
  const path = backgroundPath(userId, row.id, row.mime_type);
  const metadataPath = backgroundMetadataPath(userId, row.id, row.mime_type);
  const stored = readBackgroundFile(path);
  const databaseImage = Buffer.from(row.image_data);
  if (databaseImage.length > 0) {
    if (stored && !stored.equals(databaseImage)) throw new Error("背景图片文件与旧 SQLite 素材内容冲突；两份来源均保留。");
    if (!stored) atomicWriteBytes(path, databaseImage);
    const verified = readBackgroundFile(path);
    if (!verified?.equals(databaseImage)) throw new Error("背景图片文件回读校验失败；SQLite 来源仍保留。");
    const sha256 = createHash("sha256").update(verified).digest("hex");
    atomicWrite(metadataPath, { version: 1, sha256 });
    const savedMetadata = readBackgroundMetadata(metadataPath);
    if (savedMetadata !== sha256) throw new Error("背景图片摘要文件回读校验失败；SQLite 来源仍保留。");
    withControlLock(database, () => {
      const result = database.prepare("UPDATE appearance_backgrounds SET image_data = ? WHERE user_id = ? AND id = ? AND length(image_data) > 0").run(Buffer.alloc(0), userId, row.id);
      if (Number(result.changes) === 0) {
        const current = database.prepare("SELECT length(image_data) AS size FROM appearance_backgrounds WHERE user_id = ? AND id = ?").get(userId, row.id) as { size?: number } | undefined;
        if (current?.size !== 0) throw new Error("背景图片迁移期间素材记录发生变化；请重试。");
      }
    });
    return verified;
  }
  if (!stored || stored.length === 0) throw new Error("背景图片素材文件缺失；SQLite 仅保留了文件索引，未返回默认图片。");
  const expectedHash = readBackgroundMetadata(metadataPath);
  if (!expectedHash || createHash("sha256").update(stored).digest("hex") !== expectedHash) throw new Error("背景图片素材摘要不匹配；未返回损坏文件。");
  imageDimensions(stored, row.mime_type);
  return stored;
}

function readBackgroundMetadata(path: string): string | null {
  const data = readBackgroundFile(path);
  if (!data) return null;
  const saved = decode(data.toString("utf8")) as Record<string, unknown> | null;
  return saved?.version === 1 && typeof saved.sha256 === "string" && /^[a-f0-9]{64}$/u.test(saved.sha256) ? saved.sha256 : null;
}

export function saveUserBackground(userId: string, dataUrl: string, displayName: string): AppearanceBackgroundView {
  if (dataUrl.length > 4_200_000) throw new Error("背景图片不能超过 3 MiB。");
  const match = /^data:(image\/png|image\/jpeg|image\/webp);base64,([A-Za-z0-9+/]+={0,2})$/u.exec(dataUrl);
  if (!match) throw new Error("背景图片仅支持 PNG、JPEG 或 WebP 格式。");
  const mimeType = match[1]!;
  const data = Buffer.from(match[2]!, "base64");
  if (data.length === 0 || data.length > 3 * 1024 * 1024) throw new Error("背景图片不能超过 3 MiB。");
  const { width, height } = imageDimensions(data, mimeType);
  if (width < 1 || height < 1 || width > 8192 || height > 8192 || width * height > 20_000_000) throw new Error("背景图片尺寸不能超过 8192 像素边长或 2000 万像素。");
  const id = `user-${randomUUID()}`;
  const name = displayName.trim().slice(0, 80) || "自定义背景";
  database.prepare("INSERT INTO appearance_backgrounds (user_id, id, display_name, mime_type, image_data) VALUES (?, ?, ?, ?, ?)").run(userId, id, name, mimeType, data);
  readOrMigrateBackground(userId, { id, mime_type: mimeType, image_data: data });
  const row = database.prepare("SELECT created_at FROM appearance_backgrounds WHERE user_id = ? AND id = ?").get(userId, id) as { created_at: string } | undefined;
  return { id, name, mimeType, url: `/api/settings/backgrounds/${id}`, createdAt: row?.created_at ?? new Date().toISOString() };
}

export function getUserBackground(userId: string, id: string): { mimeType: string; data: Buffer } | null {
  const row = database.prepare("SELECT id, mime_type, image_data FROM appearance_backgrounds WHERE user_id = ? AND id = ?").get(userId, id) as { id: string; mime_type: string; image_data: Uint8Array } | undefined;
  return row ? { mimeType: row.mime_type, data: readOrMigrateBackground(userId, row) } : null;
}

export function deleteUserBackground(userId: string, id: string): void {
  const row = database.prepare("SELECT mime_type FROM appearance_backgrounds WHERE user_id = ? AND id = ?").get(userId, id) as { mime_type: string } | undefined;
  const removed = database.prepare("DELETE FROM appearance_backgrounds WHERE user_id = ? AND id = ?").run(userId, id);
  if (Number(removed.changes) > 0 && row) {
    for (const path of [backgroundPath(userId, id, row.mime_type), backgroundMetadataPath(userId, id, row.mime_type)]) {
      if (!existsSync(path)) continue;
      const file = lstatSync(path);
      if (!file.isFile() || file.isSymbolicLink()) throw new Error("背景素材文件类型无效；拒绝删除链接目标。");
      unlinkSync(path);
    }
  }
}

function readAppearanceSettings(value: Record<string, unknown>): AppearanceSettings | null {
  if (!isAppearanceSettings(value)) return null;
  const appearance = value as unknown as AppearanceSettings;
  return {
    ...appearance,
    // 旧账户没有侧边栏颜色字段时继续跟随主题；自定义颜色仅接受标准六位十六进制值。
    sidebarColor: typeof appearance.sidebarColor === "string" ? appearance.sidebarColor.toLocaleLowerCase() : defaultSettings.appearance.sidebarColor,
    // 旧账户没有高级外观字段时使用默认值，保留原有主题、背景和遮罩设置。
    backgrounds: { ...defaultSettings.appearance.backgrounds, ...appearance.backgrounds },
    wallpaperEngine: readWallpaperEngineSettings(value.wallpaperEngine),
    advanced: (() => {
      const advanced = isAppearanceAdvancedSettings(value.advanced) ? value.advanced : structuredClone(defaultSettings.appearance.advanced);
      const normalizedAdvanced = { ...advanced };
      const legacyBlurAmount = (value.advanced as Record<string, unknown> | undefined)?.aiWorkOutputFocusBlurAmount;
      delete (normalizedAdvanced as Record<string, unknown>).aiWorkOutputFocusBlurAmount;
      const focusBlurPercent = Number.isInteger(advanced.aiWorkOutputFocusBlurPercent) && advanced.aiWorkOutputFocusBlurPercent >= 0 && advanced.aiWorkOutputFocusBlurPercent <= 100
        ? advanced.aiWorkOutputFocusBlurPercent
        : Number.isInteger(legacyBlurAmount) && Number(legacyBlurAmount) >= 0 && Number(legacyBlurAmount) <= 24
          ? Math.round(Number(legacyBlurAmount) / 24 * 100)
          : defaultSettings.appearance.advanced.aiWorkOutputFocusBlurPercent;
      const focusBlurIdleSeconds = Number.isInteger(advanced.aiWorkOutputFocusBlurIdleSeconds) && advanced.aiWorkOutputFocusBlurIdleSeconds >= 60 && advanced.aiWorkOutputFocusBlurIdleSeconds <= 3600 && advanced.aiWorkOutputFocusBlurIdleSeconds % 60 === 0
        ? advanced.aiWorkOutputFocusBlurIdleSeconds
        : defaultSettings.appearance.advanced.aiWorkOutputFocusBlurIdleSeconds;
      return {
        ...normalizedAdvanced,
        // 旧账户缺少回复虚化字段时只补开关、强度和延迟默认值；旧 px 值换算为百分比并保留其他外观偏好。
        aiWorkOutputFocusBlurEnabled: typeof advanced.aiWorkOutputFocusBlurEnabled === "boolean" ? advanced.aiWorkOutputFocusBlurEnabled : defaultSettings.appearance.advanced.aiWorkOutputFocusBlurEnabled,
        aiWorkOutputFocusBlurPercent: focusBlurPercent,
        aiWorkOutputFocusBlurIdleSeconds: focusBlurIdleSeconds
      };
    })()
  };
}

function readWallpaperEngineSettings(value: unknown): AppearanceSettings["wallpaperEngine"] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return structuredClone(defaultSettings.appearance.wallpaperEngine);
  const input = value as Record<string, unknown>;
  const projectId = typeof input.projectId === "string" && (input.projectId === "" || input.projectId.length <= 180 && /^[A-Za-z0-9_-]+$/u.test(input.projectId)) ? input.projectId : "";
  return { enabled: projectId !== "" && input.enabled === true, projectId };
}

function isValidSidebarColor(value: unknown): boolean {
  return value === undefined || value === "auto" || (typeof value === "string" && /^#[0-9a-f]{6}$/iu.test(value));
}

function isAppearanceSettings(value: Record<string, unknown>): boolean {
  const backgrounds = typeof value.backgrounds === "object" && value.backgrounds !== null && !Array.isArray(value.backgrounds)
    ? value.backgrounds as Record<string, unknown>
    : null;
  if (backgrounds === null) return false;
  const legacyTargets = ["appCenter", "steamcmd", "minecraft", "writing", "settings"];
  const targets = [...legacyTargets, "login"];
  const keys = Object.keys(backgrounds);
  const hasLegacyShape = keys.length === legacyTargets.length && legacyTargets.every((target) => target in backgrounds);
  const hasCurrentShape = keys.length === targets.length && targets.every((target) => target in backgrounds);
  if (!hasLegacyShape && !hasCurrentShape) return false;
  const backgroundIds = new Set(["none", "service-room", "steamcmd-world", "minecraft-world", "writing-desk", "cherry-blossom-shore", "cherry-blossom-village", "flower-meadow-castle", "forest-bridge-evening", "golden-wheat-field", "lakeside-pagoda-morning", "ocean-cliff-sunset", "rainy-grassland", "snowy-cabin-interior", "tropical-coast-day"]);
  return (value.theme === "light" || value.theme === "dark" || value.theme === "system")
    && typeof value.accentColor === "string" && allowedAccentColors.has(value.accentColor)
    && isValidSidebarColor(value.sidebarColor)
    && targets.every((target) => {
      const backgroundId = backgrounds[target] ?? (target === "login" && hasLegacyShape ? defaultSettings.appearance.backgrounds.login : undefined);
      return typeof backgroundId === "string" && (backgroundIds.has(backgroundId) || /^user-[0-9a-f-]{36}$/iu.test(backgroundId));
    })
    && Number.isInteger(value.overlay) && Number(value.overlay) >= 0 && Number(value.overlay) <= 75
    && Number.isInteger(value.blur) && Number(value.blur) >= 0 && Number(value.blur) <= 32;
}

function isAppearanceFonts(value: unknown): value is AppearanceFonts {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const fonts = value as Record<string, unknown>;
  return ["system", "sans", "serif"].includes(String(fonts.interface))
    && ["system", "sans", "serif"].includes(String(fonts.content))
    && ["system", "cascadia", "consolas", "jetbrains"].includes(String(fonts.code));
}

function isAppearanceAdvancedSettings(value: unknown): value is AppearanceAdvancedSettings {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const advanced = value as Record<string, unknown>;
  const modeStyles = typeof advanced.modeStyles === "object" && advanced.modeStyles !== null && !Array.isArray(advanced.modeStyles)
    ? advanced.modeStyles as Record<string, unknown>
    : null;
  if (!modeStyles) return false;
  const isModeStyle = (candidate: unknown): candidate is { accentColor: string; fonts: AppearanceFonts } =>
    typeof candidate === "object" && candidate !== null && !Array.isArray(candidate)
    && typeof (candidate as Record<string, unknown>).accentColor === "string"
    && allowedAccentColors.has((candidate as Record<string, unknown>).accentColor as string)
    && isAppearanceFonts((candidate as Record<string, unknown>).fonts);
  return Number.isInteger(advanced.interfaceFontSize) && Number(advanced.interfaceFontSize) >= 10 && Number(advanced.interfaceFontSize) <= 24
    && Number.isInteger(advanced.codeFontSize) && Number(advanced.codeFontSize) >= 8 && Number(advanced.codeFontSize) <= 24
    && ["system", "on", "off"].includes(String(advanced.reducedMotion))
    && typeof advanced.separateModes === "boolean"
    && isAppearanceFonts(advanced.fonts)
    && isModeStyle(modeStyles.light) && isModeStyle(modeStyles.dark)
    && typeof advanced.translucentSidebar === "boolean"
    && Number.isInteger(advanced.contrast) && Number(advanced.contrast) >= 0 && Number(advanced.contrast) <= 100
    && ["color", "symbols"].includes(String(advanced.diffMarkers))
    && typeof advanced.pointerCursor === "boolean"
    && (advanced.aiWorkOutputFocusBlurEnabled === undefined || typeof advanced.aiWorkOutputFocusBlurEnabled === "boolean")
    && (advanced.aiWorkOutputFocusBlurPercent === undefined || Number.isInteger(advanced.aiWorkOutputFocusBlurPercent) && Number(advanced.aiWorkOutputFocusBlurPercent) >= 0 && Number(advanced.aiWorkOutputFocusBlurPercent) <= 100)
    && (advanced.aiWorkOutputFocusBlurIdleSeconds === undefined || Number.isInteger(advanced.aiWorkOutputFocusBlurIdleSeconds) && Number(advanced.aiWorkOutputFocusBlurIdleSeconds) >= 60 && Number(advanced.aiWorkOutputFocusBlurIdleSeconds) <= 3600 && Number(advanced.aiWorkOutputFocusBlurIdleSeconds) % 60 === 0)
    && (advanced.aiWorkOutputFocusBlurAmount === undefined || Number.isInteger(advanced.aiWorkOutputFocusBlurAmount) && Number(advanced.aiWorkOutputFocusBlurAmount) >= 0 && Number(advanced.aiWorkOutputFocusBlurAmount) <= 24);
}

function isValidShortcut(value: unknown): value is string {
  return typeof value === "string" && value.length <= 32 && /^[\p{L}\p{N}\p{P} +`]*$/u.test(value);
}

function readShortcutSettings(value: Record<string, unknown>): ShortcutSettings | null {
  const requiredKeys: Array<keyof ShortcutSettings> = ["openSettings", "openHome", "openSteamcmd", "openMinecraft", "openWriting"];
  const allowedKeys = Object.keys(defaultSettings.shortcuts) as Array<keyof ShortcutSettings>;
  if (Object.keys(value).some((key) => !allowedKeys.includes(key as keyof ShortcutSettings)) || requiredKeys.some((key) => value[key] === undefined)) return null;
  const result = structuredClone(defaultSettings.shortcuts);
  for (const key of allowedKeys) {
    const saved = value[key];
    if (saved === undefined) continue;
    const bindings = typeof saved === "string" ? [saved] : saved;
    if (!Array.isArray(bindings) || bindings.length > 4 || !bindings.every(isValidShortcut)) return null;
    result[key] = [...bindings];
  }
  return result;
}

export interface AiProviderDefinition {
  id: string;
  name: string;
  description: string;
  options: Array<{ id: string; label: string; choices: Array<{ value: string; label: string }> }>;
  discovery: "api" | "official-list";
}

const providers: readonly AiProviderDefinition[] = [
  { id: "openai", name: "OpenAI", description: "OpenAI API 官方模型目录。", options: [], discovery: "api" },
  { id: "deepseek", name: "DeepSeek", description: "DeepSeek 官方 API。", options: [], discovery: "api" },
  { id: "qwen", name: "千问 / 百炼", description: "阿里云百炼区域 API。", options: [{ id: "region", label: "区域", choices: [{ value: "cn-beijing", label: "中国（北京）" }, { value: "ap-southeast-1", label: "新加坡" }, { value: "cn-hongkong", label: "中国（香港）" }, { value: "eu-central-1", label: "德国（法兰克福）" }, { value: "ap-northeast-1", label: "日本（东京）" }, { value: "us-east-1", label: "美国（弗吉尼亚）" }] }, { id: "workspaceId", label: "Workspace ID", choices: [] }], discovery: "api" },
  { id: "kimi", name: "Kimi", description: "Moonshot / Kimi 开放平台。", options: [{ id: "region", label: "区域", choices: [{ value: "china", label: "中国" }, { value: "international", label: "国际" }] }], discovery: "api" },
  { id: "zhipu", name: "智谱 GLM", description: "智谱 BigModel API 模型目录。", options: [{ id: "endpoint", label: "接口类型", choices: [{ value: "standard", label: "标准 API" }, { value: "coding", label: "Coding API" }] }], discovery: "api" },
  { id: "xiaomi", name: "Xiaomi MiMo", description: "小米 MiMo 按量 API 或 Token Plan。", options: [{ id: "authMethod", label: "认证方式", choices: [{ value: "api-key", label: "按量 API Key" }, { value: "token-plan", label: "Token Plan" }] }, { id: "region", label: "Token Plan 区域", choices: [{ value: "cn", label: "中国" }, { value: "sgp", label: "新加坡" }, { value: "ams", label: "欧洲" }] }], discovery: "api" }
];

export function listAiProviders(): readonly AiProviderDefinition[] {
  return providers;
}

export interface AiProviderInput {
  providerId: string;
  secret: string;
  options: Record<string, string>;
}

export interface AiProviderProbe {
  status: "connected" | "unverified";
  message: string;
  models: AiModelCatalogEntry[];
}

interface ProviderConnection {
  url: string;
  chatUrl: string;
  keyHeader: string;
  keyPrefix?: string;
  maxTokensField: "max_tokens" | "max_completion_tokens";
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

function normalizeProviderModels(list: unknown[]): AiModelCatalogEntry[] {
  return list.flatMap((item) => {
    const raw = typeof item === "object" && item !== null ? item as Record<string, unknown> : {};
    const id = typeof item === "string" ? item : typeof raw.id === "string" ? raw.id : "";
    if (!id || id.length > 160) return [];
    const name = typeof raw.name === "string" ? raw.name : id;
    const contextWindow = positiveInteger(raw.context_window);
    const maxOutputTokens = positiveInteger(raw.max_output_tokens);
    const thinking = normalizeProviderModelThinking(raw);
    return [{
      id,
      name,
      ...(contextWindow ? { contextWindow } : {}),
      ...(maxOutputTokens ? { maxOutputTokens } : {}),
      thinking,
      thinkingSource: thinking ? PROVIDER_MODEL_CAPABILITY_SOURCE : null
    }];
  }).slice(0, 500);
}

function normalizeSavedModels(providerId: string, value: unknown): AiModelCatalogEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const raw = item as Record<string, unknown>;
    const id = typeof raw.id === "string" ? raw.id : "";
    if (!id || id.length > 160) return [];
    const name = typeof raw.name === "string" ? raw.name : id;
    const contextWindow = positiveInteger(raw.contextWindow) ?? positiveInteger(raw.context_window);
    const maxOutputTokens = positiveInteger(raw.maxOutputTokens) ?? positiveInteger(raw.max_output_tokens);
    const savedThinking = typeof raw.thinking === "object" && raw.thinking !== null ? raw.thinking as Record<string, unknown> : null;
    const capability = normalizeStoredModelThinking(savedThinking, raw.thinkingSource, providerId === "deepseek");
    return [{
      id,
      name,
      ...(contextWindow ? { contextWindow } : {}),
      ...(maxOutputTokens ? { maxOutputTokens } : {}),
      thinking: capability.thinking,
      thinkingSource: capability.thinkingSource
    }];
  }).slice(0, 500);
}

function resolveProvider(providerId: string, options: Record<string, string>): ProviderConnection {
  switch (providerId) {
    case "openai": return { url: "https://api.openai.com/v1/models", chatUrl: "https://api.openai.com/v1/chat/completions", keyHeader: "Authorization", keyPrefix: "Bearer ", maxTokensField: "max_completion_tokens" };
    case "deepseek": return { url: "https://api.deepseek.com/models", chatUrl: "https://api.deepseek.com/chat/completions", keyHeader: "Authorization", keyPrefix: "Bearer ", maxTokensField: "max_tokens" };
    case "kimi": {
      const base = options.region === "international" ? "https://api.moonshot.ai/v1" : "https://api.moonshot.cn/v1";
      if (options.region && options.region !== "china" && options.region !== "international") throw new Error("Kimi 区域无效。");
      return { url: `${base}/models`, chatUrl: `${base}/chat/completions`, keyHeader: "Authorization", keyPrefix: "Bearer ", maxTokensField: "max_completion_tokens" };
    }
    case "qwen": {
      const region = options.region || "ap-southeast-1";
      const workspace = options.workspaceId?.trim() ?? "";
      const regionNames: Record<string, string> = {
        "cn-beijing": "cn-beijing",
        "ap-southeast-1": "ap-southeast-1",
        "cn-hongkong": "cn-hongkong",
        "eu-central-1": "eu-central-1",
        "ap-northeast-1": "ap-northeast-1",
        "us-east-1": "us-east-1"
      };
      const regionName = regionNames[region];
      if (!regionName) throw new Error("百炼区域无效。");
      if (workspace && !/^[A-Za-z0-9-]{2,64}$/u.test(workspace)) throw new Error("百炼 Workspace ID 格式无效。");
      const sharedHosts: Record<string, string> = {
        "cn-beijing": "dashscope.aliyuncs.com",
        "ap-southeast-1": "dashscope-intl.aliyuncs.com",
        "cn-hongkong": "cn-hongkong.dashscope.aliyuncs.com",
        "us-east-1": "dashscope-us.aliyuncs.com"
      };
      if (!workspace && !sharedHosts[region]) throw new Error("此百炼区域需要填写有效的 Workspace ID。");
      const resolvedHost = workspace ? `${workspace}.${regionName}.maas.aliyuncs.com` : sharedHosts[region]!;
      const chatBase = `https://${resolvedHost}/compatible-mode/v1`;
      return { url: `https://${resolvedHost}/api/v1/models`, chatUrl: `${chatBase}/chat/completions`, keyHeader: "Authorization", keyPrefix: "Bearer ", maxTokensField: "max_tokens" };
    }
    case "zhipu": {
      const endpoint = options.endpoint || "standard";
      if (endpoint !== "standard" && endpoint !== "coding") throw new Error("智谱接口类型无效。");
      return { url: endpoint === "coding" ? "https://open.bigmodel.cn/api/coding/paas/v4/models" : "https://open.bigmodel.cn/api/paas/v4/models", chatUrl: endpoint === "coding" ? "https://open.bigmodel.cn/api/coding/paas/v4/chat/completions" : "https://open.bigmodel.cn/api/paas/v4/chat/completions", keyHeader: "Authorization", keyPrefix: "Bearer ", maxTokensField: "max_tokens" };
    }
    case "xiaomi": {
      const authMethod = options.authMethod || "api-key";
      if (authMethod !== "api-key" && authMethod !== "token-plan") throw new Error("小米 MiMo 认证方式无效。");
      const region = options.region || "cn";
      const planHosts: Record<string, string> = { cn: "token-plan-cn.xiaomimimo.com", sgp: "token-plan-sgp.xiaomimimo.com", ams: "token-plan-ams.xiaomimimo.com" };
      if (authMethod === "token-plan" && !planHosts[region]) throw new Error("小米 Token Plan 区域无效。");
      const base = authMethod === "token-plan" ? `https://${planHosts[region]}/v1` : "https://api.xiaomimimo.com/v1";
      return { url: `${base}/models`, chatUrl: `${base}/chat/completions`, keyHeader: authMethod === "token-plan" ? "Authorization" : "api-key", maxTokensField: "max_completion_tokens", ...(authMethod === "token-plan" ? { keyPrefix: "Bearer " } : {}) };
    }
    default: throw new Error("AI Provider 不在允许列表中。");
  }
}

export async function probeAiProvider(input: AiProviderInput): Promise<AiProviderProbe> {
  if (!providers.some((provider) => provider.id === input.providerId)) throw new Error("AI Provider 不在允许列表中。");
  if (!input.secret.trim() || input.secret.length > 4096) throw new Error("请输入有效的 API Key。");

  const connection = resolveProvider(input.providerId, input.options);
  let response: Response;
  try {
    response = await fetch(connection.url, {
      method: "GET",
      headers: { [connection.keyHeader]: `${connection.keyPrefix ?? ""}${input.secret.trim()}`, Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
      redirect: "error"
    });
  } catch {
    throw new Error("连接 Provider 失败，请检查网络、区域与服务地址后重试。");
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error("Provider 拒绝了 API Key，请检查密钥与认证方式。");
    throw new Error(`Provider 返回 HTTP ${response.status}，暂时无法读取模型目录。`);
  }
  const raw = await response.text();
  if (raw.length > 1_000_000) throw new Error("Provider 模型目录响应超过允许大小。");
  let payload: unknown;
  try { payload = JSON.parse(raw) as unknown; } catch { throw new Error("Provider 返回的数据不是有效 JSON。"); }
  const record = typeof payload === "object" && payload !== null ? payload as Record<string, unknown> : {};
  const list = Array.isArray(record.data) ? record.data : Array.isArray(record.models) ? record.models : Array.isArray(record.model_list) ? record.model_list : [];
  const models = normalizeProviderModels(list);
  if (!models.length) throw new Error("连接已成功，但 Provider 没有返回可用模型目录。");
  return { status: "connected", message: `连接成功，发现 ${models.length} 个模型。`, models };
}

export interface AiModelTestResult {
  status: "connected";
  modelId: string;
  elapsedMs: number;
  sample: string;
}

function applyThinkingParameter(body: Record<string, unknown>, control: AiModelThinkingControl | null, mode: string): void {
  if (mode === "default") return;
  const selectedMode = mode;
  if (!isSelectableReasoningMode(control, selectedMode)) throw new Error("所选思考力度不属于当前模型目录返回的支持范围。");
  if (control?.kind === "effort") {
    body[control.parameter] = selectedMode;
    return;
  }
  if (control?.kind === "toggle") {
    body[control.parameter] = { type: selectedMode };
    return;
  }
  throw new Error("当前模型的思考力度由 Provider 固定，不能手动修改。");
}

async function requestAiProviderModel(input: AiProviderInput & { modelId: string; reasoningMode: string }, model: AiModelCatalogEntry): Promise<AiModelTestResult> {
  const connection = resolveProvider(input.providerId, input.options);
  const requestedTestTokens = model.maxOutputTokens ? Math.min(1024, model.maxOutputTokens) : 1024;
  const requestBody: Record<string, unknown> = {
    model: input.modelId,
    messages: [{ role: "user", content: "请只回复：连接成功。" }],
    stream: false,
    [connection.maxTokensField]: requestedTestTokens
  };
  applyThinkingParameter(requestBody, model.thinking, input.reasoningMode);

  const startedAt = Date.now();
  let response: Response;
  try {
    response = await fetch(connection.chatUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        [connection.keyHeader]: `${connection.keyPrefix ?? ""}${input.secret.trim()}`
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(20000),
      redirect: "error"
    });
  } catch {
    throw new Error("模型测试请求未能连接 Provider，请检查网络、区域和账户配置后重试。");
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    if (response.status === 401 || response.status === 403) throw new Error("Provider 拒绝了 API Key，请检查密钥与认证方式。");
    throw new Error(`模型测试返回 HTTP ${response.status}；请检查所选模型和官方请求参数。`);
  }

  const raw = await response.text();
  if (raw.length > 1_000_000) throw new Error("模型测试响应超过允许大小。");
  let payload: unknown;
  try { payload = JSON.parse(raw) as unknown; } catch { throw new Error("模型测试返回的数据不是有效 JSON。"); }
  const record = typeof payload === "object" && payload !== null ? payload as Record<string, unknown> : {};
  const choices = Array.isArray(record.choices) ? record.choices : [];
  const firstChoice = typeof choices[0] === "object" && choices[0] !== null ? choices[0] as Record<string, unknown> : {};
  const responseMessage = typeof firstChoice.message === "object" && firstChoice.message !== null ? firstChoice.message as Record<string, unknown> : {};
  const content = responseMessage.content;
  const sample = typeof content === "string"
    ? content.trim()
    : Array.isArray(content)
      ? content.flatMap((part) => typeof part === "object" && part !== null && typeof (part as Record<string, unknown>).text === "string" ? [(part as Record<string, unknown>).text as string] : []).join(" ").trim()
      : "";
  if (!sample) throw new Error("Provider 接受了请求，但没有返回可读取的回答内容。");
  return { status: "connected", modelId: input.modelId, elapsedMs: Date.now() - startedAt, sample: sample.slice(0, 240) };
}

export async function testAiProviderModel(input: AiProviderInput & { modelId: string; reasoningMode: string }): Promise<AiModelTestResult> {
  const catalog = await probeAiProvider(input);
  const model = catalog.models.find((item) => item.id === input.modelId);
  if (!model) throw new Error("所选模型不在 Provider 返回的官方模型目录中，请重新拉取模型列表。");
  return requestAiProviderModel(input, model);
}

type AiAccountRow = {
  id: string;
  provider_id: string;
  display_name: string;
  model_id: string;
  models_json: string;
  reasoning_mode: string;
  is_active: number;
  created_at: string;
};

export interface AiAccountView {
  id: string;
  providerId: string;
  displayName: string;
  modelId: string;
  models: AiModelCatalogEntry[];
  reasoningMode: string;
  active: boolean;
  createdAt: string;
  hasSecret: true;
}

function mapAccount(row: AiAccountRow): AiAccountView {
  let rawModels: unknown = [];
  try { rawModels = JSON.parse(row.models_json) as unknown; } catch { /* 损坏的旧目录不会影响已保存账户的基本信息。 */ }
  const models = normalizeSavedModels(row.provider_id, rawModels);
  const model = models.find((item) => item.id === row.model_id);
  return { id: row.id, providerId: row.provider_id, displayName: row.display_name, modelId: row.model_id, models, reasoningMode: normalizeAccountReasoningMode(model?.thinking ?? null, row.reasoning_mode), active: row.is_active === 1, createdAt: row.created_at, hasSecret: true };
}

function accountRows(userId: string): AiAccountRow[] {
  return configuration.all("ai_accounts", row => (row.user_id === userId), "created_at") as AiAccountRow[];
}

export function listAiAccounts(userId: string): AiAccountView[] {
  return accountRows(userId).map(mapAccount);
}

function getEncryptionKey(): Buffer {
  // 使用数据根目录中的稳定密钥文件，避免服务重启后无法解密已保存的 Provider 凭证。
  const keyPath = resolve(config.dataDirectory, "credentials", "settings.key");
  mkdirSync(dirname(keyPath), { recursive: true, mode: 0o700 });
  try {
    const key = readFileSync(keyPath);
    if (key.length !== 32) throw new Error("AI 密钥加密文件格式无效。");
    return key;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const key = randomBytes(32);
    try { writeFileSync(keyPath, key, { flag: "wx", mode: 0o600 }); }
    catch (writeError) {
      if ((writeError as NodeJS.ErrnoException).code !== "EEXIST") throw writeError;
      const existing = readFileSync(keyPath);
      if (existing.length !== 32) throw new Error("AI 密钥加密文件格式无效。");
      return existing;
    }
    return key;
  }
}

function encryptSecret(secret: string): { ciphertext: string; iv: string; tag: string } {
  // 每个密钥使用随机初始化向量和 GCM 认证标签，配置文件中只保存密文。
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return { ciphertext: ciphertext.toString("base64url"), iv: iv.toString("base64url"), tag: cipher.getAuthTag().toString("base64url") };
}

function decryptSecret(row: { secret_ciphertext: string; secret_iv: string; secret_tag: string }): string {
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(row.secret_iv, "base64url"));
  decipher.setAuthTag(Buffer.from(row.secret_tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(row.secret_ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

function credentialRecordAad(userId: string, providerId: string, recordId: string): Buffer {
  return Buffer.from(`lfaa-credential-record\0${userId}\0${providerId}\0${recordId}`, "utf8");
}

function encryptCredentialRecord(userId: string, reference: { providerId: string; id: string }, record: CredentialRecord): { ciphertext: string; iv: string; tag: string } {
  const normalized = normalizeCredentialRecord(record);
  const plaintext = JSON.stringify(normalized);
  if (!plaintext || Buffer.byteLength(plaintext, "utf8") > 65_536) throw new Error("凭据记录超过 64 KiB 限制。");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  cipher.setAAD(credentialRecordAad(userId, reference.providerId, reference.id));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { ciphertext: ciphertext.toString("base64url"), iv: iv.toString("base64url"), tag: cipher.getAuthTag().toString("base64url") };
}

function decryptCredentialRecord(userId: string, reference: { providerId: string; id: string }, row: { ciphertext: string; iv: string; tag: string }): CredentialRecord {
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(row.iv, "base64url"));
  decipher.setAAD(credentialRecordAad(userId, reference.providerId, reference.id));
  decipher.setAuthTag(Buffer.from(row.tag, "base64url"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(row.ciphertext, "base64url")), decipher.final()]).toString("utf8");
  return normalizeCredentialRecord(JSON.parse(plaintext) as CredentialRecord);
}

/** 由 Settings 加密持久化通用插件凭据；AAD 绑定账户、插件所有者和记录 ID，防止密文跨记录调换。 */
export function readPluginCredentialRecord(userId: string, rawReference: { providerId: string; id: string }): CredentialRecord | null {
  const reference = credentialReference(rawReference.providerId, rawReference.id);
  const row = configuration.getCredentialRecord(userId, reference.providerId, reference.id);
  return row ? decryptCredentialRecord(userId, reference, row) : null;
}

export function savePluginCredentialRecord(userId: string, rawReference: { providerId: string; id: string }, record: CredentialRecord): void {
  const reference = credentialReference(rawReference.providerId, rawReference.id);
  const normalized = normalizeCredentialRecord(record);
  const encrypted = encryptCredentialRecord(userId, reference, normalized);
  configuration.saveCredentialRecord({ user_id: userId, provider_id: reference.providerId, record_id: reference.id, record_kind: normalized.kind, ...encrypted });
}

export function deletePluginCredentialRecord(userId: string, rawReference: { providerId: string; id: string }): boolean {
  const reference = credentialReference(rawReference.providerId, rawReference.id);
  return configuration.removeCredentialRecord(userId, reference.providerId, reference.id);
}

export function listPluginCredentialRecords(userId: string): CredentialRecordMetadata[] {
  return configuration.listCredentialRecords(userId).map(row => ({
    reference: credentialReference(row.provider_id, row.record_id),
    kind: row.record_kind,
    updatedAt: row.updated_at
  }));
}

export interface ActiveAiModelConfiguration {
  accountId: string;
  providerId: string;
  modelId: string;
  secret: string;
  chatUrl: string;
  keyHeader: string;
  keyPrefix: string;
  maxTokensField: ProviderConnection["maxTokensField"];
  maxOutputTokens?: number;
  reasoningMode: string;
  thinking: AiModelThinkingControl | null;
}

export type ActiveAiModelDetails = Omit<ActiveAiModelConfiguration, "secret">;

/** 仅返回活动模型元数据；密钥由独立的凭据引用来源读取。 */
export function resolveActiveAiModelDetails(userId: string, accountId?: string): ActiveAiModelDetails | null {
  const row = configuration.get("ai_accounts", row => ((row.user_id === userId) && (accountId ? row.id === accountId : row.is_active === 1))) as ({ id: string; provider_id: string; options_json: string; model_id: string; models_json: string; reasoning_mode: string; secret_ciphertext: string; secret_iv: string; secret_tag: string } | undefined);
  if (!row) return null;
  const connection = resolveProvider(row.provider_id, JSON.parse(row.options_json) as Record<string, string>);
  let models: AiModelCatalogEntry[] = [];
  try { models = normalizeSavedModels(row.provider_id, JSON.parse(row.models_json) as unknown); } catch { /* 旧模型目录损坏时不向推理请求注入未知参数。 */ }
  const selectedModel = models.find((model) => model.id === row.model_id);
  return {
    accountId: row.id,
    providerId: row.provider_id,
    modelId: row.model_id,
    chatUrl: connection.chatUrl,
    keyHeader: connection.keyHeader,
    keyPrefix: connection.keyPrefix ?? "",
    maxTokensField: connection.maxTokensField,
    ...(selectedModel?.maxOutputTokens ? { maxOutputTokens: selectedModel.maxOutputTokens } : {}),
    reasoningMode: normalizeAccountReasoningMode(selectedModel?.thinking ?? null, row.reasoning_mode),
    thinking: selectedModel?.thinking ?? null
  };
}

/** 凭据来源仅在用户 ID 与账户 ID 同时匹配时解密账户密钥。 */
export function resolveAiModelAccountCredential(userId: string, accountId: string): string | null {
  const row = configuration.get("ai_accounts", row => ((row.user_id === userId) && (row.id === accountId))) as ({ secret_ciphertext: string; secret_iv: string; secret_tag: string } | undefined);
  return row ? decryptSecret(row) : null;
}

/** 兼容服务端模型调用方；不得从 HTTP API 返回或写入日志。 */
export function resolveActiveAiModelConfiguration(userId: string, accountId?: string): ActiveAiModelConfiguration | null {
  const details = resolveActiveAiModelDetails(userId, accountId);
  if (!details) return null;
  const secret = resolveAiModelAccountCredential(userId, details.accountId);
  return secret === null ? null : { ...details, secret };
}

export async function saveAiAccount(userId: string, input: AiProviderInput & { displayName: string; modelId: string; reasoningMode: string }): Promise<AiAccountView> {
  const displayName = input.displayName.trim();
  if (displayName.length < 1 || displayName.length > 48) throw new Error("账户名称需要为 1 到 48 个字符。");
  const probe = await probeAiProvider(input);
  const model = probe.models.find((item) => item.id === input.modelId);
  if (!model) throw new Error("所选模型不在该 Provider 返回的官方模型目录中。");
  const reasoningMode = input.reasoningMode === "default" ? defaultReasoningMode(model.thinking) : input.reasoningMode;
  validateReasoningMode(model.thinking, reasoningMode);
  const secret = encryptSecret(input.secret.trim());
  const id = randomUUID();
  try {
    configuration.insert("ai_accounts", { id: id, user_id: userId, provider_id: input.providerId, display_name: displayName, options_json: JSON.stringify(input.options), model_id: input.modelId, models_json: JSON.stringify(probe.models), reasoning_mode: reasoningMode, secret_ciphertext: secret.ciphertext, secret_iv: secret.iv, secret_tag: secret.tag });
  } catch (error) {
    if (error instanceof ConfigurationConflict) throw new Error("此用户下已有同名 AI 账户。");
    throw error;
  }
  const row = accountRows(userId).find((account) => account.id === id);
  if (!row) throw new Error("AI 账户保存失败，请重试。");
  return mapAccount(row);
}

export async function reprobeAiAccount(userId: string, accountId: string): Promise<AiProviderProbe> {
  const row = configuration.get("ai_accounts", row => ((row.user_id === userId) && (row.id === accountId))) as ({ provider_id: string; options_json: string; model_id: string; reasoning_mode: string; secret_ciphertext: string; secret_iv: string; secret_tag: string } | undefined);
  if (!row) throw new Error("找不到该 AI 账户。");
  const result = await probeAiProvider({ providerId: row.provider_id, options: JSON.parse(row.options_json) as Record<string, string>, secret: decryptSecret(row) });
  const nextModel = result.models.some((model) => model.id === row.model_id) ? row.model_id : result.models[0]?.id;
  const nextModelDetails = result.models.find((model) => model.id === nextModel);
  const nextReasoningMode = nextModel === row.model_id && nextModelDetails
    ? normalizeAccountReasoningMode(nextModelDetails.thinking, row.reasoning_mode)
    : defaultReasoningMode(nextModelDetails?.thinking ?? null);
  if (!nextModel || !nextModelDetails) throw new Error("Provider 官方目录中没有可用于模型测试的项目。");
  await requestAiProviderModel({
    providerId: row.provider_id,
    options: JSON.parse(row.options_json) as Record<string, string>,
    secret: decryptSecret(row),
    modelId: nextModel,
    reasoningMode: nextReasoningMode
  }, nextModelDetails);
  configuration.update("ai_accounts", row => ((row.user_id === userId) && (row.id === accountId)), { models_json: JSON.stringify(result.models), model_id: nextModel, reasoning_mode: nextReasoningMode });
  return { ...result, message: `${result.message}；当前模型已通过真实请求测试。` };
}

export async function updateAiAccountModel(userId: string, accountId: string, modelId: string): Promise<AiAccountView> {
  const row = configuration.get("ai_accounts", row => ((row.user_id === userId) && (row.id === accountId))) as (AiAccountRow & { options_json: string; secret_ciphertext: string; secret_iv: string; secret_tag: string } | undefined);
  if (!row) throw new Error("找不到该 AI 账户。");
  const options = JSON.parse(row.options_json) as Record<string, string>;
  const secret = decryptSecret(row);
  const catalog = await probeAiProvider({ providerId: row.provider_id, options, secret });
  const selectedModel = catalog.models.find((model) => model.id === modelId);
  if (!selectedModel) throw new Error("所选模型不在 Provider 当前返回的官方目录中，请重新拉取模型列表。");
  let previousModels: AiModelCatalogEntry[] = [];
  try { previousModels = normalizeSavedModels(row.provider_id, JSON.parse(row.models_json) as unknown); } catch { /* 旧模型目录无法读取时使用新模型的 Provider 默认行为。 */ }
  const previousModel = previousModels.find((model) => model.id === row.model_id);
  const previousReasoningMode = normalizeAccountReasoningMode(previousModel?.thinking ?? null, row.reasoning_mode);
  const reasoningMode = isSelectableReasoningMode(selectedModel.thinking, previousReasoningMode)
    ? previousReasoningMode
    : defaultReasoningMode(selectedModel.thinking);
  await requestAiProviderModel({ providerId: row.provider_id, options, secret, modelId, reasoningMode }, selectedModel);
  configuration.update("ai_accounts", row => ((row.user_id === userId) && (row.id === accountId)), { model_id: modelId, models_json: JSON.stringify(catalog.models), reasoning_mode: reasoningMode });
  return mapAccount({ ...row, model_id: modelId, models_json: JSON.stringify(catalog.models), reasoning_mode: reasoningMode });
}

function isReasoningModeValid(control: AiModelThinkingControl | null, mode: string): boolean {
  return isSelectableReasoningMode(control, mode);
}

function validateReasoningMode(control: AiModelThinkingControl | null, mode: string): void {
  if (!isReasoningModeValid(control, mode)) throw new Error("所选思考力度不属于当前模型目录返回的支持范围。");
}

export function updateAiAccountReasoningMode(userId: string, accountId: string, reasoningMode: string): AiAccountView {
  const row = configuration.get("ai_accounts", row => ((row.user_id === userId) && (row.id === accountId))) as AiAccountRow | undefined;
  if (!row) throw new Error("找不到该 AI 账户。");
  const model = normalizeSavedModels(row.provider_id, JSON.parse(row.models_json) as unknown).find((item) => item.id === row.model_id);
  validateReasoningMode(model?.thinking ?? null, reasoningMode);
  configuration.update("ai_accounts", row => ((row.user_id === userId) && (row.id === accountId)), { reasoning_mode: reasoningMode });
  return mapAccount({ ...row, reasoning_mode: reasoningMode });
}

export function activateAiAccount(userId: string, accountId: string): AiAccountView {
  const account = configuration.get("ai_accounts", row => ((row.user_id === userId) && (row.id === accountId)));
  if (!account) throw new Error("找不到该 AI 账户。");
  configuration.begin();
  try {
    configuration.update("ai_accounts", row => (row.user_id === userId), { is_active: 0 });
    configuration.update("ai_accounts", row => ((row.user_id === userId) && (row.id === accountId)), { is_active: 1 });
    configuration.commit();
  } catch (error) {
    configuration.rollback();
    throw error;
  }
  const row = accountRows(userId).find((item) => item.id === accountId);
  if (!row) throw new Error("无法读取已激活的 AI 账户。");
  return mapAccount(row);
}

export function deleteAiAccount(userId: string, accountId: string): void {
  configuration.remove("ai_accounts", row => ((row.user_id === userId) && (row.id === accountId)));
}
