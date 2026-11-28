// 无限画布分类文件夹持久化存储：读写 ~/.lfaa/canvas/folders.json，支持增删改查。
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { CanvasFolder } from "../contract/index";
import { CanvasError } from "./graph";

const MAX_FOLDER_NAME = 80;

export class CanvasFolderStore {
  private readonly filePath: string;

  constructor(root: string) {
    this.filePath = join(root, "folders.json");
  }

  async list(): Promise<CanvasFolder[]> {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, "utf8")) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item): item is CanvasFolder => Boolean(
          item && typeof item === "object"
          && typeof (item as CanvasFolder).id === "string"
          && typeof (item as CanvasFolder).name === "string",
        ))
        .sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async create(rawName: string): Promise<CanvasFolder> {
    const name = rawName.trim();
    if (!name || name.length > MAX_FOLDER_NAME) throw new CanvasError(400, "文件夹名称无效 / Invalid folder name");
    const items = await this.list();
    if (items.some((item) => item.name.trim().toLowerCase() === name.toLowerCase())) {
      throw new CanvasError(409, `文件夹“${name}”已存在 / Folder already exists`);
    }
    const now = Date.now();
    const folder: CanvasFolder = { id: randomUUID(), name, createdAt: now, updatedAt: now };
    await this.save([folder, ...items]);
    return folder;
  }

  async rename(id: string, rawName: string): Promise<CanvasFolder> {
    const name = rawName.trim();
    if (!name || name.length > MAX_FOLDER_NAME) throw new CanvasError(400, "文件夹名称无效 / Invalid folder name");
    const items = await this.list();
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) throw new CanvasError(404, "找不到文件夹 / Folder not found");
    if (items.some((item) => item.id !== id && item.name.trim().toLowerCase() === name.toLowerCase())) {
      throw new CanvasError(409, `文件夹“${name}”已存在 / Folder already exists`);
    }
    const updated: CanvasFolder = { ...items[index]!, name, updatedAt: Date.now() };
    const next = [...items];
    next[index] = updated;
    await this.save(next);
    return updated;
  }

  async remove(id: string): Promise<boolean> {
    const items = await this.list();
    const next = items.filter((item) => item.id !== id);
    if (next.length === items.length) return false;
    await this.save(next);
    return true;
  }

  private async save(items: CanvasFolder[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${randomUUID()}.part`;
    try {
      await writeFile(tmp, JSON.stringify(items, null, 2), "utf8");
      await rename(tmp, this.filePath);
    } finally {
      await rm(tmp, { force: true });
    }
  }
}
