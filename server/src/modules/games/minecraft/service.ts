/**
 * 功能：实现 Minecraft Vanilla 实例目录、生命周期操作与受支持的服务器配置规则。
 * 作用：校验管理员操作、解析官方发行工件，并将主机副作用写入本机 Daemon 任务队列。
 * 关联文件：server/src/modules/games/minecraft/catalog.ts、server/src/modules/nodes/local-daemon.ts、server/src/modules/tasks/minecraft-queue.ts。
 */
import { randomUUID } from "node:crypto";
import { ApiError } from "../../../api/http-error.js";
import { database } from "../../../database.js";
import { getDaemonNode, listDaemonNodes, type DaemonNode } from "../../nodes/local-daemon.js";
import { createMinecraftTask, listMinecraftLogs, listMinecraftTasks, type MinecraftTask } from "../../tasks/minecraft-queue.js";
import { getMinecraftReleaseArtifact, listMinecraftReleases } from "./catalog.js";

const sandboxCapability = "app-sandbox-windows-appcontainer-v1";

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
  releaseId: string;
  javaMajor: number;
  memoryMb: number;
  state: "installing" | "stopped" | "starting" | "running" | "stopping" | "error" | "unknown";
  sandboxAvailable: boolean;
  sandboxStatus: "unsupported" | "unprepared" | "prepared" | "running" | "unknown";
  eulaAcceptedAt: string;
  serverProperties: MinecraftServerProperties;
  createdAt: string;
  updatedAt: string;
}

interface InstanceRow {
  id: string;
  node_id: string;
  node_name: string;
  node_status: "online" | "offline";
  name: string;
  release_id: string;
  java_major: number;
  memory_mb: number;
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
    i.name, i.release_id, i.java_major, i.memory_mb, i.state, i.eula_accepted_at,
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
    releaseId: row.release_id,
    javaMajor: row.java_major,
    memoryMb: row.memory_mb,
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

export async function getMinecraftOverview() {
  const [catalog, nodes] = await Promise.all([listMinecraftReleases(), Promise.resolve().then(listDaemonNodes)]);
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

export function getMinecraftInstance(instanceId: string): MinecraftInstance | null {
  const row = database.prepare(`${instanceSelect} WHERE i.id = ?`).get(instanceId) as InstanceRow | undefined;
  return row ? toInstance(row) : null;
}

export async function createMinecraftInstance(input: {
  nodeId: string;
  name: string;
  releaseId: string;
  memoryMb: number;
  eulaAccepted: boolean;
  userId: string;
}): Promise<{ instance: MinecraftInstance; task: MinecraftTask }> {
  const name = input.name.trim();
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._-]{0,47}$/u.test(name)) {
    throw new ApiError(400, "invalid_minecraft_instance_name", "实例名称须以字母或数字开头，且只能包含字母、数字、空格、点、下划线和连字符。");
  }
  if (!Number.isInteger(input.memoryMb) || input.memoryMb < 1024 || input.memoryMb > 32768) {
    throw new ApiError(400, "invalid_minecraft_memory", "实例内存须为 1024 至 32768 MB 的整数。");
  }
  if (input.eulaAccepted !== true) throw new ApiError(400, "minecraft_eula_required", "下载 Minecraft 服务端前必须先阅读并同意 EULA。");
  const node = requireOnlineWindowsNode(input.nodeId);
  if (!node.capabilities.includes(sandboxCapability)) {
    throw new ApiError(409, "minecraft_sandbox_unavailable", "节点未报告 Windows AppContainer Sandbox Host，暂不能创建 Minecraft 实例。");
  }
  const release = await getMinecraftReleaseArtifact(input.releaseId);
  const instanceId = randomUUID();
  const acceptedAt = new Date().toISOString();

