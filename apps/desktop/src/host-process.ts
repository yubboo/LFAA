// 桌面宿主子进程：用 Electron 的 Node 模式拉起 apps/desktop-host，经 IPC 获取本机地址并负责优雅退出。
// 与 DSH 一致，壳与宿主之间只通过 IPC 事件通信，壳不直接装配业务运行时。
import { spawn, type ChildProcess } from "node:child_process";

/** 宿主就绪后壳需要的信息。 */
export interface DesktopHostReady {
  url: string;
  port: number;
}

/** 桌面宿主启动失败：携带宿主给出的可读原因与完整诊断。 */
export class DesktopHostError extends Error {
  readonly diagnostic: string | undefined;

  constructor(message: string, diagnostic: string | undefined) {
    super(message);
    this.name = "DesktopHostError";
    this.diagnostic = diagnostic;
  }
}

export interface DesktopHostOptions {
  /** 宿主进程入口（开发态 apps/desktop-host/lib/index.js；安装态 <app>/desktop-host/index.js）。 */
  entry: string;
  /** 已构建的 Web 产物目录。 */
  webRoot: string;
  /** 用户工作根：项目未绑定时的回退，绝不传安装目录。 */
  projectRoot: string;
  /** 就绪后宿主意外退出时回调；壳负责提示并退出，避免留下空白窗口。 */
  onUnexpectedExit?: (error: Error) => void;
}

/** 启动超时：Cordis 与插件装配较慢，给足时间但不无限等待。 */
const READY_TIMEOUT_MS = 30_000;
/** 退出超时：先请它优雅停止，超时再升级为强制结束。 */
const SHUTDOWN_TIMEOUT_MS = 10_000;
const KILL_TIMEOUT_MS = 5_000;
const MAX_DIAGNOSTIC_CHARS = 64 * 1024;

type HostMessage =
  | { type: "ready"; url: string; port: number }
  | { type: "fatal"; message: string; diagnostic?: string }
  | { type: "shutdown-complete" };

/** 校验 IPC 事件形状：未知事件按协议错误处理，不静默忽略。 */
function isHostMessage(message: unknown): message is HostMessage {
  if (typeof message !== "object" || message === null) return false;
  const candidate = message as Record<string, unknown>;
  switch (candidate.type) {
    case "ready":
      return typeof candidate.url === "string" && typeof candidate.port === "number";
    case "fatal":
      return typeof candidate.message === "string";
    case "shutdown-complete":
      return true;
    default:
      return false;
  }
}

/** 在时限内等待一次性 Promise 完成；超时返回 false 而不抛错。 */
function completesWithin(promise: Promise<void>, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    void promise.finally(() => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

export class DesktopHostProcess {
  #child: ChildProcess | undefined;
  #exit: Promise<void> | undefined;
  #startupTimer: ReturnType<typeof setTimeout> | undefined;
  #stderr = "";
  #stopping = false;
  #readySettled = false;
  #startupFailed = false;
  #resolveReady!: (ready: DesktopHostReady) => void;
  #rejectReady!: (error: Error) => void;
  readonly #ready: Promise<DesktopHostReady>;
  readonly #options: DesktopHostOptions;

  constructor(options: DesktopHostOptions) {
    this.#options = options;
    this.#ready = new Promise<DesktopHostReady>((resolve, reject) => {
      this.#resolveReady = resolve;
      this.#rejectReady = reject;
    });
  }

  /** 启动宿主并等待 ready；启动失败抛出带诊断的错误。 */
  async start(): Promise<DesktopHostReady> {
    const { entry, webRoot, projectRoot, onUnexpectedExit } = this.#options;
    const child = spawn(process.execPath, [entry, webRoot, projectRoot], {
      cwd: projectRoot,
      // 用 Electron 自带 Node 运行宿主：安装包无需再分发一份 node.exe。
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      stdio: ["ignore", "pipe", "pipe", "ipc"],
      windowsHide: true,
    });
    this.#child = child;

    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      this.#stderr = (this.#stderr + chunk).slice(-MAX_DIAGNOSTIC_CHARS);
      process.stderr.write(chunk);
    });
    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => process.stdout.write(chunk));

    this.#startupTimer = setTimeout(() => {
      this.#failReady(new Error(`桌面宿主启动超时（${READY_TIMEOUT_MS / 1000} 秒）。`));
      child.kill("SIGKILL");
    }, READY_TIMEOUT_MS);

    child.on("message", (message: unknown) => {
      if (!isHostMessage(message)) {
        this.#handleUnexpected(new Error("桌面宿主发来无法识别的 IPC 事件。"));
        return;
      }
      if (message.type === "ready") {
        if (this.#startupTimer) { clearTimeout(this.#startupTimer); this.#startupTimer = undefined; }
        this.#readySettled = true;
        this.#resolveReady({ url: message.url, port: message.port });
        return;
      }
      if (message.type === "fatal") {
        if (this.#startupTimer) { clearTimeout(this.#startupTimer); this.#startupTimer = undefined; }
        this.#handleUnexpected(new DesktopHostError(message.message, message.diagnostic));
      }
      // shutdown-complete 只表示宿主已停服，进程退出由 close 事件统一处理。
    });
    child.once("error", (error) => {
      if (this.#startupTimer) { clearTimeout(this.#startupTimer); this.#startupTimer = undefined; }
      this.#handleUnexpected(error);
    });

    this.#exit = new Promise<void>((resolve) => {
      child.once("close", (code) => {
        if (this.#startupTimer) { clearTimeout(this.#startupTimer); this.#startupTimer = undefined; }
        const suffix = this.#stderr.trim() === "" ? "" : `：${this.#stderr.trim()}`;
        resolve();
        if (this.#stopping) return;
        this.#handleUnexpected(new Error(`桌面宿主已退出（退出码 ${code ?? "未知"}）${suffix}`));
      });
    });

    return this.#ready;
  }

  /** 请求优雅退出；超时后升级为强制结束，保证不残留进程。 */
  async stop(): Promise<void> {
    if (this.#startupTimer) {
      clearTimeout(this.#startupTimer);
      this.#startupTimer = undefined;
    }
    const child = this.#child;
    if (!child) return;
    this.#stopping = true;
    this.#child = undefined;
    if (child.connected) {
      child.send({ type: "shutdown" }, (error) => {
        if (error) console.error("桌面宿主退出请求发送失败：", error);
      });
    }
    if (await completesWithin(this.#exit ?? Promise.resolve(), SHUTDOWN_TIMEOUT_MS)) return;
    child.kill("SIGTERM");
    if (await completesWithin(this.#exit ?? Promise.resolve(), KILL_TIMEOUT_MS)) return;
    child.kill("SIGKILL");
  }

  /** 启动期失败只拒绝 ready；就绪后失败交给 onUnexpectedExit，避免壳重复弹错。 */
  #handleUnexpected(error: Error): void {
    if (this.#stopping || this.#startupFailed) return;
    if (!this.#readySettled) {
      this.#startupFailed = true;
      this.#failReady(error);
      return;
    }
    this.#options.onUnexpectedExit?.(error);
  }

  #failReady(error: Error): void {
    if (this.#readySettled) return;
    this.#readySettled = true;
    this.#rejectReady(error);
  }
}