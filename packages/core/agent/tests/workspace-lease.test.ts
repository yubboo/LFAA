// 验证工作区租约：scope 解析、跨会话冲突拒绝、释放后接手与同会话重入。
import assert from "node:assert/strict";
import test from "node:test";
import { resolveWorkspaceScope, WorkspaceBusyError, WorkspaceLeaseRegistry } from "../src/run/workspace-lease";

test("scope 优先工作树，其次项目，最后授权根", () => {
  assert.equal(resolveWorkspaceScope({ worktreePath: "C:/w", projectId: "p1", roots: ["C:/r"] }), "worktree:C:/w");
  assert.equal(resolveWorkspaceScope({ projectId: "p1", roots: ["C:/r"] }), "project:p1");
  assert.equal(resolveWorkspaceScope({ roots: ["C:/r"] }), "root:C:/r");
  assert.equal(resolveWorkspaceScope({ roots: [] }), "root:default");
});

test("同一 scope 的第二个会话被拒绝，释放后可以接手", () => {
  const registry = new WorkspaceLeaseRegistry();
  assert.equal(registry.acquire("project:p1", "s1", "会话一").ok, true);
  assert.equal(registry.list().length, 1);

  const second = registry.acquire("project:p1", "s2", "会话二");
  assert.equal(second.ok, false);
  if (!second.ok) {
    assert.equal(second.holder.sessionId, "s1");
    const error = new WorkspaceBusyError("project:p1", second.holder);
    assert.equal(error.code, "workspace_busy");
    assert.match(error.message, /会话一/u);
    assert.match(error.message, /工作树/u);
  }

  registry.release("s1");
  assert.equal(registry.get("project:p1"), undefined);
  assert.equal(registry.acquire("project:p1", "s2", "会话二").ok, true);
});

test("同一会话换 scope 时释放旧租约，重入不冲突", () => {
  const registry = new WorkspaceLeaseRegistry();
  assert.equal(registry.acquire("project:p1", "s1", "会话一").ok, true);
  assert.equal(registry.acquire("project:p1", "s1", "会话一").ok, true);
  registry.acquire("worktree:C:/w", "s1", "会话一");
  assert.equal(registry.get("project:p1"), undefined);
  assert.equal(registry.get("worktree:C:/w")?.sessionId, "s1");
  registry.releaseScope("worktree:C:/w");
  assert.deepEqual(registry.list(), []);
});