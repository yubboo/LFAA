// 验证后台状态机：运行集合去重、待处理徽标增减，以及首屏同步不补发历史通知。
import assert from "node:assert/strict";
import test from "node:test";
import type { ChatSessionAttention, ChatStoreSnapshot } from "../client/chat-types";
import { ChatBackgroundRuns } from "../client/chat-background-runs";

/** 构造只含跟踪所需字段的运行快照。 */
function snapshot(activeSessionId: string | null, runningRunId: string | null): ChatStoreSnapshot {
  return { activeSessionId, runningRunId, runningSessionIds: [], attention: [] } as unknown as ChatStoreSnapshot;
}

/** 收集发布与通知事件的测试替身。 */
function createTracker(activeSessionId: string | null, runningRunId: string | null) {
  const running: string[][] = [];
  const attention: ChatSessionAttention[][] = [];
  const notified: ChatSessionAttention[] = [];
  const finished: string[] = [];
  const tracker = new ChatBackgroundRuns(
    () => snapshot(activeSessionId, runningRunId),
    (sessionIds) => running.push(sessionIds),
    (items) => attention.push(items),
    (item) => notified.push(item),
    (sessionId) => finished.push(sessionId),
    async () => {},
  );
  return { tracker, running, attention, notified, finished };
}

test("同步运行集合会去重并发布一次", () => {
  const { tracker, running } = createTracker(null, null);

  tracker.sync({ sessionIds: ["s2", "s1", "s2"], attention: [] });
  tracker.sync({ sessionIds: ["s2", "s1"], attention: [] });

  assert.deepEqual(running, [["s2", "s1"]]);
  tracker.dispose();
});

test("开始与结束运行都会立即更新集合", () => {
  const { tracker, running } = createTracker(null, null);

  tracker.markRunning("s1", true);
  tracker.markRunning("s2", true);
  tracker.markRunning("s1", false);

  assert.deepEqual(running, [["s1"], ["s1", "s2"], ["s2"]]);
  tracker.dispose();
});

test("切走正在运行的会话后保留其运行标记，切到同一会话则不变", () => {
  const { tracker, running } = createTracker("s1", "run-1");

  tracker.trackLeavingActiveRun("s2");
  tracker.trackLeavingActiveRun("s1");

  assert.deepEqual(running, [["s1"]]);
  tracker.dispose();
});

test("首屏同步恢复待处理徽标但不补发通知", () => {
  const { tracker, attention, notified } = createTracker(null, null);
  const items: ChatSessionAttention[] = [
    { sessionId: "s1", kind: "question", question: "选哪个？" },
    { sessionId: "s2", kind: "approval", toolName: "write_file" },
  ];

  tracker.sync({ sessionIds: [], attention: items });

  assert.deepEqual(attention, [items]);
  assert.deepEqual(notified, []);
  tracker.dispose();
});

test("回应/处理会话后立即撤掉对应徽标", () => {
  const { tracker, attention } = createTracker(null, null);
  tracker.sync({
    sessionIds: [],
    attention: [
      { sessionId: "s1", kind: "question", question: "选哪个？" },
      { sessionId: "s2", kind: "approval", toolName: "write_file" },
    ],
  });

  tracker.markAttentionResolved("s1");

  assert.deepEqual(attention.at(-1)?.map((item) => item.sessionId), ["s2"]);
  tracker.dispose();
});