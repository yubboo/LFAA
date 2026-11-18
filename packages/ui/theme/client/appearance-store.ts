// 在浏览器端管理 LFAA 主题与液态玻璃配置，启动即同步至根元素 CSS 变量并监听系统明暗切换。
import {
  CODE_FONT_STACKS,
  DEFAULT_APPEARANCE_CONFIG,
  FONT_WEIGHT_VALUES,
  THEME_PRESETS,
  UI_FONT_STACKS,
  resolveAccentColor,
  sanitizeAppearanceConfig,
  type AppearanceConfig,
  type AppearanceMode,
  type ThemePresetId,
  type ThemeVariantSettings,
} from "../src/index";

const MODE_STORAGE_KEY = "lfaa:appearance-mode";
const CONFIG_STORAGE_KEY = "lfaa:appearance-config-v1";

export interface AppearanceSnapshot {
  config: AppearanceConfig;
  resolvedScheme: "light" | "dark";
  activeVariant: ThemeVariantSettings;
}

function readSystemDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

const LEGACY_DEFAULT_HEX_MAP: Record<string, string> = {
  "#EEF2EE": THEME_PRESETS.liquidGlass.light.background,
  "#1E221F": THEME_PRESETS.liquidGlass.light.foreground,
  "#121519": THEME_PRESETS.liquidGlass.dark.background,
  "#F2F4F2": THEME_PRESETS.liquidGlass.dark.foreground,
};

function migrateLegacyDefaults(config: AppearanceConfig): AppearanceConfig {
  const migrateVariant = (variant: ThemeVariantSettings): ThemeVariantSettings => ({
    ...variant,
    background: LEGACY_DEFAULT_HEX_MAP[variant.background.toUpperCase()] ?? variant.background,
    foreground: LEGACY_DEFAULT_HEX_MAP[variant.foreground.toUpperCase()] ?? variant.foreground,
  });
  return {
    ...config,
    light: migrateVariant(config.light),
    dark: migrateVariant(config.dark),
  };
}

function readStoredConfig(): AppearanceConfig {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE_CONFIG;
  try {
    const rawConfig = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    if (rawConfig) return migrateLegacyDefaults(sanitizeAppearanceConfig(JSON.parse(rawConfig)));
    const legacyMode = window.localStorage.getItem(MODE_STORAGE_KEY);
    if (legacyMode === "light" || legacyMode === "dark" || legacyMode === "system") {
      return { ...DEFAULT_APPEARANCE_CONFIG, mode: legacyMode };
    }
    return DEFAULT_APPEARANCE_CONFIG;
  } catch {
    return DEFAULT_APPEARANCE_CONFIG;
  }
}

function hexToRgbTuple(hex: string): string {
  const clean = hex.replace("#", "");
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)
    ? `${r} ${g} ${b}`
    : "230 106 168";
}

export class AppearanceStore {
  private readonly listeners = new Set<() => void>();
  private config: AppearanceConfig = readStoredConfig();
  private systemDark = readSystemDark();
  private cachedSnapshot: AppearanceSnapshot | null = null;
  private cleanupMedia: (() => void) | null = null;

