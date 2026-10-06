/**
 * 功能：在 Windows AppContainer 中管理 LFAA 第三方插件进程。
 * 作用：通过 Sandbox Host 的受限入口启动 Node 插件、确认协议就绪并在停用后回收进程权限。
 * 关联文件：index.ts 的通用插件生命周期合同；native/system/src/main.rs 的 Windows AppContainer Host。
 */
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { StringDecoder } from "node:string_decoder";
import { relative, resolve, sep } from "node:path";
import { config } from "lfaa-launch-environment/src/config.js";
import type { PluginRecord, PluginRuntimeAdapter } from "./index.js";

const READINESS_PREFIX = "\u001eLFAA_PLUGIN_SANDBOX_READY:";
const HOST_RELATIVE_PATH = ["dist", "apps", "daemon", "target", "x86_64-pc-windows-msvc", "release", "lfaa-sandbox-host.exe"] as const;
const HANDSHAKE_TIMEOUT_MS = 10_000;
const SHUTDOWN_TIMEOUT_MS = 10_000;
const MAX_PROTOCOL_LINE_LENGTH = 64 * 1024;

interface RuntimeSession {
  child: ChildProcessWithoutNullStreams;
  ready: Promise<void>;
  stopped: Promise<void>;
  exit: Promise<number | null>;
  requestStop(): Promise<void>;
  dispose(): void;
}

/** 将受限 Node 入口作为单进程 AppContainer Host 管理；不向插件继承控制端密钥环境。 */
export class WindowsAppContainerPluginRuntime implements PluginRuntimeAdapter {
  private readonly sessions = new Map<string, RuntimeSession>();

  static isAvailable(): boolean {
    return process.platform === "win32" && process.arch === "x64" && existsSync(resolve(config.repositoryRoot, ...HOST_RELATIVE_PATH));
  }

  supports(record: PluginRecord): boolean {
    return WindowsAppContainerPluginRuntime.isAvailable()
      && record.compatibility === "lfaa-v1"
      && record.runtimeEntry !== null
      && record.capabilities.length === 0;
  }

  async enable(record: PluginRecord, installedDirectory: string): Promise<void> {
    if (!this.supports(record) || !record.runtimeEntry) throw new Error("当前 Windows AppContainer Host 不支持此插件入口或声明能力。");
    if (this.sessions.has(record.id)) throw new Error("此插件的隔离运行进程已经存在。");

    const readinessToken = randomUUID();
    const hostPath = resolve(config.repositoryRoot, ...HOST_RELATIVE_PATH);
    const child = spawn(hostPath, [
      "--plugin-run", "--data-root", config.dataDirectory, "--profile", recordSourceProfile(installedDirectory, record.id),
      "--plugin-id", record.id, "--entry", record.runtimeEntry, "--node", process.execPath, "--readiness-token", readinessToken
    ], {
      cwd: config.repositoryRoot,
      windowsHide: true,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"]
    });
    const session = createSession(child, record.id, readinessToken);
    this.sessions.set(record.id, session);
    try {
      await withTimeout(session.ready, HANDSHAKE_TIMEOUT_MS, "插件未在时限内完成隔离启动握手。");
      if (child.exitCode !== null) throw new Error("插件在就绪握手完成后立即退出。");
    } catch (error) {
      await terminateSession(session);
      this.sessions.delete(record.id);
      try { await forgetPluginProfile(hostPath, record, installedDirectory); }
      catch (cleanupError) { throw new Error(`插件启动失败，且 AppContainer 权限回收失败：${messageOf(cleanupError)}`, { cause: error }); }
      throw error;
    }
  }

  async disable(record: PluginRecord, installedDirectory: string): Promise<void> {
    const hostPath = resolve(config.repositoryRoot, ...HOST_RELATIVE_PATH);
    const session = this.sessions.get(record.id);
    if (session) {
      if (session.child.exitCode === null && session.child.signalCode === null) {
        try { await withTimeout(session.requestStop(), SHUTDOWN_TIMEOUT_MS, "插件未在时限内确认停用。"); }
        catch (error) {
          if (session.child.exitCode === null && session.child.signalCode === null) throw error;
          // Host 已实际退出时按进程事实继续回收权限，不把过晚的管道关闭误报成仍在运行。
        }
      }
      await withTimeout(session.exit, SHUTDOWN_TIMEOUT_MS, "插件确认停用后，Sandbox Host 仍未退出。");
      session.dispose();
      this.sessions.delete(record.id);
    }
    // 服务重启后会话句柄不存在；仍调用同一原生清理入口撤销上次遗留的 ACL 和容器配置。
    await forgetPluginProfile(hostPath, record, installedDirectory);
  }

