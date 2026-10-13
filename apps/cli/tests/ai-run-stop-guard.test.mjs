/**
 * 功能：回归新 Agent Run 的暂停/继续按钮交接保护。
 * 作用：确保当前 Run ID 存在且短暂发送手势保护期已过，运行控制才可用。
 * 关联文件：packages/client/ui-chat/src/run-stop-guard.ts、AiWorkChat.tsx。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { AI_RUN_CONTROL_GUARD_MS, canControlAiRun } from "../../../packages/client/ui-chat/src/run-stop-guard.ts";

test("暂停/继续按钮只绑定当前 Run，并等待发送手势交接完成", () => {
  const startedAt = 1000;
  assert.equal(AI_RUN_CONTROL_GUARD_MS, 600);
  assert.equal(canControlAiRun(null, startedAt, startedAt + 1000), false, "未取得当前 Run ID 时不能控制");
  assert.equal(canControlAiRun("run-current", startedAt, startedAt + AI_RUN_CONTROL_GUARD_MS - 1), false, "保护期内不能控制");
  assert.equal(canControlAiRun("run-current", startedAt, startedAt + AI_RUN_CONTROL_GUARD_MS), true, "保护期结束后可以控制当前 Run");
});
