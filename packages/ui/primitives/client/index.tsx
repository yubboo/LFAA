// 统一导出 @lfaa/ui-primitives 共享交互组件（折叠面板与展开按钮、居中弹窗、浮层卡片、步进滑块、滚动容器）与设置中心通用控件。
import "./css-modules.d.ts";

export { CollapsePane } from "./CollapsePane";
export { CapsuleBar, type CapsuleBarProps } from "./CapsuleBar";
export { ConfirmDialog, type ConfirmDialogProps } from "./ConfirmDialog";
export { HoverTip } from "./HoverTip";
export { ModalDialog, type ModalDialogProps } from "./ModalDialog";
export { PopoverCard, type PopoverCardProps } from "./PopoverCard";
export { ScrollArea, type ScrollAreaProps, type ScrollAxis } from "./ScrollArea";
export { StatusBanner, type StatusBannerProps } from "./StatusBanner";
export { PanelToggleButton, type PanelToggleSide } from "./PanelToggleButton";
export { StepSliderPopover, type StepSliderPopoverProps } from "./StepSliderPopover";
// Base UI 无头底座封装：下拉菜单、右键菜单、触感开关、下拉选择器、分段标签与悬浮提示。
export {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
  type ContextMenuProps,
} from "./base/ContextMenu";
export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
  type DropdownMenuProps,
} from "./base/DropdownMenu";
export { UiSwitch, type UiSwitchProps } from "./base/UiSwitch";
export { UiSelect, type UiSelectOption, type UiSelectProps } from "./base/UiSelect";
export { UiTabs, type UiTabItem, type UiTabsProps } from "./base/UiTabs";
export { UiTooltip, type UiTooltipProps } from "./base/UiTooltip";
// 折叠面板的挂载保持：收起过渡结束前不卸载内容，展开后立即恢复。
export {
  PANE_TRANSITION_MS,
  prefersReducedMotion,
  resolvePaneTransitionMs,
  usePanePresence,
} from "./usePanePresence";
export { useDismissibleLayer } from "./useDismissibleLayer";
// 可见性感知轮询：后台标签页停表、回前台补一次，供工作台面板统一使用。
export { useVisibleInterval } from "./useVisibleInterval";
// 设置页通用外观与控件：页外壳、无边框分组、条目行、表单字段、危险组、开关、分段与可搜索下拉；供设置中心各功能页共用。
export {
  SettingDangerGroup,
  SettingFormActions,
  SettingFormBlock,
  SettingFormField,
  SettingGroup,
  SettingRow,
  SettingSegmented,
  SettingsPage,
  SettingSwitch,
} from "./settings/SettingsControls";
export { SettingMultiSelect, SettingSelect, type SettingSelectOption } from "./settings/SettingSelect";
// 设置页样式合并导出：排版层（页/分组/行）与控件层（表单/按钮/开关）分别维护，调用方仍只取一个对象。
export { settingsStyles } from "./settings/settingsStyles";
export {
  clampStepIndex,
  computeStepRatio,
  type DialogAnimationPreset,
  type DialogSize,
  type PopoverPlacement,
  type StatusTone,
  type StepSliderOption,
} from "../contract/index";
