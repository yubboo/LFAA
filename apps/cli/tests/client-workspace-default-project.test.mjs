/**
 * 功能：回归 AI Work 新会话默认进入默认工作区。
 * 作用：验证默认项目选择与显式项目/移出选择优先级，并锁定 Client 到会话请求的数据链。
 * 关联文件：packages/client/ui-chat/src/new-session-project-selection.ts、packages/client/ui-chat/src/AiWorkChat.tsx、packages/client/ui-workspace/src/ApplicationWorkspace.tsx。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveNewSessionWorkspaceProjectId } from "../../../packages/client/ui-chat/src/new-session-project-selection.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const chat = readFileSync(resolve(root, "packages/client/ui-chat/src/AiWorkChat.tsx"), "utf8");
const workspace = readFileSync(resolve(root, "packages/client/ui-workspace/src/ApplicationWorkspace.tsx"), "utf8");
const styles = readFileSync(resolve(root, "packages/client/ui-workspace/src/css/secondary-navigation.css"), "utf8");

test("新会话默认使用真实默认项目，具体项目入口和草稿中的显式选择优先", () => {
  assert.equal(resolveNewSessionWorkspaceProjectId({ requestedProjectId: null, defaultProjectId: "default-id", selectedProjectId: null, selectionIsExplicit: false }), "default-id");
  assert.equal(resolveNewSessionWorkspaceProjectId({ requestedProjectId: "requested-id", defaultProjectId: "default-id", selectedProjectId: "other-id", selectionIsExplicit: false }), "requested-id");
  assert.equal(resolveNewSessionWorkspaceProjectId({ requestedProjectId: null, defaultProjectId: "default-id", selectedProjectId: "other-id", selectionIsExplicit: true }), "other-id");
  assert.equal(resolveNewSessionWorkspaceProjectId({ requestedProjectId: null, defaultProjectId: "default-id", selectedProjectId: null, selectionIsExplicit: true }), null, "用户主动移出项目后保留无项目选择");
});

test("Workspace Owner 默认项目 ID 传入聊天并作为新会话项目 ID 发送", () => {
  assert.match(workspace, /const \{ projects, nodes, truncated, defaultProjectId \} = await loadWorkspaceProjects/u);
  assert.match(workspace, /defaultWorkspaceProjectId=\{defaultWorkspaceProjectId\}/u);
  assert.match(chat, /const requestProjectId = supportsWorkspaceProjectContext \? targetSession \? targetSession\.session\.projectId : selectedProjectId : null/u);
  assert.match(chat, /\.\.\.\(!requestSessionId && requestProjectId \? \{ projectId: requestProjectId \} : \{\}\)/u);
});

test("最近只收纳无项目归属的会话，项目会话由项目分组访问", () => {
  assert.match(workspace, /appSessions\.filter\(session => !session\.projectId && !pinnedSessionSet\.has\(session\.id\)\)/u);
  assert.match(workspace, /if \(!session\.projectId \|\| pinnedSessionSet\.has\(session\.id\)\) continue/u);
});

test("重复会话行按具体列表位置隔离菜单开合状态", () => {
  assert.match(workspace, /const renderSession = \(session: AiSession, menuScope: string, nested = false\)/u);
  assert.match(workspace, /const menuKey = menuScope \+ ":" \+ session\.id/u);
  assert.match(workspace, /open=\{sessionMenuKey === menuKey\}/u);
  assert.match(workspace, /aria-expanded=\{sessionMenuKey === menuKey\}/u);
  assert.match(workspace, /setSessionMenuKey\(current => current === menuKey \? null : menuKey\)/u);
});

test("会话操作菜单停靠在行右侧，不覆盖相邻行的三个点", () => {
  assert.match(workspace, /placement="bottomRight" align=\{\{ points: \["tl", "tr"\], offset: \[8, 0\] \}\} autoAdjustOverflow overlayClassName="module-session-menu"/u);
});

test("展开显示悬停灰底铺满与会话行相同的可用宽度", () => {
  const baseRule = styles.match(/\.module-sidebar__project-more\s*\{([^}]*)\}/u)?.[1] ?? "";
  const hoverRule = styles.match(/\.module-sidebar__project-more:hover\s*\{([^}]*)\}/u)?.[1] ?? "";
  assert.match(baseRule, /justify-self:\s*stretch/u);
  assert.match(baseRule, /margin-left:\s*7px/u);
  assert.match(hoverRule, /background:\s*var\(--color-surface-hover\)/u);
});
