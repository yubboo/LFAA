// 验证子智能体收口把结论与失败点写成团队记忆：作用域、归属会话与写入者标记。
import assert from "node:assert/strict";
import test from "node:test";
import type { AddMemoryInput, MemoryEntry, MemoryService } from "@lfaa/memory";
import { persistSubagentMemory } from "../src/subagent-service";

function fakeMemory(added: AddMemoryInput[]): MemoryService {
  return {
    addMemory: async (input: AddMemoryInput) => {
      added.push(input);
      return { ...input, id: `id-${added.length}` } as unknown as MemoryEntry;
    },
  } as unknown as MemoryService;
}

test("子智能体结论写成团队记忆，父级与兄弟可召回", async () => {
  const added: AddMemoryInput[] = [];
  await persistSubagentMemory(fakeMemory(added), { role: "调研", kind: "research", sessionId: "session-9", parentRunId: "run-1" }, {
    content: "记忆召回入口在 agent-context 的 recallAgentContext，注入前会按作用域过滤。",
    steps: [{ toolName: "grep", status: "done", title: "检索记忆调用点" }],
  });
  assert.equal(added.length, 1);
  assert.equal(added[0]?.scope, "team");
  assert.equal(added[0]?.ownerId, "session-9");
  assert.equal(added[0]?.kind, "fact");
  assert.equal(added[0]?.agentId, "subagent:research");
  assert.equal(added[0]?.source?.sessionId, "session-9");
  assert.equal(added[0]?.source?.runId, "run-1");
  assert.ok(added[0]?.content.startsWith("[子智能体 调研]"));
});

test("失败步骤额外写成踩坑记忆，过短结论不写入", async () => {
  const added: AddMemoryInput[] = [];
  await persistSubagentMemory(fakeMemory(added), { role: "编码", kind: "coder", sessionId: "session-9" }, {
    content: "写入失败：目标文件被占用，需要先释放句柄。",
    steps: [{ toolName: "edit_file", status: "error", title: "编辑文件", detail: "EBUSY: 资源被占用" }],
  });
  assert.equal(added.length, 2);
  assert.equal(added[0]?.kind, "fact");
  assert.equal(added[1]?.kind, "pitfall");
  assert.match(added[1]?.content ?? "", /edit_file 失败/u);

  const tooShort: AddMemoryInput[] = [];
  await persistSubagentMemory(fakeMemory(tooShort), { role: "调研", sessionId: "session-9" }, {
    content: "无结果",
    steps: [],
  });
  assert.equal(tooShort.length, 0);
});