/** 功能：为本地模型系列提供受管 Python 推理进程。作用：隔离环境、限长协议、超时/取消进程树与空闲卸载。 */
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import type { SubprocessHandle, SubprocessRuntime } from "lfaa-subprocess/src/index.js";

const MAX_WORKER_INPUT_BYTES = 32 * 1024 * 1024;
const MAX_WORKER_LINE_BYTES = 64 * 1024;
const MAX_WORKER_ERROR_BYTES = 1_200;
const MODEL_ENV_NAMES = ["PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "HOME", "HF_HOME", "CUDA_PATH", "LD_LIBRARY_PATH", "DYLD_LIBRARY_PATH"] as const;

export interface WorkerMessage { type?: string; id?: string; modelId?: string; ok?: boolean; error?: string; [key: string]: unknown }
interface PendingMessage { resolve(message: WorkerMessage): void; reject(error: Error): void }
interface WorkerSession {
  key: string;
  modelId: string;
  handle: SubprocessHandle;
  ready: Promise<void>;
  resolveReady(): void;
  rejectReady(error: Error): void;
  pending: Map<string, PendingMessage>;
  active: boolean;
  stdoutBuffer: Buffer;
}

function workerPlatform(): "win32" | "linux" | "darwin" {
  if (process.platform === "win32") return "win32";
  if (process.platform === "darwin") return "darwin";
  return "linux";
}

function safeWorkerError(message: string): string {
  if (/No module named ['"](?:torch|diffusers|transformers|safetensors|accelerate|PIL|torchao)/u.test(message)) {
    return "本机缺少该模型适配器所需的推理依赖；请按 LFAA 模型说明配置本机运行环境。LFAA 不会自动安装依赖。";
  }
  return message.replace(/[\r\n]+/gu, " ").slice(0, MAX_WORKER_ERROR_BYTES) || "本地模型推理没有完成。";
}

export class ManagedPythonWorker {
  private current: WorkerSession | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(private readonly input: { subprocess: SubprocessRuntime; workerPath: string; cwd: string; modelId: string }) {}

  private async start(modelDirectory: string, signal?: AbortSignal): Promise<WorkerSession> {
    signal?.throwIfAborted();
    const env: Record<string, string> = { PYTHONUNBUFFERED: "1" };
    for (const name of MODEL_ENV_NAMES) {
      const value = process.env[name];
      if (value && !value.includes("\0") && Buffer.byteLength(value, "utf8") <= 32 * 1024) env[name] = value;
    }
    const executable = await this.input.subprocess.resolveExecutable({ kind: "local" }, "python", env, signal);
    signal?.throwIfAborted();
    const handle = await this.input.subprocess.spawn({
      target: { kind: "local" }, platform: workerPlatform(), executable, args: [this.input.workerPath], cwd: this.input.cwd, env,
      stdin: "pipe", output: { stdout: "stream", stderr: "stream" }, terminationGraceMs: 5_000, ...(signal ? { signal } : {})
    });
    let resolveReady!: () => void;
    let rejectReady!: (error: Error) => void;
    const ready = new Promise<void>((resolvePromise, rejectPromise) => { resolveReady = resolvePromise; rejectReady = rejectPromise; });
    void ready.catch(() => undefined);
    const session: WorkerSession = { key: `${modelDirectory}:${this.input.modelId}`, modelId: this.input.modelId, handle, ready, resolveReady, rejectReady, pending: new Map(), active: true, stdoutBuffer: Buffer.alloc(0) };
    this.current = session;
    void this.consume(session);
    void handle.done.then(outcome => {
      if (!session.active) return;
      session.active = false;
      this.rejectSession(session, new Error(outcome.cancelled ? "本地模型推理进程已取消。" : "本地模型推理进程已退出；未登记生成结果。"));
    }, error => {
      session.active = false;
      this.rejectSession(session, error instanceof Error ? error : new Error("本地模型推理进程失败。"));
    });
    try {
      await this.write(session, { type: "load", modelId: this.input.modelId, modelPath: modelDirectory });
      await session.ready;
      return session;
    } catch (error) {
      await this.stop(session);
      throw error;
    }
  }

  private async write(session: WorkerSession, message: Record<string, unknown>): Promise<void> {
    const bytes = Buffer.from(`${JSON.stringify(message)}\n`, "utf8");
    if (bytes.byteLength > MAX_WORKER_INPUT_BYTES) throw new Error("本地模型工作进程请求超过大小限制。");
    await session.handle.writeStdin(bytes);
  }

  private async consume(session: WorkerSession): Promise<void> {
    try {
      for await (const chunk of session.handle.output) {
        if (!session.active || chunk.stream !== "stdout") continue;
        session.stdoutBuffer = Buffer.concat([session.stdoutBuffer, Buffer.from(chunk.bytes)]);
        if (session.stdoutBuffer.byteLength > MAX_WORKER_LINE_BYTES && !session.stdoutBuffer.includes(10)) throw new Error("本地模型工作进程返回了超长消息。");
        while (true) {
          const newline = session.stdoutBuffer.indexOf(10);
          if (newline < 0) break;
          const line = session.stdoutBuffer.subarray(0, newline).toString("utf8").trim();
          session.stdoutBuffer = session.stdoutBuffer.subarray(newline + 1);
          if (!line || Buffer.byteLength(line, "utf8") > MAX_WORKER_LINE_BYTES) continue;
          let message: WorkerMessage;
          try { message = JSON.parse(line) as WorkerMessage; }
          catch { continue; }
          if (message.type === "ready" && message.modelId === session.modelId) session.resolveReady();
          else if (message.type === "fatal") {
            const error = safeWorkerError(typeof message.error === "string" ? message.error : "本地模型加载失败。");
            void this.stop(session, new Error(error));
          } else if (message.type === "result" && typeof message.id === "string") {
            const pending = session.pending.get(message.id);
            if (pending) { session.pending.delete(message.id); pending.resolve(message); }
          }
        }
      }
    } catch (error) {
      void this.stop(session);
      this.rejectSession(session, error instanceof Error ? error : new Error("本地模型工作进程输出读取失败。"));
    }
  }

  private rejectSession(session: WorkerSession, error: Error): void {
    session.rejectReady(error);
    for (const pending of session.pending.values()) pending.reject(error);
    session.pending.clear();
    if (this.current === session) this.current = null;
  }

  private async stop(session = this.current, reason = new Error("本地模型工作进程已卸载。")): Promise<void> {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    if (!session) return;
    if (this.current === session) this.current = null;
    this.rejectSession(session, reason);
    if (!session.active) return;
    session.active = false;
    await session.handle.terminate("local-model-unload").catch(() => undefined);
  }

  async execute(modelDirectory: string, dataDirectory: string, request: Record<string, unknown>, timeoutMs: number, unloadAfterMs: number, signal?: AbortSignal): Promise<WorkerMessage> {
    if (this.disposed) throw new Error("本地模型适配器已卸载。");
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 10_000 || timeoutMs > 1_800_000) throw new Error("本地模型推理时限必须为 10 秒至 30 分钟。");
    if (!Number.isSafeInteger(unloadAfterMs) || unloadAfterMs < 60_000 || unloadAfterMs > 3_600_000) throw new Error("本地模型空闲卸载时限必须为 1 至 60 分钟。");
    signal?.throwIfAborted();
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    const key = `${resolve(modelDirectory)}:${this.input.modelId}`;
    if (this.current && this.current.key !== key) await this.stop(this.current);
    const timedController = new AbortController();
    const onAbort = () => { timedController.abort(signal?.reason); void this.stop(); };
    signal?.addEventListener("abort", onAbort, { once: true });
    const timeout = setTimeout(() => { timedController.abort(new Error("本地模型推理等待超时。")); void this.stop(); }, timeoutMs);
    try {
      const session = this.current?.key === key ? this.current : await this.start(modelDirectory, timedController.signal);
      await session.ready;
      signal?.throwIfAborted();
      if (timedController.signal.aborted) throw timedController.signal.reason instanceof Error ? timedController.signal.reason : new Error("本地模型推理等待超时。");
      const id = randomUUID();
      const resultPromise = new Promise<WorkerMessage>((resolvePromise, rejectPromise) => session.pending.set(id, { resolve: resolvePromise, reject: rejectPromise }));
      try { await this.write(session, { ...request, type: "generate", id, modelId: this.input.modelId, outputPath: request.outputPath, modelPath: modelDirectory, dataPath: dataDirectory }); }
      catch (error) { session.pending.delete(id); await this.stop(session); throw error; }
      const result = await resultPromise;
      if (timedController.signal.aborted) throw timedController.signal.reason instanceof Error ? timedController.signal.reason : new Error("本地模型推理等待超时。");
      if (signal?.aborted) throw new DOMException("本地模型推理已取消。", "AbortError");
      if (!result.ok) throw new Error(safeWorkerError(typeof result.error === "string" ? result.error : "本地模型推理失败。"));
      this.idleTimer = setTimeout(() => { void this.stop(session); }, unloadAfterMs);
      return result;
    } catch (error) {
      if (timedController.signal.aborted && !signal?.aborted) throw new Error("本地模型推理等待超时；请检查设备和运行依赖。未登记输出。");
      if (signal?.aborted) throw new DOMException("本地模型推理已取消。", "AbortError");
      throw error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  async unload(): Promise<void> { await this.stop(); }
  isLoaded(): boolean { return Boolean(this.current?.active); }
  async dispose(): Promise<void> { this.disposed = true; await this.stop(); }
}
