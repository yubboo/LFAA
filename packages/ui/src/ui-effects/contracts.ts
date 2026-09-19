/** UI Effect 是声明式贡献，不允许普通插件直接操作 document/body。 */
export type UiEffectRendererKind = "meteor-trail";

export interface UiEffectDefinition {
  id: string;
  title: string;
  renderer: UiEffectRendererKind;
  particleCount?: number;
  durationMs?: number;
  reducedMotion?: "disable" | "static";
}

export interface UiEffectRegistration {
  ownerId: string;
  definition: UiEffectDefinition;
}
