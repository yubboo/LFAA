import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workbench = readFileSync(new URL("../packages/app-shell/src/AgentWorkbench.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../packages/app-shell/src/agent-workbench.css", import.meta.url), "utf8");
const slider = readFileSync(new URL("../packages/ui/src/ui-controls/DiscreteSlider.tsx", import.meta.url), "utf8");
const sliderCss = readFileSync(new URL("../packages/ui/src/ui-controls/discrete-slider.css", import.meta.url), "utf8");
const effectHost = readFileSync(new URL("../packages/ui/src/ui-effects/UiEffectHost.tsx", import.meta.url), "utf8");
const effectCss = readFileSync(new URL("../packages/ui/src/ui-effects/effects.css", import.meta.url), "utf8");
const reasoningControl = readFileSync(new URL("../packages/app-shell/src/reasoning-control.ts", import.meta.url), "utf8");
const service = readFileSync(new URL("../packages/config-system/src/settings/ai/core/account-service.ts", import.meta.url), "utf8");
const bridge = readFileSync(new URL("../apps/web/dev/bridges/ai/ai-config-bridge.ts", import.meta.url), "utf8");
const runtime = readFileSync(new URL("../packages/agent-runtime/src/core/contracts.ts", import.meta.url), "utf8");

test("composer owns one integrated runtime model control instead of split popovers", () => {
  for (const token of [
    "agent-runtime-control-trigger",
    "agent-runtime-control-card",
    "agent-runtime-control-card__toolbar",
    "agent-runtime-model-picker",
    "DiscreteSlider",
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

test("reasoning UI exposes exactly six non-off stages while only writing official provider values", () => {
  for (const label of ["极低", "低", "中", "高", "极高", "极限"]) assert.match(reasoningControl, new RegExp(`label: \"${label}\"`));
  assert.match(reasoningControl, /REASONING_UI_STAGES/);
  assert.match(reasoningControl, /isReasoningDisabledValue/);
  assert.match(reasoningControl, /filter\(\(option\) => !isReasoningDisabledValue\(option\.value\)\)/);
  assert.match(workbench, /steps=\{REASONING_UI_STAGES\.map/);
  assert.match(workbench, /binding\.providerOption\.value/);
  assert.match(workbench, /runtimeModelSettingOverrides/);
  assert.match(workbench, /runModelBinding:[\s\S]*settings: \{ \.\.\.\(activeModelBinding\.settings \?\? \{\}\), \.\.\.modelSettingOverrides \}/);
  assert.doesNotMatch(workbench, /onQuickUpdateModelSetting\([^\n]*(?:very-low|very-high|extreme)/);
});

test("strong reasoning is an orthogonal run hint and never forces the reasoning stage", () => {
  const toggleBlock = workbench.match(/const toggleReasoningBoost = \(\) => \{[\s\S]*?\n  \};/);
  assert.ok(toggleBlock, "toggleReasoningBoost block missing");
  assert.match(toggleBlock[0], /setReasoningBoostPreference/);
  assert.doesNotMatch(toggleBlock[0], /commitReasoningIndex|onQuickUpdateModelSetting|REASONING_EXTREME_STAGE_INDEX/);
  assert.match(workbench, /reasoningBoostPreference === "auto" && extremeReasoningActive/);
  assert.match(workbench, /onSubmitTask\(input, \{ reasoningBoost: boostActive \}, runtimeModelSettingOverrides\)/);
  assert.match(runtime, /interface AgentExecutionHints/);
  assert.match(runtime, /readonly reasoningBoost\?: boolean/);
  assert.match(runtime, /readonly executionHints\?: AgentExecutionHints/);
});

test("reasoning slider has smooth pointer drag, visible white thumb and stable meteor layer", () => {
  assert.match(workbench, /<DiscreteSlider/);
  assert.match(workbench, /variant=\{extremeReasoningActive \? "extreme" : "standard"\}/);
  assert.match(workbench, /<UiEffectHost[^>]*active[^>]*variant=/s);
  for (const token of ["setPointerCapture", "hasPointerCapture", "releasePointerCapture", "onPointerMove", "onPointerUp", 'role="slider"', "ArrowLeft", "ArrowRight", "Home", "End", "--lfaa-slider-visual-progress", "style.setProperty"]) assert.match(slider, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(sliderCss, /cursor: grab/);
  assert.match(sliderCss, /cursor: grabbing/);
  assert.match(sliderCss, /background: #fff/);
  assert.match(sliderCss, /220ms cubic-bezier/);
  assert.match(effectHost, /data-active=/);
  assert.match(effectHost, /data-variant=/);
  assert.match(effectCss, /lfaa-ui-meteor/);
  assert.match(effectCss, /translate3d/);
  assert.match(effectCss, /prefers-reduced-motion/);
  assert.match(effectCss, /--lfaa-effect-color-4/);
  assert.match(css, /--lfaa-reasoning-standard-color-1/);
  assert.match(css, /--lfaa-reasoning-extreme-color-4/);
});

test("runtime control shell avoids forced full-card GPU promotion that caused Edge flashing", () => {
  assert.match(css, /\.agent-runtime-control-card\{[^}]*contain:layout style/s);
  assert.match(css, /\.agent-runtime-control-card\{[^}]*isolation:isolate/s);
  assert.doesNotMatch(css, /\.agent-runtime-control-card\{[^}]*transform:translateZ\(0\)/s);
  assert.doesNotMatch(css, /\.agent-runtime-control-card\{[^}]*will-change:transform/s);
  assert.match(css, /position:absolute/); // inherited composer popover anchor must remain out of document flow
});

test("chat timeline uses the same max width and gutter basis as Composer", () => {
  assert.match(css, /\.agent-conversation-inner\s*\{[^}]*width:\s*100%[^}]*padding:[^;}]*var\(--agent-page-gutter\)/s);
  assert.match(css, /\.agent-chat-timeline\s*\{[^}]*width:min\(var\(--agent-composer-max\),100%\)/s);
  assert.match(css, /\.agent-chat-message--user\{justify-self:end\}/);
  assert.match(css, /\.agent-chat-message--assistant,\.agent-chat-message--error\{justify-self:start\}/);
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