  isActive(record: PluginRecord): boolean {
    const session = this.sessions.get(record.id);
    return Boolean(session && session.child.exitCode === null && session.child.signalCode === null);
  }
}

function recordSourceProfile(installedDirectory: string, pluginId: string): string {
  const segments = relative(resolve(config.dataDirectory), resolve(installedDirectory)).split(sep);
  if (segments.length !== 4 || segments[0]?.toLocaleLowerCase("en-US") !== "plugins"
    || segments[1]?.toLocaleLowerCase("en-US") !== "profiles" || segments[3] !== pluginId) {
    throw new Error("插件目录不在当前 LFAA 数据根目录的受管 Profile 路径中。");
  }
  const profile = segments[2] ?? "";
  if (!/^[a-z][a-z0-9-]{0,63}$/u.test(profile)) throw new Error("插件 Profile 标识无效。");
  return profile;
}

function createSession(child: ChildProcessWithoutNullStreams, pluginId: string, readinessToken: string): RuntimeSession {
  let phase: "starting" | "active" | "stopping" | "closed" = "starting";
  let readyResolve!: () => void;
  let readyReject!: (error: Error) => void;
  let stoppedResolve!: () => void;
  let stoppedReject!: (error: Error) => void;
  let exitResolve!: (code: number | null) => void;
  let hostReadyResolve!: () => void;
  let hostReadyReject!: (error: Error) => void;
  let hostReadySeen = false;
  const ready = new Promise<void>((resolveReady, rejectReady) => { readyResolve = resolveReady; readyReject = rejectReady; });
  const stopped = new Promise<void>((resolveStopped, rejectStopped) => { stoppedResolve = resolveStopped; stoppedReject = rejectStopped; });
  const exit = new Promise<number | null>((resolveExit) => { exitResolve = resolveExit; });
  void stopped.catch(() => { /* 启用期间尚无停用等待方，终止时仍由停用流程读取错误。 */ });
  const stdout = new BoundedLineReader((line) => {
    let message: unknown;
    try { message = JSON.parse(line) as unknown; }
    catch { return fail(new Error("插件标准输出违反 JSONL 生命周期协议。")); }
    if (!isRecord(message) || message.pluginId !== pluginId || message.protocolVersion !== 1 && message.type === "lfaa.plugin.ready") {
      return fail(new Error("插件生命周期消息格式或身份不匹配。"));
    }
    if (phase === "starting" && message.type === "lfaa.plugin.ready" && message.protocolVersion === 1) {
      phase = "active";
      readyResolve();
    } else if (phase === "stopping" && message.type === "lfaa.plugin.stopped") {
      stoppedResolve();
    } else {
      fail(new Error("插件发送了当前生命周期阶段不允许的消息。"));
    }
  }, (error) => fail(error));
  const hostReady = new Promise<void>((resolveReady, rejectReady) => { hostReadyResolve = resolveReady; hostReadyReject = rejectReady; });
  const stderr = new BoundedLineReader((line) => {
    if (!hostReadySeen && line.includes(`${READINESS_PREFIX}${readinessToken}\u001e`)) {
      hostReadySeen = true;
      hostReadyResolve();
    }
  }, (error) => fail(error));
  const waitReady = Promise.all([ready, hostReady]).then(() => undefined);

  child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
  child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
  child.once("error", (error) => fail(error));
  child.once("close", (code) => {
    const closingPhase = phase;
    phase = "closed";
    const error = new Error(`插件 Sandbox Host 已关闭（${String(code)}）。`);
    stdout.close();
    stderr.close();
    if (child.exitCode === null && child.signalCode === null) exitResolve(code);
    else exitResolve(child.exitCode);
    if (closingPhase === "starting") readyReject(error);
    if (!hostReadySeen) hostReadyReject(error);
    if (closingPhase === "stopping") stoppedReject(error);
  });

  return {
    child,
    ready: waitReady,
    stopped,
    exit,
    requestStop: async () => {
      if (phase === "closed") return;
      if (phase !== "active") throw new Error("插件当前没有可停止的活动会话。");
      phase = "stopping";
      await new Promise<void>((resolveWrite, rejectWrite) => {
        child.stdin.write('{"type":"shutdown"}\n', (error) => error ? rejectWrite(error) : resolveWrite());
      });
      await stopped;
    },
    dispose: () => { stdout.dispose(); stderr.dispose(); }
  };

  function fail(error: Error): void {
    if (phase === "closed") return;
    if (phase === "starting") readyReject(error);
    if (phase === "stopping") stoppedReject(error);
    phase = "closed";
    child.kill();
  }
}

