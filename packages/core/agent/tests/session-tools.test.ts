// 验证会话可见性工具：项目隔离、会话行格式、消息/步骤摘要与有界等待。
import assert from "node:assert/strict";
import test from "node:test";
import type { Context } from "@deepseek-ai/cordis";
import type { ChatSessionRecord } from "@lfaa/memory";
import {
  formatSessionLine,
  registerAgentSessionTools,
  sameProject,
  truncateText,
  waitForSessionEnd,
  type SessionToolDeps,
} from "../src/tools/session-tools";

type ToolDef = {
  name: string;
  execute: (args: Record<string, unknown>, execCtx: { sessionId: string }) => Promise<{ ok: boolean; output: string; summary: string }>;
};

function session(id: string, projectId: string | null, patch: Partial<ChatSessionRecord> = {}): ChatSessionRecord {
  return {
    id,
    title: id,
    projectId,
    messages: [],
    createdAt: 1,
    updatedAt: 1,
    archived: false,
    ...patch,
  } as unknown as ChatSessionRecord;
}

function toolsFor(deps: SessionToolDeps): Record<string, ToolDef> {
  const captured: ToolDef[] = [];
  const fakeCtx = {
    tools: {
      registerTool: (definition: ToolDef) => {
        captured.push(definition);
        return () => undefined;
      },
    },
  } as unknown as Context;
  registerAgentSessionTools(fakeCtx, deps);
  return Object.fromEntries(captured.map((definition) => [definition.name, definition]));
}

test("项目隔离与文本截断", () => {
  assert.equal(sameProject("p1", "p1"), true);
  assert.equal(sameProject(null, undefined), true);
  assert.equal(sameProject("p1", "p2"), false);
  assert.equal(truncateText("  a \n b  "), "a b");
  assert.equal(truncateText("x".repeat(10), 4), "xxxx…");
});

test("list_sessions 只列同项目会话并标出运行中与目标", async () => {
  const sessions = new Map([
    ["s1", session("s1", "p1")],
    ["s2", session("s2", "p1", { worktree: { id: "wt", projectId: "p1", branch: "feature", path: "C:/w", repositoryRoot: "C:/repo" } })],
    ["s3", session("s3", "p2")],
  ]);
  const tools = toolsFor({
    listSessions: async () => [...sessions.values()],
    getSession: async (id) => sessions.get(id) ?? null,
    isRunning: (id) => id === "s2",
    listActiveGoals: async () => [{
      id: "g1", sessionId: "s2", title: "目标一", objective: "o", status: "active", autoContinue: true, rounds: 0, maxRounds: 10,
    }],
  });
  const result = await tools.list_sessions!.execute({}, { sessionId: "s1" });
  assert.equal(result.ok, true);
  assert.match(result.output, /s2/u);
  assert.match(result.output, /运行中/u);
  assert.match(result.output, /工作树 feature/u);
  assert.match(result.output, /目标一/u);
  assert.doesNotMatch(result.output, /s3/u);
});

test("read_session_events 读取同项目会话的消息与最近步骤", async () => {
  const target = session("s2", "p1", {
    messages: [
      { id: "m1", role: "user", content: "改一下配置", createdAt: 1 },
      {
        id: "m2",
        role: "assistant",
        content: "已完成配置修改。",
        createdAt: 2,
        steps: [{ id: "st1", iteration: 1, phase: "act", status: "done", title: "编辑配置文件", toolName: "edit_file", timestamp: 2 }],
      },
    ],
  } as unknown as Partial<ChatSessionRecord>);
  const sessions = new Map([["s1", session("s1", "p1")], ["s2", target], ["s3", session("s3", "p2")]]);
  const tools = toolsFor({
    listSessions: async () => [...sessions.values()],
    getSession: async (id) => sessions.get(id) ?? null,
    isRunning: () => false,
    listActiveGoals: async () => [],
  });

  const ok = await tools.read_session_events!.execute({ sessionId: "s2", limit: 5 }, { sessionId: "s1" });
  assert.equal(ok.ok, true);
  assert.match(ok.output, /改一下配置/u);
  assert.match(ok.output, /最近步骤/u);
  assert.match(ok.output, /编辑配置文件/u);

  const denied = await tools.read_session_events!.execute({ sessionId: "s3" }, { sessionId: "s1" });
  assert.equal(denied.ok, false);
  assert.match(denied.output, /同一项目/u);
});

test("wait_for_session 拒绝等待自己，空闲时立即返回", async () => {
  const sessions = new Map([["s1", session("s1", "p1")], ["s2", session("s2", "p1")]]);
  const tools = toolsFor({
    listSessions: async () => [...sessions.values()],
    getSession: async (id) => sessions.get(id) ?? null,
    isRunning: () => false,
    listActiveGoals: async () => [],
  });
  const self = await tools.wait_for_session!.execute({ sessionId: "s1" }, { sessionId: "s1" });
  assert.equal(self.ok, false);
  assert.match(self.output, /不能等待当前会话/u);

  const idle = await tools.wait_for_session!.execute({ sessionId: "s2" }, { sessionId: "s1" });
  assert.equal(idle.ok, true);
  assert.match(idle.output, /空闲/u);
});

test("有界等待：超时与结束都能如实返回", async () => {
  let clock = 0;
  const sleep = async (ms: number) => { clock += ms; };
  const timedOut = await waitForSessionEnd({
    isRunning: () => clock < 500,
    timeoutMs: 100,
    intervalMs: 100,
    sleep,
    now: () => clock,
  });
  assert.deepEqual(timedOut, { timedOut: true, waitedMs: 100 });

  clock = 0;
  const finished = await waitForSessionEnd({
    isRunning: () => clock < 300,
    timeoutMs: 1000,
    intervalMs: 100,
    sleep,
    now: () => clock,
  });
  assert.deepEqual(finished, { timedOut: false, waitedMs: 300 });
});

test("会话行包含工作树、目标与当前标记", () => {
  const line = formatSessionLine(session("s1", "p1", {
    title: "会话一",
    worktree: { id: "wt", projectId: "p1", branch: "feature/x", path: "C:/w", repositoryRoot: "C:/repo" },
  }), {
    running: true,
    current: true,
    goal: { id: "g1", title: "目标一", objective: "o", status: "active", autoContinue: true, rounds: 0, maxRounds: 10 },
  });
  assert.match(line, /会话一/u);
  assert.match(line, /运行中/u);
  assert.match(line, /工作树 feature\/x/u);
  assert.match(line, /目标一/u);
  assert.match(line, /当前会话/u);
});