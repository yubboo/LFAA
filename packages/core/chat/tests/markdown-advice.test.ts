// 验证 Markdown 建议标题判定：命中建议/下一步类标题用强调样式，普通标题不受影响。
import assert from "node:assert/strict";
import test from "node:test";
import { isAdviceHeading, isAdviceLeadIn } from "../client/markdown-parser";

test("建议/下一步类标题命中强调样式", () => {
  for (const heading of [
    "建议的执行顺序",
    "下一步计划",
    "推荐方案",
    "可改进点",
    "后续步骤",
    "行动项",
    "修正后的查找顺序",
    "排查步骤",
    "检查清单",
    "Suggestion: next steps",
    "Recommended plan",
  ]) {
    assert.equal(isAdviceHeading(heading), true, heading);
  }
});

test("普通标题不命中强调样式", () => {
  for (const heading of ["已验证的事实", "本轮结论", "背景", "实现细节", "测试结果", "数据说明", "Hello world", ""]) {
    assert.equal(isAdviceHeading(heading), false, heading);
  }
});

test("段落引导句只认明确行动词，事实说明不转可点选项", () => {
  for (const lead of ["文档这轮还确认了两点，这和前面说的一致：", "建议的执行顺序：", "下一步计划：", "排查步骤："]) {
    assert.equal(isAdviceLeadIn(lead), /建议|下一步|计划|顺序|步骤|排查/u.test(lead), lead);
  }
  assert.equal(isAdviceLeadIn("文档这轮还确认了两点，这和前面说的一致："), false);
  assert.equal(isAdviceLeadIn("建议先做这三件事："), true);
});
