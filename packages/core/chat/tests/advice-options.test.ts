// 验证智能追问提取：只从「建议/下一步」段落的列表项生成可选项，普通列表或不足两条时不出选项。
import assert from "node:assert/strict";
import test from "node:test";
import { extractAdviceOptions } from "../client/advice-options";

const withAdvice = [
  "### 建议的执行顺序",
  "",
  "1. 浏览器里打开方舟控制台，在产品内导航搜 `日志投递`",
  "2. 打开一个接入点详情页，翻所有 tab，找 `日志`",
  "3. 三步都空 → 查 IAM 权限项 → 仍空则提工单",
  "",
  "### 其他说明",
  "",
  "- 这条不属于建议段，不应出现在选项里",
].join("\n");

test("建议段落的编号列表被提取为可选项", () => {
  const options = extractAdviceOptions(withAdvice);
  assert.equal(options.length, 3);
  assert.match(options[0] ?? "", /^浏览器里打开方舟控制台/u);
  assert.match(options[2] ?? "", /^三步都空/u);
  // 行内代码标记被清理，后续段落不混入
  assert.ok(options.every((item) => !item.includes("`")));
  assert.ok(!options.some((item) => item.includes("不属于建议段")));
});

test("没有建议标题、或列表不足两条时不出选项", () => {
  assert.deepEqual(extractAdviceOptions("## 背景\n\n1. 第一点\n2. 第二点"), []);
  assert.deepEqual(extractAdviceOptions("### 建议\n\n1. 只有一条"), []);
  assert.deepEqual(extractAdviceOptions(""), []);
});

test("英文建议标题同样可提取，且选项去重", () => {
  const content = ["## Next steps", "", "1. Run the tests", "2. Run the tests", "3. Deploy"].join("\n");
  assert.deepEqual(extractAdviceOptions(content), ["Run the tests", "Deploy"]);
});