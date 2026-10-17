/**
 * 功能：管理 Windows 本地开发环境和桌面端的数据根目录迁移请求。
 * 作用：校验管理员填写的目标位置，并把迁移计划保存在项目或桌面用户配置目录的标记中；实际复制由完整启动器在服务停止后执行。
 * 关联文件：packages/util/launch-environment/src/config.ts、packages/api/gateway/src/index.ts、scripts/apply-data-directory-migration.mjs、scripts/start-dev.ps1、apps/desktop-electron/src/main.mjs、apps/desktop-tauri/src-tauri/src/main.rs、packages/client/ui-settings/src/SettingsPage.tsx。
 */
import { randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, relative, resolve, sep } from "node:path";
import { config } from "lfaa-launch-environment/src/config.js";
import { database } from "lfaa-storage-sqlite/src/database.js";
import { resolveDataDirectory } from "lfaa-home-paths/src/resolve-data-directory.mjs";

interface DataDirectoryMigrationRequest {
  version: 2;
  migrationId: string;
  sourceDirectory: string;
  targetDirectory: string;
  mode: DataDirectoryMigrationMode;
  archivePath?: string;
  requestedAt: string;
  lastError?: string;
}

export type DataDirectoryMigrationMode = "copy" | "adopt" | "archive";

export interface DataDirectorySettings {
  defaultDirectory: string;
  recommendedDirectory: string;
  selection: "default" | "recommended" | "custom";
  configured: boolean;
  currentDirectory: string;
  pendingDirectory: string | null;
  pendingMode: DataDirectoryMigrationMode | null;
  pendingArchivePath: string | null;
  pendingError: string | null;
  editable: boolean;
  unavailableReason: string | null;
}

export class DataDirectorySettingsError extends Error {
  constructor(message: string, readonly errorCode: "data_directory_change_unavailable" | "invalid_data_directory" | "data_directory_target_not_empty" | "data_directory_migration_unavailable") {
    super(message);
    this.name = "DataDirectorySettingsError";
  }
}

function isWithinDirectory(parentDirectory: string, candidateDirectory: string): boolean {
  const pathFromParent = relative(parentDirectory, candidateDirectory);
  return pathFromParent === "" || (pathFromParent !== ".." && !pathFromParent.startsWith(`..${sep}`) && !isAbsolute(pathFromParent));
}

function readMigrationRequest(): DataDirectoryMigrationRequest | null {
  if (!existsSync(config.dataDirectoryMigrationRequestPath)) return null;

  try {
    const parsed = JSON.parse(readFileSync(config.dataDirectoryMigrationRequestPath, "utf8")) as { version?: number; migrationId?: string; sourceDirectory?: string; targetDirectory?: string; mode?: unknown; archivePath?: string; requestedAt?: string; lastError?: string };
    if (![1, 2].includes(Number(parsed.version)) || typeof parsed.migrationId !== "string" || typeof parsed.sourceDirectory !== "string" || typeof parsed.targetDirectory !== "string" || typeof parsed.requestedAt !== "string") {
      throw new Error("invalid request");
    }
    return { ...parsed, version: 2, mode: parsed.version === 1 ? "copy" : isMigrationMode(parsed.mode) ? parsed.mode : "copy" } as DataDirectoryMigrationRequest;
  } catch {
    throw new DataDirectorySettingsError("待处理的数据目录迁移配置无法读取；为保护现有数据，请先检查项目根目录中的迁移标记。", "data_directory_migration_unavailable");
  }
}

