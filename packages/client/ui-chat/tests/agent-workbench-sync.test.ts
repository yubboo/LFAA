// 验证 Agent 步骤到右侧工作台自动跟随动作的映射规则（浏览器、DevTools、文件、后台任务与子智能体）。
import assert from "node:assert/strict";
import test from "node:test";
import type { AgentStepTrace } from "@lfaa/memory";
import { resolveAgentWorkbenchAction } from "../client/shared/agent-workbench-sync";

function makeStep(patch: Partial<AgentStepTrace>): AgentStepTrace {
  return {
    id: "step-1",
    iteration: 1,
    phase: "act",
    title: "测试步骤",
    status: "done",
    timestamp: 1,
    ...patch,
  };
}

test("浏览器工具调用自动聚焦浏览器舞台，browser_console/network 自动切到对应 DevTools 页签", () => {
  const navRunning = resolveAgentWorkbenchAction(
    makeStep({ toolName: "browser_navigate", status: "running" }),
    { messageId: "m1", browserActiveInRun: false },
  );
  assert.deepEqual(navRunning, { kind: "browser", refreshTabs: false });

  const tabsDone = resolveAgentWorkbenchAction(
    makeStep({ toolName: "browser_tabs", status: "done" }),
    { messageId: "m1", browserActiveInRun: true },
  );
  assert.deepEqual(tabsDone, { kind: "browser", refreshTabs: true });

  const consoleDone = resolveAgentWorkbenchAction(
    makeStep({ toolName: "browser_console", status: "done" }),
    { messageId: "m1", browserActiveInRun: true },
  );
  assert.deepEqual(consoleDone, { kind: "browser", devtoolsTab: "console", refreshTabs: true });

  const networkDone = resolveAgentWorkbenchAction(
    makeStep({ toolName: "browser_network", status: "done" }),
    { messageId: "m1", browserActiveInRun: true },
  );
  assert.deepEqual(networkDone, { kind: "browser", devtoolsTab: "network", refreshTabs: true });
});

test("写改文件在编码阶段切台前文件预览，在浏览器验收阶段仅后台刷新标签不顶掉浏览器", () => {
  const fileStep = makeStep({
    id: "step-write",
    toolName: "write_file",
    status: "done",
    fileChange: { path: "index.html", before: "", after: "<html/>", operation: "created", firstLine: 1, truncated: false },
  });

  assert.deepEqual(
    resolveAgentWorkbenchAction(fileStep, { messageId: "m2", browserActiveInRun: false }),
    { kind: "file", messageId: "m2", stepId: "step-write", activateStage: true },
  );
  assert.deepEqual(
    resolveAgentWorkbenchAction(fileStep, { messageId: "m2", browserActiveInRun: true }),
    { kind: "file", messageId: "m2", stepId: "step-write", activateStage: false },
  );

  // 普通只读工具不打扰右侧工作台。
  assert.equal(
    resolveAgentWorkbenchAction(makeStep({ toolName: "read_file", status: "done" }), { messageId: "m2", browserActiveInRun: false }),
    null,
  );
});

test("后台任务与子智能体步骤按类型分流到终端、子智能体或浏览器舞台", () => {
  assert.deepEqual(
    resolveAgentWorkbenchAction(makeStep({ toolName: "start_background_task", status: "done" }), { messageId: "m3", browserActiveInRun: false }),
    { kind: "terminal" },
  );
  assert.deepEqual(
    resolveAgentWorkbenchAction(
      makeStep({ status: "running", detail: "分析架构", subagent: { id: "sub-1", role: "研究助手", status: "running" } }),
      { messageId: "m3", browserActiveInRun: false },
    ),
    { kind: "subagents" },
  );
  assert.deepEqual(
    resolveAgentWorkbenchAction(
      makeStep({ status: "running", detail: "正在执行 browser_visual_check", subagent: { id: "sub-2", role: "验收助手", status: "running" } }),
      { messageId: "m3", browserActiveInRun: false },
    ),
    { kind: "browser", refreshTabs: true },
  );
  assert.deepEqual(
    resolveAgentWorkbenchAction(
      makeStep({ status: "running", subagent: { id: "sub-3", role: "浏览器验收助手", kind: "browser", browserLabel: "内置浏览器", status: "running" } }),
      { messageId: "m3", browserActiveInRun: false },
    ),
    { kind: "browser", refreshTabs: true },
  );
});
