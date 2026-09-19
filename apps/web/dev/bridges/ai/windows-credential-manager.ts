/**
 * 文件：windows-credential-manager.ts
 * 作用：Web 开发宿主的 Windows Credential Manager Secret Store Adapter。
 * 负责：通过稳定 PowerShell helper 调用 Generic Credential 写入、读取、删除，并转换为 Host Port。
 * 不负责：账户元数据、Provider 网络请求、React UI、普通文件 Secret 持久化。
 * 状态归属：Windows Credential Manager 或非 Windows 当前 Vite 进程内存。
 * 对外接口：createWebDevSecretStore(projectRoot)。
 * 关联文件：windows-credential-manager.ps1、ai-config-bridge.ts、@lfaa/config-system AiSecretStorePort。
 * 修改注意事项：Secret 只能通过 stdin 进入 helper；禁止进入命令行参数、环境变量、日志或普通文件。
 */
import { spawn } from "node:child_process";
import { join } from "node:path";
import type { AiSecretStorePort } from "@lfaa/config-system";

interface CredentialResult {
  ok: boolean;
  found?: boolean;
  valueBase64?: string | null;
  persistence?: string;
  stage?: string;
  code?: number;
  error?: string;
}

const STAGE_LABELS: Readonly<Record<string, string>> = {
  input: "输入",
  write: "写入",
  "verify-read": "写后回读",
  "verify-content": "写后校验",
  read: "读取",
  delete: "删除",
  helper: "Helper",
};

function helperPath(projectRoot: string): string {
  return join(projectRoot, "apps", "web", "dev", "bridges", "ai", "windows-credential-manager.ps1");
}

function sanitizedProcessError(stderr: string, exitCode: number | null): Error {
  const compact = stderr.replace(/\s+/g, " ").trim().slice(0, 280);
  const detail = compact ? `：${compact}` : "";
  return new Error(`Windows Credential Manager Helper 执行失败（exit ${exitCode ?? "unknown"}）${detail}`);
}

function nativeCredentialError(result: CredentialResult): Error {
  const stage = STAGE_LABELS[result.stage ?? ""] ?? "操作";
  const code = Number.isInteger(result.code) && result.code !== 0 ? `，Win32 ${result.code}` : "";
  const message = result.error?.replace(/\s+/g, " ").trim().slice(0, 220);
  return new Error(`Windows Credential Manager ${stage}失败${code}${message ? `：${message}` : ""}`);
}

function invokeCredentialManager(projectRoot: string, payload: Record<string, string>): Promise<CredentialResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      helperPath(projectRoot),
    ], {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { if (stdout.length < 64_000) stdout += chunk; });
    child.stderr.on("data", (chunk) => { if (stderr.length < 8_000) stderr += chunk; });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
      const lastLine = lines.at(-1);
      if (!lastLine) return reject(sanitizedProcessError(stderr, exitCode));
      try {
        const result = JSON.parse(lastLine) as CredentialResult;
        if (!result.ok) return reject(nativeCredentialError(result));
        resolve(result);
      } catch (error) {
        if (error instanceof SyntaxError) return reject(sanitizedProcessError(stderr || stdout, exitCode));
        reject(error);
      }
    });
    child.stdin.end(JSON.stringify(payload), "utf8");
  });
}

class WindowsCredentialStore implements AiSecretStorePort {
  readonly persistence = "os-credential-store" as const;
  readonly #projectRoot: string;

  constructor(projectRoot: string) { this.#projectRoot = projectRoot; }

  async put(credentialRef: string, secret: string) {
    await invokeCredentialManager(this.#projectRoot, { action: "put", target: credentialRef, secret });
  }

  async get(credentialRef: string) {
    const result = await invokeCredentialManager(this.#projectRoot, { action: "get", target: credentialRef });
    if (!result.found || !result.valueBase64) return null;
    return Buffer.from(result.valueBase64, "base64").toString("utf8");
  }

  async delete(credentialRef: string) {
    await invokeCredentialManager(this.#projectRoot, { action: "delete", target: credentialRef });
  }
}

class MemoryCredentialStore implements AiSecretStorePort {
  readonly persistence = "memory" as const;
  readonly #values = new Map<string, string>();
  async put(credentialRef: string, secret: string) { this.#values.set(credentialRef, secret); }
  async get(credentialRef: string) { return this.#values.get(credentialRef) ?? null; }
  async delete(credentialRef: string) { this.#values.delete(credentialRef); }
}

export function createWebDevSecretStore(projectRoot: string): AiSecretStorePort {
  return process.platform === "win32" ? new WindowsCredentialStore(projectRoot) : new MemoryCredentialStore();
}
