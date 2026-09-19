import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const root = new URL("../", import.meta.url);
const workbench = readFileSync(new URL("packages/app-shell/src/AgentWorkbench.tsx", root), "utf8");
const css = readFileSync(new URL("packages/app-shell/src/agent-workbench.css", root), "utf8");
const disclosure = readFileSync(new URL("packages/ui/src/ui-motion/AnimatedDisclosure.tsx", root), "utf8");
const disclosureCss = readFileSync(new URL("packages/ui/src/ui-motion/animated-disclosure.css", root), "utf8");
const resize = readFileSync(new URL("packages/ui/src/workbench/ResizableWorkbench.tsx", root), "utf8");
const damped = readFileSync(new URL("packages/ui/src/ui-resize/damped-motion.ts", root), "utf8");
const layers = readFileSync(new URL("packages/ui/src/ui-overlay/layers.css", root), "utf8");

test("shared interaction primitives live under packages/ui/src/ui-xxx", () => {
  for (const folder of ["ui-motion", "ui-shortcuts", "ui-resize", "ui-overlay"]) {
    assert.equal(existsSync(new URL(`packages/ui/src/${folder}/`, root)), true, `${folder} missing`);
  }
});

test("runtime model picker uses stable disclosure and real shortcuts", () => {
  assert.match(workbench, /<AnimatedDisclosure open=\{runtimeModelPickerOpen\}/);
  assert.match(workbench, /Ctrl\+Shift\+M/);
  assert.match(workbench, /Ctrl\+Shift\+P/);
  assert.match(workbench, /useShortcut\(\{ key: "m", ctrl: true, shift: true \}/);
  assert.match(disclosure, /lfaa-animated-disclosure/);
  assert.match(disclosureCss, /grid-template-rows: 0fr/);
  assert.match(disclosureCss, /grid-template-rows: 1fr/);
});

test("overlay layers and runtime tooltips do not rely on clipped local z-index", () => {
  for (const token of ["--lfaa-layer-popover", "--lfaa-layer-tooltip", "--lfaa-layer-modal"]) assert.match(layers, new RegExp(token));
  assert.match(css, /var\(--lfaa-layer-tooltip/);
  assert.match(css, /\.agent-runtime-control-card\{[^}]*overflow:visible/s);
  assert.doesNotMatch(css, /\.agent-runtime-control-card\{[^}]*contain:layout paint/s);
});

test("workbench resize consumes reusable frame-rate independent damping", () => {
  assert.match(damped, /1 - Math\.exp\(-dt \/ tau\)/);
  assert.match(resize, /stepDampedValue/);
  assert.match(resize, /drag\.visualSize/);
});