export function getDataDirectorySettings(): DataDirectorySettings {
  const pendingRequest = readMigrationRequest();
  const defaultDirectory = resolveDataDirectory(config.repositoryRoot);
  const recommendedDirectory = resolve(config.desktopInstallDirectory || config.repositoryRoot, "data");
  const selected = pendingRequest?.targetDirectory ?? config.dataDirectory;
  return {
    defaultDirectory,
    recommendedDirectory,
    selection: samePath(selected, defaultDirectory) ? "default" : samePath(selected, recommendedDirectory) ? "recommended" : "custom",
    configured: existsSync(resolve(config.dataDirectory, "credentials", "storage-location-confirmed.json")) || pendingRequest !== null,
    currentDirectory: config.dataDirectory,
    pendingDirectory: pendingRequest?.targetDirectory ?? null,
    pendingMode: pendingRequest?.mode ?? null,
    pendingArchivePath: pendingRequest?.mode === "archive" ? pendingRequest.archivePath ?? null : null,
    pendingError: pendingRequest?.lastError ?? null,
    editable: config.dataDirectoryChangeSupported,
    unavailableReason: config.dataDirectoryChangeSupported ? null : config.dataDirectoryChangeUnavailableReason
  };
}
/** 推荐路径由本 Owner 产生；用户显式保存推荐选择时也可从自定义根安排迁移。 */
export function recommendDataDirectoryLocation(): DataDirectorySettings {
  const settings = getDataDirectorySettings();
  return requestDataDirectoryChange(settings.recommendedDirectory);
}

