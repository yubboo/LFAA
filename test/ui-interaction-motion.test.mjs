import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync,existsSync } from "node:fs";
const root=new URL("../",import.meta.url);const read=(p)=>readFileSync(new URL(p,root),"utf8");
const composer=read("packages/app-shell/src/workbench/center/composer/ComposerRegion.tsx");
const runtimeControl=read("packages/app-shell/src/workbench/center/composer/runtime-control/RuntimeControl.tsx");
const runtimePicker=read("packages/app-shell/src/workbench/center/composer/runtime-control/RuntimeModelPicker.tsx");
const runtimeController=read("packages/app-shell/src/workbench/center/composer/runtime-control/useRuntimeControlController.ts");
const runtimeRow=read("packages/app-shell/src/workbench/center/composer/runtime-control/ReasoningControlRow.tsx");
const permissionControl=read("packages/app-shell/src/workbench/center/composer/PermissionControl.tsx");
const runtimeCss=read("packages/app-shell/src/workbench/center/composer/runtime-control/RuntimeControl.module.css");
const disclosure=read("packages/ui/src/ui-motion/AnimatedDisclosure.tsx");const disclosureCss=read("packages/ui/src/ui-motion/animated-disclosure.css");const resize=read("packages/ui/src/workbench/ResizableWorkbench.tsx");const damped=read("packages/ui/src/ui-resize/damped-motion.ts");const layers=read("packages/ui/src/ui-overlay/layers.css");

test("shared interaction primitives live under packages/ui/src/ui-xxx",()=>{for(const folder of ["ui-motion","ui-shortcuts","ui-resize","ui-overlay"])assert.equal(existsSync(new URL(`packages/ui/src/${folder}/`,root)),true,`${folder} missing`);});

test("runtime model picker uses stable disclosure and real shortcuts",()=>{assert.match(runtimePicker,/<AnimatedDisclosure open=\{open\}/);assert.match(runtimeControl,/Ctrl\+Shift\+M/);assert.match(permissionControl,/Ctrl\+Shift\+P/);assert.match(composer,/useShortcut\(\{key:"m",ctrl:true,shift:true\}|useShortcut\(\{ key: "m", ctrl: true, shift: true \}/);assert.match(disclosure,/lfaa-animated-disclosure/);assert.match(disclosureCss,/grid-template-rows: 0fr/);assert.match(disclosureCss,/grid-template-rows: 1fr/);});

test("runtime overlay layers remain unclipped",()=>{for(const token of ["--lfaa-layer-popover","--lfaa-layer-tooltip","--lfaa-layer-modal"])assert.match(layers,new RegExp(token));assert.match(runtimeCss,/var\(--lfaa-layer-tooltip/);assert.match(runtimeCss,/\.card\s*\{[^}]*overflow:\s*visible/s);assert.doesNotMatch(runtimeCss,/contain:\s*layout paint/);});

test("workbench resize consumes reusable frame-rate independent damping",()=>{assert.match(damped,/1 - Math\.exp\(-dt \/ tau\)/);assert.match(resize,/stepDampedValue/);assert.match(resize,/drag\.visualSize/);});

test("dynamic reasoning drag keeps no-flash queue and Canvas effect",()=>{const slider=read("packages/ui/src/ui-controls/DiscreteSlider.tsx");const sliderCss=read("packages/ui/src/ui-controls/discrete-slider.css");const particleCanvas=read("packages/ui/src/ui-effects/ParticleStreamCanvas.tsx");const effectCss=read("packages/ui/src/ui-effects/effects.css");assert.match(slider,/--lfaa-slider-visual-progress/);assert.match(slider,/style\.setProperty/);assert.match(slider,/previewIndexRef/);assert.match(sliderCss,/cursor: grab/);assert.match(sliderCss,/cursor: grabbing/);assert.match(sliderCss,/background: #fff/);assert.doesNotMatch(runtimeCss,/translateZ\(0\)|will-change:\s*transform/);assert.match(runtimeController,/reasoningCommitQueueRef/);assert.match(runtimeRow,/active=\{boostActive\}/);assert.match(particleCanvas,/requestAnimationFrame/);assert.doesNotMatch(effectCss,/@keyframes|animation:/);});

test("RuntimeControl stays split into view/controller/row instead of recombining",()=>{assert.match(runtimeControl,/RuntimeModelPicker/);assert.match(runtimeControl,/ReasoningControlRow/);assert.doesNotMatch(runtimeControl,/reasoningCommitQueueRef/);assert.match(runtimeController,/reasoningCommitQueueRef/);});
