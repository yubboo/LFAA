/**
 * 功能：读取并保存工作台共用的左侧栏宽度。
 * 作用：让应用导航栏和设置中心复用同一个宽度偏好，并迁移早期页面分别保存的宽度。
 * 关联文件：packages/client/ui-workspace/src/ApplicationWorkspace.tsx、packages/client/ui-settings/src/SettingsPage.tsx、workbench-layout.types.ts。
 */
import type { WorkbenchPaneLimits } from "./workbench-layout.types";
import { resolveLegacyWorkbenchInitialWidths, resolvePreviousWorkbenchInitialWidths } from "./workbench-layout.config.ts";

export const WORKBENCH_LEFT_WIDTH_KEY = "lfaa.workbench.left-width.v3";

const PREVIOUS_SHARED_WIDTH_KEY = "lfaa.workbench.left-width.v2";
const LEGACY_SHARED_WIDTH_KEY = "lfaa.workbench.left-width.v1";
const LEGACY_APP_WIDTH_KEY = "lfaa.module-workbench.left-width.v1";
const LEGACY_APP_LAYOUT_KEY = "lfaa.module-workbench.layout.v1";
const LEGACY_SETTINGS_LAYOUT_KEY = "lfaa.settings.layout.v2";

function clampWidth(width: number, limits: WorkbenchPaneLimits): number {
  return Math.min(limits.max, Math.max(limits.min, width));
}

function readLayoutWidth(key: string): number | null {
  try {
    const stored = JSON.parse(window.localStorage.getItem(key) ?? "null") as { leftWidth?: unknown } | null;
    const width = Number(stored?.leftWidth);
    return Number.isFinite(width) && width > 0 ? width : null;
  } catch {
    return null;
  }
}

/** 读取统一宽度；旧版默认尺寸迁移到新默认，非默认值继续作为用户偏好保留。 */
export function readWorkbenchLeftWidth(limits: WorkbenchPaneLimits, containerWidth: number): number {
  if (typeof window === "undefined") return limits.initial;

  try {
    const shared = Number(window.localStorage.getItem(WORKBENCH_LEFT_WIDTH_KEY));
    if (Number.isFinite(shared) && shared > 0) return clampWidth(shared, limits);

    const previousShared = Number(window.localStorage.getItem(PREVIOUS_SHARED_WIDTH_KEY));
    if (Number.isFinite(previousShared) && previousShared > 0) {
      const previousDefault = resolvePreviousWorkbenchInitialWidths(containerWidth).left;
      const width = previousShared === previousDefault ? limits.initial : clampWidth(previousShared, limits);
      window.localStorage.setItem(WORKBENCH_LEFT_WIDTH_KEY, String(width));
      return width;
    }

    const previousLegacyShared = Number(window.localStorage.getItem(LEGACY_SHARED_WIDTH_KEY));
    const legacyDirect = Number(window.localStorage.getItem(LEGACY_APP_WIDTH_KEY));
    const legacyWidth = Number.isFinite(previousLegacyShared) && previousLegacyShared > 0
      ? previousLegacyShared
      : Number.isFinite(legacyDirect) && legacyDirect > 0
      ? legacyDirect
      : readLayoutWidth(LEGACY_APP_LAYOUT_KEY) ?? readLayoutWidth(LEGACY_SETTINGS_LAYOUT_KEY);
    if (legacyWidth !== null && legacyWidth !== undefined) {
      const previousDefault = resolveLegacyWorkbenchInitialWidths(containerWidth).left;
      const width = legacyWidth === previousDefault ? limits.initial : clampWidth(legacyWidth, limits);
      window.localStorage.setItem(WORKBENCH_LEFT_WIDTH_KEY, String(width));
      return width;
    }
  } catch {
    return limits.initial;
  }

  return limits.initial;
}

/** 保存按当前工作台边界夹取后的宽度，避免小窗遗留超出范围的栏宽。 */
export function saveWorkbenchLeftWidth(width: number, limits: WorkbenchPaneLimits): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WORKBENCH_LEFT_WIDTH_KEY, String(clampWidth(width, limits)));
  } catch {
    // 浏览器存储不可用时仍允许本次页面内拖动，不影响工作台操作。
  }
}
