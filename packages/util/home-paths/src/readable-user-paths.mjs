/**
 * 功能：为业务作品提供可读且仍绑定稳定账户 ID 的用户目录。
 * 作用：限定在需要面向用户浏览的本机作品目录；其他账户数据继续使用既有哈希布局。
 * 关联文件：video/ai-video、document/writing、data-layout.mjs。
 */
import { existsSync, lstatSync, mkdirSync, opendirSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { protectPrivateDirectory } from "./private-directory.mjs";
import { resolveDataPaths } from "./data-layout.mjs";

const OWNER_MARKER = ".lfaa-user-owner.json";
const MAX_USER_DIRECTORIES = 2_048;
const MAX_NAME_LENGTH = 80;
const readableUserDirectoryCache = new Map();

function isSamePath(left, right) {
  return process.platform === "win32"
    ? left.toLocaleLowerCase("en-US") === right.toLocaleLowerCase("en-US")
    : left === right;
}

function ensureRealDirectory(path) {
  try { mkdirSync(path, { recursive: false, mode: 0o700 }); }
  catch (error) { if (error?.code !== "EEXIST") throw error; }
  const stat = lstatSync(path);
  const actual = realpathSync(path);
  if (!stat.isDirectory() || stat.isSymbolicLink() || !isSamePath(actual, path)) {
    throw new Error("作品账户目录必须是本机实际目录，拒绝符号链接或重定向。");
  }
}

function readOwner(path) {
  const markerPath = resolve(path, OWNER_MARKER);
  if (!existsSync(markerPath)) return null;
  const stat = lstatSync(markerPath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 4_096) {
    throw new Error("作品账户目录清单无效，拒绝访问重定向内容。");
  }
  let marker;
  try { marker = JSON.parse(readFileSync(markerPath, "utf8")); }
  catch { throw new Error("作品账户目录清单损坏；原目录已保留。"); }
  if (!marker || marker.format !== "lfaa-readable-user-directory" || marker.version !== 1
    || typeof marker.userId !== "string" || !marker.userId.trim() || marker.userId.length > 160) {
    throw new Error("作品账户目录清单格式无效；原目录已保留。");
  }
  return marker;
}

function writeOwner(path, userId) {
  const markerPath = resolve(path, OWNER_MARKER);
  const marker = {
    format: "lfaa-readable-user-directory",
    version: 1,
    userId
  };
  try { writeFileSync(markerPath, JSON.stringify(marker), { flag: "wx", mode: 0o600 }); }
  catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const existing = readOwner(path);
    if (existing?.userId !== userId) throw new Error("作品账户目录已归属其他账户；原目录已保留。");
  }
}

function cacheReadableDirectory(cacheKey, path, requestedName) {
  if (readableUserDirectoryCache.size >= MAX_USER_DIRECTORIES) readableUserDirectoryCache.clear();
  readableUserDirectoryCache.set(cacheKey, { path, requestedName });
}

function directoryContainsOnlyOwnerTemporaryFiles(path) {
  const directory = opendirSync(path);
  let count = 0;
  try {
    while (true) {
      const entry = directory.readSync();
      if (!entry) return true;
      count += 1;
      if (count > 64 || !entry.isFile() || !entry.name.startsWith(`${OWNER_MARKER}.`) || !entry.name.endsWith(".tmp")) return false;
    }
  } finally {
    try { directory.closeSync(); }
    catch (error) { if (error?.code !== "ERR_DIR_CLOSED") throw error; }
  }
}

function availableDirectoryName(usersRoot, requestedName, userId) {
  for (let suffix = 1; suffix <= 10_000; suffix += 1) {
    const name = suffix === 1 ? requestedName : `${requestedName} (${suffix})`;
    const candidate = resolve(usersRoot, name);
    if (!existsSync(candidate)) return { name, path: candidate };
    ensureRealDirectory(candidate);
    const owner = readOwner(candidate);
    if (owner?.userId === userId) return { name, path: candidate };
    if (!owner && directoryContainsOnlyOwnerTemporaryFiles(candidate)) return { name, path: candidate, claim: true };
  }
  throw new Error("无法为作品账户分配可读目录名；原文件已保留。");
}

/** 将任意标题/用户名转换为 Windows、macOS 与 Linux 均可用的单个目录名。 */
export function sanitizeReadableDirectoryName(value, fallback = "未命名作品") {
  const raw = typeof value === "string" ? value.normalize("NFC") : "";
  let name = raw
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/gu, "_")
    .replace(/[. ]+$/u, "")
    .trim();
  name = [...name].slice(0, MAX_NAME_LENGTH).join("").replace(/[. ]+$/u, "");
  if (!name || name === "." || name === "..") name = fallback;
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu.test(name)) name = `_${name}`;
  return [...name].slice(0, MAX_NAME_LENGTH).join("");
}

