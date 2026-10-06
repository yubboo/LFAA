/** 功能：在 LFAA Daemon 数据根目录中安装并核验固定 EasyTier 官方运行包。 */
import { randomUUID } from "node:crypto";
import { lstat, readdir, rename, rm } from "node:fs/promises";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { EASYTIER_RUNTIME_RELEASE } from "lfaa-game-connectivity/src/easytier-release.mjs";

const runtimeDirectory = dataDirectory => resolve(dataDirectory, "environments", "easytier", `v${EASYTIER_RUNTIME_RELEASE.version}`);
const cacheDirectory = dataDirectory => resolve(dataDirectory, "cache", "easytier");

export function validateEasyTierInstallRequest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || value.operation !== "install-easytier-runtime"
    || value.version !== EASYTIER_RUNTIME_RELEASE.version
    || Object.keys(value).some(key => !["operation", "version"].includes(key))) {
    throw new Error("Daemon 拒绝执行未登记的 EasyTier 操作或版本。");
  }
  return { operation: value.operation, version: value.version };
}

export async function installEasyTierRuntime({ dataDirectory, ensureManagedDirectory, downloadAndVerify, expandArchive, probeVersion, signal, id = randomUUID() }) {
  if (typeof dataDirectory !== "string" || !dataDirectory) throw new Error("LFAA 数据目录无效，无法安装 EasyTier。");
  if (typeof ensureManagedDirectory !== "function" || typeof downloadAndVerify !== "function" || typeof expandArchive !== "function" || typeof probeVersion !== "function") {
    throw new Error("EasyTier 安装所需的受限节点执行器未装配。");
  }
  if (!/^[0-9a-f-]{36}$/iu.test(id)) throw new Error("EasyTier 安装暂存编号无效。");
  const installRoot = runtimeDirectory(dataDirectory);
  const cacheRoot = cacheDirectory(dataDirectory);
  const archivePath = resolve(cacheRoot, `easytier-${id}.zip`);
  const extractionRoot = resolve(cacheRoot, `easytier-${id}`);

  await ensureManagedDirectory(dirname(installRoot));
  const existingVersion = await readInstalledVersion(installRoot, probeVersion);
  if (existingVersion === EASYTIER_RUNTIME_RELEASE.version) {
    return { version: existingVersion, alreadyInstalled: true, capability: EASYTIER_RUNTIME_RELEASE.runtimeCapability };
  }
  if (existingVersion !== null) throw new Error("EasyTier 运行目录已存在但版本不匹配；为保护现有文件，拒绝覆盖。");
  const existingRoot = await lstat(installRoot).catch(error => error?.code === "ENOENT" ? null : Promise.reject(error));
  if (existingRoot) throw new Error("EasyTier 运行目录已存在但未通过版本核验；为保护现有文件，拒绝覆盖。");

  await ensureManagedDirectory(cacheRoot);
  await ensureManagedDirectory(extractionRoot);
  try {
    signal?.throwIfAborted();
    await downloadAndVerify(EASYTIER_RUNTIME_RELEASE.url, archivePath, {
      algorithm: "sha256",
      digest: EASYTIER_RUNTIME_RELEASE.sha256,
      size: EASYTIER_RUNTIME_RELEASE.sizeBytes,
      maxBytes: EASYTIER_RUNTIME_RELEASE.maximumBytes
    }, signal);
    signal?.throwIfAborted();
    await expandArchive(archivePath, extractionRoot);
    signal?.throwIfAborted();
    const executable = await findCoreExecutable(extractionRoot);
    if (!executable) throw new Error("官方归档内缺少唯一的 easytier-core.exe，安装已拒绝。");
    const version = await probeVersion(executable);
    if (version !== EASYTIER_RUNTIME_RELEASE.version) throw new Error("EasyTier 核心程序版本与固定官方清单不符，安装已拒绝。");

    await rename(extractionRoot, installRoot);
    const installedVersion = await readInstalledVersion(installRoot, probeVersion);
    if (installedVersion !== EASYTIER_RUNTIME_RELEASE.version) throw new Error("EasyTier 安装后回读核验失败。");
    return { version: installedVersion, alreadyInstalled: false, capability: EASYTIER_RUNTIME_RELEASE.runtimeCapability };
  } finally {
    await rm(archivePath, { force: true }).catch(() => {});
    // 成功时 extractionRoot 已原子移动到正式运行目录；失败时只清理由本任务创建的唯一暂存路径。
    await rm(extractionRoot, { recursive: true, force: true }).catch(() => {});
  }
}

export async function readInstalledEasyTierVersion({ dataDirectory, probeVersion }) {
  if (typeof dataDirectory !== "string" || !dataDirectory || typeof probeVersion !== "function") return null;
  const root = runtimeDirectory(dataDirectory);
  await assertManagedDirectories(dataDirectory, root);
  return await readInstalledVersion(root, probeVersion);
}

async function assertManagedDirectories(dataDirectory, target) {
  const rel = relative(dataDirectory, target);
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error("EasyTier 运行目录越过 LFAA 数据根目录。");
  let current = dataDirectory;
  const rootInfo = await lstat(current);
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) throw new Error("LFAA 数据根目录不是普通目录。");
  for (const segment of rel.split(sep)) {
    if (!segment) continue;
    current = resolve(current, segment);
    const info = await lstat(current).catch(error => error?.code === "ENOENT" ? null : Promise.reject(error));
    if (!info) return;
    if (info.isSymbolicLink() || !info.isDirectory()) throw new Error("EasyTier 运行目录包含符号链接或非目录路径。");
  }
}

async function readInstalledVersion(root, probeVersion) {
  const rootInfo = await lstat(root).catch(error => error?.code === "ENOENT" ? null : Promise.reject(error));
  if (!rootInfo) return null;
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) throw new Error("EasyTier 运行目录不是普通目录，已拒绝读取。");
  const executable = await findCoreExecutable(root);
  if (!executable) return null;
  const version = await probeVersion(executable);
  return version === EASYTIER_RUNTIME_RELEASE.version ? version : null;
}

async function findCoreExecutable(root) {
  const matches = [];
  const pending = [{ directory: root, depth: 0 }];
  let visited = 0;
  while (pending.length) {
    const { directory, depth } = pending.pop();
    const entries = await readdir(directory, { withFileTypes: true });
    visited += entries.length;
    if (visited > 2000 || depth > 5) throw new Error("EasyTier 官方归档目录结构超出安全上限。");
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error("EasyTier 归档包含符号链接，已拒绝使用。");
      if (entry.isDirectory()) pending.push({ directory: path, depth: depth + 1 });
      else if (entry.isFile() && basename(entry.name).toLocaleLowerCase() === "easytier-core.exe") matches.push(path);
    }
  }
  if (matches.length > 1) throw new Error("EasyTier 归档包含多个核心程序，无法安全确定运行入口。");
  if (matches.length === 1) {
    const rel = relative(root, matches[0]);
    if (rel === ".." || rel.startsWith(`..${sep}`)) throw new Error("EasyTier 核心程序越过受管理目录。");
  }
  return matches[0] ?? null;
}
