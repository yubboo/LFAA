/** 功能：在线程内持有原生 PTY。作用：不继承开发加载器与宿主环境，真实 ConPTY 输入、缩放和退出传给唯一适配器。关联文件：pty.ts。 */
import { parentPort, workerData } from "node:worker_threads";
try {
  const { spawn } = await import(workerData.moduleUrl);
  const pty = spawn(workerData.executable, workerData.args, { cwd: workerData.cwd, env: workerData.env, cols: workerData.cols, rows: workerData.rows, name: "xterm-256color", useConpty: true, useConptyDll: process.platform === "win32" });
  // 父线程确认后再恢复读取，把线程消息中的未处理输出限制在 128 KiB 加一个原生数据块。
  let outstandingBytes = 0, paused = false;
  pty.onData(data => {
    outstandingBytes += Buffer.byteLength(data);
    if (outstandingBytes >= 128 * 1024 && !paused) { pty.pause(); paused = true; }
    parentPort.postMessage({ type: "output", data });
  });
  pty.onExit(({ exitCode, signal }) => parentPort.postMessage({ type: "exit", exitCode, signal }));
  parentPort.on("message", message => {
    try {
      if (message.type === "output-consumed") {
        outstandingBytes = Math.max(0, outstandingBytes - message.bytes);
        if (paused && outstandingBytes < 64 * 1024) { paused = false; pty.resume(); }
        return;
      }
      if (message.type === "kill") { pty.resume(); pty.kill(); return; }
      if (message.type === "input") pty.write(message.data);
      else if (message.type === "resize") pty.resize(message.columns, message.rows);
      else throw new Error("无效的 PTY 指令。");
      parentPort.postMessage({ type: "ack", id: message.id });
    } catch (error) { parentPort.postMessage({ type: "ack", id: message.id, error: error.message }); }
  });
  parentPort.postMessage({ type: "ready", pid: pty.pid });
} catch (error) { parentPort.postMessage({ type: "error", message: error.message }); }
