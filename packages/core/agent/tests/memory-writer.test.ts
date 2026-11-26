// 验证每轮长期记忆提炼器：JSON 容错解析、字段校验、开关与触发条件、写入作用域。
import assert from "node:assert/strict";
import test from "node:test";
import type { RunLlm } from "@lfaa/agent-profile";
import type { AddMemoryInput, AgentStepTrace, MemoryEntry, MemoryService, MemorySettings } from "@lfaa/memory";
import { extractRoundMemories, parseMemoryCandidates } from "../src/run/memory-writer";

const DEFAULT_SETTINGS: MemorySettings = {
  autoExtract: true,
  maxEntries: 800,
  recallLimit: 8,
  recallBudgetChars: 1200,
};

/** 构造只实现被测方法的假记忆服务，避免测试拉起完整 Host。 */
function fakeMemory(added: AddMemoryInput[], settings: Partial<MemorySettings> = {}): MemoryService {
  return {
    getMemorySettings: async () => ({ ...DEFAULT_SETTINGS, ...settings }),
    addMemory: async (input: AddMemoryInput) => {
      added.push(input);
      return { ...input, id: `id-${added.length}` } as unknown as MemoryEntry;
    },
  } as unknown as MemoryService;
}

/** 返回固定内容的假模型，同时记录是否被调用。 */
function fakeLlm(content: string, calls: { count: number }): RunLlm {
  return {
    complete: async () => {
      calls.count += 1;
      return {
        model: "fake",
        provider: "openai-compatible",
        content,
        toolCalls: [],
        finishReason: "stop",
      };
    },
  } as unknown as RunLlm;
}

const steps: AgentStepTrace[] = [{
  id: "s1",
  iteration: 1,
  phase: "act",
  status: "done",
  title: "读取配置文件",
  detail: "已读取 package.json",
  toolName: "read_file",
  permissionLevel: "read",
  timestamp: Date.now(),
}];

test("解析提炼结果：裸 JSON、代码块与夹带说明都能识别", () => {
  const clean = parseMemoryCandidates('[{"kind":"decision","content":"记忆存储改用 JSON 文件","tags":["记忆"],"confidence":0.8}]');
  assert.equal(clean.length, 1);
  assert.equal(clean[0]?.kind, "decision");

  const fenced = parseMemoryCandidates("说明如下：\n```json\n[{\"kind\":\"pitfall\",\"content\":\"子智能体不能递归派发\"}]\n```\n以上。");
  assert.equal(fenced.length, 1);
  assert.equal(fenced[0]?.kind, "pitfall");

  assert.deepEqual(parseMemoryCandidates("没有可提炼的内容"), []);
  assert.deepEqual(parseMemoryCandidates("[{bad json"), []);
  assert.deepEqual(parseMemoryCandidates("{}"), []);
});

test("解析提炼结果：非法类型回落事实、超长截断、最多三条", () => {
  const parsed = parseMemoryCandidates(JSON.stringify([
    { kind: "unknown", content: "项目统一使用 pnpm 管理依赖", tags: ["a", 1, "b"], confidence: 2 },
    { kind: "fact", content: "x".repeat(400) },
    { kind: "fact", content: "第三条记忆内容" },
    { kind: "fact", content: "第四条应被丢弃" },
    { kind: "fact", content: "太短" },
  ]));
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0]?.kind, "fact");
  assert.equal(parsed[0]?.confidence, 1);
  assert.deepEqual(parsed[0]?.tags, ["a", "b"]);
  assert.equal(parsed[1]?.content.length, 200);
});

test("开启自动提炼时按项目作用域写入并返回轨迹步骤", async () => {
  const added: AddMemoryInput[] = [];
  const calls = { count: 0 };
  const llm = fakeLlm('[{"kind":"decision","content":"记忆方案采用本地内核 + 每轮提炼","tags":["记忆"],"confidence":0.9}]', calls);
  const step = await extractRoundMemories(fakeMemory(added), llm, {
    sessionId: "session-1",
    projectId: "proj-1",
    userMessage: "我们先确定记忆方案：本地内核加每轮提炼，不引入外部服务。",
    answer: "方案已确认，接下来按 P1 修存储并发问题，再叠加提炼与共享。",
    steps,
  });
  assert.equal(calls.count, 1);
  assert.equal(added.length, 1);
  assert.equal(added[0]?.scope, "project");
  assert.equal(added[0]?.projectId, "proj-1");
  assert.equal(added[0]?.kind, "decision");
  assert.equal(added[0]?.source?.sessionId, "session-1");
  assert.equal(step?.title, "已自动提炼长期记忆");
  assert.equal(step?.toolName, "save_memory");
});

test("关闭自动提炼时不调用模型", async () => {
  const added: AddMemoryInput[] = [];
  const calls = { count: 0 };
  const step = await extractRoundMemories(fakeMemory(added, { autoExtract: false }), fakeLlm("[]", calls), {
    sessionId: "session-1",
    userMessage: "这是一条足够长的用户消息，用来确认开关关闭后不会调用模型提炼记忆。",
    answer: "这是一条足够长的助手答复，用来确认开关关闭后不会发生任何记忆写入。",
    steps,
  });
  assert.equal(calls.count, 0);
  assert.equal(added.length, 0);
  assert.equal(step, null);
});

test("短消息且无工具调用时跳过提炼；模型异常时静默放弃", async () => {
  const added: AddMemoryInput[] = [];
  const calls = { count: 0 };
  assert.equal(await extractRoundMemories(fakeMemory(added), fakeLlm("[]", calls), {
    sessionId: "session-1",
    userMessage: "好的",
    answer: "收到，我继续处理。",
    steps: [],
  }), null);
  assert.equal(calls.count, 0);

  const brokenLlm = { complete: async () => { throw new Error("模型不可用"); } } as unknown as RunLlm;
  assert.equal(await extractRoundMemories(fakeMemory(added), brokenLlm, {
    sessionId: "session-1",
    userMessage: "请把这次确认的存储方案记录成长期记忆，方便后续会话直接复用。",
    answer: "已确认：记忆文件采用原子写与串行队列，避免并发写入互相覆盖。",
    steps,
  }), null);
  assert.equal(added.length, 0);
});