/**
 * 文件：workbench-layout.types.ts
 * 作用：定义 ResizableWorkbench 的布局参数和受控状态接口。
 * 负责：左右栏/底栏尺寸限制、内容插槽、开合状态回调。
 * 不负责：具体拖拽算法、视觉样式、业务内容。
 * 状态归属：类型契约，无运行时状态。
 * 对外接口：WorkbenchPaneLimits、ResizableWorkbenchProps。
 * 关联文件：ResizableWorkbench.tsx、css/common.css、@lfaa/app-shell。
 * 修改注意事项：受控属性与回调必须成对考虑，避免父子状态出现双事实源。
 */
import type { ReactNode } from "react";

export type WorkbenchLayoutMode = "desktop" | "compact" | "mobile";

export interface WorkbenchPaneLimits {
  min: number;
  max: number;
  initial: number;
}

export interface WorkbenchCollapseState {
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  /** Whether the state came from a valid saved layout rather than page defaults. */
  restored: boolean;
}

export interface ResizableWorkbenchProps {
  left: ReactNode;
  center: ReactNode;
  /** 可选的前置区域；启用后与 left、center、right 同属布局根节点。 */
  leading?: ReactNode;
  /** 与区域同级渲染的浮层内容，不参与工作区列宽计算。 */
  overlay?: ReactNode;
  /** 布局根节点的额外样式作用域。 */
  className?: string;
  leadingRegionClassName?: string;
  leftRegionClassName?: string;
  centerRegionClassName?: string;
  rightRegionClassName?: string;
  bottomRegionClassName?: string;
  /** 关闭时不读取或写入 localStorage；适用于栏宽只应在当前页面会话内生效的工作区。 */
  persistState?: boolean;
  /** 可选根元素引用；供容器观察和页面级定位复用同一布局根。 */
  rootElementRef?: { current: HTMLDivElement | null };
  /** 隐藏左侧 pane 与 resize handle；常驻导航轨作为可选区域独立管理。 */
  leftVisible?: boolean;
  /** 可选右栏；省略时不渲染右栏与右侧 separator，供 Settings 等单侧导航 Surface 复用同一几何能力。 */
  right?: ReactNode;
  bottom?: ReactNode;
  storageKey?: string;
  leftLimits?: WorkbenchPaneLimits;
  rightLimits?: WorkbenchPaneLimits;
  bottomLimits?: WorkbenchPaneLimits;
  /** 当前可用布局宽度；前置区域由观察器扣除，用于响应式预算与旧版默认栏宽迁移。 */
  containerWidth?: number;
  /** 吸附捕获比例：拖到 min × ratio 才正式吸附；默认来自统一 Workbench interaction config。 */
  snapCaptureRatio?: number;
  snapHysteresis?: number;
  /** 可按 Surface 覆盖吸附/释放动画时长；默认所有 Surface 共用统一配置。 */
  snapCaptureDurationMs?: number;
  snapReleaseDurationMs?: number;
  snapSettleDurationMs?: number;
  minCenterWidth?: number;
  /** 受控中心内容收起状态；右栏拖动吸附或明确页签操作都可请求更新。 */
  centerCollapsed?: boolean;
  /** 仅允许右侧 Dock 越过中心区 min 后通过超拖吸附手势收起中心列。 */
  centerCollapseEnabled?: boolean;
  /** 可选受控左栏宽度；提供后由父组件成为 leftWidth 唯一事实源。 */
  leftWidth?: number;
  /** Collapse defaults used only when this storage key has no valid saved layout. */
  initialLeftCollapsed?: boolean;
  initialRightCollapsed?: boolean;
  leftCollapsed?: boolean;
  rightCollapsed?: boolean;
  /** Reports the resolved initial collapse state once, so page controls can mirror DockKit restoration. */
  onInitialCollapseState?: (state: WorkbenchCollapseState) => void;
  bottomOpen?: boolean;
  /** 当前容器布局模式；决定左右栏使用 Dock 还是 Overlay。 */
  layoutMode?: WorkbenchLayoutMode;
  /** 应用工作区在 Compact/Mobile 中优先保留可并排的右侧 Dock；通用 Surface 默认保持原布局。 */
  responsiveRightDock?: boolean;
  /** 应用工作区在 Mobile 中空间足够时让左侧导航占据 Dock 列；空间不足时继续使用 Overlay。 */
  responsiveLeftDock?: boolean;
  /** 当前左栏真实宽度变化；供 Shell 的 Hover Preview 与正式 Dock 共享同一几何事实源。 */
  onLeftWidthChange?: (width: number) => void;
  onLeftCollapsedChange?: (collapsed: boolean) => void;
  onRightCollapsedChange?: (collapsed: boolean) => void;
  onCenterCollapsedChange?: (collapsed: boolean) => void;
  /** 中心列吸附预览状态；只在阈值进入/退出和手势结束时通知，不随每帧尺寸更新。 */
  onCenterCollapsePreviewChange?: (preview: boolean | null) => void;
  onBottomOpenChange?: (open: boolean) => void;
}
