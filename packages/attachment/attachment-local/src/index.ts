/**
 * 功能：本机附件存储提供方（账户隔离、有界、原子写入）。
 * 作用：把附件按账户写进 LFAA Data 的 users/<账户哈希>/attachments/，并在读取时重验摘要与路径围栏。
 * 关联文件：packages/attachment/attachment（合同）、lfaa-home-paths、lfaa-settings/project-storage。
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { Context } from "@deepseek-ai/cordis";
import { resolveUserDataPaths } from "lfaa-home-paths/src/data-layout.mjs";
import { reencodeWithSharp } from "./sharp-normalize.js";
import { getProjectStorageLocations } from "lfaa-settings/src/project-storage.js";
import { ATTACHMENT_MAX_COUNT_PER_USER, ATTACHMENT_MAX_DIMENSION, ATTACHMENT_MAX_TOTAL_BYTES, normalizeAttachmentImage, normalizeAttachmentName, validateAttachmentInput, type AttachmentContent, type AttachmentMediaType, type AttachmentRecord, type AttachmentStore } from "lfaa-attachment/src/index.js";

/** 附件 ID 是文件名主体，必须是 UUID，拒绝任何路径成分。 */
const ATTACHMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const EXTENSION: Record<AttachmentMediaType, string> = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp", "text/plain": "txt" };
const MAX_LISTED_ATTACHMENTS = 200;

