/**
 * 功能：回归 `/work` 中“变更”工具标签的单实例和入口同步。
 * 作用：确保只对 Git 变更做去重，不改变其他工具入口的重复打开行为。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workspace = readFileSync(new URL("../../../packages/client/ui-workspace/src/ApplicationWorkspace.tsx", import.meta.url), "utf8");
const openUtilityStart = workspace.indexOf("  const openWorkspaceUtility = useCallback(");
const openUtilityEnd = workspace.indexOf("\n  const openBrowserWebsite", openUtilityStart);
const openUtility = workspace.slice(openUtilityStart, openUtilityEnd);

test("已打开变更标签时隐藏入口，关闭后由当前标签状态恢复", () => {
  assert.match(workspace, /function findGitWorkspaceUtilityTab\(tabs: WorkspaceUtilityTab\[\]\): WorkspaceUtilityTab \| undefined/u);
  assert.match(workspace, /return tabs\.find\(tab => tab\.kind === "git"\)/u);
  assert.match(workspace, /gitManagerAvailable && !findGitWorkspaceUtilityTab\(workspaceUtilityTabs\)/u);
  assert.match(workspace, /onClick=\{\(\) => openWorkspaceUtility\("git"\)\}/u);
  assert.match(workspace, /const nextTabs = workspaceUtilityTabs\.filter\(tab => tab\.id !== tabId\)/u, "关标签后 helper 从当前标签列表自然恢复入口");
});

test("再次请求变更时聚焦现有标签，不创建第二个 Git 标签", () => {
  assert.ok(openUtility.length > 0, "应定位到工作区工具打开入口");
  assert.match(openUtility, /if \(kind === "git"\) \{[\s\S]*?const existingGitTab = findGitWorkspaceUtilityTab\(workspaceUtilityTabs\)[\s\S]*?setActiveWorkspaceUtilityTabId\(existingGitTab\.id\)[\s\S]*?showWorkspaceUtilityTab\(existingGitTab\)[\s\S]*?return/u);
  const existingGitBranch = openUtility.indexOf("if (kind === \"git\")");
  const createNewTab = openUtility.indexOf("const nextTab = { id: `workspace-tab-");
  assert.ok(existingGitBranch >= 0 && createNewTab > existingGitBranch, "已有 Git 标签的早退分支必须先于新建标签逻辑");
});

test("其他工具保留原有入口，不新增隐藏或去重条件", () => {
  assert.match(workspace, /onClick=\{openTerminal\}/u);
  assert.match(workspace, /onClick=\{\(\) => onNavigate\("\/files"\)\}/u);
  assert.match(workspace, /onClick=\{\(\) => openWorkspaceUtility\("side-chat"\)\}/u);
  assert.match(workspace, /applicationNavigationItems\.length > 0 \? <button[\s\S]*?openWorkspaceUtility\("applications"\)/u);
  assert.match(workspace, /sidebarRight\.tabs\.map\(tab => <button[\s\S]*?openWorkspaceUtility\("extension", tab\.id\)/u);
  assert.doesNotMatch(openUtility, /find\(tab => tab\.kind === kind\)/u, "不能把 Git 单例规则扩展为所有工具的通用去重");
});
