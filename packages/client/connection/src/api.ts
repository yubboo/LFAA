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
import { createStreamDeltas } from "./stream-deltas.js";
import type { ApplicationId } from "lfaa-util-values/src/application-id.js";
import type { TypertRemoteCallOptions, TypertRemoteClientContract } from "lfaa-typert-protocol/src/index.js";
import { accountControllerRemoteMethods, type AccountControllerRemoteContract } from "lfaa-api-account-controller/src/client-contract.generated.js";

export type { ApplicationId } from "lfaa-util-values/src/application-id.js";
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
  aiWorkOutputFocusBlurEnabled: boolean;
  aiWorkOutputFocusBlurPercent: number;
  aiWorkOutputFocusBlurIdleSeconds: number;
}

export interface AppearanceSettings {
  theme: "light" | "dark" | "system";
  accentColor: string;
  sidebarColor: string;
  backgrounds: { login: string; appCenter: string; steamcmd: string; minecraft: string; writing: string; settings: string };
  wallpaperEngine: { enabled: boolean; projectId: string };
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
  pointerCursor: false,
  aiWorkOutputFocusBlurEnabled: true,
  aiWorkOutputFocusBlurPercent: 33,
  aiWorkOutputFocusBlurIdleSeconds: 60
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
  shortcuts: { openSettings: string[]; openHome: string[]; openSteamcmd: string[]; openMinecraft: string[]; openWriting: string[]; toggleSidebar: string[]; toggleContextPanel: string[]; toggleBottomPanel: string[]; openTerminal: string[]; switchNormalMode: string[]; switchAiWorkMode: string[]; openSideChat: string[]; wallpaperSidebarToggle: string[] };
  aiRuntime: { speed: "balanced" | "fast" | "deep"; promptSuggestions: boolean; showContextUsage: boolean; requestTimeoutSeconds: number; maxOutputTokens: number; maxModelRequests: number; maxToolCalls: number; subagentAccountId: string; maxSubagents: number; maxDelegationDepth: number; voiceInputEnabled: boolean; readResponsesAloud: boolean; commandTimeoutSeconds: number; };
  minecraftRuntime: { minecraftReadyTimeoutSeconds: number; minecraftStopTimeoutSeconds: number; minecraftDefaultMemoryMb: number; minecraftDefaultPort: number; minecraftDownloadTimeoutSeconds: number; minecraftInstallTimeoutSeconds: number; minecraftExecutionMode: "native" | "appcontainer"; minecraftDefaultCore: string; minecraftBedrockDefaultPort: number; };
  git: { branchPrefix: string };
  permissions: { mode: "ask" | "approve_remembered" | "full_access" };
  personalization: { memoryEnabled: boolean; memoryFromToolChats: boolean };
  computerControl: { enabled: boolean };
  plugins: {
    enabled: boolean;
    mcpServers: Array<{ id: string; name: string; url: string; enabled: boolean; applicationIds: ApplicationId[]; manifestSha256?: string }>;
    prompts: Array<{ id: string; name: string; description: string; applicationId: ApplicationId; sourceRepository: string; sourcePath: string; license: string | null; commit: string; archiveSha256: string; contentSha256: string; content: string; enabled: boolean; createdAt: string }>;
  };
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
  thinkingSource: "provider-model-catalog" | null;
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

export interface ManagedPluginRecord {
  id: string;
  name: string;
  version: string;
  description: string;
  source: { repository: string; requestedRef: string; commit: string; archiveSha256: string; license: string | null };
  compatibility: "lfaa-v1" | "dsh-v1" | "unsupported";
  runtimeEntry: string | null;
  capabilities: string[];
  applicationIds: ApplicationId[];
  state: "installed" | "enabled" | "incompatible";
  reason: string | null;
  installedAt: string;
  installedBy: string;
}

export type CapabilityInstallKind = "plugin" | "skill" | "prompt" | "tool" | "mcp" | "minecraft-plugin" | "minecraft-mod";

export interface CapabilityInstallCatalogEntry {
  kind: CapabilityInstallKind;
  available: boolean;
  applicationIds: ApplicationId[];
  operations: string[];
  reason: string | null;
}

export interface ManagedPluginCandidate {
  owner: string;
  name: string;
  fullName: string;
  description: string;
  stars: number;
  license: string | null;
  defaultBranch: string;
  url: string;
  updatedAt: string;
  sourceType: "github";
  requiresInspection: true;
  warning: string;
}

export interface ManagedPluginInspection {
  id: string;
  name: string;
  version: string;
  description: string;
  compatibility: "lfaa-v1" | "dsh-v1" | "unsupported";
  runtimeEntry: string | null;
  capabilities: string[];
  applicationIds: ApplicationId[];
  reason: string | null;
  repository: { owner: string; name: string; fullName: string; description: string; stars: number; license: string | null; defaultBranch: string; url: string };
  requestedRef: string;
  resolvedCommit: string;
  archiveSha256: string;
  requirements: {
    dshVersion: string | null;
    hostEntry: string | null;
    bundlePatch: string | null;
    clientEntry: string | null;
    clientPlatform: string | null;
    clientInject: string[];
    peerDependencies: Record<string, string>;
    packageDependencies: string[];
    declaredScripts: string[];
  };
  license: string | null;
  canEnable: boolean;
  runtimeReason: string | null;
}

export interface AiSession {
  id: string;
  appId: ApplicationId;
  title: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  projectId?: string | null;
  projectTitle?: string | null;
  planMode: boolean;
}

export type WorkspaceProjectApplicationId = "workspace" | "minecraft";

export interface WorkspaceProject {
  id: string;
  userId: string;
  appId: WorkspaceProjectApplicationId | null;
  nodeId: string;
  path: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  gitWorktree: { projectId: string; sourceProjectId: string; nodeId: string; worktreeId: string; worktreeRoot: string; projectRelativePath: string; branch: string; baseCommit: string; sourceHead: string; createdAt: string } | null;
}

export type KnowledgeLibraryKind = "knowledge" | "skill" | "prompt" | "expert";
export type KnowledgeLibraryScope = ApplicationId | "all";

export interface KnowledgeLibraryItemSummary {
  id: string;
  applicationId: KnowledgeLibraryScope;
  kind: KnowledgeLibraryKind;
  title: string;
  description: string;
  contentSha256: string;
  sourceKind: "upload" | "conversation" | "manual";
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeLibraryItem extends KnowledgeLibraryItemSummary {
  contentMarkdown: string;
}

export interface KnowledgeLibraryProjectSource {
  id: string;
  applicationId: KnowledgeLibraryScope;
  projectId: string;
  projectApplicationId: WorkspaceProjectApplicationId;
  relativePath: string;
  title: string;
  createdAt: string;
}

export interface KnowledgeLibraryUsage {
  resources: number;
  limit: number;
}

export interface WorkspaceDaemonNode {
  id: string;
  displayName: string;
  platform: string;
  architecture: string;
  version: string;
  status: "online" | "offline";
  lastSeenAt: string;
  gitWorkspaceSupported?: boolean;
}

export interface WorkspaceGitStatus {
  repository: string;
  projectRelativePath: string;
  worktreeId: string | null;
  branch: string;
  head: string;
  baseline: string;
  clean: boolean;
  changedFileCount: number;
  shownFileCount: number;
  files: Array<{ status: string; path: string; projectPath: string; displayPath: string; insertions: number | null; deletions: number | null }>;
  insertions: number;
  deletions: number;
  unknownLineCounts: number;
  diff: string;
  diffTruncated: boolean;
  statusTruncated: boolean;
}

export interface WorkspaceGitFileDiff {
  path: string;
  status: string;
  diff: string;
  diffTruncated: boolean;
  wordDiff: boolean;
  ignoreWhitespace: boolean;
}

export interface WorkspaceProjectTextFile {
  path: string;
  content: string;
  offset: number;
  totalCharacters: number;
  truncated: boolean;
  sha256: string;
}

export interface AiHostTask {
  id: string; nodeId: string; shell: string; workingDirectory: string; status: "queued" | "running" | "succeeded" | "failed"; message: string; createdAt: string;
  result?: { stdout: string; stderr: string; exitCode: number | null; timedOut: boolean; outputTruncated: boolean } | null;
  cancelRequested?: boolean;
}
export function loadAiHostTasks(): Promise<{ tasks: AiHostTask[] }> { return request("/ai/host-tasks"); }
export function loadAiHostTask(taskId: string): Promise<{ task: AiHostTask }> { return request(`/ai/host-tasks/${encodeURIComponent(taskId)}`); }
export function cancelAiHostTask(taskId: string): Promise<{ task: AiHostTask }> { return request(`/ai/host-tasks/${encodeURIComponent(taskId)}/cancel`, { method: "POST" }); }

export interface WritingBook {
  id: string;
  title: string;
    aiRoleId: WritingSpecialistId;
  createdAt: string;
  updatedAt: string;
}

