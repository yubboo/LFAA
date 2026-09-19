export type { UiEffectDefinition, UiEffectRegistration, UiEffectRendererKind } from "./contracts";
export { UiEffectRegistry } from "./registry";
export { UiEffectHost } from "./UiEffectHost";

import { UiEffectRegistry } from "./registry";

export const builtinUiEffectRegistry = new UiEffectRegistry();
builtinUiEffectRegistry.register("@lfaa/ui", {
  id: "reasoning-overdrive",
  title: "强力推理流星",
  renderer: "meteor-trail",
  particleCount: 7,
  durationMs: 1150,
  reducedMotion: "disable",
});
