// 验证群聊编排：@ 顺序发言、第二位起不重复落用户消息、代理人兜底与发言人数上限。
import assert from "node:assert/strict";
import test from "node:test";
import type { ChatSessionRecord } from "@lfaa/memory";
import { runGroupTurn, type GroupTurnDeps } from "../src/index";

/** 构造一条群聊会话；成员默认两个。 */
function groupSession(patch: Partial<ChatSessionRecord> = {}): ChatSessionRecord {
  return {
    id: "s1",
    title: "前端重构小队",
    projectId: null,
    sectionId: null,
    pinned: false,
    archived: false,
    messageCount: 0,
    createdAt: 0,
    updatedAt: 0,
    messages: [],
    kind: "group",
    group: { agentIds: ["reviewer", "implementer"], hostAgentId: "xiaoyu", maxSpeakersPerRound: 3, memberMaxSteps: 12 },
    ...patch,
  };
}

/** 记录编排调用顺序的替身。 */
function depsOf(session: ChatSessionRecord) {
  const started: Array<{ agentId?: string; skipUserMessage?: boolean; userMessage?: string; authorAgentId?: string }> = [];
  const waited: string[] = [];
  const deps: GroupTurnDeps = {
    memory: { async getSession() { return session; } },
    agent: {
      async startRun(input) {
        started.push({
          ...(input.agentId ? { agentId: input.agentId } : {}),
          ...(input.skipUserMessage ? { skipUserMessage: true } : {}),
          ...(input.userMessage ? { userMessage: input.userMessage } : {}),
          ...(input.authorAgentId ? { authorAgentId: input.authorAgentId } : {}),
        });
        return { runId: `run-${started.length}`, sessionId: session.id, assistantMessageId: `a-${started.length}`, workspaceRoots: [] };
      },
      async waitForRun(runId) {
        waited.push(runId);
      },
    },
    newTurnId: () => "turn-1",
  };
  return { deps, started, waited };
}

test("非群聊会话拒绝编排", async () => {
  const plain = groupSession();
  delete plain.kind;
  delete plain.group;
  const { deps } = depsOf(plain);
  await assert.rejects(runGroupTurn(deps, { sessionId: "s1", userMessage: "hi" }), /不是群聊/u);
});

test("@ 两人按顺序发言，第二位起不重复写用户消息", async () => {
  const { deps, started, waited } = depsOf(groupSession());
  const result = await runGroupTurn(deps, { sessionId: "s1", userMessage: "帮我改会话列表分页", mentions: ["implementer", "reviewer"] });
  assert.equal(result.turnId, "turn-1");
  assert.deepEqual(result.speakers.map((speaker) => speaker.agentId), ["implementer", "reviewer"]);
  assert.equal(started[0]?.userMessage, "帮我改会话列表分页");
  assert.equal(started[0]?.skipUserMessage, undefined);
  assert.equal(started[1]?.skipUserMessage, true);
  assert.equal(started[1]?.authorAgentId, "reviewer");
  // 两位都要等前一位收口后才叫下一位。
  assert.deepEqual(waited, ["run-1", "run-2"]);
});

test("@ 不在群里的人被忽略；全都不在群里时报错", async () => {
  const { deps, started } = depsOf(groupSession());
  await runGroupTurn(deps, { sessionId: "s1", userMessage: "hi", mentions: ["stranger", "reviewer"] });
  assert.deepEqual(started.map((item) => item.agentId), ["reviewer"]);

  const second = depsOf(groupSession());
  await assert.rejects(
    runGroupTurn(second.deps, { sessionId: "s1", userMessage: "hi", mentions: ["stranger"] }),
    /不在群里/u,
  );
});

test("没有 @ 时由代理人单独回答", async () => {
  const { deps, started } = depsOf(groupSession());
  const result = await runGroupTurn(deps, { sessionId: "s1", userMessage: "今天做什么" });
  assert.deepEqual(result.speakers.map((speaker) => speaker.agentId), ["xiaoyu"]);
  assert.equal(started.length, 1);
});

test("发言人数按 maxSpeakersPerRound 截断", async () => {
  const { deps, started } = depsOf(groupSession({
    group: { agentIds: ["a", "b", "c"], maxSpeakersPerRound: 2 },
  }));
  const result = await runGroupTurn(deps, { sessionId: "s1", userMessage: "hi", mentions: ["a", "b", "c"] });
  assert.equal(result.speakers.length, 2);
  assert.equal(started.length, 2);
});