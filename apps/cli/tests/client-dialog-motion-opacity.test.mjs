import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const motionStyles = readFileSync(new URL("../../../packages/client/ui-theme/src/common.css", import.meta.url), "utf8");
const setupReminderSource = readFileSync(new URL("../../../packages/client/ui-settings-general/src/SetupReminder.tsx", import.meta.url), "utf8");

test("Ant Design 弹窗入场时面板保持不透明并由选定动效控制轻量位移", () => {
  assert.match(motionStyles, /\.ant-modal-root \.ant-modal:is\(\.ant-zoom-enter,\s*\.ant-zoom-appear\)\s*\{[^}]*opacity:\s*1\s*!important;/su);

  const enteringKeyframes = ["fluid-in", "fade-in", "lift-in"].map((name) => {
    const start = motionStyles.indexOf(`@keyframes lfaa-dialog-${name} {`);
    const end = motionStyles.indexOf("\n}", start);
    assert.ok(start >= 0 && end > start, `missing entering keyframes: ${name}`);
    return motionStyles.slice(start, end);
  }).join("\n");

  assert.doesNotMatch(enteringKeyframes, /\bopacity\s*:/u);
  assert.match(motionStyles, /body\[data-lfaa-dialog-wallpaper="true"\][^{]*\.ant-modal-root[^{}]*\.ant-modal-content\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--color-surface\) var\(--settings-background-surface-opacity\), transparent\);[^}]*backdrop-filter:\s*blur\(var\(--settings-glass-blur\)\);/su);
  assert.match(setupReminderSource, /rootClassName="setup-reminder-modal"/u);
});

test("静态弹窗保留 rc-motion 所需的结束事件且不改变视觉状态", () => {
  assert.match(motionStyles, /@keyframes lfaa-dialog-static\s*\{\s*from\s*\{\s*opacity:\s*1;\s*transform:\s*none;\s*\}\s*to\s*\{\s*opacity:\s*1;\s*transform:\s*none;\s*\}\s*\}/su);
  assert.equal((motionStyles.match(/lfaa-dialog-static 64ms steps\(1, end\) both/gu) ?? []).length, 4);

  const staticRules = motionStyles.slice(motionStyles.indexOf("/* 静态模式保持视觉不变"));
  assert.match(staticRules, /ant-zoom-enter[^}]*animation:\s*var\(--lfaa-dialog-motion-enter\)\s*!important;/su);
  assert.match(staticRules, /ant-zoom-leave[^}]*animation:\s*var\(--lfaa-dialog-motion-exit\)\s*!important;/su);
  assert.match(staticRules, /ant-modal-mask\.ant-fade-enter[^}]*animation:\s*var\(--lfaa-dialog-motion-enter\)\s*!important;/su);
  assert.match(staticRules, /ant-modal-mask\.ant-fade-leave[^}]*animation:\s*var\(--lfaa-dialog-motion-exit\)\s*!important;/su);
  assert.doesNotMatch(staticRules, /animation:\s*none\s*!important;/u);
  assert.match(motionStyles, /body\[data-lfaa-dialog-motion-effect\] \.ant-popover\.ant-zoom-big-enter\.ant-zoom-big-enter-active:has\(\.ant-popconfirm\),\s*body\[data-lfaa-dialog-motion-effect\] \.ant-popover\.ant-zoom-big-appear\.ant-zoom-big-appear-active:has\(\.ant-popconfirm\)\s*\{\s*animation:\s*var\(--lfaa-dialog-motion-enter\)\s*!important;/su);
  assert.match(motionStyles, /body\[data-lfaa-dialog-motion-effect\] \.ant-popover\.ant-zoom-big-leave\.ant-zoom-big-leave-active:has\(\.ant-popconfirm\)\s*\{\s*animation:\s*var\(--lfaa-dialog-motion-exit\)\s*!important;/su);
});
