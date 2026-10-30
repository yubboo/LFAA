/** 功能：把公共 TerminalHandle 暴露给 Minecraft 生命周期 Owner 的既有进程合同。作用：复用同一个 ConPTY，不复制终端实现。关联文件：minecraft-provisioner.mjs、subprocess-local/src/pty.ts。 */
import { EventEmitter } from "node:events";
import { PassThrough, Writable } from "node:stream";

export function createTerminalOutputReplayBuffer(maximumBytes = 128 * 1024) {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1) throw new TypeError("终端输出回放缓冲区大小无效。");
  let chunks = [];
  let firstChunk = 0;
  let byteLength = 0;

  const trimFirstCodepoint = buffer => {
    let start = 0;
    while (start < buffer.length && (buffer[start] & 0xc0) === 0x80) start += 1;
    return start ? buffer.subarray(start) : buffer;
  };

  return {
    append(value) {
      const incoming = Buffer.from(String(value), "utf8");
      if (!incoming.length) return;
      if (incoming.length >= maximumBytes) {
        const tail = trimFirstCodepoint(incoming.subarray(incoming.length - maximumBytes));
        chunks = tail.length ? [tail] : [];
        firstChunk = 0;
        byteLength = tail.length;
        return;
      }
      chunks.push(incoming);
      byteLength += incoming.length;
      while (byteLength > maximumBytes && firstChunk < chunks.length) {
        const first = chunks[firstChunk];
        const excess = byteLength - maximumBytes;
        let removed = Math.min(first.length, excess);
        while (removed < first.length && (first[removed] & 0xc0) === 0x80) removed += 1;
        byteLength -= removed;
        if (removed === first.length) firstChunk += 1;
        else chunks[firstChunk] = first.subarray(removed);
      }
      if (firstChunk > 256 && firstChunk * 2 > chunks.length) {
        chunks = chunks.slice(firstChunk);
        firstChunk = 0;
      }
    },
    snapshot() { return Buffer.concat(chunks.slice(firstChunk), byteLength).toString("utf8"); },
    clear() { chunks = []; firstChunk = 0; byteLength = 0; }
  };
}

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
