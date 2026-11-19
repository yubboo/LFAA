// 验证会话存储的创建、追加消息、读取与列表摘要。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { SessionMemoryStore } from "../src";

test("会话可创建、追加消息并按摘要列出", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-session-"));
  try {
    const store = new SessionMemoryStore(root);
    const session = await store.create({ title: "会话测试" });
    await store.appendMessage(session.id, {
      id: "m1",
      role: "user",
      content: "你好",
      createdAt: Date.now(),
    });
    const record = await store.get(session.id);
    assert.equal(record?.messages.length, 1);
    assert.equal(record?.messageCount, 1);
    const list = await store.list();
    assert.equal(list[0]?.id, session.id);
    assert.equal(list[0]?.messageCount, 1);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
