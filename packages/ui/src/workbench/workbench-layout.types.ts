/**
 * 文件：workbench-layout.types.ts
 * 作用：定义 ResizableWorkbench 的布局参数和受控状态接口。
 * 负责：左右栏/底栏尺寸限制、内容插槽、开合状态回调。
 * 不负责：具体拖拽算法、视觉样式、业务内容。
 * 状态归属：类型契约，无运行时状态。
 * 对外接口：WorkbenchPaneLimits、ResizableWorkbenchProps。
 * 关联文件：ResizableWorkbench.tsx、workbench.css、@lfaa/app-shell。
 * 修改注意事项：受控属性与回调必须成对考虑，避免父子状态出现双事实源。
 */
import type { ReactNode } from "react";

export type WorkbenchLayoutMode = "desktop" | "compact" | "mobile";

export interface WorkbenchPaneLimits {
  min: number;
  max: number;
  initial: number;
}

export interface ResizableWorkbenchProps {
  left: ReactNode;
  center: ReactNode;
  /** 可选右栏；省略时不渲染右栏与右侧 separator，供 Settings 等单侧导航 Surface 复用同一几何能力。 */
  right?: ReactNode;
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
  /** 当前容器布局模式；决定左右栏使用 Dock 还是 Overlay。 */
  layoutMode?: WorkbenchLayoutMode;
  /** 当前左栏真实宽度变化；供 Shell 的 Hover Preview 与正式 Dock 共享同一几何事实源。 */
  onLeftWidthChange?: (width: number) => void;
  onLeftCollapsedChange?: (collapsed: boolean) => void;
  onRightCollapsedChange?: (collapsed: boolean) => void;
  onBottomOpenChange?: (open: boolean) => void;
}
