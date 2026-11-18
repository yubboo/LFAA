// 管理资料库本地资产与 Agent 产物存储（<dataRoot>/agent-outputs、user-assets 及 vault-index.json）。
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, extname, isAbsolute, join, relative, resolve } from "node:path";
import { VAULT_DIRS, VAULT_FILES } from "./storage-manager";
import type { LibraryAssetItem, LibraryItemCategory, SaveLibraryAssetInput } from "./types";

const TEXT_EXTENSIONS = new Set([
  ".md", ".txt", ".json", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".css", ".html", ".yaml", ".yml", ".toml", ".py", ".rs", ".go", ".sql", ".csv",
]);

function sanitizeAssetName(rawName: string): string {
  const base = basename(rawName.trim() || "artifact.md")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/gu, "-")
    .replace(/[. ]+$/gu, "");
  return base && base !== "." && base !== ".." ? base.slice(0, 100) : "artifact.txt";
}

function guessMimeType(fileName: string, provided?: string): string {
  if (provided?.trim()) return provided.trim();
  const ext = extname(fileName).toLowerCase();
  if (ext === ".md") return "text/markdown; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".svg") return "image/svg+xml";
  if (TEXT_EXTENSIONS.has(ext)) return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

function resolveUniqueFile(dir: string, fileName: string): { targetPath: string; finalName: string } {
  const safe = sanitizeAssetName(fileName);
  const ext = extname(safe);
  const stem = ext ? safe.slice(0, -ext.length) : safe;
  let candidate = safe;
  let idx = 2;
  while (existsSync(join(dir, candidate))) {
    candidate = `${stem}-${idx}${ext}`;
    idx += 1;
  }
  return { targetPath: join(dir, candidate), finalName: candidate };
}

function isInsideDataRoot(targetPath: string, dataRoot: string): boolean {
  const a = process.platform === "win32" ? resolve(dataRoot).toLowerCase() : resolve(dataRoot);
  const b = process.platform === "win32" ? resolve(targetPath).toLowerCase() : resolve(targetPath);
  const rel = relative(a, b);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

/** 管理资料索引及文件读写，负责保存、查看与移除本地资产。 */
export class AssetLibraryStore {
  constructor(private dataRoot: string) {}

  setDataRoot(nextRoot: string): void {
    this.dataRoot = resolve(nextRoot);
  }

  getDataRoot(): string {
    return this.dataRoot;
  }

  private indexFile(): string {
    return join(this.dataRoot, VAULT_FILES.vaultIndex);
  }

  private async readIndex(): Promise<LibraryAssetItem[]> {
    try {
      const raw = await readFile(this.indexFile(), "utf8");
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (item): item is LibraryAssetItem =>
          typeof item === "object" && item !== null && typeof (item as LibraryAssetItem).id === "string",
      );
    } catch {
      return [];
    }
  }

  private async writeIndex(items: LibraryAssetItem[]): Promise<void> {
    await mkdir(this.dataRoot, { recursive: true });
    await writeFile(this.indexFile(), JSON.stringify(items, null, 2), "utf8");
  }

  async list(options: {
    category?: LibraryItemCategory | undefined;
    projectId?: string | null | undefined;
    query?: string | undefined;
  } = {}): Promise<LibraryAssetItem[]> {
    const items = await this.readIndex();
    const q = options.query?.trim().toLowerCase() ?? "";
    return items
      .filter((item) => {
        if (options.category && item.category !== options.category) return false;
        if (options.projectId !== undefined && item.projectId !== null && item.projectId !== options.projectId) {
          return false;
        }
        if (q) {
          const hit = item.title.toLowerCase().includes(q)
            || item.fileName.toLowerCase().includes(q)
            || Boolean(item.summary && item.summary.toLowerCase().includes(q))
            || item.tags.some((t) => t.toLowerCase().includes(q));
          if (!hit) return false;
        }
        return true;
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async save(input: SaveLibraryAssetInput): Promise<LibraryAssetItem> {
    const title = input.title.trim() || sanitizeAssetName(input.fileName);
    const category: LibraryItemCategory = input.category === "artifact" ? "artifact" : "asset";
    const dateFolder = new Date().toISOString().slice(0, 10);
    const subDir = category === "artifact"
      ? join(this.dataRoot, VAULT_DIRS.artifacts, dateFolder)
      : join(this.dataRoot, VAULT_DIRS.assets);
    await mkdir(subDir, { recursive: true });

    const { targetPath, finalName } = resolveUniqueFile(subDir, input.fileName);
    const buffer = input.encoding === "base64"
      ? Buffer.from(input.content, "base64")
      : Buffer.from(input.content, "utf8");
    await writeFile(targetPath, buffer);
    const info = await stat(targetPath);

    const now = Date.now();
    const item: LibraryAssetItem = {
      id: randomUUID(),
      category,
      title,
      fileName: finalName,
      relativePath: relative(this.dataRoot, targetPath).replaceAll("\\", "/"),
      mimeType: guessMimeType(finalName, input.mimeType),
      sizeBytes: info.size,
      ...(input.summary?.trim() ? { summary: input.summary.trim() } : {}),
      tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean),
      projectId: input.projectId ?? null,
      ...(input.sourceSessionId ? { sourceSessionId: input.sourceSessionId } : {}),
      ...(input.sourceRunId ? { sourceRunId: input.sourceRunId } : {}),
      createdAt: now,
      updatedAt: now,
    };

    const existing = await this.readIndex();
    await this.writeIndex([item, ...existing]);
    return item;
  }

  async readContent(id: string): Promise<{ item: LibraryAssetItem; isText: boolean; content: string } | null> {
    const items = await this.readIndex();
    const item = items.find((entry) => entry.id === id);
    if (!item) return null;
    const fullPath = resolve(this.dataRoot, item.relativePath);
    if (!isInsideDataRoot(fullPath, this.dataRoot)) {
      throw new Error("资产路径越界，已拒绝读取。");
    }

    const ext = extname(item.fileName).toLowerCase();
    const isText = item.mimeType.startsWith("text/")
      || item.mimeType.includes("json")
      || TEXT_EXTENSIONS.has(ext);
    if (!isText) {
      return {
        item,
        isText: false,
        content: `[二进制文件] ${item.fileName} (${item.sizeBytes} bytes, ${item.mimeType})`,
      };
    }

    const buf = await readFile(fullPath);
    return {
      item,
      isText: true,
      content: buf.subarray(0, 128 * 1024).toString("utf8"),
    };
  }

  async remove(id: string): Promise<boolean> {
    const items = await this.readIndex();
    const target = items.find((entry) => entry.id === id);
    if (!target) return false;
    const next = items.filter((entry) => entry.id !== id);
    await this.writeIndex(next);
    const fullPath = resolve(this.dataRoot, target.relativePath);
    if (isInsideDataRoot(fullPath, this.dataRoot)) {
      await rm(fullPath, { force: true }).catch(() => {});
    }
    return true;
  }
}