/** 在原数据 Owner 中记录用户已确认当前存储位置，不另造一份 data 根配置。 */
export function confirmDataDirectoryLocation(): DataDirectorySettings {
  const directory = resolve(config.dataDirectory, "credentials");
  const info = lstatSync(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new DataDirectorySettingsError("存储配置目录无效。", "invalid_data_directory");
  const temporary = resolve(directory, `.storage-location-${randomUUID()}.tmp`);
  try { writeFileSync(temporary, JSON.stringify({ version: 1, confirmedAt: new Date().toISOString() }), { flag: "wx", mode: 0o600 }); renameSync(temporary, resolve(directory, "storage-location-confirmed.json")); }
  finally { rmSync(temporary, { force: true }); }
  return getDataDirectorySettings();
}

function normalizeTargetDirectory(value: string, mode: DataDirectoryMigrationMode): string {
  const target = value.trim();
  if (!target || target.length > 2048 || !isAbsolute(target)) {
    throw new DataDirectorySettingsError("请输入有效的绝对目录路径。", "invalid_data_directory");
  }

  const resolved = resolve(target);
  // 历史自定义根可能不叫 data，保留当前目录不能被误判为迁移到它的子目录。
  return mode === "adopt" || samePath(resolved, config.dataDirectory) || basename(resolved).toLocaleLowerCase("en-US") === "data" ? resolved : resolve(resolved, "data");
}

function assertSafeDirectoryPair(sourceDirectory: string, targetDirectory: string): void {
  const source = resolve(sourceDirectory);
  const target = resolve(targetDirectory);
  if (isWithinDirectory(source, target) || isWithinDirectory(target, source)) {
    throw new DataDirectorySettingsError("新目录不能与当前数据目录相同，也不能位于当前数据目录的内部或上级。", "invalid_data_directory");
  }

  const repository = resolve(config.repositoryRoot);
  if (!config.desktopDataDirectoryManaged && !samePath(target, resolve(repository, "data")) && (isWithinDirectory(repository, target) || isWithinDirectory(target, repository))) {
    throw new DataDirectorySettingsError("项目内只允许使用根目录的 data，不能使用源码目录或项目的上级目录。", "invalid_data_directory");
  }
  if (config.desktopDataDirectoryManaged && config.desktopInstallDirectory) {
    const installDirectory = resolve(config.desktopInstallDirectory);
    const installDataDirectory = resolve(installDirectory, "data");
    if (isWithinDirectory(installDirectory, target) && !samePath(target, installDataDirectory)) {
      throw new DataDirectorySettingsError("安装目录内只有 data 子目录会在卸载时保留；请选择安装目录 data 或安装目录之外的位置。", "invalid_data_directory");
    }
  }
  if (!config.desktopDataDirectoryManaged && isWithinDirectory(source, repository)) {
    throw new DataDirectorySettingsError("当前数据目录覆盖了项目源码目录，无法安全迁移；请先通过启动配置将它改到独立数据目录。", "data_directory_migration_unavailable");
  }
}

function samePath(left: string, right: string): boolean {
  const leftResolved = resolve(left);
  const rightResolved = resolve(right);
  return process.platform === "win32"
    ? leftResolved.toLocaleLowerCase("en-US") === rightResolved.toLocaleLowerCase("en-US")
    : leftResolved === rightResolved;
}

function assertTargetDirectoryCanBeUsed(targetDirectory: string, mode: DataDirectoryMigrationMode): void {
  try {
    if (mode === "adopt") {
      const existing = lstatSync(targetDirectory);
      if (existing.isSymbolicLink() || !existing.isDirectory()) throw new Error("manual target must be an existing directory");
    } else mkdirSync(targetDirectory, { recursive: true });
    const info = lstatSync(targetDirectory);
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new Error("not a regular directory");
    }
    const realTargetDirectory = realpathSync.native(targetDirectory);
    const realSourceDirectory = realpathSync.native(config.dataDirectory);
    if (isWithinDirectory(realSourceDirectory, realTargetDirectory) || isWithinDirectory(realTargetDirectory, realSourceDirectory)) {
      throw new DataDirectorySettingsError("目标目录与当前数据目录在文件系统中重叠；请改选其他位置。", "invalid_data_directory");
    }
    const realRepository = realpathSync.native(config.repositoryRoot);
    if (!samePath(realTargetDirectory, resolve(realRepository, "data")) && (isWithinDirectory(realRepository, realTargetDirectory) || isWithinDirectory(realTargetDirectory, realRepository))) {
      throw new DataDirectorySettingsError("解析符号链接后目标目录与源码目录重叠；请改选源码目录之外的位置。", "invalid_data_directory");
    }
    if (config.desktopDataDirectoryManaged && config.desktopInstallDirectory) {
      const realInstallDirectory = realpathSync.native(config.desktopInstallDirectory);
      const realInstallDataDirectory = resolve(realInstallDirectory, "data");
      if (isWithinDirectory(realInstallDirectory, realTargetDirectory) && !samePath(realTargetDirectory, realInstallDataDirectory)) {
        throw new DataDirectorySettingsError("解析符号链接后目标位于安装目录的非 data 位置；请改选安装目录 data 或其他磁盘。", "invalid_data_directory");
      }
    }
    const existingEntries = readdirSync(realTargetDirectory);
    if (mode === "adopt" && existingEntries.length === 0) {
      throw new DataDirectorySettingsError("手动复制模式需要选择已复制完成且包含 LFAA 数据的目录。", "invalid_data_directory");
    }
    if (mode !== "adopt" && existingEntries.length > 0) {
      throw new DataDirectorySettingsError("目标目录不是空目录。为避免覆盖其中的文件，请选择一个新的空目录。", "data_directory_target_not_empty");
    }

    const probePath = resolve(realTargetDirectory, `.lfaa-write-check-${randomUUID()}`);
    writeFileSync(probePath, "LFAA", { flag: "wx", mode: 0o600 });
    rmSync(probePath);
  } catch (error) {
    if (error instanceof DataDirectorySettingsError) throw error;
    if (mode === "adopt" && (error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new DataDirectorySettingsError("手动复制目标目录不存在；请先复制完整 data 文件夹。", "invalid_data_directory");
    }
    throw new DataDirectorySettingsError("无法在目标位置创建或写入文件，请检查磁盘是否已连接以及当前账户的目录权限。", "invalid_data_directory");
  }
}

function assertLocalDataIsIdle(): void {
  const normalizedDirectory = resolve(config.dataDirectory).replaceAll("/", "\\").replace(/[\\]+$/u, "").toLocaleLowerCase("en-US");
  const row = database.prepare(`
    SELECT
      (SELECT COUNT(*) FROM minecraft_instances i JOIN daemon_nodes n ON n.id = i.node_id
        WHERE lower(rtrim(replace(n.data_root, '/', char(92)), char(92))) = ?
          AND i.state NOT IN ('stopped', 'error')) AS active_instances,
      (SELECT COUNT(*) FROM minecraft_tasks t JOIN daemon_nodes n ON n.id = t.node_id
        WHERE lower(rtrim(replace(n.data_root, '/', char(92)), char(92))) = ?
          AND t.status IN ('queued', 'running'))
      + (SELECT COUNT(*) FROM steamcmd_tasks t JOIN daemon_nodes n ON n.id = t.node_id
        WHERE lower(rtrim(replace(n.data_root, '/', char(92)), char(92))) = ?
          AND t.status IN ('queued', 'running'))
      + (SELECT COUNT(*) FROM node_file_tasks t JOIN daemon_nodes n ON n.id = t.node_id
        WHERE lower(rtrim(replace(n.data_root, '/', char(92)), char(92))) = ?
          AND t.status IN ('queued', 'running')) AS active_tasks
  `).get(normalizedDirectory, normalizedDirectory, normalizedDirectory, normalizedDirectory) as { active_instances: number; active_tasks: number };

  if (row.active_instances > 0 || row.active_tasks > 0) {
    throw new DataDirectorySettingsError("请先停止本机 Minecraft 实例，并等待 SteamCMD、文件和其他节点任务全部结束，再安排数据目录迁移。", "data_directory_migration_unavailable");
  }
}

function writeMigrationRequest(request: DataDirectoryMigrationRequest): void {
  const markerPath = config.dataDirectoryMigrationRequestPath;
  const temporaryPath = `${markerPath}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(request, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    if (existsSync(markerPath)) rmSync(markerPath);
    renameSync(temporaryPath, markerPath);
  } catch (error) {
    rmSync(temporaryPath, { force: true });
    throw new DataDirectorySettingsError(error instanceof Error ? error.message : "无法保存数据目录迁移请求。", "data_directory_migration_unavailable");
  }
}

function isMigrationMode(value: unknown): value is DataDirectoryMigrationMode { return value === "copy" || value === "adopt" || value === "archive"; }

function validateArchivePath(value: string): string {
  const archivePath = value.trim();
  if (!archivePath || archivePath.length > 2048 || !isAbsolute(archivePath) || !/\.zip$/iu.test(archivePath)) {
    throw new DataDirectorySettingsError("请输入控制端可访问的 ZIP 绝对路径。", "invalid_data_directory");
  }
  try {
    const info = lstatSync(archivePath);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error("not a regular archive");
  } catch {
    throw new DataDirectorySettingsError("找不到 ZIP 文件，或它不是普通文件；请填写控制端上的完整路径。", "invalid_data_directory");
  }
  return resolve(archivePath);
}

export function requestDataDirectoryChange(value: string, mode: DataDirectoryMigrationMode = "copy", archivePathValue = ""): DataDirectorySettings {
  if (!config.dataDirectoryChangeSupported) {
    throw new DataDirectorySettingsError(config.dataDirectoryChangeUnavailableReason, "data_directory_change_unavailable");
  }

  if (!isMigrationMode(mode)) throw new DataDirectorySettingsError("迁移方式无效。", "invalid_data_directory");
  const targetDirectory = normalizeTargetDirectory(value, mode);
  const archivePath = mode === "archive" ? validateArchivePath(archivePathValue) : undefined;
  if (samePath(targetDirectory, config.dataDirectory)) {
    cancelDataDirectoryChange();
    return confirmDataDirectoryLocation();
  }

  assertLocalDataIsIdle();
  assertSafeDirectoryPair(config.dataDirectory, targetDirectory);
  assertTargetDirectoryCanBeUsed(targetDirectory, mode);
  const previousRequest = readMigrationRequest();
  const migrationId = previousRequest
    && samePath(previousRequest.sourceDirectory, config.dataDirectory)
    && samePath(previousRequest.targetDirectory, targetDirectory)
    ? previousRequest.migrationId
    : randomUUID();
  writeMigrationRequest({
    version: 2,
    migrationId,
    sourceDirectory: config.dataDirectory,
    targetDirectory,
    mode,
    ...(archivePath ? { archivePath } : {}),
    requestedAt: new Date().toISOString()
  });
  return getDataDirectorySettings();
}

export function cancelDataDirectoryChange(): void {
  if (existsSync(config.dataDirectoryMigrationRequestPath)) {
    rmSync(config.dataDirectoryMigrationRequestPath);
  }
}
