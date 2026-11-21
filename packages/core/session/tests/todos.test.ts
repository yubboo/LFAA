// 验证会话记录持久化任务清单：写入后能读回、分叉会复制、非法条目被丢弃。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { SessionMemoryStore, normalizeTodoList } from "../src/index";

async function withStore<T>(run: (store: SessionMemoryStore, dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-session-todos-"));
  try {
    return await run(new SessionMemoryStore(dir), dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test("清单随会话落盘，换一个 store 实例仍能读回", async () => {
  await withStore(async (store, dir) => {
    const session = await store.create({ title: "清单会话" });
    await store.update(session.id, {
      todos: [
        { id: "1", content: "读源码", status: "in_progress" },
        { id: "2", content: "写测试", status: "pending" },
      ],
    });

    const reloaded = await new SessionMemoryStore(dir).get(session.id);
    assert.equal(reloaded?.todos?.length, 2);
    assert.equal(reloaded?.todos?.[0]?.status, "in_progress");
  });
});

test("分叉会话复制当前清单，之后互不影响", async () => {
  await withStore(async (store) => {
    const session = await store.create({ title: "原会话" });
    await store.update(session.id, { todos: [{ id: "1", content: "只做这一条", status: "pending" }] });

    const forked = await store.fork(session.id);
    assert.equal(forked?.todos?.length, 1);

    await store.update(session.id, { todos: [] });
    const original = await store.get(session.id);
    const copy = await store.get(forked!.id);
    assert.deepEqual(original?.todos, []);
    assert.equal(copy?.todos?.[0]?.content, "只做这一条");
  });
});

test("读取时丢弃非法条目：空内容、重复内容、未知状态归为 pending", () => {
  assert.equal(normalizeTodoList("not-array"), undefined);
  assert.deepEqual(
    normalizeTodoList([
      { id: "a", content: " 有效 ", status: "completed" },
      { id: "b", content: "   ", status: "pending" },
      { id: "c", content: "有效", status: "pending" },
      { content: "状态未知", status: "doing" },
    ]),
    [
      { id: "a", content: "有效", status: "completed" },
      { id: "状态未知", content: "状态未知", status: "pending" },
    ],
  );
});