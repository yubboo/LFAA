// 验证发言计划的解析/校验，以及编排层「计划通过就照做、不通过就降级」的行为。
import assert from "node:assert/strict";
import test from "node:test";
import type { ChatSessionRecord } from "@lfaa/memory";
import {
  extractPlanJson,
  runGroupTurn,
  validateSpeakingPlan,
  type GroupTurnDeps,
} from "../src/index";

const MEMBERS = ["reviewer", "implementer"];

test("从围栏或混合文本里抠出计划 JSON", () => {
  const fenced = "```json\n{\"speakers\":[{\"agentId\":\"reviewer\",\"task\":\"审查\"}]}\n```";
  assert.deepEqual(extractPlanJson(fenced), { speakers: [{ agentId: "reviewer", task: "审查" }] });
  const mixed = "我先看一下。{\"speakers\":[]} 以上。";
  assert.deepEqual(extractPlanJson(mixed), { speakers: [] });
  assert.equal(extractPlanJson("没有 JSON"), undefined);
  assert.equal(extractPlanJson("{ 坏 json"), undefined);
});

test("合法计划通过校验并保留期望产出", () => {
  const result = validateSpeakingPlan(
    { speakers: [{ agentId: "reviewer", task: "审查边界", expect: "问题清单" }], reason: "先审后改" },
    { members: MEMBERS, maxSpeakers: 3 },
  );
  assert.equal(result.ok, true);
  assert.deepEqual(result.plan?.speakers, [{ agentId: "reviewer", task: "审查边界", expect: "问题清单" }]);
  assert.equal(result.plan?.reason, "先审后改");
});

test("计划校验逐条拒绝：非成员、空任务、超员、重复、空名单", () => {
  const stranger = validateSpeakingPlan({ speakers: [{ agentId: "ghost", task: "x" }] }, { members: MEMBERS, maxSpeakers: 3 });
  assert.equal(stranger.ok, false);
  assert.deepEqual(stranger.issues, ["unknown-agent", "empty"]);

  const noTask = validateSpeakingPlan({ speakers: [{ agentId: "reviewer", task: "   " }] }, { members: MEMBERS, maxSpeakers: 3 });
  assert.equal(noTask.ok, false);
  assert.ok(noTask.issues.includes("missing-task"));

  const tooMany = validateSpeakingPlan(
    { speakers: [{ agentId: "reviewer", task: "a" }, { agentId: "implementer", task: "b" }] },
    { members: MEMBERS, maxSpeakers: 1 },
  );
  assert.equal(tooMany.ok, false);
  assert.ok(tooMany.issues.includes("too-many"));

  const duplicate = validateSpeakingPlan(
    { speakers: [{ agentId: "reviewer", task: "a" }, { agentId: "reviewer", task: "b" }] },
    { members: MEMBERS, maxSpeakers: 3 },
  );
  assert.equal(duplicate.ok, false);
  assert.ok(duplicate.issues.includes("duplicate-agent"));

  const empty = validateSpeakingPlan({ speakers: [] }, { members: MEMBERS, maxSpeakers: 3 });
  assert.equal(empty.ok, false);
  assert.deepEqual(empty.issues, ["empty"]);
});

/** 构造群会话。 */
function session(): ChatSessionRecord {
  return {
    id: "s1",
    title: "群",
    projectId: null,
    sectionId: null,
    pinned: false,
    archived: false,
    messageCount: 0,
    createdAt: 0,
    updatedAt: 0,
    messages: [],
    kind: "group",
    group: { agentIds: MEMBERS, hostAgentId: "xiaoyu", maxSpeakersPerRound: 3, memberMaxSteps: 12 },
  };
}

/** 记录调用的替身；plan 可自定义返回或抛错。 */
function harness(plan?: (input: { hostAgentId: string }) => Promise<string>) {
  const started: Array<{ agentId?: string; speakerTask?: string }> = [];
  const planCalls: string[] = [];
  const deps: GroupTurnDeps = {
    memory: { async getSession() { return session(); } },
    agent: {
      async startRun(input) {
        started.push({
          ...(input.agentId ? { agentId: input.agentId } : {}),
          ...(input.speakerTask ? { speakerTask: input.speakerTask } : {}),
        });
        return { runId: `run-${started.length}`, sessionId: "s1", assistantMessageId: "a1", workspaceRoots: [] };
      },
      async waitForRun() {},
    },
    ...(plan ? {
      plan: async (input) => {
        planCalls.push(input.hostAgentId);
        return plan(input);
      },
    } : {}),
    describeMembers: async (ids) => ids.map((id) => ({ id, name: id === "reviewer" ? "审查员" : "实现者" })),
    newTurnId: () => "turn-1",
  };
  return { deps, started, planCalls };
}

test("计划通过时按计划发言，并把任务写进每条消息", async () => {
  const { deps, started } = harness(async () => JSON.stringify({
    speakers: [
      { agentId: "reviewer", task: "审查 setSession 边界" },
      { agentId: "implementer", task: "按清单修" },
    ],
  }));
  const result = await runGroupTurn(deps, { sessionId: "s1", userMessage: "修一下分页" });
  assert.deepEqual(started, [
    { agentId: "reviewer", speakerTask: "审查 setSession 边界" },
    { agentId: "implementer", speakerTask: "按清单修" },
  ]);
  assert.equal(result.plan?.speakers.length, 2);
  assert.equal(result.planIssues, undefined);
});

test("计划不合法时降级为代理人单答，并带回原因", async () => {
  const { deps, started } = harness(async () => JSON.stringify({ speakers: [{ agentId: "ghost", task: "x" }] }));
  const result = await runGroupTurn(deps, { sessionId: "s1", userMessage: "修一下分页" });
  assert.deepEqual(started.map((item) => item.agentId), ["xiaoyu"]);
  assert.equal(result.plan, undefined);
  assert.ok(result.planIssues?.includes("unknown-agent"));
});

test("代理人输出不是 JSON 时同样降级，不抛错", async () => {
  const { deps, started } = harness(async () => "我觉得可以让审查员先看看");
  const result = await runGroupTurn(deps, { sessionId: "s1", userMessage: "修一下分页" });
  assert.deepEqual(started.map((item) => item.agentId), ["xiaoyu"]);
  assert.deepEqual(result.planIssues, ["not-json"]);
});

test("代理人调用本身失败时降级，不把群聊炸掉", async () => {
  const { deps, started } = harness(async () => {
    throw new Error("模型超时");
  });
  const result = await runGroupTurn(deps, { sessionId: "s1", userMessage: "修一下分页" });
  assert.deepEqual(started.map((item) => item.agentId), ["xiaoyu"]);
  assert.deepEqual(result.planIssues, ["not-json"]);
});

test("用户显式 @ 时不打扰代理人", async () => {
  const { deps, planCalls } = harness(async () => JSON.stringify({ speakers: [{ agentId: "reviewer", task: "审查" }] }));
  await runGroupTurn(deps, { sessionId: "s1", userMessage: "看下这个", mentions: ["implementer"] });
  assert.deepEqual(planCalls, []);
});