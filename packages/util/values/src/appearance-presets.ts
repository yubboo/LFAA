/**
 * 功能：登记内置外观预设，并提供账户当前外观与预设快照间的纯映射。
 * 作用：让内置方案、保存、应用与“当前方案”判断共用同一个快照字段白名单。
 * 关联文件：settings-contract.ts、settings/settings/src/service.ts、client/ui-settings/src/AppearancePresetsPanel.tsx。
 */
import {
  DEFAULT_USER_SETTINGS,
  type AppearanceSettings,
  type AppearanceAdvancedSettings,
  type AppearancePreset,
  type AppearancePresetGeneralSettings,
  type AppearancePresetSnapshot,
  type AppearanceVisualSettings,
  type UserSettings
} from "./settings-contract.js";

export const WRITING_WORKSPACE_PRESET = {
  id: "writing-yunjian",
  name: "云涧书境",
  description: "山雾晨光与暖木书案，为写作工作区营造安静的沉浸感。",
  overlay: 48,
  blur: 8
} as const;

/** 仅覆盖写作工作区外观；不修改登录页、全局主题或任何其他账户偏好。 */
export function applyWritingWorkspacePresetAppearance(appearance: AppearanceSettings): AppearanceSettings {
  return {
    ...appearance,
    backgrounds: { ...appearance.backgrounds, writing: WRITING_WORKSPACE_PRESET.id },
    areaEffects: {
      ...appearance.areaEffects,
      writing: { overlay: WRITING_WORKSPACE_PRESET.overlay, blur: WRITING_WORKSPACE_PRESET.blur }
    },
    advanced: { ...appearance.advanced, writingLightRaysEnabled: true }
  };
}

export function writingWorkspacePresetMatches(appearance: AppearanceSettings): boolean {
  return appearance.backgrounds.writing === WRITING_WORKSPACE_PRESET.id
    && appearance.areaEffects.writing.overlay === WRITING_WORKSPACE_PRESET.overlay
    && appearance.areaEffects.writing.blur === WRITING_WORKSPACE_PRESET.blur
    && appearance.advanced.writingLightRaysEnabled;
}

const appearanceTargets = ["login", "appCenter", "steamcmd", "minecraft", "writing", "settings"] as const;

function readPresetGeneral(settings: UserSettings["general"]): AppearancePresetGeneralSettings {
  return {
    defaultFullView: settings.defaultFullView,
    showServiceStatus: settings.showServiceStatus,
    showBottomPanelControl: settings.showBottomPanelControl,
    navigationLayout: settings.navigationLayout,
    hiddenApplicationNavigationIds: [...settings.hiddenApplicationNavigationIds],
    cardMotionEffect: settings.cardMotionEffect,
    dialogMotionEffect: settings.dialogMotionEffect,
    terminalPosition: settings.terminalPosition
  };
}

/** 构造只包含可视字段的独立快照，不包含用户预设列表或其它 General 偏好。 */
export function createAppearancePresetSnapshot(settings: Pick<UserSettings, "appearance" | "general">): AppearancePresetSnapshot {
  const { presets: _presets, ...appearance } = structuredClone(settings.appearance);
  return { appearance, general: readPresetGeneral(settings.general) };
}

/** 将快照应用到现有设置对象；跨分类以外的值、预设库与其它账户偏好保持原值。 */
export function applyAppearancePresetSnapshot(settings: UserSettings, snapshot: AppearancePresetSnapshot): UserSettings {
  return {
    ...settings,
    general: { ...settings.general, ...structuredClone(snapshot.general) },
    appearance: {
      ...settings.appearance,
      ...structuredClone(snapshot.appearance),
      presets: settings.appearance.presets
    }
  };
}

function stableValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableValue).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${stableValue(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function appearancePresetMatchesCurrent(settings: Pick<UserSettings, "appearance" | "general">, snapshot: AppearancePresetSnapshot): boolean {
  return stableValue(createAppearancePresetSnapshot(settings)) === stableValue(snapshot);
}

type BuiltinOverrides = {
  appearance?: Omit<Partial<AppearanceVisualSettings>, "advanced"> & { advanced?: Partial<AppearanceAdvancedSettings> };
  general?: Partial<AppearancePresetGeneralSettings>;
};

function builtin(id: string, name: string, description: string, overrides: BuiltinOverrides = {}): AppearancePreset {
  const defaults = createAppearancePresetSnapshot(DEFAULT_USER_SETTINGS);
  const base = defaults.appearance;
  const next = overrides.appearance;
  const appearance: AppearanceVisualSettings = {
    ...base,
    ...next,
    backgrounds: { ...base.backgrounds, ...next?.backgrounds },
    areaEffects: next?.areaEffects ? structuredClone(next.areaEffects) : structuredClone(base.areaEffects),
    wallpaperEngine: { ...base.wallpaperEngine, ...next?.wallpaperEngine },
    advanced: {
      ...base.advanced,
      ...next?.advanced,
      fonts: { ...base.advanced.fonts, ...next?.advanced?.fonts },
      modeStyles: {
        light: { ...base.advanced.modeStyles.light, ...next?.advanced?.modeStyles?.light, fonts: { ...base.advanced.modeStyles.light.fonts, ...next?.advanced?.modeStyles?.light?.fonts } },
        dark: { ...base.advanced.modeStyles.dark, ...next?.advanced?.modeStyles?.dark, fonts: { ...base.advanced.modeStyles.dark.fonts, ...next?.advanced?.modeStyles?.dark?.fonts } }
      }
    }
  };
  return {
    id,
    name,
    description,
    snapshot: {
      appearance,
      general: { ...defaults.general, ...overrides.general }
    }
  };
}

const noBackgrounds = Object.fromEntries(appearanceTargets.map(target => [target, "none"])) as AppearanceVisualSettings["backgrounds"];
const forestBackgrounds = Object.fromEntries(appearanceTargets.map(target => [target, "forest-bridge-evening"])) as AppearanceVisualSettings["backgrounds"];
const lakesideBackgrounds = Object.fromEntries(appearanceTargets.map(target => [target, "lakeside-pagoda-morning"])) as AppearanceVisualSettings["backgrounds"];
const blossomBackgrounds = Object.fromEntries(appearanceTargets.map(target => [target, "cherry-blossom-shore"])) as AppearanceVisualSettings["backgrounds"];

/** 只读内置模板；应用前不触碰用户设置，标准方案逐字段等于共享默认。 */
export const BUILTIN_APPEARANCE_PRESETS: readonly AppearancePreset[] = [
  builtin("builtin-standard", "常规默认", "恢复系统原有的外观与三列工作台布局。"),
  builtin("builtin-forest", "林间夜色", "深色主题、林间壁纸与森林强调色，适合长时间工作。", {
    appearance: { theme: "dark", accentColor: "#27845b", backgrounds: forestBackgrounds, overlay: 48, blur: 18, advanced: { translucentSidebar: true } }
  }),
  builtin("builtin-lakeside", "湖畔清晨", "浅色清透界面、湖畔背景与青蓝强调色。", {
    appearance: { theme: "light", accentColor: "#1687a7", backgrounds: lakesideBackgrounds, overlay: 30, blur: 20, advanced: { translucentSidebar: true } },
    general: { navigationLayout: "left-two-column", cardMotionEffect: "fade", dialogMotionEffect: "fade" }
  }),
  builtin("builtin-blossom", "樱花柔光", "樱花海岸、柔和粉色强调与轻盈侧栏布局。", {
    appearance: { theme: "light", accentColor: "#d64d8f", backgrounds: blossomBackgrounds, overlay: 28, blur: 18 },
    general: { navigationLayout: "right-tools", cardMotionEffect: "lift", dialogMotionEffect: "fluid" }
  }),
  builtin("builtin-focus", "极简专注", "收起多余布局与动效，以深色纯底聚焦当前工作。", {
    appearance: { theme: "dark", accentColor: "#3457d5", backgrounds: noBackgrounds, advanced: { reducedMotion: "on", translucentSidebar: false } },
    general: { navigationLayout: "focus", showBottomPanelControl: false, showServiceStatus: false, cardMotionEffect: "none", dialogMotionEffect: "fade" }
  })
];
