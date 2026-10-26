/**
 * 功能：账户设置、会话记忆和会话的安全归档、版本化快照与恢复。
 * 所有权：编排 Settings、Conversation Memory、Session Owner；快照字节由本 Owner 持有。
 * 安全边界：只导出可移植设置和公开对话文本，不包括权限、凭据、工具原始记录或项目路径。
 */
import { createHash, randomUUID } from "node:crypto";
import { gunzip, gunzipSync, gzip, gzipSync } from "node:zlib";
import { ATTACHMENT_MAX_BYTES, ATTACHMENT_MAX_COUNT_PER_USER, ATTACHMENT_MAX_TOTAL_BYTES, normalizeAttachmentName, validateAttachmentInput, type AttachmentMediaType, type AttachmentStore } from "lfaa-attachment/src/index.js";
import { database } from "lfaa-storage-sqlite/src/database.js";
import { getConversationMemorySnapshot, replaceConversationMemories, validateConversationMemoriesInput } from "lfaa-conversation-memory/src/index.js";
import { exportPortableAiSessions, importPortableAiSessions, previewPortableAiSessionImport, validatePortableAiSessions, type PortableAiSession, type PortableAiSessionImportResult } from "lfaa-session/src/sessions.js";
import { getUserSettings, saveUserSettings, type SettingsCategory, type UserSettings } from "lfaa-settings/src/service.js";
import { validateSettingsInput } from "lfaa-settings/src/validation.js";

const format = "lfaa.account-data" as const;
const legacyArchiveVersion = 1 as const;
const portableArchiveVersion = 2 as const;
const legacyCompressedLimit = 32 * 1024 * 1024;
const legacyExpandedLimit = 128 * 1024 * 1024;
const portableCompressedLimit = 256 * 1024 * 1024;
const portableExpandedLimit = 384 * 1024 * 1024;
const portableCategories = ["general", "appearance", "shortcuts", "ai-runtime", "minecraft-runtime", "git", "personalization", "mini"] as const satisfies readonly SettingsCategory[];
type PortableCategory = typeof portableCategories[number];
type PortableSettings = Pick<UserSettings, "general" | "appearance" | "shortcuts" | "aiRuntime" | "minecraftRuntime" | "git" | "personalization" | "mini">;
const portableSettingFields = [
  ["general", "general"], ["appearance", "appearance"], ["shortcuts", "shortcuts"],
  ["ai-runtime", "aiRuntime"], ["minecraft-runtime", "minecraftRuntime"], ["git", "git"], ["personalization", "personalization"], ["mini", "mini"]
] as const satisfies ReadonlyArray<readonly [PortableCategory, keyof PortableSettings]>;
interface ArchivePayloadV1 { settings: PortableSettings; memories: string[]; sessions: PortableAiSession[] }
export interface PortableArchiveAttachment { id: string; name: string; mediaType: AttachmentMediaType; sha256: string; dataBase64: string }
interface ArchivePayloadV2 extends ArchivePayloadV1 { attachments: PortableArchiveAttachment[] }
type ArchivePayload = ArchivePayloadV1 | ArchivePayloadV2;
interface ArchiveEnvelope { format: typeof format; version: 1 | 2; createdAt: string; payloadSha256: string; payload: ArchivePayload }
interface SnapshotRow { id: string; name: string; archive_sha256: string; manifest_json: string; archive_size_bytes: number; payload_gzip: Uint8Array; created_at: string }
export interface AccountSnapshotSummary {
  id: string; name: string; version: 1; sha256: string; compressedBytes: number; expandedBytes: number; createdAt: string;
  manifest: { settingsCategories: PortableCategory[]; memories: number; sessions: number; messages: number };
}
export interface AccountArchivePreview {
  valid: true; version: 1 | 2; settingsCategories: PortableCategory[]; changedSettingsCategories: PortableCategory[];
  memories: number; memoryWillChange: boolean; sessions: number; sessionConflicts: number; messages: number;
  attachments: number; attachmentBytes: number; contextSessions: number;
}
export interface AccountArchiveRestoreResult {
  settings: { restored: PortableCategory[] };
  memories: { restored: number } | null;
  sessions: { imported: number; skipped: number } | null;
  attachments: { imported: number; reused: number } | null;
}

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

