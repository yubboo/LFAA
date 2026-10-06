/**
 * 功能：校验和导入远程节点连接文件。
 * 作用：复用控制端签发的独立节点身份，只将密钥保存到执行器凭据目录。
 * 关联文件：daemon.mjs、apps/cli/bin/lfaa.mjs、MinecraftWorkspace.tsx。
 */
import { readFile, mkdir, lstat, writeFile, rename, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
export function validateDaemonConnection(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("节点连接文件格式无效。");
  const url = new URL(value.controlPlaneUrl);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !["/", "/api", "/api/"].includes(url.pathname)
    || typeof value.nodeId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value.nodeId)
    || typeof value.token !== "string" || !/^[A-Za-z0-9_-]{32,128}$/u.test(value.token)
    || typeof value.displayName !== "string" || !value.displayName.trim() || value.displayName.length > 80 || /[\u0000-\u001f\u007f]/u.test(value.displayName)) throw new Error("远程节点需要合法的 HTTPS 地址、节点身份和通信密钥。");
  return { controlPlaneUrl: `${url.origin}/api`, nodeId: value.nodeId, displayName: value.displayName.trim(), token: value.token };
}
export async function configureDaemonConnection(filePath, dataDirectory) {
  const content = await readFile(filePath, "utf8");
  let parsed;
  // JSON 解析错误可能包含原始片段；凭据文件不能把解析片段带到终端日志。
  try { parsed = JSON.parse(content); } catch { throw new Error("节点连接文件不是有效 JSON。"); }
  const value = validateDaemonConnection(parsed);
  const directory = resolve(dataDirectory, "credentials");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if ((await lstat(directory)).isSymbolicLink()) throw new Error("凭据目录不能是链接。");
  try { await lstat(resolve(directory, "daemon.lock")); throw new Error("请先停止当前节点，再导入连接配置。"); } catch (error) { if (error?.code !== "ENOENT") throw error; }
  // 原子替换单一连接文件；密钥与节点 ID 必须始终来自同一次签发。
  const temporary = resolve(directory, `.connection-${randomUUID()}.tmp`);
  try { await writeFile(temporary, JSON.stringify(value), { flag: "wx", mode: 0o600 }); await rename(temporary, resolve(directory, "daemon-connection.json")); }
  finally { await rm(temporary, { force: true }); }
  return { nodeId: value.nodeId, displayName: value.displayName };
}
