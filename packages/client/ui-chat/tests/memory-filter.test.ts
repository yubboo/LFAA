// 验证记忆库筛选纯函数：类型过滤、关键词匹配正文与标签、更新时间倒序。
import assert from "node:assert/strict";
import test from "node:test";
import type { LongTermMemoryItem } from "../client/store/chat-types";
import { filterMemories, formatMemoryTime } from "../client/settings/memory-view";

function memory(partial: Partial<LongTermMemoryItem> & { id: string; content: string }): LongTermMemoryItem {
  return {
    kind: "fact",
    scope: "global",
    projectId: null,
    tags: [],
    confidence: 0.7,
    hits: 0,
    lastUsedAt: 0,
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  };
}

const items: LongTermMemoryItem[] = [
  memory({ id: "a", content: "统一使用 pnpm 管理依赖", kind: "convention", tags: ["包管理"], updatedAt: 100 }),
  memory({ id: "b", content: "记忆存储改用 JSON 文件", kind: "decision", tags: ["记忆"], updatedAt: 300 }),
  memory({ id: "c", content: "子智能体不能递归派发", kind: "pitfall", tags: ["子智能体"], updatedAt: 200 }),
];

test("按类型筛选只保留对应 kind", () => {
  assert.deepEqual(filterMemories(items, { query: "", kind: "decision" }).map((item) => item.id), ["b"]);
  assert.deepEqual(filterMemories(items, { query: "", kind: "all" }).map((item) => item.id), ["b", "c", "a"]);
});

test("关键词同时匹配正文与标签，忽略大小写", () => {
  assert.deepEqual(filterMemories(items, { query: "PNPM", kind: "all" }).map((item) => item.id), ["a"]);
  assert.deepEqual(filterMemories(items, { query: "子智能体", kind: "all" }).map((item) => item.id), ["c"]);
  assert.deepEqual(filterMemories(items, { query: "不存在的词", kind: "all" }), []);
});

test("组合筛选：先按类型再按关键词", () => {
  assert.deepEqual(filterMemories(items, { query: "记忆", kind: "pitfall" }), []);
  assert.deepEqual(filterMemories(items, { query: "记忆", kind: "decision" }).map((item) => item.id), ["b"]);
});

test("结果按更新时间倒序且不修改入参", () => {
  const before = items.map((item) => item.id);
  const filtered = filterMemories(items, { query: "", kind: "all" });
  assert.deepEqual(filtered.map((item) => item.id), ["b", "c", "a"]);
  assert.deepEqual(items.map((item) => item.id), before);
});

test("时间格式化对无效值返回空串", () => {
  assert.equal(formatMemoryTime(0, true), "");
  assert.equal(formatMemoryTime(Number.NaN, false), "");
  assert.ok(formatMemoryTime(Date.now(), true).length > 0);
});