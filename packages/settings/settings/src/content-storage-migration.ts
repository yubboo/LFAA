/**
 * 功能：迁移、核对和归档游戏/小说/漫剧业务内容。
 * 作用：只处理 games/ 与账户哈希下 Writing/AI Video 项目树，永不复制系统数据或 Profile。
 * 关联文件：project-storage.ts、settings-controller、SettingsPage.tsx、scripts/*-business-content-archive.ps1。
 */
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { cp, lstat, mkdir, readdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, parse, relative, resolve, sep } from "node:path";
import { config } from "lfaa-launch-environment/src/config.js";
import { assertProjectContentStoragePath, saveProjectContentDirectory, getProjectStorageLocations } from "./project-storage.js";

const maximumEntries = 250_000;
const maximumDifferenceDetails = 200;
const archiveManifestName = "lfaa-business-content.json";

export interface ProjectContentManifestEntry {
  path: string;
  type: "directory" | "file";
  size: number;
  sha256?: string;
}

export interface ProjectContentComparison {
  sourceDirectory: string;
  targetDirectory: string;
  sourceEntryCount: number;
  targetEntryCount: number;
  sourceFileCount: number;
  targetFileCount: number;
  sourceBytes: number;
  targetBytes: number;
  matching: boolean;
  differenceCount: number;
  differences: Array<{ path: string; kind: "missing" | "extra" | "type" | "size" | "hash" }>;
}

export interface ProjectContentMigrationResult {
  sourceDirectory: string;
  targetDirectory: string;
  copiedFiles: number;
  copiedBytes: number;
  backupDirectory: string | null;
  comparison: ProjectContentComparison;
  settings: ReturnType<typeof getProjectStorageLocations>;
}

function isWithin(parent: string, candidate: string): boolean {
  const fromParent = relative(resolve(parent), resolve(candidate));
  return fromParent === "" || (fromParent !== ".." && !fromParent.startsWith(`..${sep}`) && !isAbsolute(fromParent));
}

function samePath(left: string, right: string): boolean {
  const a = resolve(left);
  const b = resolve(right);
  return process.platform === "win32" ? a.toLocaleLowerCase("en-US") === b.toLocaleLowerCase("en-US") : a === b;
}

function normalizeRelativePath(value: string): string {
  const normalized = value.split(sep).join("/");
  if (!normalized || normalized.startsWith("/") || normalized.includes("\0") || normalized.split("/").some(segment => !segment || segment === "." || segment === "..")) {
    throw new Error("业务内容清单中包含无效路径。");
  }
  return normalized;
}

function isManagedContentPath(value: string): boolean {
  const path = normalizeRelativePath(value);
  return path === "games" || path.startsWith("games/")
    || /^users\/[0-9a-f]{64}\/projects\/(?:writing|aivideo)(?:\/|$)/iu.test(path);
}

function assertBusinessRoot(path: string, sourceDirectory?: string): string {
  if (!isAbsolute(path) || path.length > 2_048 || /[\r\n\0]/u.test(path)) throw new Error("内容目录必须是有效的本机绝对路径。");
  let directory = resolve(path);
  if (directory === parse(directory).root) throw new Error("业务内容目录不能是磁盘根目录。");
  directory = assertProjectContentStoragePath(directory);
  if (sourceDirectory && (isWithin(sourceDirectory, directory) || isWithin(directory, sourceDirectory))) throw new Error("来源和目标业务内容目录不能相同或相互嵌套。");
  return directory;
}

async function assertDirectoryChain(path: string, create: boolean): Promise<string> {
  const target = resolve(path);
  const root = parse(target).root;
  let current = root;
  for (const segment of relative(root, target).split(sep).filter(Boolean)) {
    current = resolve(current, segment);
    try {
      const info = await lstat(current);
      if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("内容目录包含符号链接、目录联接或非目录路径，已停止操作。");
      const actual = await realpath(current);
      if (!samePath(actual, current)) throw new Error("内容目录解析到了其他位置，已停止操作。");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT" || !create) throw error;
      await mkdir(current);
    }
  }
  return target;
}

