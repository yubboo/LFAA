/**
 * Resolve, download, verify and cache the optional Claude Agent SDK executable.
 * The archive SRI is compiled into this package contract; the desktop runtime
 * manifest supplies only build-measured binary details and a matching URL.
 */
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { relative, resolve, sep, join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import * as tar from "tar";
import { resolveHomePaths } from "lfaa-home-paths/src/data-layout.mjs";
import { resolveHomeDirectory } from "lfaa-home-paths/src/resolve-data-directory.mjs";
import {
  CLAUDE_SDK_COMPONENT_INTEGRITY,
  CLAUDE_SDK_COMPONENT_PACKAGE,
  CLAUDE_SDK_COMPONENT_TARBALL_URL,
  CLAUDE_SDK_COMPONENT_VERSION
} from "./claude-sdk-component-contract.mjs";

const REGISTRY_ORIGIN = "https://registry.npmjs.org";
const BINARY_ARCHIVE_PATH = "package/claude.exe";
const BINARY_FILE_NAME = "claude.exe";
const MAX_TARBALL_BYTES = 512 * 1024 * 1024;
const MAX_BINARY_BYTES = 512 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 3 * 60 * 1000;
const activeDownloads = new Map();
const verifiedFiles = new Map();

function validateManifest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || value.schemaVersion !== 1
    || value.platform !== "win32-x64"
    || value.packageName !== CLAUDE_SDK_COMPONENT_PACKAGE
    || value.version !== CLAUDE_SDK_COMPONENT_VERSION
    || value.tarballUrl !== CLAUDE_SDK_COMPONENT_TARBALL_URL
    || value.integrity !== CLAUDE_SDK_COMPONENT_INTEGRITY
    || value.binaryArchivePath !== BINARY_ARCHIVE_PATH
    || value.binaryFileName !== BINARY_FILE_NAME
    || !Number.isSafeInteger(value.binarySizeBytes)
    || value.binarySizeBytes < 1
    || value.binarySizeBytes > MAX_BINARY_BYTES
    || typeof value.binarySha256 !== "string"
    || !/^[0-9a-f]{64}$/u.test(value.binarySha256)) {
    throw new Error("Claude SDK 运行组件清单与当前 Windows x64 锁定版本不匹配。");
  }
  return value;
}

async function readManifest(manifestPath) {
  const info = await lstat(manifestPath).catch(() => null);
  if (!info || info.isSymbolicLink() || !info.isFile()) {
    throw new Error("桌面包缺少有效的 Claude SDK 按需组件清单。");
  }
  let record;
  try { record = JSON.parse(await readFile(manifestPath, "utf8")); }
  catch { throw new Error("Claude SDK 按需组件清单无法读取。"); }
  return validateManifest(record);
}

function ensureInside(parent, target) {
  const relativePath = relative(parent, target);
  if (!relativePath || relativePath === ".." || relativePath.startsWith(`..${sep}`)
    || resolve(parent, relativePath) !== target) {
    throw new Error("拒绝访问 Claude SDK 缓存目录之外的路径。");
  }
}

async function ensureRealDirectory(directory) {
  await mkdir(directory, { recursive: true });
  const info = await lstat(directory);
  if (info.isSymbolicLink() || !info.isDirectory()) {
    throw new Error("Claude SDK 缓存目录必须是实际目录，不能是链接或普通文件。");
  }
}

async function hashFile(filePath, algorithm) {
  const digest = createHash(algorithm);
  for await (const chunk of createReadStream(filePath)) digest.update(chunk);
  return digest.digest("hex");
}

async function verifyCachedComponent(directory, manifest) {
  const executablePath = join(directory, BINARY_FILE_NAME);
  const executableInfo = await lstat(executablePath).catch(() => null);
  const receiptPath = join(directory, "component-receipt.json");
  const receiptInfo = await lstat(receiptPath).catch(() => null);
  if (!executableInfo || executableInfo.isSymbolicLink() || !executableInfo.isFile()
    || executableInfo.size !== manifest.binarySizeBytes
    || !receiptInfo || receiptInfo.isSymbolicLink() || !receiptInfo.isFile()) return null;
  let receipt;
  try { receipt = JSON.parse(await readFile(receiptPath, "utf8")); }
  catch { return null; }
  if (receipt?.schemaVersion !== 1
    || receipt.packageName !== manifest.packageName
    || receipt.version !== manifest.version
    || receipt.integrity !== manifest.integrity
    || receipt.binarySha256 !== manifest.binarySha256
    || receipt.binarySizeBytes !== manifest.binarySizeBytes) return null;

  const cacheKey = `${executablePath}\0${executableInfo.size}\0${executableInfo.mtimeMs}`;
  if (!verifiedFiles.has(cacheKey)) {
    const digest = await hashFile(executablePath, "sha256");
    if (digest !== manifest.binarySha256) return null;
    verifiedFiles.set(cacheKey, true);
  }
  return executablePath;
}

