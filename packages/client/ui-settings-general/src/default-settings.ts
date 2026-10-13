/** 功能：提供 lfaa-client-ui-settings-general 的现有界面能力。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。 */
import type { UserSettings } from "lfaa-client-connection/src/api.js";
import { DEFAULT_USER_SETTINGS as SHARED_DEFAULTS } from "lfaa-util-values/src/settings-contract.js";
export const DEFAULT_USER_SETTINGS: UserSettings = structuredClone(SHARED_DEFAULTS);

/** 补齐较旧设置响应里缺失的快捷键项，同时保留用户明确保存的空数组。 */
export function resolveShortcutSettings(value?: Partial<UserSettings["shortcuts"]> | null): UserSettings["shortcuts"] {
  const defaults = DEFAULT_USER_SETTINGS.shortcuts;
  const resolved = { ...defaults };
  for (const key of Object.keys(defaults) as Array<keyof UserSettings["shortcuts"]>) {
    const chords = value?.[key];
    resolved[key] = Array.isArray(chords) && chords.every((chord) => typeof chord === "string")
      ? [...chords]
      : [...defaults[key]];
  }
  return resolved;
}

/** 补齐较旧外观设置响应中缺失的背景项，同时保留用户选择的背景和“无背景”。 */
export function resolveAppearanceBackgrounds(value?: Partial<UserSettings["appearance"]["backgrounds"]> | null): UserSettings["appearance"]["backgrounds"] {
  const defaults = DEFAULT_USER_SETTINGS.appearance.backgrounds;
  const resolve = (key: keyof UserSettings["appearance"]["backgrounds"]): string => {
    const selected = value?.[key];
    return typeof selected === "string" && selected.length > 0 ? selected : defaults[key];
  };
  return {
    login: resolve("login"),
    appCenter: resolve("appCenter"),
    steamcmd: resolve("steamcmd"),
    minecraft: resolve("minecraft"),
    writing: resolve("writing"),
    settings: resolve("settings")
  };
}
