import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (file) => fs.readFileSync(file, "utf8");
const home = read("packages/client/app-shell/src/app-hub/LfaaAppHub.tsx");
const homeCss = read("packages/client/app-shell/src/app-hub/AppHub.module.css");
const identity = read("packages/client/app-shell/src/identity/LfaaIdentityGate.tsx");
const identityCss = read("packages/client/app-shell/src/identity/IdentityGate.module.css");
const productCss = read("packages/client/app-shell/src/product-surface.css");
const app = read("packages/client/web/src/App.tsx");
const workbenchTypes = read("packages/client/app-shell/src/workbench.types.ts");
const workbench = read("packages/client/app-shell/src/AgentWorkbench.tsx");
const center = read("packages/client/app-shell/src/workbench/center/view/CenterWorkspaceRegion.tsx");
const composer = read("packages/client/app-shell/src/workbench/center/composer/view/ComposerRegion.tsx");

test("Smart Home provides natural-language and manual entry without keyword fake routing", () => {
  assert.match(home, /onStartIntent: \(input: string\) => void/);
  assert.match(home, /告诉 LFAA 你想完成什么/);
  assert.match(home, /手动进入/);
  assert.match(home, /onStartIntent\(input\)/);
  assert.doesNotMatch(home, /includes\([^)]*(写|漫画|minecraft|steam)/i);
  assert.doesNotMatch(home, /App Pack 待接入/);
  assert.match(app, /available: false/);
});

test("Smart Home intent is handed to the existing Workbench composer instead of starting a second runtime", () => {
  assert.match(app, /setInitialComposerDraft\(draft\)/);
  assert.match(app, /onStartIntent=\{\(input\) => enterWorkbench\(input\)\}/);
  assert.match(workbenchTypes, /initialComposerDraft\?: string/);
  assert.match(workbench, /initialComposerDraft: props\.initialComposerDraft/);
  assert.match(center, /initialDraft: props\.initialComposerDraft/);
  assert.match(composer, /useState\(initialDraft \?\? ""\)/);
  assert.doesNotMatch(app, /startRun|submitAgentInput/);
});

test("First Run remains the only registration path after the visual redesign", () => {
  assert.match(identity, /if \(!bootstrap\.initialized\) \{ setState\("first-run"\); return; \}/);
  assert.match(identity, /initializeSuperAdmin/);
  assert.match(identity, /首次初始化 · 创建本地超级管理员/);
  assert.match(identity, /匿名注册入口会永久关闭/);
  assert.doesNotMatch(identity, /onClick=\{[^}]*setState\("first-run"\)/);
});

test("Login, First Run and Smart Home share motion tokens and reduced-motion support", () => {
  assert.match(home, /product-surface\.css/);
  assert.match(identity, /product-surface\.css/);
  assert.match(productCss, /--lfaa-product-ease/);
  assert.match(productCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(homeCss, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(identityCss, /@media\(prefers-reduced-motion:reduce\)/);
});
