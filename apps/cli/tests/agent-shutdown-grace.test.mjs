/**
 * 功能：回归服务退出时的 Agent 收尾合同。
 * 作用：验证退出标记语义，并用源码合同断言退出链路：模型循环拒绝新请求、app-boot 先宽限等待再卸载。
 * 关联文件：packages/core/agent-loop/src/shutdown-state.ts、runs.ts、execute-turn.ts、packages/boot/app-boot/src/index.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const state = await import("lfaa-agent-loop/src/shutdown-state.js");
const read = (path) => readFileSync(new URL("../../../" + path, import.meta.url), "utf8");

test("退出标记默认关闭且幂等打开", () => {
  assert.equal(state.isShutdownRequested(), false);
  state.requestShutdown();
  state.requestShutdown();
  assert.equal(state.isShutdownRequested(), true);
});

test("模型循环在退出流程中拒绝新的模型请求，但保留已完成工具结果", () => {
  const source = read("packages/core/agent-loop/src/execute-turn.ts");
  const guard = source.indexOf("if (isShutdownRequested()) throw new Error(\"LFAA 服务正在退出");
  const pause = source.indexOf("await pauseGate.checkpoint(abortController.signal);", source.indexOf("const requestModel = async"));
  assert.ok(guard > 0, "requestModel 必须在派发前检查退出标记");
  assert.ok(pause > guard, "退出检查必须先于暂停检查点，避免退出时再开新请求");
  assert.match(source, /已完成的工具结果保持有效/u);
});

test("app-boot 在卸载前先请求 Agent 收尾并受宽限期约束", () => {
  const boot = read("packages/boot/app-boot/src/index.ts");
  assert.match(boot, /LFAA_SHUTDOWN_RUN_GRACE_MS/u);
  assert.match(boot, /prepareShutdown/u);
  const prepare = boot.indexOf("prepareShutdown");
  const dispose = boot.indexOf("context.fiber.dispose()", prepare);
  assert.ok(prepare > 0 && dispose > prepare, "必须先等待 Agent 收尾，再执行 Cordis dispose");
});

test("runs 暴露收尾入口并复用同一退出标记", () => {
  const runs = read("packages/core/agent-loop/src/runs.ts");
  assert.match(runs, /export async function prepareAgentShutdown/u);
  assert.match(runs, /requestShutdown\(\)/u);
  assert.match(runs, /export async function awaitActiveAiRuns/u);
});