  database.exec("BEGIN IMMEDIATE;");
  try {
    database.prepare(`
      INSERT INTO minecraft_instances (id, node_id, created_by, name, release_id, java_major, memory_mb, state, eula_accepted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'installing', ?)
    `).run(instanceId, node.id, input.userId, name, release.id, release.javaMajor, input.memoryMb, acceptedAt);
    const task = createMinecraftTask({
      nodeId: node.id,
      instanceId,
      createdBy: input.userId,
      kind: "install",
      message: "等待下载官方 Vanilla 服务端。",
      payload: {
        releaseId: release.id,
        serverUrl: release.serverUrl,
        serverSha1: release.serverSha1,
        serverSize: release.serverSize,
        javaMajor: release.javaMajor,
        memoryMb: input.memoryMb,
        eulaAccepted: true
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

function queueInstanceAction(instance: MinecraftInstance, userId: string, kind: "start" | "stop" | "backup", payload: Record<string, unknown> = {}): MinecraftTask {
  database.exec("BEGIN IMMEDIATE;");
  try {
    const current = requireInstance(instance.id);
    const node = requireInstanceNode(current);
    if (kind === "start") {
      if (!node.capabilities.includes(sandboxCapability)) {
        throw new ApiError(409, "minecraft_sandbox_unavailable", "节点未报告 Windows AppContainer Sandbox Host，已拒绝排入实例启动任务。");
      }
      if (current.state !== "stopped" && current.state !== "error") throw new ApiError(409, "minecraft_instance_not_stopped", "只有已停止的实例可以启动。");
      if (!current.eulaAcceptedAt) throw new ApiError(409, "minecraft_eula_required", "实例尚未记录 EULA 同意状态。");
    }
    if (kind === "stop" && current.state !== "running" && current.state !== "starting") {
      throw new ApiError(409, "minecraft_instance_not_running", "只有运行中的实例可以停止。");
    }
    if (kind === "backup" && current.state !== "stopped") {
      throw new ApiError(409, "minecraft_backup_requires_stopped", "为保证世界备份一致性，请先停止实例。");
    }
    const message = kind === "start" ? "等待启动 Minecraft 实例。"
      : kind === "stop" ? "等待安全停止 Minecraft 实例。"
        : "等待备份已停止实例的世界存档。";
    const task = createMinecraftTask({ nodeId: node.id, instanceId: current.id, createdBy: userId, kind, payload, message });
    const nextState = kind === "start" ? "starting" : kind === "stop" ? "stopping" : current.state;
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
  return queueInstanceAction(instance, userId, "start", { memoryMb: instance.memoryMb, javaMajor: instance.javaMajor });
}

export function stopMinecraftInstance(instanceId: string, userId: string): MinecraftTask {
  return queueInstanceAction(requireInstance(instanceId), userId, "stop");
}

export function backupMinecraftWorld(instanceId: string, userId: string): MinecraftTask {
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
  if (instance.state !== "stopped") throw new ApiError(409, "minecraft_properties_requires_stopped", "请先停止实例，再修改服务器配置。");
  const node = requireInstanceNode(instance);
  const properties = validateMinecraftServerProperties(input);
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
  if (node.javaRuntimes.some((runtime) => runtime.major === major && runtime.managed)) {
    throw new ApiError(409, "java_runtime_already_installed", "本机已登记此 Java 主版本的受管理运行环境。");
  }
  return createMinecraftTask({
    nodeId: node.id,
    instanceId: null,
    createdBy: userId,
    kind: "java-install",
    payload: { javaMajor: major },
    message: `等待下载并校验 Temurin Java ${major} JRE。`
  });
}

export function listMinecraftJavaRuntimes(): Array<{ nodeId: string; nodeName: string; nodeStatus: string; runtimes: DaemonNode["javaRuntimes"] }> {
  return listDaemonNodes().map((node) => ({ nodeId: node.id, nodeName: node.displayName, nodeStatus: node.status, runtimes: node.javaRuntimes }));
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
  state: "stopped" | "running" | "installing" | "unknown";
  sandboxStatus: MinecraftInstance["sandboxStatus"];
}>): void {
  const update = database.prepare("UPDATE minecraft_instances SET state = ?, sandbox_status = ?, updated_at = ? WHERE id = ? AND node_id = ?");
  const now = new Date().toISOString();
  for (const report of reports) update.run(report.state, report.sandboxStatus, now, report.id, nodeId);
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