async function downloadArchive(manifest, archivePath, stageDirectory, signal, fetcher, onProgress) {
  let response;
  const downloadSignal = AbortSignal.any([signal, AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS)]);
  try {
    response = await fetcher(manifest.tarballUrl, {
      method: "GET",
      headers: { Accept: "application/octet-stream" },
      redirect: "error",
      credentials: "omit",
      signal: downloadSignal
    });
  } catch (error) {
    if (signal.aborted) throw error;
    if (downloadSignal.aborted) throw new Error("获取 Claude SDK 运行组件超时，请检查网络后重试。");
    throw new Error("无法连接 npm 官方镜像获取 Claude SDK 运行组件，请检查网络后重试。");
  }
  if (!response.ok || !response.body) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(`获取 Claude SDK 运行组件失败（HTTP ${response.status}）。`);
  }
  if (new URL(response.url || manifest.tarballUrl).origin !== REGISTRY_ORIGIN) {
    await response.body.cancel().catch(() => undefined);
    throw new Error("Claude SDK 下载来源不是锁定的 npm 官方镜像。");
  }
  const rawHeaderLength = response.headers.get("content-length");
  const headerLength = rawHeaderLength === null ? null : Number(rawHeaderLength);
  if (headerLength !== null && Number.isFinite(headerLength) && headerLength > MAX_TARBALL_BYTES) {
    await response.body.cancel().catch(() => undefined);
    throw new Error("Claude SDK 安装包超过允许大小，已停止下载。");
  }

  const digest = createHash("sha512");
  let byteLength = 0;
  let nextProgressAt = 16 * 1024 * 1024;
  const limiter = new Transform({
    transform(chunk, _encoding, callback) {
      byteLength += chunk.length;
      if (byteLength > MAX_TARBALL_BYTES) {
        callback(new Error("Claude SDK 安装包超过允许大小，已停止下载。"));
        return;
      }
      digest.update(chunk);
      if (byteLength >= nextProgressAt) {
        onProgress?.(`正在获取 Claude SDK 运行组件（${Math.floor(byteLength / (1024 * 1024))} MiB）。`);
        nextProgressAt += 16 * 1024 * 1024;
      }
      callback(null, chunk);
    }
  });
  try {
    await pipeline(Readable.fromWeb(response.body), limiter, createWriteStream(archivePath, { flags: "wx", mode: 0o600 }), { signal: downloadSignal });
  } catch (error) {
    await rm(archivePath, { force: true }).catch(() => undefined);
    if (signal.aborted) throw error;
    if (downloadSignal.aborted) throw new Error("获取 Claude SDK 运行组件超时，请检查网络后重试。");
    if (error?.message?.includes("超过允许大小")) throw error;
    throw new Error("Claude SDK 下载未完成，请检查网络后重试。");
  }
  if (headerLength !== null && Number.isFinite(headerLength) && headerLength >= 0 && byteLength !== headerLength) {
    throw new Error("Claude SDK 下载长度与服务器声明不一致。");
  }
  const actualIntegrity = `sha512-${digest.digest("base64")}`;
  if (actualIntegrity !== manifest.integrity) throw new Error("Claude SDK 下载包完整性校验失败，已拒绝安装。");
  onProgress?.("Claude SDK 安装包完整性校验通过，正在准备运行文件。");
  return stageDirectory;
}

async function extractExecutable(archivePath, extractionDirectory, manifest) {
  await mkdir(extractionDirectory, { recursive: false });
  const allowedTypes = new Set(["File", "Directory"]);
  await tar.x({
    file: archivePath,
    cwd: extractionDirectory,
    strict: true,
    preservePaths: false,
    filter: (path, entry) => {
      const normalized = path.replaceAll("\\", "/").replace(/\/$/u, "");
      if (!allowedTypes.has(entry.type)) return false;
      return normalized === "package" || normalized === manifest.binaryArchivePath;
    }
  });
  const extractedPath = join(extractionDirectory, "package", BINARY_FILE_NAME);
  const info = await lstat(extractedPath).catch(() => null);
  if (!info || info.isSymbolicLink() || !info.isFile() || info.size !== manifest.binarySizeBytes) {
    throw new Error("Claude SDK 安装包中的 Windows x64 可执行文件大小或类型无效。");
  }
  const digest = await hashFile(extractedPath, "sha256");
  if (digest !== manifest.binarySha256) throw new Error("Claude SDK 可执行文件校验失败，已拒绝启动。");
  return extractedPath;
}

