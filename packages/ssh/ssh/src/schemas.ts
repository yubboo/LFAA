/**
 * 文件：schemas.ts
 * 功能：手写的 SSH 连接配置校验（替代 zod）。
 * 作用：在建立会话前校验主机、端口、用户、私钥路径、超时等字段，归一化默认值；
 *       任何非法字段直接抛出带中文说明的错误，避免把脏配置传给 ssh.exe。
 * 边界：只校验“形状与范围”，不连通远端、不读取私钥内容。
 * 关联文件：packages/ssh/ssh/src/session.ts、index.ts。
 */
import type { SshConnectionConfig } from "./session.js";

/** 归一化后的连接配置（所有可选字段均有默认值）。 */
export interface NormalizedSshConfig {
  readonly host: string;
  readonly user?: string;
  readonly port: number;
  readonly identityFile?: string;
  readonly knownHostsFile?: string;
  readonly strictHostKeyChecking: "yes" | "no" | "accept-new";
  readonly connectTimeoutMs: number;
  readonly sshPath: string;
  readonly remoteCwd?: string;
}

/** 校验并归一化连接配置。 */
export function validateSshConfig(raw: SshConnectionConfig): NormalizedSshConfig {
  if (typeof raw.host !== "string" || raw.host.trim().length === 0) {
    throw new Error("SSH 配置缺少主机名。");
  }
  const host = raw.host.trim();
  if (host.length > 255) throw new Error("SSH 主机名过长。");
  let port = 22;
  if (raw.port !== undefined) {
    if (!Number.isInteger(raw.port) || raw.port < 1 || raw.port > 65535) {
      throw new Error(`SSH 端口越界（1-65535）：${String(raw.port)}`);
    }
    port = raw.port;
  }
  if (raw.connectTimeoutMs !== undefined && (!Number.isFinite(raw.connectTimeoutMs) || raw.connectTimeoutMs < 1000)) {
    throw new Error("连接超时至少 1000 毫秒。");
  }
  if (raw.identityFile !== undefined) {
    if (typeof raw.identityFile !== "string" || raw.identityFile.length === 0 || raw.identityFile.length > 1024) {
      throw new Error("私钥路径无效（只引用路径，不读取内容）。");
    }
    // 权限边界：拒绝把疑似 PEM 私钥正文当成路径传入。
    if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/u.test(raw.identityFile)) {
      throw new Error("identityFile 看似私钥正文；应传私钥文件路径，不能直接粘贴私钥。");
    }
  }
  const strict = raw.strictHostKeyChecking ?? "accept-new";
  return {
    host,
    ...(raw.sshPath === undefined ? {} : { sshPath: raw.sshPath }),
    port,
    ...(raw.identityFile === undefined ? {} : { identityFile: raw.identityFile }),
    ...(raw.knownHostsFile === undefined ? {} : { knownHostsFile: raw.knownHostsFile }),
    strictHostKeyChecking: strict,
    connectTimeoutMs: raw.connectTimeoutMs ?? 15_000,
    sshPath: raw.sshPath ?? "ssh",
    ...(raw.remoteCwd === undefined ? {} : { remoteCwd: raw.remoteCwd })
  };
}
