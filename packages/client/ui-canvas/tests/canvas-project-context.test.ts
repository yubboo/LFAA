// 进入画布项目时的上下文同步单测：确保自动切到工作模式、同步左二高亮并绑定新聊天草稿，不篡改已有历史会话。
// 关联：packages/client/ui-canvas/client/canvas/useCanvasHubActions.ts；运行环境：Node.js（node:test）。
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { WorkbenchClientService } from "@lfaa/ui-layout/client";
import { syncCanvasProjectContext } from "../client/canvas/useCanvasHubActions";

function createFakeWorkbench(initial: {
  workspaceMode: "chatgpt" | "codex";
  activeProjectId: string | null;
  activeChatSessionId: string | null;
  draftProjectId: string | null;
}) {
  const calls: string[] = [];
  const state = { ...initial };
  const workbench = {
    getSnapshot: () => ({
      workspaceMode: state.workspaceMode,
      activeProjectId: state.activeProjectId,
      activeChatSessionId: state.activeChatSessionId,
      chatProvider: {
        getDraftProjectId: () => state.draftProjectId,
        setActiveProjectBinding: (projectId: string | null) => {
          state.draftProjectId = projectId;
          calls.push(`bind:${projectId}`);
        },
      },
    }),
    setWorkspaceMode: (mode: "chatgpt" | "codex") => {
      state.workspaceMode = mode;
      calls.push(`mode:${mode}`);
    },
    setActiveProject: (projectId: string | null) => {
      state.activeProjectId = projectId;
      calls.push(`active:${projectId}`);
    },
  } as unknown as WorkbenchClientService;
  return { workbench, state, calls };
}

describe("syncCanvasProjectContext", () => {
  it("switches to work mode and binds draft chat when entering a canvas project without an active session", () => {
    const { workbench, state, calls } = createFakeWorkbench({
      workspaceMode: "chatgpt",
      activeProjectId: null,
      activeChatSessionId: null,
      draftProjectId: null,
    });

    syncCanvasProjectContext(workbench, "canvas-proj-1");

    assert.equal(state.workspaceMode, "codex");
    assert.equal(state.activeProjectId, "canvas-proj-1");
    assert.equal(state.draftProjectId, "canvas-proj-1");
    assert.deepEqual(calls, ["mode:codex", "active:canvas-proj-1", "bind:canvas-proj-1"]);
  });

  it("preserves existing historical session binding while switching to work mode and highlighting project", () => {
    const { workbench, state, calls } = createFakeWorkbench({
      workspaceMode: "chatgpt",
      activeProjectId: null,
      activeChatSessionId: "session-existing",
      draftProjectId: "other-proj",
    });

    syncCanvasProjectContext(workbench, "canvas-proj-2");

    assert.equal(state.workspaceMode, "codex");
    assert.equal(state.activeProjectId, "canvas-proj-2");
    assert.equal(state.draftProjectId, "other-proj");
    assert.deepEqual(calls, ["mode:codex", "active:canvas-proj-2"]);
  });
});
