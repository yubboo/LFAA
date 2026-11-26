// 验证 @lfaa/ui-primitives 共享交互原语包导出、步进比值计算及包边界契约。
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { clampStepIndex, computeStepRatio } from "../src/index";

test("ui-primitives 正确计算离散滑块步进百分比与索引边界", () => {
  assert.equal(computeStepRatio(0, 5), 0);
  assert.equal(computeStepRatio(2, 5), 50);
  assert.equal(computeStepRatio(4, 5), 100);
  assert.equal(computeStepRatio(0, 1), 100);
  assert.equal(clampStepIndex(-3, 4), 0);
  assert.equal(clampStepIndex(9, 4), 3);
});

test("ui-primitives client 入口完整导出 ModalDialog / PopoverCard / StepSliderPopover", async () => {
  const pkgRoot = fileURLToPath(new URL("..", import.meta.url));
  const pkgJson = JSON.parse(await readFile(resolve(pkgRoot, "package.json"), "utf8")) as {
    name: string;
    exports: Record<string, string>;
  };
  assert.equal(pkgJson.name, "@lfaa/ui-primitives");
  assert.equal(pkgJson.exports["./client"], "./client/index.tsx");

  const clientEntry = await readFile(resolve(pkgRoot, "client/index.tsx"), "utf8");
  assert.match(clientEntry, /CollapsePane/);
  assert.match(clientEntry, /ContextMenu/);
  assert.match(clientEntry, /ModalDialog/);
  assert.match(clientEntry, /PanelToggleButton/);
  assert.match(clientEntry, /PopoverCard/);
  assert.match(clientEntry, /ScrollArea/);
  assert.match(clientEntry, /StatusBanner/);
  assert.match(clientEntry, /StepSliderPopover/);
});

test("HoverTip 悬停显示不改变纵向位置", async () => {
  const pkgRoot = fileURLToPath(new URL("..", import.meta.url));
  const css = await readFile(resolve(pkgRoot, "client/HoverTip.module.css"), "utf8");
  const baseRule = css.match(/\.tip\s*\{(?<body>[\s\S]*?)\}/u)?.groups?.body ?? "";
  const visibleRule = css.match(/\.wrap:hover[\s\S]*?\.tip\s*\{(?<body>[\s\S]*?)\}/u)?.groups?.body ?? "";

  assert.ok(baseRule, "应能找到 HoverTip 默认样式");
  assert.ok(visibleRule, "应能找到 HoverTip 悬停可见样式");
  assert.doesNotMatch(baseRule, /translateY\s*\(/u);
  assert.doesNotMatch(visibleRule, /translateY\s*\(/u);
  // 悬停只允许改透明度：过渡里带 transform 会让气泡滑动，看起来像正文在跳。
  assert.doesNotMatch(baseRule, /transition:[^;]*transform/u);
  // 合成层必须提前持有，否则气泡出现那一帧会在滚动容器里新建图层并重栅格化消息区。
  assert.match(baseRule, /will-change:\s*opacity/u);
});
