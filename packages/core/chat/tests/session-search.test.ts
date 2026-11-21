// 验证会话全文搜索：标题/正文命中、大小写不敏感、片段上下文、每会话上限与截断标记。
import assert from "node:assert/strict";
import test from "node:test";
import type { ChatMessageRecord, ChatSessionRecord } from "@lfaa/memory";
import { searchSessionRecords } from "../src/session-search";

function message(id: string, role: "user" | "assistant", content: string, createdAt: number): ChatMessageRecord {
  return { id, role, content, createdAt };
}

function session(id: string, title: string, messages: ChatMessageRecord[], updatedAt: number): ChatSessionRecord {
  return {
    id,
    title,
    projectId: null,
    sectionId: null,
    pinned: false,
    archived: false,
    messageCount: messages.length,
    createdAt: updatedAt - 1000,
    updatedAt,
    messages,
  };
}

test("标题与消息正文都能命中，大小写不敏感", () => {
  const records = [
    session("s1", "缓存设计讨论", [
      message("m1", "user", "请解释 HTTP 缓存的 304", 10),
      message("m2", "assistant", "304 表示资源未修改。", 20),
    ], 20),
    session("s2", "HTTP Cache 笔记", [message("m3", "user", "strong cache 是什么", 30)], 30),
  ];

  const title = searchSessionRecords(records, "缓存");
  assert.equal(title.results[0]?.match, "title");
  assert.equal(title.results[0]?.sessionId, "s1");

  const lower = searchSessionRecords(records, "cache");
  assert.deepEqual([...new Set(lower.results.map((item) => item.sessionId))], ["s2"]);
});

test("消息命中带上下文片段并指向具体消息", () => {
  const longText = `${"前文".repeat(30)}关键决策在这里${"后文".repeat(50)}`;
  const records = [session("s1", "普通会话", [message("m1", "assistant", longText, 10)], 10)];

  const { results } = searchSessionRecords(records, "关键决策");
  const hit = results.find((item) => item.messageId === "m1");
  assert.ok(hit);
  assert.equal(hit?.match, "message");
  assert.ok(hit?.snippet.includes("关键决策"));
  assert.ok(hit?.snippet.startsWith("…"));
  assert.ok(hit?.snippet.endsWith("…"));
});

test("每会话消息命中数量受限并标记截断", () => {
  const records = [session("s1", "多命中", [
    message("m1", "user", "缓存 A", 1),
    message("m2", "assistant", "缓存 B", 2),
    message("m3", "user", "缓存 C", 3),
    message("m4", "user", "缓存 D", 4),
  ], 10)];

  const { results, truncated } = searchSessionRecords(records, "缓存", { perSession: 2 });
  assert.equal(results.filter((item) => item.match === "message").length, 2);
  assert.equal(truncated, true);
});

test("空查询返回空结果，结果按会话更新时间倒序", () => {
  const records = [
    session("old", "旧会话 缓存", [], 10),
    session("new", "新会话 缓存", [], 20),
  ];
  assert.deepEqual(searchSessionRecords(records, "   ").results, []);
  assert.deepEqual(searchSessionRecords(records, "缓存").results.map((item) => item.sessionId), ["new", "old"]);
});