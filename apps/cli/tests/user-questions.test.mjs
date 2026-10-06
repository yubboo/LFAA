/** 功能：验证用户问题回答者服务。作用：覆盖通道顺序、请求隔离、取消和插件卸载。 */
import assert from "node:assert/strict";
import { Context } from "@deepseek-ai/cordis";
import test from "node:test";
import { apply as applyUserQuestions } from "lfaa-user-questions/src/index.js";

const question = {
  userId: "user-a",
  applicationId: "workspace",
  runId: "run-a",
  questionId: "11111111-1111-4111-8111-111111111111",
  question: "选择一种方案",
  options: ["方案甲", "方案乙"],
  signal: new AbortController().signal
};

function createService() {
  const context = new Context();
  applyUserQuestions(context);
  return { context, service: context.lfaaUserQuestions };
}

test("问题按优先级交给回答者，undefined 会明确让给下一通道", async () => {
  const { context, service } = createService();
  try {
    const calls = [];
    service.registerAnswerer({
      id: "test.defer",
      priority: 20,
      accepts: (input) => input.userId === "user-a" && input.applicationId === "workspace",
      async answer(input) { calls.push(["first", input.runId]); return undefined; }
    });
    service.registerAnswerer({
      id: "test.answer",
      priority: 10,
      accepts: (input) => input.runId === "run-a",
      async answer(input) { calls.push(["second", input.question]); return { answer: "方案甲", skipped: false }; }
    });
    assert.deepEqual(await service.ask(question), { answer: "方案甲", skipped: false });
    assert.deepEqual(calls, [["first", "run-a"], ["second", "选择一种方案"]]);
  } finally {
    await context.fiber.dispose();
  }
});

test("问题只交给匹配账户和 Run 的通道，并拒绝同一 Run 的并发提问", async () => {
  const { context, service } = createService();
  let started;
  const startedPromise = new Promise((resolve) => { started = resolve; });
  try {
    const dispose = service.registerAnswerer({
      id: "test.pending",
      priority: 1,
      accepts: (input) => input.userId === "user-a" && input.runId === "run-a",
      answer(input) {
        started();
        return new Promise((_resolve, reject) => input.signal.addEventListener("abort", () => reject(new DOMException("已取消", "AbortError")), { once: true }));
      }
    });
    const pending = service.ask(question);
    await startedPromise;
    await assert.rejects(service.ask(question), /已有一条待回答问题/u);
    await assert.rejects(service.ask({ ...question, userId: "user-b", runId: "run-b" }), /没有适用/u);
    dispose();
    await assert.rejects(pending, (error) => error?.name === "AbortError");
  } finally {
    await context.fiber.dispose();
  }
});

test("服务卸载取消活动回答并清空回答者", async () => {
  const { context, service } = createService();
  let started;
  const startedPromise = new Promise((resolve) => { started = resolve; });
  service.registerAnswerer({
    id: "test.unload",
    priority: 0,
    accepts: () => true,
    answer(input) {
      started();
      return new Promise((_resolve, reject) => input.signal.addEventListener("abort", () => reject(new DOMException("已卸载", "AbortError")), { once: true }));
    }
  });
  const pending = service.ask(question);
  await startedPromise;
  await context.fiber.dispose();
  await assert.rejects(pending, (error) => error?.name === "AbortError");
  await assert.rejects(service.ask(question), /已经卸载/u);
});
