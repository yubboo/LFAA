/** 功能：把公共 TerminalHandle 暴露给 Minecraft 生命周期 Owner 的既有进程合同。作用：复用同一个 ConPTY，不复制终端实现。关联文件：minecraft-provisioner.mjs、subprocess-local/src/pty.ts。 */
import { EventEmitter } from "node:events";
import { PassThrough, Writable } from "node:stream";

export function terminalHandleToChild(handle) {
  const child = new EventEmitter();
  child.pid = handle.pid;
  child.exitCode = null;
  child.signalCode = null;
  child.killed = false;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = new Writable({
    write(chunk, _encoding, callback) {
      void handle.writeStdin(Buffer.from(chunk)).then(() => callback(), callback);
    }
  });
  child.kill = () => {
    if (child.exitCode !== null || child.signalCode !== null) return false;
    child.killed = true;
    void handle.terminate();
    return true;
  };
  child.resizeTerminal = (columns, rows) => handle.resize(columns, rows);
  child.writeTerminalInput = data => handle.writeStdin(Buffer.from(data, "utf8"));

  void (async () => {
    try {
      for await (const chunk of handle.output) child.stdout.write(Buffer.from(chunk.bytes));
      const outcome = await handle.done;
      child.exitCode = outcome.exitCode;
      child.signalCode = outcome.signal;
      child.stdout.end();
      child.stderr.end();
      child.emit("exit", outcome.exitCode, outcome.signal);
      child.emit("close", outcome.exitCode, outcome.signal);
    } catch (error) {
      child.stdout.destroy(error);
      child.stderr.destroy(error);
      child.emit("error", error);
    }
  })();
  return child;
}
