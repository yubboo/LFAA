import type { AgentAssociations } from "lfaa-util-values/src/agent-associations.js";
export type { AgentAssociations } from "lfaa-util-values/src/agent-associations.js";
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
import type { BrowserProviderId } from "lfaa-util-values/src/browser-provider.js";
import type { TypertRemoteCallOptions, TypertRemoteClientContract } from "lfaa-typert-protocol/src/index.js";
import { accountControllerRemoteMethods, type AccountControllerRemoteContract } from "lfaa-api-account-controller/src/client-contract.generated.js";

export type { ApplicationId } from "lfaa-util-values/src/application-id.js";
export type { BrowserProviderId } from "lfaa-util-values/src/browser-provider.js";
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

import type { UserSettings } from "lfaa-util-values/src/settings-contract.js";
export type { UserSettings, BrowserUseSettings, AppearanceFonts, AppearanceModeStyle, AppearanceAdvancedSettings, AppearanceSettings, AppearanceTextFont, AppearanceCodeFont } from "lfaa-util-values/src/settings-contract.js";
export { DEFAULT_APPEARANCE_ADVANCED_SETTINGS } from "lfaa-util-values/src/settings-contract.js";

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

export interface BrowserProviderSummary {
  id: BrowserProviderId;
  name: string;
  available: boolean;
  reason?: string;
  isolation: "app-session" | "new-profile" | "user-profile";
}
export interface BrowserTabSummary { tabId: number; title: string; url: string; active: boolean; state: string }
export interface BrowserSessionSnapshot {
  sessionId: string;
  providerId: BrowserProviderId;
  revision: number;
  url: string;
  title: string;
  loading: boolean;
  pageText: string;
  controls: Array<{ role: string; name: string; type?: string; disabled: boolean }>;
  tabs: Array<{ id: string; title: string; url: string; active: boolean }>;
  viewport?: { width: number; height: number } | null;
  screenshot: { mimeType: "image/jpeg"; dataBase64: string; width: number; height: number } | null;
}
export interface BrowserRevision { revision: number; url: string; title: string }
export interface BrowserRecentSite { url: string; visitedAt: string }
export interface NativeBrowserTab {
  id: string;
  targetId: string;
  title: string;
  url: string;
  loading: boolean;
  error: string | null;
  canGoBack: boolean;
  canGoForward: boolean;
  zoomFactor: number;
  active: boolean;
}
export interface NativeBrowserState { tabs: NativeBrowserTab[]; activeTabId: string | null; visible: boolean }
export interface NativeBrowserInspection {
  url: string;
  title: string;
  text: string;
  controls: Array<{ role: string; name: string; type: string; disabled: boolean }>;
}

export interface AiModel {
  id: string;
  name: string;
  versionTag?: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  thinking: AiModelThinkingControl | null;
  thinkingSource: "provider-model-catalog" | null;
}

export interface LocalModelSummary {
  id: string;
  name: string;
  family: string;
  modality: "text" | "image" | "video" | "audio";
  task: string;
  repository: string;
  licenseName: string;
  licenseUrl: string;
  directory: string;
  estimatedDownloadBytes: number | null;
  installedBytes: number;
  installed: boolean;
  loaded: boolean;
  ready: boolean;
  reason: string | null;
}

export interface LocalModelDownloadSnapshot {
  id: string;
  modelId: string;
  status: "queued" | "downloading" | "completed" | "failed" | "cancelled";
  receivedBytes: number;
  totalBytes: number | null;
  completedFiles: number;
  totalFiles: number | null;
  message: string | null;
  startedAt: string;
  updatedAt: string;
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
  /** Stable SkillRegistry key for skill entries; used by Settings to toggle the same capability. */
  skillId?: string;
  applicationIds?: ApplicationId[];
  toolPolicy?: { risk: "read" | "write" | "dangerous"; workspaceBound: boolean };
}

