/** 功能：确认受管游戏进程停机。作用：正常 stop 失败/超时后按现有策略终止，并再次确认退出，不能吞掉失败。关联文件：daemon.mjs、process-control.mjs。 */
export async function stopManagedProcess({ child, command, writeCommand, timeoutMilliseconds, waitForExit, terminate }) {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  let requested = false;
  try {
    if (writeCommand) await writeCommand(command);
    else await new Promise((resolveWrite, rejectWrite) => child.stdin.write(command, error => error ? rejectWrite(error) : resolveWrite()));
    requested = true;
  } catch { /* 输入通道不可用仍需结束本进程拥有的实例，不能直接报成功。 */ }
  if (requested && await waitForExit(child, timeoutMilliseconds)) return true;
  await terminate(child);
  if (!await waitForExit(child, 5_000)) throw new Error("受管实例进程尚未确认退出。");
  return false;
}
