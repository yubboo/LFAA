import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const motionStyles = readFileSync(new URL("../../../packages/client/ui-theme/src/common.css", import.meta.url), "utf8");
const workbenchStyles = readFileSync(new URL("../../../packages/client/ui-layout/src/workbench.css", import.meta.url), "utf8");

test("Ant Design 弹窗入场时面板保持不透明并由选定动效控制轻量位移", () => {
  assert.match(motionStyles, /\.ant-modal-root \.ant-modal:is\(\.ant-zoom-enter,\s*\.ant-zoom-appear\)\s*\{[^}]*opacity:\s*1\s*!important;/su);

  const enteringKeyframes = ["fluid-in", "fade-in", "lift-in"].map((name) => {
    const start = motionStyles.indexOf(`@keyframes lfaa-dialog-${name} {`);
    const end = motionStyles.indexOf("\n}", start);
    assert.ok(start >= 0 && end > start, `missing entering keyframes: ${name}`);
    return motionStyles.slice(start, end);
  }).join("\n");

  assert.doesNotMatch(enteringKeyframes, /\bopacity\s*:/u);
  assert.match(workbenchStyles, /\.credential-reminder-modal \.ant-modal-content\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--color-surface\) var\(--settings-background-surface-opacity\), transparent\);[^}]*backdrop-filter:\s*blur\(var\(--settings-glass-blur\)\);/su);
});
