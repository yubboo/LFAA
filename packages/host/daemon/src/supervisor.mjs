/**
 * 功能：托管 Web 启动器的本地节点进程。
 * 作用：启动现有 daemon 组合，子进程异常时报告和有限重启；正常退出表示已有节点可复用。
 * 关联文件：apps/cli/bin/lfaa.mjs、boot/app-boot/src/index.ts、daemon.mjs。
 */
import { spawn } from "node:child_process";
export function superviseLocalDaemon({ executable = process.execPath, args, cwd, env = process.env, onMessage = message => process.stderr.write(`${message}\n`) }) {
  let child, stopping = false, attempts = 0, timer;
  const start = () => {
    child = spawn(executable, args, { cwd, env, windowsHide: true, stdio: ["ignore", "inherit", "inherit", "ipc"] });
    child.once("error", error => onMessage(`本地节点启动失败：${error.message}`));
    child.once("exit", code => {
      if (stopping || code === 0) return;
      // 不重新派发业务动作。异常重启后由原有租约和实际进程检查决定未知状态。
      if (++attempts > 3) { onMessage("本地节点连续启动失败，已停止重启；请检查节点日志。"); return; }
      onMessage(`本地节点异常退出（${code ?? "信号"}），准备重新连接。`);
      timer = setTimeout(start, 1000 * attempts);
    });
  };
  start();
  return { stop: async () => {
    stopping = true; clearTimeout(timer);
    if (!child || !child.pid || child.exitCode !== null || child.signalCode !== null) return;
    const finished = new Promise(resolveExit => child.once("exit", resolveExit));
    // IPC 请求走 Cordis 卸载，使 Daemon 有机会安全停止实例，而非直接杀掉持久进程。
    if (child.connected) child.send({ type: "lfaa-shutdown" }); else child.kill();
    await finished;
  } };
}
