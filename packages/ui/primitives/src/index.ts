// 定义 @lfaa/ui-primitives 无 DOM 公共契约类型与纯计算工具函数，供 Host 与各业务 UI 包统一复用弹窗尺寸、动效预设及步进计算。
export type DialogSize = "sm" | "md" | "lg";
export type DialogAnimationPreset = "scale" | "fade" | "slide-up";
export type PopoverPlacement = "top-start" | "top-end" | "bottom-start" | "bottom-end";
export type StatusTone = "info" | "success" | "warning" | "error" | "loading";

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

export function clampStepIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(total - 1, Math.round(index)));
}
