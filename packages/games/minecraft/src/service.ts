/**
 * 功能：实现 Minecraft Vanilla 实例目录、生命周期操作与受支持的服务器配置规则。
 * 作用：校验管理员操作、管理 Java 运行环境、解析官方发行工件，并将主机副作用写入本机 Daemon 任务队列。
 * 关联文件：packages/games/minecraft/src/catalog.ts、packages/host/daemon/src/local-daemon.ts、packages/jobs/jobs/src/minecraft-queue.ts。
 */
import { randomUUID } from "node:crypto";
import { protectedDataDirectories } from "lfaa-home-paths/src/reserved-data-paths.mjs";
import { win32 } from "node:path";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import { database } from "lfaa-storage-sqlite/src/database.js";
import { configuration } from "lfaa-storage-domain/src/configuration.js";
import { getDaemonDataRoot, getDaemonNode, listDaemonNodes, type DaemonNode } from "lfaa-host-daemon/src/local-daemon.js";
import { createMinecraftTask, listMinecraftLogs, listMinecraftTasks, type MinecraftTask } from "lfaa-jobs/src/minecraft-queue.js";
import { getMinecraftReleaseArtifact, listMinecraftReleases } from "./catalog.js";
import { getUserSettings } from "lfaa-settings/src/service.js";
import type { MinecraftCoreName } from "./core-sources.js";

const sandboxCapability = "app-sandbox-windows-appcontainer-v1";
const javaRuntimeSelectionCapability = "minecraft-java-runtime-selection-v1";
const defaultMinecraftStorageDirectory = "games/minecraft";

export interface MinecraftStorageSettings {
  instanceDirectory: string;
}