  mount(): void {
    if (typeof window === "undefined") return;
    this.syncDocument();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      this.systemDark = media.matches;
      this.syncDocument();
      this.emit();
    };
    media.addEventListener("change", onChange);
    this.cleanupMedia = () => media.removeEventListener("change", onChange);
  }

  dispose(): void {
    this.cleanupMedia?.();
    this.cleanupMedia = null;
    this.listeners.clear();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): AppearanceSnapshot => {
    if (this.cachedSnapshot) return this.cachedSnapshot;
    const resolvedScheme: "light" | "dark" = this.config.mode === "system"
      ? (this.systemDark ? "dark" : "light")
      : this.config.mode;
    this.cachedSnapshot = {
      config: this.config,
      resolvedScheme,
      activeVariant: this.config[resolvedScheme],
    };
    return this.cachedSnapshot;
  };

  private emit(): void {
    this.cachedSnapshot = null;
    for (const listener of this.listeners) listener();
  }

  private syncDocument(): void {
    if (typeof document === "undefined" || typeof window === "undefined") return;
    const { config, resolvedScheme, activeVariant } = this.getSnapshot();
    const root = document.documentElement;
    const preset = THEME_PRESETS[config.preset];
    const accentColor = resolveAccentColor(activeVariant, resolvedScheme);
    const uiFontStack = UI_FONT_STACKS[activeVariant.font];
    const contentFontStack = config.contentFont === "same" ? uiFontStack : UI_FONT_STACKS[config.contentFont];
    const codeFontStack = CODE_FONT_STACKS[config.codeFont];

    root.dataset.theme = config.mode;
    root.dataset.resolvedTheme = resolvedScheme;
    root.dataset.preset = config.preset;
    root.dataset.glass = String(preset.glassEnabled);
    root.dataset.glassSidebar = String(config.translucentSidebar);
    root.dataset.reducedMotion = config.reducedMotion;
    root.dataset.pointerCursor = String(config.pointerCursor);
    root.dataset.diffMarker = config.diffMarker;

    root.style.setProperty("--color-accent", accentColor);
    root.style.setProperty("--color-accent-rgb", hexToRgbTuple(accentColor));
    root.style.setProperty("--user-bg", activeVariant.background);
    root.style.setProperty("--user-bg-rgb", hexToRgbTuple(activeVariant.background));
    root.style.setProperty("--user-fg", activeVariant.foreground);
    root.style.setProperty("--ui-font-family", uiFontStack);
    root.style.setProperty("--content-font-family", contentFontStack);
    root.style.setProperty("--code-font-family", codeFontStack);
    root.style.setProperty("--ui-font-size", `${config.uiFontSize}px`);
    root.style.setProperty("--code-font-size", `${config.codeFontSize}px`);
    root.style.setProperty("--ui-font-weight", FONT_WEIGHT_VALUES[config.uiFontWeight]);
    root.style.setProperty("--glass-contrast", (config.contrast / 100).toFixed(2));

    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, config.mode);
      window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    } catch {
      // 存储受限时保留当前会话主题状态。
    }
  }

  private commit(next: AppearanceConfig): void {
    this.config = next;
    this.cachedSnapshot = null;
    this.syncDocument();
    this.emit();
  }

  setMode = (mode: AppearanceMode): void => {
    this.commit({ ...this.config, mode });
  };

  applyPreset = (presetId: ThemePresetId): void => {
    const preset = THEME_PRESETS[presetId];
    this.commit({
      ...this.config,
      preset: presetId,
      translucentSidebar: preset.glassEnabled ? true : this.config.translucentSidebar,
      light: {
        ...this.config.light,
        background: preset.light.background,
        foreground: preset.light.foreground,
        accent: preset.light.accent,
      },
      dark: {
        ...this.config.dark,
        background: preset.dark.background,
        foreground: preset.dark.foreground,
        accent: preset.dark.accent,
      },
    });
  };

  updateVariant = (patch: Partial<ThemeVariantSettings>): void => {
    const { resolvedScheme } = this.getSnapshot();
    if (this.config.separateLightDark) {
      this.commit({
        ...this.config,
        [resolvedScheme]: { ...this.config[resolvedScheme], ...patch },
      });
      return;
    }
    const syncShared: Partial<ThemeVariantSettings> = {};
    if (patch.accent !== undefined) syncShared.accent = patch.accent;
    if (patch.customAccent !== undefined) syncShared.customAccent = patch.customAccent;
    if (patch.font !== undefined) syncShared.font = patch.font;
    this.commit({
      ...this.config,
      light: { ...this.config.light, ...syncShared, ...(resolvedScheme === "light" ? patch : {}) },
      dark: { ...this.config.dark, ...syncShared, ...(resolvedScheme === "dark" ? patch : {}) },
    });
  };

  updateConfig = (patch: Partial<AppearanceConfig>): void => {
    this.commit(sanitizeAppearanceConfig({ ...this.config, ...patch }));
  };

  exportThemeJson = (): string => JSON.stringify(this.config, null, 2);

  importThemeJson = (rawText: string): boolean => {
    try {
      this.commit(sanitizeAppearanceConfig(JSON.parse(rawText)));
      return true;
    } catch {
      return false;
    }
  };
}
