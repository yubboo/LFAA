/**
 * 功能：维护本机 Windows Daemon 的登记、心跳与运行能力。
 * 作用：将节点平台、能力、数据根目录、Java 环境和最近在线时间保存到控制端数据库；短期整机资源采样只保存在有界内存中。
 * 关联文件：packages/storage/storage-sqlite/src/database.ts、packages/api/gateway/src/index.ts、packages/games/steamcmd/src/service.ts、packages/host/daemon/src/daemon.mjs。
 */
import { database } from "lfaa-storage-sqlite/src/database.js";

export interface JavaRuntimeSummary {
  runtimeId: string;
  distribution?: "temurin" | "zulu";
  version?: string;
  architecture?:string;
  os?:string;
  major: number;
  vendor: string;
  managed: boolean;
  source?: "managed" | "system" | "custom";
  executablePath?: string;
}

export interface DaemonHeartbeat {
  id: string;
  displayName: string;
  platform: string;
  architecture: string;
  version: string;
  dataRoot: string;
  capabilities: string[];
  javaRuntimes: JavaRuntimeSummary[];
  systemResources?: DaemonSystemResourceSnapshot;
}

export interface DaemonSystemResourceSnapshot {
  sampledAt: string;
  cpuUsagePercent: number | null;
  memoryUsedBytes: number | null;
  memoryTotalBytes: number | null;
  memoryUsagePercent: number | null;
  diskUsedBytes: number | null;
  diskTotalBytes: number | null;
  diskUsagePercent: number | null;
  networkReceiveBytesPerSecond: number | null;
  networkSendBytesPerSecond: number | null;
}

export interface DaemonSystemResourceTelemetry {
  status: "unsupported" | "waiting" | "ready" | "stale" | "offline";
  lastUpdatedAt: string | null;
  samples: DaemonSystemResourceSnapshot[];
}

export interface DaemonNode {
  id: string;
  displayName: string;
  platform: string;
  architecture: string;
  version: string;
  status: "online" | "offline";
  capabilities: string[];
  javaRuntimes: JavaRuntimeSummary[];
  lastSeenAt: string;
}

interface NodeRow {
  id: string;
  display_name: string;
  platform: string;
  architecture: string;
  daemon_version: string;
  status: "online" | "offline";
  capabilities_json: string;
  java_runtimes_json: string;
  last_seen_at: string;
}

const heartbeatLifetimeMs = 20_000;
const systemResourceSampleFreshnessMs = 30_000;
const maximumSystemResourceSamplesPerNode = 30;
const maximumSystemResourceNodes = 256;
const systemResourceCapability = "node-system-resource-telemetry-v1";
const systemResourceSamples = new Map<string, Array<{ sample: DaemonSystemResourceSnapshot; receivedAt: string }>>();

function recordSystemResourceSample(nodeId: string, sample: DaemonSystemResourceSnapshot): void {
  const history = systemResourceSamples.get(nodeId) ?? [];
  const last = history.at(-1);
  if (last && Date.parse(sample.sampledAt) <= Date.parse(last.sample.sampledAt)) return;
  if (!systemResourceSamples.has(nodeId) && systemResourceSamples.size >= maximumSystemResourceNodes) {
    const oldestNodeId = systemResourceSamples.keys().next().value;
    if (oldestNodeId) systemResourceSamples.delete(oldestNodeId);
  }
  history.push({ sample, receivedAt: new Date().toISOString() });
  if (history.length > maximumSystemResourceSamplesPerNode) history.splice(0, history.length - maximumSystemResourceSamplesPerNode);
  systemResourceSamples.delete(nodeId);
  systemResourceSamples.set(nodeId, history);
}

