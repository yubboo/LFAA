// 验证系统提示词服务的排序、替换、注销、异步求值与容错。
import assert from "node:assert/strict";
import { Context } from "@deepseek-ai/cordis";
import test from "node:test";
import { PromptService } from "../src/index";

test("按 order 升序、同序按注册先后拼接，空段跳过", async () => {
  const service = new PromptService(new Context());
  service.registerSegment({ id: "b", order: 20, text: "第二段" });
  service.registerSegment({ id: "a", order: 10, text: "第一段" });
  service.registerSegment({ id: "c", order: 30, text: "   " });
  service.registerSegment({ id: "d", order: 20, text: "同序靠后" });
  assert.equal(await service.compose(), "第一段\n\n第二段\n\n同序靠后");
});

test("同 id 重复注册即替换，注销后不再出现", async () => {
  const service = new PromptService(new Context());
  const dispose = service.registerSegment({ id: "policy", text: "旧内容" });
  service.registerSegment({ id: "policy", text: "新内容" });
  assert.equal(await service.compose(), "新内容");
  assert.deepEqual(service.list().map((item) => item.id), ["policy"]);
  dispose();
  assert.equal(await service.compose(), "");
});

test("异步段落参与合成，失败段落被跳过而不影响整体", async () => {
  const service = new PromptService(new Context());
  service.registerSegment({ id: "ok", order: 1, text: async () => "异步段落" });
  service.registerSegment({ id: "bad", order: 2, text: () => { throw new Error("boom"); } });
  service.registerSegment({ id: "last", order: 3, text: "末尾" });
  assert.equal(await service.compose(), "异步段落\n\n末尾");
});

test("空 id 被拒绝，list 带 order 摘要", () => {
  const service = new PromptService(new Context());
  assert.throws(() => service.registerSegment({ id: "  ", text: "x" }), /id 不能为空/u);
  service.registerSegment({ id: "x", order: 7, text: "x" });
  assert.deepEqual(service.list(), [{ id: "x", order: 7 }]);
});