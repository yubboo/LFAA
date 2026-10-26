import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { hasUnreadSessionCompletionNotification } from "../../../packages/client/ui-workspace/src/session-completion-indicator.ts";

const workspaceSource = readFileSync(new URL("../../../packages/client/ui-workspace/src/ApplicationWorkspace.tsx", import.meta.url), "utf8");
const workbenchSource = readFileSync(new URL("../../../packages/client/ui-layout/src/Workbench.tsx", import.meta.url), "utf8");

const complete = {
  id: "notice-1",
  appId: "workspace",
  applicationName: "小鱼智能体",
  sessionId: "session-1",
  kind: "complete",
  title: "回复已完成",
  body: "会话已完成回复。",
  createdAt: 1,
  read: false,
};

test("only an unread completion notice for the same app and session shows the indicator", () => {
  assert.equal(hasUnreadSessionCompletionNotification([complete], "workspace", "session-1"), true);
  assert.equal(hasUnreadSessionCompletionNotification([complete], "workspace", "session-2"), false);
  assert.equal(hasUnreadSessionCompletionNotification([complete], "minecraft", "session-1"), false);
  assert.equal(hasUnreadSessionCompletionNotification([{ ...complete, read: true }], "workspace", "session-1"), false);
  assert.equal(hasUnreadSessionCompletionNotification([{ ...complete, kind: "issue" }], "workspace", "session-1"), false);
  assert.equal(hasUnreadSessionCompletionNotification([{ ...complete, kind: "approval" }], "workspace", "session-1"), false);
});

test("cross-app session rows match and acknowledge notifications using the session owner", () => {
  assert.match(workspaceSource, /hasUnreadSessionCompletionNotification\(notifications, session\.appId, session\.id\)/u);
  assert.match(workspaceSource, /if \(hasUnreadCompletion\) onMarkSessionNotificationsRead\(session\.appId, session\.id\);/u);
  assert.match(workbenchSource, /notification\.appId === appId && notification\.sessionId === sessionId && !notification\.read[\s\S]*?\{ \.\.\.notification, read: true \}/u);
});
