/** 功能：把已由领域 Owner 校验的本机推理素材安全地镜像到账户隔离的 Data/input 与 Data/output。 */
import { randomUUID } from "node:crypto";
import { lstat, mkdir, realpath, rename, rm, writeFile } from "node:fs/promises";
import { basename, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { ensureDataDirectories, resolveDataPaths, resolveUserDataPaths } from "lfaa-home-paths/src/data-layout.mjs";
import type { LocalWorkspaceAsset, LocalWorkspaceDirectory } from "./contracts.js";

const MAX_ASSET_BYTES = 128 * 1024 * 1024;
const MEDIA_EXTENSIONS: Readonly<Record<string, string>> = Object.freeze({
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
  "audio/ogg": ".ogg"
});
const ASSET_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function isInside(root: string, target: string): boolean {
  const rel = relative(resolve(root), resolve(target));
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function safeName(value: string, extension: string, id: string): string {
  if (typeof value !== "string" || value.length > 512 || value.includes("\0")) throw new Error("本机模型输入/输出文件名无效。");
  const leaf = basename(value.replace(/[\\/]/gu, "/"));
  const stem = (leaf.slice(0, leaf.length - extname(leaf).length) || "media")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/gu, "_")
    .replace(/[. ]+$/gu, "")
    .trim()
    .slice(0, 72) || "media";
  return `${Date.now()}-${stem}-${id}${extension}`;
}

async function verifyDirectory(directory: string): Promise<void> {
  const info = await lstat(directory);
  if (info.isSymbolicLink() || !info.isDirectory() || resolve(await realpath(directory)) !== resolve(directory)) {
    throw new Error("LFAA 本机模型输入/输出目录必须是普通目录，不能包含符号链接。");
  }
}

export async function saveWorkspaceAsset(
  dataDirectory: string,
  userId: string,
  directory: LocalWorkspaceDirectory,
  name: string,
  mimeType: string,
  bytes: Buffer
): Promise<LocalWorkspaceAsset> {
  if (directory !== "input" && directory !== "output") throw new Error("本机模型输入/输出目录标识无效。");
  if (typeof mimeType !== "string") throw new Error("本机模型输入/输出媒体类型无效。");
  const normalizedMimeType = mimeType.split(";", 1)[0]!.trim().toLocaleLowerCase("en-US");
  const extension = MEDIA_EXTENSIONS[normalizedMimeType];
  if (!extension) throw new Error("本机模型输入/输出只接受已登记的图片、视频或音频类型。");
  if (!Buffer.isBuffer(bytes) || bytes.byteLength < 1 || bytes.byteLength > MAX_ASSET_BYTES) throw new Error("本机模型输入/输出文件为空或超过 128 MiB。");
  ensureDataDirectories(dataDirectory);
  const dataPaths = resolveDataPaths(dataDirectory);
  const userPaths = resolveUserDataPaths(dataDirectory, userId);
  const root = resolve(dataPaths[directory]);
  const targetDirectory = resolve(userPaths[directory]);
  if (!isInside(root, targetDirectory)) throw new Error("本机模型输入/输出目录超出 LFAA Data 根。");
  await verifyDirectory(root);
  await mkdir(targetDirectory, { recursive: true, mode: 0o700 });
  await verifyDirectory(targetDirectory);

  const id = randomUUID();
  const fileName = safeName(name, extension, id);
  const targetPath = join(targetDirectory, fileName);
  const temporaryPath = join(targetDirectory, `.lfaa-${id}.partial`);
  if (!isInside(targetDirectory, targetPath)) throw new Error("本机模型输入/输出文件路径无效。");
  let targetCreated = false;
  try {
    try {
      await lstat(targetPath);
      throw new Error("本机模型输入/输出文件名冲突；拒绝覆盖现有文件。");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await writeFile(temporaryPath, bytes, { flag: "wx", mode: 0o600 });
    await rename(temporaryPath, targetPath);
    targetCreated = true;
    const info = await lstat(targetPath);
    if (info.isSymbolicLink() || !info.isFile() || info.size !== bytes.byteLength) throw new Error("本机模型输入/输出文件落盘校验失败。");
    return { id, directory, fileName, mimeType: normalizedMimeType, bytes: info.size };
  } catch (error) {
    const cleanupErrors: unknown[] = [];
    await rm(temporaryPath, { force: true }).catch(cleanupError => cleanupErrors.push(cleanupError));
    if (targetCreated) await rm(targetPath, { force: true }).catch(cleanupError => cleanupErrors.push(cleanupError));
    if (cleanupErrors.length) throw new AggregateError([error, ...cleanupErrors], "本机模型输入/输出写入失败，部分临时文件无法清理。");
    throw error;
  }
}

export async function removeWorkspaceAsset(dataDirectory: string, userId: string, asset: LocalWorkspaceAsset): Promise<void> {
  if (!ASSET_ID.test(asset.id) || (asset.directory !== "input" && asset.directory !== "output")) throw new Error("本机模型输入/输出文件标识无效。");
  const extension = MEDIA_EXTENSIONS[asset.mimeType];
  if (!extension || !asset.fileName.endsWith(extension) || !asset.fileName.includes(asset.id)) throw new Error("本机模型输入/输出文件与保存记录不匹配。");
  const root = resolve(resolveDataPaths(dataDirectory)[asset.directory]);
  const directory = resolve(resolveUserDataPaths(dataDirectory, userId)[asset.directory]);
  const targetPath = resolve(directory, asset.fileName);
  if (!isInside(root, targetPath) || !isInside(directory, targetPath)) throw new Error("本机模型输入/输出文件超出账户目录。");
  await verifyDirectory(root);
  await verifyDirectory(directory);
  try {
    const info = await lstat(targetPath);
    if (info.isSymbolicLink() || !info.isFile()) throw new Error("本机模型输入/输出文件必须是普通文件。");
    await rm(targetPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
