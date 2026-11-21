// 验证排队消息纯操作：新增去空、删除、编辑（空文本删除）、上下移动与队首取出。
import assert from "node:assert/strict";
import test from "node:test";
import {
  enqueueMessage,
  moveQueuedAt,
  removeQueuedAt,
  takeQueuedHead,
  updateQueuedAt,
  type QueuedMessage,
} from "../client/chat-queue";

function queue(...texts: string[]): QueuedMessage[] {
  return texts.map((text, idx) => ({ id: `q-${idx}`, text }));
}

test("新增排队消息会去空并保留顺序", () => {
  const base = enqueueMessage([], "  第一条  ");
  assert.equal(base.length, 1);
  assert.equal(base[0]?.text, "第一条");
  assert.equal(enqueueMessage(base, "   ").length, 1);
  const two = enqueueMessage(base, "第二条");
  assert.deepEqual(two.map((item) => item.text), ["第一条", "第二条"]);
  assert.ok(two[0]?.id && two[1]?.id && two[0].id !== two[1].id);
});

test("删除与编辑：空文本等价删除", () => {
  const base = queue("a", "b", "c");
  assert.deepEqual(removeQueuedAt(base, 1).map((item) => item.text), ["a", "c"]);
  assert.deepEqual(updateQueuedAt(base, 1, " B ").map((item) => item.text), ["a", "B", "c"]);
  assert.deepEqual(updateQueuedAt(base, 1, "   ").map((item) => item.text), ["a", "c"]);
  assert.equal(removeQueuedAt(base, 99).length, 3);
});

test("上下移动与越界保护", () => {
  const base = queue("a", "b", "c");
  assert.deepEqual(moveQueuedAt(base, 1, -1).map((item) => item.text), ["b", "a", "c"]);
  assert.deepEqual(moveQueuedAt(base, 1, 1).map((item) => item.text), ["a", "c", "b"]);
  assert.deepEqual(moveQueuedAt(base, 0, -1).map((item) => item.text), ["a", "b", "c"]);
  assert.deepEqual(moveQueuedAt(base, 2, 1).map((item) => item.text), ["a", "b", "c"]);
});

test("取出队首返回剩余队列", () => {
  const base = queue("a", "b");
  const { head, rest } = takeQueuedHead(base);
  assert.equal(head?.text, "a");
  assert.deepEqual(rest.map((item) => item.text), ["b"]);
  assert.deepEqual(takeQueuedHead([]), { head: undefined, rest: [] });
});