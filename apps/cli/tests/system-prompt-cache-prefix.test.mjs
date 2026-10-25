/**
 * 功能：验证系统提示词的稳定前缀只由账户/权限/扩展决定，动态运行上下文只追加在末尾。
 * 作用：Provider 前缀缓存依赖“前面不变、后面追加”；本回归防止把时间戳、随机数或每轮动态上下文放进前缀。
 * 关联文件：packages/core/system-prompt/src/index.ts、packages/llm/llm/src/completion.ts、agent-loop/execute-turn.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { composeLfaaSystemPrompt } from "../../../packages/core/system-prompt/src/index.ts";

const baseInput = Object.freeze({
  applicationId: "workspace",
  permissionMode: "ask",
  extensions: Object.freeze(["扩展指引 A", "扩展指引 B"]),
  systemPrompt: "本轮 Agent 指引块"
});

test("动态运行上下文只出现在系统提示末尾，重复组装逐字节一致", () => {
  const first = composeLfaaSystemPrompt({ ...baseInput, context: "<conversation-memory>[\"偏好一\"]</conversation-memory>" });
  const second = composeLfaaSystemPrompt({ ...baseInput, context: "<conversation-memory>[\"偏好二\"]</conversation-memory>" });
  const marker = "<conversation-memory>";
  const firstOffset = first.indexOf(marker);
  const secondOffset = second.indexOf(marker);
  assert.ok(firstOffset > 0 && secondOffset > 0, "动态上下文必须真正进入系统提示");
  assert.equal(first.slice(0, firstOffset), second.slice(0, secondOffset), "动态上下文之前的提示前缀必须完全一致，否则 Provider 前缀缓存无法命中");
  assert.equal(first.slice(firstOffset), "<conversation-memory>[\"偏好一\"]</conversation-memory>", "动态上下文之后不能再拼接每轮变化内容");
  // 同一输入重复组装必须逐字节一致：任何时间戳/随机数都会破坏缓存命中。
  assert.equal(composeLfaaSystemPrompt({ ...baseInput, context: "<conversation-memory>[\"偏好一\"]</conversation-memory>" }), first);
  assert.equal(composeLfaaSystemPrompt({ ...baseInput }), composeLfaaSystemPrompt({ ...baseInput }));
});

test("权限模式与扩展只影响其自身的稳定片段，不改变更早的核心前缀", () => {
  const ask = composeLfaaSystemPrompt({ ...baseInput, context: "上下文 A" });
  const full = composeLfaaSystemPrompt({ ...baseInput, permissionMode: "full_access", context: "上下文 A" });
  const corePrefix = "你是 LFAA 的小鱼智能体，简称小鱼。";
  assert.ok(ask.startsWith(corePrefix) && full.startsWith(corePrefix), "核心身份指令必须在最前且稳定");
  const askPermissionOffset = ask.indexOf("当前项目权限模式是");
  const fullPermissionOffset = full.indexOf("当前项目权限模式是");
  assert.ok(askPermissionOffset > 0 && fullPermissionOffset > 0);
  assert.equal(ask.slice(0, askPermissionOffset), full.slice(0, fullPermissionOffset), "权限模式变化只能改变权限片段及其后内容");
});

test("运行上下文始终排在 Agent 指引与扩展之后", () => {
  const text = composeLfaaSystemPrompt({ ...baseInput, context: "末尾运行上下文" });
  assert.ok(text.lastIndexOf(baseInput.systemPrompt) < text.indexOf("末尾运行上下文"), "Agent 指引块必须先于动态运行上下文");
  assert.ok(text.lastIndexOf("扩展指引 B") < text.indexOf("末尾运行上下文"), "扩展指引必须先于动态运行上下文");
  assert.ok(text.endsWith("末尾运行上下文"), "动态运行上下文是系统提示的最后一段");
});
