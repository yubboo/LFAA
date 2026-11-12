/**
 * 功能：回归 `/work` Git 摘要的手动开合行为。
 * 作用：确保 Agent Run 与工作台尺寸变化不会替用户打开或关闭摘要。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(new URL("../../../packages/client/ui-workspace/src/ApplicationWorkspace.tsx", import.meta.url), "utf8");
const busyHandler = workspace.match(/const onAiChatBusyChange = useCallback\(\(busy: boolean\) => \{[\s\S]*?\}, \[\]\);/u)?.[0];
const summaryHandler = workspace.match(/const handleGitSummaryOpenChange = useCallback\(\(open: boolean\) => \{[\s\S]*?\}, \[\]\);/u)?.[0];

test("Agent Run 只在结束后刷新摘要，不自动打开或关闭摘要", () => {
  assert.ok(busyHandler, "应保留当前 AiWorkChat 主 Run 的忙碌状态联动");
  assert.match(busyHandler, /if \(wasBusy && !busy\) setGitRefreshRevision/u);
  assert.doesNotMatch(busyHandler, /setGitSummaryOpen|handleGitSummaryOpenChange/u);
});

test("Git 摘要只由用户操作开合，不随 Dock 尺寸自动切换", () => {
  assert.ok(summaryHandler, "应保留摘要控件的用户开合入口");
  assert.match(summaryHandler, /setGitSummaryOpen\(open\)/u);
  assert.doesNotMatch(workspace, /shouldAutoOpenGitSummary|syncSummaryToRightWidth|gitSummaryResponsiveOpenRef/u);
  assert.match(workspace, /onOpenChange=\{handleGitSummaryOpenChange\}[\s\S]*?open=\{gitSummaryOpen\}/u);
  assert.match(workspace, /const open = !gitSummaryOpen;[\s\S]*?handleGitSummaryOpenChange\(open\)/u, "手机入口仍可手动开合");
});
