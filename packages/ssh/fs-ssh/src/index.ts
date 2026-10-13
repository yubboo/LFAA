/**
 * 文件：index.ts
 * 功能：基于 SSH 的远程文件传输（scp/sftp 批处理）与目录列举。
 * 作用：复用系统 OpenSSH 自带的 scp.exe 做文件上传/下载，复用 SshSession 在远端执行 ls/cat
 *       做目录列举与文本读取，不引入 ssh2/sftp 依赖。
 * 集成需要（重要）：完整实现 LFAA 的 lfaa-fs FileSystem 抽象（resolve/stat/writeText/editText
 * 等原子语义）需要与 fs 分片的 FileSystem 基类、fs-local 本地实现对齐；本包当前只提供
 * “传输 + 列举”的协议层能力，待 fs 抽象稳定后再做正式适配器。
 * 关联文件：packages/ssh/ssh/src/session.ts、packages/fs/fs（待接线）。
 * 移植参考：DeepSeek Harness（MIT License，commit 639ed015397290b3745d163aafe02ffee4aa3f84）
 *          packages/ssh/fs-ssh/src/index.ts 的能力面；实现改为 LFAA 自写（scp/sftp）。
 */
import { spawn } from "node:child_process";
import type { Context } from "@deepseek-ai/cordis";
import type { SshConnectionConfig, SshSession } from "lfaa-ssh";

export const name = "lfaaFsSsh";

declare module "@deepseek-ai/cordis" {
  interface Context {
    /** 基于 SSH 的远程文件传输与列举能力。 */
    lfaaFsSsh: LfaaFsSshService;
  }
}

export interface FsSshTransferResult {
  readonly exitCode: number | null;
  readonly stderr: string;
}

/** 一条远端目录列举项。 */
export interface FsSshDirEntry {
  readonly name: string;
  readonly isDirectory: boolean;
}

/** 把主机描述拼成 scp 的 user@host 形式。 */
function scpTarget(config: SshConnectionConfig, remotePath: string): string {
  const host = config.host.includes("@") ? config.host : config.host;
  return `${host}:${remotePath}`;
}

function commonScpArgs(config: SshConnectionConfig): string[] {
  const args: string[] = [];
  if (config.port !== undefined) args.push("-P", String(config.port));
  if (config.identityFile !== undefined) args.push("-i", config.identityFile);
  if (config.knownHostsFile !== undefined) args.push("-o", `UserKnownHostsFile=${config.knownHostsFile}`);
  args.push("-o", `StrictHostKeyChecking=${config.strictHostKeyChecking ?? "accept-new"}`);
  args.push("-o", "BatchMode=yes");
  args.push("-o", "LogLevel=ERROR");
  return args;
}

function runScp(config: SshConnectionConfig, args: string[]): Promise<FsSshTransferResult> {
  const sshPath = config.sshPath ?? "scp";
  return new Promise((resolve) => {
    const child = spawn(sshPath, [...commonScpArgs(config), ...args], { stdio: ["ignore", "ignore", "pipe"] });
    const stderr: Buffer[] = [];
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.once("error", (error) => resolve({ exitCode: null, stderr: error.message }));
    child.once("close", (code) => resolve({ exitCode: code, stderr: Buffer.concat(stderr).toString("utf8") }));
  });
}

export interface LfaaFsSshService {
  /** 上传本地文件到远端路径。 */
  upload(config: SshConnectionConfig, localPath: string, remotePath: string): Promise<FsSshTransferResult>;
  /** 从远端路径下载到本地文件。 */
  download(config: SshConnectionConfig, remotePath: string, localPath: string): Promise<FsSshTransferResult>;
  /** 列举远端目录（远端需支持 POSIX ls）。 */
  listDir(session: SshSession, remoteDir: string): Promise<FsSshDirEntry[]>;
  /** 读取远端文本文件到字符串（远端需支持 cat）。 */
  readText(session: SshSession, remotePath: string): Promise<string>;
}

const service: LfaaFsSshService = {
  upload(config, localPath, remotePath) {
    return runScp(config, [localPath, scpTarget(config, remotePath)]);
  },
  download(config, remotePath, localPath) {
    return runScp(config, [scpTarget(config, remotePath), localPath]);
  },
  async listDir(session, remoteDir) {
    // 用制表符分隔“类型|名字”，避免 ls -la 列宽在不同 locale 下解析漂移。
    const result = await session.exec(
      `cd ${shellQuote(remoteDir)} && for e in * .*; do [ -e "$e" ] || continue; [ "$e" = "." -o "$e" = ".." ] && continue; if [ -d "$e" ]; then echo "D|$e"; else echo "F|$e"; fi; done`
    );
    if (result.exitCode !== 0) {
      throw new Error(`远程目录列举失败（${result.exitCode ?? "连接错误"}）：${result.stderr.trim()}`);
    }
    return result.stdout
      .split(/\r?\n/u)
      .filter((line) => line.includes("|"))
      .map((line) => {
        const [type, name] = line.split("|");
        return { name, isDirectory: type === "D" };
      });
  },
  async readText(session, remotePath) {
    const result = await session.exec(`cat ${shellQuote(remotePath)}`);
    if (result.exitCode !== 0) {
      throw new Error(`读取远程文件失败（${result.exitCode ?? "连接错误"}）：${result.stderr.trim()}`);
    }
    return result.stdout;
  }
};

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

export function apply(ctx: Context): void {
  ctx.provide(name, service);
}

// Loader 加载插件合同，不能把服务实例当成插件。
export default { name, apply };
