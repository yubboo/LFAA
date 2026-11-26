// 验证交接验收：最短长度、JSON 可解析、必含字段与重试提示的构造。
import assert from "node:assert/strict";
import test from "node:test";
import { buildGuardrail, checkDelivery } from "../src/guardrail";

test("普通交付只检查最小长度", () => {
  const guardrail = buildGuardrail("一份不少于 5 条建议的清单");
  assert.equal(guardrail.expectJson, false);
  assert.deepEqual(guardrail.required, []);
  assert.equal(checkDelivery("这份交付内容写得足够长，超过了四十个字符的最小长度要求，可以直接交接给下游任务继续处理。", guardrail).ok, true);
  assert.equal(checkDelivery("太短", guardrail).ok, false);
});

test("交付要求 JSON 时，带说明文字的 JSON 块也能通过", () => {
  const guardrail = buildGuardrail("输出 JSON 数组，列出 3 条风险");
  assert.equal(guardrail.expectJson, true);
  assert.equal(checkDelivery('[{"risk":"依赖过旧"}]', guardrail).ok, true);
  assert.equal(checkDelivery('结果如下：\n```json\n[{"risk":"依赖过旧"}]\n```', guardrail).ok, true);
  const bad = checkDelivery("这里没有 JSON，只是一段足够长的说明文字，用来确认校验会失败。", guardrail);
  assert.equal(bad.ok, false);
  assert.match(bad.reason ?? "", /合法 JSON/u);
});

test("必须包含的字段逐项检查", () => {
  const guardrail = buildGuardrail("必须包含：结论、依据、下一步。不少于一段");
  assert.deepEqual(guardrail.required, ["结论", "依据", "下一步"]);
  const text = "结论：存储方案可行。依据：已完成并发写入验证与旧格式兼容检查。下一步：补上向量召回，并在真实数据上量测召回命中率。";
  assert.equal(checkDelivery(text, guardrail).ok, true);
  const missing = checkDelivery("结论：可行。但内容长度足够长，只是漏掉了后面的部分。", guardrail);
  assert.equal(missing.ok, false);
  assert.match(missing.reason ?? "", /依据/u);
  assert.match(missing.reason ?? "", /下一步/u);
});

test("多个失败原因会合并成一条原因", () => {
  const guardrail = buildGuardrail("必须包含：摘要");
  const result = checkDelivery("短", guardrail);
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /过短/u);
  assert.match(result.reason ?? "", /摘要/u);

  const jsonGuardrail = buildGuardrail("必须包含：摘要，并输出 JSON");
  const jsonResult = checkDelivery("短", jsonGuardrail);
  assert.equal(jsonResult.ok, false);
  assert.match(jsonResult.reason ?? "", /JSON/u);
  assert.match(jsonResult.reason ?? "", /摘要/u);
});
test("清单类短交付默认放行，显式「不少于 N 字」时才卡长度", () => {
  const list = "- docs/.gitkeep\n- package.json\n- README.md";
  assert.equal(checkDelivery(list, buildGuardrail("Markdown 无序列表")).ok, true);

  const strict = buildGuardrail("不少于 60 字的说明");
  assert.equal(strict.minChars, 60);
  const result = checkDelivery(list, strict);
  assert.equal(result.ok, false);
  assert.match(result.reason ?? "", /过短/u);
});