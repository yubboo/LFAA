/**
 * 功能：管理 SteamCMD 专项配置、游戏存储路径并派发安装任务。
 * 作用：独立持久化安装方式/工具目录与游戏目录，同时为 Daemon 和任务提供合并后的节点有效设置。
 * 关联文件：packages/storage/storage-sqlite/src/database.ts、packages/api/gateway/src/index.ts、packages/host/daemon/src/local-daemon.ts、packages/host/daemon/src/daemon.mjs、packages/client/ui-settings/src/SettingsPage.tsx。
 */
import { randomUUID } from "node:crypto";
import { win32 } from "node:path";
import { protectedDataDirectories } from "lfaa-home-paths/src/reserved-data-paths.mjs";
import { database } from "lfaa-storage-sqlite/src/database.js";
import { configuration } from "lfaa-storage-domain/src/configuration.js";
import { getDaemonDataRoot, getDaemonNode } from "lfaa-host-daemon/src/local-daemon.js";
import { getLocalProjectContentPath } from "lfaa-settings/src/project-storage.js";

const taskLeaseDurationMilliseconds = 30_000;

export type SteamcmdInstallMode = "online" | "manual";
export type SteamcmdTaskKind = "install" | "verify" | "install-server" | "update-server" | "start-server" | "stop-server";
export type SteamcmdTaskStatus = "queued" | "running" | "succeeded" | "failed";
export type SteamcmdServerStatus = "unknown" | "stopped" | "running" | "starting" | "stopping";
export type SteamcmdServerInstallationStatus = "unknown" | "installing" | "installed" | "failed";

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
  payload: SteamcmdNodeSettings & { operation?: SteamcmdTaskKind; server?: SteamcmdServerExecution };
  result: Record<string, unknown> | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface SteamcmdServerInput {
  nodeId: string;
  name: string;
  toolAppId: number;
  installDirectory: string;
  executablePath?: string;
  launchArguments?: string[];
  stopCommand?: string;
  stopTimeoutSeconds?: number;
  eulaAccepted: boolean;
}

