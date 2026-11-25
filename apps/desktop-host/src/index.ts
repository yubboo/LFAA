// 桌面端宿主进程：以 Electron 的 Node 模式运行 @lfaa/web-server 生产宿主，并通过 IPC 向 Electron 壳上报地址与退出。
// 与 DSH 的 apps/desktop-host 一致：宿主是独立进程，壳只负责窗口与生命周期。
import { inspect } from "node:util";
import { startHostServer, type HostServer } from "@lfaa/web-server";

/**
 * 桌面端本机宿主端口：默认由操作系统自动分配本机空闲端口（port: 0），
 * 彻底与开发态 Web 5173 隔离，避免互相抢占或重启 Web 时误杀桌面端宿主；
 * 如需排查固定端口，可通过环境变量 LFAA_DESKTOP_PORT 指定。
 */
function resolveDesktopHostPort(): number {
  const raw = process.env.LFAA_DESKTOP_PORT?.trim();
  if (!raw) return 0;
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : 0;
}

let server: HostServer | null = null;
let stopping: Promise<void> | undefined;

/** 通过 IPC 发送事件；父进程已断开时静默忽略，避免退出阶段抛错。 */
function send(message: unknown): void {
  if (!process.connected || !process.send) return;
  process.send(message, (error) => {
    if (error) console.error("桌面宿主发送 IPC 事件失败：", error);
  });
}

/** 幂等停止：先停本机服务，再确认 shutdown-complete，最后断开 IPC 让壳看到进程退出。 */
function stop(): Promise<void> {
  stopping ??= (async () => {
    await server?.stop().catch((error: unknown) => {
      console.error("桌面宿主停止本机服务失败：", error);
    });
    server = null;
    send({ type: "shutdown-complete" });
    if (process.connected) process.disconnect();
  })();
  return stopping;
}

// 壳退出或崩溃会关闭 IPC 通道，据此停止服务，避免遗留监听端口与后台任务。
process.on("message", (message: unknown) => {
  if (typeof message !== "object" || message === null) return;
  if ((message as { type?: unknown }).type === "shutdown") void stop();
  else server?.receiveDesktopDownload?.(message, send);
});
process.once("disconnect", () => {
  void stop();
});

async function main(): Promise<void> {
  const webRoot = process.argv[2];
  const projectRoot = process.argv[3];
  const desktopDownloadDirectory = process.argv[4];
  if (!webRoot || !projectRoot) throw new Error("缺少 webRoot / projectRoot 参数。");
  const port = resolveDesktopHostPort();
  try {
    // 默认分配独立空闲端口，不与开发态 Web 5173 冲突；显式指定端口被占用时给出清晰提示。
    server = await startHostServer({ webRoot, projectRoot, port, ...(desktopDownloadDirectory ? { desktopDownloadDirectory } : {}) });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EADDRINUSE") {
      throw new Error(`桌面端指定端口 ${port} 已被其他程序占用。请更换 LFAA_DESKTOP_PORT 或关闭占用程序后重试。`, { cause: error });
    }
    throw error;
  }
  send({ type: "ready", url: server.url, port: server.port });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  // 壳拿到的应是完整诊断；stderr 与 IPC 会竞争，失败信息只走 IPC + 本地 stderr 各一次。
  const diagnostic = inspect(error, { depth: 4, maxArrayLength: 50 }).slice(0, 64 * 1024);
  send({ type: "fatal", message, diagnostic });
  console.error(error);
  process.exitCode = 1;
  if (process.connected) process.disconnect();
});