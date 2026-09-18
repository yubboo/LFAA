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
  bottom?: ReactNode;
  storageKey?: string;
  leftLimits?: WorkbenchPaneLimits;
  rightLimits?: WorkbenchPaneLimits;
  bottomLimits?: WorkbenchPaneLimits;
  snapHysteresis?: number;
  minCenterWidth?: number;
  leftCollapsed?: boolean;
  rightCollapsed?: boolean;
  bottomOpen?: boolean;
  onLeftCollapsedChange?: (collapsed: boolean) => void;
  onRightCollapsedChange?: (collapsed: boolean) => void;
  onBottomOpenChange?: (open: boolean) => void;
}
