// 验证中间区四个盒子互不重叠：会话区自己带底部渐隐，输入框单独一行，不再用遮罩盖住正文。
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const readCss = (relative: string) => readFile(resolve(packageRoot, relative), "utf8");

test("会话区盒子独占一行，底部渐隐画在视口内部", async () => {
  const flowCss = await readCss("client/conversation/ChatFlowArea.module.css");
  const boxRule = flowCss.match(/\.box\s*\{(?<body>[\s\S]*?)\n\}/u)?.groups?.body ?? "";
  const scrollerRule = flowCss.match(/\.scroller\s*\{(?<body>[\s\S]*?)\n\}/u)?.groups?.body ?? "";
  const fadeRule = flowCss.match(/\.fade\s*\{(?<body>[\s\S]*?)\n\}/u)?.groups?.body ?? "";

  assert.ok(boxRule && scrollerRule && fadeRule, "应能找到会话区的三块规则");
  // 会话区只占第二行，不再跨到输入区那一行。
  assert.match(boxRule, /grid-row:\s*2/u);
  // 滚动视口不再给输入区预留高度：输入区已经不叠在上面了。
  assert.doesNotMatch(scrollerRule, /chat-composer-height/u);
  // 渐隐钉在盒子底缘（不随滚动），比底部内边距矮，滚到底时最后一行不会糊在它下面。
  assert.match(fadeRule, /position:\s*absolute/u);
  assert.match(fadeRule, /inset:\s*auto 0 0 0/u);
  assert.match(fadeRule, /pointer-events:\s*none/u);
  const fadeHeight = Number(fadeRule.match(/height:\s*([\d.]+)rem/u)?.[1] ?? "0");
  const padBottom = Number(scrollerRule.match(/padding:\s*[\d.]+rem var\(--chat-side-padding\) ([\d.]+)rem/u)?.[1] ?? "0");
  assert.ok(fadeHeight > 0 && padBottom >= fadeHeight, `底部内边距(${padBottom}rem)应不小于渐隐高度(${fadeHeight}rem)`);
});

test("输入框大盒子是普通栅格行：没有遮罩层，也不吞滚动条命中", async () => {
  const dockCss = await readCss("client/conversation/ComposerDock.module.css");
  const dockRule = dockCss.match(/\.dock\s*\{(?<body>[\s\S]*?)\n\}/u)?.groups?.body ?? "";

  assert.ok(dockRule, "应能找到输入框大盒子的规则");
  assert.match(dockRule, /grid-row:\s*4/u);
  // 旧实现靠透明叠层 + pointer-events 让路，现在不需要了。
  assert.doesNotMatch(dockCss, /::before/u);
  assert.doesNotMatch(dockRule, /pointer-events/u);

  const workspaceCss = await readCss("client/conversation/ChatWorkspace.module.css");
  assert.doesNotMatch(workspaceCss, /composerDock/u);
  // 主壳层只管四行的高度，不再持有会话区与输入区的规则。
  assert.match(workspaceCss, /grid-template-rows:\s*auto minmax\(0,\s*1fr\) auto auto/u);
});

test("三条建议、顶部切换条各自独立成件", async () => {
  const suggestions = await readFile(resolve(packageRoot, "client/conversation/ChatSuggestions.tsx"), "utf8");
  const topBar = await readFile(resolve(packageRoot, "client/conversation/ChatTopBar.tsx"), "utf8");
  assert.match(suggestions, /export function ChatSuggestions/u);
  assert.match(topBar, /export function ChatTopBar/u);

  const list = await readFile(resolve(packageRoot, "client/conversation/ChatMessageList.tsx"), "utf8");
  // 引导区不再自己拼建议按钮，改成引用独立组件。
  assert.match(list, /<ChatSuggestions suggestions=\{activeSuggestions\} onPick=\{onSubmitQuestion\} \/>/u);
});