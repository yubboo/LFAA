/**
 * 文件：rust-secret-store.ts
 * 作用：Web 开发宿主的 Rust Secret Broker Adapter。
 * 负责：按需构建 lfaa-secret-broker，通过 stdin/stdout 二进制协议执行 put/get/delete，并转换为 Host Port。
 * 不负责：Win32 API、Provider 网络、账户元数据、React UI、普通文件 Secret 持久化。
 * 状态归属：Secret 真值属于 Rust Broker 背后的 OS Credential Store；本文件仅缓存 Broker 可执行路径 Promise。
 * 对外接口：createWebDevSecretStore(projectRoot)。
 * 关联文件：crates/secret-store、ai-config-bridge.ts、@lfaa/credentials CredentialStorePort。
 * 修改注意事项：Secret 只能进入 Broker stdin；禁止 argv/env/log/file；构建日志不得拼接 Secret。
 */
import { spawn } from "node:child_process";
import type { CredentialStorePort } from "@lfaa/credentials";

const REQUEST_MAGIC = Buffer.from("LFS1", "ascii");
const RESPONSE_MAGIC = Buffer.from("LFR1", "ascii");
const MAX_RESPONSE_BYTES = 1024 * 1024;

const ACTION = { put: 1, get: 2, delete: 3 } as const;
const STAGE_LABELS: Readonly<Record<number, string>> = {
  1: "输入",
  2: "写入",
  3: "写后回读",
  4: "写后校验",
  5: "读取",
  6: "删除",
  7: "平台支持",
};

let brokerExecutablePromise: Promise<string> | null = null;

function buildRequest(action: keyof typeof ACTION, credentialRef: string, secret = ""): Buffer {
  const target = Buffer.from(credentialRef, "utf8");
  const value = Buffer.from(secret, "utf8");
  if (target.length === 0 || target.length > 1024) throw new Error("Credential Ref 无效。");
  if (value.length > 2560) throw new Error("Secret 超出 Windows Credential Manager Generic Credential 限制。");
  const header = Buffer.allocUnsafe(13);
  REQUEST_MAGIC.copy(header, 0);
  header[4] = ACTION[action];
  header.writeUInt32LE(target.length, 5);
  header.writeUInt32LE(value.length, 9);
  return Buffer.concat([header, target, value]);
}

function parseResponse(buffer: Buffer): { status: number; stage: number; code: number; payload: Buffer } {
  if (buffer.length < 14 || !buffer.subarray(0, 4).equals(RESPONSE_MAGIC)) throw new Error("Rust Secret Broker 返回了无效响应。");
  const status = buffer[4];
  const stage = buffer[5];
  const code = buffer.readUInt32LE(6);
  const length = buffer.readUInt32LE(10);
  if (14 + length !== buffer.length) throw new Error("Rust Secret Broker 响应长度无效。");
  return { status, stage, code, payload: buffer.subarray(14) };
}

function safeBuildError(stderr: string, exitCode: number | null): Error {
  const compact = stderr.replace(/\s+/g, " ").trim().slice(0, 420);
  return new Error(`Rust Secret Broker 构建失败（exit ${exitCode ?? "unknown"}）${compact ? `：${compact}` : ""}`);
}

function buildBroker(projectRoot: string): Promise<string> {
  if (brokerExecutablePromise) return brokerExecutablePromise;
  brokerExecutablePromise = new Promise((resolve, reject) => {
    const child = spawn("cargo", [
      "build",
      "-p", "lfaa-secret-store",
      "--bin", "lfaa-secret-broker",
      "--message-format=json-render-diagnostics",
    ], {
      cwd: projectRoot,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let executable = "";
    let stderr = "";
    let stdoutRemainder = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdoutRemainder += chunk;
      const lines = stdoutRemainder.split(/\r?\n/);
      stdoutRemainder = lines.pop() ?? "";
      for (const line of lines) {
        try {
          const event = JSON.parse(line) as { reason?: string; target?: { name?: string }; executable?: string | null };
          if (event.reason === "compiler-artifact" && event.target?.name === "lfaa-secret-broker" && event.executable) executable = event.executable;
        } catch { /* cargo 非 JSON 辅助输出无需转发 */ }
      }
    });
    child.stderr.on("data", (chunk: string) => { if (stderr.length < 32_000) stderr += chunk; });
    child.on("error", (error) => { brokerExecutablePromise = null; reject(new Error(`无法启动 Cargo：${error.message}`)); });
    child.on("close", (code) => {
      if (code !== 0 || !executable) {
        brokerExecutablePromise = null;
        reject(safeBuildError(stderr, code));
        return;
      }
      resolve(executable);
    });
  });
  return brokerExecutablePromise;
}

async function invokeBroker(projectRoot: string, action: keyof typeof ACTION, credentialRef: string, secret = ""): Promise<Buffer | null> {
  const executable = await buildBroker(projectRoot);
  const request = buildRequest(action, credentialRef, secret);
  return await new Promise((resolve, reject) => {
    const child = spawn(executable, [], { cwd: projectRoot, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    let stdoutSize = 0;
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdoutSize += chunk.length;
      if (stdoutSize <= MAX_RESPONSE_BYTES) stdout.push(chunk);
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => { if (stderr.length < 8_000) stderr += chunk; });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      try {
        if (stdoutSize > MAX_RESPONSE_BYTES) throw new Error("Rust Secret Broker 响应过大。");
        const response = parseResponse(Buffer.concat(stdout));
        if (response.status === 255) {
          const stage = STAGE_LABELS[response.stage] ?? "操作";
          const message = response.payload.toString("utf8").replace(/\s+/g, " ").trim().slice(0, 320);
          throw new Error(`Rust Secret Broker ${stage}失败${response.code ? `，OS ${response.code}` : ""}${message ? `：${message}` : ""}`);
        }
        if (exitCode !== 0) throw new Error(`Rust Secret Broker 异常退出（exit ${exitCode}）。${stderr ? ` ${stderr.replace(/\s+/g, " ").trim().slice(0, 220)}` : ""}`);
        if (response.status === 2) return resolve(null);
        if (response.status === 1) return resolve(response.payload);
        resolve(Buffer.alloc(0));
      } catch (error) { reject(error); }
    });
    child.stdin.end(request);
  });
}

class RustCredentialStore implements CredentialStorePort {
  readonly persistence = "os-credential-store" as const;
  readonly #projectRoot: string;
  constructor(projectRoot: string) { this.#projectRoot = projectRoot; }
  async put(credentialRef: string, secret: string) { await invokeBroker(this.#projectRoot, "put", credentialRef, secret); }
  async get(credentialRef: string) { const value = await invokeBroker(this.#projectRoot, "get", credentialRef); return value ? value.toString("utf8") : null; }
  async delete(credentialRef: string) { await invokeBroker(this.#projectRoot, "delete", credentialRef); }
}

class MemoryCredentialStore implements CredentialStorePort {
  readonly persistence = "memory" as const;
  readonly #values = new Map<string, string>();
  async put(credentialRef: string, secret: string) { this.#values.set(credentialRef, secret); }
  async get(credentialRef: string) { return this.#values.get(credentialRef) ?? null; }
  async delete(credentialRef: string) { this.#values.delete(credentialRef); }
}

export function createWebDevSecretStore(projectRoot: string): CredentialStorePort {
  return process.platform === "win32" ? new RustCredentialStore(projectRoot) : new MemoryCredentialStore();
}
