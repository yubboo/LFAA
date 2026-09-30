/**
 * 功能：管理 Windows 本地开发环境和桌面端的数据根目录迁移请求。
 * 作用：校验管理员填写的目标位置，并把迁移计划保存在项目或桌面用户配置目录的标记中；实际复制由完整启动器在服务停止后执行。
 * 关联文件：packages/util/launch-environment/src/config.ts、packages/api/gateway/src/index.ts、scripts/apply-data-directory-migration.mjs、scripts/start-dev.ps1、apps/desktop-electron/src/main.mjs、apps/desktop-tauri/src-tauri/src/main.rs、packages/client/ui-settings/src/SettingsPage.tsx。
 */
import { randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { config } from "lfaa-launch-environment/src/config.js";
import { database } from "lfaa-storage-sqlite/src/database.js";

interface DataDirectoryMigrationRequest {
  version: 1;
  migrationId: string;
  sourceDirectory: string;
  targetDirectory: string;
  requestedAt: string;
  lastError?: string;
}

export interface DataDirectorySettings {
  currentDirectory: string;
  pendingDirectory: string | null;
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
    const parsed = JSON.parse(readFileSync(config.dataDirectoryMigrationRequestPath, "utf8")) as Partial<DataDirectoryMigrationRequest>;
    if (parsed.version !== 1 || typeof parsed.migrationId !== "string" || typeof parsed.sourceDirectory !== "string" || typeof parsed.targetDirectory !== "string" || typeof parsed.requestedAt !== "string") {
      throw new Error("invalid request");
    }
    return parsed as DataDirectoryMigrationRequest;
  } catch {
    throw new DataDirectorySettingsError("待处理的数据目录迁移配置无法读取；为保护现有数据，请先检查项目根目录中的迁移标记。", "data_directory_migration_unavailable");
  }
}

export function getDataDirectorySettings(): DataDirectorySettings {
  const pendingRequest = readMigrationRequest();
  return {
    currentDirectory: config.dataDirectory,
    pendingDirectory: pendingRequest?.targetDirectory ?? null,
    pendingError: pendingRequest?.lastError ?? null,
    editable: config.dataDirectoryChangeSupported,
    unavailableReason: config.dataDirectoryChangeSupported ? null : config.dataDirectoryChangeUnavailableReason
  };
}

function normalizeTargetDirectory(value: string): string {
  const target = value.trim();
  if (!target || target.length > 2048 || !isAbsolute(target)) {
    throw new DataDirectorySettingsError("请输入有效的绝对目录路径。", "invalid_data_directory");
  }

  return resolve(target);
}

function assertSafeDirectoryPair(sourceDirectory: string, targetDirectory: string): void {
  const source = resolve(sourceDirectory);
  const target = resolve(targetDirectory);
  if (isWithinDirectory(source, target) || isWithinDirectory(target, source)) {
    throw new DataDirectorySettingsError("新目录不能与当前数据目录相同，也不能位于当前数据目录的内部或上级。", "invalid_data_directory");
  }

  const repository = resolve(config.repositoryRoot);
  if (!config.desktopDataDirectoryManaged && (isWithinDirectory(repository, target) || isWithinDirectory(target, repository))) {
    throw new DataDirectorySettingsError("为避免把数据库和凭据放进源码目录或复制整个项目，新数据目录必须位于项目根目录之外。", "invalid_data_directory");
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

function assertTargetDirectoryCanBeUsed(targetDirectory: string): void {
  try {
    mkdirSync(targetDirectory, { recursive: true });
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
    if (isWithinDirectory(realRepository, realTargetDirectory) || isWithinDirectory(realTargetDirectory, realRepository)) {
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
    if (existingEntries.length > 0) {
      throw new DataDirectorySettingsError("目标目录不是空目录。为避免覆盖其中的文件，请选择一个新的空目录。", "data_directory_target_not_empty");
    }

    const probePath = resolve(realTargetDirectory, `.lfaa-write-check-${randomUUID()}`);
    writeFileSync(probePath, "LFAA", { flag: "wx", mode: 0o600 });
    rmSync(probePath);
  } catch (error) {
    if (error instanceof DataDirectorySettingsError) throw error;
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

export function requestDataDirectoryChange(value: string): DataDirectorySettings {
  if (!config.dataDirectoryChangeSupported) {
    throw new DataDirectorySettingsError(config.dataDirectoryChangeUnavailableReason, "data_directory_change_unavailable");
  }

  const targetDirectory = normalizeTargetDirectory(value);
  if (samePath(targetDirectory, config.dataDirectory)) {
    cancelDataDirectoryChange();
    return getDataDirectorySettings();
  }

  assertLocalDataIsIdle();
  assertSafeDirectoryPair(config.dataDirectory, targetDirectory);
  assertTargetDirectoryCanBeUsed(targetDirectory);
  const previousRequest = readMigrationRequest();
  const migrationId = previousRequest
    && samePath(previousRequest.sourceDirectory, config.dataDirectory)
    && samePath(previousRequest.targetDirectory, targetDirectory)
    ? previousRequest.migrationId
    : randomUUID();
  writeMigrationRequest({
    version: 1,
    migrationId,
    sourceDirectory: config.dataDirectory,
    targetDirectory,
    requestedAt: new Date().toISOString()
  });
  return getDataDirectorySettings();
}

export function cancelDataDirectoryChange(): void {
  if (existsSync(config.dataDirectoryMigrationRequestPath)) {
    rmSync(config.dataDirectoryMigrationRequestPath);
  }
}
