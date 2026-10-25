/** 功能：验证 Agent PTY 工具的文本/Enter 映射、授权范围与 Run 租约。 */
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";

const { createTerminalTool } = await import("lfaa-tool-terminal");

test("终端 submit 在同一授权调用提交 Enter，并保留 Run 绑定与回收", async () => {
  const writes = [];
  let closed = 0;
  let dispose;
  const session = {
    id: randomUUID(),
    async write(value) { writes.push(value); },
    read() { return writes.join(""); },
    async close() { closed++; }
  };
  const terminal = createTerminalTool({
    async createSession() { return session; },
    getSession(id) { return id === session.id ? session : undefined; }
  });
  const userId = randomUUID();
  const context = {
    userId,
    userRole: "admin",
    agentRunId: randomUUID(),
    signal: new AbortController().signal,
    onRunDispose(callback) { dispose = callback; }
  };
  const created = await terminal.execute({ action: "create", workingDirectory: process.cwd(), shell: "system" }, context);

  await terminal.execute(terminal.parse({ action: "send", sessionId: created.sessionId, input: "raw" }), context);
  await terminal.execute(terminal.parse({ action: "send", sessionId: created.sessionId, input: "command", submit: true }), context);
  await terminal.execute(terminal.parse({ action: "send", sessionId: created.sessionId, input: "already\n", submit: true }), context);
  assert.deepEqual(writes, ["raw", "command\r", "already\n"]);
  assert.notEqual(
    terminal.approval({ action: "send", sessionId: created.sessionId, input: "same" }).scopeKey,
    terminal.approval({ action: "send", sessionId: created.sessionId, input: "same", submit: true }).scopeKey
  );
  assert.throws(() => terminal.parse({ action: "send", input: "invalid", submit: "yes" }), /submit 必须是布尔值/u);
  assert.throws(() => terminal.parse({ action: "read", submit: true }), /submit 只适用于 send/u);
  await assert.rejects(terminal.execute({ action: "read", sessionId: created.sessionId }, { ...context, userId: randomUUID() }), /当前账户/u);

  dispose();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(closed, 1);
});
