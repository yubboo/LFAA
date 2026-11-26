// 验证右侧工作台顶栏复用左二栏/中间区同一个胶囊：不再是一条自带底分割线的平栏。
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));

test("右栏顶栏外观交给共享胶囊，外层只留高度与外边距", async () => {
  const css = await readFile(resolve(packageRoot, "client/workbench/RightWorkbenchPane.module.css"), "utf8");
  const headerRule = css.match(/\.topHeader\s*\{(?<body>[\s\S]*?)\n\}/u)?.groups?.body ?? "";
  const capsuleRule = css.match(/\.headerCapsule\s*\{(?<body>[\s\S]*?)\n\}/u)?.groups?.body ?? "";

  assert.ok(headerRule && capsuleRule, "应能找到右栏顶栏与胶囊的样式规则");
  // 平栏的底分割线与整条底色都去掉：否则胶囊外面还会多出一道横线。
  assert.match(headerRule, /border-bottom:\s*0/u);
  assert.match(headerRule, /background:\s*transparent/u);
  assert.match(headerRule, /padding:\s*0\.4rem\s+0\.55rem/u);
  // 栏位差异只通过胶囊变量表达。
  assert.match(capsuleRule, /--capsule-padding:/u);
});

test("右栏顶栏由 WorkbenchTopBar 套用 CapsuleBar，主壳体只装配属性", async () => {
  const topBar = await readFile(resolve(packageRoot, "client/workbench/WorkbenchTopBar.tsx"), "utf8");
  assert.match(topBar, /import \{ CapsuleBar \} from "@lfaa\/ui-primitives\/client"/u);
  // 标签区与动作组都在胶囊内部。
  assert.match(topBar, /<header className=\{styles\.topHeader\}>\s*<CapsuleBar className=\{styles\.headerCapsule\}>[\s\S]*?<WorkbenchTabs \{\.\.\.tabProps\} \/>[\s\S]*?<RightWorkbenchActions \{\.\.\.actionProps\} \/>[\s\S]*?<\/CapsuleBar>\s*<\/header>/u);

  const pane = await readFile(resolve(packageRoot, "client/workbench/RightWorkbenchPane.tsx"), "utf8");
  assert.match(pane, /import \{ WorkbenchTopBar \} from "\.\/WorkbenchTopBar"/u);
  assert.match(pane, /<WorkbenchTopBar\s+tabProps=\{\{[\s\S]*?\}\}\s+actionProps=\{\{/u);
});