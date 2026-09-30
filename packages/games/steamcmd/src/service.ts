/**
 * 功能：管理 SteamCMD 专项配置、游戏存储路径并派发安装任务。
 * 作用：独立持久化安装方式/工具目录与游戏目录，同时为 Daemon 和任务提供合并后的节点有效设置。
 * 关联文件：packages/storage/storage-sqlite/src/database.ts、packages/api/gateway/src/index.ts、packages/host/daemon/src/local-daemon.ts、packages/host/daemon/src/daemon.mjs、packages/client/ui-settings/src/SettingsPage.tsx。
 */
import { randomUUID } from "node:crypto";
import { protectedDataDirectories } from "lfaa-home-paths/src/reserved-data-paths.mjs";
import { database } from "lfaa-storage-sqlite/src/database.js";
import { configuration } from "lfaa-storage-domain/src/configuration.js";
import { getDaemonNode } from "lfaa-host-daemon/src/local-daemon.js";

const taskLeaseDurationMilliseconds = 30_000;

export type SteamcmdInstallMode = "online" | "manual";
export type SteamcmdTaskKind = "install" | "verify";
export type SteamcmdTaskStatus = "queued" | "running" | "succeeded" | "failed";

export interface SteamcmdConfigurationValues {
  installMode: SteamcmdInstallMode;
  steamcmdDirectory: string;
}

export interface SteamcmdStorageValues {
  gameDirectory: string;
}

export interface SteamcmdSettingsValues extends SteamcmdConfigurationValues, SteamcmdStorageValues {}

export interface SteamcmdNodeSettings extends SteamcmdSettingsValues {
  nodeId: string;
}

export interface SteamcmdConfigurationNodeSettings extends SteamcmdConfigurationValues {
  nodeId: string;
}

export interface SteamcmdStorageNodeSettings extends SteamcmdStorageValues {
  nodeId: string;
}

