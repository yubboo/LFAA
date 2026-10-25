/**
 * 功能：账户设置、会话记忆和会话的安全归档、版本化快照与恢复。
 * 所有权：编排 Settings、Conversation Memory、Session Owner；快照字节由本 Owner 持有。
 * 安全边界：只导出可移植设置和公开对话文本，不包括权限、凭据、工具原始记录或项目路径。
 */
import { createHash, randomUUID } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { database } from "lfaa-storage-sqlite/src/database.js";
import { getConversationMemorySnapshot, replaceConversationMemories, validateConversationMemoriesInput } from "lfaa-conversation-memory/src/index.js";
import { exportPortableAiSessions, importPortableAiSessions, previewPortableAiSessionImport, validatePortableAiSessions, type PortableAiSession, type PortableAiSessionImportResult } from "lfaa-session/src/sessions.js";
import { getUserSettings, saveUserSettings, type SettingsCategory, type UserSettings } from "lfaa-settings/src/service.js";
import { validateSettingsInput } from "lfaa-settings/src/validation.js";

const format = "lfaa.account-data" as const;
const archiveVersion = 1 as const;
const compressedLimit = 32 * 1024 * 1024;
const expandedLimit = 128 * 1024 * 1024;
const portableCategories = ["general", "appearance", "shortcuts", "ai-runtime", "minecraft-runtime", "git", "personalization", "mini"] as const satisfies readonly SettingsCategory[];
type PortableCategory = typeof portableCategories[number];
type PortableSettings = Pick<UserSettings, "general" | "appearance" | "shortcuts" | "aiRuntime" | "minecraftRuntime" | "git" | "personalization" | "mini">;
const portableSettingFields = [
  ["general", "general"], ["appearance", "appearance"], ["shortcuts", "shortcuts"],
  ["ai-runtime", "aiRuntime"], ["minecraft-runtime", "minecraftRuntime"], ["git", "git"], ["personalization", "personalization"], ["mini", "mini"]
] as const satisfies ReadonlyArray<readonly [PortableCategory, keyof PortableSettings]>;
interface ArchivePayload { settings: PortableSettings; memories: string[]; sessions: PortableAiSession[] }
interface ArchiveEnvelope { format: typeof format; version: typeof archiveVersion; createdAt: string; payloadSha256: string; payload: ArchivePayload }
interface SnapshotRow { id: string; name: string; archive_sha256: string; manifest_json: string; archive_size_bytes: number; payload_gzip: Uint8Array; created_at: string }
export interface AccountSnapshotSummary {
  id: string; name: string; version: 1; sha256: string; compressedBytes: number; expandedBytes: number; createdAt: string;
  manifest: { settingsCategories: PortableCategory[]; memories: number; sessions: number; messages: number };
}
export interface AccountArchivePreview {
  valid: true; version: 1; settingsCategories: PortableCategory[]; changedSettingsCategories: PortableCategory[];
  memories: number; memoryWillChange: boolean; sessions: number; sessionConflicts: number; messages: number;
}
export interface AccountArchiveRestoreResult { settings: { restored: PortableCategory[] }; memories: { restored: number } | null; sessions: { imported: number; skipped: number } | null }

