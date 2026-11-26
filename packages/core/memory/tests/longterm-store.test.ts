// 验证长期记忆存储：并发写入不丢条目、旧格式兼容、去重、冲突替代、上限归档与命中回写。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { LongTermMemoryStore, normalizeMemoryEntry, resolveArchivePath } from "../src/longterm-store";

async function withStore<T>(run: (store: LongTermMemoryStore, dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-longterm-"));
  try {
    return await run(new LongTermMemoryStore(path.join(dir, "long-term-memory.json")), dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test("并发写入 50 条记忆全部落盘，不出现丢写", async () => {
  await withStore(async (store, dir) => {
    await Promise.all(
      Array.from({ length: 50 }, (_, index) => store.add({ content: `并发写入的记忆条目 ${index}` })),
    );
    const entries = await store.list();
    assert.equal(entries.length, 50);
    const raw: unknown = JSON.parse(await fs.readFile(path.join(dir, "long-term-memory.json"), "utf8"));
    assert.ok(Array.isArray(raw));
    assert.equal(raw.length, 50);
  });
});

test("多个存储实例共享同一文件时按 mtime 重载，不互相覆盖", async () => {
  await withStore(async (store, dir) => {
    const filePath = path.join(dir, "long-term-memory.json");
    await store.add({ content: "实例甲写入的记忆内容" });
    const second = new LongTermMemoryStore(filePath);
    await second.add({ content: "实例乙补充的记忆内容" });
    const entries = await store.list();
    assert.equal(entries.length, 2);
  });
});

test("相同内容只保留一条，标签合并", async () => {
  await withStore(async (store) => {
    await store.add({ content: "统一使用 pnpm 安装依赖", tags: ["规范"] });
    await store.add({ content: "统一使用 pnpm 安装依赖。", tags: ["依赖"] });
    const entries = await store.list();
    assert.equal(entries.length, 1);
    assert.deepEqual([...entries[0]!.tags].sort(), ["依赖", "规范"]);
  });
});

test("同结论改写：新条目替代旧条目，旧条目不再召回", async () => {
  await withStore(async (store) => {
    const old = await store.add({ kind: "decision", content: "长期记忆使用 JSON 文件存储" });
    const fresh = await store.add({ kind: "decision", content: "长期记忆改用 SQLite 文件存储" });
    const all = await store.list({ includeSuperseded: true });
    assert.equal(all.length, 2);
    const oldEntry = all.find((item) => item.id === old.id);
    assert.equal(oldEntry?.supersededBy, fresh.id);
    assert.equal(all.find((item) => item.id === fresh.id)?.supersedes, old.id);
    assert.equal((await store.list()).length, 1);
    const recalled = await store.recall({ query: "长期记忆 存储" });
    assert.ok(recalled.every((item) => item.id !== old.id));
  });
});

test("超过上限时归档最弱条目，只归档不删除", async () => {
  await withStore(async (store, dir) => {
    store.setMaxEntries(3);
    for (let index = 0; index < 6; index += 1) {
      await store.add({ content: `上限测试记忆 ${index}`, scope: "global", confidence: 0.3 });
    }
    const entries = await store.list();
    assert.equal(entries.length, 3);
    const archived: unknown = JSON.parse(await fs.readFile(resolveArchivePath(path.join(dir, "long-term-memory.json")), "utf8"));
    assert.ok(Array.isArray(archived));
    assert.equal(archived.length, 3);
    const stats = await store.stats();
    assert.equal(stats.active, 3);
    assert.equal(stats.archived, 3);
  });
});

test("旧格式条目读取时补齐新字段", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-longterm-legacy-"));
  const filePath = path.join(dir, "long-term-memory.json");
  try {
    await fs.writeFile(filePath, JSON.stringify([
      {
        id: "legacy-1",
        scope: "project",
        projectId: "proj-1",
        content: "旧版记忆条目",
        tags: ["旧"],
        createdAt: 1,
        updatedAt: 2,
      },
    ]), "utf8");
    const store = new LongTermMemoryStore(filePath);
    const entries = await store.list();
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.kind, "fact");
    assert.equal(entries[0]?.confidence, 0.6);
    assert.equal(entries[0]?.hits, 0);
    assert.equal(entries[0]?.ownerId, null);
    assert.equal(normalizeMemoryEntry(null), null);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("召回会回写命中次数与最近使用时间", async () => {
  await withStore(async (store) => {
    const saved = await store.add({ content: "召回统计需要记录命中次数" });
    const recalled = await store.recall({ query: "命中次数" });
    assert.equal(recalled.length, 1);
    const entries = await store.list();
    assert.equal(entries[0]?.hits, 1);
    assert.ok((entries[0]?.lastUsedAt ?? 0) >= saved.lastUsedAt);
  });
});

test("删除与编辑只影响目标条目", async () => {
  await withStore(async (store) => {
    const first = await store.add({ content: "待删除的记忆条目" });
    const second = await store.add({ content: "需要保留的记忆条目" });
    assert.equal(await store.remove(first.id), true);
    assert.equal(await store.remove(first.id), false);
    const updated = await store.updateEntry(second.id, { content: "已编辑的记忆条目", kind: "convention" });
    assert.equal(updated?.content, "已编辑的记忆条目");
    assert.equal(updated?.kind, "convention");
    assert.equal((await store.list()).length, 1);
  });
});
test("run 作用域只对同一次运行可见，归档后收敛为团队记忆", async () => {
  await withStore(async (store) => {
    await store.add({ scope: "run", ownerId: "run-1", content: "运行期结论：召回策略使用 BM25 打分", tags: ["crew"] });
    await store.add({ scope: "run", ownerId: "run-1", content: "运行期结论：子智能体只读执行并隔离历史", tags: ["crew"] });
    assert.equal((await store.list()).some((item) => item.scope === "run"), false);
    assert.equal((await store.list({ runId: "run-1" })).length, 2);
    assert.equal((await store.recall({ query: "运行期结论" })).some((item) => item.scope === "run"), false);
    assert.equal((await store.recall({ query: "运行期结论", runId: "run-1" })).length >= 1, true);

    const archived = await store.archiveRunMemories("run-1", "session-1");
    assert.equal(archived, 2);
    const remaining = await store.list();
    assert.equal(remaining.some((item) => item.scope === "run"), false);
    const team = remaining.find((item) => item.scope === "team");
    assert.equal(team?.ownerId, "session-1");
    assert.match(team?.content ?? "", /任务流水线/u);
  });
});