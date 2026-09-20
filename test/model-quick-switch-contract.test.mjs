import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const composer=read("packages/app-shell/src/workbench/center/composer/view/ComposerRegion.tsx");
const runtimeView=read("packages/app-shell/src/workbench/center/composer/runtime-control/view/RuntimeControl.tsx");
const runtimeRow=read("packages/app-shell/src/workbench/center/composer/runtime-control/view/ReasoningControlRow.tsx");
const runtimeController=read("packages/app-shell/src/workbench/center/composer/runtime-control/logic/useRuntimeControlController.ts");
const runtimePicker=read("packages/app-shell/src/workbench/center/composer/runtime-control/view/RuntimeModelPicker.tsx");
const runtimeSurface=`${composer}\n${runtimeView}\n${runtimeRow}\n${runtimeController}\n${runtimePicker}`;
const runtimeCss=read("packages/app-shell/src/workbench/center/composer/runtime-control/styles/RuntimeControl.module.css");
const conversationCss=read("packages/app-shell/src/workbench/center/conversation/styles/Conversation.module.css");
const themeCss=read("packages/app-shell/src/workbench/shell/styles/WorkbenchTheme.module.css");
const slider=read("packages/ui/src/ui-controls/DiscreteSlider.tsx");
const sliderCss=read("packages/ui/src/ui-controls/discrete-slider.css");
const effectHost=read("packages/ui/src/ui-effects/UiEffectHost.tsx");
const effectCss=read("packages/ui/src/ui-effects/effects.css");
const particleCanvas=read("packages/ui/src/ui-effects/ParticleStreamCanvas.tsx");
const reasoningControl=read("packages/app-shell/src/reasoning-control.ts");
const service=read("packages/config-system/src/settings/ai/core/account-service.ts");
const bridge=read("apps/web/dev/bridges/ai/ai-config-bridge.ts");
const runtime=read("packages/agent-runtime/src/core/contracts.ts");
const codexAppServer=read("apps/web/dev/bridges/ai/codex-app-server.ts");
const aiController=read("packages/app-shell/src/workbench/settings/logic/useAiSettingsController.ts");
const sessionController=read("packages/app-shell/src/workbench/session/logic/useAgentSessionController.ts");