/** 创建/解析按可读账户名命名的业务用户目录，并用清单保持稳定账户归属。 */
export function ensureReadableUserDataPaths(dataDirectory, userId, username) {
  if (typeof userId !== "string" || !userId.trim() || userId.length > 160 || userId.includes("\0")) {
    throw new Error("用户数据目录标识无效。");
  }
  const requestedName = sanitizeReadableDirectoryName(username, "用户");
  const usersRoot = resolve(resolveDataPaths(dataDirectory).users);
  ensureRealDirectory(usersRoot);
  const cacheKey = `${usersRoot}\n${userId}`;
  const cached = readableUserDirectoryCache.get(cacheKey);
  if (cached && cached.requestedName === requestedName && existsSync(cached.path)) {
    ensureRealDirectory(cached.path);
    if (readOwner(cached.path)?.userId === userId) {
      protectPrivateDirectory(cached.path);
      return Object.freeze({ root: cached.path, projects: resolve(cached.path, "projects") });
    }
    readableUserDirectoryCache.delete(cacheKey);
  }
  const requestedPath = resolve(usersRoot, requestedName);
  if (existsSync(requestedPath)) {
    ensureRealDirectory(requestedPath);
    const owner = readOwner(requestedPath);
    if (owner?.userId === userId) {
      protectPrivateDirectory(requestedPath);
      cacheReadableDirectory(cacheKey, requestedPath, requestedName);
      return Object.freeze({ root: requestedPath, projects: resolve(requestedPath, "projects") });
    }
  }

  // A renamed account keeps its existing readable folder when that folder is unambiguous.
  const directory = opendirSync(usersRoot);
  let scanned = 0;
  let ownedPath = null;
  try {
    while (true) {
      const entry = directory.readSync();
      if (!entry) break;
      scanned += 1;
      if (scanned > MAX_USER_DIRECTORIES) throw new Error("作品账户目录数量超过有界核查上限；原文件已保留。");
      if (entry.isSymbolicLink() || !entry.isDirectory() || /^[a-f0-9]{64}$/iu.test(entry.name)) continue;
      const candidate = resolve(usersRoot, entry.name);
      ensureRealDirectory(candidate);
      const owner = readOwner(candidate);
      if (owner?.userId === userId) {
        if (ownedPath) throw new Error("同一账户绑定了多个可读目录；请先核对目录，拒绝选择性访问。");
        ownedPath = candidate;
      }
    }
  } finally {
    try { directory.closeSync(); }
    catch (error) { if (error?.code !== "ERR_DIR_CLOSED") throw error; }
  }

  if (ownedPath) {
    let target = requestedPath;
    if (existsSync(target)) {
      const owner = readOwner(target);
      if (owner?.userId !== userId) target = availableDirectoryName(usersRoot, requestedName, userId).path;
    }
    if (!isSamePath(ownedPath, target)) {
      try { renameSync(ownedPath, target); }
      catch (error) {
        if (error?.code !== "EEXIST" && error?.code !== "EPERM") throw error;
        target = ownedPath;
      }
      writeOwner(target, userId);
    }
    protectPrivateDirectory(target);
    cacheReadableDirectory(cacheKey, target, requestedName);
    return Object.freeze({ root: target, projects: resolve(target, "projects") });
  }

  const available = availableDirectoryName(usersRoot, requestedName, userId);
  ensureRealDirectory(available.path);
  if (available.claim) {
    writeOwner(available.path, userId);
  } else {
    try { writeOwner(available.path, userId); }
    catch (error) {
      if (readOwner(available.path)?.userId !== userId) throw error;
    }
  }
  protectPrivateDirectory(available.path);
  cacheReadableDirectory(cacheKey, available.path, requestedName);
  return Object.freeze({ root: available.path, projects: resolve(available.path, "projects") });
}

/** 查找候选内容根中已绑定该账户的可读目录；没有目录时返回安全、尚未创建的候选路径。 */
export function resolveExistingReadableUserDataPaths(dataDirectory, userId, username) {
  if (typeof userId !== "string" || !userId.trim() || userId.length > 160 || userId.includes("\0")) {
    throw new Error("用户数据目录标识无效。");
  }
  const requestedName = sanitizeReadableDirectoryName(username, "用户");
  const usersRoot = resolve(resolveDataPaths(dataDirectory).users);
  const cacheKey = `${usersRoot}\n${userId}`;
  const cached = readableUserDirectoryCache.get(cacheKey);
  if (cached && existsSync(cached.path)) {
    ensureRealDirectory(cached.path);
    if (readOwner(cached.path)?.userId === userId) return Object.freeze({ root: cached.path, projects: resolve(cached.path, "projects") });
    readableUserDirectoryCache.delete(cacheKey);
  }

  const requestedPath = resolve(usersRoot, requestedName);
  if (existsSync(requestedPath)) {
    ensureRealDirectory(requestedPath);
    if (readOwner(requestedPath)?.userId === userId) return Object.freeze({ root: requestedPath, projects: resolve(requestedPath, "projects") });
  }

  if (existsSync(usersRoot)) {
    const directory = opendirSync(usersRoot);
    let scanned = 0;
    let ownedPath = null;
    try {
      while (true) {
        const entry = directory.readSync();
        if (!entry) break;
        scanned += 1;
        if (scanned > MAX_USER_DIRECTORIES) throw new Error("作品账户目录数量超过有界核查上限；原文件已保留。");
        if (entry.isSymbolicLink() || !entry.isDirectory() || /^[a-f0-9]{64}$/iu.test(entry.name)) continue;
        const candidate = resolve(usersRoot, entry.name);
        ensureRealDirectory(candidate);
        if (readOwner(candidate)?.userId !== userId) continue;
        if (ownedPath) throw new Error("同一账户绑定了多个可读目录；请先核对目录，拒绝选择性访问。");
        ownedPath = candidate;
      }
    } finally {
      try { directory.closeSync(); }
      catch (error) { if (error?.code !== "ERR_DIR_CLOSED") throw error; }
    }
    if (ownedPath) {
      cacheReadableDirectory(cacheKey, ownedPath, null);
      return Object.freeze({ root: ownedPath, projects: resolve(ownedPath, "projects") });
    }
  }

  for (let suffix = 1; suffix <= 10_000; suffix += 1) {
    const name = suffix === 1 ? requestedName : `${requestedName} (${suffix})`;
    const candidate = resolve(usersRoot, name);
    if (!existsSync(candidate)) return Object.freeze({ root: candidate, projects: resolve(candidate, "projects") });
  }
  throw new Error("无法为作品账户分配可读目录名；原文件已保留。");
}