function makePayload(userId: string): ArchivePayloadV1 {
  const memory = getConversationMemorySnapshot(userId);
  return { settings: makePortableSettings(userId), memories: memory.memories, sessions: exportPortableAiSessions(userId) };
}

function encodeArchive(payloadValue: unknown, createdAt = new Date().toISOString()): Buffer {
  const payload = validatePayload(payloadValue);
  const envelope: ArchiveEnvelope = { format, version: legacyArchiveVersion, createdAt, payloadSha256: sha256(json(payload)), payload };
  const raw = Buffer.from(json(envelope), "utf8");
  if (raw.byteLength > legacyExpandedLimit) throw new Error("账户资料归档超过 128 MiB 解压大小限制。");
  const packed = gzipSync(raw, { level: 6 });
  if (packed.byteLength > legacyCompressedLimit) throw new Error("账户资料归档超过 32 MiB 压缩大小限制。");
  return packed;
}

function decodeArchive(input: Uint8Array): { envelope: ArchiveEnvelope; bytes: Buffer } {
  if (!(input instanceof Uint8Array) || input.byteLength < 1 || input.byteLength > legacyCompressedLimit) throw new Error("本机快照为空或超过 32 MiB。");
  let raw: Buffer;
  try { raw = gunzipSync(input, { maxOutputLength: legacyExpandedLimit }); }
  catch (error) { throw new Error("账户资料归档无法解压或超过解压上限。", { cause: error }); }
  let parsed: unknown;
  try { parsed = JSON.parse(raw.toString("utf8")) as unknown; }
  catch (error) { throw new Error("账户资料归档 JSON 格式无效。", { cause: error }); }
  if (!record(parsed) || parsed.format !== format || parsed.version !== legacyArchiveVersion || typeof parsed.createdAt !== "string"
    || !Number.isFinite(Date.parse(parsed.createdAt)) || typeof parsed.payloadSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(parsed.payloadSha256)) throw new Error("账户资料归档格式或版本不受支持。");
  const payload = validatePayload(parsed.payload);
  if (sha256(json(payload)) !== parsed.payloadSha256) throw new Error("账户资料归档完整性校验失败。");
  return { envelope: parsed as unknown as ArchiveEnvelope, bytes: raw };
}

