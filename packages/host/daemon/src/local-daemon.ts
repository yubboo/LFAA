/**
 * 功能：维护本机 Windows Daemon 的登记、心跳与运行能力。
 * 作用：将节点平台、能力、数据根目录、Java 环境和最近在线时间保存到控制端数据库。
 * 关联文件：packages/storage/storage-sqlite/src/database.ts、packages/api/gateway/src/index.ts、packages/games/steamcmd/src/service.ts、packages/host/daemon/src/daemon.mjs。
 */
import { database } from "lfaa-storage-sqlite/src/database.js";

export interface JavaRuntimeSummary {
  runtimeId: string;
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
    status: row.status,
    capabilities: parseJsonList<string>(row.capabilities_json),
    javaRuntimes: parseJsonList<JavaRuntimeSummary>(row.java_runtimes_json),
    lastSeenAt: row.last_seen_at
  };
}

export function recordDaemonHeartbeat(heartbeat: DaemonHeartbeat): boolean {
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
  const staleBefore = new Date(Date.now() - 20_000).toISOString();
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
