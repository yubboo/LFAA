import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const uiIndex = readFileSync(new URL("packages/ui/src/index.ts", root), "utf8");
const workbench = readFileSync(new URL("packages/app-shell/src/AgentWorkbench.tsx", root), "utf8");
const runtimeControl = readFileSync(new URL("packages/app-shell/src/workbench/center/composer/runtime-control/view/RuntimeControl.tsx", root), "utf8");
const reasoningRow = readFileSync(new URL("packages/app-shell/src/workbench/center/composer/runtime-control/view/ReasoningControlRow.tsx", root), "utf8");
const workbenchCss = readFileSync(new URL("packages/app-shell/src/agent-workbench.css", root), "utf8");
const slider = readFileSync(new URL("packages/ui/src/ui-controls/DiscreteSlider.tsx", root), "utf8");
const effectRegistry = readFileSync(new URL("packages/ui/src/ui-effects/registry.ts", root), "utf8");
const effectHost = readFileSync(new URL("packages/ui/src/ui-effects/UiEffectHost.tsx", root), "utf8");
const particleCanvas = readFileSync(new URL("packages/ui/src/ui-effects/ParticleStreamCanvas.tsx", root), "utf8");
const extensionRegistry = readFileSync(new URL("packages/ui/src/ui-extension/registry.ts", root), "utf8");

test("shared UI infrastructure stays under packages/ui/src/ui-xxx", () => {
  for (const folder of ["ui-overlay", "ui-controls", "ui-effects", "ui-extension", "ui-motion", "ui-shortcuts", "ui-resize"]) {
    assert.equal(existsSync(new URL(`packages/ui/src/${folder}/`, root)), true, `${folder} missing`);
  }
  assert.equal(existsSync(new URL("packages/ui/src/primitives/useDismissibleLayer.ts", root)), false);
  for (const token of ["DiscreteSlider", "UiEffectHost", "UiEffectRegistry", "UiExtensionRegistry", "AnimatedDisclosure", "useShortcut", "stepDampedValue"]) assert.match(uiIndex, new RegExp(token));
});

test("model runtime control consumes reusable slider/effect modules instead of embedding them", () => {
  assert.match(reasoningRow, /<DiscreteSlider/);
  assert.match(reasoningRow, /<UiEffectHost[\s\S]*?registry=\{builtinUiEffectRegistry\}[\s\S]*?effectId="reasoning-overdrive"/);
  assert.doesNotMatch(runtimeControl + reasoningRow, /setPointerCapture/);
  assert.doesNotMatch(runtimeControl + reasoningRow, /agent-reasoning-slider__particles/);
  assert.doesNotMatch(workbenchCss, /agent-reasoning-meteor|agent-reasoning-slider__thumb|agent-reasoning-slider__particles/);
  for (const token of ["setPointerCapture", "onPointerMove", "onPointerUp", 'role="slider"', "ArrowLeft", "ArrowRight", "Home", "End"]) assert.match(slider, new RegExp(token));
});

test("UI effect and extension registries support owner-scoped uninstall with generation changes", () => {
  for (const source of [effectRegistry, extensionRegistry]) {
    assert.match(source, /#generation/);
    assert.match(source, /unregisterOwner/);
    assert.match(source, /this\.#generation \+= 1/);
  }
  assert.match(effectHost, /effect\.renderer === "particle-stream-canvas"/);
});

test("reasoning effect host uses one stable Canvas renderer with declarative active/variant inputs", () => {
  assert.match(effectHost, /<ParticleStreamCanvas effect=\{effect\} active=\{active\} variant=\{variant\}/);
  assert.doesNotMatch(effectHost, /if \(!active\) return null/);
  assert.match(particleCanvas, /<canvas[^>]*data-active=\{active \? "true" : "false"\}/s);
  assert.match(particleCanvas, /data-variant=\{variant\}/);
  assert.match(particleCanvas, /requestAnimationFrame/);
  assert.doesNotMatch(particleCanvas, /useState\(/);
  assert.match(reasoningRow, /effect=\{\([\s\S]*?<UiEffectHost/);
  assert.match(reasoningRow, /active=\{boostActive\}/);
  assert.match(reasoningRow, /variant=\{highestReasoningActive \? "extreme" : "standard"\}/);
});
