// 验证重复工具调用的阈值提醒、参数规范化与链重置。
import assert from "node:assert/strict";
import test from "node:test";
import { RepeatCallTracker, canonicalizeArguments } from "../src/repeat-call";

test("连续相同调用在 3/5/8 次提醒，参数键顺序不影响识别", () => {
  const tracker = new RepeatCallTracker();
  const reminders: number[] = [];
  for (let i = 1; i <= 8; i += 1) {
    const args = i % 2 === 0 ? '{"path":"a.ts","line":1}' : '{"line":1,"path":"a.ts"}';
    const observation = tracker.observe("read_file", args);
    if (observation.reminder) reminders.push(observation.count);
  }
  assert.deepEqual(reminders, [3, 5, 8]);
});

test("不同参数或不同工具会重置连续计数", () => {
  const tracker = new RepeatCallTracker();
  assert.equal(tracker.observe("read_file", '{"path":"a"}').count, 1);
  assert.equal(tracker.observe("read_file", '{"path":"a"}').count, 2);
  assert.equal(tracker.observe("read_file", '{"path":"b"}').count, 1);
  assert.equal(tracker.observe("grep", '{"path":"b"}').count, 1);
  assert.equal(tracker.observe("read_file", '{"path":"a"}').count, 1);
});

test("详细提醒截断过长的参数预览", () => {
  const tracker = new RepeatCallTracker([2, 3], 10);
  const args = JSON.stringify({ path: "a.ts", content: "x".repeat(100) });
  tracker.observe("write_file", args);
  tracker.observe("write_file", args);
  const observation = tracker.observe("write_file", args);
  assert.ok(observation.reminder?.includes("…(+"));
});

test("规范化参数与阈值校验", () => {
  assert.equal(canonicalizeArguments('{"b":2,"a":1}'), canonicalizeArguments('{"a":1,"b":2}'));
  assert.equal(canonicalizeArguments("not-json"), "not-json");
  assert.throws(() => new RepeatCallTracker([]));
  assert.throws(() => new RepeatCallTracker([1]));
  assert.throws(() => new RepeatCallTracker([3, 3]));
});
