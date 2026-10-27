/** 功能：解析账户 Appearance 的区域效果覆盖。作用：让登录与 Workbench 共用一致的继承/覆盖语义。 */
import { DEFAULT_USER_SETTINGS, type AppearanceSettings } from "lfaa-util-values/src/settings-contract.js";

export type AppearanceAreaId = keyof AppearanceSettings["areaEffects"];
export type WorkbenchAppearanceAreaId = Exclude<AppearanceAreaId, "login">;

type AppearanceAreaEffectSource = Pick<AppearanceSettings, "overlay" | "blur"> & Partial<Pick<AppearanceSettings, "areaEffects">>;

function isIntegerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum;
}

/** 登录区显式覆盖按原百分比显示；未覆盖时保留泛白修复中的全局遮罩 40% 回退。 */
export function resolveLoginAreaOverlay(globalOverlay: number, override: number | null | undefined): number {
  if (isIntegerInRange(override, 0, 75)) return override;
  const fallback = isIntegerInRange(globalOverlay, 0, 75) ? globalOverlay : DEFAULT_USER_SETTINGS.appearance.overlay;
  return fallback * 0.4;
}

/** 工作区区域只覆盖明确设置的字段，其余继续读取已保存的全局遮罩和玻璃模糊。 */
export function resolveWorkbenchAreaEffects(
  appearance: AppearanceAreaEffectSource,
  area: WorkbenchAppearanceAreaId
): { overlay: number; blur: number } {
  const defaults = DEFAULT_USER_SETTINGS.appearance;
  const current = appearance.areaEffects?.[area];
  const currentOverlay = current?.overlay;
  const currentBlur = current && "blur" in current ? current.blur : undefined;
  return {
    overlay: isIntegerInRange(currentOverlay, 0, 75)
      ? currentOverlay
      : isIntegerInRange(appearance.overlay, 0, 75) ? appearance.overlay : defaults.overlay,
    blur: isIntegerInRange(currentBlur, 0, 32)
      ? currentBlur
      : isIntegerInRange(appearance.blur, 0, 32) ? appearance.blur : defaults.blur
  };
}
