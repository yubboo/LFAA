import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workbench = readFileSync(new URL("../packages/app-shell/src/AgentWorkbench.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../packages/app-shell/src/agent-workbench.css", import.meta.url), "utf8");
const service = readFileSync(new URL("../packages/config-system/src/settings/ai/core/account-service.ts", import.meta.url), "utf8");
const bridge = readFileSync(new URL("../apps/web/dev/bridges/ai/ai-config-bridge.ts", import.meta.url), "utf8");
const runtime = readFileSync(new URL("../packages/agent-runtime/src/core/contracts.ts", import.meta.url), "utf8");

test("composer owns one integrated runtime model control instead of split popovers", () => {
  for (const token of [
    "agent-runtime-control-trigger",
    "agent-runtime-control-card",
    "agent-runtime-control-card__toolbar",
    "agent-runtime-model-picker",
    "agent-reasoning-slider",
    "toggleReasoningBoost",
    "resetReasoning",
    "onQuickSelectModel",
    "onQuickUpdateModelSetting",
    "quickModels.length === 0",
    "管理模型",
  ]) assert.match(workbench, new RegExp(token));
  assert.doesNotMatch(workbench, /modelMenuOpen|reasoningMenuOpen/);
  assert.doesNotMatch(workbench, /agent-model-menu|agent-reasoning-menu/);
});

test("reasoning slider supports click-drag keyboard control and strongest-mode particles", () => {
  for (const token of [
    "setPointerCapture",
    "onPointerMove",
    "onPointerUp",
    'role="slider"',
    "ArrowLeft",
    "ArrowRight",
    "strongestReasoningIndex",
    "agent-reasoning-slider__particles",
  ]) assert.match(workbench, new RegExp(token));
  assert.match(css, /agent-reasoning-meteor/);
  assert.match(css, /prefers-reduced-motion/);
});

test("runtime control shell is isolated from composer layout to prevent popover layout flash", () => {
  assert.match(css, /\.agent-runtime-control-card\{[^}]*contain:layout paint/s);
  assert.match(css, /transform:translateZ\(0\)/);
  assert.match(css, /position:absolute/); // inherited composer popover anchor must remain out of document flow
});

test("quick switch uses cached catalog instead of re-probing Provider", () => {
  const method = service.match(/async setActiveModel\([\s\S]*?\n  async activateModel/);
  assert.ok(method, "setActiveModel method missing");
  assert.match(method[0], /account\.modelCatalog/);
  assert.doesNotMatch(method[0], /this\.probe\(/);
  assert.match(bridge, /active-model/);
});

test("agent run model binding carries validated runtime settings", () => {
  assert.match(runtime, /readonly settings\?: Readonly<Record<string, string \| number \| boolean>>/);
  assert.match(workbench, /settings: activeAiAccount\?\.modelSettings \?\? \{\}/);
});