function sha256(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

function isInside(root: string, target: string): boolean {
  const rel = relative(resolve(root), resolve(target));
  return rel === "" || (rel !== ".." && !rel.startsWith(".." + sep) && !isAbsolute(rel));
}

/** 每个账户一个附件根；默认 Data 根来自设置中心的统一存储位置，不接受调用方传路径。 */
function attachmentRoot(userId: string, dataDirectory: string): string {
  const userRoot = resolveUserDataPaths(dataDirectory, userId).root;
  const root = resolve(userRoot, "attachments");
  if (!isInside(userRoot, root)) throw new Error("附件目录超出账户数据根。");
  return root;
}

export function createLocalAttachmentStore(options: { dataDirectory?: () => string } = {}): AttachmentStore {
  const resolveDataDirectory = options.dataDirectory ?? (() => getProjectStorageLocations().settings.contentDirectory);
  const rootFor = (userId: string) => attachmentRoot(userId, resolveDataDirectory());
  return {
    async put({ userId, name, mediaType, data }): Promise<AttachmentRecord> {
      validateAttachmentInput({ mediaType, data });
      // 先规范化再落盘：删除 EXIF/GPS 等敏感元数据，超尺寸图片直接拒绝；摘要按规范化后的字节计算。
      // 先用字节级规范化（同时读出尺寸、删除敏感块）；只有超大/大体积图才交给 sharp 重编码。
      const stripped = mediaType.startsWith("image/") ? normalizeAttachmentImage(mediaType, data) : { data, width: null, height: null };
      if (!mediaType.startsWith("image/") || mediaType === "image/gif") { data = stripped.data; }
      const longest = Math.max(stripped.width ?? 0, stripped.height ?? 0);
      const needsReencode = mediaType.startsWith("image/") && mediaType !== "image/gif" && (longest > 2048 || stripped.data.byteLength > 1.5 * 1024 * 1024);
      const reencoded = needsReencode ? await reencodeWithSharp(mediaType, data) : null;
      if (reencoded) { mediaType = reencoded.mediaType as AttachmentMediaType; data = reencoded.data; }
      const normalized = reencoded ? { data: reencoded.data, width: reencoded.width, height: reencoded.height } : stripped;
      if (normalized.width !== null && normalized.width > ATTACHMENT_MAX_DIMENSION || normalized.height !== null && normalized.height > ATTACHMENT_MAX_DIMENSION) {
        throw new Error("图片尺寸超过 " + ATTACHMENT_MAX_DIMENSION + " 像素上限（" + normalized.width + "×" + normalized.height + "）。");
      }
      data = normalized.data;
      const safeName = normalizeAttachmentName(name);
      // 配额在写入前判断：超限直接拒绝，不覆盖、不静默删除已有附件。
      const usage = await this.usage(userId);
      if (usage.count >= ATTACHMENT_MAX_COUNT_PER_USER) throw new Error("附件配额已满（" + ATTACHMENT_MAX_COUNT_PER_USER + " 个）；请先删除不再需要的附件。");
      if (usage.bytes + data.byteLength > ATTACHMENT_MAX_TOTAL_BYTES) throw new Error("附件总容量将超过上限（" + Math.round(ATTACHMENT_MAX_TOTAL_BYTES / 1024 / 1024) + " MiB）；请先删除不再需要的附件。");
      const root = rootFor(userId);
      await mkdir(root, { recursive: true });
      const id = randomUUID();
      const digest = sha256(data);
      const record: AttachmentRecord = { id, userId, name: safeName, mediaType, bytes: data.byteLength, sha256: digest, createdAt: new Date().toISOString() };
      const file = resolve(root, id + "." + EXTENSION[mediaType]);
      const meta = resolve(root, id + ".json");
      if (!isInside(root, file) || !isInside(root, meta)) throw new Error("附件写入路径超出账户附件根。");
      const temporary = file + ".tmp";
      await writeFile(temporary, data, { flag: "wx" });
      await rename(temporary, file);
      await writeFile(meta, JSON.stringify(record), { encoding: "utf8", flag: "wx" });
      // 写入后立即回读摘要，避免把未落盘的字节当成已保存。
      const readBack = await readFile(file);
      if (sha256(readBack) !== digest) throw new Error("附件写入回读摘要不一致；已拒绝登记。");
      return record;
    },
    async get(userId, id): Promise<AttachmentContent> {
      if (!ATTACHMENT_ID.test(id)) throw new Error("附件 ID 无效。");
      const root = rootFor(userId);
      const metaPath = resolve(root, id + ".json");
      if (!isInside(root, metaPath)) throw new Error("附件路径超出账户附件根。");
      const record = JSON.parse(await readFile(metaPath, "utf8")) as AttachmentRecord;
      if (record.id !== id || record.userId !== userId) throw new Error("附件记录不属于当前账户。");
      const file = resolve(root, id + "." + EXTENSION[record.mediaType]);
      if (!isInside(root, file)) throw new Error("附件路径超出账户附件根。");
      const data = await readFile(file);
      if (sha256(data) !== record.sha256) throw new Error("附件内容与登记摘要不一致；已拒绝读取。");
      return { record, data };
    },
    async list(userId): Promise<AttachmentRecord[]> {
      const root = rootFor(userId);
      let names: string[];
      try { names = await readdir(root); } catch { return []; }
      const ids = names.filter(name => name.endsWith(".json")).map(name => name.slice(0, -5)).filter(id => ATTACHMENT_ID.test(id)).slice(0, MAX_LISTED_ATTACHMENTS);
      const records: AttachmentRecord[] = [];
      for (const id of ids) {
        try {
          const record = JSON.parse(await readFile(resolve(root, id + ".json"), "utf8")) as AttachmentRecord;
          if (record?.id === id && record.userId === userId) records.push(record);
        } catch { /* 损坏记录不计入清单，也不删除文件。 */ }
      }
      return records.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    },
    async usage(userId) {
      const records = await this.list(userId);
      return { count: records.length, bytes: records.reduce((sum, item) => sum + item.bytes, 0) };
    },
    async remove(userId, id) {
      if (!ATTACHMENT_ID.test(id)) throw new Error("附件 ID 无效。");
      const root = rootFor(userId);
      const metaPath = resolve(root, id + ".json");
      const record = JSON.parse(await readFile(metaPath, "utf8").catch(() => "null")) as AttachmentRecord | null;
      if (!record || record.id !== id || record.userId !== userId) return false;
      await unlink(resolve(root, id + "." + EXTENSION[record.mediaType])).catch(() => undefined);
      await unlink(metaPath).catch(() => undefined);
      return true;
    }
  };
}

export const name = "lfaaAttachmentLocal";
export function apply(ctx: Context): void {
  ctx.provide("lfaaAttachments", createLocalAttachmentStore());
}

declare module "@deepseek-ai/cordis" { interface Context { lfaaAttachments: AttachmentStore } }
