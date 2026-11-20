// 验证 Markdown 建议标题判定：命中建议/下一步类标题用强调样式，普通标题不受影响。
import assert from "node:assert/strict";
import test from "node:test";
import { isAdviceHeading } from "../client/markdown-parser";

test("建议/下一步类标题命中强调样式", () => {
  for (const heading of [
    "建议的执行顺序",
    "下一步计划",
    "推荐方案",
    "可改进点",
    "后续步骤",
    "行动项",
    "Suggestion: next steps",
    "Recommended plan",
  ]) {
    assert.equal(isAdviceHeading(heading), true, heading);
  }
});

test("普通标题不命中强调样式", () => {
  for (const heading of ["已验证的事实", "背景", "实现细节", "测试结果", "Hello world", ""]) {
    assert.equal(isAdviceHeading(heading), false, heading);
  }
});