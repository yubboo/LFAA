/**
 * 文件：index.ts
 * 功能：SSH 会话协议的 Cordis 装配入口。
 * 作用：以 lfaaSsh 名称暴露“按配置打开一个 SshSession”的工厂；并提供把 LFAA 凭据记录
 *       映射为连接配置的纯函数，统一权限边界注释。
 * 关联文件：packages/ssh/ssh/src/session.ts、packages/credentials/credentials/src/index.ts。
 */
import type { Context } from "@deepseek-ai/cordis";
import { SshSession, type SshConnectionConfig } from "./session.js";

export const name = "lfaaSsh";

declare module "@deepseek-ai/cordis" {
  interface Context {
    /** 按配置打开一个系统 OpenSSH 会话。 */
    lfaaSsh: LfaaSshService;
  }
}

/** 凭据记录里允许携带的 SSH 元数据（grant payload）。 */
export interface SshCredentialPayload {
  readonly host: string;
  readonly port?: number;
  /** 私钥文件路径：仅路径引用，绝不包含私钥正文。 */
  readonly identityFile?: string;
  readonly knownHostsFile?: string;
  readonly note?: string;
}

export interface LfaaSshService {
  /** 按连接配置打开一个会话（不立即建连，首次 exec/check 时才连接）。 */
  open(config: SshConnectionConfig): SshSession;
  /**
   * 把 LFAA credentials 的 grant 记录映射为连接配置。
   * 权限边界：凭据 payload 只允许存放主机/端口/私钥【路径】等元数据；
   * 若 payload 出现疑似私钥正文（以 -----BEGIN 开头），直接拒绝，防止私钥被误落库或被本包读取。
   */
  configFromCredential(payload: SshCredentialPayload): SshConnectionConfig;
}

/** 检测一段文本是否疑似 PEM 私钥正文。 */
function looksLikePrivateKey(text: string): boolean {
  return /-----BEGIN [A-Z ]*PRIVATE KEY-----/u.test(text);
}

const service: LfaaSshService = {
  open(config) {
    return new SshSession(config);
  },
  configFromCredential(payload) {
    if (!payload || typeof payload.host !== "string" || payload.host.length === 0) {
      throw new Error("SSH 凭据缺少主机配置。");
    }
    // 权限边界：禁止本包接收/转发私钥正文，只接受路径引用。
    const fields: Array<string | undefined> = [payload.identityFile, payload.knownHostsFile, payload.note];
    for (const field of fields) {
      if (field !== undefined && looksLikePrivateKey(field)) {
        throw new Error("SSH 凭据包含疑似私钥正文；本包只接受私钥文件路径引用，不读取私钥内容。");
      }
    }
    const config: { host: string; port?: number; identityFile?: string; knownHostsFile?: string } = { host: payload.host };
    if (payload.port !== undefined) config.port = payload.port;
    if (payload.identityFile !== undefined) config.identityFile = payload.identityFile;
    if (payload.knownHostsFile !== undefined) config.knownHostsFile = payload.knownHostsFile;
    return config;
  }
};

export function apply(ctx: Context): void {
  ctx.provide(name, service);
}

export { SshSession } from "./session.js";
export type {
  SshConnectionConfig,
  SshExecOptions,
  SshExecResult,
  SshStreamHandle
} from "./session.js";
export { validateSshConfig } from "./schemas.js";
export type { NormalizedSshConfig } from "./schemas.js";
export { runStructured } from "./helper.js";
export type { RemoteCommandRequest, RemoteCommandResult } from "./protocol.js";
export { StreamCollector } from "./stream-security.js";

// 默认导出供 Cordis Loader 装配；运行时能力仍由 lfaaSsh 提供。
export default { name, apply };