function validatePayload(value: unknown): ArchivePayloadV1 {
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

function asyncGzip(input: Uint8Array): Promise<Buffer> {
  return new Promise((resolve, reject) => gzip(input, { level: 6 }, (error, result) => error ? reject(error) : resolve(result)));
}

function asyncGunzip(input: Uint8Array): Promise<Buffer> {
  return new Promise((resolve, reject) => gunzip(input, { maxOutputLength: portableExpandedLimit }, (error, result) => error ? reject(error) : resolve(result)));
}

function portableAttachmentBytes(attachment: PortableArchiveAttachment): Buffer {
  if (typeof attachment.dataBase64 !== "string" || attachment.dataBase64.length > Math.ceil(ATTACHMENT_MAX_BYTES / 3) * 4 + 4
    || !/^[A-Za-z0-9+/]*={0,2}$/u.test(attachment.dataBase64) || attachment.dataBase64.length % 4 !== 0) throw new Error("迁移包附件编码无效。");
  const data = Buffer.from(attachment.dataBase64, "base64");
  if (data.toString("base64") !== attachment.dataBase64) throw new Error("迁移包附件不是规范 base64。");
  if (data.byteLength < 1 || data.byteLength > ATTACHMENT_MAX_BYTES) throw new Error("迁移包附件超出单文件容量限制。");
  validateAttachmentInput({ mediaType: attachment.mediaType, data });
  if (!/^[a-f0-9]{64}$/u.test(attachment.sha256) || sha256(data) !== attachment.sha256) throw new Error("迁移包附件摘要校验失败。");
  return data;
}

function validatePortablePayloadV2(value: unknown): ArchivePayloadV2 {
  if (!record(value) || Object.keys(value).some(key => !["settings", "memories", "sessions", "attachments"].includes(key))
    || !Object.hasOwn(value, "settings") || !Object.hasOwn(value, "memories") || !Object.hasOwn(value, "sessions") || !Object.hasOwn(value, "attachments")) throw new Error("账户迁移包内容无效。");
  const base = validatePayload({ settings: value.settings, memories: value.memories, sessions: value.sessions });
  if (!Array.isArray(value.attachments) || value.attachments.length > ATTACHMENT_MAX_COUNT_PER_USER) throw new Error("迁移包附件数量无效或超出上限。");
  const attachments: PortableArchiveAttachment[] = [];
  const byId = new Map<string, PortableArchiveAttachment>();
  let totalBytes = 0;
  for (const candidate of value.attachments) {
    if (!record(candidate) || typeof candidate.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(candidate.id)
      || typeof candidate.name !== "string" || typeof candidate.mediaType !== "string" || !["image/png", "image/jpeg", "image/gif", "image/webp", "text/plain"].includes(candidate.mediaType)
      || typeof candidate.sha256 !== "string" || typeof candidate.dataBase64 !== "string") throw new Error("迁移包附件记录无效。");
    if (byId.has(candidate.id)) throw new Error("迁移包附件 ID 重复。");
    const attachment = { id: candidate.id, name: normalizeAttachmentName(candidate.name), mediaType: candidate.mediaType as AttachmentMediaType, sha256: candidate.sha256, dataBase64: candidate.dataBase64 };
    const bytes = portableAttachmentBytes(attachment);
    totalBytes += bytes.byteLength;
    if (totalBytes > ATTACHMENT_MAX_TOTAL_BYTES) throw new Error("迁移包引用的附件总量超过 200 MiB 上限。");
    byId.set(attachment.id, attachment);
    attachments.push(attachment);
  }
  const referenced = new Set(base.sessions.flatMap(session => session.messages.flatMap(message => (message.attachments ?? []).map(attachment => attachment.id))));
  if (referenced.size !== attachments.length || [...referenced].some(id => !byId.has(id))) throw new Error("迁移包会话引用与附件清单不匹配。");
  return { ...base, attachments };
}

async function decodeAnyArchive(input: Uint8Array): Promise<{ envelope: ArchiveEnvelope; bytes: Buffer }> {
  if (!(input instanceof Uint8Array) || input.byteLength < 1 || input.byteLength > portableCompressedLimit) throw new Error("账户资料归档为空或超过 256 MiB。");
  let raw: Buffer;
  try { raw = await asyncGunzip(input); }
  catch (error) { throw new Error("账户资料归档无法解压或超过解压上限。", { cause: error }); }
  let parsed: unknown;
  try { parsed = JSON.parse(raw.toString("utf8")) as unknown; }
  catch (error) { throw new Error("账户资料归档 JSON 格式无效。", { cause: error }); }
  if (!record(parsed) || parsed.format !== format || (parsed.version !== 1 && parsed.version !== 2) || typeof parsed.createdAt !== "string"
    || !Number.isFinite(Date.parse(parsed.createdAt)) || typeof parsed.payloadSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(parsed.payloadSha256)) throw new Error("账户资料归档格式或版本不受支持。");
  if (parsed.version === legacyArchiveVersion && (input.byteLength > legacyCompressedLimit || raw.byteLength > legacyExpandedLimit)) throw new Error("旧版 v1 归档超过 32 MiB 压缩或 128 MiB 解压上限。");
  if (sha256(json(parsed.payload)) !== parsed.payloadSha256) throw new Error("账户资料归档完整性校验失败。");
  const payload = parsed.version === 2 ? validatePortablePayloadV2(parsed.payload) : validatePayload(parsed.payload);
  return { envelope: { format, version: parsed.version, createdAt: parsed.createdAt, payloadSha256: parsed.payloadSha256, payload }, bytes: raw };
}

async function makePortablePayloadV2(userId: string, attachments: AttachmentStore): Promise<ArchivePayloadV2> {
  const sessions = exportPortableAiSessions(userId, { includeAgentContext: true });
  const referenced = new Map<string, string>();
  for (const session of sessions) for (const message of session.messages) for (const attachment of message.attachments ?? []) {
    const previousName = referenced.get(attachment.id);
    if (previousName && previousName !== attachment.name) throw new Error("同一会话附件 ID 对应了多个名称；未生成不一致的迁移包。");
    referenced.set(attachment.id, attachment.name);
  }
  if (referenced.size > ATTACHMENT_MAX_COUNT_PER_USER) throw new Error("会话引用的附件超过 200 个，未生成不完整的迁移包。");
  const portableAttachments: PortableArchiveAttachment[] = [];
  let totalBytes = 0;
  for (const [id, name] of referenced) {
    const content = await attachments.get(userId, id);
    if (content.record.userId !== userId || content.record.id !== id) throw new Error("会话附件与当前账户登记不匹配；未生成迁移包。");
    totalBytes += content.data.byteLength;
    if (totalBytes > ATTACHMENT_MAX_TOTAL_BYTES) throw new Error("会话引用的附件总量超过 200 MiB；未生成不完整的迁移包。");
    portableAttachments.push({
      id, name, mediaType: content.record.mediaType,
      sha256: sha256(content.data), dataBase64: Buffer.from(content.data).toString("base64")
    });
  }
  const payload = { settings: makePortableSettings(userId), memories: getConversationMemorySnapshot(userId).memories, sessions, attachments: portableAttachments };
  return validatePortablePayloadV2(payload);
}

async function encodePortableArchive(payload: ArchivePayloadV2, createdAt: string): Promise<{ archive: Buffer; sha256: string }> {
  const payloadJson = json(payload);
  const envelopeJson = `{"format":${JSON.stringify(format)},"version":${portableArchiveVersion},"createdAt":${JSON.stringify(createdAt)},"payloadSha256":${JSON.stringify(sha256(payloadJson))},"payload":${payloadJson}}`;
  const raw = Buffer.from(envelopeJson, "utf8");
  if (raw.byteLength > portableExpandedLimit) throw new Error("账户迁移包超过 384 MiB 解压大小限制；原始资料未修改。");
  const packed = await asyncGzip(raw);
  if (packed.byteLength > portableCompressedLimit) throw new Error("账户迁移包超过 256 MiB 压缩大小限制；原始资料未修改。");
  return { archive: packed, sha256: sha256(raw) };
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
  const raw = gunzipSync(packed, { maxOutputLength: legacyExpandedLimit });
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

export function readAccountSnapshot(userId: string, snapshotId: string): { summary: AccountSnapshotSummary; archive: Buffer; payload: ArchivePayloadV1 } | null {
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

export async function previewAccountArchive(userId: string, bytes: Uint8Array): Promise<AccountArchivePreview> {
  const decoded = await decodeAnyArchive(bytes), payload = decoded.envelope.payload;
  const currentSettings = makePortableSettings(userId);
  const changedSettingsCategories = portableSettingFields.filter(([, field]) => json(currentSettings[field]) !== json(payload.settings[field])).map(([category]) => category);
  const currentMemories = getConversationMemorySnapshot(userId).memories;
  const sessionPreview = previewPortableAiSessionImport(userId, payload.sessions);
  const messageCount = payload.sessions.reduce((sum, session) => sum + session.messages.length, 0);
  const portableAttachments = "attachments" in payload ? payload.attachments : [];
  const attachmentBytes = portableAttachments.reduce((sum, attachment) => sum + portableAttachmentBytes(attachment).byteLength, 0);
  return { valid: true, version: decoded.envelope.version, settingsCategories: [...portableCategories], changedSettingsCategories, memories: payload.memories.length,
    memoryWillChange: json(currentMemories) !== json(payload.memories), sessions: sessionPreview.sessions,
    sessionConflicts: sessionPreview.conflicts, messages: Math.max(messageCount, sessionPreview.messages),
    attachments: portableAttachments.length, attachmentBytes,
    contextSessions: payload.sessions.filter(session => Boolean(session.contextSummary) || session.messages.some(message => Boolean(message.activity?.length || message.parts?.length || message.attachments?.length))).length };
}

export async function restoreAccountArchive(userId: string, bytes: Uint8Array, selection: { settings: boolean; memories: boolean; sessions: boolean }, attachmentStore?: AttachmentStore): Promise<AccountArchiveRestoreResult> {
  if (!record(selection) || Object.keys(selection).some(key => !["settings", "memories", "sessions"].includes(key))
    || typeof selection.settings !== "boolean" || typeof selection.memories !== "boolean" || typeof selection.sessions !== "boolean"
    || !selection.settings && !selection.memories && !selection.sessions) throw new Error("请选择至少一个要恢复的资料分类。");
  const decoded = await decodeAnyArchive(bytes);
  const payload = decoded.envelope.payload;
  const portableAttachments = "attachments" in payload ? payload.attachments : [];
  if (selection.sessions && portableAttachments.length && !attachmentStore) throw new Error("当前控制端没有装配附件恢复能力；设置和记忆尚未写入。");
  const beforeSettings = getUserSettings(userId);
  const beforeMemory = getConversationMemorySnapshot(userId);
  const restoredCategories: PortableCategory[] = [];
  let memoryRevision: number | null = null;
  let sessionResult: PortableAiSessionImportResult | null = null;
  let attachmentResult: { imported: number; reused: number } | null = null;
  let sessionImportStarted = false;
  const createdAttachmentIds: string[] = [];
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
    if (selection.sessions) {
      const attachmentMap = new Map<string, { id: string; name: string; mediaType?: string }>();
      let reused = 0;
      if (portableAttachments.length) {
        const current = await attachmentStore!.list(userId);
        for (const attachment of portableAttachments) {
          const existing = current.find(item => item.sha256 === attachment.sha256 && item.mediaType === attachment.mediaType);
          if (existing) {
            attachmentMap.set(attachment.id, { id: existing.id, name: attachment.name, mediaType: existing.mediaType });
            reused++;
            continue;
          }
          const record = await attachmentStore!.put({ userId, name: attachment.name, mediaType: attachment.mediaType, data: portableAttachmentBytes(attachment) });
          createdAttachmentIds.push(record.id);
          attachmentMap.set(attachment.id, { id: record.id, name: attachment.name, mediaType: record.mediaType });
        }
      }
      sessionImportStarted = true;
      sessionResult = importPortableAiSessions(userId, payload.sessions, attachmentMap);
      attachmentResult = { imported: createdAttachmentIds.length, reused };
    }
  } catch (error) {
    if (!sessionImportStarted && attachmentStore) {
      for (const id of createdAttachmentIds) await attachmentStore.remove(userId, id).catch(() => false);
    }
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
    sessions: sessionResult ? { imported: sessionResult.imported, skipped: sessionResult.skipped } : null, attachments: attachmentResult };
}

export function decodeAccountArchive(bytes: Uint8Array): { payload: ArchivePayload; createdAt: string; sha256: string } {
  const decoded = decodeArchive(bytes);
  return { payload: decoded.envelope.payload, createdAt: decoded.envelope.createdAt, sha256: sha256(decoded.bytes) };
}

export async function exportCurrentAccountArchive(userId: string, attachments: AttachmentStore): Promise<{ archive: Buffer; createdAt: string; sha256: string }> {
  const createdAt = new Date().toISOString();
  const payload = await makePortablePayloadV2(userId, attachments);
  const encoded = await encodePortableArchive(payload, createdAt);
  return { ...encoded, createdAt };
}
