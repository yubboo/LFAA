/**
 * 功能：维护本机 Minecraft Daemon 的登记、心跳与运行能力。
 * 作用：将本机节点实际汇报的平台、能力、Java 环境和最近在线时间保存到控制端数据库。
 * 关联文件：server/src/database.ts、server/src/api/routes.ts、daemon/src/index.mjs。
 */
import { database } from "../../database.js";

export interface JavaRuntimeSummary {
  runtimeId: string;
  major: number;
  vendor: string;
  managed: boolean;
}

export interface DaemonHeartbeat {
  id: string;
  displayName: string;
  platform: string;
  architecture: string;
  version: string;
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

export function recordDaemonHeartbeat(heartbeat: DaemonHeartbeat): void {
  const now = new Date().toISOString();
  database.prepare(`
    INSERT INTO daemon_nodes (id, display_name, platform, architecture, daemon_version, status, capabilities_json, java_runtimes_json, last_seen_at)
    VALUES (?, ?, ?, ?, ?, 'online', ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      display_name = excluded.display_name,
      platform = excluded.platform,
      architecture = excluded.architecture,
      daemon_version = excluded.daemon_version,
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
    JSON.stringify(heartbeat.capabilities),
    JSON.stringify(heartbeat.javaRuntimes),
    now
  );
}

export function listDaemonNodes(): DaemonNode[] {
  const staleBefore = new Date(Date.now() - 20_000).toISOString();
  database.prepare("UPDATE daemon_nodes SET status = 'offline' WHERE status = 'online' AND last_seen_at < ?").run(staleBefore);
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
