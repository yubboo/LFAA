// 验证中间区四个盒子互不重叠：会话区自己带底部渐隐，输入框单独一行，不再用遮罩盖住正文。
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const readCss = (relative: string) => readFile(resolve(packageRoot, relative), "utf8");

test("会话区滚动条直通面板最底部，底部渐隐不遮挡右侧滚动条", async () => {
  const flowCss = await readCss("client/conversation/ChatFlowArea.module.css");
  const boxRule = flowCss.match(/\.box\s*\{(?<body>[\s\S]*?)\n\}/u)?.groups?.body ?? "";
  const scrollerRule = flowCss.match(/\.scroller\s*\{(?<body>[\s\S]*?)\n\}/u)?.groups?.body ?? "";
  const fadeRule = flowCss.match(/\.fade\s*\{(?<body>[\s\S]*?)\n\}/u)?.groups?.body ?? "";

  assert.ok(boxRule && scrollerRule && fadeRule, "应能找到会话区的三块规则");
  // 会话区从第 2 行跨到面板最底部，让滚动条一路画到底。
  assert.match(boxRule, /grid-row:\s*2\s*\/\s*-1/u);
  // 滚动视口底部预留输入区高度，确保最后一条消息与建议卡片不被输入栏盖住。
  assert.match(scrollerRule, /chat-composer-height/u);
  // 渐隐钉在底缘并给右侧滚动条留通道，不吃指针。
  assert.match(fadeRule, /position:\s*absolute/u);
  assert.match(fadeRule, /pointer-events:\s*none/u);
});

test("输入框大盒子本体透传指针不挡滚动条，子控件正常命中", async () => {
  const dockCss = await readCss("client/conversation/ComposerDock.module.css");
  const dockRule = dockCss.match(/\.dock\s*\{(?<body>[\s\S]*?)\n\}/u)?.groups?.body ?? "";
  const childRule = dockCss.match(/\.dock\s*>\s*\*\s*\{(?<body>[\s\S]*?)\n\}/u)?.groups?.body ?? "";

  assert.ok(dockRule && childRule, "应能找到输入框大盒子及子控件命中规则");
  assert.match(dockRule, /grid-row:\s*4/u);
  assert.match(dockRule, /pointer-events:\s*none/u);
  assert.match(childRule, /pointer-events:\s*auto/u);

  const workspaceCss = await readCss("client/conversation/ChatWorkspace.module.css");
  assert.doesNotMatch(workspaceCss, /composerDock/u);
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