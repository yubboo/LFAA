/** 功能：报告 LFAA 本机系统数据根状态。
 * 作用：账户、Provider、会话和设置根由启动配置固定；业务内容迁移由 Settings 内容 Owner 单独负责。
 * 关联文件：packages/util/launch-environment/src/config.ts、packages/api/settings-controller/src/index.ts、packages/settings/settings/src/project-storage.ts。
 */
import { randomUUID } from "node:crypto";
import { existsSync, lstatSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "lfaa-launch-environment/src/config.js";
import { resolveDataDirectory } from "lfaa-home-paths/src/resolve-data-directory.mjs";

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

function samePath(left: string, right: string): boolean {
  const leftResolved = resolve(left);
  const rightResolved = resolve(right);
  return process.platform === "win32"
    ? leftResolved.toLocaleLowerCase("en-US") === rightResolved.toLocaleLowerCase("en-US")
    : leftResolved === rightResolved;
}

export function getDataDirectorySettings(): DataDirectorySettings {
  const defaultDirectory = resolveDataDirectory(config.repositoryRoot);
  const currentDirectory = config.dataDirectory;
  const isDefault = samePath(currentDirectory, defaultDirectory);
  return {
    defaultDirectory,
    recommendedDirectory: defaultDirectory,
    selection: isDefault ? "default" : "custom",
    configured: !isDefault || existsSync(resolve(currentDirectory, "credentials", "storage-location-confirmed.json")),
    currentDirectory,
    pendingDirectory: null,
    pendingMode: null,
    pendingArchivePath: null,
    pendingError: null,
    editable: false,
    unavailableReason: config.dataDirectoryChangeUnavailableReason
  };
}

/** 系统数据根没有可迁移的“推荐位置”；保留兼容路由但明确拒绝更改。 */
export function recommendDataDirectoryLocation(): DataDirectorySettings {
  throw new DataDirectorySettingsError(config.dataDirectoryChangeUnavailableReason, "data_directory_change_unavailable");
}

/** 确认当前系统数据根，不更改路径，也不复制任何账户数据。 */
export function confirmDataDirectoryLocation(): DataDirectorySettings {
  const directory = resolve(config.dataDirectory, "credentials");
  const info = lstatSync(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new DataDirectorySettingsError("存储配置目录无效。", "invalid_data_directory");
  const destination = resolve(directory, "storage-location-confirmed.json");
  const temporary = resolve(directory, `.storage-location-${randomUUID()}.tmp`);
  try {
    writeFileSync(temporary, JSON.stringify({ version: 1, confirmedAt: new Date().toISOString() }), { flag: "wx", mode: 0o600 });
    renameSync(temporary, destination);
  } finally {
    rmSync(temporary, { force: true });
  }
  return getDataDirectorySettings();
}

/** 系统数据只服从本机启动配置；所有复制、核对和归档仅由业务内容 Owner 提供。 */
export function requestDataDirectoryChange(value: string, mode: DataDirectoryMigrationMode = "copy", archivePathValue = ""): DataDirectorySettings {
  void value;
  void mode;
  void archivePathValue;
  throw new DataDirectorySettingsError(config.dataDirectoryChangeUnavailableReason, "data_directory_change_unavailable");
}

/** 兼容旧 API；系统数据根不再创建或删除迁移计划。 */
export function cancelDataDirectoryChange(): void {}