  export type WritingSpecialistId = "writing-companion" | "outline-planner" | "chapter-writer" | "precision-editor" | "continuity-reviewer" | "character-consultant";

  export interface WritingSpecialistOption { id: WritingSpecialistId; name: string; description: string }
  export interface WritingBookSkillSummary { id: string; title: string; description: string; enabled: boolean; updatedAt: string }
  export interface WritingBookSkill extends WritingBookSkillSummary { bookId: string; instructions: string; createdAt: string }

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
}

export interface WritingCatalogEntry extends WritingCatalogSummary {
  bookId: string;
  content: string;
  createdAt: string;
  wordCount: number;
}

export interface WritingCatalogPage {
  entries: WritingCatalogSummary[];
  offset: number;
  limit: number;
  total: number;
}

export type WritingEditOperation = "append" | "prepend" | "insert_before" | "insert_after" | "replace_anchor" | "replace";

export interface WritingEditProposal {
  id: string;
  bookId: string;
  targetType: "outline" | "chapter";
  targetId: string;
  bookTitle: string;
  targetTitle: string;
  operation: WritingEditOperation;
  status: "pending" | "applied" | "rejected" | "stale" | "superseded" | "expired";
  createdAt: string;
  expiresAt: string;
  baseContent: string | null;
  proposedContent: string | null;
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
  catalogEntriesHasMore: boolean;
    writingRoleOptions: WritingSpecialistOption[];
    bookSkills: WritingBookSkillSummary[];
}

export interface AiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "complete" | "queued" | "streaming" | "interrupted" | "error";
  createdAt: string;
  activity: AiActivityItem[];
  feedback?: AiMessageFeedback;
}

export interface AiMessageFeedback {
  rating: "positive" | "negative";
  reasons: string[];
  detail: string;
  submittedAt: string;
}

export interface AiMessageFeedbackInput {
  rating: "positive" | "negative";
  reasons: string[];
  detail: string;
}

