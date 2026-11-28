// 统一回收站本地存储：按 FreeDesktop 风格以 meta.json + payload/ 管理素材、资产、画布与项目的软删除、30 天自动清理、恢复与彻底删除。
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";

export type TrashItemKind = "media" | "asset" | "canvas" | "project";

export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export interface TrashItemMeta {
  id: string;
  kind: TrashItemKind;
  title: string;
  deletedAt: number;
  expiresAt: number;
  originLabel?: string;
  previewRelPath?: string;
  previewMime?: string;
  sizeBytes?: number;
  origin: Record<string, unknown>;
}

export interface TrashListItem {
  id: string;
  kind: TrashItemKind;
  title: string;
  deletedAt: number;
  expiresAt: number;
  remainingDays: number;
  originLabel?: string;
  previewUrl?: string;
  sizeBytes?: number;
  origin: Record<string, unknown>;
}

/** 跨设备安全移动：rename 遇 EXDEV 时降级为 cp + rm。 */
export async function moveEntrySafe(src: string, dest: string): Promise<void> {
  await mkdir(dirname(dest), { recursive: true });
  try {
    await rename(src, dest);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "EXDEV" && code !== "EPERM") throw error;
    await cp(src, dest, { recursive: true, force: true });
    await rm(src, { recursive: true, force: true });
  }
}

/** 构造避免覆盖已有文件的目标路径（自动追加 ` (恢复 N)`）。 */
export function resolveConflictPath(targetPath: string): string {
  if (!existsSync(targetPath)) return targetPath;
  const dir = dirname(targetPath);
  const ext = extname(targetPath);
  const stem = basename(targetPath, ext);
  for (let i = 1; i < 1000; i += 1) {
    const candidate = join(dir, `${stem} (恢复${i > 1 ? ` ${i}` : ""})${ext}`);
    if (!existsSync(candidate)) return candidate;
  }
  return join(dir, `${stem}-${Date.now()}${ext}`);
}

function guessMimeFromPath(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".webm") return "video/webm";
  return "application/octet-stream";
}

async function computeSizeBytes(target: string): Promise<number> {
  const info = await stat(target).catch(() => null);
  if (!info) return 0;
  if (!info.isDirectory()) return info.size;
  const entries = await readdir(target, { withFileTypes: true }).catch(() => []);
  let total = 0;
  for (const entry of entries) {
    total += await computeSizeBytes(join(target, entry.name));
  }
  return total;
}

/** 统一回收站磁盘管理器（根目录 `<dataDir>/trash/items/<id>/`）。 */
export class TrashStore {
  readonly itemsRoot: string;

  constructor(trashRoot: string) {
    this.itemsRoot = join(resolve(trashRoot), "items");
  }

  itemDir(id: string): string {
    return join(this.itemsRoot, id);
  }

  payloadDir(id: string): string {
    return join(this.itemDir(id), "payload");
  }

  private metaFile(id: string): string {
    return join(this.itemDir(id), "meta.json");
  }

  private async writeMeta(meta: TrashItemMeta): Promise<void> {
    await mkdir(this.itemDir(meta.id), { recursive: true });
    // 在同一目录写完临时文件后再发布，避免列表读取到半截 JSON。
    const metaFile = this.metaFile(meta.id);
    const pendingFile = `${metaFile}.pending`;
    await writeFile(pendingFile, JSON.stringify(meta, null, 2), "utf8");
    await rename(pendingFile, metaFile);
  }

  async getMeta(id: string): Promise<TrashItemMeta | null> {
    if (!id || id.includes("/") || id.includes("\\") || id.includes("..")) return null;
    try {
      const raw = await readFile(this.metaFile(id), "utf8");
      const parsed = JSON.parse(raw) as TrashItemMeta;
      return parsed?.id === id && Number.isFinite(parsed.expiresAt) ? parsed : null;
    } catch {
      return null;
    }
  }

