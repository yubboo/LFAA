/** 功能：登记和撤销独立远程节点身份。作用：身份表只保存密钥摘要；待交付连接文件放在受保护目录，仅供本机 CLI 导出，不发送给浏览器。关联文件：storage-sqlite/database.ts、api/remotes、api/minecraft-controller、apps/cli/bin/lfaa.mjs。 */
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { mkdirSync, lstatSync, writeFileSync, renameSync, rmSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "lfaa-launch-environment/src/config.js";
import { database } from "lfaa-storage-sqlite/src/database.js";
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
export function issueDaemonCredential(displayName: string, existingNodeId?: string, controlPlaneUrl?: string): { nodeId: string; token: string; displayName: string } {
  const name = displayName.trim();
  if (!name || name.length > 80 || /[\u0000-\u001f\u007f]/u.test(name)) throw new Error("节点名称无效。");
  const nodeId = existingNodeId ?? randomUUID(), token = randomBytes(48).toString("base64url");
  if (existingNodeId && !database.prepare("SELECT 1 FROM daemon_credentials WHERE node_id = ?").get(existingNodeId)) throw new Error("找不到可轮换的远程节点身份。");
  if (controlPlaneUrl) {
    const url = new URL(controlPlaneUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !["/", "/api", "/api/"].includes(url.pathname)) throw new Error("远程节点须使用合法的 HTTPS 控制端地址。");
    const directory = resolve(config.dataDirectory, "credentials", "node-connections");
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    if (lstatSync(directory).isSymbolicLink() || lstatSync(resolve(config.dataDirectory, "credentials")).isSymbolicLink()) throw new Error("节点凭据目录不能是链接。");
    const temporary = resolve(directory, `.connection-${randomUUID()}.tmp`);
    try {
      writeFileSync(temporary, JSON.stringify({ nodeId, token, displayName: name, controlPlaneUrl: `${url.origin}/api` }), { flag: "wx", mode: 0o600 });
      renameSync(temporary, resolve(directory, `${nodeId}.json`));
    } finally { rmSync(temporary, { force: true }); }
  }
  database.prepare("INSERT INTO daemon_credentials(node_id,token_hash,display_name,revoked) VALUES(?,?,?,0) ON CONFLICT(node_id) DO UPDATE SET token_hash=excluded.token_hash, display_name=excluded.display_name, revoked=0").run(nodeId, hash(token), name);
  return { nodeId, token, displayName: name };
}

/** 在控制端 OS 账户下导出受保护的连接文件；既不打印密钥，也不将其发给浏览器。 */
export function exportDaemonConnection(nodeId: string, destination: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(nodeId)) throw new Error("节点 ID 无效。");
  const source = resolve(config.dataDirectory, "credentials", "node-connections", `${nodeId}.json`);
  if (lstatSync(resolve(config.dataDirectory, "credentials")).isSymbolicLink() || lstatSync(resolve(config.dataDirectory, "credentials", "node-connections")).isSymbolicLink()) throw new Error("节点凭据目录不能是链接。");
  const info = lstatSync(source);
  if (info.isSymbolicLink() || !info.isFile() || info.nlink > 1) throw new Error("节点连接文件必须是受保护的普通文件。");
  const content = readFileSync(source);
  let parsed: { nodeId?: unknown; token?: unknown };
  try { parsed = JSON.parse(content.toString("utf8")) as typeof parsed; } catch { throw new Error("节点连接文件格式无效。"); }
  if (!parsed || parsed.nodeId !== nodeId || typeof parsed.token !== "string" || authenticateDaemonCredential(parsed.token)?.nodeId !== nodeId) throw new Error("连接文件身份已撤销、过期或不匹配，请重新生成。");
  writeFileSync(resolve(destination), content, { flag: "wx", mode: 0o600 });
  // 导出后仅保留摘要，重复导出须重新轮换生成，避免控制面长期多存一份密钥。
  rmSync(source);
}
export function authenticateDaemonCredential(token: string): { nodeId: string; displayName: string } | null {
  const row = database.prepare("SELECT node_id, display_name FROM daemon_credentials WHERE token_hash = ? AND revoked = 0").get(hash(token));
  return row ? { nodeId: String(row.node_id), displayName: String(row.display_name) } : null;
}
export function isRemoteDaemonIdentity(nodeId: string): boolean {
  return Boolean(database.prepare("SELECT 1 FROM daemon_credentials WHERE node_id = ?").get(nodeId));
}
export function listDaemonCredentials(): Array<{ nodeId: string; displayName: string; revoked: boolean }> {
  return database.prepare("SELECT node_id, display_name, revoked FROM daemon_credentials ORDER BY created_at DESC").all().map(row => ({ nodeId: String(row.node_id), displayName: String(row.display_name), revoked: row.revoked === 1 }));
}
export function revokeDaemonCredential(nodeId: string): boolean {
  const result = database.prepare("UPDATE daemon_credentials SET revoked=1 WHERE node_id=?").run(nodeId);
  if (result.changes) database.prepare("UPDATE daemon_nodes SET status='offline' WHERE id=?").run(nodeId);
  return Number(result.changes) > 0;
}
