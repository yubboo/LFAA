/**
 * 功能：验证所有模型共用稳定系统提示，并把每轮变化的运行上下文放在当前用户消息末端。
 * 作用：保护历史前缀可复用，同时确保运行上下文不进入规范对话历史。
 * 关联文件：packages/core/system-prompt/src/index.ts、packages/llm/llm/src/completion.ts、agent-loop/execute-turn.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { composeLfaaSystemPrompt } from "../../../packages/core/system-prompt/src/index.ts";
import { prepareAiCompletionMessages, stripAiCompletionRuntimeContext } from "../../../packages/llm/llm/src/completion.ts";

const baseInput = Object.freeze({
  applicationId: "workspace",
  permissionMode: "ask",
  extensions: Object.freeze(["扩展指引 A", "扩展指引 B"]),
  systemPrompt: "本轮 Agent 指引块"
});

test("运行上下文变化不改变系统提示，重复组装逐字节一致", () => {
  const first = composeLfaaSystemPrompt({ ...baseInput, context: "上下文 A" });
  const second = composeLfaaSystemPrompt({ ...baseInput, context: "上下文 B" });
  assert.equal(first, second, "运行上下文不能进入每条历史消息之前的 system 前缀");
  assert.equal(first.includes("上下文 A"), false);
  assert.equal(first.includes("上下文 B"), false);
  assert.match(first, /LFAA_RUNTIME_CONTEXT_JSON_V1/u, "稳定 system 必须说明运行上下文的固定协议与信任边界");
  assert.equal(composeLfaaSystemPrompt({ ...baseInput }), first);
});

test("模型路由变化不会关闭或重置系统级缓存友好请求布局", () => {
  const messages = [{ role: "user", content: "同一条用户输入" }];
  const signal = new AbortController().signal;
  const prepareForRoute = account => prepareAiCompletionMessages({
    ...baseInput,
    account,
    settings: {},
    signal,
    messages,
    onDelta() {},
    onProgress() {},
    context: "同一段运行上下文"
  });
  const firstRoute = prepareForRoute({ accountId: "account-a", providerId: "deepseek", modelId: "flash" });
  const secondRoute = prepareForRoute({ accountId: "account-b", providerId: "other", modelId: "large" });
  assert.deepEqual(firstRoute, secondRoute, "模型路由只选择实际 Provider，不改变共享缓存前缀布局");
  assert.equal(firstRoute[0].role, "system");
  assert.match(firstRoute.at(-1).content, /^LFAA_RUNTIME_CONTEXT_JSON_V1/u);
});

test("权限模式与扩展只影响其自身的提示片段", () => {
  const ask = composeLfaaSystemPrompt(baseInput);
  const full = composeLfaaSystemPrompt({ ...baseInput, permissionMode: "full_access" });
  const corePrefix = "你是 LFAA 的小鱼智能体，简称小鱼。";
  assert.ok(ask.startsWith(corePrefix) && full.startsWith(corePrefix), "核心身份指令必须在最前且稳定");
  const askPermissionOffset = ask.indexOf("当前项目权限模式是");
  const fullPermissionOffset = full.indexOf("当前项目权限模式是");
  assert.ok(askPermissionOffset > 0 && fullPermissionOffset > 0);
  assert.equal(ask.slice(0, askPermissionOffset), full.slice(0, fullPermissionOffset), "权限模式变化只能改变权限片段及其后内容");
});

test("请求上下文排在当前输入前，压缩后的规范历史恢复原始用户内容", () => {
  const original = [
    { role: "user", content: "上轮问题" },
    { role: "assistant", content: "上轮回答" },
    { role: "user", content: "当前问题" }
  ];
  const prepared = prepareAiCompletionMessages({
    ...baseInput,
    account: {},
    settings: {},
    signal: new AbortController().signal,
    messages: original,
    onDelta() {},
    onProgress() {},
    context: "每轮动态 Git 与工作区上下文"
  });
  assert.equal(prepared[0].role, "system");
  assert.equal(prepared[1].content, "上轮问题", "前序历史必须保持原样，缓存可以复用到当前输入之前");
  assert.equal(prepared.at(-1).role, "user");
  assert.match(prepared.at(-1).content, /^LFAA_RUNTIME_CONTEXT_JSON_V1/u);
  assert.match(prepared.at(-1).content, /每轮动态 Git 与工作区上下文/u);
  assert.match(prepared.at(-1).content, /LFAA_CURRENT_USER_INPUT_V1\n当前问题$/u);
  assert.deepEqual(stripAiCompletionRuntimeContext(prepared.slice(1)), original);
});

test("多模态用户消息的临时上下文可在压缩同步后移除", () => {
  const original = [{ role: "user", content: [
    { type: "text", text: "请看这张图" },
    { type: "image_url", image_url: { url: "data:image/png;base64,AA==" } }
  ] }];
  const prepared = prepareAiCompletionMessages({
    ...baseInput,
    account: {},
    settings: {},
    signal: new AbortController().signal,
    messages: original,
    onDelta() {},
    onProgress() {},
    context: "工作区上下文"
  });
  assert.match(prepared[1].content[0].text, /工作区上下文/u);
  assert.deepEqual(stripAiCompletionRuntimeContext(prepared.slice(1)), original);
});