export interface AiRuntimeHookInfo {
  id: string;
  events: Array<"beforeInference" | "afterInference" | "requestRoute">;
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
  source: { kind?: "github" | "npm" | "local"; repository: string; requestedRef: string; commit: string; archiveSha256: string; license: string | null };
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
  sourceType: "github" | "npm" | "local";
  sourceLocation: string;
  registryUrl: string | null;
  repository: { owner: string; name: string; fullName: string; description: string; stars: number; license: string | null; defaultBranch: string; url: string };
  requestedRef: string;
  resolvedRef: string;
  resolvedCommit: string;
  archiveSha256: string;
  requirements: {
    dshVersion: string | null;
    hostEntry: string | null;
    bundlePatch: string | string[] | null;
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

export interface ManagedPluginInstallProgress {
  stage: "resolving" | "source-verified" | "compatibility-checked" | "writing-files" | "committing-inventory" | "already-installed" | "installed";
  message: string;
  pluginId?: string;
  name?: string;
  version?: string;
  sourceType?: "github" | "npm" | "local";
  resolvedRef?: string;
  archiveSha256?: string;
  fileCount?: number;
  totalBytes?: number;
  state?: ManagedPluginRecord["state"];
}

export interface AiSession {
  associations?: AgentAssociations;
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

export interface AiSessionBranchSource {
  title: string;
  session: AiSession | null;
}

export type WorkspaceProjectApplicationId = "workspace" | "minecraft";

export interface WorkspaceProject {
  id: string;
  userId: string;
  appId: WorkspaceProjectApplicationId | null;
  nodeId: string | null;
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
  local?: boolean;
}

export interface WorkspaceGitStatus {
  repositoryState: "not-repository" | "unborn" | "ready";
  repository: string | null;
  projectRelativePath: string;
  worktreeId: string | null;
  branch: string;
  upstream: string | null;
  ahead: number;
  behind: number;
  remotes: string[];
  authenticatedRemotes?: string[];
  credentialCapableRemotes?: string[];
  syncCapableRemotes?: string[];
  head: string | null;
  baseline: string | null;
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

export interface AgentGitRepository {
  id: string;
  userId: string;
  path: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceGitCommit {
  hash: string;
  shortHash: string;
  subject: string;
  author: string;
  authoredAt: string;
  parents: string[];
}

export interface WorkspaceGitBranch {
  name: string;
  head: string;
  current: boolean;
}

export type WorkspaceGitOperationInput =
  | { operation: "stage" | "unstage"; paths?: string[] }
  | { operation: "commit"; message: string }
  | { operation: "history"; limit?: number }
  | { operation: "branches" }
  | { operation: "branch-create" | "branch-switch" | "branch-delete"; branch: string }
  | { operation: "fetch"; remote?: string }
  | { operation: "pull" | "push" }
  | { operation: "push-upstream" | "remote-remove"; remote: string }
  | { operation: "remote-add"; remote: string; url: string; username?: string; token?: string };

export type WorkspaceGitOperationResult =
  | { status: WorkspaceGitStatus }
  | { commits: WorkspaceGitCommit[] }
  | { branches: WorkspaceGitBranch[]; head: string | null };

export function loadAgentGitRepositories(signal?: AbortSignal): Promise<{ repositories: AgentGitRepository[] }> {
  return request("/agent/git/repositories", signal ? { signal } : {});
}

export function registerAgentGitRepository(path: string, title = ""): Promise<{ repository: AgentGitRepository }> {
  return request("/agent/git/repositories", { method: "POST", body: JSON.stringify({ path, title }) });
}

export function removeAgentGitRepository(repositoryId: string): Promise<void> {
  return request(`/agent/git/repositories/${encodeURIComponent(repositoryId)}`, { method: "DELETE" });
}

export function loadAgentGitSessionRepository(sessionId: string): Promise<{ repository: AgentGitRepository | null }> {
  return request(`/agent/git/sessions/${encodeURIComponent(sessionId)}/repository`);
}

export function ensureAgentGitSessionRepository(sessionId: string): Promise<{ repository: AgentGitRepository | null }> {
  return request(`/agent/git/sessions/${encodeURIComponent(sessionId)}/repository/ensure`, { method: "POST" });
}

export function bindAgentGitSessionRepository(sessionId: string, repositoryId: string | null): Promise<{ repository: AgentGitRepository | null }> {
  return request(`/agent/git/sessions/${encodeURIComponent(sessionId)}/repository`, { method: "PUT", body: JSON.stringify({ repositoryId }) });
}

export function loadAgentGitStatus(repositoryId: string, signal?: AbortSignal): Promise<{ status: WorkspaceGitStatus }> {
  return request(`/agent/git/repositories/${encodeURIComponent(repositoryId)}/status`, { method: "POST", ...(signal ? { signal } : {}) });
}

export function loadAgentGitFileDiff(repositoryId: string, path: string, options: { ignoreWhitespace?: boolean; wordDiff?: boolean; contextLines?: number; signal?: AbortSignal } = {}): Promise<{ diff: WorkspaceGitFileDiff }> {
  const { signal, ...parameters } = options;
  return request(`/agent/git/repositories/${encodeURIComponent(repositoryId)}/file-diff`, { method: "POST", body: JSON.stringify({ path, ...parameters }), ...(signal ? { signal } : {}) });
}

export function loadAgentGitFile(repositoryId: string, path: string, options: { offset?: number; limit?: number } = {}): Promise<{ file: WorkspaceProjectTextFile }> {
  return request(`/agent/git/repositories/${encodeURIComponent(repositoryId)}/file`, { method: "POST", body: JSON.stringify({ operation: "read", path, ...options }) });
}

export function saveAgentGitFile(repositoryId: string, path: string, content: string, sha256: string): Promise<{ file: WorkspaceProjectTextFile }> {
  return request(`/agent/git/repositories/${encodeURIComponent(repositoryId)}/file`, { method: "POST", body: JSON.stringify({ operation: "write", path, content, sha256 }) });
}

export function initializeAgentGitRepository(repositoryId: string): Promise<{ status: WorkspaceGitStatus }> {
  return request(`/agent/git/repositories/${encodeURIComponent(repositoryId)}/initialize`, { method: "POST" });
}

export function runAgentGitOperation(repositoryId: string, input: WorkspaceGitOperationInput): Promise<WorkspaceGitOperationResult> {
  return request(`/agent/git/repositories/${encodeURIComponent(repositoryId)}/operation`, { method: "POST", body: JSON.stringify(input) });
}

export function saveAgentGitRemoteCredential(repositoryId: string, remote: string, username: string, token: string): Promise<void> {
  return request(`/agent/git/repositories/${encodeURIComponent(repositoryId)}/remotes/${encodeURIComponent(remote)}/credential`, {
    method: "PUT", body: JSON.stringify({ username, token })
  });
}

export function removeAgentGitRemoteCredential(repositoryId: string, remote: string): Promise<void> {
  return request(`/agent/git/repositories/${encodeURIComponent(repositoryId)}/remotes/${encodeURIComponent(remote)}/credential`, { method: "DELETE" });
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

export type { TerminalInfo } from "lfaa-api-terminal-controller/src/protocol.js";
export interface TerminalNode { id: string; displayName: string; connected: boolean }
export interface CreateTerminalInput { id: string; nodeId: string; appId: ApplicationId; sessionId?: string | null; approvalId?: string; cols: number; rows: number }
export function loadTerminalNodes(): Promise<{ nodes: TerminalNode[] }> { return request("/terminals/nodes"); }
export function createTerminal(input: CreateTerminalInput, signal?: AbortSignal): Promise<{ terminal?: import("lfaa-api-terminal-controller/src/protocol.js").TerminalInfo; approval?: AiToolApproval }> {
  return request("/terminals", { method: "POST", body: JSON.stringify(input), signal });
}
export function sendTerminalInput(id: string, data: string): Promise<void> { return request(`/terminals/${encodeURIComponent(id)}/input`, { method: "POST", body: JSON.stringify({ data }) }); }
export function resizeTerminal(id: string, cols: number, rows: number): Promise<void> { return request(`/terminals/${encodeURIComponent(id)}/resize`, { method: "POST", body: JSON.stringify({ cols, rows }) }); }
export function closeTerminal(id: string): Promise<void> { return request(`/terminals/${encodeURIComponent(id)}`, { method: "DELETE" }); }

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
  usage?: AiMessageUsage;
  parts?: AiReplyPart[];
  feedback?: AiMessageFeedback;
}

export interface AiMessageUsage {
  providerId: string;
  modelId: string;
  promptTokens: number | null;
  completionTokens: number | null;
  cacheReadTokens: number | null;
  models?: Array<{ providerId: string; modelId: string; requestCount: number }>;
}

export interface AiSessionUsageModelSummary {
  providerId: string;
  modelId: string;
  requestCount: number;
  requestCountExact: boolean;
  promptTokens: number | null;
  completionTokens: number | null;
  cacheReadTokens: number | null;
  cacheReadReportedTokens: number | null;
  /** Number of requests for which the Provider returned an exact cache-read count; null for older projections. */
  cacheReadReportedRequestCount: number | null;
}

export interface AiSessionUsageSummary {
  requestCount: number;
  requestCountExact: boolean;
  promptTokens: number | null;
  completionTokens: number | null;
  cacheReadTokens: number | null;
  models: AiSessionUsageModelSummary[];
}

export interface AiContextUsage {
  providerId: string;
  modelId: string;
  contextWindow: number | null;
  contextWindowSource: "model-catalog" | "settings-fallback" | "unknown";
  promptTokens: number | null;
  estimatedPromptTokens: number;
  systemTokens: number;
  toolsTokens: number;
  messageTokens: number;
  includesImages: boolean;
}

export interface AiMessagePage {
  messages: AiMessage[];
  nextCursor: string | null;
  branchSource?: AiSessionBranchSource;
  usageSummary: AiSessionUsageSummary;
  contextUsage: AiContextUsage | null;
}

/** 同一任务各次模型可见正文的范围，正文仍只有一份。 */
export interface AiReplyPart { id: string; start: number; end: number; kind: "commentary" | "final" }
export interface AiTextDelta { messageId: string; delta: string; partId?: string; partStart?: number }

/** SSE 帧合并后的更新仍按请求分段；老服务未提供边界时保留原显示。 */
export function appendAiTextDelta(message: AiMessage, value: AiTextDelta): AiMessage {
  const content = message.content + value.delta;
  if (!value.partId || !Number.isSafeInteger(value.partStart)) return { ...message, content };
  const parts = (message.parts ?? []).map(part => ({ ...part }));
  const part = parts.find(item => item.id === value.partId);
  if (part) part.end = content.length;
  else parts.push({ id: value.partId, start: value.partStart!, end: content.length, kind: "commentary" });
  return { ...message, content, parts };
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
  approvalQuestion?: string;
  approvalAnswer?: "approved" | "denied" | "expired";
  questionId?: string;
  question?: string;
  options?: string[];
  writingProposalId?: string;
  fileChanges?: AiActivityFileChange[];
  contentOffset?: number;
}

export interface AiActivityFileChange {
  operation: "read" | "created" | "modified" | "deleted";
  path: string;
  projectId: string | null;
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
  kind: "install" | "start" | "stop" | "properties" | "backup" | "java-install" | "restart" | "console" | "delete";
  status: "queued" | "running" | "succeeded" | "failed";
  progress: number;
  message: string;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface MinecraftTaskDetails {
  task: MinecraftTask;
  logs: MinecraftLog[];
  logsTruncated: boolean;
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
  kind: "install" | "verify" | "install-server" | "update-server" | "start-server" | "stop-server";
  status: "queued" | "running" | "succeeded" | "failed";
  progress: number;
  message: string;
  result: Record<string, unknown> | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface SteamcmdServer {
  id: string;
  nodeId: string;
  createdBy: string;
  name: string;
  toolAppId: number;
  installDirectory: string;
  executablePath: string;
  launchArguments: string[];
  stopCommand: string;
  stopTimeoutSeconds: number;
  eulaAccepted: boolean;
  installationStatus: "unknown" | "installing" | "installed" | "failed";
  status: "unknown" | "stopped" | "running" | "starting" | "stopping";
  processId: number | null;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SteamcmdServerInput {
  nodeId: string;
  name: string;
  toolAppId: number;
  installDirectory: string;
  executablePath: string;
  launchArguments: string[];
  stopCommand: string;
  stopTimeoutSeconds: number;
  eulaAccepted: boolean;
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
  defaultDirectory: string;
  recommendedDirectory: string;
  selection: "default" | "recommended" | "custom";
  configured: boolean;
  currentDirectory: string;
  pendingDirectory: string | null;
  pendingMode: "copy" | "adopt" | "archive" | null;
  pendingArchivePath: string | null;
  pendingError: string | null;
  editable: boolean;
  unavailableReason: string | null;
}

export interface ProjectStorageLocations {
  contentDirectory: string;
  defaultContentDirectory: string;
  recommendedContentDirectory: string;
  logsDirectory: string;
  writingDirectory: string;
  dramaDirectory: string;
  runtimeDirectory: string;
  downloadCacheDirectory: string;
  temporaryDirectory: string;
  businessDirectories: Array<{ name: string; path: string }>;
  restartRequired: boolean;
  dataDirectoryExternallyManaged: boolean;
  changeUnavailableReason: string | null;
}

export interface ProjectContentComparison {
  sourceDirectory: string;
  targetDirectory: string;
  sourceEntryCount: number;
  targetEntryCount: number;
  sourceFileCount: number;
  targetFileCount: number;
  sourceBytes: number;
  targetBytes: number;
  matching: boolean;
  differenceCount: number;
  differences: Array<{ path: string; kind: "missing" | "extra" | "type" | "size" | "hash" }>;
}

export interface ProjectContentMigrationResult {
  sourceDirectory: string;
  targetDirectory: string;
  copiedFiles: number;
  copiedBytes: number;
  backupDirectory: string | null;
  comparison: ProjectContentComparison;
  settings: { settings: ProjectStorageLocations; configured: boolean };
}

export interface DesktopUpdateRuntimeInfo {
  supported: boolean;
  currentVersion: string;
}

export interface DesktopUpdatePreferences {
  autoDownloadAndInstall: boolean;
}

export interface DesktopUpdateDownloadProgress {
  version: string;
  phase: "starting" | "downloading" | "cancelling";
  transferredBytes: number;
  totalBytes: number | null;
  percent: number | null;
  bytesPerSecond: number;
}

export interface DesktopAvailableUpdate {
  version: string;
  publishedAt: string;
  releaseNotes: string[];
}

export type DesktopUpdatePromptAction = "accept" | "defer" | "skip" | "install" | "later" | "dismiss";

export type DesktopUpdatePrompt =
  | {
      requestId: string;
      kind: "download" | "install";
      version: string;
      publishedAt: string;
      releaseNotes: string[];
      mandatory: boolean;
    }
  | {
      requestId: string;
      kind: "notice";
      title: string;
      message: string;
      detail?: string;
    };

export interface DesktopUpdateCheckResult {
  status: "unsupported" | "disabled" | "up-to-date" | "available" | "deferred" | "ignored" | "downloading" | "downloaded" | "error";
  currentVersion: string;
  latestVersion?: string;
  releaseNotes?: string[];
  message?: string;
}

declare global {
  interface Window {
    lfaaDesktop?: {
      nativeBrowser: {
        getState: () => Promise<NativeBrowserState>;
        ensureTab: () => Promise<NativeBrowserState>;
        createTab: (url?: string) => Promise<NativeBrowserState>;
        selectTab: (id: string) => Promise<NativeBrowserState>;
        closeTab: (id: string) => Promise<NativeBrowserState>;
        navigate: (id: string, url: string) => Promise<NativeBrowserState>;
        back: (id: string) => Promise<NativeBrowserState>;
        forward: (id: string) => Promise<NativeBrowserState>;
        reload: (id: string) => Promise<NativeBrowserState>;
        stop: (id: string) => Promise<NativeBrowserState>;
        copyAddress: (id: string) => Promise<string>;
        find: (id: string, text: string, forward: boolean) => Promise<{ matches: number; activeMatch: number } | NativeBrowserState>;
        inspect: (id: string) => Promise<NativeBrowserInspection>;
        clearData: () => Promise<{ cleared: boolean }>;
        setZoom: (id: string, zoom: number) => Promise<NativeBrowserState>;
        print: (id: string) => Promise<void>;
        setBounds: (bounds: { x: number; y: number; width: number; height: number }) => Promise<void>;
        setVisible: (visible: boolean) => Promise<void>;
        onState: (listener: (state: NativeBrowserState) => void) => () => void;
        onShortcut: (listener: (shortcut: "find" | "address") => void) => () => void;
      };
      selectDataDirectory: () => Promise<string | null>;
      selectWorkspaceDirectory: () => Promise<string | null>;
      getUpdateRuntimeInfo: () => Promise<DesktopUpdateRuntimeInfo>;
      getUpdatePreferences: () => Promise<DesktopUpdatePreferences>;
      setAutoUpdateAndInstall: (enabled: boolean) => Promise<DesktopUpdatePreferences>;
      getUpdateAvailability: () => Promise<DesktopAvailableUpdate | null>;
      getUpdateDownloadProgress: () => Promise<DesktopUpdateDownloadProgress | null>;
      cancelUpdateDownload: () => Promise<boolean>;
      checkForUpdates: () => Promise<DesktopUpdateCheckResult>;
      onUpdateAvailable: (listener: (update: DesktopAvailableUpdate | null) => void) => () => void;
      onUpdateDownloadProgress: (listener: (progress: DesktopUpdateDownloadProgress | null) => void) => () => void;
      onUpdatePrompt: (listener: (prompt: DesktopUpdatePrompt) => void) => () => void;
      updatePromptUiReady: () => Promise<boolean>;
      updatePromptUiNotReady: () => Promise<boolean>;
      respondToUpdatePrompt: (requestId: string, action: DesktopUpdatePromptAction) => Promise<boolean>;
    };
  }
}

import type { ManagedFileEntry, FileManagerOperation, FileOperationInput, FileResourceLocation } from "lfaa-util-values/src/file-manager-contract.js";
export type { ManagedFileEntry, FileManagerOperation, FileResourceLocation };

export interface FileManagerAuditEntry {
  id: string;
  taskId?: string;
  nodeId?: string;
  userId: string;
  username: string;
  operation: string;
  path: string;
  targetPath: string;
  fileName: string;
  succeeded: boolean;
  createdAt: string;
  finishedAt: string;
}

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
let authenticationGeneration = 0;
let pendingAuthenticationCheck: { generation: number; controller: AbortController; promise: Promise<boolean | null> } | null = null;

function isSessionAuthenticationError(status: number, code: string | undefined): boolean {
  return status === 401 && (code === "authentication_required" || code === "invalid_session");
}

function currentUserRemotePath(): string {
  const { namespace, method } = accountControllerRemoteMethods["auth/me"];
  return `/typert/${encodeURIComponent(namespace)}/${encodeURIComponent(method)}`;
}

function isCurrentUserRequest(path: string): boolean {
  return path === currentUserRemotePath() || path === "/auth/me";
}

function advanceAuthenticationGeneration(): void {
  authenticationGeneration += 1;
  pendingAuthenticationCheck?.controller.abort();
  pendingAuthenticationCheck = null;
  pendingReads.clear();
}

function expireCurrentSession(generation: number): void {
  if (generation !== authenticationGeneration || typeof window === "undefined") return;
  advanceAuthenticationGeneration();
  window.dispatchEvent(new Event(sessionExpiredEventName));
}

// 非身份读取返回 401 时先用唯一账户 Remote 核对；并发复核合并，登录代次变化会撤销旧复核。
function checkCurrentSession(generation: number, requestPath: string): void {
  if (generation !== authenticationGeneration || typeof window === "undefined") return;
  pendingReads.clear();
  if (isCurrentUserRequest(requestPath)) {
    expireCurrentSession(generation);
    return;
  }

  if (pendingAuthenticationCheck?.generation === generation) return;
  const controller = new AbortController();
  const promise = fetch(`/api${currentUserRemotePath()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: {} }),
    credentials: "include",
    signal: controller.signal
  }).then(async (response): Promise<boolean | null> => {
    if (response.ok) return true;
    if (response.status !== 401) return null;
    try {
      const body: unknown = await response.json();
      if (typeof body !== "object" || body === null || !("error" in body) || typeof body.error !== "string") return null;
      return body.error === "authentication_required" || body.error === "invalid_session" ? false : null;
    } catch {
      return null;
    }
  }).catch(() => null);
  pendingAuthenticationCheck = { generation, controller, promise };
  void promise.then((valid) => {
    if (valid === false) expireCurrentSession(generation);
  }).finally(() => {
    if (pendingAuthenticationCheck?.promise === promise) pendingAuthenticationCheck = null;
  });
}

function handleSessionAuthenticationFailure(path: string, generation: number): void {
  if (isCurrentUserRequest(path)) expireCurrentSession(generation);
  else checkCurrentSession(generation, path);
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
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

export function loadBrowserProviders(signal?: AbortSignal): Promise<{ providers: BrowserProviderSummary[]; personalBrowsersInspected: false }> {
  return request("/browser/providers", signal ? { signal } : {});
}

export function loadBrowserRecentSites(limit = 12, signal?: AbortSignal): Promise<{ sites: BrowserRecentSite[] }> {
  return request(`/browser/recent-sites?${new URLSearchParams({ limit: String(limit) })}`, signal ? { signal } : {});
}

export function recordBrowserRecentSites(urls: string[], signal?: AbortSignal): Promise<{ recorded: number }> {
  return request("/browser/recent-sites", { method: "POST", body: JSON.stringify({ urls }), ...(signal ? { signal } : {}) });
}

export function clearBrowserRecentSites(): Promise<{ cleared: true }> {
  return request("/browser/recent-sites", { method: "DELETE" });
}

export function loadBrowserSession(sessionId: string, providerId: BrowserProviderId, signal?: AbortSignal): Promise<{ session: BrowserSessionSnapshot | null }> {
  return request(`/browser/sessions/${encodeURIComponent(sessionId)}?${new URLSearchParams({ providerId })}`, signal ? { signal } : {});
}

/** 浏览器工作区由认证用户直接操控；不因 Agent Provider 未启用而要求额外接入。 */
export function loadBrowserDockSession(sessionId: string, providerId: BrowserProviderId, signal?: AbortSignal): Promise<{ session: BrowserSessionSnapshot | null }> {
  return request(`/browser/dock/sessions/${encodeURIComponent(sessionId)}?${new URLSearchParams({ providerId })}`, signal ? { signal } : {});
}

export type BrowserDockFrame = { dataBase64: string; width: number; height: number };

export async function streamBrowserDockFrames(
  sessionId: string,
  providerId: BrowserProviderId,
  signal: AbortSignal,
  onFrame: (frame: BrowserDockFrame) => void
): Promise<void> {
  const path = `/browser/dock/sessions/${encodeURIComponent(sessionId)}/stream?${new URLSearchParams({ providerId })}`;
  const requestGeneration = authenticationGeneration;
  const response = await fetch(`/api${path}`, { credentials: "include", headers: { Accept: "text/event-stream" }, signal });
  if (!response.ok) {
    const rawBody = await response.text();
    let responseBody: unknown;
    try { responseBody = rawBody ? JSON.parse(rawBody) as unknown : undefined; } catch { responseBody = undefined; }
    const message = typeof responseBody === "object" && responseBody !== null && "message" in responseBody && typeof responseBody.message === "string"
      ? responseBody.message : "浏览器实时画面连接失败。";
    const code = typeof responseBody === "object" && responseBody !== null && "error" in responseBody && typeof responseBody.error === "string"
      ? responseBody.error : undefined;
    if (isSessionAuthenticationError(response.status, code)) handleSessionAuthenticationFailure(path, requestGeneration);
    throw new ApiError(response.status, message, code);
  }
  if (!response.headers.get("content-type")?.includes("text/event-stream") || !response.body) throw new ApiError(response.status, "浏览器实时画面服务没有返回有效数据流。" );

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (!signal.aborted) {
      const result = await reader.read();
      if (result.done) break;
      buffer += decoder.decode(result.value, { stream: true });
      if (buffer.length > 5_500_000) throw new ApiError(502, "浏览器实时画面数据超过允许大小。" );
      let delimiter = buffer.indexOf("\n\n");
      while (delimiter >= 0) {
        const event = buffer.slice(0, delimiter);
        buffer = buffer.slice(delimiter + 2);
        const eventName = /^event:\s*(\S+)/mu.exec(event)?.[1];
        const data = event.split(/\r?\n/u).filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
        if (eventName === "frame" && data.length <= 4_000_000) {
          const value: unknown = JSON.parse(data);
          if (typeof value === "object" && value !== null && "dataBase64" in value && typeof value.dataBase64 === "string" && value.dataBase64.length > 0
            && "width" in value && typeof value.width === "number" && Number.isInteger(value.width) && value.width > 0
            && "height" in value && typeof value.height === "number" && Number.isInteger(value.height) && value.height > 0) {
            onFrame(value as BrowserDockFrame);
          }
        } else if (eventName === "error") {
          let message = "浏览器实时画面连接失败，请重试。";
          try {
            const value = JSON.parse(data) as { message?: unknown };
            if (typeof value.message === "string") message = value.message;
          } catch { /* 忽略无效服务错误载荷。 */ }
          throw new ApiError(502, message);
        }
        delimiter = buffer.indexOf("\n\n");
      }
    }
  } catch (error) {
    if (!signal.aborted) throw error;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export function loadBrowserDockRevision(sessionId: string, providerId: BrowserProviderId, signal?: AbortSignal): Promise<{ session: BrowserRevision | null }> {
  return request(`/browser/dock/sessions/${encodeURIComponent(sessionId)}/revision?${new URLSearchParams({ providerId })}`, signal ? { signal } : {});
}

export function waitForBrowserDockRevision(sessionId: string, providerId: BrowserProviderId, revision: number, signal?: AbortSignal): Promise<{ session: BrowserRevision | null }> {
  const query = new URLSearchParams({ providerId, revision: String(revision) });
  return request(`/browser/dock/sessions/${encodeURIComponent(sessionId)}/wait?${query}`, signal ? { signal } : {});
}

export function navigateBrowserDock(sessionId: string, providerId: BrowserProviderId, url: string, signal?: AbortSignal): Promise<{ session: BrowserSessionSnapshot }> {
  return request(`/browser/dock/sessions/${encodeURIComponent(sessionId)}/navigate`, { method: "POST", body: JSON.stringify({ providerId, url }), ...(signal ? { signal } : {}) });
}

export function resizeBrowserDockViewport(sessionId: string, providerId: BrowserProviderId, width: number, height: number, signal?: AbortSignal): Promise<{ session: BrowserSessionSnapshot | null }> {
  return request(`/browser/dock/sessions/${encodeURIComponent(sessionId)}/viewport`, { method: "POST", body: JSON.stringify({ providerId, width, height }), ...(signal ? { signal } : {}) });
}

export function actOnBrowserDock(sessionId: string, providerId: BrowserProviderId, action: BrowserActionRequest, signal?: AbortSignal): Promise<{ session: BrowserSessionSnapshot }> {
  return request(`/browser/dock/sessions/${encodeURIComponent(sessionId)}/action`, { method: "POST", body: JSON.stringify({ providerId, ...action }), ...(signal ? { signal } : {}) });
}

export function closeBrowserDockSession(sessionId: string, providerId: BrowserProviderId): Promise<{ closed: boolean }> {
  return request(`/browser/dock/sessions/${encodeURIComponent(sessionId)}?${new URLSearchParams({ providerId })}`, { method: "DELETE" });
}

export function loadBrowserTabs(sessionId: string, providerId: BrowserProviderId, signal?: AbortSignal): Promise<{ tabs: BrowserTabSummary[] }> {
  return request(`/browser/tabs/${encodeURIComponent(sessionId)}?${new URLSearchParams({ providerId })}`, signal ? { signal } : {});
}

export function connectTabbitBrowser(sessionId: string): Promise<{ tabs: BrowserTabSummary[]; settings: UserSettings }> {
  return request("/browser/providers/tabbit-personal/connect", { method: "POST", body: JSON.stringify({ sourceSessionId: sessionId }) });
}

export function closeBrowserProviderSessions(providerId: BrowserProviderId): Promise<{ closed: boolean }> {
  return request(`/browser/providers/${encodeURIComponent(providerId)}/sessions`, { method: "DELETE" });
}

export function claimBrowserTab(sessionId: string, providerId: BrowserProviderId, tabId: number, signal?: AbortSignal): Promise<{ session: BrowserSessionSnapshot }> {
  return request(`/browser/sessions/${encodeURIComponent(sessionId)}/claim`, { method: "POST", body: JSON.stringify({ providerId, tabId }), ...(signal ? { signal } : {}) });
}

export function loadBrowserRevision(sessionId: string, providerId: BrowserProviderId, signal?: AbortSignal): Promise<{ session: BrowserRevision | null }> {
  return request(`/browser/sessions/${encodeURIComponent(sessionId)}/revision?${new URLSearchParams({ providerId })}`, signal ? { signal } : {});
}

export function setNativeBrowserActiveTarget(sessionId: string, targetId: string, signal?: AbortSignal): Promise<{ active: true }> {
  return request(`/browser/sessions/${encodeURIComponent(sessionId)}/native-active`, { method: "POST", body: JSON.stringify({ providerId: "lfaa-native-browser", targetId }), ...(signal ? { signal } : {}) });
}

export function navigateBrowser(sessionId: string, providerId: BrowserProviderId, url: string, signal?: AbortSignal): Promise<{ session: BrowserSessionSnapshot }> {
  return request(`/browser/sessions/${encodeURIComponent(sessionId)}/navigate`, { method: "POST", body: JSON.stringify({ providerId, url }), ...(signal ? { signal } : {}) });
}

export function resizeBrowserViewport(sessionId: string, providerId: BrowserProviderId, width: number, height: number, signal?: AbortSignal): Promise<{ session: BrowserSessionSnapshot | null }> {
  return request(`/browser/sessions/${encodeURIComponent(sessionId)}/viewport`, { method: "POST", body: JSON.stringify({ providerId, width, height }), ...(signal ? { signal } : {}) });
}

export type BrowserActionRequest =
  | { action: "back" | "forward" | "reload" }
  | { action: "clickAt"; x: number; y: number; includeScreenshot?: boolean }
  | { action: "dragAt"; x: number; y: number; points: Array<{ x: number; y: number; delayMs: number }>; includeScreenshot?: boolean }
  | { action: "typeText"; text: string; includeScreenshot?: boolean }
  | { action: "pressKey"; key: string; includeScreenshot?: boolean }
  | { action: "scroll"; direction: "up" | "down"; amount: number; includeScreenshot?: boolean };

export function actOnBrowser(sessionId: string, providerId: BrowserProviderId, action: BrowserActionRequest, signal?: AbortSignal): Promise<{ session: BrowserSessionSnapshot }> {
  return request(`/browser/sessions/${encodeURIComponent(sessionId)}/action`, { method: "POST", body: JSON.stringify({ providerId, ...action }), ...(signal ? { signal } : {}) });
}

export function closeBrowserSession(sessionId: string, providerId: BrowserProviderId): Promise<{ closed: boolean }> {
  return request(`/browser/sessions/${encodeURIComponent(sessionId)}?${new URLSearchParams({ providerId })}`, { method: "DELETE" });
}

async function requestOnce<T>(path: string, options: RequestInit): Promise<T> {
  const requestGeneration = authenticationGeneration;
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
    if (isSessionAuthenticationError(response.status, code)) {
      handleSessionAuthenticationFailure(path, requestGeneration);
    }

    throw new ApiError(response.status, message, code);
  }

  return responseBody as T;
}

async function requestBinary(path: string, options: RequestInit = {}): Promise<Blob> {
  const requestGeneration = authenticationGeneration;
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
    if (isSessionAuthenticationError(response.status, code)) {
      handleSessionAuthenticationFailure(path, requestGeneration);
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
/** 资源位置与真实目录分开读取，不枚举磁盘或递归计算大小。 */
export function loadFileResourceLocations(signal?: AbortSignal): Promise<{ rootDirectory: string; locations: FileResourceLocation[] }> {
  return request("/files/locations", { signal });
}
/** 页面与 AI 共用统一文件 Owner，普通本机操作直接返回，不产生节点任务。 */
export function operateSystemFiles(input: FileOperationInput & { operation: FileManagerOperation }, signal?: AbortSignal): Promise<{ result: Record<string, unknown> }> {
  return request("/files/operations", { method: "POST", body: JSON.stringify(input), signal });
}
export function downloadSystemFile(path: string): Promise<Blob> {
  return requestBinary(`/files/download?${new URLSearchParams({ path })}`);
}
export function uploadSystemFile(path: string, file: File, sha256: string): Promise<{ result: Record<string, unknown> }> {
  return request(`/files/upload?${new URLSearchParams({ path, name: file.name, sha256 })}`, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: file });
}
export function loadSystemFileAudit(query = ""): Promise<{ entries: FileManagerAuditEntry[] }> {
  return request(`/files/system-audit?${new URLSearchParams({ q: query.slice(0, 120) })}`);
}

export function submitFileManagerTask(input: {
  nodeId: string;
  operation: FileManagerOperation;
  path: string;
  query?: string;
  name?: string;
  destinationPath?: string;
  content?: string;
  dataBase64?: string;
  sha256?: string;
  expectedSha256?: string;
}): Promise<{ task: FileManagerTask }> {
  return request("/files/tasks", { method: "POST", body: JSON.stringify(input) });
}

export function loadFileManagerAudit(query = ""): Promise<{ entries: FileManagerAuditEntry[] }> {
  const parameters = new URLSearchParams({ limit: "200" });
  if (query.trim()) parameters.set("q", query.trim().slice(0, 120));
  return request(`/files/audit?${parameters.toString()}`);
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

export function loadSteamcmdServers(nodeId?: string): Promise<{ servers: SteamcmdServer[] }> {
  const query = nodeId ? `?nodeId=${encodeURIComponent(nodeId)}` : "";
  return request(`/steamcmd/servers${query}`);
}

export function createSteamcmdServer(input: SteamcmdServerInput): Promise<{ server: SteamcmdServer }> {
  return request("/steamcmd/servers", { method: "POST", body: JSON.stringify(input) });
}

export function updateSteamcmdServer(serverId: string, input: SteamcmdServerInput): Promise<{ server: SteamcmdServer }> {
  return request(`/steamcmd/servers/${encodeURIComponent(serverId)}`, { method: "PUT", body: JSON.stringify(input) });
}

export function createSteamcmdServerTask(serverId: string, kind: "install-server" | "update-server" | "start-server" | "stop-server"): Promise<{ task: SteamcmdTask }> {
  return request(`/steamcmd/servers/${encodeURIComponent(serverId)}/tasks`, { method: "POST", body: JSON.stringify({ kind }) });
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
export function confirmDataDirectoryLocation(): Promise<{ settings: DataDirectorySettings }> {
  return request("/data-directory/confirm", { method: "POST" });
}
export function recommendDataDirectoryLocation(): Promise<{ settings: DataDirectorySettings }> {
  return request("/data-directory/recommended", { method: "POST" });
}

export function saveDataDirectorySettings(directory: string, mode: "copy" | "adopt" | "archive" = "copy", archivePath = ""): Promise<{ settings: DataDirectorySettings }> {
  return request("/data-directory", { method: "PUT", body: JSON.stringify({ directory, mode, archivePath }) });
}

export function cancelDataDirectorySettingsChange(): Promise<{ settings: DataDirectorySettings }> {
  return request("/data-directory", { method: "DELETE" });
}

export function loadProjectStorageLocations(): Promise<{ settings: ProjectStorageLocations; configured: boolean }> {
  return request("/project-storage-locations");
}

export function saveProjectContentDirectory(contentDirectory: string): Promise<{ settings: ProjectStorageLocations; configured: boolean }> {
  return request("/project-storage-locations", { method: "PUT", body: JSON.stringify({ contentDirectory }) });
}

export function compareProjectContentDirectories(targetDirectory: string): Promise<ProjectContentComparison> {
  return request("/project-storage-locations/compare", { method: "POST", body: JSON.stringify({ targetDirectory }) });
}

export function copyProjectContentToDirectory(targetDirectory: string): Promise<ProjectContentMigrationResult> {
  return request("/project-storage-locations/copy", { method: "POST", body: JSON.stringify({ targetDirectory }) });
}

export function adoptProjectContentDirectory(targetDirectory: string): Promise<ProjectContentMigrationResult> {
  return request("/project-storage-locations/adopt", { method: "POST", body: JSON.stringify({ targetDirectory }) });
}

export function importProjectContentArchive(archivePath: string, targetDirectory: string): Promise<ProjectContentMigrationResult> {
  return request("/project-storage-locations/archive/import", { method: "POST", body: JSON.stringify({ archivePath, targetDirectory }) });
}

export function downloadProjectContentArchive(): Promise<Blob> {
  return requestBinary("/project-storage-locations/archive/export", { method: "POST" });
}

export function confirmProjectContentDirectory(): Promise<{ settings: ProjectStorageLocations; configured: boolean }> {
  return request("/project-storage-locations/confirm", { method: "POST" });
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

export async function selectDesktopWorkspaceDirectory(): Promise<string | null> {
  if (window.lfaaDesktop) return window.lfaaDesktop.selectWorkspaceDirectory();
  if (!isTauri()) return null;
  const selectedDirectory = await open({ title: "选择项目工作区文件夹", multiple: false, directory: true });
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

export interface AiVideoTask { localId: string; accountId: string; modelId: string; status: "submitting" | "queued" | "running" | "succeeded" | "failed" | "cancelled" | "expired"; createdAt: string; updatedAt: string; providerTaskId?: string; error?: string }
export interface AiVideoShot { id: string; title: string; description: string; dialogue: string; durationSeconds: number; x: number; y: number; characterIds: string[]; locationId?: string; imageAssetId?: string; imageMimeType?: "image/png" | "image/jpeg" | "image/webp"; videoAssetId?: string; videoMimeType?: "video/mp4"; videoTask?: AiVideoTask }
export interface AiVideoShotLink { id: string; source: string; target: string }
export interface AiVideoReference { id: string; name: string; description: string; imageAssetId?: string; imageMimeType?: "image/png" | "image/jpeg" | "image/webp" }
export type AiVideoMediaMimeType = "image/png" | "image/jpeg" | "image/webp" | "video/mp4" | "video/webm" | "audio/mpeg" | "audio/wav" | "audio/ogg";
export interface AiVideoMediaAsset { assetId: string; name: string; mimeType: AiVideoMediaMimeType; bytes: number; createdAt: string; origin: "imported" | "export" | "generated"; available?: boolean }
export interface AiVideoTimelineClip { id: string; track: "video" | "audio" | "subtitle"; assetId?: string; text?: string; startSeconds: number; inPointSeconds: number; durationSeconds: number }
export interface AiVideoWhiteModelItem { id: string; name: string; kind: "actor" | "block"; x: number; z: number; width: number; depth: number; height: number }
export interface AiVideoWhiteModel { items: AiVideoWhiteModelItem[]; camera: { x: number; y: number; z: number; yaw: number; pitch: number; focalLength: number }; ratio: "16:9" | "9:16" | "1:1" }
export interface AiVideoCanvas { id: string; title: string; script: string; characters: AiVideoReference[]; locations: AiVideoReference[]; shots: AiVideoShot[]; links: AiVideoShotLink[]; mediaAssets: AiVideoMediaAsset[]; timelineClips: AiVideoTimelineClip[]; whiteModel: AiVideoWhiteModel; createdAt: string; updatedAt: string }
export type AiVideoCanvasInput = Pick<AiVideoCanvas, "title" | "script" | "characters" | "locations" | "shots" | "links" | "timelineClips" | "whiteModel">;

type AiVideoCanvasLimits = { canvases: number; shots: number; links: number; characters: number; locations: number; scriptCharacters: number; referencesPerShot: number; referenceImageBytes: number; referenceImageDimension: number; referenceImagePixels: number; imageAssetBytes: number; mediaAssetBytes: number; timelineClips: number; timelineSeconds: number };
type AiVideoCanvasCollection = { canvases: AiVideoCanvas[]; limits: AiVideoCanvasLimits };
const aiVideoCanvasLimitFields = ["canvases", "shots", "links", "characters", "locations", "scriptCharacters", "referencesPerShot", "referenceImageBytes", "referenceImageDimension", "referenceImagePixels", "imageAssetBytes", "mediaAssetBytes", "timelineClips", "timelineSeconds"] as const satisfies readonly (keyof AiVideoCanvasLimits)[];

export async function loadAiVideoCanvases(): Promise<AiVideoCanvasCollection> {
  const response: unknown = await request<unknown>("/ai-video/canvases");
  const limits = isRecord(response) && isRecord(response.limits) ? response.limits : undefined;
  if (!isRecord(response) || !Array.isArray(response.canvases) || !limits || !aiVideoCanvasLimitFields.every(field => {
    const value = limits[field];
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
  })) {
    throw new ApiError(502, "AI 漫剧服务返回的数据与当前界面版本不兼容。请重启本机 LFAA Web 服务后刷新页面。", "ai_video_contract_mismatch");
  }
  return response as AiVideoCanvasCollection;
}
export function createAiVideoCanvas(title: string): Promise<{ canvas: AiVideoCanvas }> {
  return request("/ai-video/canvases", { method: "POST", body: JSON.stringify({ title }) });
}
export function saveAiVideoCanvas(canvasId: string, expectedUpdatedAt: string, canvas: AiVideoCanvasInput): Promise<{ canvas: AiVideoCanvas }> {
  return request(`/ai-video/canvases/${encodeURIComponent(canvasId)}`, { method: "PUT", body: JSON.stringify({ expectedUpdatedAt, canvas }) });
}
export function generateAiVideoShotImage(canvasId: string, shotId: string, expectedUpdatedAt: string): Promise<{ canvas: AiVideoCanvas }> {
  return request(`/ai-video/canvases/${encodeURIComponent(canvasId)}/shots/${encodeURIComponent(shotId)}/image`, { method: "POST", body: JSON.stringify({ expectedUpdatedAt }) });
}
export function startAiVideoShotVideo(canvasId: string, shotId: string, expectedUpdatedAt: string): Promise<{ canvas: AiVideoCanvas }> {
  return request(`/ai-video/canvases/${encodeURIComponent(canvasId)}/shots/${encodeURIComponent(shotId)}/video`, { method: "POST", body: JSON.stringify({ expectedUpdatedAt }) });
}
export function refreshAiVideoShotVideo(canvasId: string, shotId: string): Promise<{ canvas: AiVideoCanvas }> {
  return request(`/ai-video/canvases/${encodeURIComponent(canvasId)}/shots/${encodeURIComponent(shotId)}/video`);
}
export function cancelAiVideoShotVideo(canvasId: string, shotId: string): Promise<{ canvas: AiVideoCanvas }> {
  return request(`/ai-video/canvases/${encodeURIComponent(canvasId)}/shots/${encodeURIComponent(shotId)}/video`, { method: "DELETE" });
}
export function aiVideoShotImageUrl(canvasId: string, assetId: string): string {
  return aiVideoAssetUrl(canvasId, assetId);
}
export function aiVideoAssetUrl(canvasId: string, assetId: string): string {
  return `/api/ai-video/canvases/${encodeURIComponent(canvasId)}/assets/${encodeURIComponent(assetId)}`;
}
export function loadAiVideoMediaAssets(canvasId: string): Promise<{ assets: AiVideoMediaAsset[] }> {
  return request(`/ai-video/canvases/${encodeURIComponent(canvasId)}/media`);
}
export function readAiVideoMediaAsset(canvasId: string, assetId: string): Promise<Blob> {
  return requestBinary(`/ai-video/canvases/${encodeURIComponent(canvasId)}/assets/${encodeURIComponent(assetId)}`);
}
export function uploadAiVideoMediaAsset(canvasId: string, expectedUpdatedAt: string, file: File): Promise<{ canvas: AiVideoCanvas }> {
  const query = new URLSearchParams({ expectedUpdatedAt, name: file.name });
  return request(`/ai-video/canvases/${encodeURIComponent(canvasId)}/assets?${query}`, { method: "POST", headers: { "Content-Type": file.type }, body: file });
}
export function deleteAiVideoMediaAsset(canvasId: string, assetId: string, expectedUpdatedAt: string): Promise<{ canvas: AiVideoCanvas }> {
  const query = new URLSearchParams({ expectedUpdatedAt });
  return request(`/ai-video/canvases/${encodeURIComponent(canvasId)}/assets/${encodeURIComponent(assetId)}?${query}`, { method: "DELETE" });
}
export function saveAiVideoExport(canvasId: string, expectedUpdatedAt: string, blob: Blob): Promise<{ canvas: AiVideoCanvas; asset: AiVideoMediaAsset }> {
  const query = new URLSearchParams({ expectedUpdatedAt });
  return request(`/ai-video/canvases/${encodeURIComponent(canvasId)}/exports?${query}`, { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
}
export function uploadAiVideoShotImage(canvasId: string, shotId: string, expectedUpdatedAt: string, blob: Blob): Promise<{ canvas: AiVideoCanvas }> {
  const query = new URLSearchParams({ expectedUpdatedAt });
  return request(`/ai-video/canvases/${encodeURIComponent(canvasId)}/shots/${encodeURIComponent(shotId)}/image?${query}`, { method: "PUT", headers: { "Content-Type": blob.type }, body: blob });
}
export function uploadAiVideoReferenceImage(canvasId: string, kind: "characters" | "locations", referenceId: string, expectedUpdatedAt: string, dataUrl: string): Promise<{ canvas: AiVideoCanvas }> {
  return request(`/ai-video/canvases/${encodeURIComponent(canvasId)}/references/${kind}/${encodeURIComponent(referenceId)}/image`, { method: "PUT", body: JSON.stringify({ expectedUpdatedAt, dataUrl }) });
}
export function removeAiVideoReferenceImage(canvasId: string, kind: "characters" | "locations", referenceId: string, expectedUpdatedAt: string): Promise<{ canvas: AiVideoCanvas }> {
  return request(`/ai-video/canvases/${encodeURIComponent(canvasId)}/references/${kind}/${encodeURIComponent(referenceId)}/image`, { method: "DELETE", body: JSON.stringify({ expectedUpdatedAt }) });
}
export function deleteAiVideoCanvas(canvasId: string): Promise<void> {
  return request(`/ai-video/canvases/${encodeURIComponent(canvasId)}`, { method: "DELETE" });
}

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
export function loadMinecraftCoreNames(): Promise<{ cores: string[] }> { return request("/minecraft/core-names"); }
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

export function loadMinecraftTaskDetails(taskId: string): Promise<MinecraftTaskDetails> {
  return request(`/minecraft/tasks/${encodeURIComponent(taskId)}`);
}

export function deleteMinecraftTaskRecords(taskIds: string[]): Promise<{ deletedCount: number }> {
  return request("/minecraft/tasks", { method: "DELETE", body: JSON.stringify({ taskIds }) });
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

export function deleteMinecraftInstance(instanceId:string):Promise<{task:MinecraftTask}> {return request(`/minecraft/instances/${encodeURIComponent(instanceId)}`,{method:"DELETE"});}

export function runMinecraftInstanceAction(instanceId: string, action: "start" | "stop" | "backup" | "restart"): Promise<{ task: MinecraftTask }> {
  return request(`/minecraft/instances/${encodeURIComponent(instanceId)}/${action}`, { method: "POST" });
}
export function sendMinecraftConsole(instanceId: string, command: string): Promise<{ task: MinecraftTask }> {
  return request(`/minecraft/instances/${encodeURIComponent(instanceId)}/console`, { method: "POST", body: JSON.stringify({ command }) });
}

export function saveMinecraftServerProperties(instanceId: string, properties: MinecraftServerProperties): Promise<{ task: MinecraftTask }> {
  return request(`/minecraft/instances/${encodeURIComponent(instanceId)}/properties`, { method: "PATCH", body: JSON.stringify({ properties }) });
}

export interface DefaultCredentialReminder {
  usernamePending: boolean;
  passwordPending: boolean;
}

export function loadDefaultCredentialReminder(): Promise<DefaultCredentialReminder> {
  return request<DefaultCredentialReminder>("/auth/default-credential-reminder");
}

export function dismissDefaultCredentialReminder(): Promise<void> {
  return request<void>("/auth/default-credential-reminder/dismiss", { method: "POST" });
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

export async function login(username: string, password: string): Promise<{ user: User }> {
  const result = await request<{ user: User }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
  advanceAuthenticationGeneration();
  return result;
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
  const result = await request<{ user: User }>("/auth/passkeys/authentication/verify", {
    method: "POST",
    body: JSON.stringify({ flowId, response })
  });
  advanceAuthenticationGeneration();
  return result;
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

export function updateCurrentUserUsername(input: { currentPassword: string; username: string }): Promise<{ user: User }> {
  return request<{ user: User }>("/auth/username", {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

export function logout(): Promise<void> {
  advanceAuthenticationGeneration();
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

export function loadSettings(signal?: AbortSignal): Promise<{ settings: UserSettings }> {
  return request<{ settings: UserSettings }>("/settings", signal ? { signal } : {});
}

export function saveSettings<K extends keyof UserSettings>(category: K, value: UserSettings[K]): Promise<{ settings: UserSettings }> {
  const serverCategory = category === "aiRuntime" ? "ai-runtime" : category === "minecraftRuntime" ? "minecraft-runtime" : category === "computerControl" ? "computer-control" : category === "browserUse" ? "browser-use" : category;
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

export function loadLocalModels(signal?: AbortSignal): Promise<{ models: LocalModelSummary[]; activeDownload: LocalModelDownloadSnapshot | null }> {
  return request<{ models: LocalModelSummary[]; activeDownload: LocalModelDownloadSnapshot | null }>("/local-models", signal ? { signal } : {});
}

export function startLocalModelDownload(modelId: string): Promise<{ download: LocalModelDownloadSnapshot }> {
  return request<{ download: LocalModelDownloadSnapshot }>(`/local-models/${encodeURIComponent(modelId)}/downloads`, { method: "POST", body: "{}" });
}

export function readLocalModelDownload(downloadId: string, signal?: AbortSignal): Promise<{ download: LocalModelDownloadSnapshot }> {
  return request<{ download: LocalModelDownloadSnapshot }>(`/local-models/downloads/${encodeURIComponent(downloadId)}`, signal ? { signal } : {});
}

export function cancelLocalModelDownload(downloadId: string): Promise<{ download: LocalModelDownloadSnapshot }> {
  return request<{ download: LocalModelDownloadSnapshot }>(`/local-models/downloads/${encodeURIComponent(downloadId)}`, { method: "DELETE" });
}

export function unloadLocalModel(modelId: string): Promise<void> {
  return request<void>(`/local-models/${encodeURIComponent(modelId)}/unload`, { method: "POST", body: "{}" });
}

export function loadAiSkillDirectory(signal?: AbortSignal): Promise<{ skills: Array<{ id: string; name: string; description: string; kind: "skill"; source: string; enabled: boolean }>; truncated: boolean }> {
  return request("/ai/skills", { signal });
}
export function setAiSessionAssociations(sessionId: string, associations: AgentAssociations): Promise<{ session: AiSession }> {
  return request(`/ai/sessions/${encodeURIComponent(sessionId)}/associations`, { method: "PATCH", body: JSON.stringify(associations) });
}

export function loadAiExtensions(signal?: AbortSignal): Promise<{ plugins: AiRuntimePlugin[]; extensions: AiExtension[]; hooks: AiRuntimeHookInfo[]; hotReloadEnabled: boolean }> {
  return request<{ plugins: AiRuntimePlugin[]; extensions: AiExtension[]; hooks: AiRuntimeHookInfo[]; hotReloadEnabled: boolean }>("/ai/extensions", signal ? { signal } : {});
}

export function loadManagedPlugins(signal?: AbortSignal): Promise<{ profile: string; installationDirectory: string; plugins: ManagedPluginRecord[] }> {
  return request("/plugins", signal ? { signal } : {});
}

export function setManagedPluginEnabled(pluginId: string, input: { enabled: boolean; targetApplicationId: ApplicationId; expectedSourceCommit: string }): Promise<{ plugin: ManagedPluginRecord }> {
  return request(`/plugins/${encodeURIComponent(pluginId)}/lifecycle`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function installManagedPlugin(
  input: { repositoryUrl: string; ref: string; expectedResolvedRef: string; expectedSourceType: ManagedPluginInspection["sourceType"]; expectedSourceLocation: string; npmRegistry?: string },
  onProgress?: (progress: ManagedPluginInstallProgress) => void
): Promise<{ plugin: ManagedPluginRecord }> {
  const requestGeneration = authenticationGeneration;
  pendingReads.clear();
  try {
    const response = await fetch("/api/plugins/install", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
      credentials: "include",
      body: JSON.stringify(input)
    });
    if (!response.ok) {
      const rawBody = await response.text();
      let responseBody: unknown;
      try { responseBody = rawBody ? JSON.parse(rawBody) as unknown : undefined; } catch { responseBody = undefined; }
      const message = typeof responseBody === "object" && responseBody !== null && "message" in responseBody && typeof responseBody.message === "string" ? responseBody.message : "插件安装请求失败，请稍后重试。";
      const code = typeof responseBody === "object" && responseBody !== null && "error" in responseBody && typeof responseBody.error === "string" ? responseBody.error : undefined;
      if (isSessionAuthenticationError(response.status, code)) handleSessionAuthenticationFailure("/plugins/install", requestGeneration);
      throw new ApiError(response.status, message, code);
    }
    if (!response.body) throw new ApiError(response.status, "插件安装服务没有返回进度流。", "plugin_install_stream_missing");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pendingLine = "";
    let result: { plugin: ManagedPluginRecord } | null = null;
    const consumeLine = (line: string): void => {
      if (!line.trim()) return;
      let event: unknown;
      try { event = JSON.parse(line) as unknown; }
      catch { throw new ApiError(response.status, "插件安装进度格式无效。", "plugin_install_stream_invalid"); }
      if (typeof event !== "object" || event === null || !("event" in event)) throw new ApiError(response.status, "插件安装进度格式无效。", "plugin_install_stream_invalid");
      if (event.event === "progress" && "progress" in event && typeof event.progress === "object" && event.progress !== null) {
        onProgress?.(event.progress as ManagedPluginInstallProgress);
        return;
      }
      if (event.event === "result" && "result" in event && typeof event.result === "object" && event.result !== null && "plugin" in event.result) {
        result = event.result as { plugin: ManagedPluginRecord };
        return;
      }
      if (event.event === "error" && "error" in event && typeof event.error === "object" && event.error !== null) {
        const failure = event.error as { status?: unknown; code?: unknown; message?: unknown };
        throw new ApiError(typeof failure.status === "number" ? failure.status : response.status, typeof failure.message === "string" ? failure.message : "插件安装失败。", typeof failure.code === "string" ? failure.code : "plugin_operation_failed");
      }
      throw new ApiError(response.status, "插件安装进度包含未知事件。", "plugin_install_stream_invalid");
    };

    try {
      while (true) {
        const chunk = await reader.read();
        pendingLine += decoder.decode(chunk.value, { stream: !chunk.done });
        if (pendingLine.length > 1_048_576) throw new ApiError(response.status, "插件安装进度行超过允许长度。", "plugin_install_stream_invalid");
        let newline = pendingLine.indexOf("\n");
        while (newline >= 0) {
          consumeLine(pendingLine.slice(0, newline));
          pendingLine = pendingLine.slice(newline + 1);
          newline = pendingLine.indexOf("\n");
        }
        if (chunk.done) break;
      }
      consumeLine(pendingLine);
    } catch (error) {
      await reader.cancel().catch(() => undefined);
      throw error;
    }
    if (!result) throw new ApiError(response.status, "插件安装进度流结束，但没有收到安装结果。", "plugin_install_result_missing");
    return result;
  } finally {
    pendingReads.clear();
  }
}

export function removeManagedPlugin(pluginId: string, input: { targetApplicationId: ApplicationId; expectedSourceCommit: string }): Promise<{ removed: true }> {
  return request(`/plugins/${encodeURIComponent(pluginId)}/remove`, { method: "POST", body: JSON.stringify(input) });
}

export interface GitHubConnectionStatus {
  configured: boolean;
  connected: boolean;
  login: string | null;
  connectedAt: string | null;
  expiresAt: string | null;
  remoteRevocationAvailable: boolean;
}
export interface GitHubRepository {
  id: number;
  fullName: string;
  description: string | null;
  private: boolean;
  url: string;
  defaultBranch: string;
  updatedAt: string;
}
export interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  author: string | null;
  url: string;
  updatedAt: string;
  labels: string[];
}
export interface GitHubPullRequest extends GitHubIssue { baseBranch: string; headBranch: string }

export function getGitHubConnectionStatus(signal?: AbortSignal): Promise<{ connection: GitHubConnectionStatus }> {
  return request("/integrations/github/status", signal ? { signal } : {});
}
export function beginGitHubAuthorization(): Promise<{ device: { attemptId: string; verificationUri: string; userCode: string; expiresAt: string; intervalSeconds: number } }> {
  return request("/integrations/github/device", { method: "POST", body: "{}" });
}
export function pollGitHubAuthorization(attemptId: string, signal?: AbortSignal): Promise<{ result: { status: "pending"; retryAfterSeconds: number } | { status: "authorized"; login: string } | { status: "expired" } | { status: "cancelled" } }> {
  return request("/integrations/github/device/poll", { method: "POST", body: JSON.stringify({ attemptId }), ...(signal ? { signal } : {}) });
}
export function cancelGitHubAuthorization(attemptId: string): Promise<void> {
  return request(`/integrations/github/device/${encodeURIComponent(attemptId)}`, { method: "DELETE" });
}
export function disconnectGitHub(): Promise<{ disconnected: true; remoteRevoked: boolean }> {
  return request("/integrations/github", { method: "DELETE" });
}
export function listGitHubRepositories(page = 1, signal?: AbortSignal): Promise<{ repositories: GitHubRepository[]; truncated: boolean }> {
  const query = new URLSearchParams({ page: String(page) });
  return request(`/integrations/github/repositories?${query}`, signal ? { signal } : {});
}
export function listGitHubIssues(owner: string, name: string, signal?: AbortSignal): Promise<{ issues: GitHubIssue[] }> {
  return request(`/integrations/github/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/issues`, signal ? { signal } : {});
}
export function listGitHubPullRequests(owner: string, name: string, signal?: AbortSignal): Promise<{ pullRequests: GitHubPullRequest[] }> {
  return request(`/integrations/github/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls`, signal ? { signal } : {});
}

export function loadCapabilityInstallCatalog(): Promise<{ capabilities: CapabilityInstallCatalogEntry[] }> {
  return request("/capabilities/catalog");
}

export function searchManagedPlugins(query: string, signal?: AbortSignal): Promise<{ candidates: ManagedPluginCandidate[] }> {
  return request("/plugins/search", { method: "POST", body: JSON.stringify({ query }), ...(signal ? { signal } : {}) });
}

export function inspectManagedPlugin(source: string, ref?: string, signal?: AbortSignal, npmRegistry?: string): Promise<{ plugin: ManagedPluginInspection }> {
  return request("/plugins/inspect", { method: "POST", body: JSON.stringify({ repositoryUrl: source, ...(ref ? { ref } : {}), ...(npmRegistry ? { npmRegistry } : {}) }), ...(signal ? { signal } : {}) });
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

export function loadAiSessions(options: { archived?: boolean; appId?: ApplicationId; signal?: AbortSignal } = {}): Promise<{ sessions: AiSession[] }> {
  const query = new URLSearchParams();
  if (options.archived !== undefined) query.set("archived", String(options.archived));
  if (options.appId) query.set("appId", options.appId);
  return request<{ sessions: AiSession[] }>(`/ai/sessions${query.size ? `?${query}` : ""}`, options.signal ? { signal: options.signal } : {});
}

export function loadAiMessages(sessionId: string, cursor?: string, signal?: AbortSignal): Promise<AiMessagePage> {
  const query = new URLSearchParams({ limit: "50" });
  if (cursor) query.set("cursor", cursor);
  return request<AiMessagePage>(`/ai/sessions/${encodeURIComponent(sessionId)}/messages?${query}`, signal ? { signal } : {});
}

export function submitAiMessageFeedback(sessionId: string, messageId: string, feedback: AiMessageFeedbackInput): Promise<{ feedback: AiMessageFeedback }> {
  return request<{ feedback: AiMessageFeedback }>(`/ai/sessions/${encodeURIComponent(sessionId)}/messages/${encodeURIComponent(messageId)}/feedback`, { method: "POST", body: JSON.stringify(feedback) });
}

export function createAiSessionBranchFromMessage(sessionId: string, messageId: string): Promise<{ session: AiSession }> {
  return request<{ session: AiSession }>(`/ai/sessions/${encodeURIComponent(sessionId)}/fork`, { method: "POST", body: JSON.stringify({ messageId }) });
}

export function forkAiSessionBeforeUserMessage(sessionId: string, messageId: string): Promise<{ session: AiSession }> {
  return request<{ session: AiSession }>(`/ai/sessions/${encodeURIComponent(sessionId)}/fork-before-message`, { method: "POST", body: JSON.stringify({ messageId }) });
}

export function createAiSessionBranchFromMessageInWorktree(sessionId: string, messageId: string, targetProjectId: string, appId: WorkspaceProjectApplicationId): Promise<{ session: AiSession }> {
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

export function loadWorkspaceProjects(options: { appId?: WorkspaceProjectApplicationId; query?: string; signal?: AbortSignal } = {}): Promise<{ projects: WorkspaceProject[]; nodes: WorkspaceDaemonNode[]; truncated: boolean; defaultProjectId?: string | null }> {
  const parameters = new URLSearchParams();
  if (options.appId) parameters.set("appId", options.appId);
  if (options.query?.trim()) parameters.set("query", options.query.trim());
  const suffix = parameters.size ? `?${parameters.toString()}` : "";
  return request<{ projects: WorkspaceProject[]; nodes: WorkspaceDaemonNode[]; truncated: boolean; defaultProjectId?: string | null }>(`/workspace/projects${suffix}`, options.signal ? { signal: options.signal } : {});
}

export function initializeDefaultWorkspace(signal?: AbortSignal): Promise<{ project: WorkspaceProject | null; defaultProjectId: string | null }> {
  return request<{ project: WorkspaceProject | null; defaultProjectId: string | null }>("/workspace/projects/initialize-default", { method: "POST", ...(signal ? { signal } : {}) });
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

export function initializeWorkspaceGitRepository(projectId: string, appId: WorkspaceProjectApplicationId): Promise<{ status: WorkspaceGitStatus }> {
  return request<{ status: WorkspaceGitStatus }>(`/workspace/projects/${encodeURIComponent(projectId)}/git/initialize`, { method: "POST", body: JSON.stringify({ appId }) });
}

export function runWorkspaceGitOperation(projectId: string, appId: WorkspaceProjectApplicationId, input: WorkspaceGitOperationInput): Promise<WorkspaceGitOperationResult> {
  return request<WorkspaceGitOperationResult>(`/workspace/projects/${encodeURIComponent(projectId)}/git/operation`, { method: "POST", body: JSON.stringify({ appId, ...input }) });
}

export function loadWorkspaceGitFileDiff(projectId: string, appId: WorkspaceProjectApplicationId, path: string, options: { ignoreWhitespace?: boolean; wordDiff?: boolean; contextLines?: number; signal?: AbortSignal } = {}): Promise<{ file: WorkspaceGitFileDiff }> {
  const { signal, ...parameters } = options;
  return request<{ file: WorkspaceGitFileDiff }>(`/workspace/projects/${encodeURIComponent(projectId)}/git/file-diff`, { method: "POST", body: JSON.stringify({ appId, path, ignoreWhitespace: parameters.ignoreWhitespace === true, wordDiff: parameters.wordDiff === true, ...(parameters.contextLines === undefined ? {} : { contextLines: parameters.contextLines }) }), ...(signal ? { signal } : {}) });
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

export type AiRunPauseState = "running" | "pausing" | "paused";

/** 请求当前 Run 在安全检查点暂停；正在执行的 Provider/工具操作会先完成。 */
export function pauseAiRun(runId: string): Promise<{ pauseState: AiRunPauseState }> {
  return request(`/ai/runs/${encodeURIComponent(runId)}/pause`, { method: "POST" });
}

/** 继续同一个 Run；不创建新的用户消息或运行。 */
export function resumeAiRun(runId: string): Promise<{ pauseState: AiRunPauseState }> {
  return request(`/ai/runs/${encodeURIComponent(runId)}/resume`, { method: "POST" });
}

export function appendAiRunInput(runId: string, content: string): Promise<{ mode: "queue" | "steer"; run: { id: string; message: AiMessage }; userMessage: AiMessage }> { return request(`/ai/runs/${encodeURIComponent(runId)}/input`, { method: "POST", body: JSON.stringify({ content }) }); }

/** 回答当前 Run 的模型澄清问题；答案作为原工具结果返回，不新增普通用户消息。 */
export function answerAiRunQuestion(runId: string, questionId: string, answer: string, skipped = false): Promise<{ mode: "answered" }> {
  return request(`/ai/runs/${encodeURIComponent(runId)}/answer`, { method: "POST", body: JSON.stringify({ questionId, answer, skipped }) });
}

type AiChatStreamInput = {
  runId?: string;
  associations?: AgentAssociations;
  appId: ApplicationId;
  sessionId: string | null;
  projectId?: string | null;
  gitRepositoryId?: string | null;
  content: string;
  planMode?: boolean;
  signal: AbortSignal;
  onSession: (value: { session: AiSession; userMessage: AiMessage; assistantMessage: AiMessage }) => void;
  onPauseState?: (value: { runId: string; state: AiRunPauseState }) => void;
  onPlanMode?: (active: boolean) => void;
  /** 能力 Owner 修改设置后只发失效信号，客户端从认证 Settings API 对账。 */
  onSettingsInvalidated?: () => void;
  onInput?: (message: AiMessage) => void;
  onActivity: (value: { messageId: string; activity: AiActivityItem }) => void;
  onDelta: (value: AiTextDelta) => void;
  onPresentation?: (value: { messageId: string; parts: AiReplyPart[] }) => void;
  onUsage: (value: { messageId: string; promptTokens: number | null; completionTokens: number | null; cacheReadTokens: number | null; providerId: string; modelId: string; models?: Array<{ providerId: string; modelId: string; requestCount: number }>; sessionUsage?: AiSessionUsageSummary }) => void;
  onUsageProgress?: (value: { messageId: string; sessionUsage: AiSessionUsageSummary }) => void;
  onContextUsage?: (value: { messageId: string; contextUsage: AiContextUsage }) => void;
  onError: (message: string) => void;
  onDone: (status: "complete" | "interrupted" | "error") => void;
};

function isNonnegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function readAiSessionUsageSummary(value: unknown): AiSessionUsageSummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (!isNonnegativeSafeInteger(row.requestCount) || !(row.requestCountExact === undefined || typeof row.requestCountExact === "boolean") || !(row.promptTokens === null || isNonnegativeSafeInteger(row.promptTokens))
    || !(row.completionTokens === null || isNonnegativeSafeInteger(row.completionTokens))
    || !(row.cacheReadTokens === null || isNonnegativeSafeInteger(row.cacheReadTokens)) || !Array.isArray(row.models)) return null;
  const models: AiSessionUsageModelSummary[] = [];
  for (const candidate of row.models) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
    const model = candidate as Record<string, unknown>;
    if (typeof model.providerId !== "string" || typeof model.modelId !== "string" || !isNonnegativeSafeInteger(model.requestCount)
      || !(model.requestCountExact === undefined || typeof model.requestCountExact === "boolean")
      || !(model.promptTokens === null || isNonnegativeSafeInteger(model.promptTokens))
      || !(model.completionTokens === null || isNonnegativeSafeInteger(model.completionTokens))
      || !(model.cacheReadTokens === null || isNonnegativeSafeInteger(model.cacheReadTokens))
      || !(model.cacheReadReportedTokens === undefined || model.cacheReadReportedTokens === null || isNonnegativeSafeInteger(model.cacheReadReportedTokens))
      || !(model.cacheReadReportedRequestCount === undefined || model.cacheReadReportedRequestCount === null || isNonnegativeSafeInteger(model.cacheReadReportedRequestCount))) return null;
    models.push({ providerId: model.providerId, modelId: model.modelId, requestCount: model.requestCount, requestCountExact: model.requestCountExact === true, promptTokens: model.promptTokens, completionTokens: model.completionTokens, cacheReadTokens: model.cacheReadTokens, cacheReadReportedTokens: model.cacheReadReportedTokens === undefined ? null : model.cacheReadReportedTokens, cacheReadReportedRequestCount: model.cacheReadReportedRequestCount === undefined ? null : model.cacheReadReportedRequestCount });
  }
  return { requestCount: row.requestCount, requestCountExact: row.requestCountExact === true, promptTokens: row.promptTokens, completionTokens: row.completionTokens, cacheReadTokens: row.cacheReadTokens, models };
}

function readAiContextUsage(value: unknown): AiContextUsage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.providerId !== "string" || typeof row.modelId !== "string"
    || !(row.contextWindow === null || isNonnegativeSafeInteger(row.contextWindow) && row.contextWindow > 0)
    || !(row.contextWindowSource === "model-catalog" || row.contextWindowSource === "settings-fallback" || row.contextWindowSource === "unknown")
    || !(row.promptTokens === null || isNonnegativeSafeInteger(row.promptTokens))
    || !isNonnegativeSafeInteger(row.estimatedPromptTokens) || !isNonnegativeSafeInteger(row.systemTokens)
    || !isNonnegativeSafeInteger(row.toolsTokens) || !isNonnegativeSafeInteger(row.messageTokens) || typeof row.includesImages !== "boolean") return null;
  return { providerId: row.providerId, modelId: row.modelId, contextWindow: row.contextWindow, contextWindowSource: row.contextWindowSource, promptTokens: row.promptTokens, estimatedPromptTokens: row.estimatedPromptTokens, systemTokens: row.systemTokens, toolsTokens: row.toolsTokens, messageTokens: row.messageTokens, includesImages: row.includesImages };
}

export function streamAiChat(input: AiChatStreamInput): Promise<void> {
  return streamAiChatAt(input, "/api/ai/chat/stream");
}

export function streamAiSideChat(input: AiChatStreamInput): Promise<void> {
  return streamAiChatAt(input, "/api/ai/side-chat/stream");
}

const AI_RUN_STREAM_RECONNECT_BASE_MS = 250;
const AI_RUN_STREAM_RECONNECT_MAX_MS = 8_000;

function waitForAiRunStreamReconnect(signal: AbortSignal, attempt: number): Promise<boolean> {
  const delay = Math.min(AI_RUN_STREAM_RECONNECT_BASE_MS * 2 ** Math.min(attempt, 5), AI_RUN_STREAM_RECONNECT_MAX_MS);
  return new Promise(resolve => {
    let timer: ReturnType<typeof setTimeout>;
    const finish = (continueStreaming: boolean): void => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      resolve(continueStreaming);
    };
    const abort = (): void => finish(false);
    timer = setTimeout(() => finish(true), delay);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}

function isRetryableAiRunStreamStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function streamAiChatAt(input: AiChatStreamInput, streamEndpoint: string): Promise<void> {
  let activeRunId = input.runId ?? null;
  let reconnectAttempt = 0;
  const deltas = createStreamDeltas(input.onDelta);
  const cancelDeltas = () => deltas.dispose();
  input.signal.addEventListener("abort", cancelDeltas, { once: true });
  try {
    while (!input.signal.aborted) {
      let response: Response;
      const requestPath = activeRunId
        ? `/ai/runs/${encodeURIComponent(activeRunId)}/events`
        : streamEndpoint.startsWith("/api/") ? streamEndpoint.slice(4) : streamEndpoint;
      const requestGeneration = authenticationGeneration;
      try {
        response = await fetch(activeRunId ? `/api/ai/runs/${encodeURIComponent(activeRunId)}/events` : streamEndpoint, {
          method: activeRunId ? "GET" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          ...(!activeRunId ? { body: JSON.stringify({ appId: input.appId, sessionId: input.sessionId, ...(input.associations ? { associations: input.associations } : {}), ...(input.projectId ? { projectId: input.projectId } : {}), ...(!input.sessionId && input.gitRepositoryId ? { gitRepositoryId: input.gitRepositoryId } : {}), ...(input.planMode === undefined ? {} : { planMode: input.planMode }), content: input.content }) } : {}),
          signal: input.signal
        });
      } catch (error) {
        if (input.signal.aborted) return;
        if (!activeRunId) throw error;
        if (!await waitForAiRunStreamReconnect(input.signal, reconnectAttempt++)) return;
        continue;
      }

      if (!response.ok) {
        let result: { message?: string; error?: string } = {};
        try { result = await response.json() as typeof result; } catch { /* 非 JSON 错误由通用 API 错误承载。 */ }
        if (isSessionAuthenticationError(response.status, result.error)) handleSessionAuthenticationFailure(requestPath, requestGeneration);
        if (activeRunId && isRetryableAiRunStreamStatus(response.status)) {
          if (!await waitForAiRunStreamReconnect(input.signal, reconnectAttempt++)) return;
          continue;
        }
        throw new ApiError(response.status, result.message ?? "AI Work 请求失败，请重试。", result.error);
      }

      if (!response.body) {
        if (!activeRunId) throw new ApiError(response.status, "浏览器无法读取 AI Work 流式响应。");
        if (!await waitForAiRunStreamReconnect(input.signal, reconnectAttempt++)) return;
        continue;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let eventName = "message";
      let dataLines: string[] = [];
      let doneReceived = false;
      const dispatch = () => {
        if (dataLines.length === 0) { eventName = "message"; return; }
        let payload: Record<string, unknown>;
        try { payload = JSON.parse(dataLines.join("\n")) as Record<string, unknown>; }
        catch { eventName = "message"; dataLines = []; return; }
        if (input.signal.aborted) { eventName = "message"; dataLines = []; return; }
        if (eventName !== "delta") deltas.flush();
        if (eventName === "input" && payload.userMessage) input.onInput?.(payload.userMessage as AiMessage);
        if (eventName === "session") {
          const assistantMessage = payload.assistantMessage as AiMessage | undefined;
          const messageRunId = typeof assistantMessage?.id === "string" ? assistantMessage.id : null;
          const declaredRunId = typeof payload.runId === "string" ? payload.runId : null;
          if (activeRunId && ((messageRunId !== null && activeRunId !== messageRunId) || (declaredRunId !== null && activeRunId !== declaredRunId))) throw new ApiError(502, "AI Work 事件流返回了不同的任务，已停止跟随。");
          if (!activeRunId) activeRunId = messageRunId ?? declaredRunId;
          input.onSession(payload as unknown as Parameters<typeof input.onSession>[0]);
        }
        if (eventName === "pause-state" && typeof payload.runId === "string"
          && (payload.state === "running" || payload.state === "pausing" || payload.state === "paused")) {
          if (activeRunId && activeRunId !== payload.runId) throw new ApiError(502, "AI Work 暂停状态属于其他任务，已停止跟随。");
          input.onPauseState?.({ runId: payload.runId, state: payload.state });
        }
        if (eventName === "plan-mode" && typeof payload.active === "boolean") input.onPlanMode?.(payload.active);
        if (eventName === "capability-settings" && payload.changed === true) input.onSettingsInvalidated?.();
        if (eventName === "activity" && typeof payload.messageId === "string" && typeof payload.activity === "object" && payload.activity !== null) {
          input.onActivity({ messageId: payload.messageId, activity: payload.activity as AiActivityItem });
        }
        if (eventName === "delta" && typeof payload.messageId === "string" && typeof payload.delta === "string") deltas.push({ messageId: payload.messageId, delta: payload.delta, ...(typeof payload.partId === "string" && typeof payload.partStart === "number" ? { partId: payload.partId, partStart: payload.partStart } : {}) });
        if (eventName === "presentation" && typeof payload.messageId === "string" && Array.isArray(payload.parts)) input.onPresentation?.({ messageId: payload.messageId, parts: payload.parts as AiReplyPart[] });
        if (eventName === "usage" && typeof payload.providerId === "string" && typeof payload.modelId === "string") {
          const sessionUsage = readAiSessionUsageSummary(payload.sessionUsage);
          const models = Array.isArray(payload.models) ? payload.models.slice(0, 64).flatMap(value => {
            if (!value || typeof value !== "object" || Array.isArray(value)) return [];
            const model = value as Record<string, unknown>;
            return typeof model.providerId === "string" && model.providerId.length <= 160 && typeof model.modelId === "string" && model.modelId.length <= 160 && isNonnegativeSafeInteger(model.requestCount)
              ? [{ providerId: model.providerId, modelId: model.modelId, requestCount: model.requestCount }]
              : [];
          }) : [];
          input.onUsage({ messageId: typeof payload.messageId === "string" ? payload.messageId : "", promptTokens: typeof payload.promptTokens === "number" ? payload.promptTokens : null, completionTokens: typeof payload.completionTokens === "number" ? payload.completionTokens : null, cacheReadTokens: typeof payload.cacheReadTokens === "number" ? payload.cacheReadTokens : null, providerId: payload.providerId, modelId: payload.modelId, ...(models.length ? { models } : {}), ...(sessionUsage ? { sessionUsage } : {}) });
        }
        if (eventName === "usage-progress" && typeof payload.messageId === "string") {
          const sessionUsage = readAiSessionUsageSummary(payload.sessionUsage);
          if (sessionUsage) input.onUsageProgress?.({ messageId: payload.messageId, sessionUsage });
        }
        if (eventName === "context-usage" && typeof payload.messageId === "string") {
          const contextUsage = readAiContextUsage(payload.contextUsage);
          if (contextUsage) input.onContextUsage?.({ messageId: payload.messageId, contextUsage });
        }
        if (eventName === "error" && typeof payload.message === "string") input.onError(payload.message);
        if (eventName === "done" && (payload.status === "complete" || payload.status === "interrupted" || payload.status === "error")) {
          doneReceived = true;
          input.onDone(payload.status);
        }
        eventName = "message";
        dataLines = [];
      };
      const processLine = (line: string): void => {
        if (line === "") dispatch();
        else if (line.startsWith("event:")) eventName = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
      };
      let readError: unknown;
      const connectedAt = Date.now();
      try {
        while (!input.signal.aborted && !doneReceived) {
          let chunk: ReadableStreamReadResult<Uint8Array>;
          try { chunk = await reader.read(); }
          catch (error) { readError = error; break; }
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          let newline = buffer.indexOf("\n");
          while (newline >= 0 && !doneReceived) {
            processLine(buffer.slice(0, newline).replace(/\r$/u, ""));
            buffer = buffer.slice(newline + 1);
            newline = buffer.indexOf("\n");
          }
        }
        buffer += decoder.decode();
        if (buffer) processLine(buffer.replace(/\r$/u, ""));
        dispatch();
      } finally {
        if (doneReceived) void reader.cancel().catch(() => undefined);
        try { reader.releaseLock(); } catch { /* 断流时读取请求可能仍在撤销；下一轮使用新的响应流。 */ }
      }

      if (input.signal.aborted) return;
      deltas.flush();
      if (doneReceived) return;
      if (!activeRunId) {
        if (readError instanceof Error) throw readError;
        throw new ApiError(response.status, "AI Work 流在确认任务结束前断开，当前任务 ID 尚未收到；请重新载入会话恢复。", "ai_run_stream_ended");
      }
      if (Date.now() - connectedAt >= 30_000) reconnectAttempt = 0;
      if (!await waitForAiRunStreamReconnect(input.signal, reconnectAttempt++)) return;
    }
  } finally {
    if (!input.signal.aborted) deltas.flush();
    deltas.dispose();
    input.signal.removeEventListener("abort", cancelDeltas);
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

export function refreshAiAccountModelCatalog(accountId: string): Promise<{ result: AiProviderProbe }> {
  return request<{ result: AiProviderProbe }>(`/settings/ai/accounts/${encodeURIComponent(accountId)}/refresh-models`, { method: "POST" });
}

export function testSavedAiAccountModel(accountId: string): Promise<{ result: AiModelTestResult }> {
  return request<{ result: AiModelTestResult }>(`/settings/ai/accounts/${encodeURIComponent(accountId)}/test-model`, { method: "POST" });
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
