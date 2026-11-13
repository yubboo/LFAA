import assert from "node:assert/strict";
import test from "node:test";
import {
  aiHostTaskShellLabel,
  aiHostTaskStatusLabel,
  browserAddressForDisplay,
  browserSiteHost,
  defaultChrome,
  findAssetWorkspaceUtilityTab,
  findGitWorkspaceUtilityTab,
  isAiHostTaskActive,
  sameAiHostTaskSummaries
} from "lfaa-client-ui-workspace/src/application-workspace/pure-utils.js";

test("ApplicationWorkspace selects the first existing Git or asset utility tab", () => {
  const tabs = [
    { id: "new", kind: "new" },
    { id: "git-first", kind: "git" },
    { id: "assets-first", kind: "assets" },
    { id: "git-second", kind: "git" },
    { id: "assets-second", kind: "assets" }
  ];

  assert.equal(findGitWorkspaceUtilityTab(tabs)?.id, "git-first");
  assert.equal(findAssetWorkspaceUtilityTab(tabs)?.id, "assets-first");
  assert.equal(findGitWorkspaceUtilityTab([{ id: "new", kind: "new" }]), undefined);
  assert.equal(findAssetWorkspaceUtilityTab([{ id: "new", kind: "new" }]), undefined);
});

test("ApplicationWorkspace compares Host Task summaries by their displayed state", () => {
  const task = {
    id: "task-1",
    nodeId: "node-1",
    appId: "workspace",
    shell: "powershell",
    workingDirectory: "C:/project",
    status: "running",
    message: "working",
    createdAt: "2026-11-13T00:00:00.000Z",
    startedAt: "2026-11-13T00:00:01.000Z",
    finishedAt: null,
    cancelRequested: false,
    outputSequence: 4
  };

  assert.equal(sameAiHostTaskSummaries([task], [{ ...task }]), true);
  assert.equal(sameAiHostTaskSummaries([task], [{ ...task, outputSequence: 5 }]), false);
  assert.equal(sameAiHostTaskSummaries([task], [{ ...task, nodeId: "node-2" }]), false);
  assert.equal(sameAiHostTaskSummaries([], []), true);
});

test("ApplicationWorkspace preserves Host Task labels and active-state rules", () => {
  assert.equal(aiHostTaskShellLabel("powershell"), "PowerShell");
  assert.equal(aiHostTaskShellLabel("cmd"), "命令提示符");
  assert.equal(aiHostTaskShellLabel("bash"), "Bash");
  assert.equal(aiHostTaskShellLabel("zsh"), "Zsh");
  assert.equal(aiHostTaskShellLabel("project-files"), "项目文件任务");
  assert.equal(aiHostTaskShellLabel("unknown"), "系统 Shell");

  const running = { status: "running", cancelRequested: false };
  assert.equal(aiHostTaskStatusLabel({ status: "queued" }), "排队中");
  assert.equal(aiHostTaskStatusLabel(running), "运行中");
  assert.equal(aiHostTaskStatusLabel({ ...running, cancelRequested: true }), "等待节点确认停止");
  assert.equal(aiHostTaskStatusLabel({ status: "succeeded" }), "已完成");
  assert.equal(aiHostTaskStatusLabel({ status: "failed" }), "已结束");
  assert.equal(isAiHostTaskActive({ status: "queued" }), true);
  assert.equal(isAiHostTaskActive(running), true);
  assert.equal(isAiHostTaskActive({ status: "succeeded" }), false);
});

test("ApplicationWorkspace keeps browser host and address display rules", () => {
  assert.equal(browserSiteHost("https://example.test:8443/path?q=1"), "example.test");
  assert.equal(browserSiteHost("not a URL"), "not a URL");

  const url = "https://example.test/path?q=1#section";
  assert.equal(browserAddressForDisplay(url, false, false), "https://example.test");
  assert.equal(browserAddressForDisplay(url, true, false), url);
  assert.equal(browserAddressForDisplay(url, false, true), url);
  assert.equal(browserAddressForDisplay("file:///tmp/page", false, false), "file:///tmp/page");
  assert.equal(browserAddressForDisplay("invalid URL", false, false), "invalid URL");
  assert.equal(browserAddressForDisplay("", false, false), "");
});

test("ApplicationWorkspace resolves default collapsed panels for each layout mode", () => {
  assert.deepEqual(defaultChrome("mobile"), { leftCollapsed: true, centerCollapsed: false, rightCollapsed: true, terminalOpen: false });
  assert.deepEqual(defaultChrome("compact"), { leftCollapsed: false, centerCollapsed: false, rightCollapsed: true, terminalOpen: false });
  assert.deepEqual(defaultChrome("desktop"), { leftCollapsed: false, centerCollapsed: false, rightCollapsed: false, terminalOpen: false });
});
