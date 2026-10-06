/** 功能：回归用户提问工具插件的参数与问题通道边界。作用：避免未绑定 Run 时泄露或伪造回答。关联文件：packages/interaction/tool-ask-user/src/index.ts。 */
import test from "node:test";
import assert from "node:assert/strict";

const { askUserTool, apply: applyAskUserPlugin, inject } = await import("lfaa-tool-ask-user/src/index.js");

test("用户提问工具严格校验问题和选项", () => {
  assert.deepEqual(askUserTool.parse({ question: "选择目标", options: ["方案甲", "方案乙"] }), {
    question: "选择目标", options: ["方案甲", "方案乙"]
  });
  assert.throws(() => askUserTool.parse({ question: "选择目标", options: ["方案甲"] }), /2 至 4 个/u);
  assert.throws(() => askUserTool.parse({ question: "选择目标", options: ["方案甲", "方案乙"], ignored: true }), /问题参数无效/u);
});

test("用户提问工具只使用当前 Run 注入的问题通道", async () => {
  const parameters = askUserTool.parse({ question: "选择目标", options: ["方案甲", "方案乙"] });
  await assert.rejects(askUserTool.execute(parameters, {}), /未提供用户问题通道/u);
  const result = await askUserTool.execute(parameters, {
    askUser: async (question, options) => ({ answer: `${question}:${options[1]}`, skipped: false })
  });
  assert.deepEqual(result, { answer: "选择目标:方案乙", skipped: false });
});

test("问题能力由可卸载的核心插件登记", async () => {
  const { listRegisteredAiTools, registerAiBusinessTool } = await import("lfaa-tools/src/registry.js");
  const cleanups = [];
  const owner = {
    effect(effect) {
      const cleanup = effect();
      if (cleanup) cleanups.push(cleanup);
    },
    lfaaTools: { registerTool: registerAiBusinessTool }
  };
  assert.deepEqual(inject, ["lfaaTools"]);
  applyAskUserPlugin(owner);
  assert.equal(listRegisteredAiTools().some(tool => tool.id === "interaction.ask-user"), true);
  for (const cleanup of cleanups.reverse()) cleanup();
  assert.equal(listRegisteredAiTools().some(tool => tool.id === "interaction.ask-user"), false);
});
