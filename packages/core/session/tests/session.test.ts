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

test("会话预设随持久化与分叉保留，旧会话保持缺省", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-session-preset-"));
  try {
    const store = new SessionMemoryStore(root);
    const selected = await store.create({ sessionPreset: "standard", sessionModules: ["@lfaa/tools"] });
    const old = await store.create();
    assert.equal((await store.get(selected.id))?.sessionPreset, "standard");
    assert.equal((await store.fork(selected.id))?.sessionPreset, "standard");
    assert.equal((await store.get(old.id))?.sessionPreset, undefined);
    await store.update(selected.id, { sessionPreset: "minimal", sessionModules: ["@lfaa/tools", "@lfaa/rules"] });
    await store.appendMessage(selected.id, { id: "first", role: "user", content: "测试", createdAt: Date.now() });
    await assert.rejects(() => store.update(selected.id, { sessionPreset: "standard" }));
    const reopened = await new SessionMemoryStore(root).get(selected.id);
    assert.equal(reopened?.sessionPreset, "minimal");
    assert.deepEqual(reopened?.sessionModules, ["@lfaa/tools", "@lfaa/rules"]);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("会话重新读取后仍保留用户消息的图片附件引用", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-session-attachment-"));
  try {
    const store = new SessionMemoryStore(root);
    const session = await store.create();
    await store.appendMessage(session.id, {
      id: "image-request",
      role: "user",
      content: "美化一下图片",
      attachments: [{ id: "uploaded-image", kind: "image" }],
      createdAt: Date.now(),
    });

    const reopened = await new SessionMemoryStore(root).get(session.id);
    assert.deepEqual(reopened?.messages[0]?.attachments, [{ id: "uploaded-image", kind: "image" }]);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("待回答澄清随摘要持久化，回答后清除且残缺字段被忽略", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-session-question-"));
  try {
    const store = new SessionMemoryStore(root);
    const session = await store.create();
    const pendingQuestion = { messageId: "assistant-1", question: "选哪个？", options: ["A", "B"] };
    await store.update(session.id, { unread: true, pendingQuestion });

    const reopened = new SessionMemoryStore(root);
    assert.deepEqual((await reopened.get(session.id))?.pendingQuestion, pendingQuestion);
    assert.deepEqual((await reopened.list())[0]?.pendingQuestion, pendingQuestion);

    await reopened.update(session.id, { pendingQuestion: null });
    assert.equal((await reopened.get(session.id))?.pendingQuestion, undefined);
    assert.equal((await reopened.list())[0]?.pendingQuestion, undefined);

    await fs.writeFile(path.join(root, `${session.id}.json`), JSON.stringify({
      ...(await reopened.get(session.id)),
      pendingQuestion: { messageId: "", question: "残缺" },
    }), "utf8");
    assert.equal((await reopened.get(session.id))?.pendingQuestion, undefined);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
