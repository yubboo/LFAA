/**
 * 功能：将 LFAA 单次 Shell 执行接入 Windows x64 AppContainer Sandbox Host。
 * 作用：构造目标节点自己的运行命令和私有取消通道；Host 持有 ACL、SID、Job Object 与异常回收责任。
 * 关联文件：native/system/src/agent_sandbox.rs、packages/sandbox/sandbox、packages/shell/*-sandbox。
 */
import type { Context } from "@deepseek-ai/cordis";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve, win32 } from "node:path";
import { protectPrivateDirectory } from "lfaa-home-paths/src/private-directory.mjs";
import { config } from "lfaa-launch-environment/src/config.js";
import { SandboxUnavailableError, registerSandboxProvider, type ConfinedCommand, type SandboxProvider } from "lfaa-sandbox";
import type { SandboxExecutionPolicy } from "lfaa-sandbox-policy";

const HOST_RELATIVE_PATH = ["dist", "apps", "daemon", "target", "x86_64-pc-windows-msvc", "release", "lfaa-sandbox-host.exe"] as const;
export const WINDOWS_APP_CONTAINER_PROVIDER_ID = "windows-appcontainer-v1";

function isWithin(path: string, root: string): boolean {
  const rel = win32.relative(root, path);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${win32.sep}`) && !win32.isAbsolute(rel));
}

function resolveExecutablePath(executable: string, workspaceRoot: string): string {
  const value = executable.trim().replace(/^"|"$/gu, "");
  if (!value || value.includes("\0")) throw new SandboxUnavailableError("Agent 沙箱无法解析 Shell 可执行文件。");
  const extensions = win32.extname(value) ? [""] : (process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean);
  const systemRoot = process.env.SystemRoot ?? process.env.WINDIR;
  const trustedSystemDirectories = systemRoot
    ? [win32.join(systemRoot, "System32"), win32.join(systemRoot, "System32", "WindowsPowerShell", "v1.0"), systemRoot]
    : [];
  const directories = win32.isAbsolute(value) ? [""] : [...trustedSystemDirectories, workspaceRoot, ...(process.env.PATH ?? "").split(win32.delimiter)];
  for (const directory of directories) {
    const trimmed = directory.trim().replace(/^"|"$/gu, "");
    if (directory && (!trimmed || !win32.isAbsolute(trimmed))) continue;
    for (const extension of extensions) {
      const candidate = win32.isAbsolute(value) ? value : win32.resolve(trimmed || workspaceRoot, `${value}${extension}`);
      try {
        const canonical = realpathSync(candidate);
        if (statSync(canonical).isFile()) return canonical;
      } catch { /* Search the next configured executable directory. */ }
    }
  }
  throw new SandboxUnavailableError("Agent 沙箱无法解析 Shell 可执行文件；已拒绝受限命令。请检查节点 PATH。");
}

function runtimeRoots(executablePath: string, workspaceRoot: string): string[] {
  const candidates = [dirname(executablePath), dirname(process.execPath)];
  const systemRoot = process.env.SystemRoot ?? process.env.WINDIR;
  let canonicalSystemRoot: string | undefined;
  if (systemRoot && win32.isAbsolute(systemRoot) && existsSync(systemRoot)) {
    try { canonicalSystemRoot = realpathSync(systemRoot); } catch { /* Host still verifies its own system path. */ }
  }
  const roots = new Map<string, string>();
  for (const candidate of candidates) {
    const trimmed = candidate.trim().replace(/^"|"$/gu, "");
    if (!trimmed || !win32.isAbsolute(trimmed) || !existsSync(trimmed)) continue;
    try {
      const canonical = realpathSync(trimmed);
      if (!statSync(canonical).isDirectory()) continue;
      // The workspace receives its write policy separately; avoid duplicate or broad ancestor grants.
      if (isWithin(canonical, workspaceRoot) || isWithin(workspaceRoot, canonical)) continue;
      // Windows grants ordinary AppContainers access to required system files; never rewrite system ACLs.
      if (canonicalSystemRoot && (isWithin(canonical, canonicalSystemRoot) || isWithin(canonicalSystemRoot, canonical))) continue;
      roots.set(canonical.toLocaleLowerCase("en-US"), canonical);
    } catch (error) {
      if (error instanceof SandboxUnavailableError) throw error;
      // Missing or inaccessible PATH entries are not granted to the isolated process.
    }
  }
  return [...roots.values()];
}

function requestStopFor(cancelFile: string): (reason: "cancel" | "timeout" | "killed") => boolean {
  return reason => {
    if (reason === "killed") reason = "cancel";
    try {
      writeFileSync(cancelFile, reason, { flag: "wx", mode: 0o600 });
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") return false;
      try {
        const existing = readFileSync(cancelFile, "utf8");
        return existing === reason || existing === "cancel" || existing === "timeout";
      }
      catch { return false; }
    }
  };
}

export class WindowsAclSandboxProvider implements SandboxProvider {
  async confine(argv: readonly string[], policy: SandboxExecutionPolicy, signal?: AbortSignal): Promise<ConfinedCommand> {
    signal?.throwIfAborted();
    if (!Array.isArray(argv) || argv.length === 0 || argv.some(argument => typeof argument !== "string" || argument.includes("\0"))) {
      throw new SandboxUnavailableError("Windows Agent 沙箱收到无效 argv。");
    }
    if (policy.mode === "danger-full-access") {
      return { argv: [...argv], effectiveMode: policy.mode, enforcement: "none", providerId: WINDOWS_APP_CONTAINER_PROVIDER_ID };
    }
    if (process.platform !== "win32" || process.arch !== "x64" || policy.platform !== "win32"
      || (policy.target.kind !== "local" && (policy.target.kind !== "node" || !policy.target.nodeId))) {
      throw new SandboxUnavailableError("当前执行目标没有可用的 Windows x64 AppContainer 沙箱。");
    }
    const workspaceRoot = win32.normalize(policy.workspaceRoot);
    const workingDirectory = win32.normalize(policy.workingDirectory ?? policy.workspaceRoot);
    if (!win32.isAbsolute(workspaceRoot) || !win32.isAbsolute(workingDirectory) || !isWithin(workingDirectory, workspaceRoot)) {
      throw new SandboxUnavailableError("Agent Shell 工作目录必须是当前工作区内的绝对路径。");
    }
    const hostPath = resolve(config.repositoryRoot, ...HOST_RELATIVE_PATH);
    if (!existsSync(hostPath)) throw new SandboxUnavailableError("Windows Sandbox Host 尚未构建，已拒绝受限命令执行。");
    const stateRoot = resolve(config.homeDirectory, "sandbox", "runs");
    protectPrivateDirectory(stateRoot);
    const token = randomUUID();
    const cancelFile = resolve(stateRoot, `cancel-${token}.request`);
    const executablePath = resolveExecutablePath(argv[0]!, workspaceRoot);
    const runtimeRootsForCommand = runtimeRoots(executablePath, workspaceRoot);
    const hostArgv = [
      hostPath, "--agent-run",
      "--workspace-root", workspaceRoot,
      "--working-directory", workingDirectory,
      "--state-root", stateRoot,
      "--cancel-file", cancelFile,
      "--mode", policy.mode,
      "--run-token", token,
      ...runtimeRootsForCommand.flatMap(root => ["--runtime-root", root]),
      "--", executablePath, ...argv.slice(1)
    ];
    if (hostArgv.some(argument => argument.includes("\0"))) throw new SandboxUnavailableError("Agent 沙箱参数包含无效字符。");
    return {
      argv: hostArgv,
      effectiveMode: policy.mode,
      enforcement: "full",
      providerId: WINDOWS_APP_CONTAINER_PROVIDER_ID,
      verificationToken: token,
      requestStop: requestStopFor(cancelFile)
    };
  }
}

export const name = "lfaa-sandbox-windows-acl";

export function apply(ctx: Context): void {
  registerSandboxProvider(ctx, new WindowsAclSandboxProvider());
}
