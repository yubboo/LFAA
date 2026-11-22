// 统一导出 @lfaa/ui-primitives 共享交互组件（居中弹窗、浮层卡片、步进滑块）与设置中心通用控件。
import "./css-modules.d.ts";

export { ConfirmDialog, type ConfirmDialogProps } from "./ConfirmDialog";
export { HoverTip } from "./HoverTip";
export { ModalDialog, type ModalDialogProps } from "./ModalDialog";
export { PopoverCard, type PopoverCardProps } from "./PopoverCard";
export { StatusBanner, type StatusBannerProps } from "./StatusBanner";
export { StepSliderPopover, type StepSliderPopoverProps } from "./StepSliderPopover";
// 设置页通用外观与控件：分组卡片、条目行、开关、可搜索下拉；供设置中心各功能页共用。
export {
  SettingGroupCard,
  SettingRow,
  SettingSelect,
  SettingSwitch,
  type SettingSelectOption,
} from "./settings/SettingsControls";
export { default as settingsStyles } from "./settings/SettingsSurface.module.css";
export {
  clampStepIndex,
  computeStepRatio,
  type DialogAnimationPreset,
  type DialogSize,
  type PopoverPlacement,
  type StatusTone,
  type StepSliderOption,
} from "../contract/index";
