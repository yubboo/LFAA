/**
 * 功能：验证上下文分项估算使用本次实际消息与工具定义。
 * 作用：确保图片请求显式标注并计入保守的固定预算，估算总量由分项相加得到。
 * 关联文件：packages/llm/token-meter/src/estimate.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { estimateContextBreakdown } from "../../../packages/llm/token-meter/src/estimate.ts";

test("上下文估算根据实际请求消息和工具 schema 分项", () => {
  const result = estimateContextBreakdown([
    { role: "system", content: "system" },
    { role: "user", content: [{ type: "text", text: "four" }, { type: "image_url", image_url: { url: "data:image/png;base64,AA==" } }] }
  ], [{ type: "function", function: { name: "read_file", description: "read", parameters: { type: "object", properties: {} } } }]);

  assert.equal(result.systemTokens, 7);
  // 文本 6 tokens + 图片保守折算 1200 tokens：大图请求必须进入预算，不能算 0。
  assert.equal(result.messageTokens, 1206);
  assert.ok(result.toolsTokens > 0);
  assert.equal(result.estimatedPromptTokens, result.systemTokens + result.toolsTokens + result.messageTokens);
  assert.equal(result.includesImages, true);
});
