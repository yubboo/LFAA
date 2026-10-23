/** 功能：把桌面控制端启动时的已知进程错误转成用户可操作的提示。作用：保留单写者锁，不删除其他进程的数据锁。关联文件：main.mjs、tests/control-plane-startup-error.test.mjs。 */
const DATA_LOCK_CONFLICT = "此数据目录已由另一个控制端使用";

export function getControlPlaneStartupError(stderr) {
  const diagnostic = String(stderr ?? "").slice(0, 4096);
  if (diagnostic.includes(DATA_LOCK_CONFLICT)) {
    return "LFAA 数据目录正在由另一个控制端使用。请先正常关闭正在使用该目录的 LFAA 桌面端、Web 或 CLI 服务，再重新启动。为保护数据，本次没有删除数据锁。";
  }
  return "本机控制端意外退出；请查看桌面日志。 ";
}
