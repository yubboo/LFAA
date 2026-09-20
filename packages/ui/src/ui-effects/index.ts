export type { UiEffectDefinition, UiEffectRegistration, UiEffectRendererKind, UiEffectVariant } from "./contracts";
export { UiEffectRegistry } from "./registry";
export { UiEffectHost } from "./UiEffectHost";

import { UiEffectRegistry } from "./registry";

export const builtinUiEffectRegistry = new UiEffectRegistry();
builtinUiEffectRegistry.register("@lfaa/ui", {
  id: "reasoning-overdrive",
  title: "强力推理流星",
  renderer: "particle-stream-canvas",
  particleCount: 16,
  durationMs: 1480,
  reducedMotion: "disable",
  // Canvas Renderer 在运行时解析可继承 CSS Token；Settings/Theme 未来只覆盖 Token，不需要改动画算法。
  palette: [
    "var(--lfaa-reasoning-standard-color-1, #ffc1dc)",
    "var(--lfaa-reasoning-standard-color-2, #f578ad)",
    "var(--lfaa-reasoning-standard-color-3, #ea5a9d)",
    "var(--lfaa-reasoning-standard-color-4, #df4b92)",
  ],
  extremePalette: [
    "var(--lfaa-reasoning-extreme-color-1, #ffc1dc)",
    "var(--lfaa-reasoning-extreme-color-2, #f05aa6)",
    "var(--lfaa-reasoning-extreme-color-3, #9b5cff)",
    "var(--lfaa-reasoning-extreme-color-4, #5d2ecb)",
  ],
});
