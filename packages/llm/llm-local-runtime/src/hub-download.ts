/** 功能：从固定 Hugging Face 仓库下载已登记模型文件。作用：流式校验、可取消并逐文件原子落盘。 */
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { lstat, mkdir, open, rename, rm } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { Transform } from "node:stream";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { LocalModelDefinition } from "./contracts.js";

interface HubTreeFile {
  type: string;
  path: string;
  size: number;
  oid?: string;
  lfs?: { oid?: string; size?: number };
}

interface HubModelInfo { sha?: string }

const HUB_ORIGIN = "https://huggingface.co";
const HUB_TREE_PAGE_LIMIT = 100;
const HUB_TREE_MAX_PAGES = 100;
const HUB_TREE_MAX_FILES = HUB_TREE_PAGE_LIMIT * HUB_TREE_MAX_PAGES;

export interface HubDownloadProgress {
  receivedBytes: number;
  totalBytes: number;
  completedFiles: number;
  totalFiles: number;
}

function fail(message: string): never { throw new Error(message); }

function safePath(root: string, relativePath: string): string {
  if (typeof relativePath !== "string" || !relativePath || relativePath.includes("\0") || relativePath.includes("\\") || isAbsolute(relativePath)) {
    return fail("模型仓库返回的文件路径无效。");
  }
  const parts = relativePath.split("/");
  if (parts.some(part => !part || part === "." || part === ".." || part.startsWith("."))) {
    return fail("模型仓库文件路径包含隐藏或越界目录。");
  }
  const destination = resolve(root, ...parts);
  const rel = relative(resolve(root), destination);
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return fail("模型仓库文件越过 LFAA 模型目录。");
  return destination;
}

async function assertRealDirectories(root: string, target: string): Promise<void> {
  const resolvedRoot = resolve(root);
  const rel = relative(resolvedRoot, resolve(target));
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) fail("模型路径超出当前模型目录。");
  await mkdir(resolvedRoot, { recursive: true });
  let current = resolvedRoot;
  const rootInfo = await lstat(current);
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) fail("LFAA 模型根目录不是普通目录。");
  for (const part of rel.split(sep).slice(0, -1).filter(Boolean)) {
    current = join(current, part);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink() || !info.isDirectory()) fail("模型目标路径包含符号链接或非目录对象。");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await mkdir(current);
    }
  }
}

async function hashFile(path: string, size: number): Promise<{ sha1: string; sha256: string }> {
  const sha1 = createHash("sha1").update(`blob ${size}\0`, "utf8");
  const sha256 = createHash("sha256");
  for await (const chunk of createReadStream(path)) {
    sha1.update(chunk as Buffer);
    sha256.update(chunk as Buffer);
  }
  return { sha1: sha1.digest("hex"), sha256: sha256.digest("hex") };
}

async function getHubJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { headers: { Accept: "application/json" }, redirect: "follow", signal });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error("Hugging Face 拒绝访问该仓库；请先在模型来源页面确认账号访问权限或许可证要求。");
    throw new Error(`Hugging Face 目录请求失败（HTTP ${response.status}）。`);
  }
  return await response.json() as T;
}

async function getHubTree(repository: string, revision: string, signal: AbortSignal): Promise<HubTreeFile[]> {
  const firstPage = new URL(`/api/models/${repository}/tree/${encodeURIComponent(revision)}`, HUB_ORIGIN);
  firstPage.searchParams.set("recursive", "true");
  firstPage.searchParams.set("expand", "true");
  firstPage.searchParams.set("limit", String(HUB_TREE_PAGE_LIMIT));
  const files: HubTreeFile[] = [];
  const visited = new Set<string>();
  let pageUrl: URL | null = firstPage;
  while (pageUrl) {
    if (visited.has(pageUrl.href) || visited.size >= HUB_TREE_MAX_PAGES) fail("Hugging Face 模型目录分页无效或超过安全上限。");
    visited.add(pageUrl.href);
    const response = await fetch(pageUrl, { headers: { Accept: "application/json" }, redirect: "follow", signal });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) throw new Error("Hugging Face 拒绝访问该仓库；请先在模型来源页面确认账号访问权限或许可证要求。");
      throw new Error(`Hugging Face 模型目录请求失败（HTTP ${response.status}）。`);
    }
    const page = await response.json() as unknown;
    if (!Array.isArray(page) || page.some(item => !item || typeof item !== "object" || typeof item.path !== "string" || typeof item.type !== "string")) {
      fail("Hugging Face 返回了无效的模型文件分页。");
    }
    files.push(...page as HubTreeFile[]);
    if (files.length > HUB_TREE_MAX_FILES) fail("Hugging Face 模型文件数量超过 LFAA 安全上限。");
    const link = response.headers.get("link");
    const next = link?.match(/<([^>]+)>;\s*rel="next"/u)?.[1];
    if (!next) pageUrl = null;
    else {
      let nextUrl: URL;
      try { nextUrl = new URL(next); }
      catch { return fail("Hugging Face 模型目录的下一页地址无效。"); }
      if (nextUrl.origin !== HUB_ORIGIN || nextUrl.pathname !== firstPage.pathname || nextUrl.searchParams.get("limit") !== String(HUB_TREE_PAGE_LIMIT)) {
        fail("Hugging Face 模型目录分页目标无效。");
      }
      pageUrl = nextUrl;
    }
  }
  return files;
}

