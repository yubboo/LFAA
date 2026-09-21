/**
 * 行为级回归：真实磁盘 Repository 必须跨实例恢复项目、会话、置顶与活动选择。
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NodeWorkspaceSessionRepository } from "../packages/session/session-host-node/src/index.ts";

test("project and session state survives repository restart", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-session-test-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));

  const first = new NodeWorkspaceSessionRepository(root);
  const initial = await first.projects("lfaa");
  assert.equal(initial.activeProjectId, "lfaa");
  assert.equal(initial.projects[0]?.name, "lfaa");

  const createdProjects = await first.createProject({ name: "真实项目" });
  const projectId = createdProjects.activeProjectId;
  await first.updateProject(projectId, { pinned: true, expanded: false });
  const session = await first.create({ workspaceId: projectId, mode: "work" });
  await first.save({
    ...session,
    title: "刷新后仍存在",
    pinned: true,
    workContext: "画布上下文",
    messages: [{ id: "user-1", role: "user", text: "持久化消息" }],
  });

  const restarted = new NodeWorkspaceSessionRepository(root);
  const restoredProjects = await restarted.projects("lfaa");
  const restoredProject = restoredProjects.projects.find((item) => item.id === projectId);
  assert.equal(restoredProjects.activeProjectId, projectId);
  assert.equal(restoredProject?.pinned, true);
  assert.equal(restoredProject?.expanded, false);
  assert.equal(restoredProjects.pinnedSessions[0]?.title, "刷新后仍存在");

  const snapshot = await restarted.snapshot(projectId);
  assert.equal(snapshot.activeSessionId, session.id);
  const restored = await restarted.load(session.id);
  assert.equal(restored.mode, "work");
  assert.equal(restored.messages[0]?.text, "持久化消息");
  assert.equal(restored.workContext, "画布上下文");
});

test("legacy v1 index migrates without losing sessions", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-session-v1-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const id = "12345678-abcd-4000-8000-123456789abc";
  const now = Date.now();
  await fs.writeFile(path.join(root, `${id}.json`), JSON.stringify({ id, workspaceId: "lfaa", title: "旧会话", mode: "chat", messages: [], workContext: "", createdAt: now, updatedAt: now }));
  await fs.writeFile(path.join(root, "index.json"), JSON.stringify({ version: 1, activeByWorkspace: { lfaa: id }, sessions: [{ id, workspaceId: "lfaa", title: "旧会话", mode: "chat", preview: "", updatedAt: now }] }));

  const repository = new NodeWorkspaceSessionRepository(root);
  const projects = await repository.projects("lfaa");
  assert.equal(projects.projects[0]?.id, "lfaa");
  const restored = await repository.load(id);
  assert.equal(restored.title, "旧会话");
  assert.equal(restored.pinned, false);
});
