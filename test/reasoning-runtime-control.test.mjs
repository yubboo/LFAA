import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const reasoning = readFileSync(new URL("packages/app-shell/src/reasoning-control.ts", root), "utf8");
const configProvider = readFileSync(new URL("packages/config-system/src/settings/ai/providers/deepseek/plugin.ts", root), "utf8");
const slider = readFileSync(new URL("packages/ui/src/ui-controls/DiscreteSlider.tsx", root), "utf8");
const sliderCss = readFileSync(new URL("packages/ui/src/ui-controls/discrete-slider.css", root), "utf8");
const particles = readFileSync(new URL("packages/ui/src/ui-effects/ParticleStreamCanvas.tsx", root), "utf8");
const workbenchCss = readFileSync(new URL("packages/app-shell/src/agent-workbench.css", root), "utf8");

test("Provider Catalog keeps none while Runtime reasoning projection filters disabled sentinels only", () => {
  assert.match(configProvider, /value: "none"|\["none",\s*"low"/);
  assert.match(reasoning, /DISABLED_REASONING_VALUES/);
  assert.match(reasoning, /options\.filter\(\(option\) => !isDisabledReasoningOption\(option\)\)/);
  assert.match(reasoning, /runtimeReasoningOptions\(options\)\.map/);
  assert.doesNotMatch(reasoning, /sort\(|semanticRank|REASONING_UI_STAGES/);
});

test("Slider uses one geometry rect for pointer, rail, marks, thumb and clipped effect", () => {
  assert.match(slider, /geometryRef/);
  assert.match(slider, /geometry\.getBoundingClientRect\(\)/);
  assert.match(slider, /lfaa-discrete-slider__geometry/);
  assert.match(slider, /lfaa-discrete-slider__effect-clip/);
  assert.match(sliderCss, /--lfaa-slider-edge-inset/);
  assert.match(sliderCss, /\.lfaa-discrete-slider__geometry\s*\{[^}]*inset:\s*0 var\(--lfaa-slider-edge-inset\)/s);
  assert.match(sliderCss, /\.lfaa-discrete-slider__rail[\s\S]*right:\s*0/);
  assert.match(sliderCss, /\.lfaa-discrete-slider__effect-clip\s*\{[^}]*overflow:\s*hidden/s);
});

test("Runtime toolbar icon buttons are single-cell grids and Canvas particles are star points without directional tails", () => {
  assert.match(workbenchCss, /agent-runtime-control-card__icon\{[^}]*grid-template-columns:1fr!important[^}]*grid-template-rows:1fr!important/s);
  assert.match(particles, /drawSparkle/);
  assert.match(particles, /context\.arc\(/);
  assert.match(particles, /quadraticCurveTo/);
  assert.doesNotMatch(particles, /context\.lineTo\(|context\.stroke\(|const tail/);
});