function parseJsonList<T>(value: string): T[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function toNode(row: NodeRow): DaemonNode {
  return {
    id: row.id,
    displayName: row.display_name,
    platform: row.platform,
    architecture: row.architecture,
    version: row.daemon_version,
    status: row.status === "online" && Date.parse(row.last_seen_at) >= Date.now() - heartbeatLifetimeMs ? "online" : "offline",
    capabilities: parseJsonList<string>(row.capabilities_json),
    javaRuntimes: parseJsonList<JavaRuntimeSummary>(row.java_runtimes_json),
    lastSeenAt: row.last_seen_at
  };
}

export function recordDaemonHeartbeat(heartbeat: DaemonHeartbeat): boolean {
  if (heartbeat.systemResources) recordSystemResourceSample(heartbeat.id, heartbeat.systemResources);
  const previous = database.prepare(`
    SELECT display_name, platform, architecture, daemon_version, data_root, status, capabilities_json, java_runtimes_json, last_seen_at
    FROM daemon_nodes WHERE id = ?
  `).get(heartbeat.id) as {
    display_name: string;
    platform: string;
    architecture: string;
    daemon_version: string;
    data_root: string;
    status: "online" | "offline";
    capabilities_json: string;
    java_runtimes_json: string;
    last_seen_at: string;
  } | undefined;
  const changed = !previous
    || previous.display_name !== heartbeat.displayName
    || previous.platform !== heartbeat.platform
    || previous.architecture !== heartbeat.architecture
    || previous.daemon_version !== heartbeat.version
    || previous.data_root !== heartbeat.dataRoot
    || previous.status !== "online"
    || Date.parse(previous.last_seen_at) < Date.now() - 20_000
    || previous.capabilities_json !== JSON.stringify(heartbeat.capabilities)
    || previous.java_runtimes_json !== JSON.stringify(heartbeat.javaRuntimes);
  const now = new Date().toISOString();
  database.prepare(`
    INSERT INTO daemon_nodes (id, display_name, platform, architecture, daemon_version, data_root, status, capabilities_json, java_runtimes_json, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?, 'online', ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      display_name = excluded.display_name,
      platform = excluded.platform,
      architecture = excluded.architecture,
      daemon_version = excluded.daemon_version,
      data_root = excluded.data_root,
      status = 'online',
      capabilities_json = excluded.capabilities_json,
      java_runtimes_json = excluded.java_runtimes_json,
      last_seen_at = excluded.last_seen_at,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  `).run(
    heartbeat.id,
    heartbeat.displayName,
    heartbeat.platform,
    heartbeat.architecture,
    heartbeat.version,
    heartbeat.dataRoot,
    JSON.stringify(heartbeat.capabilities),
    JSON.stringify(heartbeat.javaRuntimes),
    now
  );
  return changed;
}

/** 只供管理员的 SteamCMD 存储配置读取节点数据根目录，不加入通用节点响应。 */
export function getDaemonDataRoot(nodeId: string): string | null {
  const row = database.prepare("SELECT data_root FROM daemon_nodes WHERE id = ?").get(nodeId) as { data_root: string } | undefined;
  return row?.data_root || null;
}

export function listDaemonNodes(onStatusChanged?: () => void): DaemonNode[] {
  const staleBefore = new Date(Date.now() - heartbeatLifetimeMs).toISOString();
  const result = database.prepare("UPDATE daemon_nodes SET status = 'offline' WHERE status = 'online' AND last_seen_at < ?").run(staleBefore);
  if (Number(result.changes) > 0) onStatusChanged?.();
  const rows = database.prepare(`
    SELECT id, display_name, platform, architecture, daemon_version, status, capabilities_json, java_runtimes_json, last_seen_at
    FROM daemon_nodes ORDER BY status DESC, display_name COLLATE NOCASE
  `).all() as unknown as NodeRow[];
  return rows.map(toNode);
}

export function getDaemonNode(nodeId: string): DaemonNode | null {
  const row = database.prepare(`
    SELECT id, display_name, platform, architecture, daemon_version, status, capabilities_json, java_runtimes_json, last_seen_at
    FROM daemon_nodes WHERE id = ?
  `).get(nodeId) as NodeRow | undefined;
  return row ? toNode(row) : null;
}

export function getDaemonSystemResourceTelemetry(node: Pick<DaemonNode, "id" | "status" | "capabilities">): DaemonSystemResourceTelemetry {
  const history = systemResourceSamples.get(node.id) ?? [];
  const latest = history.at(-1) ?? null;
  const ageMs = latest ? Date.now() - Date.parse(latest.receivedAt) : Number.POSITIVE_INFINITY;
  const status: DaemonSystemResourceTelemetry["status"] = node.status === "offline"
    ? "offline"
    : latest
      ? ageMs > systemResourceSampleFreshnessMs ? "stale" : "ready"
      : node.capabilities.includes(systemResourceCapability) ? "waiting" : "unsupported";
  return {
    status,
    lastUpdatedAt: latest?.receivedAt ?? null,
    samples: history.map(({ sample }) => ({ ...sample }))
  };
}
