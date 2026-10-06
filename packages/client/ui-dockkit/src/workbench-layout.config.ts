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

import { WORKBENCH_INTERACTION_TOKENS } from "./workbench-interaction.config.ts";
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
  snapCaptureRatio: number;
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
  separator: 1,
  left: {
    min: { ratio: 0.15, floor: 200, ceiling: 280 },
    initial: { ratio: 0.16, floor: 200, ceiling: 340 },
    max: { ratio: 0.34, floor: 360, ceiling: 560 },
  } satisfies PaneRuleSet,
  right: {
    min: { ratio: 0.20, floor: 228, ceiling: 288 },
    initial: { ratio: 0.22, floor: 240, ceiling: 340 },
    max: { ratio: 0.40, floor: 360, ceiling: 640 },
  } satisfies PaneRuleSet,
  center: {
    comfortable: { ratio: 0.50, floor: 440, ceiling: 720 },
    compactFloor: 420,
    applicationCompactFloor: 260,
    minimumHeight: 168, // 底部终端打开时为主工作区保留的最小高度。
  },
  bottom: {
    min: { ratio: 0.16, floor: 136, ceiling: 176 },
    initial: { ratio: 0.29, floor: 220, ceiling: 320 },
    max: { ratio: 0.58, floor: 320, ceiling: 560 },
  } satisfies PaneRuleSet,
  mobileGuard: 680,
} as const);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resolveScalar(base: number, rule: ScalarRule): number {
  return Math.round(clamp(base * rule.ratio, rule.floor, rule.ceiling));
}

/** 计算旧版默认栏宽；只供迁移旧版默认值，用户自定义尺寸不套用此规则。 */
export function resolveLegacyWorkbenchInitialWidths(containerWidth: number): { left: number; right: number } {
  const width = Math.max(1, Math.round(containerWidth || 0));
  return {
    left: resolveScalar(width, { ratio: 0.19, floor: 280, ceiling: 360 }),
    right: resolveScalar(width, { ratio: 0.24, floor: 252, ceiling: 360 }),
  };
}

/** 计算上一版默认初始栏宽；只用于把对应默认值迁移到当前默认，保留其他自定义宽度。 */
export function resolvePreviousWorkbenchInitialWidths(containerWidth: number): { left: number; right: number } {
  const width = Math.max(1, Math.round(containerWidth || 0));
  return {
    left: resolveScalar(width, { ratio: 0.18, floor: 200, ceiling: 340 }),
    right: resolveScalar(width, { ratio: 0.22, floor: 240, ceiling: 340 }),
  };
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
 * - Compact：通用 Surface 使用单侧 Dock；应用工作区可启用左右 Dock 并共享中心区底线；
 * - Mobile：左侧改 Overlay；应用工作区仍可在空间足够时保留右侧 Dock。
 */
export function resolveWorkbenchLayoutMetrics(containerWidth: number, containerHeight: number, responsiveRightDock = false): WorkbenchLayoutMetrics {
  // 保留真实容器边界；窄屏和矮窗必须进入移动布局，不能被桌面最小值抬高。
  const width = Math.max(1, Math.round(containerWidth || 0));
  const height = Math.max(1, Math.round(containerHeight || 0));
  const separator = WORKBENCH_LAYOUT_TOKENS.separator;

  const left = resolvePane(width, WORKBENCH_LAYOUT_TOKENS.left);
  const right = resolvePane(width, WORKBENCH_LAYOUT_TOKENS.right);
  const requestedBottom = resolvePane(height, WORKBENCH_LAYOUT_TOKENS.bottom);
  // 底部终端只使用主工作区保留区以外的高度，避免矮窗下挤没应用内容。
  const bottomBudget = Math.max(0, height - WORKBENCH_LAYOUT_TOKENS.center.minimumHeight);
  const bottomMax = Math.min(requestedBottom.max, bottomBudget);
  const bottomInitial = Math.min(requestedBottom.initial, bottomMax);
  const bottom = {
    min: Math.min(requestedBottom.min, bottomInitial),
    initial: bottomInitial,
    max: bottomMax,
  };
  const centerComfortable = resolveScalar(width, WORKBENCH_LAYOUT_TOKENS.center.comfortable);
  const compactCenterFloor = responsiveRightDock
    ? WORKBENCH_LAYOUT_TOKENS.center.applicationCompactFloor
    : WORKBENCH_LAYOUT_TOKENS.center.compactFloor;

  const desktopNeed = left.initial + right.initial + centerComfortable + separator * 2;
  const compactNeed = responsiveRightDock
    ? left.initial + right.min + compactCenterFloor + separator * 2
    : left.initial + Math.min(centerComfortable, WORKBENCH_LAYOUT_TOKENS.center.compactFloor + 60) + separator;
  const minCenterWidth = responsiveRightDock && width < desktopNeed
    ? compactCenterFloor
    : Math.min(centerComfortable, Math.max(compactCenterFloor, Math.round(width * 0.62)));

  const mode: WorkbenchLayoutMode = width >= desktopNeed
    ? "desktop"
    : width >= Math.max(WORKBENCH_LAYOUT_TOKENS.mobileGuard, compactNeed)
      ? "compact"
      : "mobile";

  const snapHysteresis = resolveScalar(width, WORKBENCH_INTERACTION_TOKENS.snap.releaseHysteresis);
  const snapCaptureRatio = WORKBENCH_INTERACTION_TOKENS.snap.captureRatio;

  return {
    mode,
    containerWidth: width,
    containerHeight: height,
    left,
    right,
    bottom,
    minCenterWidth,
    snapCaptureRatio,
    snapHysteresis,
  };
}
