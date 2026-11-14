/**
 * Account Settings Client DTO 与认证端点。真实设置、记忆、快照与背景仍由 Settings/Memory Owner 持有。
 */
import { request, requestBinary } from "./http-client.js";
import type { ApplicationId } from "lfaa-util-values/src/application-id.js";
import type { AppearancePresetSnapshot, UserSettings } from "lfaa-util-values/src/settings-contract.js";



export function deleteAppearanceBackground(id: string): Promise<void> {
  return request<void>(`/settings/backgrounds/${encodeURIComponent(id)}`, { method: "DELETE" });
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


export function downloadAppearanceBackground(id: string): Promise<Blob> {
  return requestBinary(`/settings/backgrounds/${encodeURIComponent(id)}`);
}


export function loadAppearanceBackgrounds(): Promise<{ backgrounds: AppearanceBackground[] }> {
  return request<{ backgrounds: AppearanceBackground[] }>("/settings/backgrounds");
}

export function restoreAccountArchiveFile(file: File, selection: AccountArchiveSelection): Promise<{ result: AccountArchiveRestoreResult }> {
  const query = new URLSearchParams({ settings: String(selection.settings), memories: String(selection.memories), sessions: String(selection.sessions) });
  return request(`/settings/import/restore?${query}`, { method: "POST", headers: { "Content-Type": "application/vnd.lfaa.account-snapshot" }, body: file });
}

export function previewAccountArchiveFile(file: File): Promise<{ preview: AccountArchivePreview }> {
  return request("/settings/import/preview", { method: "POST", headers: { "Content-Type": "application/vnd.lfaa.account-snapshot" }, body: file });
}

export function exportCurrentAccountArchive(): Promise<Blob> { return requestBinary("/settings/import/export"); }

export function downloadAccountSnapshot(snapshotId: string): Promise<Blob> {
  return requestBinary(`/settings/snapshots/${encodeURIComponent(snapshotId)}/download`);
}

export function restoreAccountSnapshot(snapshotId: string, selection: AccountArchiveSelection): Promise<{ result: AccountArchiveRestoreResult }> {
  return request(`/settings/snapshots/${encodeURIComponent(snapshotId)}/restore`, { method: "POST", body: JSON.stringify(selection) });
}

export function previewAccountSnapshotRestore(snapshotId: string): Promise<{ preview: AccountArchivePreview }> {
  return request(`/settings/snapshots/${encodeURIComponent(snapshotId)}/preview`, { method: "POST" });
}

export function deleteAccountSnapshot(snapshotId: string): Promise<void> {
  return request(`/settings/snapshots/${encodeURIComponent(snapshotId)}`, { method: "DELETE" });
}

export function createAccountSnapshot(name: string): Promise<{ snapshot: AccountSnapshotSummary }> {
  return request("/settings/snapshots", { method: "POST", body: JSON.stringify({ name }) });
}


export function loadAccountSnapshots(): Promise<{ snapshots: AccountSnapshotSummary[] }> { return request("/settings/snapshots"); }

export interface AccountArchiveRestoreResult {
  settings: { restored: string[] };
  memories: { restored: number } | null;
  sessions: { imported: number; skipped: number } | null;
  attachments: { imported: number; reused: number } | null;
}

export interface AccountArchiveSelection { settings: boolean; memories: boolean; sessions: boolean }

export interface AccountArchivePreview {
  valid: true; version: 1 | 2; settingsCategories: string[]; changedSettingsCategories: string[];
  memories: number; memoryWillChange: boolean; sessions: number; sessionConflicts: number; messages: number;
  attachments: number; attachmentBytes: number; contextSessions: number;
}


export interface AccountSnapshotSummary {
  id: string; name: string; version: 1; sha256: string; compressedBytes: number; expandedBytes: number; createdAt: string;
  manifest: { settingsCategories: string[]; memories: number; sessions: number; messages: number };
}


export function saveAgentUsagePolicy(accountId: string, policy: AccountAgentUsagePolicy): Promise<{ controls: AccountAgentUsageControls }> {
  return request(`/settings/parental/${encodeURIComponent(accountId)}`, { method: "PUT", body: JSON.stringify(policy) });
}


export function loadAgentUsageControls(accountId?: string): Promise<{ controls: AccountAgentUsageControls; manageableAccounts: ManagedAgentUsageAccount[] }> {
  const query = accountId ? `?${new URLSearchParams({ accountId })}` : "";
  return request(`/settings/parental${query}`);
}


export interface ManagedAgentUsageAccount { id: string; username: string; role: "admin" | "member"; }


export interface AccountAgentUsageControls {
  account: { id: string; username: string; role: "admin" | "member" };
  policy: AccountAgentUsagePolicy;
  updatedAt: string | null;
  usedSeconds: number;
  localDate: string;
  activeReservations: number;
}


export interface AccountAgentUsagePolicy {
  enabled: boolean;
  timezone: string;
  dailyLimitMinutes: number;
  weeklyWindows: Array<{ enabled: boolean; start: string; end: string }>;
}


export function revokeMemoryAgentConnectionToken(): Promise<void> {
  return request<void>("/settings/memory-agent-connection/token", { method: "DELETE" });
}


export function createMemoryAgentConnectionToken(): Promise<MemoryAgentConnectionToken> {
  return request("/settings/memory-agent-connection/token", { method: "POST", body: "{}" });
}


export function loadMemoryAgentConnection(): Promise<{ connection: MemoryAgentConnectionStatus }> {
  return request("/settings/memory-agent-connection");
}


export function deleteConversationMemories(): Promise<void> {
  return request<void>("/settings/memories", { method: "DELETE" });
}


export function saveConversationMemories(snapshot: ConversationMemorySnapshot): Promise<{ snapshot: ConversationMemorySnapshot }> {
  return request("/settings/memories", { method: "PUT", body: JSON.stringify(snapshot) });
}


export function loadConversationMemories(): Promise<{ snapshot: ConversationMemorySnapshot }> {
  return request("/settings/memories");
}

export interface MemoryAgentConnectionToken { token: string; createdAt: string; endpoint: string }


export interface MemoryAgentConnectionStatus { active: boolean; createdAt: string | null }


export interface ConversationMemorySnapshot { memories: string[]; revision: number }


export function validateAppearancePresetSnapshot(snapshot: AppearancePresetSnapshot): Promise<{ valid: true }> {
  return request<{ valid: true }>("/settings/appearance-presets/validate", {
    method: "POST",
    body: JSON.stringify(snapshot)
  });
}


export function applyAppearancePreset(snapshot: AppearancePresetSnapshot): Promise<{ settings: UserSettings }> {
  return request<{ settings: UserSettings }>("/settings/appearance-presets/apply", {
    method: "POST",
    body: JSON.stringify(snapshot)
  });
}


export function saveSettings<K extends keyof UserSettings>(category: K, value: UserSettings[K]): Promise<{ settings: UserSettings }> {
  const serverCategory = category === "aiRuntime" ? "ai-runtime" : category === "minecraftRuntime" ? "minecraft-runtime" : category === "computerControl" ? "computer-control" : category === "browserUse" ? "browser-use" : category;
  return request<{ settings: UserSettings }>(`/settings/${serverCategory}`, {
    method: "PUT",
    body: JSON.stringify(value),
    keepalive: true
  });
}


export function loadUserSettingsSyncStatus(signal?: AbortSignal): Promise<{ status: UserSettingsSyncStatus }> {
  return request("/settings/sync/status", signal ? { signal } : {});
}


export interface UserSettingsSyncStatus {
  service: "lfaa-self-hosted";
  categories: string[];
  lastUpdatedAt: string | null;
  scope: "same-control-plane";
}


export function loadSettings(signal?: AbortSignal): Promise<{ settings: UserSettings }> {
  return request<{ settings: UserSettings }>("/settings", signal ? { signal } : {});
}


export function savePreferences(preferences: UserPreferences): Promise<{ preferences: UserPreferences }> {
  return request<{ preferences: UserPreferences }>("/preferences", {
    method: "PUT",
    body: JSON.stringify(preferences)
  });
}


export function loadPreferences(): Promise<{ preferences: UserPreferences }> {
  return request<{ preferences: UserPreferences }>("/preferences");
}


export interface AppearanceBackground {
  id: string;
  name: string;
  mimeType: string;
  url: string;
  createdAt: string;
}


export interface UserPreferences {
  selectedApp: ApplicationId;
  selectedMode: ApplicationMode;
  guidedEntryCompleted: boolean;
}

export type ApplicationMode = "normal" | "ai-work";