/** 只接受数据根目录内的普通相对目录，供节点配置和受限文件管理共用。 */
export function validateMinecraftStorageDirectory(value: string): string {
  if (typeof value !== "string" || value.length > 512 || value.includes("\\") || value.startsWith("/") || /^[a-z]:/iu.test(value)) {
    throw new Error("Minecraft 实例目录必须是 LFAA 数据根目录内的相对路径。");
  }
  const segments = value.split("/");
  if (segments.length < 1 || segments.length > 16 || segments.some((segment) =>
    segment.length === 0 || segment.length > 120 || segment === "." || segment === ".."
    || /[<>:"|?*\u0000-\u001f]/u.test(segment) || /[ .]$/u.test(segment)
    || /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/iu.test(segment)
  )) {
    throw new Error("Minecraft 实例目录包含无效名称；请使用数据根目录内的普通相对路径。");
  }
  if (protectedDataDirectories.includes(segments[0]!.toLocaleLowerCase())) {
    throw new Error("Minecraft 实例目录不能放在凭据、数据库、配置或会话目录中。");
  }
  return segments.join("/");
}

function validateMinecraftStorageSettings(input: MinecraftStorageSettings): MinecraftStorageSettings {
  return { instanceDirectory: validateMinecraftStorageDirectory(input.instanceDirectory) };
}

function readMinecraftStorageDefaults(): { instance_directory: string } | undefined {
  return configuration.get("minecraft_storage_settings_defaults", row => (row.id === 1)) as { instance_directory: string } | undefined;
}

export function getMinecraftStorageDefaults(): { settings: MinecraftStorageSettings; configured: boolean } {
  const row = readMinecraftStorageDefaults();
  return { configured: Boolean(row), settings: { instanceDirectory: row?.instance_directory ?? defaultMinecraftStorageDirectory } };
}

export function saveMinecraftStorageDefaults(input: MinecraftStorageSettings): MinecraftStorageSettings {
  const validated = validateMinecraftStorageSettings(input);
  configuration.save("minecraft_storage_settings_defaults", { id: 1, instance_directory: validated.instanceDirectory });
  return validated;
}

function hasMinecraftNodeStorageOverride(nodeId: string): boolean {
  return Boolean(configuration.get("minecraft_storage_node_settings", row => (row.node_id === nodeId)));
}

export function getMinecraftNodeStorageSettings(nodeId: string): MinecraftStorageSettings & { nodeId: string } {
  const row = configuration.get("minecraft_storage_node_settings", row => (row.node_id === nodeId)) as { instance_directory: string } | undefined;
  return { nodeId, instanceDirectory: row?.instance_directory ?? getMinecraftStorageDefaults().settings.instanceDirectory };
}

export function saveMinecraftNodeStorageSettings(nodeId: string, input: MinecraftStorageSettings): MinecraftStorageSettings & { nodeId: string } {
  if (!getDaemonNode(nodeId)) throw new Error("找不到目标 daemon 节点。");
  const validated = validateMinecraftStorageSettings(input);
  configuration.save("minecraft_storage_node_settings", { node_id: nodeId, instance_directory: validated.instanceDirectory });
  return { nodeId, ...validated };
}

/** 心跳同时携带当前默认目录和实例/部署已记录目录，Daemon 因此能继续找到未迁移的旧数据。 */
export function getMinecraftNodeStorageDirectories(nodeId: string): { instanceDirectory: string; knownDirectories: string[] } {
  const instanceDirectory = getMinecraftNodeStorageSettings(nodeId).instanceDirectory;
  const rows = database.prepare(`
    SELECT storage_directory FROM minecraft_instances WHERE node_id = ?
    UNION SELECT storage_directory FROM minecraft_deployments WHERE node_id = ?
  `).all(nodeId, nodeId) as Array<{ storage_directory: string }>;
  const knownDirectories = new Set([instanceDirectory]);
  for (const row of rows) {
    try { knownDirectories.add(validateMinecraftStorageDirectory(row.storage_directory)); }
    catch { knownDirectories.add(defaultMinecraftStorageDirectory); }
  }
  return { instanceDirectory, knownDirectories: [...knownDirectories] };
}

export function getMinecraftStorageSettingsOverview() {
  const defaults = getMinecraftStorageDefaults();
  const nodes = listDaemonNodes()
    .filter((node) => node.platform === "win32" && node.architecture === "x64")
    .map((node) => ({
      id: node.id,
      displayName: node.displayName,
      platform: node.platform,
      architecture: node.architecture,
      version: node.version,
      status: node.status,
      capabilities: node.capabilities,
      lastSeenAt: node.lastSeenAt,
      dataRoot: getDaemonDataRoot(node.id),
      settingsConfigured: hasMinecraftNodeStorageOverride(node.id),
      instanceDirectory: getMinecraftNodeStorageSettings(node.id).instanceDirectory
    }));
  return { defaults: defaults.settings, defaultsConfigured: defaults.configured, nodes };
}

export interface MinecraftServerProperties {
  motd?: string;
  difficulty?: "peaceful" | "easy" | "normal" | "hard";
  gamemode?: "survival" | "creative" | "adventure" | "spectator";
  maxPlayers?: number;
  serverPort?: number;
  onlineMode?: boolean;
  pvp?: boolean;
  whiteList?: boolean;
  viewDistance?: number;
  simulationDistance?: number;
  levelName?: string;
  levelSeed?: string;
}

export interface MinecraftInstance {
  id: string;
  nodeId: string;
  nodeName: string;
  nodeStatus: "online" | "offline";
  name: string;
  storageDirectory: string;
  releaseId: string;
  javaMajor: number;
  javaRuntimeId: string | null;
  memoryMb: number;
  coreType: MinecraftCoreName;
  coreBuild: string;
  executionMode: "native" | "appcontainer";
  state: "installing" | "stopped" | "starting" | "running" | "stopping" | "error" | "unknown";
  sandboxAvailable: boolean;
  sandboxStatus: "unsupported" | "unprepared" | "prepared" | "running" | "unknown";
  eulaAcceptedAt: string;
  serverProperties: MinecraftServerProperties;
  createdAt: string;
  updatedAt: string;
}

export interface MinecraftDeployment {
  id: string;
  nodeId: string;
  nodeName: string;
  nodeStatus: "online" | "offline";
  name: string;
  storageDirectory: string;
  serverType: string;
  coreBuild: string;
  automatic: boolean;
  releaseId: string;
  javaMajor: number;
  state: "queued" | "downloading" | "ready" | "failed" | "registering" | "registered";
  instanceId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface InstanceRow {
  id: string;
  node_id: string;
  node_name: string;
  node_status: "online" | "offline";
  name: string;
  storage_directory: string;
  release_id: string;
  java_major: number;
  java_runtime_id: string | null;
  memory_mb: number;
  core_type: MinecraftCoreName;
  core_build: string;
  execution_mode: MinecraftInstance["executionMode"];
  state: MinecraftInstance["state"];
  sandbox_status: MinecraftInstance["sandboxStatus"];
  node_capabilities_json: string;
  eula_accepted_at: string;
  server_properties_json: string;
  created_at: string;
  updated_at: string;
}

const instanceSelect = `
  SELECT i.id, i.node_id, n.display_name AS node_name, n.status AS node_status,
    i.name, i.storage_directory, i.release_id, i.java_major, i.java_runtime_id, i.memory_mb, i.core_type, i.core_build, i.execution_mode, i.state, i.eula_accepted_at,
    i.sandbox_status, n.capabilities_json AS node_capabilities_json,
    i.server_properties_json, i.created_at, i.updated_at
  FROM minecraft_instances i JOIN daemon_nodes n ON n.id = i.node_id
`;

function parseProperties(value: string): MinecraftServerProperties {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed as MinecraftServerProperties
      : {};
  } catch {
    return {};
  }
}

function toInstance(row: InstanceRow): MinecraftInstance {
  return {
    id: row.id,
    nodeId: row.node_id,
    nodeName: row.node_name,
    nodeStatus: row.node_status,
    name: row.name,
    storageDirectory: row.storage_directory,
    releaseId: row.release_id,
    javaMajor: row.java_major,
    javaRuntimeId: row.java_runtime_id,
    memoryMb: row.memory_mb,
    coreType: row.core_type,
    coreBuild: row.core_build,
    executionMode: row.execution_mode,
    state: row.node_status === "offline" && ["running", "starting", "stopping"].includes(row.state) ? "unknown" : row.state,
    sandboxAvailable: parseCapabilities(row.node_capabilities_json).includes(sandboxCapability),
    sandboxStatus: row.node_status === "offline" && row.sandbox_status === "running" ? "unknown" : row.sandbox_status,
    eulaAcceptedAt: row.eula_accepted_at,
    serverProperties: parseProperties(row.server_properties_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function parseCapabilities(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function requireOnlineWindowsNode(nodeId: string): DaemonNode {
  const node = getDaemonNode(nodeId);
  if (!node || node.status !== "online") throw new ApiError(409, "minecraft_node_offline", "本机 Daemon 未连接，Minecraft 操作暂时不可用。");
  if (node.platform !== "win32" || node.architecture !== "x64") {
    throw new ApiError(409, "minecraft_host_unsupported", "当前 Minecraft MVP 仅支持本机 Windows x64 Daemon。");
  }
  if (!node.capabilities.includes("minecraft-vanilla")) {
    throw new ApiError(409, "minecraft_runner_unavailable", "本机 Daemon 尚未报告 Minecraft Vanilla Runner 能力。");
  }
  return node;
}

function validateSelectedJavaRuntime(node: DaemonNode, javaMajor: number, runtimeId: string | null): string | null {
  if (runtimeId === null) return null;
  // 只允许选择该节点最近心跳确认、且具备实例运行时选择能力的匹配 Java。
  if (!node.capabilities.includes(javaRuntimeSelectionCapability)) {
    throw new ApiError(409, "java_runtime_selection_unsupported", "目标节点的 Daemon 尚不支持为实例指定 Java，请更新并重启 Daemon 后重试。");
  }
  const runtime = node.javaRuntimes.find((item) => item.runtimeId === runtimeId);
  if (!runtime) {
    // LFAA 托管版可在用户卸载后按需重装同主版本；外部 Java 路径失效时必须重新选择。
    if (runtimeId === `temurin-${javaMajor}`) return runtimeId;
    throw new ApiError(409, "java_runtime_not_found", "所选 Java 已不在目标节点的扫描结果中，请刷新后重新选择。");
  }
  if (runtime.major !== javaMajor) throw new ApiError(400, "java_runtime_major_mismatch", `所选 Java ${runtime.major} 与 Minecraft 版本要求的 Java ${javaMajor} 不匹配。`);
  return runtime.runtimeId;
}

export async function getMinecraftOverview(onNodeStatusChanged?: () => void) {
  const [catalog, nodes] = await Promise.all([listMinecraftReleases(), Promise.resolve().then(() => listDaemonNodes(onNodeStatusChanged))]);
  const instances = listMinecraftInstances();
  const tasks = listMinecraftTasks(20);
  return {
    latestRelease: catalog.latestRelease,
    node: nodes.find((item) => item.status === "online" && item.platform === "win32" && item.architecture === "x64" && item.capabilities.includes("minecraft-vanilla")) ?? null,
    instanceCount: instances.length,
    runningCount: instances.filter((item) => item.state === "running").length,
    activeTaskCount: tasks.filter((item) => item.status === "queued" || item.status === "running").length
  };
}

export function listMinecraftInstances(): MinecraftInstance[] {
  const rows = database.prepare(`${instanceSelect} ORDER BY i.updated_at DESC`).all() as unknown as InstanceRow[];
  return rows.map(toInstance);
}

/** 返回账户本人正在运行且节点在线的 Java TCP 实例，供独立联机 App 读取目标；不启动或改变实例。 */
export function listMinecraftConnectivityTargets(ownerId: string) {
  const rows = database.prepare(`
    SELECT i.id, i.name, i.node_id, n.display_name AS node_name, n.status AS node_status, i.server_properties_json
    FROM minecraft_instances i JOIN daemon_nodes n ON n.id = i.node_id
    WHERE i.created_by = ? AND i.state = 'running' AND n.status = 'online'
    ORDER BY i.updated_at DESC
    LIMIT 200
  `).all(ownerId) as Array<{ id: string; name: string; node_id: string; node_name: string; node_status: "online" | "offline"; server_properties_json: string }>;
  return rows.map((row) => {
    let port = 25565;
    try {
      const properties = JSON.parse(row.server_properties_json) as { serverPort?: unknown };
      if (Number.isInteger(properties.serverPort) && Number(properties.serverPort) >= 1 && Number(properties.serverPort) <= 65535) port = Number(properties.serverPort);
    } catch { /* 损坏属性回到 Minecraft Java 默认端口。 */ }
    return { id: row.id, applicationId: "minecraft" as const, name: row.name, nodeId: row.node_id, nodeName: row.node_name, nodeStatus: row.node_status, transport: "tcp" as const, localHost: "127.0.0.1" as const, localPort: port, state: "running" as const };
  });
}

export function getMinecraftConnectivityTarget(ownerId: string, instanceId: string) {
  return listMinecraftConnectivityTargets(ownerId).find((target) => target.id === instanceId) ?? null;
}

export function getMinecraftInstance(instanceId: string): MinecraftInstance | null {
  const row = database.prepare(`${instanceSelect} WHERE i.id = ?`).get(instanceId) as InstanceRow | undefined;
  return row ? toInstance(row) : null;
}

function validateMinecraftInstanceName(value: string): string {
  const name = value.trim().normalize("NFC");
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._-]{0,47}$/u.test(name)) {
    throw new ApiError(400, "invalid_minecraft_instance_name", "名称须以字母或数字开头，且只能包含字母、数字、空格、点、下划线和连字符。");
  }
  if (/[ .]$/u.test(name) || /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/iu.test(name)) {
    throw new ApiError(400, "invalid_minecraft_instance_name", "名称不能以空格或点结尾，也不能使用 Windows 设备保留名称。");
  }
  return name;
}

function toMinecraftDeployment(row: {
  id: string;
  node_id: string;
  node_name: string;
  node_status: "online" | "offline";
  name: string;
  storage_directory: string;
  server_type: string;
  core_build: string;
  automatic: number;
  release_id: string;
  java_major: number;
  state: MinecraftDeployment["state"];
  instance_id: string | null;
  created_at: string;
  updated_at: string;
}): MinecraftDeployment {
  return {
    id: row.id,
    nodeId: row.node_id,
    nodeName: row.node_name,
    nodeStatus: row.node_status,
    name: row.name,
    storageDirectory: row.storage_directory,
    serverType: row.server_type,
    coreBuild: row.core_build,
    automatic: row.automatic === 1,
    releaseId: row.release_id,
    javaMajor: row.java_major,
    state: row.state,
    instanceId: row.instance_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

const deploymentSelect = `
  SELECT d.id, d.node_id, n.display_name AS node_name, n.status AS node_status,
    d.name, d.storage_directory, d.server_type, d.core_build, d.automatic, d.release_id, d.java_major, d.state, d.instance_id,
    d.created_at, d.updated_at
  FROM minecraft_deployments d JOIN daemon_nodes n ON n.id = d.node_id
`;

export function listMinecraftDeployments(): MinecraftDeployment[] {
  const rows = database.prepare(`${deploymentSelect} ORDER BY d.updated_at DESC`).all() as Parameters<typeof toMinecraftDeployment>[0][];
  return rows.map(toMinecraftDeployment);
}

/** 已废弃：两步 Vanilla 下载兼容入口，替代为 deployment-service.provisionMinecraftServer。
 * 为既有下载/注册任务保留；旧调用方全部迁入多核心协议后删除此入口及 deploy/register 执行分支。 */
export async function createMinecraftDeployment(input: {
  nodeId: string;
  name: string;
  serverType: "vanilla";
  releaseId: string;
  userId: string;
}): Promise<{ deployment: MinecraftDeployment; task: MinecraftTask }> {
  const name = validateMinecraftInstanceName(input.name);
  if (input.serverType !== "vanilla") throw new ApiError(400, "minecraft_server_type_unsupported", "当前仅支持部署官方 Vanilla 服务端。");
  const node = requireOnlineWindowsNode(input.nodeId);
  const storageDirectory = getMinecraftNodeStorageSettings(node.id).instanceDirectory;
  const release = await getMinecraftReleaseArtifact(input.releaseId);
  const deploymentId = randomUUID();
  const now = new Date().toISOString();

  database.exec("BEGIN IMMEDIATE;");
  try {
    const existingNames = database.prepare(`
      SELECT name FROM minecraft_instances WHERE node_id = ?
      UNION ALL SELECT name FROM minecraft_deployments WHERE node_id = ?
    `).all(node.id, node.id) as Array<{ name: string }>;
    const nameKey = name.toLowerCase();
    if (existingNames.some((item) => item.name.normalize("NFC").toLowerCase() === nameKey)) {
      throw new ApiError(409, "minecraft_deployment_name_exists", "同一节点上已经有这个目录名称的部署或实例。");
    }
    database.prepare(`
      INSERT INTO minecraft_deployments (id, node_id, created_by, name, storage_directory, server_type, release_id, java_major, state, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?)
    `).run(deploymentId, node.id, input.userId, name, storageDirectory, input.serverType, release.id, release.javaMajor, now, now);
    const task = createMinecraftTask({
      nodeId: node.id,
      instanceId: null,
      deploymentId,
      createdBy: input.userId,
      kind: "install",
      message: "等待从 Mojang 官方源下载 Vanilla 服务端。",
      payload: {
        operation: "deploy",
        deploymentId,
        deploymentName: name,
        storageDirectory,
        serverType: input.serverType,
        releaseId: release.id,
        serverUrl: release.serverUrl,
        serverSha1: release.serverSha1,
        serverSize: release.serverSize,
        javaMajor: release.javaMajor,
        downloadTimeoutSeconds: getUserSettings(input.userId).minecraftRuntime.minecraftDownloadTimeoutSeconds
      }
    });
    const row = database.prepare(`${deploymentSelect} WHERE d.id = ?`).get(deploymentId) as Parameters<typeof toMinecraftDeployment>[0] | undefined;
    if (!row) throw new Error("新建 Minecraft 部署记录后无法读取。");
    database.exec("COMMIT;");
    return { deployment: toMinecraftDeployment(row), task };
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

export async function retryMinecraftDeployment(deploymentId: string, userId: string): Promise<MinecraftTask> {
  const row = database.prepare(`${deploymentSelect} WHERE d.id = ?`).get(deploymentId) as Parameters<typeof toMinecraftDeployment>[0] | undefined;
  if (!row) throw new ApiError(404, "minecraft_deployment_not_found", "找不到这个 Minecraft 部署记录。");
  if (row.state !== "failed") throw new ApiError(409, "minecraft_deployment_not_failed", "只有失败的部署可以重试。");
  if (row.automatic) return (await import("./deployment-service.js")).retryMinecraftProvision(deploymentId, userId);
  const node = requireOnlineWindowsNode(row.node_id);
  const release = await getMinecraftReleaseArtifact(row.release_id);
  database.exec("BEGIN IMMEDIATE;");
  try {
    const update = database.prepare("UPDATE minecraft_deployments SET state = 'queued', updated_at = ? WHERE id = ? AND state = 'failed'")
      .run(new Date().toISOString(), deploymentId);
    if (Number(update.changes) !== 1) throw new ApiError(409, "minecraft_deployment_not_failed", "只有失败的部署可以重试。");
    const task = createMinecraftTask({
      nodeId: node.id,
      instanceId: null,
      deploymentId,
      createdBy: userId,
      kind: "install",
      message: "等待重试下载官方 Vanilla 服务端。",
      payload: {
        operation: "deploy",
        deploymentId,
        deploymentName: row.name,
        storageDirectory: row.storage_directory,
        serverType: row.server_type,
        releaseId: release.id,
        serverUrl: release.serverUrl,
        serverSha1: release.serverSha1,
        serverSize: release.serverSize,
        javaMajor: release.javaMajor,
        downloadTimeoutSeconds: getUserSettings(userId).minecraftRuntime.minecraftDownloadTimeoutSeconds
      }
    });
    database.exec("COMMIT;");
    return task;
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

export async function registerMinecraftDeployment(input: {
  deploymentId: string;
  memoryMb: number;
  eulaAccepted: boolean;
  javaRuntimeId?: string | null;
  userId: string;
}): Promise<{ instance: MinecraftInstance; task: MinecraftTask }> {
  if (!Number.isInteger(input.memoryMb) || input.memoryMb < 1024 || input.memoryMb > 32768) {
    throw new ApiError(400, "invalid_minecraft_memory", "实例内存须为 1024 至 32768 MB 的整数。");
  }
  if (input.eulaAccepted !== true) throw new ApiError(400, "minecraft_eula_required", "创建实例前必须先阅读并同意 Minecraft EULA。");
  const row = database.prepare(`${deploymentSelect} WHERE d.id = ?`).get(input.deploymentId) as Parameters<typeof toMinecraftDeployment>[0] | undefined;
  if (!row) throw new ApiError(404, "minecraft_deployment_not_found", "找不到这个 Minecraft 部署记录。");
  if (row.state !== "ready") throw new ApiError(409, "minecraft_deployment_not_ready", "服务端下载完成后才能创建实例。");
  const node = requireOnlineWindowsNode(row.node_id);
  const executionMode = getUserSettings(input.userId).minecraftRuntime.minecraftExecutionMode;
  if (executionMode === "appcontainer" && !node.capabilities.includes(sandboxCapability)) {
    throw new ApiError(409, "minecraft_sandbox_unavailable", "节点尚未报告 Windows AppContainer Host，暂不能创建实例。");
  }
  if (executionMode === "native" && !node.capabilities.includes("minecraft-native-v1")) throw new ApiError(409, "minecraft_native_unavailable", "请更新目标 Daemon 以启用原生 Minecraft 执行能力。");
  const javaRuntimeId = validateSelectedJavaRuntime(node, row.java_major, input.javaRuntimeId ?? null);
  const acceptedAt = new Date().toISOString();

  database.exec("BEGIN IMMEDIATE;");
  try {
    const currentRow = database.prepare(`${deploymentSelect} WHERE d.id = ?`).get(input.deploymentId) as Parameters<typeof toMinecraftDeployment>[0] | undefined;
    if (!currentRow || currentRow.state !== "ready") {
      throw new ApiError(409, "minecraft_deployment_not_ready", "这个部署已在处理或已创建实例，请刷新状态后重试。");
    }
    const name = validateMinecraftInstanceName(currentRow.name);
    const instanceId = currentRow.instance_id ?? randomUUID();
    const existing = currentRow.instance_id ? getMinecraftInstance(currentRow.instance_id) : null;
    if (existing && existing.state !== "error" && existing.state !== "unknown") {
      throw new ApiError(409, "minecraft_deployment_registration_active", "这个部署已经关联实例，且当前没有可重试的失败注册任务。");
    }
    const existingNames = database.prepare("SELECT id, name FROM minecraft_instances WHERE node_id = ?").all(node.id) as Array<{ id: string; name: string }>;
    if (existingNames.some((item) => item.id !== instanceId && item.name.normalize("NFC").toLowerCase() === name.toLowerCase())) {
      throw new ApiError(409, "minecraft_instance_name_exists", "同一节点上已经有这个名称的 Minecraft 实例。");
    }
    if (existing) {
      database.prepare(`
        UPDATE minecraft_instances SET release_id = ?, java_major = ?, java_runtime_id = ?, memory_mb = ?, storage_directory = ?, state = 'installing',
          eula_accepted_at = ?, sandbox_status = 'unprepared', updated_at = ? WHERE id = ?
      `).run(currentRow.release_id, currentRow.java_major, javaRuntimeId, input.memoryMb, currentRow.storage_directory, acceptedAt, acceptedAt, instanceId);
    } else {
      database.prepare(`
        INSERT INTO minecraft_instances (id, node_id, created_by, name, storage_directory, release_id, java_major, java_runtime_id, memory_mb, state, eula_accepted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'installing', ?)
      `).run(instanceId, node.id, input.userId, name, currentRow.storage_directory, currentRow.release_id, currentRow.java_major, javaRuntimeId, input.memoryMb, acceptedAt);
    }
    const linked = database.prepare("UPDATE minecraft_deployments SET state = 'registering', instance_id = ?, updated_at = ? WHERE id = ? AND state = 'ready'")
      .run(instanceId, acceptedAt, input.deploymentId);
    if (Number(linked.changes) !== 1) throw new ApiError(409, "minecraft_deployment_not_ready", "这个部署已在处理或已创建实例，请刷新状态后重试。");
    const task = createMinecraftTask({
      nodeId: node.id,
      instanceId,
      deploymentId: input.deploymentId,
      createdBy: input.userId,
      kind: "install",
      message: "等待将已下载服务端注册为 Minecraft 实例。",
      payload: {
        operation: "register",
        deploymentId: input.deploymentId,
        instanceName: name,
        storageDirectory: currentRow.storage_directory,
        releaseId: currentRow.release_id,
        javaMajor: currentRow.java_major,
        javaRuntimeId,
        memoryMb: input.memoryMb,
        executionMode,
        eulaAccepted: true,
        downloadTimeoutSeconds: getUserSettings(input.userId).minecraftRuntime.minecraftDownloadTimeoutSeconds
      }
    });
    database.exec("COMMIT;");
    return { instance: getMinecraftInstance(instanceId)!, task };
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

function requireInstance(instanceId: string): MinecraftInstance {
  const instance = getMinecraftInstance(instanceId);
  if (!instance) throw new ApiError(404, "minecraft_instance_not_found", "找不到这个 Minecraft 实例。");
  return instance;
}

function requireInstanceNode(instance: MinecraftInstance): DaemonNode {
  const node = requireOnlineWindowsNode(instance.nodeId);
  if (instance.nodeStatus !== "online") throw new ApiError(409, "minecraft_node_offline", "实例所在节点未连接。");
  return node;
}

export function updateMinecraftInstanceJavaRuntime(instanceId: string, runtimeId: string | null): MinecraftInstance {
  listMinecraftTasks(1);
  const current = requireInstance(instanceId);
  if (current.coreType === "PocketMine") throw new ApiError(409, "minecraft_php_runtime", "PocketMine 使用 PHP，无需选择 Java。");
  if (database.prepare("SELECT 1 FROM minecraft_tasks WHERE instance_id = ? AND status IN ('queued', 'running') LIMIT 1").get(instanceId)) throw new ApiError(409, "minecraft_instance_busy", "实例已有未完成操作，暂不能更换 Java。");
  // Java 是实例级设置；运行中及状态未确认时不变更运行文件授权范围。
  if (current.state !== "stopped" && current.state !== "error") {
    throw new ApiError(409, "minecraft_instance_running", "只能为已停止的 Minecraft 实例更换 Java。");
  }
  const node = requireInstanceNode(current);
  if (current.executionMode === "appcontainer" && !node.capabilities.includes(sandboxCapability)) {
    throw new ApiError(409, "minecraft_sandbox_unavailable", "节点未报告 Windows AppContainer Sandbox Host，无法更换实例 Java。");
  }
  const javaRuntimeId = validateSelectedJavaRuntime(node, current.javaMajor, runtimeId);
  database.prepare("UPDATE minecraft_instances SET java_runtime_id = ?, sandbox_status = ?, updated_at = ? WHERE id = ?")
    .run(javaRuntimeId, current.executionMode === "native" ? "unsupported" : "unprepared", new Date().toISOString(), instanceId);
  return getMinecraftInstance(instanceId)!;
}

function queueInstanceAction(instance: MinecraftInstance, userId: string, kind: "start" | "stop" | "backup" | "restart" | "console", payload: Record<string, unknown> = {}): MinecraftTask {
  // 先收敛已过期租约，再进入领域事务；不会重放任何副作用。
  listMinecraftTasks(1);
  database.exec("BEGIN IMMEDIATE;");
  try {
    const current = requireInstance(instance.id);
    const node = requireInstanceNode(current);
    const settings = getUserSettings(userId).minecraftRuntime;
    const executionMode = kind === "start" || kind === "restart" ? settings.minecraftExecutionMode : current.executionMode;
    // 手动和模型入口共享实例互斥；不能在备份/配置排队后再启动同一实例。
    if (database.prepare("SELECT 1 FROM minecraft_tasks WHERE instance_id = ? AND status IN ('queued', 'running') LIMIT 1").get(current.id)) {
      throw new ApiError(409, "minecraft_instance_busy", "实例已有未完成的操作，请等待并核对任务结果。");
    }
    if (kind === "start" || kind === "restart") {
      if (executionMode === "appcontainer" && (current.coreType !== "Vanilla" || !node.capabilities.includes(sandboxCapability))) {
        throw new ApiError(409, "minecraft_sandbox_unavailable", "节点未报告 Windows AppContainer Sandbox Host，已拒绝排入实例启动任务。");
      }
      if (kind === "start" && current.state !== "stopped" && current.state !== "error") throw new ApiError(409, "minecraft_instance_not_stopped", "只有已停止的实例可以启动。");
      if (kind === "restart" && current.state !== "running") throw new ApiError(409, "minecraft_instance_not_running", "只有已就绪的实例可以重启。");
      if (!current.eulaAcceptedAt) throw new ApiError(409, "minecraft_eula_required", "实例尚未记录 EULA 同意状态。");
      const selectedRuntime = current.javaRuntimeId ? node.javaRuntimes.find((runtime) => runtime.runtimeId === current.javaRuntimeId) : null;
      const usesManagedJava = selectedRuntime?.managed || current.javaRuntimeId === `temurin-${current.javaMajor}`;
      if ((!current.javaRuntimeId || usesManagedJava) && hasPendingJavaEnvironmentTask(node.id, "uninstall", current.javaMajor)) {
        throw new ApiError(409, "java_runtime_uninstall_pending", `Java ${current.javaMajor} 正在排队卸载，请先等待任务完成或失败。`);
      }
      if (current.javaRuntimeId) validateSelectedJavaRuntime(node, current.javaMajor, current.javaRuntimeId);
    }
    if (kind === "stop" && current.state !== "running" && current.state !== "starting") {
      throw new ApiError(409, "minecraft_instance_not_running", "只有运行中的实例可以停止。");
    }
    if (kind === "backup" && current.state !== "stopped") {
      throw new ApiError(409, "minecraft_backup_requires_stopped", "为保证世界备份一致性，请先停止实例。");
    }
    if (kind === "console" && current.state !== "running") throw new ApiError(409, "minecraft_console_unavailable", "只能向已就绪的实例发送控制台命令。");
    const message = kind === "start" ? "等待启动 Minecraft 实例。"
      : kind === "stop" ? "等待安全停止 Minecraft 实例。"
        : "等待备份已停止实例的世界存档。";
    if ((kind === "start" || kind === "restart") && executionMode === "native" && !node.capabilities.includes("minecraft-native-v1")) throw new ApiError(409, "minecraft_native_unavailable", "请更新并重启目标 Daemon，当前节点尚未报告原生 Minecraft 执行能力。");
    const task = createMinecraftTask({ nodeId: node.id, instanceId: current.id, createdBy: userId, kind, payload: { ...payload, executionMode, serverPort: current.serverProperties.serverPort ?? settings.minecraftDefaultPort, instanceName: current.name, readyTimeoutSeconds: settings.minecraftReadyTimeoutSeconds, downloadTimeoutSeconds: settings.minecraftDownloadTimeoutSeconds, stopTimeoutSeconds: settings.minecraftStopTimeoutSeconds }, message: kind === "console" ? "等待向实例发送控制台命令。" : kind === "restart" ? "等待安全停止并重新启动实例。" : message });
    const nextState = kind === "start" || kind === "restart" ? "starting" : kind === "stop" ? "stopping" : current.state;
    if (nextState !== current.state) {
      const result = database.prepare("UPDATE minecraft_instances SET state = ?, updated_at = ? WHERE id = ? AND state = ?")
        .run(nextState, new Date().toISOString(), current.id, current.state);
      if (Number(result.changes) !== 1) throw new ApiError(409, "minecraft_instance_state_changed", "实例状态已变化，请刷新后重试。");
    }
    database.exec("COMMIT;");
    return task;
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

export function startMinecraftInstance(instanceId: string, userId: string): MinecraftTask {
  const instance = requireInstance(instanceId);
  return queueInstanceAction(instance, userId, "start", { memoryMb: instance.memoryMb, javaMajor: instance.javaMajor, javaRuntimeId: instance.javaRuntimeId });
}

export function stopMinecraftInstance(instanceId: string, userId: string): MinecraftTask {
  return queueInstanceAction(requireInstance(instanceId), userId, "stop");
}

export function restartMinecraftInstance(instanceId: string, userId: string): MinecraftTask {
  const instance = requireInstance(instanceId);
  return queueInstanceAction(instance, userId, "restart", { memoryMb: instance.memoryMb, javaMajor: instance.javaMajor, javaRuntimeId: instance.javaRuntimeId });
}

/** 单行服务器指令不是系统 Shell；生命周期命令必须走对应接口，避免状态失去同步。 */
export function sendMinecraftConsoleCommand(instanceId: string, userId: string, command: string): MinecraftTask {
  const value = command.trim();
  if (!value || value.length > 1024 || /[\u0000-\u001f\u007f]/u.test(value) || /^(?:stop|restart)\b/iu.test(value)) {
    throw new ApiError(400, "invalid_minecraft_console_command", "请输入单行服务器命令；停服/重启请使用对应操作。");
  }
  return queueInstanceAction(requireInstance(instanceId), userId, "console", { command: value });
}

export function backupMinecraftWorld(instanceId: string, userId: string): MinecraftTask {
  const instance = requireInstance(instanceId);
  if (["BungeeCord", "Velocity"].includes(instance.coreType)) throw new ApiError(409, "minecraft_proxy_has_no_world", "代理没有世界存档，请在后端实例备份世界。");
  return queueInstanceAction(requireInstance(instanceId), userId, "backup");
}

export function validateMinecraftServerProperties(input: unknown): MinecraftServerProperties {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new ApiError(400, "invalid_minecraft_properties", "服务器配置必须是字段对象。");
  }
  const value = input as Record<string, unknown>;
  const allowed = new Set(["motd", "difficulty", "gamemode", "maxPlayers", "serverPort", "onlineMode", "pvp", "whiteList", "viewDistance", "simulationDistance", "levelName", "levelSeed"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new ApiError(400, "invalid_minecraft_properties", "提交了暂不支持修改的服务器配置字段。");
  const result: MinecraftServerProperties = {};
  const setString = (key: "motd" | "levelName" | "levelSeed", max: number) => {
    const item = value[key];
    if (item === undefined) return;
    if (typeof item !== "string" || item.length > max || /[\r\n\u0000]/u.test(item)) throw new ApiError(400, "invalid_minecraft_properties", `配置字段 ${key} 的格式不正确。`);
    if (key === "levelName" && (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(item) || item.includes(".."))) {
      throw new ApiError(400, "invalid_minecraft_properties", "世界名称只能包含字母、数字、点、下划线和连字符，且不能含有路径片段。");
    }
    result[key] = item;
  };
  setString("motd", 120);
  setString("levelName", 64);
  setString("levelSeed", 80);
  if (value.difficulty !== undefined) {
    if (!["peaceful", "easy", "normal", "hard"].includes(String(value.difficulty))) throw new ApiError(400, "invalid_minecraft_properties", "游戏难度不受支持。");
    result.difficulty = value.difficulty as NonNullable<MinecraftServerProperties["difficulty"]>;
  }
  if (value.gamemode !== undefined) {
    if (!["survival", "creative", "adventure", "spectator"].includes(String(value.gamemode))) throw new ApiError(400, "invalid_minecraft_properties", "游戏模式不受支持。");
    result.gamemode = value.gamemode as NonNullable<MinecraftServerProperties["gamemode"]>;
  }
  for (const [key, minimum, maximum] of [["maxPlayers", 1, 200], ["serverPort", 1024, 65535], ["viewDistance", 2, 32], ["simulationDistance", 2, 32]] as const) {
    const item = value[key];
    if (item === undefined) continue;
    if (typeof item !== "number" || !Number.isInteger(item) || item < minimum || item > maximum) throw new ApiError(400, "invalid_minecraft_properties", `配置字段 ${key} 超出允许范围。`);
    result[key] = item;
  }
  for (const key of ["onlineMode", "pvp", "whiteList"] as const) {
    const item = value[key];
    if (item === undefined) continue;
    if (typeof item !== "boolean") throw new ApiError(400, "invalid_minecraft_properties", `配置字段 ${key} 必须为布尔值。`);
    result[key] = item;
  }
  return result;
}

export function updateMinecraftServerProperties(instanceId: string, userId: string, input: unknown): MinecraftTask {
  const instance = requireInstance(instanceId);
  if (["BungeeCord", "Velocity", "Nukkit", "PocketMine"].includes(instance.coreType)) throw new ApiError(409, "minecraft_core_properties_unsupported", "此核心使用独立配置格式，请通过节点文件管理修改真实配置。");
  if (instance.state !== "stopped") throw new ApiError(409, "minecraft_properties_requires_stopped", "请先停止实例，再修改服务器配置。");
  const node = requireInstanceNode(instance);
  if (database.prepare("SELECT 1 FROM minecraft_tasks WHERE instance_id = ? AND status IN ('queued', 'running') LIMIT 1").get(instanceId)) throw new ApiError(409, "minecraft_instance_busy", "实例已有未完成操作，请等待后再修改配置。");
  const properties = { ...instance.serverProperties, ...validateMinecraftServerProperties(input) };
  return createMinecraftTask({
    nodeId: node.id,
    instanceId,
    createdBy: userId,
    kind: "properties",
    payload: { properties },
    message: "等待写入允许修改的 server.properties 字段。"
  });
}

export function installMinecraftJava(nodeId: string, userId: string, major: number): MinecraftTask {
  const node = requireOnlineWindowsNode(nodeId);
  if (!Number.isInteger(major) || major < 8 || major > 40) throw new ApiError(400, "invalid_java_version", "Java 主版本号不受支持。");
  if (hasPendingJavaEnvironmentTask(node.id, "install", major)) throw new ApiError(409, "java_install_pending", `Java ${major} 的安装任务已经排队或正在执行。`);
  if (hasPendingJavaEnvironmentTask(node.id, "uninstall", major)) throw new ApiError(409, "java_uninstall_pending", `Java ${major} 的卸载任务尚未完成。`);
  if (node.javaRuntimes.some((runtime) => runtime.major === major && runtime.managed)) {
    throw new ApiError(409, "java_runtime_already_installed", "本机已登记此 Java 主版本的受管理运行环境。");
  }
  return createMinecraftTask({
    nodeId: node.id,
    instanceId: null,
    createdBy: userId,
    kind: "java-install",
    payload: { javaMajor: major, downloadTimeoutSeconds: getUserSettings(userId).minecraftRuntime.minecraftDownloadTimeoutSeconds },
    message: `等待下载并校验 Temurin Java ${major} 官方 JRE/JDK 压缩包。`
  });
}

export function uninstallMinecraftJava(nodeId: string, userId: string, major: number): MinecraftTask {
  const node = requireJavaManagementNode(nodeId);
  if (!Number.isInteger(major) || major < 8 || major > 40) throw new ApiError(400, "invalid_java_version", "Java 主版本号不受支持。");
  if (hasPendingJavaEnvironmentTask(node.id, "uninstall", major)) throw new ApiError(409, "java_uninstall_pending", `Java ${major} 的卸载任务已经排队或正在执行。`);
  if (!node.javaRuntimes.some((runtime) => runtime.major === major && runtime.managed)) {
    throw new ApiError(404, "java_runtime_not_managed", "找不到 LFAA 管理的此 Java 版本，无法卸载电脑上的外部 Java。");
  }
  // 保留运行中或结果未确认实例依赖的 Java；停止状态的实例可在重装相同主版本后继续使用。
  const activeInstance = database.prepare(`
    SELECT name FROM minecraft_instances
    WHERE node_id = ? AND java_major = ? AND (java_runtime_id IS NULL OR java_runtime_id = 'temurin-' || java_major)
      AND state IN ('installing', 'starting', 'running', 'stopping', 'unknown')
    LIMIT 1
  `).get(nodeId, major) as { name: string } | undefined;
  if (activeInstance) throw new ApiError(409, "java_runtime_in_use", `Minecraft 实例“${activeInstance.name}”正在使用 LFAA 托管 Java ${major} 或状态未确认，暂不能卸载。`);
  return createMinecraftTask({
    nodeId: node.id,
    instanceId: null,
    createdBy: userId,
    kind: "java-install",
    payload: { operation: "uninstall", javaMajor: major },
    message: `等待卸载 LFAA 管理的 Temurin Java ${major} JRE。`
  });
}

export function registerMinecraftJavaPath(nodeId: string, userId: string, executablePath: string, runtimeId?: string): MinecraftTask {
  const node = requireJavaManagementNode(nodeId);
  // Java 路径属于节点本地设置，只接受 Windows java.exe 绝对路径并由 Daemon 实际核验。
  const path = executablePath.trim();
  if (path.length > 2048 || /[\r\n\u0000]/u.test(path) || !win32.isAbsolute(path) || win32.basename(path).toLocaleLowerCase() !== "java.exe") {
    throw new ApiError(400, "invalid_java_path", "请输入 Windows 上 java.exe 的完整绝对路径。");
  }
  if (runtimeId && !node.javaRuntimes.some((runtime) => runtime.runtimeId === runtimeId && runtime.source === "custom" && !runtime.managed)) {
    throw new ApiError(404, "custom_java_path_not_found", "找不到可修改的手动登记 Java 路径；请刷新运行环境列表后重试。");
  }
  const normalizedPath = win32.normalize(path).toLocaleLowerCase();
  if (hasPendingJavaEnvironmentTask(node.id, "register-path", (payload) => {
    const pendingPath = typeof payload.executablePath === "string" ? win32.normalize(payload.executablePath).toLocaleLowerCase() : "";
    return runtimeId ? payload.runtimeId === runtimeId : pendingPath === normalizedPath;
  })) {
    throw new ApiError(409, "java_path_update_pending", "此 Java 路径已有管理任务排队或正在执行。");
  }
  return createMinecraftTask({
    nodeId: node.id,
    instanceId: null,
    createdBy: userId,
    kind: "java-install",
    payload: { operation: "register-path", executablePath: path, ...(runtimeId ? { runtimeId } : {}) },
    message: runtimeId ? "等待识别并更新手动登记的 Java 路径。" : "等待识别并登记 Java 路径。"
  });
}

export function forgetMinecraftJavaPath(nodeId: string, userId: string, runtimeId: string): MinecraftTask {
  const node = requireJavaManagementNode(nodeId);
  if (!node.javaRuntimes.some((runtime) => runtime.runtimeId === runtimeId && runtime.source === "custom" && !runtime.managed)) {
    throw new ApiError(404, "custom_java_path_not_found", "找不到可移除的手动 Java 路径；请刷新运行环境列表后重试。");
  }
  if (hasPendingJavaEnvironmentTask(node.id, "forget-path", (payload) => payload.runtimeId === runtimeId)) {
    throw new ApiError(409, "java_path_removal_pending", "此 Java 路径的移除任务已经排队或正在执行。");
  }
  return createMinecraftTask({
    nodeId: node.id,
    instanceId: null,
    createdBy: userId,
    kind: "java-install",
    payload: { operation: "forget-path", runtimeId },
    message: "等待移除手动登记的 Java 路径记录。"
  });
}

export function listMinecraftJavaRuntimes(onNodeStatusChanged?: () => void): Array<{ nodeId: string; nodeName: string; nodeStatus: string; runtimes: DaemonNode["javaRuntimes"] }> {
  return listDaemonNodes(onNodeStatusChanged).map((node) => ({ nodeId: node.id, nodeName: node.displayName, nodeStatus: node.status, runtimes: node.javaRuntimes }));
}

function requireJavaManagementNode(nodeId: string): DaemonNode {
  const node = requireOnlineWindowsNode(nodeId);
  if (!node.capabilities.includes("java-environment-manager-v1")) {
    throw new ApiError(409, "java_manager_daemon_update_required", "此节点的 Daemon 尚未启用 Java 环境管理，请重启本机 Daemon 后重试。");
  }
  return node;
}

function hasPendingJavaEnvironmentTask(
  nodeId: string,
  operation: string,
  matches: ((payload: Record<string, unknown>) => boolean) | number
): boolean {
  const rows = database.prepare(`
    SELECT payload_json FROM minecraft_tasks
    WHERE node_id = ? AND kind = 'java-install' AND status IN ('queued', 'running')
  `).all(nodeId) as Array<{ payload_json: string }>;
  return rows.some((row) => {
    let payload: Record<string, unknown>;
    try { payload = JSON.parse(row.payload_json) as Record<string, unknown>; }
    catch { return false; }
    const taskOperation = typeof payload.operation === "string" ? payload.operation : "install";
    if (taskOperation !== operation) return false;
    return typeof matches === "number" ? Number(payload.javaMajor) === matches : matches(payload);
  });
}

export function listMinecraftTaskRecords(): MinecraftTask[] {
  return listMinecraftTasks(200);
}

export function getMinecraftInstanceLogs(instanceId: string) {
  if (!getMinecraftInstance(instanceId)) throw new ApiError(404, "minecraft_instance_not_found", "找不到这个 Minecraft 实例。");
  return listMinecraftLogs(instanceId, 500);
}

export function getMinecraftReleases() {
  return listMinecraftReleases();
}

export async function getMinecraftRelease(releaseId: string) {
  return getMinecraftReleaseArtifact(releaseId);
}

export function updateInstanceStatesFromDaemon(nodeId: string, reports: Array<{
  id: string;
  state: "stopped" | "running" | "starting" | "installing" | "unknown";
  sandboxStatus: MinecraftInstance["sandboxStatus"];
}>): string[] {
  // 换 Java 后保留待准备状态，直到下一次启动或成功停止任务确认新运行目录的 ACL。
  const update = database.prepare("UPDATE minecraft_instances SET state = ?, sandbox_status = ?, updated_at = ? WHERE id = ? AND node_id = ? AND NOT EXISTS (SELECT 1 FROM minecraft_tasks WHERE instance_id = minecraft_instances.id AND status IN ('queued', 'running') AND kind IN ('start', 'stop', 'restart', 'install')) AND NOT (state = 'error' AND ? = 'stopped') AND NOT (sandbox_status = 'unprepared' AND ? = 'stopped' AND ? = 'prepared') AND (state IS NOT ? OR sandbox_status IS NOT ?)");
  const now = new Date().toISOString();
  const changed: string[] = [];
  for (const report of reports) {
    const result = update.run(report.state, report.sandboxStatus, now, report.id, nodeId, report.state, report.state, report.sandboxStatus, report.state, report.sandboxStatus);
    if (Number(result.changes) > 0) changed.push(report.id);
  }
  return changed;
}

export function markInstanceError(instanceId: string, nodeId: string, message: string): void {
  database.prepare("UPDATE minecraft_instances SET state = 'error', updated_at = ? WHERE id = ? AND node_id = ?")
    .run(new Date().toISOString(), instanceId, nodeId);
  const existing = getMinecraftInstance(instanceId);
  if (existing) {
    const log = database.prepare("INSERT INTO minecraft_task_logs (instance_id, stream, line) VALUES (?, 'system', ?)");
    log.run(instanceId, `Daemon: ${message.slice(0, 300)}`);
  }
}
