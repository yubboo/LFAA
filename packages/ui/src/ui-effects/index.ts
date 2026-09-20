export type { UiEffectDefinition, UiEffectRegistration, UiEffectRendererKind, UiEffectVariant } from "./contracts";
export { UiEffectRegistry } from "./registry";
export { UiEffectHost } from "./UiEffectHost";

import { UiEffectRegistry } from "./registry";

export const builtinUiEffectRegistry = new UiEffectRegistry();
builtinUiEffectRegistry.register("@lfaa/ui", {
  id: "reasoning-overdrive",
  title: "强力推理流星",
  renderer: "meteor-trail",
  particleCount: 10,
  durationMs: 1280,
  reducedMotion: "disable",
  // 使用可继承 CSS Token + fallback；Settings/Theme 未来只覆盖 Token，不需要改 Renderer/Registry。
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
