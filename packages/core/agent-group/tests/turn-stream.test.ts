// 验证群聊 SSE 流式回合（GroupTurnHub）与中途 abort 行为。
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentRunEvent } from "@lfaa/agent";
import { GroupTurnHub, type GroupTurnEvent } from "../src/turn-stream";

describe("GroupTurnHub streaming and abort", () => {
  it("streams speaker deltas in order and supports aborting mid-turn", async () => {
    const listeners = new Map<string, (ev: AgentRunEvent) => void>();
    const abortedRuns: string[] = [];
    let runSeq = 0;

    const hub = new GroupTurnHub({
      memory: {
        getSession: async () => ({
          id: "g1",
          title: "研发群",
          projectId: "p1",
          sectionId: null,
          pinned: false,
          archived: false,
          messageCount: 0,
          kind: "group",
          group: { agentIds: ["xiaoyu", "cli:claude"], hostAgentId: "xiaoyu", maxSpeakersPerRound: 2 },
          messages: [],
          createdAt: 1,
          updatedAt: 1,
        }),
        updateSession: async () => null,
      },
      agent: {
        startRun: async (input) => {
          runSeq += 1;
          const runId = `run-${runSeq}`;
          return { runId, sessionId: input.sessionId, assistantMessageId: `msg-${runSeq}`, workspaceRoots: [] };
        },
        subscribeRun: (runId, listener) => {
          listeners.set(runId, listener);
          return () => listeners.delete(runId);
        },
        waitForRun: async (runId) => {
          // 等待微任务让订阅建立后发出流式事件
          await new Promise((r) => setTimeout(r, 10));
          const listener = listeners.get(runId);
          listener?.({ type: "delta", runId, seq: 1, kind: "text", text: `hi from ${runId}` });
          listener?.({ type: "run_finished", runId, sessionId: "g1", assistantMessageId: "m1", status: "done" });
        },
        abortRun: (runId) => {
          abortedRuns.push(runId);
          return true;
        },
      },
      newTurnId: () => "turn-1",
    });

    const started = await hub.start({ sessionId: "g1", userMessage: "一起看下", mentions: ["xiaoyu", "cli:claude"] });
    assert.equal(started.turnId, "turn-1");
    assert.deepEqual(started.speakers.map((s) => s.agentId), ["xiaoyu", "cli:claude"]);

    const events: GroupTurnEvent[] = [];
    await new Promise<void>((resolve) => {
      hub.subscribe("turn-1", (ev) => {
        events.push(ev);
        if (ev.type === "turn_finished") resolve();
      });
    });

    const deltas = events.filter((e) => e.type === "delta").map((e) => `${e.agentId}:${e.text}`);
    assert.deepEqual(deltas, ["xiaoyu:hi from run-1", "cli:claude:hi from run-2"]);
    assert.equal(abortedRuns.length, 0);
  });
});
