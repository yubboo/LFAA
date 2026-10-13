/** 功能：运行目标节点的交互式终端通道。作用：同源认证 SSE 收命令、顺序回报有界输出与应答，断线或卸载关闭全部原生 PTY。关联文件：daemon.mjs、api/terminal-controller、subprocess-local/src/pty.ts。 */
import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { LocalSubprocessRuntime } from "lfaa-subprocess-local/src/spawn.js";
import { terminalEnvironment } from "lfaa-subprocess-local/src/pty.js";
import { resolveTerminalShell } from "lfaa-terminal-bash/src/index.js";

export { terminalEnvironment };
export function startTerminalChannel({ apiBase, nodeId, readToken, signal, onError = () => {} }) {
  const runtime = new LocalSubprocessRuntime();
  const done = (async () => {
    let lastError = "";
    while (!signal.aborted) {
      try { await connect(); lastError = ""; }
      catch (error) {
        if (signal.aborted) break;
        const message = error instanceof Error ? error.message : "终端连接失败。";
        if (message !== lastError) { onError(message); lastError = message; }
      }
      await delay(3000, undefined, { signal }).catch(() => {});
    }
  })();
  return { done };

  async function connect() {
    const channelId = randomUUID(), controller = new AbortController(), connectionSignal = AbortSignal.any([signal, controller.signal]);
    const sessions = new Map(), drains = new Set();
    let queue = [], queuedBytes = 0, sending, watchdog;
    const abort = () => controller.abort();
    const touch = () => { clearTimeout(watchdog); watchdog = setTimeout(abort, 35_000); watchdog.unref(); };
    const send = event => {
      if (connectionSignal.aborted) return;
      queuedBytes += JSON.stringify(event).length * 2;
      if (queuedBytes > 1024 * 1024) { abort(); return; }
      queue.push(event);
      if (!sending) sending = Promise.resolve().then(flush).catch(abort).finally(() => { sending = undefined; });
    };
    async function flush() {
      while (queue.length && !connectionSignal.aborted) {
        const events = queue.splice(0, 16);
        queuedBytes -= events.reduce((size, event) => size + JSON.stringify(event).length * 2, 0);
        const response = await fetch(`${apiBase}/daemon/terminals/events`, {
          method: "POST", redirect: "error", signal: AbortSignal.any([connectionSignal, AbortSignal.timeout(15_000)]),
          headers: { authorization: `Bearer ${await readToken()}`, "content-type": "application/json" }, body: JSON.stringify({ nodeId, channelId, events })
        });
        if (!response.ok) { await response.body?.cancel(); throw new Error(`终端回报失败（${response.status}）。`); }
        await response.body?.cancel();
      }
    }
    async function execute(command) {
      const { id, type, commandId } = command;
      try {
        if (typeof id !== "string" || !/^[0-9a-f-]{36}$/iu.test(id) || typeof commandId !== "string") throw new Error("终端命令身份无效。");
        if (type === "create") {
          if (sessions.has(id) || sessions.size >= 8) throw new Error("节点终端数量已达上限或标识重复。");
          if (typeof command.cwd !== "string" || !isAbsolute(command.cwd) || !(await stat(command.cwd)).isDirectory()) throw new Error("终端起始目录不存在。");
          const launch = await resolveTerminalShell(command.shell);
          connectionSignal.throwIfAborted();
          const handle = await runtime.spawnTerminal({ target: { kind: "local" }, platform: process.platform, executable: launch.executable, args: launch.args, cwd: command.cwd,
            env: terminalEnvironment(), columns: command.cols, rows: command.rows, maxQueuedOutputBytes: 1024 * 1024, terminationGraceMs: 1000, signal: connectionSignal });
          sessions.set(id, handle);
          const drain = (async () => {
            for await (const chunk of handle.output) {
              const text = Buffer.from(chunk.bytes).toString("utf8");
              for (let index = 0; index < text.length;) {
                let end = Math.min(index + 8192, text.length);
                if (end < text.length && /[\uD800-\uDBFF]/u.test(text[end - 1])) end--;
                send({ type: "output", id, data: text.slice(index, end) }); index = end;
              }
            }
            const outcome = await handle.done;
            sessions.delete(id);
            send({ type: "exit", id, exitCode: outcome.exitCode, ...(outcome.outputTruncated ? { message: "输出超过容量，会话已停止。" } : {}) });
          })();
          drains.add(drain); void drain.catch(abort).finally(() => drains.delete(drain));
        } else if (type === "close") {
          await sessions.get(id)?.terminate(); sessions.delete(id);
        } else {
          const handle = sessions.get(id);
          if (!handle) throw new Error("终端已经退出。");
          if (type === "input" && typeof command.data === "string" && command.data.length > 0 && command.data.length <= 16 * 1024) await handle.writeStdin(Buffer.from(command.data, "utf8"));
          else if (type === "resize") await handle.resize(command.cols, command.rows);
          else throw new Error("终端命令无效。");
        }
        send({ type: "ack", commandId, ok: true });
      } catch (error) { send({ type: "ack", commandId, ok: false, message: (error instanceof Error ? error.message : "终端操作失败。").slice(0, 500) }); }
    }
    try {
      touch();
      const response = await fetch(`${apiBase}/daemon/terminals/connect`, {
        method: "POST", redirect: "error", signal: connectionSignal, headers: { authorization: `Bearer ${await readToken()}`, "content-type": "application/json" }, body: JSON.stringify({ nodeId, channelId })
      });
      if (!response.ok || !response.body) { await response.body?.cancel(); throw new Error(`终端通道不可用（${response.status}），请确认控制端版本。`); }
      let buffer = ""; const decoder = new TextDecoder();
      for await (const bytes of response.body) {
        touch(); buffer += decoder.decode(bytes, { stream: true });
        if (buffer.length > 128 * 1024) throw new Error("终端命令帧超过上限。");
        let boundary;
        while ((boundary = buffer.indexOf("\n\n")) >= 0) {
          const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
          if (!frame.startsWith("event: command\n")) continue;
          const data = frame.split("\n").find(line => line.startsWith("data: "));
          if (data) await execute(JSON.parse(data.slice(6)));
        }
      }
    } finally {
      clearTimeout(watchdog); abort(); queue = []; queuedBytes = 0;
      await Promise.allSettled([...sessions.values()].map(handle => handle.terminate()));
      await Promise.allSettled(drains);
      await sending;
    }
  }
}
