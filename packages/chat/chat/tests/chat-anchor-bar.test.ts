// 验证轮次导航刻度滑动窗口：最多 20 根，以当前轮次居中并夹紧边界，保证所有轮次都能通过滚动/点击到达。
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) {
      return {
        format: "module",
        shortCircuit: true,
        source: "export default new Proxy({}, { get: (_, k) => String(k) });",
      };
    }
    return nextLoad(url, context);
  },
});

const { MAX_VISIBLE_TICKS, formatTickWindowLabel, selectVisibleTurnIndexes } = await import("../client/conversation/ChatAnchorBar");

test("轮次不超过上限时全部展示", () => {
  assert.deepEqual(selectVisibleTurnIndexes(0, 0), []);
  assert.deepEqual(selectVisibleTurnIndexes(5, 2), [0, 1, 2, 3, 4]);
  assert.deepEqual(selectVisibleTurnIndexes(MAX_VISIBLE_TICKS, 10), Array.from({ length: MAX_VISIBLE_TICKS }, (_, index) => index));
});

test("轮次很多时显示以当前轮次居中的连续 20 格窗口", () => {
  const indexes = selectVisibleTurnIndexes(120, 61);
  assert.equal(indexes.length, MAX_VISIBLE_TICKS);
  assert.deepEqual(indexes, Array.from({ length: MAX_VISIBLE_TICKS }, (_, index) => 52 + index));
  assert.ok(indexes.includes(61));
  assert.equal(new Set(indexes).size, indexes.length);
});

test("窗口在开头与结尾自动夹紧，当前轮次始终在列", () => {
  assert.deepEqual(selectVisibleTurnIndexes(120, 0), Array.from({ length: MAX_VISIBLE_TICKS }, (_, index) => index));
  assert.deepEqual(selectVisibleTurnIndexes(120, 119), Array.from({ length: MAX_VISIBLE_TICKS }, (_, index) => 100 + index));
  const nearEdge = selectVisibleTurnIndexes(120, 5);
  assert.equal(nearEdge[0], 0);
  assert.ok(nearEdge.includes(5));
  assert.equal(nearEdge.at(-1), MAX_VISIBLE_TICKS - 1);
});

test("窗口标签显示可见范围与总轮次，轮次少时不显示", () => {
  assert.equal(formatTickWindowLabel(selectVisibleTurnIndexes(49, 0), 49), "1–20 / 49 轮");
  assert.equal(formatTickWindowLabel(selectVisibleTurnIndexes(49, 29), 49), "21–40 / 49 轮");
  assert.equal(formatTickWindowLabel(selectVisibleTurnIndexes(49, 48), 49), "30–49 / 49 轮");
  assert.equal(formatTickWindowLabel(selectVisibleTurnIndexes(12, 3), 12), "");
});
