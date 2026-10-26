/** 功能：回归普通写作光线背景的设置、展示和资源释放合同。作用：保证快捷开关与设置中心共享账户外观字段，并限制 WebGL 动画成本。关联文件：ui-writing/WritingWorkspace.tsx、ui-primitives/LightRays.tsx。 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const writing = readFileSync(new URL("../../../packages/client/ui-writing/src/normal/WritingWorkspace.tsx", import.meta.url), "utf8");
const writingStyles = readFileSync(new URL("../../../packages/client/ui-writing/src/normal/WritingWorkspace.css", import.meta.url), "utf8");
const workspace = readFileSync(new URL("../../../packages/client/ui-workspace/src/ApplicationWorkspace.tsx", import.meta.url), "utf8");
const lightRays = readFileSync(new URL("../../../packages/client/ui-primitives/src/LightRays.tsx", import.meta.url), "utf8");
const lightRaysStyles = readFileSync(new URL("../../../packages/client/ui-primitives/src/LightRays.css", import.meta.url), "utf8");

test("写作工具栏与设置中心共用账户级光线开关", () => {
  assert.match(workspace, /<WritingWorkspace settings=\{settings\} onSettingsChange=\{onSettingsChange\}/u);
  assert.match(writing, /saveSettings\("appearance"/u);
  assert.match(writing, /writingLightRaysEnabled/u);
  assert.match(writing, /role="switch" aria-label="写作光线背景" aria-checked=\{settings\.appearance\.advanced\.writingLightRaysEnabled\}/u);
  assert.match(writing, /settings\.appearance\.advanced\.writingLightRaysEnabled \? <div className="writing-workspace__light-rays-layer"/u);
  assert.doesNotMatch(writing, /localStorage|sessionStorage/u);
});

test("LightRays 沿用 Appearance，并暂停隐藏、离屏和减少动态效果场景", () => {
  assert.match(lightRays, /canvas\.getContext\('webgl2'/u);
  assert.match(lightRays, /const PIXEL_BUDGET = 1\.25e6/u);
  assert.match(lightRays, /getPropertyValue\('--settings-accent'\)/u);
  assert.match(lightRays, /settingsRef\.current\.reducedMotion === 'on' \|\| \(settingsRef\.current\.reducedMotion === 'system' && motionQuery\.matches\)/u);
  assert.match(lightRays, /if \(reduced\) \{\s*time = 0;\s*opening = 1;/u);
  assert.match(lightRays, /const busy = !reduced/u);
  assert.match(lightRays, /new ResizeObserver/u);
  assert.match(lightRays, /new IntersectionObserver/u);
  assert.match(lightRays, /document\.addEventListener\('visibilitychange'/u);
  assert.match(lightRays, /resizeObserver\?\.disconnect\(\)/u);
  assert.match(lightRays, /intersection\?\.disconnect\(\)/u);
  assert.match(lightRays, /themeObserver\?\.disconnect\(\)/u);
  assert.match(lightRays, /cancelAnimationFrame\(raf\)/u);
  assert.match(lightRays, /gl\.deleteProgram\(shader\.program\)/u);
  assert.match(lightRaysStyles, /\.light-rays__fallback/u);
  assert.match(lightRaysStyles, /var\(--settings-accent/u);
  assert.match(lightRaysStyles, /pointer-events:\s*none/u);
});

test("光线只在编辑器内作为背景，窄栏工具栏可换行且编辑纸面仍读取遮罩", () => {
  assert.match(writingStyles, /\.writing-workspace__editor \{[^}]*position:\s*relative;[^}]*isolation:\s*isolate/u);
  assert.match(writingStyles, /\.writing-workspace__light-rays-layer \{[^}]*pointer-events:\s*none/u);
  assert.match(writingStyles, /\.workbench-shell \.writing-workspace__editor\[data-light-rays="true"\] > \.writing-workspace__paper[^}]*--settings-background-surface-opacity/u);
  assert.match(writingStyles, /@media \(max-width:\s*520px\)[\s\S]*writing-workspace__editor-toolbar \{ flex-wrap:\s*wrap/u);
});