export interface AiActivityItem {
  id: string;
  kind: "status" | "skill" | "tool" | "command" | "agent" | "question";
  title: string;
  status: "running" | "approval_required" | "waiting_input" | "complete" | "error" | "unavailable";
  detail: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  approvalId?: string;
  questionId?: string;
  question?: string;
  options?: string[];
  writingProposalId?: string;
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
  coreType: string;
  coreBuild: string;
  executionMode: "native" | "appcontainer";
  state: "installing" | "stopped" | "starting" | "running" | "stopping" | "error" | "unknown";
  sandboxAvailable: boolean;
  sandboxStatus: "unsupported" | "unprepared" | "prepared" | "running" | "unknown";
  eulaAcceptedAt: string;
  serverProperties: MinecraftServerProperties;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectivityTarget {
  id: string;
  applicationId: ApplicationId;
  name: string;
  nodeId: string;
  nodeName: string;
  nodeStatus: "online" | "offline";
  transport: "tcp" | "udp";
  localHost: "127.0.0.1";
  localPort: number;
  state: "running";
}

export interface ConnectivityRoute {
  id: string;
  sourceAppId: ApplicationId | "custom";
  targetId: string | null;
  name: string;
  mode: "provider" | "self-managed" | "room-domain";
  transport: "tcp" | "udp";
  target: { nodeId: string; localHost: "127.0.0.1"; localPort: number };
  roomName: string | null;
  publicPort: number | null;
  playerAddress: string | null;
  state: "manual" | "waiting-for-node" | "connected" | "offline" | "failed";
  errorCode: string | null;
  createdAt: string;
  updatedAt: string;
  lastConnectedAt: string | null;
}

export interface ConnectivityProvider {
  id: string;
  name: string;
  officialUrl: string;
  status: "ready";
  transports: Array<"tcp" | "udp">;
  configured: boolean;
}

export interface ConnectivityOverview {
  deployment: { roomDomain: { configured: boolean; publicDomain: string | null; relayUrl: string | null; reason: string | null; tcpPortStart: number | null; tcpPortEnd: number | null; udpPortStart: number | null; udpPortEnd: number | null; minecraftPort: number | null } };
  easyTier: { version: string; license: "LGPL-3.0"; installCapability: string; runtimeCapability: string };
  providers: ConnectivityProvider[];
  routes: ConnectivityRoute[];
  targets: ConnectivityTarget[];
  nodes: Array<{ id: string; displayName: string; platform: string; architecture: string; capabilities: string[] }>;
}

export interface ConnectivityEasyTierTask {
  id: string;
  nodeId: string;
    status: "queued" | "running" | "succeeded" | "failed" | "unknown";
  message: string;
  createdAt: string;
  finishedAt: string | null;
}

export interface MinecraftDeployment {
  id: string;
  nodeId: string;
  nodeName: string;
  nodeStatus: "online" | "offline";
  name: string;
  storageDirectory: string;
  serverType: string;
  coreBuild: string;
  automatic: boolean;
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
  kind: "install" | "start" | "stop" | "properties" | "backup" | "java-install" | "restart" | "console";
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

export interface DesktopUpdateRuntimeInfo {
  supported: boolean;
  currentVersion: string;
}

export interface DesktopUpdateCheckResult {
  status: "unsupported" | "disabled" | "up-to-date" | "deferred" | "downloading" | "downloaded" | "error";
  currentVersion: string;
  latestVersion?: string;
  releaseNotes?: string[];
  message?: string;
}

declare global {
  interface Window {
    lfaaDesktop?: {
      selectDataDirectory: () => Promise<string | null>;
      getUpdateRuntimeInfo: () => Promise<DesktopUpdateRuntimeInfo>;
      checkForUpdates: () => Promise<DesktopUpdateCheckResult>;
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

async function requestBinary(path: string, options: RequestInit = {}): Promise<Blob> {
  const headers = new Headers(options.headers);
  const response = await fetch(`/api${path}`, { ...options, headers, credentials: "include" });
  if (!response.ok) {
    const rawBody = await response.text();
    let responseBody: unknown;
    try { responseBody = rawBody ? JSON.parse(rawBody) as unknown : undefined; } catch { responseBody = undefined; }
    const message = typeof responseBody === "object" && responseBody !== null && "message" in responseBody && typeof responseBody.message === "string"
      ? responseBody.message
      : "请求失败，请稍后重试。";
    const code = typeof responseBody === "object" && responseBody !== null && "error" in responseBody && typeof responseBody.error === "string"
      ? responseBody.error
      : undefined;
    if (response.status === 401 && (code === "authentication_required" || code === "invalid_session") && typeof window !== "undefined") {
      pendingReads.clear();
      window.dispatchEvent(new Event(sessionExpiredEventName));
    }
    throw new ApiError(response.status, message, code);
  }
  return response.blob();
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
export type WorkflowValueType = "text" | "json" | "artifact" | "any";
export interface WorkflowPort { id: string; valueType: WorkflowValueType; required?: boolean }
export interface WorkflowNode { id: string; type: string; version: number; title: string; data: Record<string, unknown>; x: number; y: number }
export interface WorkflowEdge { id: string; from: string; fromPort: string; to: string; toPort: string }
export interface WorkflowDefinition { id: string; appId: ApplicationId; schemaVersion: 1; engineId: string; title: string; nodes: WorkflowNode[]; edges: WorkflowEdge[]; createdAt: string; updatedAt: string }
export interface WorkflowNodeType { type: string; version: number; applicationIds: ApplicationId[]; name: string; description: string; defaultData: Record<string, unknown>; inputPorts: WorkflowPort[]; outputPorts: WorkflowPort[]; configurationOptions?: unknown }
export interface WorkflowEngineType { id: string; version: number; name: string }
export type WorkflowStatus = "queued" | "running" | "succeeded" | "failed" | "interrupted";
export type WorkflowNodeStatus = "waiting" | "running" | "succeeded" | "failed" | "interrupted";
export interface WorkflowRunNode { nodeId: string; type: string; title: string; startedAt: string | null; completedAt: string | null; status: WorkflowNodeStatus; output?: string; outputTruncated?: boolean; references?: Array<{ kind: string; id: string }>; progress?: Record<string, unknown>; error?: string }
export interface WorkflowRun { id: string; appId: ApplicationId; workflowId: string; status: WorkflowStatus; nodes: WorkflowRunNode[]; currentNodeId: string | null; createdAt: string; updatedAt: string }

const workflowPath = (appId: ApplicationId) => `/apps/${encodeURIComponent(appId)}/workflows`;
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
export function loadWorkflows(appId: ApplicationId): Promise<{ workflows: WorkflowDefinition[] }> { return request(workflowPath(appId)); }
export function loadWorkflowNodeTypes(appId: ApplicationId): Promise<{ nodes: WorkflowNodeType[] }> { return request(`${workflowPath(appId)}/nodes`); }
export function loadWorkflowEngineTypes(appId: ApplicationId): Promise<{ engines: WorkflowEngineType[] }> { return request(`${workflowPath(appId)}/engines`); }
export function createWorkflow(appId: ApplicationId, input: Pick<WorkflowDefinition, "title" | "nodes" | "edges"> & Partial<Pick<WorkflowDefinition, "engineId">>): Promise<{ workflow: WorkflowDefinition }> {
  return request(workflowPath(appId), { method: "POST", body: JSON.stringify(input) });
}
export function saveWorkflow(appId: ApplicationId, workflowId: string, input: Pick<WorkflowDefinition, "title" | "nodes" | "edges"> & Partial<Pick<WorkflowDefinition, "engineId">>): Promise<{ workflow: WorkflowDefinition }> {
  return request(`${workflowPath(appId)}/${encodeURIComponent(workflowId)}`, { method: "PUT", body: JSON.stringify(input) });
}
export function deleteWorkflow(appId: ApplicationId, workflowId: string): Promise<void> { return request(`${workflowPath(appId)}/${encodeURIComponent(workflowId)}`, { method: "DELETE" }); }
export function loadWorkflowRuns(appId: ApplicationId, workflowId: string): Promise<{ runs: WorkflowRun[] }> { return request(`${workflowPath(appId)}/${encodeURIComponent(workflowId)}/runs`); }
export function startWorkflowRun(appId: ApplicationId, workflowId: string, options: Record<string, unknown> = {}): Promise<{ run: WorkflowRun }> {
  return request(`${workflowPath(appId)}/${encodeURIComponent(workflowId)}/runs`, { method: "POST", body: JSON.stringify({ options }) });
}
export function cancelWorkflowRun(appId: ApplicationId, runId: string): Promise<{ run: WorkflowRun }> {
  return request(`/apps/${encodeURIComponent(appId)}/workflow-runs/${encodeURIComponent(runId)}/cancel`, { method: "POST" });
}

// Minecraft 页面适配器：旧 UI DTO 转成共享版本化图合同，数据库与 API 只保存通用定义。
export interface MinecraftWorkflowNode { id: string; type?: string; version?: number; kind?: "agent" | "text-input" | "result"; title: string; prompt: string; value?: string; toolNames: string[]; data?: Record<string, unknown>; x: number; y: number }
export interface MinecraftWorkflowEdge { id: string; from: string; fromPort?: string; to: string; toPort?: string }
export interface MinecraftWorkflow { id: string; appId: "minecraft"; schemaVersion: 1; engineId: string; title: string; nodes: MinecraftWorkflowNode[]; edges: MinecraftWorkflowEdge[]; createdAt: string; updatedAt: string }
export interface MinecraftWorkflowTool { id: string; name: string; description: string }
export type MinecraftWorkflowStatus = WorkflowStatus;
export interface MinecraftWorkflowRun extends Omit<WorkflowRun, "nodes"> {
  nodes: Array<WorkflowRunNode & { aiRunId: string | null; agentStatus?: string | null; pendingQuestion?: { questionId: string; question: string; options: string[] } | null; pendingApproval?: { approvalId: string; title: string; detail: string } | null }>;
  currentAgentRunId: string | null; sessionId: string | null; eulaAccepted: boolean;
}
function asMinecraftWorkflow(workflow: WorkflowDefinition): MinecraftWorkflow {
  return {
    ...workflow,
    appId: "minecraft",
    nodes: workflow.nodes.map((node) => ({
      id: node.id, type: node.type, version: node.version,
      kind: node.type === "core.text-input" ? "text-input" : node.type === "core.result" ? "result" : node.type === "minecraft.agent" ? "agent" : undefined,
      title: node.title,
      prompt: typeof node.data.prompt === "string" ? node.data.prompt : "",
      value: typeof node.data.text === "string" ? node.data.text : "",
      toolNames: Array.isArray(node.data.toolNames) ? node.data.toolNames.filter((name): name is string => typeof name === "string") : [],
      data: node.data, x: node.x, y: node.y
    }))
  };
}
function asGenericWorkflowInput(input: Pick<MinecraftWorkflow, "title" | "nodes" | "edges">) {
  const nodeById = new Map(input.nodes.map((node) => [node.id, node]));
  return {
    title: input.title,
    nodes: input.nodes.map((node) => ({
      id: node.id, type: node.type ?? (node.kind === "text-input" ? "core.text-input" : node.kind === "result" ? "core.result" : "minecraft.agent"),
      version: node.version ?? 1, title: node.title,
      data: node.kind === "text-input" ? { text: node.value ?? "" }
        : node.kind === "result" ? {}
          : node.kind === "agent" || !node.type ? { prompt: node.prompt, toolNames: node.toolNames }
            : node.data ?? {},
      x: node.x, y: node.y
    })),
    edges: input.edges.map((edge) => ({
      id: edge.id,
      from: edge.from,
      fromPort: edge.fromPort ?? (nodeById.get(edge.from)?.type === "core.text-input" ? "text" : "result"),
      to: edge.to,
      toPort: edge.toPort ?? (nodeById.get(edge.to)?.type === "core.result" ? "value" : "context")
    }))
  };
}
function asMinecraftRun(run: WorkflowRun): MinecraftWorkflowRun {
  const nodes = run.nodes.map((node) => {
    const aiRunId = node.references?.find((reference) => reference.kind === "ai-run")?.id ?? null;
    const progress = node.progress ?? {};
    return {
      ...node, aiRunId,
      agentStatus: typeof progress.agentStatus === "string" ? progress.agentStatus : null,
      pendingQuestion: progress.pendingQuestion && typeof progress.pendingQuestion === "object" ? progress.pendingQuestion as MinecraftWorkflowRun["nodes"][number]["pendingQuestion"] : null,
      pendingApproval: progress.pendingApproval && typeof progress.pendingApproval === "object" ? progress.pendingApproval as MinecraftWorkflowRun["nodes"][number]["pendingApproval"] : null
    };
  });
  return { ...run, nodes, currentAgentRunId: nodes.find((node) => node.aiRunId)?.aiRunId ?? null, sessionId: null, eulaAccepted: false };
}
export async function loadMinecraftWorkflowTools(): Promise<{ tools: MinecraftWorkflowTool[] }> {
  const { nodes } = await loadWorkflowNodeTypes("minecraft");
  const configuration = nodes.find((node) => node.type === "minecraft.agent")?.configurationOptions;
  return { tools: isRecord(configuration) && Array.isArray(configuration.tools) ? configuration.tools as MinecraftWorkflowTool[] : [] };
}
export async function loadMinecraftWorkflows(): Promise<{ workflows: MinecraftWorkflow[] }> {
  const result = await loadWorkflows("minecraft");
  return { workflows: result.workflows.map(asMinecraftWorkflow) };
}
export async function createMinecraftWorkflow(input: Pick<MinecraftWorkflow, "title" | "nodes" | "edges">): Promise<{ workflow: MinecraftWorkflow }> {
  const result = await createWorkflow("minecraft", asGenericWorkflowInput(input));
  return { workflow: asMinecraftWorkflow(result.workflow) };
}
export async function saveMinecraftWorkflow(workflowId: string, input: Pick<MinecraftWorkflow, "title" | "nodes" | "edges">): Promise<{ workflow: MinecraftWorkflow }> {
  const result = await saveWorkflow("minecraft", workflowId, asGenericWorkflowInput(input));
  return { workflow: asMinecraftWorkflow(result.workflow) };
}
export function deleteMinecraftWorkflow(workflowId: string): Promise<void> { return deleteWorkflow("minecraft", workflowId); }
export async function loadMinecraftWorkflowRuns(workflowId: string): Promise<{ runs: MinecraftWorkflowRun[] }> {
  const result = await loadWorkflowRuns("minecraft", workflowId);
  return { runs: result.runs.map(asMinecraftRun) };
}
export async function startMinecraftWorkflowRun(workflowId: string, eulaAccepted: boolean): Promise<{ run: MinecraftWorkflowRun }> {
  const result = await startWorkflowRun("minecraft", workflowId, { eulaAccepted });
  return { run: asMinecraftRun(result.run) };
}
export async function cancelMinecraftWorkflowRun(runId: string): Promise<{ run: MinecraftWorkflowRun }> {
  const result = await cancelWorkflowRun("minecraft", runId);
  return { run: asMinecraftRun(result.run) };
}
export interface MinecraftCore {
  name: string; category: "pure" | "mod" | "vanilla" | "proxy" | "bedrock"; versions: string[];
  homepage: string; source: "fastmirror" | "mohist"; launchKind: string;
}
export interface MinecraftCoreBuild { id: string; updatedAt: string; digest: string; }
export function loadMinecraftCores(): Promise<{ cores: MinecraftCore[]; errors: string[] }> { return request("/minecraft/cores"); }
export function loadMinecraftCoreBuilds(core: string, version: string, offset = 0): Promise<{ builds: MinecraftCoreBuild[]; count: number }> {
  return request(`/minecraft/cores/${encodeURIComponent(core)}/versions/${encodeURIComponent(version)}/builds?offset=${offset}`);
}
export function provisionMinecraftServer(input: { nodeId: string; name: string; core: string; version: string; build: string; eulaAccepted: true; memoryMb: number; serverPort: number; javaRuntimeId?: string | null; proxyBackendInstanceId?: string }): Promise<{ instance: MinecraftInstance; deployment: MinecraftDeployment; task: MinecraftTask }> {
  return request("/minecraft/provision", { method: "POST", body: JSON.stringify(input) });
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

export function loadConnectivityOverview(): Promise<ConnectivityOverview> {
  return request("/connectivity/overview");
}

export function loadConnectivityEasyTierTasks(): Promise<{ tasks: ConnectivityEasyTierTask[] }> {
  return request("/connectivity/easytier/tasks");
}

export function installConnectivityEasyTier(nodeId: string): Promise<{ task: ConnectivityEasyTierTask }> {
  return request("/connectivity/easytier/install", { method: "POST", body: JSON.stringify({ nodeId }) });
}

export function loadConnectivityEasyTierTask(taskId: string): Promise<{ task: ConnectivityEasyTierTask }> {
  return request(`/connectivity/easytier/tasks/${encodeURIComponent(taskId)}`);
}

export function createConnectivityRoute(input: { sourceAppId: ApplicationId | "custom"; targetId?: string | null; name: string; mode: ConnectivityRoute["mode"]; transport: ConnectivityRoute["transport"]; nodeId?: string; localPort?: number; playerAddress?: string }): Promise<{ route: ConnectivityRoute }> {
  return request("/connectivity/routes", { method: "POST", body: JSON.stringify(input) });
}

export function deleteConnectivityRoute(routeId: string): Promise<void> {
  return request(`/connectivity/routes/${encodeURIComponent(routeId)}`, { method: "DELETE" });
}

export function saveConnectivityProviderCredential(providerId: string, token: string): Promise<void> {
  return request(`/connectivity/providers/${encodeURIComponent(providerId)}/credential`, { method: "POST", body: JSON.stringify({ token }) });
}

export function deleteConnectivityProviderCredential(providerId: string): Promise<void> {
  return request(`/connectivity/providers/${encodeURIComponent(providerId)}/credential`, { method: "DELETE" });
}

export function loadConnectivityProviderCatalog(providerId: string): Promise<{ result: unknown }> {
  return request(`/connectivity/providers/${encodeURIComponent(providerId)}/catalog`, { method: "POST", body: JSON.stringify({ kind: "nodes" }) });
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

export function runMinecraftInstanceAction(instanceId: string, action: "start" | "stop" | "backup" | "restart"): Promise<{ task: MinecraftTask }> {
  return request(`/minecraft/instances/${encodeURIComponent(instanceId)}/${action}`, { method: "POST" });
}
export function sendMinecraftConsole(instanceId: string, command: string): Promise<{ task: MinecraftTask }> {
  return request(`/minecraft/instances/${encodeURIComponent(instanceId)}/console`, { method: "POST", body: JSON.stringify({ command }) });
}

export function saveMinecraftServerProperties(instanceId: string, properties: MinecraftServerProperties): Promise<{ task: MinecraftTask }> {
  return request(`/minecraft/instances/${encodeURIComponent(instanceId)}/properties`, { method: "PATCH", body: JSON.stringify({ properties }) });
}

export function loadSetupStatus(): Promise<{ requiresSetup: boolean }> {
  return request<{ requiresSetup: boolean }>("/auth/setup-status");
}

export function loadCurrentUser(): Promise<{ user: User }> {
  const endpoint = accountControllerRemoteMethods["auth/me"].endpoint;
  return invokeTypertRemote<AccountControllerRemoteContract, typeof endpoint>(endpoint, {}).catch((error: unknown) => {
    // Host 进程可能仍在运行升级前的构建；只在明确的路由缺失时走其同一认证 Owner 的旧只读入口。
    // 401、网络故障、输入/输出校验失败都原样返回，不降级认证或吞掉新 Host 错误。
    if (error instanceof ApiError && error.status === 404 && error.code === "not_found") {
      return request<{ user: User }>("/auth/me");
    }
    throw error;
  });
}

/** 使用现有同源 API 会话调用已登记的类型化 Remote；响应仍由 Host 方法的运行时解析器校验。 */
export async function invokeTypertRemote<Contract extends TypertRemoteClientContract, Endpoint extends keyof Contract & string>(
  endpoint: Endpoint,
  input: Contract[Endpoint]["input"],
  options: TypertRemoteCallOptions = {}
): Promise<Contract[Endpoint]["output"]> {
  const separator = endpoint.indexOf("/");
  const namespace = endpoint.slice(0, separator);
  const method = endpoint.slice(separator + 1);
  if (separator <= 0 || endpoint.indexOf("/", separator + 1) >= 0 || !isTypertIdentifier(namespace) || !isTypertIdentifier(method)) {
    throw new TypeError("Remote 命名空间或方法名无效。");
  }
  const signalOption = options.signal ? { signal: options.signal } : {};
  const response = await request<{ result: Contract[Endpoint]["output"] }>(`/typert/${encodeURIComponent(namespace)}/${encodeURIComponent(method)}`, {
    method: "POST",
    body: JSON.stringify({ input }),
    ...signalOption
  });
  return response.result;
}

function isTypertIdentifier(value: string): boolean {
  return value.length <= 128 && /^[a-z0-9][a-z0-9._-]*$/u.test(value);
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
  const serverCategory = category === "aiRuntime" ? "ai-runtime" : category === "minecraftRuntime" ? "minecraft-runtime" : category === "computerControl" ? "computer-control" : category;
  return request<{ settings: UserSettings }>(`/settings/${serverCategory}`, {
    method: "PUT",
    body: JSON.stringify(value),
    keepalive: true
  });
}

export interface ConversationMemorySnapshot { memories: string[]; revision: number }

export function loadConversationMemories(): Promise<{ snapshot: ConversationMemorySnapshot }> {
  return request("/settings/memories");
}

export function saveConversationMemories(snapshot: ConversationMemorySnapshot): Promise<{ snapshot: ConversationMemorySnapshot }> {
  return request("/settings/memories", { method: "PUT", body: JSON.stringify(snapshot) });
}

export function deleteConversationMemories(): Promise<void> {
  return request<void>("/settings/memories", { method: "DELETE" });
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

export function loadManagedPlugins(): Promise<{ profile: string; plugins: ManagedPluginRecord[] }> {
  return request("/plugins");
}

export function loadCapabilityInstallCatalog(): Promise<{ capabilities: CapabilityInstallCatalogEntry[] }> {
  return request("/capabilities/catalog");
}

export function searchManagedPlugins(query: string): Promise<{ candidates: ManagedPluginCandidate[] }> {
  return request("/plugins/search", { method: "POST", body: JSON.stringify({ query }) });
}

export function inspectManagedPlugin(repositoryUrl: string, ref?: string): Promise<{ plugin: ManagedPluginInspection }> {
  return request("/plugins/inspect", { method: "POST", body: JSON.stringify({ repositoryUrl, ...(ref ? { ref } : {}) }) });
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

export function submitAiMessageFeedback(sessionId: string, messageId: string, feedback: AiMessageFeedbackInput): Promise<{ feedback: AiMessageFeedback }> {
  return request<{ feedback: AiMessageFeedback }>(`/ai/sessions/${encodeURIComponent(sessionId)}/messages/${encodeURIComponent(messageId)}/feedback`, { method: "POST", body: JSON.stringify(feedback) });
}

export function forkAiSessionFromMessage(sessionId: string, messageId: string): Promise<{ session: AiSession }> {
  return request<{ session: AiSession }>(`/ai/sessions/${encodeURIComponent(sessionId)}/fork`, { method: "POST", body: JSON.stringify({ messageId }) });
}

export function forkAiSessionBeforeUserMessage(sessionId: string, messageId: string): Promise<{ session: AiSession }> {
  return request<{ session: AiSession }>(`/ai/sessions/${encodeURIComponent(sessionId)}/fork-before-message`, { method: "POST", body: JSON.stringify({ messageId }) });
}

export function forkAiSessionFromMessageInWorktree(sessionId: string, messageId: string, targetProjectId: string, appId: WorkspaceProjectApplicationId): Promise<{ session: AiSession }> {
  return request<{ session: AiSession }>(`/workspace/sessions/${encodeURIComponent(sessionId)}/fork`, { method: "POST", body: JSON.stringify({ appId, messageId, targetProjectId }) });
}

export function openAiSideChatSession(sourceSessionId: string): Promise<{ session: AiSession }> {
  return request<{ session: AiSession }>(`/ai/sessions/${encodeURIComponent(sourceSessionId)}/side-chat`, { method: "POST" });
}

export function archiveAiSession(sessionId: string, archived: boolean): Promise<{ session: AiSession }> {
  return request<{ session: AiSession }>(`/ai/sessions/${encodeURIComponent(sessionId)}/archive`, { method: "PATCH", body: JSON.stringify({ archived }) });
}

export function setAiSessionProject(sessionId: string, projectId: string | null, appId: WorkspaceProjectApplicationId): Promise<{ session: AiSession }> {
  return request<{ session: AiSession }>(`/workspace/sessions/${encodeURIComponent(sessionId)}/project`, { method: "PATCH", body: JSON.stringify({ appId, projectId }) });
}

export function setAiSessionPlanMode(sessionId: string, active: boolean): Promise<{ session: AiSession }> {
  return request<{ session: AiSession }>(`/ai/sessions/${encodeURIComponent(sessionId)}/plan-mode`, { method: "PATCH", body: JSON.stringify({ active }) });
}

export function loadWorkspaceProjects(options: { appId?: WorkspaceProjectApplicationId; query?: string; signal?: AbortSignal } = {}): Promise<{ projects: WorkspaceProject[]; nodes: WorkspaceDaemonNode[]; truncated: boolean }> {
  const parameters = new URLSearchParams();
  if (options.appId) parameters.set("appId", options.appId);
  if (options.query?.trim()) parameters.set("query", options.query.trim());
  const suffix = parameters.size ? `?${parameters.toString()}` : "";
  return request<{ projects: WorkspaceProject[]; nodes: WorkspaceDaemonNode[]; truncated: boolean }>(`/workspace/projects${suffix}`, options.signal ? { signal: options.signal } : {});
}

export function loadKnowledgeLibrary(applicationId?: ApplicationId): Promise<{ items: KnowledgeLibraryItemSummary[]; sources: KnowledgeLibraryProjectSource[]; usage: KnowledgeLibraryUsage }> {
  const suffix = applicationId ? `?applicationId=${encodeURIComponent(applicationId)}` : "";
  return request<{ items: KnowledgeLibraryItemSummary[]; sources: KnowledgeLibraryProjectSource[]; usage: KnowledgeLibraryUsage }>(`/knowledge/items${suffix}`);
}

export function loadKnowledgeLibraryItem(id: string, applicationId: ApplicationId): Promise<{ item: KnowledgeLibraryItem }> {
  return request<{ item: KnowledgeLibraryItem }>(`/knowledge/items/${encodeURIComponent(id)}?applicationId=${encodeURIComponent(applicationId)}`);
}

export function createKnowledgeLibraryItem(input: { applicationId: KnowledgeLibraryScope; kind: KnowledgeLibraryKind; title: string; description: string; contentMarkdown: string; sourceKind: "upload" | "manual" }): Promise<{ item: KnowledgeLibraryItem }> {
  return request<{ item: KnowledgeLibraryItem }>("/knowledge/items", { method: "POST", body: JSON.stringify(input) });
}

export function updateKnowledgeLibraryItem(id: string, input: { applicationId: ApplicationId; title: string; description: string; contentMarkdown: string; expectedContentSha256: string }): Promise<{ item: KnowledgeLibraryItem }> {
  return request<{ item: KnowledgeLibraryItem }>(`/knowledge/items/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function removeKnowledgeLibraryItem(id: string): Promise<void> {
  return request<void>(`/knowledge/items/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function createKnowledgeLibraryProjectSource(input: { applicationId: WorkspaceProjectApplicationId; projectId: string; projectApplicationId: WorkspaceProjectApplicationId; relativePath: string; title: string }): Promise<{ source: KnowledgeLibraryProjectSource }> {
  return request<{ source: KnowledgeLibraryProjectSource }>("/knowledge/sources", { method: "POST", body: JSON.stringify(input) });
}

export function removeKnowledgeLibraryProjectSource(id: string): Promise<void> {
  return request<void>(`/knowledge/sources/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function browseWorkspaceDirectory(appId: WorkspaceProjectApplicationId, nodeId: string, operation: "home" | "list" | "create-directory", path?: string, name?: string): Promise<{ result: { path: string; root?: string; home?: string; roots?: string[]; entries?: string[]; truncated?: boolean; created?: boolean; name?: string } }> {
  return request<{ result: { path: string; root?: string; home?: string; roots?: string[]; entries?: string[]; truncated?: boolean; created?: boolean; name?: string } }>("/workspace/projects/browse", { method: "POST", body: JSON.stringify({ appId, nodeId, operation, ...(path ? { path } : {}), ...(name ? { name } : {}) }) });
}

export function createWorkspaceProject(appId: WorkspaceProjectApplicationId, nodeId: string, path: string, title: string): Promise<{ project: WorkspaceProject }> {
  return request<{ project: WorkspaceProject }>("/workspace/projects", { method: "POST", body: JSON.stringify({ appId, nodeId, path, title }) });
}

export function renameWorkspaceProject(projectId: string, title: string, appId: WorkspaceProjectApplicationId): Promise<{ project: WorkspaceProject }> {
  return request<{ project: WorkspaceProject }>(`/workspace/projects/${encodeURIComponent(projectId)}`, { method: "PATCH", body: JSON.stringify({ appId, title }) });
}

export function removeWorkspaceProject(projectId: string, deleteManagedWorktree: boolean, appId: WorkspaceProjectApplicationId): Promise<void> {
  return request<void>(`/workspace/projects/${encodeURIComponent(projectId)}`, { method: "DELETE", body: JSON.stringify({ appId, deleteManagedWorktree }) });
}

export function loadWorkspaceGitStatus(projectId: string, appId: WorkspaceProjectApplicationId): Promise<{ status: WorkspaceGitStatus }> {
  return request<{ status: WorkspaceGitStatus }>(`/workspace/projects/${encodeURIComponent(projectId)}/git/status`, { method: "POST", body: JSON.stringify({ appId }) });
}

export function loadWorkspaceGitFileDiff(projectId: string, appId: WorkspaceProjectApplicationId, path: string, options: { ignoreWhitespace?: boolean; wordDiff?: boolean } = {}): Promise<{ file: WorkspaceGitFileDiff }> {
  return request<{ file: WorkspaceGitFileDiff }>(`/workspace/projects/${encodeURIComponent(projectId)}/git/file-diff`, { method: "POST", body: JSON.stringify({ appId, path, ignoreWhitespace: options.ignoreWhitespace === true, wordDiff: options.wordDiff === true }) });
}

export function readWorkspaceProjectTextFile(projectId: string, appId: WorkspaceProjectApplicationId, path: string, offset = 0, limit = 40000): Promise<{ file: WorkspaceProjectTextFile }> {
  return request<{ file: WorkspaceProjectTextFile }>(`/workspace/projects/${encodeURIComponent(projectId)}/files/read`, { method: "POST", body: JSON.stringify({ appId, path, offset, limit }) });
}

export function writeWorkspaceProjectTextFile(projectId: string, appId: WorkspaceProjectApplicationId, path: string, content: string, sha256: string): Promise<{ result: { path: string; sha256: string; changed: boolean; bytes: number } }> {
  return request<{ result: { path: string; sha256: string; changed: boolean; bytes: number } }>(`/workspace/projects/${encodeURIComponent(projectId)}/files/write`, { method: "POST", body: JSON.stringify({ appId, path, content, sha256 }) });
}

export function createWorkspaceGitWorktree(projectId: string, appId: WorkspaceProjectApplicationId): Promise<{ project: WorkspaceProject }> {
  return request<{ project: WorkspaceProject }>(`/workspace/projects/${encodeURIComponent(projectId)}/git/worktrees`, { method: "POST", body: JSON.stringify({ appId }) });
}

export function resetWorkspaceGitWorktree(projectId: string, appId: WorkspaceProjectApplicationId): Promise<{ status: WorkspaceGitStatus }> {
  return request<{ status: WorkspaceGitStatus }>(`/workspace/projects/${encodeURIComponent(projectId)}/git/reset`, { method: "POST", body: JSON.stringify({ appId }) });
}

export function loadWritingWorkspace(): Promise<{ workspace: WritingWorkspace }> {
  return request<{ workspace: WritingWorkspace }>("/writing/workspace");
}

export function downloadWritingBookDeepWriteZip(bookId: string): Promise<Blob> {
  return requestBinary(`/writing/books/${encodeURIComponent(bookId)}/deepwrite.zip`);
}

export function importWritingBookDeepWriteZip(file: File): Promise<{ workspace: WritingWorkspace }> {
  return request<{ workspace: WritingWorkspace }>("/writing/import/deepwrite.zip", {
    method: "POST",
    headers: { "Content-Type": "application/zip" },
    body: file
  });
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

export function saveWritingBookRole(bookId: string, roleId: WritingSpecialistId): Promise<{ workspace: WritingWorkspace }> {
  return request<{ workspace: WritingWorkspace }>(`/writing/books/${encodeURIComponent(bookId)}/ai-profile`, { method: "PATCH", body: JSON.stringify({ roleId }) });
}

export function listWritingBookSkills(bookId: string): Promise<{ skills: WritingBookSkillSummary[] }> {
  return request<{ skills: WritingBookSkillSummary[] }>(`/writing/books/${encodeURIComponent(bookId)}/skills`);
}

export function loadWritingBookSkill(bookId: string, skillId: string): Promise<{ skill: WritingBookSkill }> {
  return request<{ skill: WritingBookSkill }>(`/writing/books/${encodeURIComponent(bookId)}/skills/${encodeURIComponent(skillId)}`);
}

export function saveWritingBookSkill(bookId: string, input: { id?: string; title: string; description: string; instructions: string; enabled: boolean }): Promise<{ skill: WritingBookSkill; workspace: WritingWorkspace }> {
  const method = input.id ? "PATCH" : "POST";
  const path = input.id ? `/writing/books/${encodeURIComponent(bookId)}/skills/${encodeURIComponent(input.id)}` : `/writing/books/${encodeURIComponent(bookId)}/skills`;
  return request<{ skill: WritingBookSkill; workspace: WritingWorkspace }>(path, { method, body: JSON.stringify({ title: input.title, description: input.description, instructions: input.instructions, enabled: input.enabled }) });
}

export function deleteWritingBookSkill(bookId: string, skillId: string): Promise<{ workspace: WritingWorkspace }> {
  return request<{ workspace: WritingWorkspace }>(`/writing/books/${encodeURIComponent(bookId)}/skills/${encodeURIComponent(skillId)}`, { method: "DELETE" });
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

export function listWritingCatalogEntries(bookId: string, kind: WritingCatalogKind, offset = 0, search = ""): Promise<{ page: WritingCatalogPage }> {
  const query = new URLSearchParams({ kind, offset: String(offset) });
  if (search) query.set("search", search);
  return request<{ page: WritingCatalogPage }>(`/writing/books/${encodeURIComponent(bookId)}/catalog?${query.toString()}`);
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

export function loadWritingEditProposal(proposalId: string): Promise<{ proposal: WritingEditProposal }> {
  return request<{ proposal: WritingEditProposal }>(`/writing/proposals/${encodeURIComponent(proposalId)}`);
}

export function applyWritingEditProposal(proposalId: string): Promise<{ proposal: { id: string; status: WritingEditProposal["status"] } }> {
  return request<{ proposal: { id: string; status: WritingEditProposal["status"] } }>(`/writing/proposals/${encodeURIComponent(proposalId)}/apply`, { method: "POST", body: JSON.stringify({}) });
}

export function rejectWritingEditProposal(proposalId: string): Promise<{ proposal: { id: string; status: WritingEditProposal["status"] } }> {
  return request<{ proposal: { id: string; status: WritingEditProposal["status"] } }>(`/writing/proposals/${encodeURIComponent(proposalId)}/reject`, { method: "POST", body: JSON.stringify({}) });
}

export function loadAiUsage(): Promise<{ usage: AiUsageSummary }> {
  return request<{ usage: AiUsageSummary }>("/ai/usage");
}

/** 显式停止后台 Agent；断开流式连接只结束订阅。 */
export function cancelAiRun(runId: string): Promise<unknown> { return request(`/ai/runs/${encodeURIComponent(runId)}/cancel`, { method: "POST" }); }

export function appendAiRunInput(runId: string, content: string): Promise<{ mode: "queue" | "steer"; run: { id: string; message: AiMessage }; userMessage: AiMessage }> { return request(`/ai/runs/${encodeURIComponent(runId)}/input`, { method: "POST", body: JSON.stringify({ content }) }); }

/** 回答已暂停的模型澄清问题；服务端将答案绑定当前 run 并写入会话。 */
export function answerAiRunQuestion(runId: string, questionId: string, answer: string, skipped = false): Promise<{ mode: "answered"; userMessage: AiMessage }> {
  return request(`/ai/runs/${encodeURIComponent(runId)}/answer`, { method: "POST", body: JSON.stringify({ questionId, answer, skipped }) });
}

type AiChatStreamInput = {
  runId?: string;
  appId: ApplicationId;
  sessionId: string | null;
  projectId?: string | null;
  content: string;
  planMode?: boolean;
  signal: AbortSignal;
  onSession: (value: { session: AiSession; userMessage: AiMessage; assistantMessage: AiMessage }) => void;
  onPlanMode?: (active: boolean) => void;
  onInput?: (message: AiMessage) => void;
  onActivity: (value: { messageId: string; activity: AiActivityItem }) => void;
  onDelta: (value: { messageId: string; delta: string }) => void;
  onUsage: (value: { messageId: string; promptTokens: number | null; completionTokens: number | null; providerId: string; modelId: string }) => void;
  onError: (message: string) => void;
  onDone: (status: "complete" | "interrupted" | "error") => void;
};

export function streamAiChat(input: AiChatStreamInput): Promise<void> {
  return streamAiChatAt(input, "/api/ai/chat/stream");
}

export function streamAiSideChat(input: AiChatStreamInput): Promise<void> {
  return streamAiChatAt(input, "/api/ai/side-chat/stream");
}

async function streamAiChatAt(input: AiChatStreamInput, streamEndpoint: string): Promise<void> {
  const response = await fetch(input.runId ? `/api/ai/runs/${encodeURIComponent(input.runId)}/events` : streamEndpoint, {
    method: input.runId ? "GET" : "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    ...(!input.runId ? { body: JSON.stringify({ appId: input.appId, sessionId: input.sessionId, ...(input.projectId ? { projectId: input.projectId } : {}), ...(input.planMode === undefined ? {} : { planMode: input.planMode }), content: input.content }) } : {}),
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
  const deltas = createStreamDeltas(input.onDelta);
  const cancelDeltas = () => deltas.dispose();
  input.signal.addEventListener("abort", cancelDeltas, { once: true });
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "message";
  let dataLines: string[] = [];
  const dispatch = () => {
    if (dataLines.length === 0) { eventName = "message"; return; }
    let payload: Record<string, unknown>;
    try { payload = JSON.parse(dataLines.join("\n")) as Record<string, unknown>; }
    catch { eventName = "message"; dataLines = []; return; }
    if (input.signal.aborted) { eventName = "message"; dataLines = []; return; }
    if (eventName !== "delta") deltas.flush();
    if (eventName === "input" && payload.userMessage) input.onInput?.(payload.userMessage as AiMessage);
    if (eventName === "session") input.onSession(payload as unknown as Parameters<typeof input.onSession>[0]);
    if (eventName === "plan-mode" && typeof payload.active === "boolean") input.onPlanMode?.(payload.active);
    if (eventName === "activity" && typeof payload.messageId === "string" && typeof payload.activity === "object" && payload.activity !== null) {
      input.onActivity({ messageId: payload.messageId, activity: payload.activity as AiActivityItem });
    }
    if (eventName === "delta" && typeof payload.messageId === "string" && typeof payload.delta === "string") deltas.push({ messageId: payload.messageId, delta: payload.delta });
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
    }
    dispatch();
  } finally {
    try { if (!input.signal.aborted) deltas.flush(); }
    finally {
      deltas.dispose();
      input.signal.removeEventListener("abort", cancelDeltas);
      reader.releaseLock();
    }
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

export interface DaemonCredentialSummary { nodeId: string; displayName: string; revoked: boolean }
export function loadDaemonCredentials(): Promise<{ nodes: DaemonCredentialSummary[] }> {
  return request("/daemon-nodes/credentials");
}
export function issueDaemonConnection(displayName: string, controlPlaneUrl: string, nodeId?: string): Promise<{ nodeId: string; displayName: string }> {
  return request("/daemon-nodes/credentials", { method: "POST", body: JSON.stringify({ displayName, controlPlaneUrl, nodeId }) });
}
export function revokeDaemonConnection(nodeId: string): Promise<void> {
  return request(`/daemon-nodes/credentials/${encodeURIComponent(nodeId)}`, { method: "DELETE" });
}
