/** UI Effect 是声明式贡献，不允许普通插件直接操作 document/body。 */
export type UiEffectRendererKind = "meteor-trail";
export type UiEffectVariant = "standard" | "extreme";

export interface UiEffectDefinition {
  id: string;
  title: string;
  renderer: UiEffectRendererKind;
  particleCount?: number;
  durationMs?: number;
  reducedMotion?: "disable" | "static";
  /** Renderer 调色板只描述视觉，不参与业务状态；可由未来 Settings/Effect Pack 覆盖。 */
  palette?: readonly [string, string, string, string];
  extremePalette?: readonly [string, string, string, string];
}

export interface UiEffectRegistration {
  ownerId: string;
  definition: UiEffectDefinition;
}