async function cleanupOldComponents(componentRoot, currentDirectory) {
  const entries = await readdir(componentRoot, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const candidate = join(componentRoot, entry.name);
    ensureInside(componentRoot, candidate);
    if (candidate === currentDirectory) continue;
    await rm(candidate, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function installComponent(manifest, runtimeComponents, signal, fetcher, onProgress) {
  signal.throwIfAborted();
  await ensureRealDirectory(runtimeComponents);
  const componentRoot = join(runtimeComponents, "claude-agent-sdk");
  await ensureRealDirectory(componentRoot);
  const componentDirectoryName = `${manifest.version}-${manifest.binarySha256.slice(0, 16)}`;
  const componentDirectory = join(componentRoot, componentDirectoryName);
  ensureInside(componentRoot, componentDirectory);

  const existingDirectoryInfo = await lstat(componentDirectory).catch(() => null);
  if (existingDirectoryInfo) {
    if (existingDirectoryInfo.isSymbolicLink() || !existingDirectoryInfo.isDirectory()) {
      throw new Error("Claude SDK 缓存目标不是有效目录；已拒绝覆盖。");
    }
    const verified = await verifyCachedComponent(componentDirectory, manifest);
    if (verified) return verified;
  }

  const stageDirectory = join(componentRoot, `.install-${randomUUID()}`);
  ensureInside(componentRoot, stageDirectory);
  await mkdir(stageDirectory, { recursive: false });
  const archivePath = join(stageDirectory, "claude-sdk.tgz");
  const extractionDirectory = join(stageDirectory, "extracted");
  try {
    onProgress?.(`正在首次获取 Claude Agent SDK 运行组件（${manifest.version}）。`);
    await downloadArchive(manifest, archivePath, stageDirectory, signal, fetcher, onProgress);
    signal.throwIfAborted();
    const extractedPath = await extractExecutable(archivePath, extractionDirectory, manifest);
    const stagedExecutable = join(stageDirectory, BINARY_FILE_NAME);
    await rename(extractedPath, stagedExecutable);
    await rm(archivePath, { force: true });
    await rm(extractionDirectory, { recursive: true, force: true });
    await writeFile(join(stageDirectory, "component-receipt.json"), `${JSON.stringify({
      schemaVersion: 1,
      packageName: manifest.packageName,
      version: manifest.version,
      integrity: manifest.integrity,
      binarySha256: manifest.binarySha256,
      binarySizeBytes: manifest.binarySizeBytes
    })}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    signal.throwIfAborted();

    const current = await lstat(componentDirectory).catch(() => null);
    if (current) {
      if (current.isSymbolicLink() || !current.isDirectory()) throw new Error("Claude SDK 缓存目标不是有效目录；已拒绝覆盖。");
      const verified = await verifyCachedComponent(componentDirectory, manifest);
      if (verified) return verified;
      await rm(componentDirectory, { recursive: true, force: true });
    }
    await rename(stageDirectory, componentDirectory);
    const installedPath = await verifyCachedComponent(componentDirectory, manifest);
    if (!installedPath) throw new Error("Claude SDK 安装后复核失败，已拒绝启动。");
    await cleanupOldComponents(componentRoot, componentDirectory);
    onProgress?.("Claude SDK 运行组件已校验并就绪。");
    return installedPath;
  } finally {
    const stageInfo = await lstat(stageDirectory).catch(() => null);
    if (stageInfo && !stageInfo.isSymbolicLink() && stageInfo.isDirectory()) {
      await rm(stageDirectory, { recursive: true, force: true });
    }
  }
}

/** Returns undefined outside the packaged desktop runtime so the official SDK uses its normal local package resolution. */
export async function ensureClaudeSdkExecutable({
  manifestPath = process.env.LFAA_CLAUDE_SDK_COMPONENT_MANIFEST,
  homeDirectory,
  signal = new AbortController().signal,
  fetcher = fetch,
  onProgress
} = {}) {
  if (!manifestPath) return undefined;
  if (typeof manifestPath !== "string" || !manifestPath.trim()) throw new Error("Claude SDK 组件清单路径无效。");
  const absoluteManifestPath = resolve(manifestPath);
  const manifest = await readManifest(absoluteManifestPath);
  const home = homeDirectory
    ? resolve(homeDirectory)
    : resolveHomeDirectory(process.cwd(), process.env.LFAA_HOME ?? "");
  const runtimeComponents = resolveHomePaths(home).runtimeComponents;
  const componentDirectory = join(runtimeComponents, "claude-agent-sdk", `${manifest.version}-${manifest.binarySha256.slice(0, 16)}`);
  ensureInside(runtimeComponents, componentDirectory);
  const existingDirectoryInfo = await lstat(componentDirectory).catch(() => null);
  if (existingDirectoryInfo) {
    if (existingDirectoryInfo.isSymbolicLink() || !existingDirectoryInfo.isDirectory()) {
      throw new Error("Claude SDK 缓存目标不是有效目录；已拒绝使用。");
    }
    const verified = await verifyCachedComponent(componentDirectory, manifest);
    if (verified) return verified;
  }

  const key = `${manifest.version}\0${manifest.integrity}\0${runtimeComponents}`;
  let pending = activeDownloads.get(key);
  if (!pending) {
    pending = installComponent(manifest, runtimeComponents, signal, fetcher, onProgress);
    activeDownloads.set(key, pending);
    pending.finally(() => {
      if (activeDownloads.get(key) === pending) activeDownloads.delete(key);
    }).catch(() => undefined);
  }
  return pending;
}
