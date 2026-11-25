// 验证会话贴底判定与消息动作栏悬停契约：悬停只换配色，不改变盒模型，也不留半像素滚动缝隙。
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { isOffBottom } from "../client/conversation/useChatScroll";

test("贴底判定补齐取整尺寸留下的半像素缝隙", () => {
  // 真实底边 117.69，取整尺寸算出 118：已经在最底部，不需要再写 scrollTop。
  assert.equal(isOffBottom(117.69, 726, 608), false);
  // 只差 0.6px：旧实现按 1px 容差会放过这点缝隙，用户拿滚轮还能把正文再推开一下。
  assert.equal(isOffBottom(117.4, 726, 608), true);
  // 停在顶部时必须补写。
  assert.equal(isOffBottom(0, 702, 627), true);
  // 内容不足一屏时底边就是 0。
  assert.equal(isOffBottom(0, 627, 627), false);
});

test("消息动作栏悬停只改配色，不改变盒模型与滚动范围", async () => {
  const packageRoot = fileURLToPath(new URL("..", import.meta.url));
  const css = await readFile(resolve(packageRoot, "client/conversation/MessageActionBars.module.css"), "utf8");
  const hoverBodies = [...css.matchAll(/:hover[^{]*\{(?<body>[^}]*)\}/gu)].map((match) => match.groups?.body ?? "");

  assert.ok(hoverBodies.length > 0, "应能找到消息动作栏的悬停样式");
  for (const body of hoverBodies) {
    assert.doesNotMatch(
      body,
      /(?:^|[\s;{])(?:padding|margin|height|width|min-height|min-width|border|gap|font-size|line-height|transform|position)\s*:/u,
      `悬停样式不得改变盒模型：${body.trim()}`,
    );
  }
  // 动作栏本身不参与悬停反馈：任一按钮悬停都不能让整行高度变化。
  assert.doesNotMatch(css, /\.assistantFooter[^{]*:hover/u);
});

test("会话滚动条贴到中间栏分隔线旁，并与调宽手柄错开", async () => {
  const packageRoot = fileURLToPath(new URL("..", import.meta.url));
  const workspaceCss = await readFile(resolve(packageRoot, "client/conversation/ChatWorkspace.module.css"), "utf8");
  const rootRule = workspaceCss.match(/\.root\s*\{(?<body>[\s\S]*?)\n\}/u)?.groups?.body ?? "";
  const scrollRule = workspaceCss.match(/\.scrollArea\s*\{(?<body>[\s\S]*?)\n\}/u)?.groups?.body ?? "";

  assert.ok(rootRule && scrollRule, "应能找到会话根节点与滚动区样式");
  // 2px 空隙：滚动条右缘离分隔线 2px，既贴边又不压到调宽手柄；数值由 Shell 统一口径给出。
  assert.match(rootRule, /--chat-scrollbar-gap:\s*var\(--pane-scrollbar-gap,\s*2px\)/u);
  // 外层工作区视口为长页面预留的滚动条槽由脚本量出后收回（桌面端 10px），否则滚动条会被挤远。
  assert.match(rootRule, /margin-inline-end:\s*var\(--chat-gutter-reclaim,\s*0px\)/u);
  assert.match(scrollRule, /margin-inline-end:\s*var\(--chat-scrollbar-gap,\s*2px\)/u);
  assert.match(scrollRule, /padding-inline-end:\s*calc\(var\(--chat-side-padding\)\s*-\s*var\(--chat-scrollbar-gap,\s*2px\)\)/u);
});