class BoundedLineReader {
  private readonly decoder = new StringDecoder("utf8");
  private buffer = "";

  constructor(private readonly onLine: (line: string) => void, private readonly onError: (error: Error) => void) {}

  push(chunk: Buffer): void {
    this.buffer += this.decoder.write(chunk);
    if (this.buffer.length > MAX_PROTOCOL_LINE_LENGTH && !this.buffer.includes("\n")) {
      this.onError(new Error("插件生命周期协议行超过长度上限。"));
      this.buffer = "";
      return;
    }
    let lineEnd = this.buffer.indexOf("\n");
    while (lineEnd >= 0) {
      const line = this.buffer.slice(0, lineEnd).replace(/\r$/u, "");
      this.buffer = this.buffer.slice(lineEnd + 1);
      if (line.length > MAX_PROTOCOL_LINE_LENGTH) this.onError(new Error("插件生命周期协议行超过长度上限。"));
      else this.onLine(line);
      lineEnd = this.buffer.indexOf("\n");
    }
  }

  close(): void {
    this.buffer += this.decoder.end();
    if (this.buffer.length > MAX_PROTOCOL_LINE_LENGTH) this.onError(new Error("插件生命周期协议行超过长度上限。"));
    this.buffer = "";
  }

  dispose(): void { this.buffer = ""; }
}

async function terminateSession(session: RuntimeSession): Promise<void> {
  if (session.child.exitCode === null && session.child.signalCode === null) session.child.kill();
  try { await withTimeout(session.exit, 5_000, "无法确认异常插件进程已经退出。"); }
  finally { session.dispose(); }
}

async function forgetPluginProfile(hostPath: string, record: PluginRecord, installedDirectory: string): Promise<void> {
  const child = spawn(hostPath, [
    "--plugin-forget-profile", "--data-root", config.dataDirectory,
      "--profile", recordSourceProfile(installedDirectory, record.id), "--plugin-id", record.id,
    "--node", process.execPath
  ], { cwd: config.repositoryRoot, windowsHide: true, shell: false, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8").on("data", (chunk: string) => { stdout = `${stdout}${chunk}`.slice(-4096); });
  child.stderr.setEncoding("utf8").on("data", (chunk: string) => { stderr = `${stderr}${chunk}`.slice(-4096); });
  const code = await new Promise<number | null>((resolveExit, rejectExit) => {
    const timer = setTimeout(() => { child.kill(); rejectExit(new Error("插件 AppContainer 权限清理超时。")); }, 10_000);
    child.once("error", (error) => { clearTimeout(timer); rejectExit(error); });
    child.once("close", (exitCode) => { clearTimeout(timer); resolveExit(exitCode); });
  });
  if (code !== 0) throw new Error(stderr.trim() || `插件 AppContainer 权限清理失败（${String(code)}）：${stdout.trim()}`);
  let result: unknown;
  try { result = JSON.parse(stdout.trim()) as unknown; }
  catch { throw new Error("插件 AppContainer Host 没有返回可验证的权限清理结果。"); }
  if (!isRecord(result) || result.pluginProfileRemoved !== true || result.backend !== "windows-appcontainer-v1") throw new Error("插件 AppContainer Host 未确认权限清理完成。");
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolveResult, rejectResult) => {
    const timer = setTimeout(() => rejectResult(new Error(message)), timeoutMs);
    promise.then((value) => { clearTimeout(timer); resolveResult(value); }, (error: unknown) => { clearTimeout(timer); rejectResult(error); });
  });
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function messageOf(error: unknown): string { return error instanceof Error ? error.message : String(error); }
