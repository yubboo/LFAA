// 验证窗口化的纯计算与阈值分支：短会话不启用、长会话启用、估算取均值、按会话挑高度。
import assert from "node:assert/strict";
import test from "node:test";
import {
  pickSessionSizes,
  resolveRowEstimate,
  shouldVirtualizeThread,
  THREAD_ESTIMATE_FALLBACK_PX,
  THREAD_WINDOW_THRESHOLD,
} from "../client/conversation/thread-window";

test("短会话不窗口化，超过阈值且开关打开才启用", () => {
  assert.equal(shouldVirtualizeThread(THREAD_WINDOW_THRESHOLD, true), false, "等于阈值仍走全量渲染");
  assert.equal(shouldVirtualizeThread(THREAD_WINDOW_THRESHOLD + 1, true), true);
  assert.equal(shouldVirtualizeThread(500, false), false, "偏好关闭时一律全量渲染");
  assert.equal(shouldVirtualizeThread(0, true), false);
});

test("行高估算取已测高度均值，没有测量值时用兜底值", () => {
  assert.equal(resolveRowEstimate([]), THREAD_ESTIMATE_FALLBACK_PX);
  assert.equal(resolveRowEstimate([400, 600]), 500);
  assert.equal(resolveRowEstimate([100, 101]), 101, "均值四舍五入");
  assert.equal(resolveRowEstimate([0]), THREAD_ESTIMATE_FALLBACK_PX, "异常高度不参与估算");
});

test("只挑当前会话消息的高度的，避免跨会话串用", () => {
  const sizes = new Map<string, number>([
    ["m1", 300],
    ["m2", 500],
    ["other-session-message", 9000],
    ["m3", 0],
  ]);
  const ids = new Set(["m1", "m2", "m3"]);
  assert.deepEqual(pickSessionSizes(sizes, ids), [300, 500]);
  assert.deepEqual(pickSessionSizes(new Map(), ids), []);
});