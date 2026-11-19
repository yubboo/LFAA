// 验证按模型单价把 token 用量换算成人民币成本。
import assert from "node:assert/strict";
import test from "node:test";
import { computeTokenCost, hasPricing } from "../src/cost";

test("按输入/缓存/输出单价分别计算并汇总", () => {
  const cost = computeTokenCost(
    { promptTokens: 1_000_000, cachedPromptTokens: 500_000, completionTokens: 100_000 },
    { inputPricePerMillion: 2, outputPricePerMillion: 8, cachedInputPricePerMillion: 0.2 },
  );
  assert.ok(cost);
  assert.equal(cost.currency, "CNY");
  assert.ok(Math.abs(cost.input - 1) < 1e-9);
  assert.ok(Math.abs(cost.cachedInput - 0.1) < 1e-9);
  assert.ok(Math.abs(cost.output - 0.8) < 1e-9);
  assert.ok(Math.abs(cost.amount - 1.9) < 1e-9);
});

test("缓存读取单价缺省时按输入单价计算，并按 prompt 上限截断缓存", () => {
  const cost = computeTokenCost(
    { promptTokens: 100, cachedPromptTokens: 200, completionTokens: 0 },
    { inputPricePerMillion: 1_000_000, outputPricePerMillion: 1 },
  );
  assert.ok(cost);
  assert.equal(cost.input, 0);
  assert.equal(cost.cachedInput, 100);
  assert.equal(cost.amount, 100);
});

test("没有有效单价或用量时返回 undefined", () => {
  assert.equal(computeTokenCost({ promptTokens: 10 }, undefined), undefined);
  assert.equal(computeTokenCost({ promptTokens: 10 }, { inputPricePerMillion: 0, outputPricePerMillion: 0 }), undefined);
  assert.equal(computeTokenCost({}, { inputPricePerMillion: 1, outputPricePerMillion: 1 }), undefined);
  assert.equal(hasPricing({ inputPricePerMillion: 0, outputPricePerMillion: 0, cachedInputPricePerMillion: 0 }), false);
  assert.equal(hasPricing({ inputPricePerMillion: 0, outputPricePerMillion: 0.5 }), true);
});
