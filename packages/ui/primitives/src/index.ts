// 定义 @lfaa/ui-primitives 无 DOM 公共契约类型与纯计算工具函数，供 Host 与各业务 UI 包统一复用弹窗尺寸、动效预设及步进计算。
export type DialogSize = "sm" | "md" | "lg";
/** 定义共享弹窗暴露给业务组件的动画预设。 */
export type DialogAnimationPreset = "scale" | "fade" | "slide-up";
/** 定义锚点浮层可以对齐的方向。 */
export type PopoverPlacement = "top-start" | "top-end" | "bottom-start" | "bottom-end";
/** 统一状态提示使用的语义类型。 */
export type StatusTone = "info" | "success" | "warning" | "error" | "loading";

/** 描述离散滑块上的一个业务档位及标签。 */
export interface StepSliderOption<T extends string = string> {
  id: T;
  label: string;
  description?: string;
}

// 计算步进滑块的归一化百分比（0~100），确保单步或多步选项都能平滑对齐轨道刻度点。
export function computeStepRatio(index: number, total: number): number {
  if (total <= 1) return 100;
  const clamped = Math.max(0, Math.min(total - 1, index));
  return Math.round((clamped / (total - 1)) * 1000) / 10;
}

/** 将滑块索引限制在已有的档位范围内。 */
export function clampStepIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(total - 1, Math.round(index)));
}
