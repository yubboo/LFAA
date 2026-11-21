// 桌面端宿主进程：以 Electron 的 Node 模式运行 @lfaa/web-server 生产宿主，并通过 IPC 向 Electron 壳上报地址与退出。
// 与 DSH 的 apps/desktop-host 一致：宿主是独立进程，壳只负责窗口与生命周期。
import { inspect } from "node:util";
import { startHostServer, type HostServer } from "@lfaa/web-server";

/** 壳发来的控制消息：目前只有优雅退出。 */
interface ShutdownMessage {
  readonly type: "shutdown";
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
});
process.once("disconnect", () => {
  void stop();
});

async function main(): Promise<void> {
  const webRoot = process.argv[2];
  const projectRoot = process.argv[3];
  if (!webRoot || !projectRoot) throw new Error("缺少 webRoot / projectRoot 参数。");
  server = await startHostServer({ webRoot, projectRoot });
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