// 验证目标自动续跑的停止条件矩阵与续跑指令内容（纯函数，不启动真实运行）。
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGoalContinuationMessage,
  decideGoalContinuation,
  type GoalContinuationSnapshot,
} from "../src/run/goal-continuation";

const GOAL: GoalContinuationSnapshot = {
  id: "g1",
  title: "拆分循环",
  objective: "把 agent-loop 拆到 150 行",
  status: "active",
  autoContinue: true,
  rounds: 0,
  maxRounds: 10,
};

function decide(input: Partial<Parameters<typeof decideGoalContinuation>[0]> = {}) {
  return decideGoalContinuation({
    runStatus: "done",
    pendingQuestion: false,
    sessionRunning: false,
    goals: [GOAL],
    ...input,
  });
}

test("正常结束时继续最近的 active 目标", () => {
  const decision = decide();
  assert.equal(decision.continue, true);
  assert.equal(decision.continue && decision.goal.id, "g1");
});

test("运行未正常结束不续跑", () => {
  assert.deepEqual(decide({ runStatus: "error" }), { continue: false, reason: "run_not_done" });
  assert.deepEqual(decide({ runStatus: "aborted" }), { continue: false, reason: "run_not_done" });
});

test("待回答澄清、会话已有新运行、无 active 目标、暂停、到达轮数上限时停止", () => {
  assert.equal(decide({ pendingQuestion: true }).reason, "pending_question");
  assert.equal(decide({ sessionRunning: true }).reason, "session_running");
  assert.equal(decide({ goals: [{ ...GOAL, status: "complete" }] }).reason, "no_goal");
  assert.equal(decide({ goals: [{ ...GOAL, autoContinue: false }] }).reason, "paused");
  assert.equal(decide({ goals: [{ ...GOAL, rounds: 10 }] }).reason, "max_rounds");
});

test("多个目标时只挑 active 的那个", () => {
  const decision = decide({
    goals: [
      { ...GOAL, id: "done", status: "complete" },
      { ...GOAL, id: "next", rounds: 3 },
    ],
  });
  assert.equal(decision.continue, true);
  assert.equal(decision.continue && decision.goal.id, "next");
});

test("续跑指令带目标标题、完成与受阻的收口要求", () => {
  const message = buildGoalContinuationMessage(GOAL);
  assert.match(message, /继续执行目标「拆分循环」/u);
  assert.match(message, /goal_update/u);
  assert.match(message, /complete/u);
  assert.match(message, /blocked/u);
});