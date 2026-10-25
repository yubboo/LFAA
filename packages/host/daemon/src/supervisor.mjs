/**
 * 功能：托管 Web 启动器的本地节点进程。
 * 作用：启动现有 daemon 组合，子进程异常时报告和有限重启；向控制端暴露真实状态与受控启停。
 * 关联文件：apps/cli/bin/lfaa.mjs、boot/app-boot/src/index.ts、daemon.mjs、host/tool-daemon。
 */
import { spawn } from "node:child_process";
export function superviseLocalDaemon({ executable = process.execPath, args, cwd, env = process.env, onMessage = message => process.stderr.write(`${message}\n`) } = {}) {
  let child, stopping = false, attempts = 0, timer, lastExit = null, startedAt = null;
  const running = () => Boolean(child && child.pid && child.exitCode === null && child.signalCode === null);
  const status = () => ({ managed: true, running: running(), pid: running() ? child.pid : null, attempts, startedAt, lastExit });
  const start = () => {
    if (running()) return;
    child = spawn(executable, args, { cwd, env, windowsHide: true, stdio: ["ignore", "inherit", "inherit", "ipc"] });
    startedAt = new Date().toISOString();
    child.once("error", error => onMessage(`本地节点启动失败：${error.message}`));
    child.once("exit", code => {
      lastExit = { code: code ?? null, at: new Date().toISOString() };
      if (stopping || code === 0) return;
      // 不重新派发业务动作。异常重启后由原有租约和实际进程检查决定未知状态。
      if (++attempts > 3) { onMessage("本地节点连续启动失败，已停止重启；请检查节点日志。"); return; }
      onMessage(`本地节点异常退出（${code ?? "信号"}），准备重新连接。`);
      timer = setTimeout(start, 1000 * attempts);
    });
  };
  const stop = async () => {
    stopping = true; clearTimeout(timer);
    if (!running()) return status();
    const finished = new Promise(resolveExit => child.once("exit", resolveExit));
    // IPC 请求走 Cordis 卸载，使 Daemon 有机会安全停止实例，而非直接杀掉持久进程。
    if (child.connected) child.send({ type: "lfaa-shutdown" }); else child.kill();
    await finished;
    return status();
  };
  start();
  return {
    status,
    /** 幂等启动：已在运行时直接返回真实状态，不重复派生进程。 */
    start: async () => { stopping = false; attempts = 0; start(); return status(); },
    stop,
    /** 先按受控退出停止，再重新启动；不重放任何业务动作。 */
    restart: async () => { await stop(); stopping = false; attempts = 0; start(); return status(); }
  };
}
