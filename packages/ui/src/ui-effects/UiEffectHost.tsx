/**
 * 文件：UiEffectHost.tsx
 * 作用：把声明式 UI Effect 渲染为稳定常驻的视觉层。
 * 负责：Effect Registry 解析、active/variant 数据属性、粒子数量/时长/Palette CSS 变量。
 * 不负责：业务状态、布局测量、Provider 参数或 Pointer 交互。
 * 状态归属：无 React 动画状态；动画由 CSS compositor 驱动，避免业务组件重渲染造成闪屏。
 */
import type { CSSProperties } from "react";
import type { UiEffectRegistry } from "./registry";
import type { UiEffectVariant } from "./contracts";
import "./effects.css";

export interface UiEffectHostProps {
  registry: UiEffectRegistry;
  effectId: string;
  active?: boolean;
  variant?: UiEffectVariant;
}

export function UiEffectHost({ registry, effectId, active = true, variant = "standard" }: UiEffectHostProps) {
  const effect = registry.resolve(effectId);
  if (!effect) return null;
  if (effect.renderer === "meteor-trail") {
    const count = Math.max(1, Math.min(16, effect.particleCount ?? 9));
    const duration = Math.max(300, Math.min(4000, effect.durationMs ?? 1250));
    const palette = variant === "extreme" ? (effect.extremePalette ?? effect.palette) : effect.palette;
    const style = {
      "--lfaa-effect-duration": `${duration}ms`,
      ...(palette ? {
        "--lfaa-effect-color-1": palette[0],
        "--lfaa-effect-color-2": palette[1],
        "--lfaa-effect-color-3": palette[2],
        "--lfaa-effect-color-4": palette[3],
      } : {}),
    } as CSSProperties;
    return (
      <span
        className="lfaa-ui-effect lfaa-ui-effect--meteor"
        data-active={active ? "true" : "false"}
        data-variant={variant}
        style={style}
        aria-hidden="true"
      >
        {Array.from({ length: count }, (_, index) => <i key={index} style={{ "--lfaa-effect-index": index } as CSSProperties} />)}
      </span>
    );
  }
  return null;
}
