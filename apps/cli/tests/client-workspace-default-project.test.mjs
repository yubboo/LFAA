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

test("新会话默认使用真实默认项目，具体项目入口和草稿中的显式选择优先", () => {
  assert.equal(resolveNewSessionWorkspaceProjectId({ requestedProjectId: null, defaultProjectId: "default-id", selectedProjectId: null, selectionIsExplicit: false }), "default-id");
  assert.equal(resolveNewSessionWorkspaceProjectId({ requestedProjectId: "requested-id", defaultProjectId: "default-id", selectedProjectId: "other-id", selectionIsExplicit: false }), "requested-id");
  assert.equal(resolveNewSessionWorkspaceProjectId({ requestedProjectId: null, defaultProjectId: "default-id", selectedProjectId: "other-id", selectionIsExplicit: true }), "other-id");
  assert.equal(resolveNewSessionWorkspaceProjectId({ requestedProjectId: null, defaultProjectId: "default-id", selectedProjectId: null, selectionIsExplicit: true }), null, "用户主动移出项目后保留无项目选择");
});

test("Workspace Owner 默认项目 ID 传入聊天并作为新会话项目 ID 发送", () => {
  assert.match(workspace, /const \{ projects, nodes, truncated, defaultProjectId \} = await loadWorkspaceProjects/u);
  assert.match(workspace, /defaultWorkspaceProjectId=\{defaultWorkspaceProjectId\}/u);
  assert.match(chat, /const requestProjectId = targetSession \? targetSession\.session\.projectId : selectedProjectId/u);
  assert.match(chat, /\.\.\.\(!requestSessionId && requestProjectId \? \{ projectId: requestProjectId \} : \{\}\)/u);
});

test("项目会话也保留在最近入口，置顶会话仍由置顶区单独呈现", () => {
  assert.match(workspace, /const recentSessions = appSessions\.filter\(session => !pinnedSessionSet\.has\(session\.id\)\)/u);
  assert.match(workspace, /if \(!session\.projectId \|\| pinnedSessionSet\.has\(session\.id\)\) continue/u);
});
