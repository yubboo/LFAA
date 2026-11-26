// 验证记忆检索的纯函数：中文 bi-gram 分词、BM25 排序、作用域可见性、时间衰减与预算截断。
import assert from "node:assert/strict";
import test from "node:test";
import {
  contentKey,
  entryCost,
  isScopeVisible,
  rankMemories,
  recencyScore,
  selectWithinBudget,
  sharedTokenCount,
  textSimilarity,
  tokenize,
} from "../src/memory-ranking";
import type { MemoryEntry } from "../src/types";

const NOW = new Date("2026-11-26T00:00:00Z").getTime();

/** 构造一条结构完整的记忆，测试只关心与被测字段相关的部分。 */
function entry(partial: Partial<MemoryEntry> & { id: string; content: string }): MemoryEntry {
  return {
    kind: "fact",
    scope: "global",
    projectId: null,
    ownerId: null,
    tags: [],
    confidence: 0.7,
    hits: 0,
    lastUsedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...partial,
  };
}

test("分词同时覆盖中文 bi-gram 与英文词", () => {
  const tokens = tokenize("统一用 pnpm 管理 workspace");
  assert.ok(tokens.includes("统一"));
  assert.ok(tokens.includes("pnpm"));
  assert.ok(tokens.includes("workspace"));
  // 停用字不进入单字位置，但仍可能作为 bi-gram 的一部分出现
  assert.ok(tokens.every((token) => token.length >= 2));
});

test("内容归一化忽略大小写与标点", () => {
  assert.equal(contentKey("使用 Pnpm, 统一管理。"), contentKey("使用pnpm统一管理"));
});

test("相似度与共享词数反映改写后的重合程度", () => {
  const left = "长期记忆使用 JSON 文件存储";
  const right = "长期记忆改用 SQLite 文件存储";
  assert.ok(textSimilarity(left, right) > 0.3);
  assert.ok(sharedTokenCount(left, right) >= 3);
  assert.equal(textSimilarity(left, left), 1);
});

test("作用域可见性：项目按 projectId、团队按 sessionId 隔离", () => {
  const projectEntry = entry({ id: "a", content: "项目约定", scope: "project", projectId: "proj-1" });
  const teamEntry = entry({ id: "b", content: "团队结论", scope: "team", ownerId: "s-1" });
  assert.equal(isScopeVisible(projectEntry, { projectId: "proj-1" }), true);
  assert.equal(isScopeVisible(projectEntry, { projectId: "proj-2" }), false);
  assert.equal(isScopeVisible(teamEntry, { sessionId: "s-1" }), true);
  assert.equal(isScopeVisible(teamEntry, { sessionId: "s-2" }), false);
  assert.equal(isScopeVisible(entry({ id: "c", content: "全局" }), {}), true);
});

test("时间衰减以 30 天为半衰期", () => {
  const fresh = recencyScore({ lastUsedAt: NOW, createdAt: NOW }, NOW);
  assert.equal(fresh, 1);
  const monthOld = recencyScore({ lastUsedAt: NOW - 30 * 86_400_000, createdAt: NOW - 30 * 86_400_000 }, NOW);
  assert.ok(Math.abs(monthOld - 0.5) < 1e-6);
});

test("BM25 排序：词法命中优先于仅靠作用域加权的条目", () => {
  const entries = [
    entry({ id: "global-hit", content: "pnpm workspace 统一依赖管理", scope: "global" }),
    entry({ id: "project-miss", content: "项目配色使用深色主题", scope: "project", projectId: "proj-1" }),
  ];
  const ranked = rankMemories(entries, { query: "pnpm workspace", projectId: "proj-1", now: NOW });
  assert.equal(ranked[0]?.entry.id, "global-hit");
});

test("无词法命中时最多补两条项目/团队上下文，全局记忆不进入", () => {
  const entries = [
    entry({ id: "p1", content: "项目甲约定", scope: "project", projectId: "proj-1" }),
    entry({ id: "p2", content: "项目乙约定", scope: "project", projectId: "proj-1" }),
    entry({ id: "p3", content: "项目丙约定", scope: "project", projectId: "proj-1" }),
    entry({ id: "g1", content: "全局偏好", scope: "global" }),
  ];
  const ranked = rankMemories(entries, { query: "完全无关的查询词", projectId: "proj-1", now: NOW });
  assert.equal(ranked.length, 2);
  assert.ok(ranked.every((item) => item.entry.scope === "project"));
});

test("已被替代与已过期的记忆不参与召回", () => {
  const entries = [
    entry({ id: "old", content: "记忆方案使用 JSON", supersededBy: "new" }),
    entry({ id: "expired", content: "记忆方案使用 YAML", expiresAt: NOW - 1 }),
    entry({ id: "live", content: "记忆方案使用 JSON 文件" }),
  ];
  const ranked = rankMemories(entries, { query: "记忆方案 JSON", now: NOW });
  assert.deepEqual(ranked.map((item) => item.entry.id), ["live"]);
});

test("预算截断按字符上限生效，且至少保留一条", () => {
  const long = "x".repeat(200);
  const ranked = rankMemories([
    entry({ id: "a", content: `pnpm ${long}` }),
    entry({ id: "b", content: `pnpm ${long}` }),
  ], { query: "pnpm", now: NOW });
  assert.equal(selectWithinBudget(ranked, { limit: 5, budgetChars: 50 }).length, 1);
  assert.equal(selectWithinBudget(ranked, { limit: 1, budgetChars: 5000 }).length, 1);
  assert.ok(entryCost(ranked[0]!.entry) > 200);
});