test("Composer owns one modular RuntimeControl instead of split popovers",()=>{
  for(const token of ["<RuntimeControl","RuntimeModelPicker","ReasoningControlRow","toggleReasoningBoost","resetReasoning","onQuickSelectModel","onQuickUpdateModelSetting","quickModels.length === 0","管理模型"]) assert.match(runtimeSurface,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
  assert.doesNotMatch(runtimeSurface,/modelMenuOpen|reasoningMenuOpen|agent-model-menu|agent-reasoning-menu/);
  assert.match(composer,/from "\.\.\/runtime-control"/);
});

test("reasoning UI mirrors current Provider capability options one-to-one",()=>{
  assert.match(reasoningControl,/return options\.map\(\(providerOption, index\) =>/);
  assert.match(reasoningControl,/label: providerOption\.label/);
  assert.match(reasoningControl,/providerOption,/);
  assert.match(reasoningControl,/findIndex\(\(option\) => option\.value === value\)/);
  assert.doesNotMatch(reasoningControl,/REASONING_UI_STAGES|semanticRank|isReasoningDisabledValue|DISABLED_REASONING_VALUES/);
  for(const synthetic of ["极低","极高","极限"]) assert.doesNotMatch(reasoningControl,new RegExp(`label: "${synthetic}"`));
  assert.match(runtimeRow,/steps=\{reasoningStages\.map\(\(stage\) => \(\{ id: stage\.id, label: stage\.label \}\)\)\}/);
  assert.match(runtimeController,/const reasoningStages = resolveReasoningStages\(providerReasoningOptions\)/);
  assert.match(runtimeController,/const lastReasoningIndex = Math\.max\(0, reasoningStages\.length - 1\)/);
  assert.match(runtimeController,/binding\.providerOption\.value/);
  assert.match(runtimeController,/modelSettingOverrides/);
});

test("reasoning capability can expose dynamic step counts without synthetic padding",()=>{
  assert.match(runtimeRow,/if \(!reasoningStages\.length\)/);
  assert.match(runtimeRow,/disabled=\{modelControlBusy\}/);
  assert.match(runtimeController,/Math\.min\(reasoningStages\.length - 1, index\)/);
  assert.doesNotMatch(runtimeController,/Math\.min\(5,|REASONING_UI_STAGES\.length/);
  assert.doesNotMatch(reasoningControl,/filter\(/);
  assert.match(reasoningControl,/不过滤 none\/off/);
});

test("ChatGPT subscription reasoning levels come from live model/list capability data",()=>{
  assert.match(codexAppServer,/supportedReasoningEfforts/);assert.match(codexAppServer,/parseReasoningOptions/);assert.match(codexAppServer,/options: reasoningOptions/);
  assert.doesNotMatch(runtimeSurface,/providerId === "openai"|modelId\.includes\(|modelId\.startsWith\(/);
});

test("strong reasoning is orthogonal run hint and never forces stage",()=>{
  const toggle=runtimeController.match(/const toggleReasoningBoost = \(\) => \{[\s\S]*?\n  \};/);assert.ok(toggle);
  assert.match(toggle[0],/setReasoningBoostPreference/);assert.doesNotMatch(toggle[0],/commitReasoningIndex|onQuickUpdateModelSetting/);
  assert.match(runtimeController,/reasoningBoostPreference === "auto" && highestReasoningActive/);
  assert.match(runtimeController,/executionHints: \{ reasoningBoost: boostActive \}/);
  assert.match(composer,/onSubmitTask\(input,executionHints,modelSettingOverrides\)|onSubmitTask\(input, executionHints, modelSettingOverrides\)/);
  assert.match(runtime,/interface AgentExecutionHints/);assert.match(runtime,/readonly reasoningBoost\?: boolean/);
});

test("slider keeps smooth pointer drag, white thumb and Canvas effect",()=>{
  assert.match(runtimeRow,/<DiscreteSlider/);assert.match(runtimeRow,/variant=\{highestReasoningActive \? "extreme" : "standard"\}/);assert.match(runtimeRow,/<UiEffectHost[\s\S]*active=\{boostActive\}/);
  for(const token of ["setPointerCapture","hasPointerCapture","releasePointerCapture","onPointerMove","onPointerUp",'role="slider"',"ArrowLeft","ArrowRight","Home","End","--lfaa-slider-visual-progress","style.setProperty"]) assert.ok(slider.includes(token),token);
  assert.match(sliderCss,/cursor: grab/);assert.match(sliderCss,/cursor: grabbing/);assert.match(sliderCss,/background: #fff/);assert.match(sliderCss,/220ms cubic-bezier/);
  assert.match(effectHost,/particle-stream-canvas/);for(const token of ["requestAnimationFrame","ResizeObserver","devicePixelRatio","readSliderProgressRatio","createLinearGradient","prefers-reduced-motion"]) assert.ok(particleCanvas.includes(token),token);
  assert.doesNotMatch(particleCanvas,/useState\(/);assert.doesNotMatch(effectCss,/@keyframes|animation:/);
});

test("reasoning commit remains optimistic/serialized without busy flash",()=>{
  const commit=runtimeController.match(/const commitReasoningIndex = \(index: number\) => \{[\s\S]*?\n  \};/);assert.ok(commit);
  assert.match(commit[0],/reasoningCommitQueueRef/);assert.match(commit[0],/setSelectedReasoningStageIndex\(safeIndex\)/);assert.doesNotMatch(commit[0],/runModelControl|setModelControlBusy/);
  assert.match(slider,/onCommit\(next\);[\s\S]*onPreview\?\.\(null\)/);
});

test("runtime card does not force full-card GPU promotion",()=>{
  assert.match(runtimeCss,/\.card\s*\{[^}]*contain:\s*layout style/s);assert.match(runtimeCss,/\.card\s*\{[^}]*isolation:\s*isolate/s);assert.doesNotMatch(runtimeCss,/translateZ\(0\)|will-change:\s*transform/);assert.match(runtimeCss,/position:\s*absolute/);
});

test("chat timeline and Composer still share horizontal geometry",()=>{
  assert.match(conversationCss,/\.inner\s*\{[^}]*width:\s*100%[^}]*var\(--agent-page-gutter\)/s);assert.match(conversationCss,/\.timeline\s*\{[^}]*width:\s*min\(var\(--agent-composer-max\),100%\)/s);assert.match(conversationCss,/\.user\s*\{\s*justify-self:end/);assert.match(conversationCss,/\.assistant,\.error\s*\{\s*justify-self:start/);
});

test("reasoning palette stays in root theme tokens",()=>{for(const token of ["--lfaa-reasoning-standard-color-1","--lfaa-reasoning-extreme-color-4"])assert.ok(themeCss.includes(token));});

test("quick switch uses cached catalog instead of re-probing Provider",()=>{const method=service.match(/async setActiveModel\([\s\S]*?\n  async activateModel/);assert.ok(method);assert.match(method[0],/account\.modelCatalog/);assert.doesNotMatch(method[0],/this\.probe\(/);assert.match(bridge,/active-model/);});

test("agent run model binding carries validated runtime settings through settings -> session",()=>{assert.match(runtime,/readonly settings\?: Readonly<Record<string, string \| number \| boolean>>/);assert.match(aiController,/settings:activeAccount\?\.modelSettings\?\?\{\}/);assert.match(sessionController,/settings:\s*\{\s*\.\.\.\(activeModelBinding\.settings\s*\?\?\s*\{\}\),\s*\.\.\.modelSettingOverrides\s*\}/);});
