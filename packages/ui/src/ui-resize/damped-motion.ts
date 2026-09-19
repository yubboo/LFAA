/**
 * 文件：damped-motion.ts
 * 作用：给 Resize/Snap 提供与帧率无关的指数阻尼步进，避免 pointer 尺寸直接跳变产生僵硬/顿挫感。
 * 不负责：吸附阈值、业务布局、React 状态。
 */
export interface DampedMotionOptions {
  timeConstantMs: number;
  epsilon: number;
}

export const DEFAULT_DAMPED_RESIZE_MOTION: DampedMotionOptions = Object.freeze({
  timeConstantMs: 72,
  epsilon: 0.35,
});

export function stepDampedValue(current: number, target: number, deltaMs: number, timeConstantMs = DEFAULT_DAMPED_RESIZE_MOTION.timeConstantMs): number {
  if (!Number.isFinite(current) || !Number.isFinite(target)) return target;
  const tau = Math.max(1, timeConstantMs);
  const dt = Math.max(1, Math.min(64, deltaMs));
  const alpha = 1 - Math.exp(-dt / tau);
  const next = current + (target - current) * alpha;
  return Math.abs(target - next) <= DEFAULT_DAMPED_RESIZE_MOTION.epsilon ? target : next;
}