function record(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function sha256(value: Uint8Array | string): string { return createHash("sha256").update(value).digest("hex"); }
function json(value: unknown): string { return JSON.stringify(value); }

function makePortableSettings(userId: string): PortableSettings {
  const value = structuredClone(getUserSettings(userId));
  value.general.taskFolder = "";
  for (const area of Object.keys(value.appearance.backgrounds) as Array<keyof UserSettings["appearance"]["backgrounds"]>) {
    if (value.appearance.backgrounds[area].startsWith("user-")) value.appearance.backgrounds[area] = "none";
  }
  value.appearance.wallpaperEngine = { enabled: false, projectId: "" };
  value.aiRuntime.subagentAccountId = "";
  value.aiRuntime.imageGenerationAccountId = "";
  value.aiRuntime.imageGenerationModelId = "";
  value.aiRuntime.imageGenerationLocalModelId = "";
  value.aiRuntime.videoGenerationAccountId = "";
  value.aiRuntime.videoGenerationModelId = "";
  value.aiRuntime.videoGenerationLocalModelId = "";
  return {
    general: value.general, appearance: value.appearance, shortcuts: value.shortcuts,
    aiRuntime: value.aiRuntime, minecraftRuntime: value.minecraftRuntime, git: value.git, personalization: value.personalization, mini: value.mini
  };
}

function checkedSettings(value: unknown): PortableSettings {
  const fields = portableSettingFields.map(([, field]) => field);
  if (!record(value) || Object.keys(value).some(key => !fields.includes(key as keyof PortableSettings))
    || fields.some(field => !Object.hasOwn(value, field))) throw new Error("归档设置分类不完整或包含权限/凭据类设置。");
  const result: Record<string, unknown> = {};
  for (const [category, field] of portableSettingFields) {
    const candidate = value[field];
    if (!record(candidate)) throw new Error(`归档设置分类 ${category} 格式无效。`);
    try { result[field] = validateSettingsInput(category, candidate); }
    catch (error) { throw new Error(`归档设置分类 ${category} 未通过 Settings Owner 校验。`, { cause: error }); }
  }
  const appearance = result.appearance as UserSettings["appearance"];
  for (const background of Object.values(appearance.backgrounds)) if (background.startsWith("user-")) throw new Error("归档引用了未随包迁移的本机背景图片。");
  return result as PortableSettings;
}

function makePayload(userId: string): ArchivePayload {
  const memory = getConversationMemorySnapshot(userId);
  return { settings: makePortableSettings(userId), memories: memory.memories, sessions: exportPortableAiSessions(userId) };
}

function encodeArchive(payloadValue: unknown, createdAt = new Date().toISOString()): Buffer {
  const payload = validatePayload(payloadValue);
  const envelope: ArchiveEnvelope = { format, version: archiveVersion, createdAt, payloadSha256: sha256(json(payload)), payload };
  const raw = Buffer.from(json(envelope), "utf8");
  if (raw.byteLength > expandedLimit) throw new Error("账户资料归档超过 128 MiB 解压大小限制。");
  const packed = gzipSync(raw, { level: 6 });
  if (packed.byteLength > compressedLimit) throw new Error("账户资料归档超过 32 MiB 压缩大小限制。");
  return packed;
}

function decodeArchive(input: Uint8Array): { envelope: ArchiveEnvelope; bytes: Buffer } {
  if (!(input instanceof Uint8Array) || input.byteLength < 1 || input.byteLength > compressedLimit) throw new Error("账户资料归档文件为空或超过 32 MiB。");
  let raw: Buffer;
  try { raw = gunzipSync(input, { maxOutputLength: expandedLimit }); }
  catch (error) { throw new Error("账户资料归档无法解压或超过解压上限。", { cause: error }); }
  let parsed: unknown;
  try { parsed = JSON.parse(raw.toString("utf8")) as unknown; }
  catch (error) { throw new Error("账户资料归档 JSON 格式无效。", { cause: error }); }
  if (!record(parsed) || parsed.format !== format || parsed.version !== archiveVersion || typeof parsed.createdAt !== "string"
    || !Number.isFinite(Date.parse(parsed.createdAt)) || typeof parsed.payloadSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(parsed.payloadSha256)) throw new Error("账户资料归档格式或版本不受支持。");
  const payload = validatePayload(parsed.payload);
  if (sha256(json(payload)) !== parsed.payloadSha256) throw new Error("账户资料归档完整性校验失败。");
  return { envelope: parsed as unknown as ArchiveEnvelope, bytes: raw };
}

function validatePayload(value: unknown): ArchivePayload {
  if (!record(value) || Object.keys(value).some(key => !["settings", "memories", "sessions"].includes(key))
    || !Object.hasOwn(value, "settings") || !Object.hasOwn(value, "memories") || !Object.hasOwn(value, "sessions")) throw new Error("账户资料归档内容无效。");
  const settings = checkedSettings(value.settings);
  const memories = validateConversationMemoriesInput(value.memories);
  if (!memories) throw new Error("归档记忆未通过 Conversation Memory Owner 校验。");
  if (!Array.isArray(value.sessions)) throw new Error("归档会话列表无效。");
  // Session Owner 执行全部归属、字段与预算校验；传入临时副本不会写入。
  const sessions = validatePortableAiSessions(value.sessions);
  return { settings, memories, sessions };
}

function summary(row: Pick<SnapshotRow, "id" | "name" | "archive_sha256" | "manifest_json" | "archive_size_bytes" | "created_at" | "payload_gzip">): AccountSnapshotSummary {
  let manifest: AccountSnapshotSummary["manifest"];
  try { manifest = JSON.parse(row.manifest_json) as AccountSnapshotSummary["manifest"]; }
  catch { throw new Error("快照索引损坏，拒绝伪造快照状态。"); }
  return { id: row.id, name: row.name, version: 1, sha256: row.archive_sha256, compressedBytes: row.payload_gzip.byteLength, expandedBytes: Number(row.archive_size_bytes), createdAt: row.created_at, manifest };
}

export function createAccountSnapshot(userId: string, nameValue: string): AccountSnapshotSummary {
  const name = nameValue.trim().replace(/[\u0000-\u001f\u007f]/gu, " ").replace(/\s+/gu, " ").slice(0, 120);
  if (!name) throw new Error("快照名称不能为空。");
  if (Number(database.prepare("SELECT COUNT(*) AS count FROM account_snapshots WHERE user_id = ?").get(userId)!.count) >= 50) throw new Error("当前账户已达 50 个快照上限；请先删除不需要的快照。");
  const createdAt = new Date().toISOString();
  const payload = makePayload(userId), packed = encodeArchive(payload, createdAt);
  const raw = gunzipSync(packed, { maxOutputLength: expandedLimit });
  const id = randomUUID(), hash = sha256(raw);
  const messages = payload.sessions.reduce((sum, session) => sum + session.messages.length, 0);
  const manifest: AccountSnapshotSummary["manifest"] = { settingsCategories: [...portableCategories], memories: payload.memories.length, sessions: payload.sessions.length, messages };
  database.prepare("INSERT INTO account_snapshots (id, user_id, name, archive_version, archive_sha256, manifest_json, archive_size_bytes, payload_gzip, created_at) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?)")
    .run(id, userId, name, hash, json(manifest), raw.byteLength, packed, createdAt);
  const row = database.prepare("SELECT id, name, archive_sha256, manifest_json, archive_size_bytes, payload_gzip, created_at FROM account_snapshots WHERE id = ? AND user_id = ?").get(id, userId) as SnapshotRow | undefined;
  if (!row) throw new Error("快照已写入但回读缺失；请检查账户快照列表。");
  return summary(row);
}

export function listAccountSnapshots(userId: string): AccountSnapshotSummary[] {
  return (database.prepare("SELECT id, name, archive_sha256, manifest_json, archive_size_bytes, payload_gzip, created_at FROM account_snapshots WHERE user_id = ? ORDER BY created_at DESC, id LIMIT 50").all(userId) as unknown as SnapshotRow[]).map(summary);
}

export function readAccountSnapshot(userId: string, snapshotId: string): { summary: AccountSnapshotSummary; archive: Buffer; payload: ArchivePayload } | null {
  const row = database.prepare("SELECT id, name, archive_sha256, manifest_json, archive_size_bytes, payload_gzip, created_at FROM account_snapshots WHERE id = ? AND user_id = ?").get(snapshotId, userId) as SnapshotRow | undefined;
  if (!row) return null;
  const stored = Buffer.from(row.payload_gzip);
  const decoded = decodeArchive(stored);
  if (sha256(decoded.bytes) !== row.archive_sha256 || decoded.bytes.byteLength !== Number(row.archive_size_bytes)) throw new Error("账户快照内容与索引摘要不匹配；拒绝导出或恢复。");
  return { summary: summary(row), archive: stored, payload: decoded.envelope.payload };
}

export function deleteAccountSnapshot(userId: string, snapshotId: string): boolean {
  return database.prepare("DELETE FROM account_snapshots WHERE id = ? AND user_id = ?").run(snapshotId, userId).changes === 1;
}

export function previewAccountArchive(userId: string, bytes: Uint8Array): AccountArchivePreview {
  const decoded = decodeArchive(bytes), payload = decoded.envelope.payload;
  const currentSettings = makePortableSettings(userId);
  const changedSettingsCategories = portableSettingFields.filter(([, field]) => json(currentSettings[field]) !== json(payload.settings[field])).map(([category]) => category);
  const currentMemories = getConversationMemorySnapshot(userId).memories;
  const sessionPreview = previewPortableAiSessionImport(userId, payload.sessions);
  const messageCount = payload.sessions.reduce((sum, session) => sum + session.messages.length, 0);
  return { valid: true, version: 1, settingsCategories: [...portableCategories], changedSettingsCategories, memories: payload.memories.length,
    memoryWillChange: json(currentMemories) !== json(payload.memories), sessions: sessionPreview.sessions,
    sessionConflicts: sessionPreview.conflicts, messages: Math.max(messageCount, sessionPreview.messages) };
}

export function restoreAccountArchive(userId: string, bytes: Uint8Array, selection: { settings: boolean; memories: boolean; sessions: boolean }): AccountArchiveRestoreResult {
  if (!record(selection) || Object.keys(selection).some(key => !["settings", "memories", "sessions"].includes(key))
    || typeof selection.settings !== "boolean" || typeof selection.memories !== "boolean" || typeof selection.sessions !== "boolean"
    || !selection.settings && !selection.memories && !selection.sessions) throw new Error("请选择至少一个要恢复的资料分类。");
  const payload = decodeArchive(bytes).envelope.payload;
  const beforeSettings = getUserSettings(userId);
  const beforeMemory = getConversationMemorySnapshot(userId);
  const restoredCategories: PortableCategory[] = [];
  let memoryRevision: number | null = null;
  let sessionResult: PortableAiSessionImportResult | null = null;
  try {
    if (selection.settings) {
      for (const [category, field] of portableSettingFields) {
        saveUserSettings(userId, category, payload.settings[field] as never);
        restoredCategories.push(category);
      }
    }
    if (selection.memories) {
      if (!replaceConversationMemories(userId, payload.memories, beforeMemory.revision)) throw new Error("记忆在预览后已变化；恢复已中止，请重新预览。");
      memoryRevision = getConversationMemorySnapshot(userId).revision;
    }
    if (selection.sessions) sessionResult = importPortableAiSessions(userId, payload.sessions);
  } catch (error) {
    try {
      if (memoryRevision !== null) replaceConversationMemories(userId, beforeMemory.memories, memoryRevision);
      if (selection.settings && restoredCategories.length) {
        for (const [category, field] of portableSettingFields) {
          if (restoredCategories.includes(category)) saveUserSettings(userId, category, beforeSettings[field] as never);
        }
      }
    } catch (rollbackError) { throw new Error("资料恢复失败；自动恢复设置或记忆时也失败。请保留快照并检查当前设置与记忆。", { cause: new AggregateError([error, rollbackError]) }); }
    throw error;
  }
  return { settings: { restored: restoredCategories }, memories: selection.memories ? { restored: payload.memories.length } : null,
    sessions: sessionResult ? { imported: sessionResult.imported, skipped: sessionResult.skipped } : null };
}

export function decodeAccountArchive(bytes: Uint8Array): { payload: ArchivePayload; createdAt: string; sha256: string } {
  const decoded = decodeArchive(bytes);
  return { payload: decoded.envelope.payload, createdAt: decoded.envelope.createdAt, sha256: sha256(decoded.bytes) };
}

export function exportCurrentAccountArchive(userId: string): { archive: Buffer; createdAt: string; sha256: string } {
  const createdAt = new Date().toISOString();
  const archive = encodeArchive(makePayload(userId), createdAt);
  const decoded = decodeArchive(archive);
  return { archive, createdAt, sha256: sha256(decoded.bytes) };
}
