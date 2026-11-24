// 验证资料库共享状态：选中项去重通知与清空、素材列表读取去重、删除同步移除与失败状态。
import assert from "node:assert/strict";
import test from "node:test";
import { LibraryMediaStore, LibrarySelectionStore } from "../client/library/library-store";

test("选中存储只在目标变化时通知订阅者，清空后回到 null", () => {
  const store = new LibrarySelectionStore();
  let calls = 0;
  const off = store.subscribe(() => { calls += 1; });

  store.set({ kind: "asset", id: "a1", title: "报告" });
  assert.equal(calls, 1);
  store.set({ kind: "asset", id: "a1", title: "报告（重命名）" });
  assert.equal(calls, 1);
  store.set({ kind: "asset", id: "a2", title: "报告" });
  assert.equal(calls, 2);

  store.clear();
  assert.equal(store.getSnapshot(), null);
  assert.equal(calls, 3);
  store.clear();
  assert.equal(calls, 3);

  off();
  store.set({ kind: "asset", id: "a3", title: "报告" });
  assert.equal(calls, 3);
});

test("素材存储读取列表并复用并发请求，删除后同步移除", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  const items = [
    { path: "C:\\ws\\.lfaa-media\\images\\a.png", name: "a.png", kind: "image" as const, bytes: 10, createdAt: 1 },
  ];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(`${init?.method ?? "GET"} ${String(input)}`);
    if ((init?.method ?? "GET") === "DELETE") return new Response(JSON.stringify({ deleted: true }), { status: 200 });
    return new Response(JSON.stringify({ items }), { status: 200 });
  }) as typeof fetch;

  try {
    const store = new LibraryMediaStore();
    await Promise.all([store.reload(), store.reload()]);
    assert.equal(calls.filter((entry) => entry.startsWith("GET")).length, 1);
    assert.equal(store.getSnapshot().items.length, 1);
    assert.equal(store.getSnapshot().loading, false);

    assert.equal(await store.remove(items[0]!.path), true);
    assert.equal(store.getSnapshot().items.length, 0);
    assert.equal(calls.filter((entry) => entry.startsWith("DELETE")).length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("素材存储读取失败时保留可读错误类型，删除失败不误删列表", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("nope", { status: 500 })) as typeof fetch;
  try {
    const store = new LibraryMediaStore();
    await store.reload();
    assert.equal(store.getSnapshot().error, "load");
    assert.equal(store.getSnapshot().loading, false);
    assert.equal(await store.remove("C:\\ws\\a.png"), false);
    assert.equal(store.getSnapshot().error, "delete");
  } finally {
    globalThis.fetch = originalFetch;
  }
});