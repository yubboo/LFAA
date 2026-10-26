/** 功能：锁定共享卡片列表的错开入场与无障碍偏好合同。作用：避免列表动画节奏偏离规范或绕过现有动效设置。关联文件：packages/client/ui-theme/src/common.css、packages/client/ui-layout/src/Workbench.tsx。 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const commonStyles = readFileSync(new URL("../../../packages/client/ui-theme/src/common.css", import.meta.url), "utf8");
const workbench = readFileSync(new URL("../../../packages/client/ui-layout/src/Workbench.tsx", import.meta.url), "utf8");

test("共享卡片列表前六项按 40ms 间隔依次入场", () => {
  const delays = [...commonStyles.matchAll(/\.lfaa-card-motion-list\s*>\s*\.lfaa-card-motion:nth-child\((\d+)\)\s*\{\s*animation-delay:\s*(\d+)ms;/gu)]
    .map(([, child, delay]) => [Number(child), Number(delay)]);

  assert.deepEqual(delays, [[2, 40], [3, 80], [4, 120], [5, 160], [6, 200]]);
  assert.match(commonStyles, /\.lfaa-card-motion-list\s*>\s*\.lfaa-card-motion:nth-child\(-n \+ 6\)/u);
  assert.match(commonStyles, /@keyframes lfaa-card-motion-fluid-enter\s*\{[^}]*opacity:[^}]*transform:/u);
});

test("卡片列表沿用用户动效选择并遵从减少动态效果", () => {
  assert.match(workbench, /data-card-motion-effect=\{settings\.general\.cardMotionEffect \?\? DEFAULT_USER_SETTINGS\.general\.cardMotionEffect\}/u);
  assert.match(workbench, /data-reduced-motion=\{appearanceAdvanced\.reducedMotion\}/u);
  assert.match(commonStyles, /data-card-motion-effect="none"\][\s\S]*?\.lfaa-card-motion[\s\S]*?animation:\s*none !important;/u);
  assert.match(commonStyles, /data-reduced-motion="on"\][\s\S]*?\.lfaa-card-motion[\s\S]*?animation:\s*none !important;/u);
  assert.match(commonStyles, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?data-reduced-motion="system"[\s\S]*?\.lfaa-card-motion[\s\S]*?animation:\s*none !important;/u);
});
