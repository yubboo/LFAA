import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workbench = readFileSync(new URL("../packages/app-shell/src/AgentWorkbench.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../packages/app-shell/src/agent-workbench.css", import.meta.url), "utf8");
const slider = readFileSync(new URL("../packages/ui/src/ui-controls/DiscreteSlider.tsx", import.meta.url), "utf8");
const sliderCss = readFileSync(new URL("../packages/ui/src/ui-controls/discrete-slider.css", import.meta.url), "utf8");
const effectHost = readFileSync(new URL("../packages/ui/src/ui-effects/UiEffectHost.tsx", import.meta.url), "utf8");
const effectCss = readFileSync(new URL("../packages/ui/src/ui-effects/effects.css", import.meta.url), "utf8");
const particleCanvas = readFileSync(new URL("../packages/ui/src/ui-effects/ParticleStreamCanvas.tsx", import.meta.url), "utf8");
const reasoningControl = readFileSync(new URL("../packages/app-shell/src/reasoning-control.ts", import.meta.url), "utf8");
const service = readFileSync(new URL("../packages/config-system/src/settings/ai/core/account-service.ts", import.meta.url), "utf8");
const bridge = readFileSync(new URL("../apps/web/dev/bridges/ai/ai-config-bridge.ts", import.meta.url), "utf8");
const runtime = readFileSync(new URL("../packages/agent-runtime/src/core/contracts.ts", import.meta.url), "utf8");
const codexAppServer = readFileSync(new URL("../apps/web/dev/bridges/ai/codex-app-server.ts", import.meta.url), "utf8");

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

test("reasoning UI mirrors the current Provider capability options one-to-one", () => {
  assert.match(reasoningControl, /return options\.map\(\(providerOption, index\) =>/);
  assert.match(reasoningControl, /label: providerOption\.label/);
  assert.match(reasoningControl, /providerOption,/);
  assert.match(reasoningControl, /findIndex\(\(option\) => option\.value === value\)/);
  assert.doesNotMatch(reasoningControl, /REASONING_UI_STAGES|semanticRank|isReasoningDisabledValue|DISABLED_REASONING_VALUES/);
  for (const synthetic of ["极低", "极高", "极限"]) assert.doesNotMatch(reasoningControl, new RegExp(`label: \"${synthetic}\"`));
  assert.match(workbench, /steps=\{reasoningStages\.map\(\(stage\) => \(\{ id: stage\.id, label: stage\.label \}\)\)\}/);
  assert.match(workbench, /const reasoningStages = resolveReasoningStages\(providerReasoningOptions\)/);
  assert.match(workbench, /const lastReasoningIndex = Math\.max\(0, reasoningStages\.length - 1\)/);
  assert.match(workbench, /binding\.providerOption\.value/);
  assert.match(workbench, /runtimeModelSettingOverrides/);
  assert.match(workbench, /runModelBinding:[\s\S]*settings: \{ \.\.\.\(activeModelBinding\.settings \?\? \{\}\), \.\.\.modelSettingOverrides \}/);
});

test("reasoning capability can expose zero, one, three or five steps without synthetic padding", () => {
  assert.match(workbench, /\{reasoningStages\.length \? \(/);
  assert.match(workbench, /disabled=\{!reasoningStages\.length \|\| modelControlBusy\}/);
  assert.match(workbench, /Math\.min\(reasoningStages\.length - 1, index\)/);
  assert.doesNotMatch(workbench, /Math\.min\(5,|REASONING_UI_STAGES\.length/);
  assert.doesNotMatch(reasoningControl, /filter\(/);
  assert.match(reasoningControl, /不过滤 none\/off/);
});

test("ChatGPT subscription reasoning levels come from live model/list capability data", () => {
  assert.match(codexAppServer, /supportedReasoningEfforts/);
  assert.match(codexAppServer, /parseReasoningOptions/);
  assert.match(codexAppServer, /options: reasoningOptions/);
  assert.doesNotMatch(workbench, /providerId === "openai"|modelId\.includes\(|modelId\.startsWith\(/);
});

test("strong reasoning is an orthogonal run hint and never forces the reasoning stage", () => {
  const toggleBlock = workbench.match(/const toggleReasoningBoost = \(\) => \{[\s\S]*?\n  \};/);
  assert.ok(toggleBlock, "toggleReasoningBoost block missing");
  assert.match(toggleBlock[0], /setReasoningBoostPreference/);
  assert.doesNotMatch(toggleBlock[0], /commitReasoningIndex|onQuickUpdateModelSetting/);
  assert.match(workbench, /reasoningBoostPreference === "auto" && highestReasoningActive/);
  assert.match(workbench, /onSubmitTask\(input, \{ reasoningBoost: boostActive \}, runtimeModelSettingOverrides\)/);
  assert.match(runtime, /interface AgentExecutionHints/);
  assert.match(runtime, /readonly reasoningBoost\?: boolean/);
  assert.match(runtime, /readonly executionHints\?: AgentExecutionHints/);
});

test("reasoning slider has smooth pointer drag, visible white thumb and Canvas particle stream", () => {
  assert.match(workbench, /<DiscreteSlider/);
  assert.match(workbench, /variant=\{highestReasoningActive \? "extreme" : "standard"\}/);
  assert.match(workbench, /<UiEffectHost[^>]*active=\{boostActive\}[^>]*variant=/s);
  for (const token of ["setPointerCapture", "hasPointerCapture", "releasePointerCapture", "onPointerMove", "onPointerUp", 'role="slider"', "ArrowLeft", "ArrowRight", "Home", "End", "--lfaa-slider-visual-progress", "style.setProperty"]) assert.match(slider, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(sliderCss, /cursor: grab/);
  assert.match(sliderCss, /cursor: grabbing/);
  assert.match(sliderCss, /background: #fff/);
  assert.match(sliderCss, /220ms cubic-bezier/);
  assert.match(effectHost, /particle-stream-canvas/);
  for (const token of ["requestAnimationFrame", "ResizeObserver", "devicePixelRatio", "readSliderProgressRatio", "createLinearGradient", "prefers-reduced-motion"]) assert.match(particleCanvas, new RegExp(token));
  assert.doesNotMatch(particleCanvas, /useState\(/);
  assert.doesNotMatch(effectCss, /@keyframes|animation:/);
  assert.match(effectCss, /lfaa-ui-effect--particle-stream/);
  assert.match(css, /--lfaa-reasoning-standard-color-1/);
  assert.match(css, /--lfaa-reasoning-extreme-color-4/);
});

test("reasoning commit is optimistic and serialized without modelControlBusy disabled flash", () => {
  const commitBlock = workbench.match(/const commitReasoningIndex = \(index: number\) => \{[\s\S]*?\n  \};/);
  assert.ok(commitBlock, "commitReasoningIndex block missing");
  assert.match(commitBlock[0], /reasoningCommitQueueRef/);
  assert.match(commitBlock[0], /setSelectedReasoningStageIndex\(safeIndex\)/);
  assert.doesNotMatch(commitBlock[0], /runModelControl/);
  assert.doesNotMatch(commitBlock[0], /setModelControlBusy/);
  assert.match(slider, /onCommit\(next\);[\s\S]*onPreview\?\.\(null\)/);
  assert.doesNotMatch(slider, /onPreview\?\.\(next\);[\s\S]*onCommit\(next\)/);
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
