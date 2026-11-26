// 验证 crew 串行执行器：依赖顺序、上游交付注入、验收重试、失败跳过与运行期记忆归档。
import assert from "node:assert/strict";
import test from "node:test";
import type { AddMemoryInput, MemoryEntry, MemoryService } from "@lfaa/memory";
import { runCrew, type CrewTaskInvocation } from "../src/crew-runner";
import type { CrewRunSpec } from "../src/types";

const LONG = "这是一段足够长的交付内容，用来满足最小长度校验，并且能够被下游任务直接复用。";

/** 记录写入与归档的假记忆服务。 */
function fakeMemory() {
  const added: AddMemoryInput[] = [];
  const archived: Array<{ runId: string; sessionId: string }> = [];
  const memory = {
    addMemory: async (input: AddMemoryInput) => {
      added.push(input);
      return { ...input, id: `m-${added.length}` } as unknown as MemoryEntry;
    },
    archiveRunMemories: async (runId: string, sessionId: string) => {
      archived.push({ runId, sessionId });
      return 1;
    },
  } as unknown as Pick<MemoryService, "addMemory" | "archiveRunMemories">;
  return { memory, added, archived };
}

const spec: CrewRunSpec = {
  goal: "整理记忆系统的升级建议",
  tasks: [
    { id: "draft", description: "写建议", expectedOutput: "一份建议清单", dependsOn: ["research"] },
    { id: "research", description: "调研现状", expectedOutput: "调研结论" },
  ],
};

test("按依赖顺序执行，上游交付只注入下游任务", async () => {
  const { memory, added, archived } = fakeMemory();
  const invocations: CrewTaskInvocation[] = [];
  const result = await runCrew({
    memory,
    sessionId: "session-1",
    runTask: async (invocation) => {
      invocations.push(invocation);
      return { subagentId: `sub-${invocation.taskId}`, output: `${invocation.taskId} 的交付：${LONG}` };
    },
  }, spec);

  assert.deepEqual(invocations.map((item) => item.taskId), ["research", "draft"]);
  assert.equal(invocations[0]?.prompt.includes("### draft"), false);
  assert.match(invocations[1]?.prompt ?? "", /### research/u);
  assert.match(invocations[1]?.prompt ?? "", /research 的交付/u);
  assert.equal(result.ok, true);
  assert.equal(result.tasks.length, 2);
  assert.equal(result.finalOutput.includes("draft 的交付"), true);
  assert.equal(added.length, 2);
  assert.equal(added[0]?.scope, "run");
  assert.equal(added[0]?.ownerId, result.runId);
  assert.equal(archived.length, 1);
  assert.equal(archived[0]?.sessionId, "session-1");
  assert.equal(archived[0]?.runId, result.runId);
});

test("验收失败后带原因重试一次，第二次通过", async () => {
  const { memory } = fakeMemory();
  const prompts: string[] = [];
  let attempt = 0;
  const result = await runCrew({
    memory,
    sessionId: "session-1",
    runTask: async (invocation) => {
      prompts.push(invocation.prompt);
      attempt += 1;
      return attempt === 1
        ? { output: "只有一句很短的交付，既没有关键词也不够长。" }
        : { output: `结论：可行。依据：已验证。${LONG}` };
    },
  }, {
    goal: "核对方案",
    tasks: [{ id: "check", description: "核对", expectedOutput: "必须包含：依据" }],
  });

  assert.equal(prompts.length, 2);
  assert.match(prompts[1] ?? "", /未通过校验/u);
  assert.equal(result.tasks[0]?.status, "done");
  assert.equal(result.tasks[0]?.validation.attempts, 2);
  assert.equal(result.ok, true);
});

test("两次验收都失败则任务失败，依赖它的任务跳过且不归档成功记忆", async () => {
  const { memory, added } = fakeMemory();
  let calls = 0;
  const result = await runCrew({
    memory,
    sessionId: "session-1",
    runTask: async () => {
      calls += 1;
      return { output: "太短" };
    },
  }, {
    goal: "先写再核对",
    tasks: [
      { id: "draft", description: "写", expectedOutput: "必须包含：依据" },
      { id: "review", description: "核对", expectedOutput: "核对结论", dependsOn: ["draft"] },
    ],
  });

  assert.equal(calls, 2);
  assert.equal(result.ok, false);
  assert.equal(result.tasks[0]?.status, "failed");
  assert.equal(result.tasks[1]?.status, "skipped");
  assert.equal(result.finalOutput, "");
  assert.equal(added.length, 0);
});

test("运行已中止时所有任务标记跳过", async () => {
  const { memory, archived } = fakeMemory();
  const controller = new AbortController();
  controller.abort();
  const result = await runCrew({
    memory,
    sessionId: "session-1",
    signal: controller.signal,
    runTask: async () => ({ output: LONG }),
  }, spec);

  assert.equal(result.ok, false);
  assert.ok(result.tasks.every((item) => item.status === "skipped"));
  assert.equal(archived.length, 1);
});