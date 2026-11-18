// 统一导出 @lfaa/ui-primitives 共享交互组件（居中弹窗、锚点浮窗卡片、步进滑块弹窗）及基础类型。
import "./css-modules.d.ts";

export { ConfirmDialog, type ConfirmDialogProps } from "./ConfirmDialog";
export { HoverTip } from "./HoverTip";
export { ModalDialog, type ModalDialogProps } from "./ModalDialog";
export { PopoverCard, type PopoverCardProps } from "./PopoverCard";
export { StatusBanner, type StatusBannerProps } from "./StatusBanner";
export { StepSliderPopover, type StepSliderPopoverProps } from "./StepSliderPopover";
export {
  clampStepIndex,
  computeStepRatio,
  type DialogAnimationPreset,
  type DialogSize,
  type PopoverPlacement,
  type StatusTone,
  type StepSliderOption,
} from "../src/index";