  /** 清理所有超过 30 天保留期的条目，返回已清理数量。 */
  async purgeExpired(now = Date.now()): Promise<number> {
    const entries = await readdir(this.itemsRoot, { withFileTypes: true }).catch(() => []);
    let purged = 0;
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const meta = await this.getMeta(entry.name);
      // 仅清理确认已过期的条目，保留未发布元数据和元数据损坏的载荷。
      if (!meta || meta.expiresAt > now) continue;
      await rm(this.itemDir(entry.name), { recursive: true, force: true });
      purged += 1;
    }
    return purged;
  }

  /** 列出当前未过期回收站条目，按删除时间倒序。 */
  async list(kind: TrashItemKind | "all" = "all", now = Date.now()): Promise<TrashListItem[]> {
    await this.purgeExpired(now);
    const entries = await readdir(this.itemsRoot, { withFileTypes: true }).catch(() => []);
    const items: TrashListItem[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const meta = await this.getMeta(entry.name);
      if (!meta || meta.expiresAt <= now) continue;
      if (kind !== "all" && meta.kind !== kind) continue;
      const remainingMs = Math.max(0, meta.expiresAt - now);
      const remainingDays = Math.max(1, Math.min(30, Math.ceil(remainingMs / (24 * 60 * 60 * 1000))));
      items.push({
        id: meta.id,
        kind: meta.kind,
        title: meta.title,
        deletedAt: meta.deletedAt,
        expiresAt: meta.expiresAt,
        remainingDays,
        ...(meta.originLabel ? { originLabel: meta.originLabel } : {}),
        ...(meta.previewRelPath ? { previewUrl: `/api/trash/${encodeURIComponent(meta.id)}/preview` } : {}),
        ...(typeof meta.sizeBytes === "number" ? { sizeBytes: meta.sizeBytes } : {}),
        origin: meta.origin,
      });
    }
    return items.sort((a, b) => b.deletedAt - a.deletedAt);
  }

  /** 软删除单个画布目录。 */
  async trashCanvasBoard(input: {
    projectId: string;
    projectName: string;
    canvasId: string;
    boardTitle: string;
    boardDir: string;
    coverRelPath?: string;
    coverMime?: string;
    now?: number;
  }): Promise<TrashItemMeta> {
    const id = randomUUID();
    const deletedAt = input.now ?? Date.now();
    const destBoard = join(this.payloadDir(id), "board");
    await moveEntrySafe(input.boardDir, destBoard);
    const sizeBytes = await computeSizeBytes(destBoard);
    const previewRelPath = input.coverRelPath ? join("board", input.coverRelPath) : undefined;
    const meta: TrashItemMeta = {
      id,
      kind: "canvas",
      title: input.boardTitle,
      deletedAt,
      expiresAt: deletedAt + TRASH_RETENTION_MS,
      originLabel: input.projectName,
      ...(previewRelPath ? { previewRelPath, previewMime: input.coverMime ?? guessMimeFromPath(previewRelPath) } : {}),
      sizeBytes,
      origin: {
        projectId: input.projectId,
        projectName: input.projectName,
        canvasId: input.canvasId,
      },
    };
    await this.writeMeta(meta);
    return meta;
  }

  /** 软删除项目注册记录（绝不删除用户本地硬盘源码目录）。 */
  async trashProject(input: {
    project: {
      id: string;
      name: string;
      rootPath: string;
      rootPaths?: string[];
      sectionId?: string | null;
      pinned?: boolean;
      trusted?: boolean;
      createdAt?: number;
      kind?: "workspace" | "canvas";
      canvasFolderId?: string | null;
    };
    now?: number;
  }): Promise<TrashItemMeta> {
    const id = randomUUID();
    const deletedAt = input.now ?? Date.now();
    const meta: TrashItemMeta = {
      id,
      kind: "project",
      title: input.project.name,
      deletedAt,
      expiresAt: deletedAt + TRASH_RETENTION_MS,
      origin: { project: input.project },
    };
    await this.writeMeta(meta);
    return meta;
  }

  /** 软删除资料库生成素材文件（同时迁移同名 .json 提示词 sidecar）。 */
  async trashMediaFile(input: {
    filePath: string;
    title?: string;
    originLabel?: string;
    now?: number;
  }): Promise<TrashItemMeta> {
    const id = randomUUID();
    const deletedAt = input.now ?? Date.now();
    const fileName = basename(input.filePath);
    const destFile = join(this.payloadDir(id), fileName);
    await moveEntrySafe(input.filePath, destFile);
    const sidecarPath = `${input.filePath}.json`;
    let hasSidecar = false;
    if (existsSync(sidecarPath)) {
      await moveEntrySafe(sidecarPath, join(this.payloadDir(id), `${fileName}.json`)).catch(() => {});
      hasSidecar = true;
    }
    const mime = guessMimeFromPath(fileName);
    const isImage = mime.startsWith("image/");
    const sizeBytes = await computeSizeBytes(destFile);
    const meta: TrashItemMeta = {
      id,
      kind: "media",
      title: input.title?.trim() || fileName,
      deletedAt,
      expiresAt: deletedAt + TRASH_RETENTION_MS,
      originLabel: input.originLabel ?? "资料库 · 图像",
      ...(isImage ? { previewRelPath: fileName, previewMime: mime } : {}),
      sizeBytes,
      origin: {
        filePath: resolve(input.filePath),
        fileName,
        hasSidecar,
      },
    };
    await this.writeMeta(meta);
    return meta;
  }

  /** 软删除资料库文本/文件资产记录（保留完整内容以便一键还原）。 */
  async trashLibraryAsset(input: {
    asset: {
      id: string;
      title: string;
      fileName: string;
      category: "artifact" | "asset";
      mimeType: string;
      summary?: string;
      tags: string[];
      projectId: string | null;
      sizeBytes?: number;
    };
    content: string;
    now?: number;
  }): Promise<TrashItemMeta> {
    const id = randomUUID();
    const deletedAt = input.now ?? Date.now();
    await mkdir(this.payloadDir(id), { recursive: true });
    await writeFile(join(this.payloadDir(id), "content.txt"), input.content, "utf8");
    const meta: TrashItemMeta = {
      id,
      kind: "asset",
      title: input.asset.title || input.asset.fileName,
      deletedAt,
      expiresAt: deletedAt + TRASH_RETENTION_MS,
      originLabel: input.asset.category === "artifact" ? "资料库 · 产物" : "资料库 · 资产",
      sizeBytes: input.asset.sizeBytes ?? Buffer.byteLength(input.content, "utf8"),
      origin: { asset: input.asset },
    };
    await this.writeMeta(meta);
    return meta;
  }

  /** 解析预览图物理路径（仅限 payload 内文件）。 */
  async resolvePreview(id: string): Promise<{ file: string; mime: string } | null> {
    const meta = await this.getMeta(id);
    if (!meta?.previewRelPath) return null;
    const file = resolve(this.payloadDir(id), meta.previewRelPath);
    if (!file.startsWith(resolve(this.payloadDir(id)))) return null;
    if (!existsSync(file)) return null;
    return { file, mime: meta.previewMime ?? guessMimeFromPath(file) };
  }

  /** 彻底删除单条回收站记录并释放磁盘空间。 */
  async purge(id: string): Promise<boolean> {
    const meta = await this.getMeta(id);
    if (!meta) return false;
    await rm(this.itemDir(id), { recursive: true, force: true });
    return true;
  }

  /** 清空回收站（全部或指定类型）。 */
  async empty(kind: TrashItemKind | "all" = "all"): Promise<number> {
    const items = await this.list(kind);
    for (const item of items) {
      await rm(this.itemDir(item.id), { recursive: true, force: true });
    }
    return items.length;
  }
}
