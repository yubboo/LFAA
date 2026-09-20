/**
 * UI Extension 只声明“贡献什么”，不允许普通插件直接查找/修改 LFAA DOM。
 * 后续 Plugin Runtime 通过 Adapter 把合法 contribution 注册进 UI Registry。
 */
export type UiExtensionKind = "effect" | "slot" | "renderer" | "panel" | "action";

export interface UiExtensionContribution {
  id: string;
  ownerId: string;
  kind: UiExtensionKind;
  slot?: string;
  title?: string;
  payload: Readonly<Record<string, unknown>>;
}