function pathUrl(path: string): string {
  return path.split("/").map(part => encodeURIComponent(part)).join("/");
}

async function transferFile(
  definition: LocalModelDefinition,
  revision: string,
  modelDirectory: string,
  file: HubTreeFile,
  signal: AbortSignal,
  onBytes: (bytes: number) => void
): Promise<void> {
  if (!Number.isSafeInteger(file.size) || file.size < 0 || file.size > Number.MAX_SAFE_INTEGER) fail("Hub 返回了无效的模型文件大小。");
  const target = safePath(modelDirectory, file.path);
  await assertRealDirectories(modelDirectory, target);
  try {
    const info = await lstat(target);
    if (info.isSymbolicLink() || !info.isFile()) fail("模型目标文件不是普通文件。");
    if (info.size === file.size) {
      const hashes = await hashFile(target, info.size);
      const expectedLfs = file.lfs?.oid?.replace(/^sha256:/u, "");
      if (expectedLfs ? hashes.sha256 === expectedLfs : file.oid ? hashes.sha1 === file.oid : true) {
        onBytes(info.size);
        return;
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const url = `https://huggingface.co/${definition.repository}/resolve/${encodeURIComponent(revision)}/${pathUrl(file.path)}?download=true`;
  const response = await fetch(url, { redirect: "follow", signal });
  if (!response.ok || !response.body) {
    if (response.status === 401 || response.status === 403) throw new Error("Hugging Face 拒绝下载该文件；请先在模型来源页面确认账号访问权限或许可证要求。");
    throw new Error(`模型文件下载失败（HTTP ${response.status}）：${basename(file.path)}`);
  }
  const temporaryPath = join(dirname(target), `.${basename(target)}.${randomUUID()}.partial`);
  const sha1 = createHash("sha1").update(`blob ${file.size}\0`, "utf8");
  const sha256 = createHash("sha256");
  let bytes = 0;
  const meter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.byteLength;
      if (bytes > file.size) return callback(new Error("模型下载返回的数据超过仓库声明文件大小。"));
      sha1.update(chunk);
      sha256.update(chunk);
      onBytes(chunk.byteLength);
      callback(null, chunk);
    }
  });
  try {
    await pipeline(Readable.fromWeb(response.body as never), meter, createWriteStream(temporaryPath, { flags: "wx" }), { signal });
    if (bytes !== file.size) throw new Error(`模型文件大小不完整：${basename(file.path)}（${bytes}/${file.size} 字节）。`);
    const expectedLfs = file.lfs?.oid?.replace(/^sha256:/u, "");
    const actual = expectedLfs ? sha256.digest("hex") : sha1.digest("hex");
    const expected = expectedLfs ?? file.oid;
    if (expected && actual !== expected) throw new Error(`模型文件校验失败：${basename(file.path)}；文件保留为未完成状态。`);
    await rename(temporaryPath, target);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function downloadHubModel(
  definition: LocalModelDefinition,
  modelDirectory: string,
  signal: AbortSignal,
  onProgress: (progress: HubDownloadProgress) => void
): Promise<{ revision: string; totalBytes: number; totalFiles: number }> {
  const info = await getHubJson<HubModelInfo>(`https://huggingface.co/api/models/${definition.repository}`, signal);
  const revision = typeof info.sha === "string" && /^[0-9a-f]{40}$/u.test(info.sha) ? info.sha : "main";
  const tree = await getHubTree(definition.repository, revision, signal);
  const files = tree.filter((item): item is HubTreeFile => item?.type === "file" && definition.includeFile(item.path));
  if (!files.length) fail("已登记模型的官方仓库中没有找到该适配器需要的原生文件。");
  const totalBytes = files.reduce((total, file) => {
    if (!Number.isSafeInteger(file.size) || file.size < 0 || total > Number.MAX_SAFE_INTEGER - file.size) return fail("模型仓库总文件大小无效。");
    return total + file.size;
  }, 0);
  let receivedBytes = 0;
  let completedFiles = 0;
  onProgress({ receivedBytes, totalBytes, completedFiles, totalFiles: files.length });
  for (const file of files) {
    signal.throwIfAborted();
    await transferFile(definition, revision, modelDirectory, file, signal, bytes => {
      receivedBytes += bytes;
      onProgress({ receivedBytes, totalBytes, completedFiles, totalFiles: files.length });
    });
    completedFiles += 1;
    onProgress({ receivedBytes, totalBytes, completedFiles, totalFiles: files.length });
  }
  const manifest = {
    format: "lfaa-local-model-v1",
    id: definition.id,
    family: definition.family,
    repository: definition.repository,
    revision,
    license: { name: definition.licenseName, url: definition.licenseUrl },
    installedAt: new Date().toISOString(),
    totalBytes,
    totalFiles: files.length
  };
  const manifestPath = join(modelDirectory, ".lfaa-model.json");
  const manifestTemp = `${manifestPath}.${randomUUID()}.partial`;
  const file = await open(manifestTemp, "wx");
  try { await file.writeFile(JSON.stringify(manifest, null, 2), "utf8"); }
  finally { await file.close(); }
  await rename(manifestTemp, manifestPath);
  return { revision, totalBytes, totalFiles: files.length };
}