async function assertRegularRoot(path: string): Promise<boolean> {
  try {
    const info = await lstat(path);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("业务内容根不是普通目录，或包含路径链接。");
    if (!samePath(await realpath(path), path)) throw new Error("业务内容根解析到了其他路径。");
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function hashFile(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function walkDirectory(root: string, directory: string, entries: ProjectContentManifestEntry[], seen: Set<string>): Promise<void> {
  const children = await readdir(directory, { withFileTypes: true });
  children.sort((left, right) => left.name.localeCompare(right.name, "en"));
  for (const child of children) {
    const fullPath = resolve(directory, child.name);
    const relativePath = normalizeRelativePath(relative(root, fullPath));
    const identity = relativePath.toLocaleLowerCase("en-US");
    if (seen.has(identity)) throw new Error(`业务内容中存在大小写冲突路径：${relativePath}`);
    seen.add(identity);
    const info = await lstat(fullPath);
    if (info.isSymbolicLink() || info.isBlockDevice() || info.isCharacterDevice() || info.isFIFO() || info.isSocket()) {
      throw new Error(`业务内容路径包含链接或特殊文件：${relativePath}`);
    }
    if (info.isDirectory()) {
      entries.push({ path: relativePath, type: "directory", size: 0 });
      if (entries.length > maximumEntries) throw new Error("业务内容条目超过安全检查上限。");
      await walkDirectory(root, fullPath, entries, seen);
      continue;
    }
    if (!info.isFile()) throw new Error(`业务内容中存在不支持的文件类型：${relativePath}`);
    entries.push({ path: relativePath, type: "file", size: info.size, sha256: await hashFile(fullPath) });
    if (entries.length > maximumEntries) throw new Error("业务内容条目超过安全检查上限。");
  }
}

export async function collectProjectContentManifest(path: string): Promise<ProjectContentManifestEntry[]> {
  const root = resolve(path);
  if (!(await assertRegularRoot(root))) return [];
  const entries: ProjectContentManifestEntry[] = [];
  const seen = new Set<string>();
  const games = resolve(root, "games");
  if (await assertRegularRoot(games)) {
    entries.push({ path: "games", type: "directory", size: 0 });
    seen.add("games");
    await walkDirectory(root, games, entries, seen);
  }
  const users = resolve(root, "users");
  if (await assertRegularRoot(users)) {
    const accounts = await readdir(users, { withFileTypes: true });
    for (const account of accounts) {
      if (!/^[0-9a-f]{64}$/iu.test(account.name)) continue;
      const accountRoot = resolve(users, account.name);
      const accountInfo = await lstat(accountRoot);
      if (accountInfo.isSymbolicLink()) throw new Error(`账户业务目录包含路径链接：users/${account.name}`);
      if (!accountInfo.isDirectory()) continue;
      for (const kind of ["writing", "aivideo"] as const) {
        const relativeRoot = `users/${account.name}/projects/${kind}`;
        const contentRoot = resolve(root, ...relativeRoot.split("/"));
        if (!(await assertRegularRoot(contentRoot))) continue;
        entries.push({ path: relativeRoot, type: "directory", size: 0 });
        seen.add(relativeRoot.toLocaleLowerCase("en-US"));
        await walkDirectory(root, contentRoot, entries, seen);
      }
    }
  }
  return entries.sort((left, right) => left.path.localeCompare(right.path, "en"));
}

function toMap(entries: ProjectContentManifestEntry[]): Map<string, ProjectContentManifestEntry> {
  return new Map(entries.map(entry => [entry.path.toLocaleLowerCase("en-US"), entry]));
}

function comparisonFromManifests(sourceDirectory: string, targetDirectory: string, source: ProjectContentManifestEntry[], target: ProjectContentManifestEntry[]): ProjectContentComparison {
  const sourceMap = toMap(source);
  const targetMap = toMap(target);
  const differences: ProjectContentComparison["differences"] = [];
  let differenceCount = 0;
  for (const entry of source) {
    const key = entry.path.toLocaleLowerCase("en-US");
    const other = targetMap.get(key);
    let kind: ProjectContentComparison["differences"][number]["kind"] | null = null;
    if (!other) kind = "missing";
    else if (other.type !== entry.type) kind = "type";
    else if (entry.type === "file" && other.size !== entry.size) kind = "size";
    else if (entry.type === "file" && other.sha256 !== entry.sha256) kind = "hash";
    if (kind) { differenceCount += 1; if (differences.length < maximumDifferenceDetails) differences.push({ path: entry.path, kind }); }
  }
  for (const entry of target) {
    if (sourceMap.has(entry.path.toLocaleLowerCase("en-US"))) continue;
    differenceCount += 1;
    if (differences.length < maximumDifferenceDetails) differences.push({ path: entry.path, kind: "extra" });
  }
  const bytes = (items: ProjectContentManifestEntry[]) => items.reduce((sum, item) => sum + (item.type === "file" ? item.size : 0), 0);
  return {
    sourceDirectory, targetDirectory,
    sourceEntryCount: source.length, targetEntryCount: target.length,
    sourceFileCount: source.filter(item => item.type === "file").length,
    targetFileCount: target.filter(item => item.type === "file").length,
    sourceBytes: bytes(source), targetBytes: bytes(target),
    matching: differenceCount === 0, differenceCount, differences
  };
}

export async function compareProjectContentDirectories(targetValue: string): Promise<ProjectContentComparison> {
  const sourceDirectory = resolve(getProjectStorageLocations().settings.contentDirectory);
  const targetDirectory = assertBusinessRoot(targetValue);
  if (samePath(sourceDirectory, targetDirectory)) throw new Error("手动核对需要选择与当前内容目录不同的位置。");
  if (await assertRegularRoot(targetDirectory)) await assertDirectoryChain(targetDirectory, false);
  const [source, target] = await Promise.all([collectProjectContentManifest(sourceDirectory), collectProjectContentManifest(targetDirectory)]);
  return comparisonFromManifests(sourceDirectory, targetDirectory, source, target);
}

async function copyTree(source: string, target: string): Promise<void> {
  await assertDirectoryChain(dirname(target), true);
  const sourceInfo = await lstat(source);
  if (sourceInfo.isSymbolicLink()) throw new Error("业务内容中检测到链接，已停止复制。");
  if (sourceInfo.isDirectory()) {
    try {
      const targetInfo = await lstat(target);
      if (targetInfo.isSymbolicLink()) throw new Error("目标业务目录包含链接，已停止复制。");
      if (!targetInfo.isDirectory()) await rm(target, { force: true, recursive: true });
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    await mkdir(target, { recursive: true });
    for (const child of await readdir(source)) await copyTree(resolve(source, child), resolve(target, child));
    return;
  }
  if (!sourceInfo.isFile()) throw new Error("业务内容中存在不支持复制的特殊文件。");
  await mkdir(dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.lfaa-tmp`;
  try {
    await cp(source, temporary, { force: false, errorOnExist: true, preserveTimestamps: true });
    try {
      const existing = await lstat(target);
      if (existing.isSymbolicLink()) throw new Error("目标业务文件是路径链接，已停止复制。");
      await rm(target, { recursive: true, force: true });
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    await rename(temporary, target);
  } finally { await rm(temporary, { force: true }); }
}

function contentSubtreeRoots(entries: ProjectContentManifestEntry[]): string[] {
  return [...new Set(entries.map(entry => entry.path === "games" || entry.path.startsWith("games/") ? "games" : entry.path.match(/^users\/[0-9a-f]{64}\/projects\/(?:writing|aivideo)(?:\/|$)/iu)?.[0].replace(/\/$/u, "")).filter((value): value is string => Boolean(value)))].sort();
}

async function copyProjectContentTree(sourceDirectory: string, targetDirectory: string, sourceEntries?: ProjectContentManifestEntry[]): Promise<{ copiedFiles: number; copiedBytes: number; backupDirectory: string | null; comparison: ProjectContentComparison }> {
  const source = resolve(sourceDirectory);
  const target = assertBusinessRoot(targetDirectory);
  if (isWithin(target, source) || isWithin(source, target)) {
    throw new Error("来源和目标业务内容目录不能相同或相互嵌套。");
  }
  const sourceManifest = sourceEntries ?? await collectProjectContentManifest(source);
  await assertDirectoryChain(target, true);
  const targetManifest = await collectProjectContentManifest(target);
  const roots = contentSubtreeRoots(sourceManifest);
  let backupDirectory: string | null = null;
  if (targetManifest.length > 0 && roots.some(root => targetManifest.some(entry => entry.path === root || entry.path.startsWith(`${root}/`)))) {
    backupDirectory = resolve(target, ".lfaa-content-migration-backups", new Date().toISOString().replace(/[:.]/gu, "-") + `-${randomUUID()}`);
    await mkdir(backupDirectory, { recursive: true });
    for (const root of roots) {
      const existing = resolve(target, ...root.split("/"));
      if (!(await assertRegularRoot(existing))) continue;
      const backup = resolve(backupDirectory, ...root.split("/"));
      await mkdir(dirname(backup), { recursive: true });
      await cp(existing, backup, { recursive: true, errorOnExist: true, force: false, preserveTimestamps: true });
    }
  }
  for (const root of roots) {
    const sourceRoot = resolve(source, ...root.split("/"));
    const targetRoot = resolve(target, ...root.split("/"));
    if (!(await assertRegularRoot(sourceRoot))) continue;
    await copyTree(sourceRoot, targetRoot);
  }
  const targetAfter = await collectProjectContentManifest(target);
  const comparison = comparisonFromManifests(source, target, sourceManifest, targetAfter);
  if (comparison.differences.some(item => item.kind === "missing" || item.kind === "type" || item.kind === "size" || item.kind === "hash")) {
    throw new Error("复制后业务文件校验未通过；原位置仍保持生效，目标目录的覆盖前备份已保留。");
  }
  return {
    copiedFiles: sourceManifest.filter(entry => entry.type === "file").length,
    copiedBytes: sourceManifest.reduce((total, entry) => total + (entry.type === "file" ? entry.size : 0), 0),
    backupDirectory, comparison
  };
}

export async function copyProjectContentToDirectory(targetValue: string): Promise<ProjectContentMigrationResult> {
  const sourceDirectory = resolve(getProjectStorageLocations().settings.contentDirectory);
  const targetDirectory = assertBusinessRoot(targetValue);
  if (samePath(sourceDirectory, targetDirectory)) throw new Error("目标已经是当前业务内容目录。");
  const result = await copyProjectContentTree(sourceDirectory, targetDirectory);
  const saved = saveProjectContentDirectory(targetDirectory);
  return { sourceDirectory, targetDirectory, ...result, settings: saved };
}

async function runPowerShell(scriptName: string, args: string[]): Promise<void> {
  if (process.platform !== "win32") throw new Error("ZIP 业务备份目前需要 Windows 本机服务的系统压缩支持。");
  const scriptPath = resolve(config.repositoryRoot, "scripts", scriptName);
  await new Promise<void>((resolvePromise, reject) => {
    const child = execFile("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath, ...args], { windowsHide: true, maxBuffer: 256 * 1024 }, (error, _stdout, stderr) => {
      if (error) {
        const detail = stderr.trim() || error.message;
        reject(new Error(detail || "业务 ZIP 操作失败。"));
      } else resolvePromise();
    });
    // `-File` otherwise leaves PowerShell waiting for more commands on inherited stdin after the script exits.
    child.stdin?.end();
  });
}

function assertArchivePath(path: string): string {
  if (!isAbsolute(path) || !/\.zip$/iu.test(path) || path.length > 2_048) throw new Error("请选择 ZIP 备份文件的绝对路径。");
  return assertProjectContentStoragePath(resolve(path));
}

function validateArchiveManifest(value: unknown, actual: ProjectContentManifestEntry[]): void {
  const manifest = value as { format?: unknown; entries?: unknown };
  if (manifest?.format !== "lfaa-business-content-v1" || !Array.isArray(manifest.entries)) throw new Error("ZIP 不是受支持的 LFAA 业务内容备份。");
    const declared = manifest.entries as ProjectContentManifestEntry[];
  if (declared.length !== actual.length) throw new Error("ZIP 清单与内容数量不一致，拒绝导入。");
    const actualMap = toMap(actual);
    const seen = new Set<string>();
  for (const entry of declared) {
    if (typeof entry.path !== "string" || !isManagedContentPath(entry.path) || !["file", "directory"].includes(entry.type) || !Number.isSafeInteger(entry.size) || entry.size < 0) throw new Error("ZIP 清单包含无效业务路径或文件记录。");
      const key = entry.path.toLocaleLowerCase("en-US");
      if (seen.has(key)) throw new Error("ZIP 清单包含重复业务路径。");
      seen.add(key);
      const current = actualMap.get(key);
    if (!current || current.type !== entry.type || current.size !== entry.size || entry.type === "file" && (typeof entry.sha256 !== "string" || current.sha256 !== entry.sha256)) throw new Error(`ZIP 内容校验失败：${entry.path}`);
  }
}

export async function importProjectContentArchive(archiveValue: string, targetValue: string): Promise<ProjectContentMigrationResult> {
  const sourceDirectory = resolve(getProjectStorageLocations().settings.contentDirectory);
  const targetDirectory = assertBusinessRoot(targetValue);
  if (samePath(sourceDirectory, targetDirectory)) throw new Error("ZIP 导入目标不能是当前正在使用的内容目录。");
  const archivePath = assertArchivePath(archiveValue);
  const archiveInfo = await lstat(archivePath);
  if (!archiveInfo.isFile() || archiveInfo.isSymbolicLink()) throw new Error("ZIP 备份必须是普通文件。");
  await assertDirectoryChain(targetDirectory, true);
  const stagingDirectory = resolve(tmpdir(), `lfaa-content-import-${randomUUID()}`);
  await mkdir(stagingDirectory);
  try {
    await runPowerShell("extract-business-content-archive.ps1", ["-ArchivePath", archivePath, "-Destination", stagingDirectory]);
    const manifestPath = resolve(stagingDirectory, archiveManifestName);
    let staged = await collectProjectContentManifest(stagingDirectory);
    try {
      const parsed = JSON.parse(await readFile(manifestPath, "utf8")) as unknown;
      validateArchiveManifest(parsed, staged);
      staged = staged.sort((left, right) => left.path.localeCompare(right.path, "en"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      // 兼容普通 data ZIP；只提取受管业务子树，系统文件没有解压到目标。
    }
    const result = await copyProjectContentTree(stagingDirectory, targetDirectory, staged);
    const saved = saveProjectContentDirectory(targetDirectory);
    return { sourceDirectory, targetDirectory, ...result, settings: saved };
  } finally { await rm(stagingDirectory, { recursive: true, force: true }); }
}

export interface ProjectContentArchiveFile { path: string; fileName: string; cleanup: () => Promise<void> }

export async function createProjectContentArchive(): Promise<ProjectContentArchiveFile> {
  const sourceDirectory = resolve(getProjectStorageLocations().settings.contentDirectory);
  await assertDirectoryChain(sourceDirectory, true);
  const sourceManifest = await collectProjectContentManifest(sourceDirectory);
  const archiveId = randomUUID();
  const archivePath = resolve(sourceDirectory, `.lfaa-business-content-${archiveId}.zip`);
  const manifestPath = resolve(sourceDirectory, `.lfaa-business-content-${archiveId}.json`);
  const manifest = { format: "lfaa-business-content-v1", createdAt: new Date().toISOString(), entries: sourceManifest };
  try {
    await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`, { flag: "wx" });
    await runPowerShell("create-business-content-archive.ps1", ["-SourceRoot", sourceDirectory, "-ArchivePath", archivePath, "-ManifestPath", manifestPath, "-ManifestName", archiveManifestName]);
    const after = await collectProjectContentManifest(sourceDirectory);
    const comparison = comparisonFromManifests(sourceDirectory, sourceDirectory, sourceManifest, after);
    if (!comparison.matching) throw new Error("导出期间业务内容发生变化；为避免生成不完整备份，ZIP 未交付。");
    return {
      path: archivePath,
      fileName: `lfaa-business-content-${new Date().toISOString().replace(/[:.]/gu, "-")}.zip`,
      cleanup: async () => { await rm(archivePath, { force: true }); await rm(manifestPath, { force: true }); }
    };
  } catch (error) {
    await rm(archivePath, { force: true }); await rm(manifestPath, { force: true });
    throw error;
  }
}

export async function adoptProjectContentDirectory(targetValue: string): Promise<ProjectContentMigrationResult> {
  const comparison = await compareProjectContentDirectories(targetValue);
  if (!comparison.matching) throw new Error(`手动复制后的业务内容核对未通过：发现 ${comparison.differenceCount} 处差异；当前目录仍保持生效。`);
  const targetDirectory = assertBusinessRoot(targetValue);
  const saved = saveProjectContentDirectory(targetDirectory);
  return { sourceDirectory: comparison.sourceDirectory, targetDirectory, copiedFiles: 0, copiedBytes: 0, backupDirectory: null, comparison, settings: saved };
}

export function assertProjectContentTarget(value: string): string {
  return assertBusinessRoot(value);
}