export interface SteamcmdServer extends SteamcmdServerInput {
  id: string;
  createdBy: string;
  executablePath: string;
  launchArguments: string[];
  stopCommand: string;
  stopTimeoutSeconds: number;
  status: SteamcmdServerStatus;
  installationStatus: SteamcmdServerInstallationStatus;
  processId: number | null;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SteamcmdServerExecution extends Pick<SteamcmdServer, "id" | "nodeId" | "name" | "toolAppId" | "installDirectory" | "executablePath" | "launchArguments" | "stopCommand" | "stopTimeoutSeconds" | "eulaAccepted"> {}

interface SteamcmdServerRow {
  id: string; node_id: string; created_by: string; name: string; tool_app_id: number; install_directory: string;
  executable_path: string; launch_arguments_json: string; stop_command: string; stop_timeout_seconds: number; eula_accepted: number;
  installation_status: SteamcmdServerInstallationStatus; status: SteamcmdServerStatus; process_id: number | null;
  last_seen_at: string | null; created_at: string; updated_at: string;
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

/** SteamCMD 工具路径继续留在目标节点 data 根目录内。 */
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

/** 游戏内容目录可使用节点 data 相对路径或本机 Windows 磁盘绝对路径。 */
export function validateSteamcmdGameDirectory(value: string): string {
  if (typeof value !== "string" || value.length > 2_048 || /[\r\n\u0000]/u.test(value)) throw new Error("Steam 游戏目录无效。");
  if (!win32.isAbsolute(value)) return validateSteamcmdDirectory(value);
  if (value.split(/[\\/]/u).includes("..")) throw new Error("Steam 游戏目录不能包含父目录跳转。");
  const normalized = win32.normalize(value);
  const root = win32.parse(normalized).root;
  if (!/^[a-z]:\\$/iu.test(root) || normalized.length <= root.length) throw new Error("Steam 游戏目录必须位于可用磁盘的普通文件夹中，不能直接选择磁盘根目录。");
  const segments = win32.relative(root, normalized).split("\\");
  if (segments.some(segment => !segment || segment === "." || segment === ".." || segment.length > 120
    || /[<>:"|?*\u0000-\u001f]/u.test(segment) || /[ .]$/u.test(segment)
    || /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/iu.test(segment))) throw new Error("Steam 游戏目录包含无效路径片段。");
  return normalized;
}

function validateConfiguration(input: SteamcmdConfigurationValues): SteamcmdConfigurationValues {
  if (input.installMode !== "online" && input.installMode !== "manual") throw new Error("SteamCMD 安装方式无效。");
  const steamcmdDirectory = validateSteamcmdDirectory(input.steamcmdDirectory);
  return { installMode: input.installMode, steamcmdDirectory };
}

function validateStorage(input: SteamcmdStorageValues): SteamcmdStorageValues {
  return { gameDirectory: validateSteamcmdGameDirectory(input.gameDirectory) };
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

function validateRelativeGamePath(value: string, label: string): string {
  if (typeof value !== "string" || value.length > 1024 || value.includes("\\") || value.startsWith("/") || /^[a-z]:/iu.test(value)) {
    throw new Error(`${label} 必须是游戏目录内的相对路径。`);
  }
  const segments = value.split("/");
  if (!segments.length || segments.some(segment => !segment || segment === "." || segment === "..")) {
    throw new Error(`${label} 包含无效路径片段。`);
  }
  return validateSteamcmdDirectory(value);
}

function pathsOverlap(left: string, right: string): boolean {
  const normalizedLeft = win32.resolve(left).toLocaleLowerCase("en-US");
  const normalizedRight = win32.resolve(right).toLocaleLowerCase("en-US");
  const within = (value: string): boolean => value === "" || value !== ".." && !value.startsWith(`..${win32.sep}`) && !win32.isAbsolute(value);
  return within(win32.relative(normalizedLeft, normalizedRight)) || within(win32.relative(normalizedRight, normalizedLeft));
}

function validateSteamcmdServerInput(input: SteamcmdServerInput): SteamcmdServerInput & Required<Pick<SteamcmdServerInput, "executablePath" | "launchArguments" | "stopCommand" | "stopTimeoutSeconds">> {
  if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 80 || /[\u0000-\u001f\u007f]/u.test(input.name)) throw new Error("游戏服务器名称无效。");
  if (!Number.isSafeInteger(input.toolAppId) || input.toolAppId < 1 || input.toolAppId > 2_147_483_647) throw new Error("Steam 专用服务端 Tool AppID 必须是有效的正整数。");
  if (typeof input.eulaAccepted !== "boolean") throw new Error("必须明确记录是否接受该服务端的许可和 EULA。");
  const installDirectory = validateRelativeGamePath(input.installDirectory, "安装子目录");
  const executablePath = input.executablePath ? validateRelativeGamePath(input.executablePath, "服务端启动文件") : "";
  if (executablePath && !executablePath.toLocaleLowerCase().endsWith(".exe")) throw new Error("服务端启动文件必须是目标目录中的 .exe 程序。");
  const launchArguments = input.launchArguments ?? [];
  if (!Array.isArray(launchArguments) || launchArguments.length > 64 || launchArguments.some(argument => typeof argument !== "string" || argument.length > 1024 || /[\r\n\u0000]/u.test(argument))
    || launchArguments.reduce((total, argument) => total + Buffer.byteLength(argument, "utf8"), 0) > 8192) throw new Error("启动参数无效或超过容量限制。");
  if (launchArguments.some(argument => /(?:pass(?:word)?|passwd|token|secret|api[-_]?key|auth[-_]?key|rcon)/iu.test(argument))) {
    throw new Error("启动参数不能直接保存密码、令牌或密钥；请勿将机密写入服务器配置。");
  }
  const stopCommand = input.stopCommand?.trim() ?? "";
  if (stopCommand.length > 120 || /[\r\n\u0000-\u001f\u007f]/u.test(stopCommand)) throw new Error("控制台停服指令无效。");
  const stopTimeoutSeconds = input.stopTimeoutSeconds ?? 60;
  if (!Number.isSafeInteger(stopTimeoutSeconds) || stopTimeoutSeconds < 5 || stopTimeoutSeconds > 300) throw new Error("停服等待时间必须在 5 到 300 秒之间。");
  return { nodeId: input.nodeId, name: input.name.trim(), toolAppId: input.toolAppId, installDirectory, executablePath, launchArguments: [...launchArguments], stopCommand, stopTimeoutSeconds, eulaAccepted: input.eulaAccepted };
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
  const configuredDirectory = row?.game_directory ?? defaults.gameDirectory;
  const localContentDirectory = !row && !win32.isAbsolute(configuredDirectory)
    ? getLocalProjectContentPath(getDaemonDataRoot(nodeId), configuredDirectory)
    : null;
  return { nodeId, gameDirectory: validateSteamcmdGameDirectory(localContentDirectory ?? configuredDirectory) };
}

export function getSteamcmdNodeSettings(nodeId: string): SteamcmdNodeSettings {
  const configuration = getSteamcmdNodeConfiguration(nodeId);
  const storage = getSteamcmdNodeStorageSettings(nodeId);
  const dataRootValue = getDaemonDataRoot(nodeId);
  if (!dataRootValue) throw new Error("目标节点尚未提供可用的 SteamCMD 数据根目录。");
  const dataRoot = win32.resolve(dataRootValue);
  const steamcmdPath = win32.resolve(dataRoot, ...configuration.steamcmdDirectory.split("/"));
  const gamePath = win32.isAbsolute(storage.gameDirectory) ? win32.resolve(storage.gameDirectory) : win32.resolve(dataRoot, ...storage.gameDirectory.split("/"));
  const gameDataRelative = win32.relative(dataRoot, gamePath);
  const gameIsInsideData = gameDataRelative === "" || gameDataRelative !== ".." && !gameDataRelative.startsWith(`..${win32.sep}`) && !win32.isAbsolute(gameDataRelative);
  if (gameIsInsideData && protectedDataDirectories.includes(gameDataRelative.split(win32.sep)[0]?.toLocaleLowerCase() ?? "")) {
    throw new Error("Steam 游戏目录不能放在凭据、数据库、配置或会话目录中。");
  }
  if (pathsOverlap(steamcmdPath, gamePath)) throw new Error("SteamCMD 工具目录和游戏存储目录不能相同或互相包含。");
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

function parseStringArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every(item => typeof item === "string") ? parsed : [];
  } catch { return []; }
}

function toSteamcmdServer(row: SteamcmdServerRow): SteamcmdServer {
  return {
    id: row.id, nodeId: row.node_id, createdBy: row.created_by, name: row.name, toolAppId: row.tool_app_id,
    installDirectory: row.install_directory, executablePath: row.executable_path,
    launchArguments: parseStringArray(row.launch_arguments_json), stopCommand: row.stop_command, stopTimeoutSeconds: row.stop_timeout_seconds,
    eulaAccepted: row.eula_accepted === 1, status: row.status, installationStatus: row.installation_status,
    processId: row.process_id, lastSeenAt: row.last_seen_at, createdAt: row.created_at, updatedAt: row.updated_at
  };
}

export function listSteamcmdServers(nodeId?: string): SteamcmdServer[] {
  const rows = nodeId
    ? database.prepare("SELECT * FROM steamcmd_servers WHERE node_id = ? ORDER BY updated_at DESC, id").all(nodeId)
    : database.prepare("SELECT * FROM steamcmd_servers ORDER BY updated_at DESC, id").all();
  return (rows as unknown as SteamcmdServerRow[]).map(toSteamcmdServer);
}

export function getSteamcmdServer(serverId: string): SteamcmdServer | null {
  const row = database.prepare("SELECT * FROM steamcmd_servers WHERE id = ?").get(serverId) as SteamcmdServerRow | undefined;
  return row ? toSteamcmdServer(row) : null;
}

export function createSteamcmdServer(input: SteamcmdServerInput & { createdBy: string }): SteamcmdServer {
  const value = validateSteamcmdServerInput(input);
  const node = getDaemonNode(value.nodeId);
  if (!node || node.platform !== "win32" || node.architecture !== "x64") throw new Error("Steam 游戏服务目前只支持已登记的 Windows x64 Daemon 节点。");
  const count = database.prepare("SELECT COUNT(*) AS count FROM steamcmd_servers WHERE node_id = ?").get(value.nodeId) as { count: number };
  if (Number(count.count) >= 200) throw new Error("此节点最多登记 200 个 Steam 游戏服务器。");
  const id = randomUUID();
  database.prepare(`
    INSERT INTO steamcmd_servers (id, node_id, created_by, name, tool_app_id, install_directory, executable_path, launch_arguments_json, stop_command, stop_timeout_seconds, eula_accepted)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, value.nodeId, input.createdBy, value.name, value.toolAppId, value.installDirectory, value.executablePath,
    JSON.stringify(value.launchArguments), value.stopCommand, value.stopTimeoutSeconds, value.eulaAccepted ? 1 : 0);
  return getSteamcmdServer(id)!;
}

export function updateSteamcmdServer(serverId: string, input: SteamcmdServerInput): SteamcmdServer {
  const current = getSteamcmdServer(serverId);
  if (!current || current.nodeId !== input.nodeId) throw new Error("找不到此目标节点上的 Steam 游戏服务器。");
  if (current.status !== "stopped" && !(current.status === "unknown" && current.installationStatus === "unknown" && current.processId === null)) {
    throw new Error("服务器运行状态尚未确认停止，不能修改启动配置。");
  }
  const value = validateSteamcmdServerInput(input);
  if (current.installationStatus === "installed" && (value.toolAppId !== current.toolAppId || value.installDirectory !== current.installDirectory)) {
    throw new Error("已安装的服务端不能直接更换 Tool AppID 或安装目录；请为新服务端创建独立记录。");
  }
  database.prepare(`
    UPDATE steamcmd_servers SET name = ?, tool_app_id = ?, install_directory = ?, executable_path = ?, launch_arguments_json = ?, stop_command = ?, stop_timeout_seconds = ?, eula_accepted = ?, updated_at = ?
    WHERE id = ? AND node_id = ?
  `).run(value.name, value.toolAppId, value.installDirectory, value.executablePath, JSON.stringify(value.launchArguments), value.stopCommand,
    value.stopTimeoutSeconds, value.eulaAccepted ? 1 : 0, new Date().toISOString(), serverId, value.nodeId);
  return getSteamcmdServer(serverId)!;
}

export function steamcmdServerIdsForNode(nodeId: string): string[] {
  return (database.prepare("SELECT id FROM steamcmd_servers WHERE node_id = ? ORDER BY id").all(nodeId) as Array<{ id: string }>).map(row => row.id);
}

export function updateSteamcmdServerStatesFromDaemon(nodeId: string, servers: Array<{ id: string; status: SteamcmdServerStatus; processId: number | null }>): number {
  database.exec("BEGIN IMMEDIATE;");
  try {
    let changed = 0;
    const reported = new Set<string>();
    for (const server of servers) {
      reported.add(server.id);
      const result = database.prepare(`
        UPDATE steamcmd_servers SET status = ?, process_id = ?, last_seen_at = ?, updated_at = ?
        WHERE id = ? AND node_id = ? AND (status <> ? OR process_id IS NOT ?)
      `).run(server.status, server.processId, new Date().toISOString(), new Date().toISOString(), server.id, nodeId, server.status, server.processId);
      changed += Number(result.changes);
    }
    if (reported.size) {
      const placeholders = [...reported].map(() => "?").join(", ");
      const unknown = database.prepare(`UPDATE steamcmd_servers SET status = 'unknown', process_id = NULL WHERE node_id = ? AND status IN ('running', 'starting', 'stopping') AND id NOT IN (${placeholders})`)
        .run(nodeId, ...reported);
      changed += Number(unknown.changes);
    } else {
      const unknown = database.prepare("UPDATE steamcmd_servers SET status = 'unknown', process_id = NULL WHERE node_id = ? AND status IN ('running', 'starting', 'stopping')")
        .run(nodeId);
      changed += Number(unknown.changes);
    }
    database.exec("COMMIT;");
    return changed;
  } catch (error) {
    if (database.isTransaction) database.exec("ROLLBACK;");
    throw error;
  }
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
  const operation = ["install", "verify", "install-server", "update-server", "start-server", "stop-server"].includes(String(payload.operation))
    ? payload.operation as SteamcmdTaskKind : row.kind;
  const server = typeof payload.server === "object" && payload.server !== null && !Array.isArray(payload.server)
    ? payload.server as SteamcmdServerExecution : undefined;
  return {
    id: row.id,
    nodeId: row.node_id,
    createdBy: row.created_by,
    kind: operation,
    status: row.status,
    progress: row.progress,
    message: row.message,
    payload: {
      nodeId: row.node_id,
      installMode: payload.installMode === "manual" ? "manual" : "online",
      steamcmdDirectory: typeof payload.steamcmdDirectory === "string" ? payload.steamcmdDirectory : defaultSteamcmdNodeSettings.steamcmdDirectory,
      gameDirectory: typeof payload.gameDirectory === "string" ? payload.gameDirectory : defaultSteamcmdNodeSettings.gameDirectory,
      ...(operation !== row.kind ? { operation } : {}),
      ...(server ? { server } : {})
    },
    result: parseJsonObject(row.result_json),
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at
  };
}

function insertSteamcmdTask(input: { nodeId: string; createdBy: string; databaseKind: "install" | "verify"; responseKind: SteamcmdTaskKind; settings: SteamcmdNodeSettings; server?: SteamcmdServerExecution }): SteamcmdTask {
  const active = database.prepare(`
    SELECT * FROM steamcmd_tasks WHERE node_id = ? AND status IN ('queued', 'running') ORDER BY created_at DESC LIMIT 1
  `).get(input.nodeId) as SteamcmdTaskRow | undefined;
  if (active) throw new Error("此节点已有 SteamCMD 或游戏服务器任务正在执行，请完成后再提交新任务。");
  const id = randomUUID();
  const payload = { ...input.settings, ...(input.responseKind !== input.databaseKind ? { operation: input.responseKind } : {}), ...(input.server ? { server: input.server } : {}) };
  const messages: Record<SteamcmdTaskKind, string> = {
    install: "等待 daemon 安装 SteamCMD。", verify: "等待 daemon 校验 SteamCMD。",
    "install-server": "等待 daemon 安装 Steam 专用服务端。", "update-server": "等待 daemon 更新 Steam 专用服务端。",
    "start-server": "等待 daemon 启动游戏服务器。", "stop-server": "等待 daemon 停止游戏服务器。"
  };
  database.prepare(`
    INSERT INTO steamcmd_tasks (id, node_id, created_by, kind, status, progress, message, payload_json)
    VALUES (?, ?, ?, ?, 'queued', 0, ?, ?)
  `).run(id, input.nodeId, input.createdBy, input.databaseKind, messages[input.responseKind], JSON.stringify(payload));
  return getSteamcmdTask(id)!;
}

export function createSteamcmdTask(input: { nodeId: string; createdBy: string; kind: "install" | "verify" }): SteamcmdTask {
  const node = getDaemonNode(input.nodeId);
  if (!node || node.status !== "online" || node.platform !== "win32" || node.architecture !== "x64" || !node.capabilities.includes("node-filesystem-v1")) {
    throw new Error("所选 daemon 节点未连接或不支持 Windows x64 SteamCMD 任务。");
  }
  const settings = getSteamcmdNodeSettings(input.nodeId);
  if (input.kind === "install" && settings.installMode !== "online") throw new Error("当前选择了手动配置，请先切换到在线安装方式。");
  const active = database.prepare(`SELECT * FROM steamcmd_tasks WHERE node_id = ? AND status IN ('queued', 'running') ORDER BY created_at DESC LIMIT 1`)
    .get(input.nodeId) as SteamcmdTaskRow | undefined;
  if (active) {
    const current = toTask(active);
    if (current.kind === input.kind) return current;
    throw new Error("此节点已有 SteamCMD 或游戏服务器任务正在执行，请完成后再提交新任务。");
  }
  return insertSteamcmdTask({ nodeId: input.nodeId, createdBy: input.createdBy, databaseKind: input.kind, responseKind: input.kind, settings });
}

export function createSteamcmdServerTask(input: { serverId: string; nodeId: string; createdBy: string; kind: "install-server" | "update-server" | "start-server" | "stop-server" }): SteamcmdTask {
  const node = getDaemonNode(input.nodeId);
  if (!node || node.status !== "online" || node.platform !== "win32" || node.architecture !== "x64" || !node.capabilities.includes("node-filesystem-v1")) {
    throw new Error("所选 daemon 节点未连接或不支持 Windows x64 Steam 游戏服务任务。");
  }
  if (!node.capabilities.includes("steamcmd-ready-v1")) throw new Error("目标设备尚未安装并验证 SteamCMD，请先到游戏库的运行环境中安装。");
  const server = getSteamcmdServer(input.serverId);
  if (!server || server.nodeId !== input.nodeId) throw new Error("找不到此目标节点上的 Steam 游戏服务器。");
  const confirmedStopped = server.status === "stopped" || (server.status === "unknown" && server.installationStatus === "unknown" && server.processId === null);
  if ((input.kind === "install-server" || input.kind === "update-server") && !confirmedStopped) throw new Error("服务器运行状态尚未确认停止，不能安装或更新服务端。");
  if (!server.eulaAccepted) throw new Error("请先阅读并接受此专用服务端的许可和 EULA。");
  if ((input.kind === "start-server" || input.kind === "stop-server") && (!server.executablePath || !server.stopCommand)) {
    throw new Error("启动配置不完整；请填写服务端 .exe、启动参数和可用的控制台停服指令。");
  }
  if (input.kind === "start-server" && server.installationStatus !== "installed") throw new Error("请先成功安装此专用服务端。");
  if (input.kind === "start-server" && server.status !== "stopped") throw new Error("服务器当前状态未确认停止，不能重复启动。");
  if (input.kind === "stop-server" && server.status !== "running") throw new Error("服务器进程当前未由 Daemon 确认为运行状态。");
  const kind: "install" | "verify" = input.kind === "install-server" || input.kind === "update-server" ? "install" : "verify";
  const task = insertSteamcmdTask({ nodeId: input.nodeId, createdBy: input.createdBy, databaseKind: kind, responseKind: input.kind, settings: getSteamcmdNodeSettings(input.nodeId), server: {
    id: server.id, nodeId: server.nodeId, name: server.name, toolAppId: server.toolAppId, installDirectory: server.installDirectory,
    executablePath: server.executablePath, launchArguments: server.launchArguments, stopCommand: server.stopCommand, stopTimeoutSeconds: server.stopTimeoutSeconds, eulaAccepted: server.eulaAccepted
  } });
  if (input.kind === "install-server" || input.kind === "update-server") {
    database.prepare("UPDATE steamcmd_servers SET installation_status = 'installing', updated_at = ? WHERE id = ?").run(new Date().toISOString(), server.id);
  } else {
    database.prepare("UPDATE steamcmd_servers SET status = ?, updated_at = ? WHERE id = ?").run(input.kind === "start-server" ? "starting" : "stopping", new Date().toISOString(), server.id);
  }
  return task;
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
  const expiredRows = database.prepare(`
    SELECT * FROM steamcmd_tasks WHERE node_id = ? AND status = 'running' AND (lease_expires_at IS NULL OR lease_expires_at <= ?)
  `).all(nodeId, now) as unknown as SteamcmdTaskRow[];
  for (const row of expiredRows) {
    const task = toTask(row);
    const serverId = task.payload.server?.id;
    if (!serverId) continue;
    if (task.kind === "install-server" || task.kind === "update-server") {
      database.prepare("UPDATE steamcmd_servers SET installation_status = 'unknown', status = 'unknown', process_id = NULL, updated_at = ? WHERE id = ? AND node_id = ?")
        .run(now, serverId, nodeId);
    } else {
      database.prepare("UPDATE steamcmd_servers SET status = 'unknown', process_id = NULL, updated_at = ? WHERE id = ? AND node_id = ?")
        .run(now, serverId, nodeId);
    }
  }
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
  const taskRow = database.prepare("SELECT * FROM steamcmd_tasks WHERE id = ? AND node_id = ? AND status = 'running'").get(input.taskId, input.nodeId) as SteamcmdTaskRow | undefined;
  if (!taskRow) return false;
  const task = toTask(taskRow);
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
  if (Number(result.changes) !== 1) return false;
  const serverId = task.payload.server?.id;
  if (serverId) {
    const now = new Date().toISOString();
    if (task.kind === "install-server" || task.kind === "update-server") {
      database.prepare("UPDATE steamcmd_servers SET installation_status = ?, status = ?, process_id = NULL, updated_at = ? WHERE id = ? AND node_id = ?")
        .run(input.succeeded && input.result.installed === true ? "installed" : "failed", input.succeeded ? "stopped" : "unknown", now, serverId, input.nodeId);
    } else if (task.kind === "start-server") {
      const started = input.succeeded && input.result.processStarted === true && Number.isSafeInteger(input.result.processId);
      database.prepare("UPDATE steamcmd_servers SET status = ?, process_id = ?, updated_at = ? WHERE id = ? AND node_id = ?")
        .run(started ? "running" : "unknown", started ? Number(input.result.processId) : null, now, serverId, input.nodeId);
    } else if (task.kind === "stop-server") {
      const stopped = input.succeeded && input.result.stopped === true;
      const existing = getSteamcmdServer(serverId);
      database.prepare("UPDATE steamcmd_servers SET status = ?, process_id = ?, updated_at = ? WHERE id = ? AND node_id = ?")
        .run(stopped ? "stopped" : "unknown", stopped ? null : existing?.processId ?? null, now, serverId, input.nodeId);
    }
  }
  return true;
}
