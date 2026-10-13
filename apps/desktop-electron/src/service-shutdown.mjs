/**
 * 功能：请求桌面托管的 Node 服务经 IPC 安全退出。
 * 作用：先监听退出，再发送既有 Harness 卸载请求；超时或异常退出不冒充安全关闭。
 * 关联文件：main.mjs、boot/app-boot/src/index.ts、tests/service-shutdown.test.mjs。
 */
export function requestServiceShutdown(child, timeoutMilliseconds) {
  if (!child) return Promise.resolve(true);
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(child.exitCode === 0);
  if (!child.connected) return Promise.resolve(false);
  return new Promise(resolveShutdown => {
    let settled = false;
    const finish = successful => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.off("exit", onExit);
      child.off("error", onError);
      resolveShutdown(successful);
    };
    const onExit = code => finish(code === 0);
    const onError = () => finish(false);
    const timer = setTimeout(() => finish(false), timeoutMilliseconds);
    child.once("exit", onExit);
    child.once("error", onError);
    try { child.send({ type: "lfaa-shutdown" }, error => { if (error) finish(false); }); }
    catch { finish(false); }
  });
}
