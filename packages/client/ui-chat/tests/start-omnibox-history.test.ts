// 右工作台启动页地址栏历史记录纯函数单测：归一化、合并去重、匹配排序与行内补全。
import assert from "node:assert/strict";
import test from "node:test";
import {
  extractFaviconOrigin,
  filterStartHistory,
  findInlineCompletion,
  formatDisplayUrl,
  mergeStartHistory,
  type StartHistoryEntry,
} from "../client/workbench/start-omnibox-history";

test("formatDisplayUrl 去掉协议、www 与末尾斜杠", () => {
  assert.equal(formatDisplayUrl("http://127.0.0.1:5173/"), "127.0.0.1:5173");
  assert.equal(formatDisplayUrl("https://www.npmjs.com/package/dsh-lfaa/"), "npmjs.com/package/dsh-lfaa");
  assert.equal(formatDisplayUrl("http://127.0.0.1:3000/work"), "127.0.0.1:3000/work");
});

test("extractFaviconOrigin 仅提取 http(s) 站点 origin", () => {
  assert.equal(extractFaviconOrigin("https://npmjs.com/package/dsh-lfaa"), "https://npmjs.com");
  assert.equal(extractFaviconOrigin("127.0.0.1:5173/work"), "http://127.0.0.1:5173");
  assert.equal(extractFaviconOrigin("about:blank"), null);
});

test("mergeStartHistory 合并服务端与本地记录并按时间倒序去重", () => {
  const server = [
    { id: "h1", url: "http://127.0.0.1:5173/", title: "LFAA 工作区", visitedAt: 200, byAgent: false },
    { id: "h2", url: "http://127.0.0.1:5173", title: "", visitedAt: 100, byAgent: false },
    { id: "h3", url: "about:blank", title: "新标签页", visitedAt: 999, byAgent: false },
  ];
  const local: StartHistoryEntry[] = [
    { key: "query:jdk", kind: "query", value: "jdk", displayUrl: "jdk", title: "", visitedAt: 150, serverIds: [] },
  ];
  const merged = mergeStartHistory(server, local);
  assert.equal(merged.length, 2);
  assert.equal(merged[0]?.displayUrl, "127.0.0.1:5173");
  assert.equal(merged[0]?.title, "LFAA 工作区");
  assert.deepEqual(merged[0]?.serverIds, ["h1", "h2"]);
  assert.equal(merged[1]?.kind, "query");
  assert.equal(merged[1]?.value, "jdk");
});

test("filterStartHistory 前缀命中优先于包含命中，findInlineCompletion 返回首条前缀补全", () => {
  const entries = mergeStartHistory([
    { id: "1", url: "http://127.0.0.1:3000/work", title: "127.0.0.1", visitedAt: 300, byAgent: false },
    { id: "2", url: "http://127.0.0.1:5173/work", title: "LFAA 工作区", visitedAt: 200, byAgent: false },
    { id: "3", url: "https://example.com/127.0-guide", title: "Guide", visitedAt: 400, byAgent: false },
  ], []);

  const hits = filterStartHistory(entries, "127.0");
  assert.equal(hits[0]?.displayUrl, "127.0.0.1:3000/work");
  assert.equal(hits[1]?.displayUrl, "127.0.0.1:5173/work");
  assert.equal(hits[2]?.displayUrl, "example.com/127.0-guide");

  assert.equal(findInlineCompletion(hits, "127.0"), "127.0.0.1:3000/work");
  assert.equal(findInlineCompletion(hits, "127.0.0.1:3000/work"), null);
  assert.equal(findInlineCompletion(hits, "guide "), null);
});
