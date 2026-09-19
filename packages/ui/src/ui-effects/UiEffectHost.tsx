import type { CSSProperties } from "react";
import type { UiEffectRegistry } from "./registry";
import "./effects.css";

export interface UiEffectHostProps {
  registry: UiEffectRegistry;
  effectId: string;
  active?: boolean;
}

export function UiEffectHost({ registry, effectId, active = true }: UiEffectHostProps) {
  if (!active) return null;
  const effect = registry.resolve(effectId);
  if (!effect) return null;
  if (effect.renderer === "meteor-trail") {
    const count = Math.max(1, Math.min(16, effect.particleCount ?? 7));
    const duration = Math.max(300, Math.min(4000, effect.durationMs ?? 1150));
    return (
      <span className="lfaa-ui-effect lfaa-ui-effect--meteor" style={{ "--lfaa-effect-duration": `${duration}ms` } as CSSProperties} aria-hidden="true">
        {Array.from({ length: count }, (_, index) => <i key={index} style={{ "--lfaa-effect-index": index } as CSSProperties} />)}
      </span>
    );
  }
  return null;
}
