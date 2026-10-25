/**
 * 功能：回归 `/work` Git 项目摘要卡的右栏宽度响应行为。
 * 作用：验证截图对应的窄/宽边界，并确保测量基于实际工作台几何。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { GIT_SUMMARY_AUTO_OPEN_RIGHT_RATIO, shouldAutoOpenGitSummary } from "../../../packages/client/ui-workspace/src/git-summary-layout.config.ts";

const workspace = readFileSync(new URL("../../../packages/client/ui-workspace/src/ApplicationWorkspace.tsx", import.meta.url), "utf8");
const compactResetEffect = workspace.match(/useEffect\(\(\) => \{\s*if \(mode !== "ai-work" \|\| voiceMode \|\| metrics\.mode !== "compact"\) return;[\s\S]*?\}, \[metrics\.mode, mode, voiceMode\]\)/u)?.[0];
const responsiveEffect = workspace.match(/useEffect\(\(\) => \{\s*if \(mode !== "ai-work" \|\| metrics\.mode !== "desktop" \|\| voiceMode \|\| chrome\.rightCollapsed\) return;[\s\S]*?\}, \[chrome\.rightCollapsed, metrics\.mode, mode, voiceMode\]\)/u)?.[0];

test("Git 摘要默认展开/收起边界匹配参考图中的右栏宽度", () => {
  assert.equal(GIT_SUMMARY_AUTO_OPEN_RIGHT_RATIO, 0.76);
  assert.equal(shouldAutoOpenGitSummary(830, 1239), true, "参考图中的窄右栏默认展开摘要");
  assert.equal(shouldAutoOpenGitSummary(1056, 1239), false, "参考图中的宽右栏默认收起摘要");
  assert.equal(shouldAutoOpenGitSummary(1444, 1900), true, "临界值本身仍属于默认展开区间");
  assert.equal(shouldAutoOpenGitSummary(1445, 1900), false, "刚越过临界值后默认收起摘要");
  assert.equal(shouldAutoOpenGitSummary(0, 1239), null, "已收起或尚未布局的右栏不覆盖手动状态");
  assert.equal(shouldAutoOpenGitSummary(420, 0), null, "工作台尚无有效宽度时不改变摘要状态");
});

test("开合跟随真实工作台/右栏尺寸，只在初次测量或跨边界时变化", () => {
  assert.ok(responsiveEffect, "应有专属的 Git 摘要响应状态观察器");
  assert.match(workspace, /querySelector<HTMLElement>\("\.module-workbench-region--right-menu"\)/u);
  assert.match(workspace, /new ResizeObserver\(syncSummaryToRightWidth\)/u);
  assert.match(workspace, /observer\.observe\(workbench\)[\s\S]*?observer\.observe\(rightPane\)/u);
  assert.match(workspace, /gitSummaryResponsiveOpenRef\.current === shouldOpen/u, "同一宽度状态内不覆盖手动开合");
  assert.match(responsiveEffect, /setGitSummaryOpen\(shouldOpen\)/u, "自动开合只改浮层状态，不重复请求 Git 会话绑定");
  assert.doesNotMatch(responsiveEffect, /handleGitSummaryOpenChange|ensureSessionGitRepository/u, "自动开合不能重复发起 Git 初始化/绑定请求");
  assert.match(workspace, /metrics\.mode === "mobile"/u, "手机继续由现有摘要页按钮控制");
  assert.match(workspace, /observer\.disconnect\(\)/u, "布局变化或卸载时撤销观察器");
  assert.doesNotMatch(responsiveEffect, /window\.innerWidth/u, "响应边界不能依赖整个应用窗口宽度");
});

test("Compact 布局不自动展开 Git 摘要，切入时清除自动状态但保留手动入口", () => {
  assert.ok(compactResetEffect, "切入 Compact 时应重置桌面自动展开状态");
  assert.match(compactResetEffect, /gitSummaryResponsiveOpenRef\.current = null;[\s\S]*?setGitSummaryOpen\(false\);[\s\S]*?setGitSummaryActionRepositoryId\(null\);/u);
  assert.ok(responsiveEffect, "应有专属的 Git 摘要响应状态观察器");
  assert.match(responsiveEffect, /metrics\.mode !== "desktop"/u, "比例自动开合仅适用于桌面布局");
  assert.doesNotMatch(compactResetEffect, /gitSummaryOpen/u, "紧凑布局手动开合不触发自动重置");
  assert.match(workspace, /metrics\.mode === "mobile" \? <Button[\s\S]*?: <Popover[\s\S]*?open=\{gitSummaryOpen\}/u, "紧凑模式仍使用可手动开合的中心摘要浮层，手机分支保持原样");
});
