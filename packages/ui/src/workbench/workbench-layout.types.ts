/**
 * 文件：workbench-layout.types.ts
 * 作用：定义三栏工作台布局状态与参数。
 * 负责：纯 UI 布局参数。
 * 不负责：业务状态、资源 Registry、Agent 状态。
 */
import type { ReactNode } from "react";

export interface WorkbenchPaneLimits {
  min: number;
  max: number;
  initial: number;
}

export interface ResizableWorkbenchProps {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  storageKey?: string;
  leftLimits?: WorkbenchPaneLimits;
  rightLimits?: WorkbenchPaneLimits;
  snapHysteresis?: number;
  minCenterWidth?: number;
  leftCollapsed?: boolean;
  rightCollapsed?: boolean;
  onLeftCollapsedChange?: (collapsed: boolean) => void;
  onRightCollapsedChange?: (collapsed: boolean) => void;
}
