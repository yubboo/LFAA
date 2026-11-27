// Host 持久化项目画布、素材与独立的运行记录。
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { CanvasAsset, CanvasBoard, CanvasRun } from "../contract/index";
import { CanvasError, uuid } from "./graph";

const mediaTypes = new Map<string, CanvasAsset["kind"]>([
  ["image/png", "image"], ["image/jpeg", "image"], ["image/webp", "image"],
  ["video/mp4", "video"], ["video/webm", "video"],
]);
const extensions: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "video/mp4": "mp4", "video/webm": "webm",
};
export const maxAssetBytes = 24 * 1024 * 1024;

/** 只接受可以安全以内嵌图片或视频展示的实际字节格式。 */
function inferMedia(bytes: Buffer): string | undefined {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (bytes.toString("ascii", 4, 8) === "ftyp") return "video/mp4";
  if (bytes.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]))) return "video/webm";
  return undefined;
}

async function readOptional<T>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function atomicWrite(path: string, bytes: Buffer | string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = path + "." + randomUUID() + ".part";
  try {
    await writeFile(temporary, bytes);
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function entries(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export class CanvasStore {
  constructor(private readonly root: string) {}

  projectDir(projectId: string): string {
    return join(this.root, createHash("sha256").update(projectId).digest("hex"));
  }

  boardDir(projectId: string, canvasId: string): string {
    if (!uuid.safeParse(canvasId).success) throw new CanvasError(404, "找不到画布 / Canvas not found");
    return join(this.projectDir(projectId), canvasId);
  }

  async list(projectId: string): Promise<Array<Pick<CanvasBoard, "canvasId" | "title">>> {
    const dir = this.projectDir(projectId);
    const entriesInProject = await entries(dir);
    const boards = await Promise.all(entriesInProject.filter((id) => uuid.safeParse(id).success)
      .map((id) => readOptional<CanvasBoard>(join(dir, id, "board.json"))));
    return boards.flatMap((board) => board ? [{ canvasId: board.canvasId, title: board.title }] : []);
  }

  async board(dir: string): Promise<CanvasBoard> {
    const board = await readOptional<CanvasBoard>(join(dir, "board.json"));
    if (!board) throw new CanvasError(404, "找不到画布 / Canvas not found");
    return board;
  }

  saveBoard(dir: string, board: CanvasBoard): Promise<void> {
    return atomicWrite(join(dir, "board.json"), JSON.stringify(board));
  }

  async assets(dir: string): Promise<CanvasAsset[]> {
    const assets = await this.records<CanvasAsset>(join(dir, "assets"));
    return assets.sort((left, right) => left.name.localeCompare(right.name));
  }

  async asset(dir: string, id: string): Promise<{ asset: CanvasAsset; file: string }> {
    if (!uuid.safeParse(id).success) throw new CanvasError(404, "找不到素材 / Asset not found");
    const asset = await readOptional<CanvasAsset>(join(dir, "assets", id + ".json"));
    if (!asset) throw new CanvasError(404, "找不到素材 / Asset not found");
    return { asset, file: join(dir, "assets", id + "." + extensions[asset.mime]) };
  }

  async addAsset(dir: string, name: string, mime: string, bytes: Buffer, id: string = randomUUID()): Promise<CanvasAsset> {
    if (!bytes.length || bytes.length > maxAssetBytes) throw new CanvasError(413, "素材大小超出限制 / Asset exceeds 24 MiB");
    const detected = inferMedia(bytes);
    const kind = detected ? mediaTypes.get(detected) : undefined;
    if (!detected || !kind || (mime && detected !== mime)) throw new CanvasError(415, "不支持该素材格式 / Unsupported asset");
    const asset = { id, kind, mime: detected, name: name.trim().slice(0, 160) || id };
    await atomicWrite(join(dir, "assets", id + "." + extensions[detected]), bytes);
    await atomicWrite(join(dir, "assets", id + ".json"), JSON.stringify(asset));
    return asset;
  }

  runs(dir: string): Promise<CanvasRun[]> {
    return this.records(join(dir, "runs"));
  }

  run(dir: string, id: string): Promise<CanvasRun | undefined> {
    if (!uuid.safeParse(id).success) throw new CanvasError(400, "运行编号无效 / Invalid run ID");
    return readOptional(join(dir, "runs", id + ".json"));
  }

  saveRun(dir: string, run: CanvasRun): Promise<void> {
    return atomicWrite(join(dir, "runs", run.id + ".json"), JSON.stringify(run));
  }

  private async records<T>(dir: string): Promise<T[]> {
    const names = await entries(dir);
    const records = await Promise.all(names.filter((name) => name.endsWith(".json")).map((name) => readOptional<T>(join(dir, name))));
    return records.flatMap((entry) => entry === undefined ? [] : [entry]);
  }
}
