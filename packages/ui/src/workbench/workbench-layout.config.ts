/**
 * 文件：workbench-layout.config.ts
 * 作用：集中定义 Workbench 的响应式几何变量和计算公式，避免把 280px / 360px 这类魔法数字散落在组件里。
 * 负责：根据“工作台容器自身”的宽高计算 LayoutMode、左右栏 min/initial/max、底部面板高度、中心区最小宽度和吸附迟滞。
 * 不负责：React 状态、Pointer 事件、CSS 视觉、业务内容。
 * 状态归属：纯函数，无运行时状态。
 * 对外接口：WORKBENCH_LAYOUT_TOKENS、resolveWorkbenchLayoutMetrics、WorkbenchLayoutMetrics、WorkbenchLayoutMode。
 * 关联文件：AgentWorkbench.tsx、ResizableWorkbench.tsx、workbench-layout.types.ts、workbench.css。
 * 修改注意事项：以后改响应式尺寸优先改这里的比例/上下限；不要再在 App Shell 里直接写侧栏宽度常量。
 */

import type { WorkbenchLayoutMode, WorkbenchPaneLimits } from "./workbench-layout.types";

interface ScalarRule {
  ratio: number;
  floor: number;
  ceiling: number;
}

interface PaneRuleSet {
  min: ScalarRule;
  initial: ScalarRule;
  max: ScalarRule;
}

export interface WorkbenchLayoutMetrics {
  mode: WorkbenchLayoutMode;
  containerWidth: number;
  containerHeight: number;
  left: WorkbenchPaneLimits;
  right: WorkbenchPaneLimits;
  bottom: WorkbenchPaneLimits;
  minCenterWidth: number;
  snapHysteresis: number;
}

/**
 * 所有数值都集中在这里。
 * - ratio：跟随当前工作台容器变化；
 * - floor / ceiling：避免极端宽度下过小或过大；
 * - ResizableWorkbench 最终接收的仍然是 px，因为 PointerEvent/clientX/clientY 本身就是 CSS px。
 *
 * 关键区别：px 只作为“边界约束”，不再作为某个屏幕宽度下固定不变的布局答案。
 */
export const WORKBENCH_LAYOUT_TOKENS = Object.freeze({
  separator: 6,
  left: {
    min: { ratio: 0.165, floor: 196, ceiling: 232 },
    initial: { ratio: 0.19, floor: 216, ceiling: 288 },
    max: { ratio: 0.34, floor: 336, ceiling: 560 },
  } satisfies PaneRuleSet,
  right: {
    min: { ratio: 0.20, floor: 228, ceiling: 288 },
    initial: { ratio: 0.24, floor: 252, ceiling: 360 },
    max: { ratio: 0.40, floor: 360, ceiling: 640 },
  } satisfies PaneRuleSet,
  center: {
    comfortable: { ratio: 0.50, floor: 440, ceiling: 720 },
    compactFloor: 420,
  },
  bottom: {
    min: { ratio: 0.16, floor: 136, ceiling: 176 },
    initial: { ratio: 0.29, floor: 220, ceiling: 320 },
    max: { ratio: 0.58, floor: 320, ceiling: 560 },
  } satisfies PaneRuleSet,
  snapHysteresis: { ratio: 0.018, floor: 14, ceiling: 24 },
  mobileGuard: 680,
} as const);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resolveScalar(base: number, rule: ScalarRule): number {
  return Math.round(clamp(base * rule.ratio, rule.floor, rule.ceiling));
}

function resolvePane(widthOrHeight: number, rules: PaneRuleSet): WorkbenchPaneLimits {
  const min = resolveScalar(widthOrHeight, rules.min);
  const initial = Math.max(min, resolveScalar(widthOrHeight, rules.initial));
  const max = Math.max(initial, resolveScalar(widthOrHeight, rules.max));
  return { min, initial, max };
}

/**
 * 根据真实“工作台容器”尺寸决定布局，而不是使用 window.innerWidth。
 * 这能正确处理：浏览器小窗、桌面宿主嵌入、未来 Electron 标题栏、DevTools 占宽等情况。
 *
 * Mode 不是写死的 1240/760：
 * - Desktop：容器能同时容纳 left.initial + center.comfortable + right.initial；
 * - Compact：至少能容纳 left.initial + 中心区底线；右栏切换成 Overlay；
 * - Mobile：连左栏 Dock + 中心区都放不下，左右都切 Overlay。
 */
export function resolveWorkbenchLayoutMetrics(containerWidth: number, containerHeight: number): WorkbenchLayoutMetrics {
  const width = Math.max(320, Math.round(containerWidth || 0));
  const height = Math.max(360, Math.round(containerHeight || 0));
  const separator = WORKBENCH_LAYOUT_TOKENS.separator;

  const left = resolvePane(width, WORKBENCH_LAYOUT_TOKENS.left);
  const right = resolvePane(width, WORKBENCH_LAYOUT_TOKENS.right);
  const bottom = resolvePane(height, WORKBENCH_LAYOUT_TOKENS.bottom);
  const centerComfortable = resolveScalar(width, WORKBENCH_LAYOUT_TOKENS.center.comfortable);
  const minCenterWidth = Math.min(centerComfortable, Math.max(WORKBENCH_LAYOUT_TOKENS.center.compactFloor, Math.round(width * 0.62)));

  const desktopNeed = left.initial + right.initial + centerComfortable + separator * 2;
  const compactNeed = left.initial + Math.min(centerComfortable, WORKBENCH_LAYOUT_TOKENS.center.compactFloor + 60) + separator;

  const mode: WorkbenchLayoutMode = width >= desktopNeed
    ? "desktop"
    : width >= Math.max(WORKBENCH_LAYOUT_TOKENS.mobileGuard, compactNeed)
      ? "compact"
      : "mobile";

  const snapHysteresis = resolveScalar(width, WORKBENCH_LAYOUT_TOKENS.snapHysteresis);

  return {
    mode,
    containerWidth: width,
    containerHeight: height,
    left,
    right,
    bottom,
    minCenterWidth,
    snapHysteresis,
  };
}
