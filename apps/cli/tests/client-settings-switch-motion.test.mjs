/** 功能：回归 SettingsSwitch 的 Jelly Toggle 动效合同。作用：确保局部动画不改变真实开关回调，并持续服从 Workbench 减少动态效果设置。关联文件：packages/client/ui-primitives/src/settings-controls.tsx、packages/client/ui-theme/src/common.css。 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const controls = readFileSync(new URL("../../../packages/client/ui-primitives/src/settings-controls.tsx", import.meta.url), "utf8");
const motionStyles = readFileSync(new URL("../../../packages/client/ui-theme/src/common.css", import.meta.url), "utf8");
const workbenchStyles = readFileSync(new URL("../../../packages/client/ui-layout/src/workbench.css", import.meta.url), "utf8");

test("设置开关保留受控语义，并只在点击后重播本地滑块动效", () => {
  assert.match(controls, /const \[motionKey, setMotionKey\] = useState\(0\);/u);
  assert.match(controls, /if \(disabled\) return;[\s\S]*?setMotionKey\(current => current === 1 \? 2 : 1\);[\s\S]*?onChange\(\);/u);
  assert.match(controls, /role="switch"[^>]*aria-checked=\{checked\}[^>]*disabled=\{disabled\}[^>]*onClick=\{handleClick\}/u);
  assert.match(controls, /<span key=\{motionKey\} className=\{"settings-switch__thumb" \+ \(motionKey > 0 \? " is-jelly" : ""\)\}/u);
  assert.doesNotMatch(controls, /setTimeout|requestAnimationFrame|addEventListener/u);
});

test("Jelly Toggle 只用 transform 动画，并沿用用户与系统减少动态效果映射", () => {
  assert.match(motionStyles, /--settings-switch-jelly-duration:\s*350ms;\s*\/\*[^*]*设置中心[^*]*\*\//u);
  assert.match(motionStyles, /--settings-switch-jelly-spring:\s*cubic-bezier\(\.34,\s*1\.36,\s*\.64,\s*1\);/u);
  assert.match(motionStyles, /animation:\s*lfaa-settings-switch-jelly var\(--settings-switch-jelly-duration\)/u);

  const keyframesStart = motionStyles.indexOf("@keyframes lfaa-settings-switch-jelly {");
  const keyframesEnd = motionStyles.indexOf("\n}", keyframesStart);
  assert.ok(keyframesStart >= 0 && keyframesEnd > keyframesStart, "Jelly Toggle keyframes are present");
  const keyframes = motionStyles.slice(keyframesStart, keyframesEnd);
  assert.match(keyframes, /42%\s*\{\s*transform:\s*scaleX\(1\.38\);/u);
  assert.match(keyframes, /68%\s*\{\s*transform:\s*scaleX\(\.96\);/u);
  assert.doesNotMatch(keyframes, /\b(?:top|left|width|height|margin)\s*:/u);

  assert.match(workbenchStyles, /\.workbench-shell\[data-reduced-motion="on"\][\s\S]*?animation-duration:\s*0\.01ms !important;/u);
  assert.match(workbenchStyles, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?data-reduced-motion="system"[\s\S]*?animation-duration:\s*0\.01ms !important;/u);
});
