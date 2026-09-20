/**
 * 文件：UiEffectHost.tsx
 * 作用：把声明式 UI Effect 分派给稳定 Renderer。
 * 负责：Effect Registry 解析、active/variant 透传、Renderer 生命周期边界。
 * 不负责：业务状态、布局测量、Provider 参数、Pointer 交互或逐帧动画状态。
 * 状态归属：无业务状态；具体渲染生命周期由 renderer 组件内部持有。
 */
import type { UiEffectRegistry } from "./registry";
import type { UiEffectVariant } from "./contracts";
import { ParticleStreamCanvas } from "./ParticleStreamCanvas";
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
  if (effect.renderer === "particle-stream-canvas") {
    return <ParticleStreamCanvas effect={effect} active={active} variant={variant} />;
  }
  return null;
}