export interface SteamcmdTask {
  id: string;
  nodeId: string;
  createdBy: string;
  kind: SteamcmdTaskKind;
  status: SteamcmdTaskStatus;
  progress: number;
  message: string;
  payload: SteamcmdNodeSettings;
  result: Record<string, unknown> | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

interface SteamcmdTaskRow {
  id: string;
  node_id: string;
  created_by: string;
  kind: SteamcmdTaskKind;
  status: SteamcmdTaskStatus;
  progress: number;
  message: string;
  payload_json: string;
  result_json: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

interface SteamcmdConfigurationRow {
  node_id: string;
  install_mode: SteamcmdInstallMode;
  steamcmd_directory: string;
}

interface SteamcmdStorageRow {
  node_id: string;
  game_directory: string;
}

interface SteamcmdConfigurationDefaultsRow extends Omit<SteamcmdConfigurationRow, "node_id"> {}
interface SteamcmdStorageDefaultsRow extends Omit<SteamcmdStorageRow, "node_id"> {}

export const defaultSteamcmdConfiguration = {
  installMode: "online" as const,
  steamcmdDirectory: "lib/steamcmd"
};
export const defaultSteamcmdStorage = { gameDirectory: "games/steamcmd" };
export const defaultSteamcmdNodeSettings = { ...defaultSteamcmdConfiguration, ...defaultSteamcmdStorage };

/** 配置路径只接受数据根目录内的安全相对路径，确保文件管理器能访问且不能越界。 */
export function validateSteamcmdDirectory(value: string): string {
  if (typeof value !== "string" || value.length > 512 || value.includes("\\") || value.startsWith("/") || /^[a-z]:/iu.test(value)) {
    throw new Error("目录必须是 LFAA 数据根目录内的相对路径。");
  }
  const segments = value.split("/");
  if (segments.length < 1 || segments.length > 16 || segments.some((segment) =>
    segment.length === 0 || segment.length > 120 || segment === "." || segment === ".."
    || /[<>:"|?*\u0000-\u001f]/u.test(segment) || /[ .]$/u.test(segment)
    || /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/iu.test(segment)
  )) {
    throw new Error("目录包含无效名称；请使用数据根目录内的普通相对路径。");
  }
  if (protectedDataDirectories.includes(segments[0]!.toLocaleLowerCase())) {
    throw new Error("SteamCMD 和游戏目录不能放在凭据、数据库、配置或会话目录中。");
  }
  return segments.join("/");
}

function validateConfiguration(input: SteamcmdConfigurationValues): SteamcmdConfigurationValues {
  if (input.installMode !== "online" && input.installMode !== "manual") throw new Error("SteamCMD 安装方式无效。");
  const steamcmdDirectory = validateSteamcmdDirectory(input.steamcmdDirectory);
  return { installMode: input.installMode, steamcmdDirectory };
}

function validateStorage(input: SteamcmdStorageValues): SteamcmdStorageValues {
  return { gameDirectory: validateSteamcmdDirectory(input.gameDirectory) };
}

function validateSettings(input: SteamcmdSettingsValues): SteamcmdSettingsValues {
  const configuration = validateConfiguration(input);
  const storage = validateStorage(input);
  const steamcmdDirectory = configuration.steamcmdDirectory;
  const gameDirectory = storage.gameDirectory;
  const toolPath = steamcmdDirectory.toLocaleLowerCase();
  const gamesPath = gameDirectory.toLocaleLowerCase();
  if (toolPath === gamesPath || toolPath.startsWith(`${gamesPath}/`) || gamesPath.startsWith(`${toolPath}/`)) {
    throw new Error("SteamCMD 工具目录和游戏存储目录不能相同或互相包含。");
  }
  return { ...configuration, ...storage };
}

function readConfigurationDefaultsRow(): SteamcmdConfigurationDefaultsRow | undefined {
  return configuration.get("steamcmd_configuration_defaults", row => (row.id === 1)) as SteamcmdConfigurationDefaultsRow | undefined;
}

function readStorageDefaultsRow(): SteamcmdStorageDefaultsRow | undefined {
  return configuration.get("steamcmd_storage_defaults", row => (row.id === 1)) as SteamcmdStorageDefaultsRow | undefined;
}

export function getSteamcmdConfigurationDefaults(): { settings: SteamcmdConfigurationValues; configured: boolean } {
  const row = readConfigurationDefaultsRow();
  return {
    configured: Boolean(row),
    settings: {
      installMode: row?.install_mode ?? defaultSteamcmdConfiguration.installMode,
      steamcmdDirectory: row?.steamcmd_directory ?? defaultSteamcmdConfiguration.steamcmdDirectory
    }
  };
}

export function getSteamcmdStorageDefaults(): { settings: SteamcmdStorageValues; configured: boolean } {
  const row = readStorageDefaultsRow();
  return {
    configured: Boolean(row),
    settings: { gameDirectory: row?.game_directory ?? defaultSteamcmdStorage.gameDirectory }
  };
}

export function getSteamcmdDefaults(): { settings: SteamcmdSettingsValues; configured: boolean } {
  const configuration = getSteamcmdConfigurationDefaults();
  const storage = getSteamcmdStorageDefaults();
  return { settings: { ...configuration.settings, ...storage.settings }, configured: configuration.configured || storage.configured };
}

function writeSteamcmdConfigurationDefaults(settings: SteamcmdConfigurationValues): void {
  configuration.save("steamcmd_configuration_defaults", { id: 1, install_mode: settings.installMode, steamcmd_directory: settings.steamcmdDirectory });
}

function writeSteamcmdStorageDefaults(settings: SteamcmdStorageValues): void {
  configuration.save("steamcmd_storage_defaults", { id: 1, game_directory: settings.gameDirectory });
}

export function saveSteamcmdConfigurationDefaults(input: SteamcmdConfigurationValues): SteamcmdConfigurationValues {
  const current = getSteamcmdDefaults().settings;
  const validated = validateSettings({ ...current, ...validateConfiguration(input) });
  writeSteamcmdConfigurationDefaults(validated);
  return { installMode: validated.installMode, steamcmdDirectory: validated.steamcmdDirectory };
}

export function saveSteamcmdStorageDefaults(input: SteamcmdStorageValues): SteamcmdStorageValues {
  const current = getSteamcmdDefaults().settings;
  const validated = validateSettings({ ...current, ...validateStorage(input) });
  writeSteamcmdStorageDefaults(validated);
  return { gameDirectory: validated.gameDirectory };
}

function readConfigurationRow(nodeId: string): SteamcmdConfigurationRow | undefined {
  return configuration.get("steamcmd_configuration_node_settings", row => (row.node_id === nodeId)) as SteamcmdConfigurationRow | undefined;
}

function readStorageRow(nodeId: string): SteamcmdStorageRow | undefined {
  return configuration.get("steamcmd_storage_node_settings", row => (row.node_id === nodeId)) as SteamcmdStorageRow | undefined;
}

export function getSteamcmdNodeConfiguration(nodeId: string): SteamcmdConfigurationNodeSettings {
  const row = readConfigurationRow(nodeId);
  const defaults = getSteamcmdConfigurationDefaults().settings;
  return {
    nodeId,
    installMode: row?.install_mode ?? defaults.installMode,
    steamcmdDirectory: row?.steamcmd_directory ?? defaults.steamcmdDirectory
  };
}

export function getSteamcmdNodeStorageSettings(nodeId: string): SteamcmdStorageNodeSettings {
  const row = readStorageRow(nodeId);
  const defaults = getSteamcmdStorageDefaults().settings;
  return { nodeId, gameDirectory: row?.game_directory ?? defaults.gameDirectory };
}

export function getSteamcmdNodeSettings(nodeId: string): SteamcmdNodeSettings {
  const configuration = getSteamcmdNodeConfiguration(nodeId);
  const storage = getSteamcmdNodeStorageSettings(nodeId);
  return {
    nodeId,
    installMode: configuration.installMode,
    steamcmdDirectory: configuration.steamcmdDirectory,
    gameDirectory: storage.gameDirectory
  };
}

export function hasSteamcmdNodeConfiguration(nodeId: string): boolean {
  return Boolean(readConfigurationRow(nodeId));
}

export function hasSteamcmdNodeStorageSettings(nodeId: string): boolean {
  return Boolean(readStorageRow(nodeId));
}

export function saveSteamcmdNodeConfiguration(input: SteamcmdConfigurationNodeSettings): SteamcmdConfigurationNodeSettings {
  if (!getDaemonNode(input.nodeId)) throw new Error("找不到目标 daemon 节点。");
  const current = getSteamcmdNodeSettings(input.nodeId);
  const validated = validateSettings({ ...current, ...validateConfiguration(input) });
  configuration.save("steamcmd_configuration_node_settings", { node_id: input.nodeId, install_mode: validated.installMode, steamcmd_directory: validated.steamcmdDirectory });
  return getSteamcmdNodeConfiguration(input.nodeId);
}

export function saveSteamcmdNodeStorageSettings(input: SteamcmdStorageNodeSettings): SteamcmdStorageNodeSettings {
  if (!getDaemonNode(input.nodeId)) throw new Error("找不到目标 daemon 节点。");
  const current = getSteamcmdNodeSettings(input.nodeId);
  const validated = validateSettings({ ...current, ...validateStorage(input) });
  configuration.save("steamcmd_storage_node_settings", { node_id: input.nodeId, game_directory: validated.gameDirectory });
  return getSteamcmdNodeStorageSettings(input.nodeId);
}

function parseJsonObject(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function toTask(row: SteamcmdTaskRow): SteamcmdTask {
  const payload = parseJsonObject(row.payload_json) ?? {};
  return {
    id: row.id,
    nodeId: row.node_id,
    createdBy: row.created_by,
    kind: row.kind,
    status: row.status,
    progress: row.progress,
    message: row.message,
    payload: {
      nodeId: row.node_id,
      installMode: payload.installMode === "manual" ? "manual" : "online",
      steamcmdDirectory: typeof payload.steamcmdDirectory === "string" ? payload.steamcmdDirectory : defaultSteamcmdNodeSettings.steamcmdDirectory,
      gameDirectory: typeof payload.gameDirectory === "string" ? payload.gameDirectory : defaultSteamcmdNodeSettings.gameDirectory
    },
    result: parseJsonObject(row.result_json),
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at
  };
}

export function createSteamcmdTask(input: { nodeId: string; createdBy: string; kind: SteamcmdTaskKind }): SteamcmdTask {
  const node = getDaemonNode(input.nodeId);
  if (!node || node.status !== "online" || node.platform !== "win32" || node.architecture !== "x64" || !node.capabilities.includes("node-filesystem-v1")) {
    throw new Error("所选 daemon 节点未连接或不支持 Windows x64 SteamCMD 任务。");
  }
  const settings = getSteamcmdNodeSettings(input.nodeId);
  if (input.kind === "install" && settings.installMode !== "online") throw new Error("当前选择了手动配置，请先切换到在线安装方式。");
  const active = database.prepare(`
    SELECT * FROM steamcmd_tasks WHERE node_id = ? AND status IN ('queued', 'running') ORDER BY created_at DESC LIMIT 1
  `).get(input.nodeId) as SteamcmdTaskRow | undefined;
  if (active) {
    if (active.kind !== input.kind) throw new Error("此节点已有另一项 SteamCMD 任务正在执行，请完成后再提交新任务。");
    return toTask(active);
  }

  const id = randomUUID();
  database.prepare(`
    INSERT INTO steamcmd_tasks (id, node_id, created_by, kind, status, progress, message, payload_json)
    VALUES (?, ?, ?, ?, 'queued', 0, ?, ?)
  `).run(id, input.nodeId, input.createdBy, input.kind, input.kind === "install" ? "等待 daemon 安装 SteamCMD。" : "等待 daemon 校验 SteamCMD。", JSON.stringify(settings));
  return getSteamcmdTask(id)!;
}

export function getSteamcmdTask(taskId: string): SteamcmdTask | null {
  const row = database.prepare("SELECT * FROM steamcmd_tasks WHERE id = ?").get(taskId) as SteamcmdTaskRow | undefined;
  return row ? toTask(row) : null;
}

export function renewSteamcmdTaskLeases(nodeId: string, taskIds: string[]): number {
  if (taskIds.length === 0) return 0;
  const expiresAt = new Date(Date.now() + taskLeaseDurationMilliseconds).toISOString();
  const placeholders = taskIds.map(() => "?").join(", ");
  const result = database.prepare(`
    UPDATE steamcmd_tasks SET lease_expires_at = ?
    WHERE node_id = ? AND status = 'running' AND id IN (${placeholders})
  `).run(expiresAt, nodeId, ...taskIds);
  return Number(result.changes);
}

export function claimNextSteamcmdTask(nodeId: string): SteamcmdTask | null {
  const now = new Date().toISOString();
  database.prepare(`
    UPDATE steamcmd_tasks
    SET status = 'failed', progress = 0, message = 'Daemon 任务租约已过期，安装结果未确认；请先校验 SteamCMD 状态。',
        result_json = '{"outcome":"unknown"}', finished_at = ?, lease_expires_at = NULL
    WHERE node_id = ? AND status = 'running' AND (lease_expires_at IS NULL OR lease_expires_at <= ?)
  `).run(now, nodeId, now);

  database.exec("BEGIN IMMEDIATE;");
  try {
    const row = database.prepare(`
      SELECT id FROM steamcmd_tasks WHERE node_id = ? AND status = 'queued' ORDER BY created_at, rowid LIMIT 1
    `).get(nodeId) as { id: string } | undefined;
    if (!row) {
      database.exec("COMMIT;");
      return null;
    }
    const startedAt = new Date().toISOString();
    const leaseExpiresAt = new Date(Date.now() + taskLeaseDurationMilliseconds).toISOString();
    const update = database.prepare(`
      UPDATE steamcmd_tasks SET status = 'running', progress = 5, message = 'Daemon 已接收 SteamCMD 任务。', started_at = ?, lease_expires_at = ?
      WHERE id = ? AND status = 'queued'
    `).run(startedAt, leaseExpiresAt, row.id);
    if (Number(update.changes) !== 1) {
      database.exec("COMMIT;");
      return null;
    }
    database.exec("COMMIT;");
    return getSteamcmdTask(row.id);
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

export function updateSteamcmdTaskProgress(taskId: string, nodeId: string, progress: number, message: string): boolean {
  const result = database.prepare(`
    UPDATE steamcmd_tasks SET progress = ?, message = ?
    WHERE id = ? AND node_id = ? AND status = 'running'
  `).run(progress, message.slice(0, 240), taskId, nodeId);
  return Number(result.changes) === 1;
}

export function completeSteamcmdTask(input: {
  taskId: string;
  nodeId: string;
  succeeded: boolean;
  message: string;
  result: Record<string, unknown>;
}): boolean {
  const result = database.prepare(`
    UPDATE steamcmd_tasks SET status = ?, progress = ?, message = ?, result_json = ?, finished_at = ?, lease_expires_at = NULL
    WHERE id = ? AND node_id = ? AND status = 'running'
  `).run(
    input.succeeded ? "succeeded" : "failed",
    input.succeeded ? 100 : 0,
    input.message.slice(0, 240),
    JSON.stringify(input.result),
    new Date().toISOString(),
    input.taskId,
    input.nodeId
  );
  return Number(result.changes) === 1;
}
