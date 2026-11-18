// 定义外观与液态玻璃主题系统的数据模型、预设配置及安全序列化工具。
export type AppearanceMode = "light" | "dark" | "system";
/** 用稳定标识保存主题预设的选中状态。 */
export type ThemePresetId = "liquidGlass" | "classic" | "softMist" | "midnightInk";
export type AccentPresetId = "default" | "blue" | "green" | "yellow" | "pink" | "orange" | "purple" | "white" | "custom";
export type UiFontId = "system" | "sans" | "serif" | "mono";
export type ContentFontId = "same" | "system" | "serif";
export type CodeFontId = "system" | "jetbrains" | "cascadia" | "consolas";
export type FontWeightId = "normal" | "medium" | "semibold";
export type ReducedMotionMode = "system" | "on" | "off";
export type DiffMarkerMode = "color" | "markers";

/** 描述一种明暗主题下可单独配置的颜色与呈现设置。 */
export interface ThemeVariantSettings {
  accent: AccentPresetId;
  customAccent: string;
  background: string;
  foreground: string;
  font: UiFontId;
}

/** 描述外观偏好完整结构，包含主题模式、预设和字体等选项。 */
export interface AppearanceConfig {
  mode: AppearanceMode;
  preset: ThemePresetId;
  separateLightDark: boolean;
  light: ThemeVariantSettings;
  dark: ThemeVariantSettings;
  uiFontSize: number;
  codeFontSize: number;
  reducedMotion: ReducedMotionMode;
  uiFontWeight: FontWeightId;
  contentFont: ContentFontId;
  codeFont: CodeFontId;
  translucentSidebar: boolean;
  contrast: number;
  diffMarker: DiffMarkerMode;
  pointerCursor: boolean;
}

/** 定义主题选择器可展示并应用的预设内容。 */
export interface ThemePresetDefinition {
  id: ThemePresetId;
  labelZh: string;
  labelEn: string;
  glassEnabled: boolean;
  light: { background: string; foreground: string; accent: AccentPresetId };
  dark: { background: string; foreground: string; accent: AccentPresetId };
}

/** 提供外观页与主题初始化共用的主题预设。 */
export const THEME_PRESETS: Record<ThemePresetId, ThemePresetDefinition> = {
  liquidGlass: {
    id: "liquidGlass",
    labelZh: "LFAA 液态玻璃",
    labelEn: "LFAA Liquid Glass",
    glassEnabled: true,
    light: { background: "#FFFFFF", foreground: "#171717", accent: "pink" },
    dark: { background: "#181818", foreground: "#F3F3F3", accent: "pink" },
  },
  classic: {
    id: "classic",
    labelZh: "经典极简",
    labelEn: "Classic Minimal",
    glassEnabled: false,
    light: { background: "#FFFFFF", foreground: "#171717", accent: "pink" },
    dark: { background: "#181818", foreground: "#F3F3F3", accent: "pink" },
  },
  softMist: {
    id: "softMist",
    labelZh: "柔雾青灰",
    labelEn: "Soft Mist",
    glassEnabled: true,
    light: { background: "#EBF0F2", foreground: "#1D2428", accent: "blue" },
    dark: { background: "#14191D", foreground: "#EEF2F5", accent: "blue" },
  },
  midnightInk: {
    id: "midnightInk",
    labelZh: "静谧夜蓝",
    labelEn: "Midnight Glass",
    glassEnabled: true,
    light: { background: "#EEF0F6", foreground: "#1C1F2B", accent: "purple" },
    dark: { background: "#11141C", foreground: "#EFF1F7", accent: "purple" },
  },
};

/** 集中定义强调色的候选值和展示顺序。 */
export const ACCENT_PRESETS: Array<{
  id: AccentPresetId;
  color: string;
  labelZh: string;
  labelEn: string;
}> = [
  { id: "default", color: "#E5E7EB", labelZh: "默认", labelEn: "Default" },
  { id: "blue", color: "#3B82F6", labelZh: "蓝色", labelEn: "Blue" },
  { id: "green", color: "#10B981", labelZh: "绿色", labelEn: "Green" },
  { id: "yellow", color: "#EAB308", labelZh: "黄色", labelEn: "Yellow" },
  { id: "pink", color: "#E66AA8", labelZh: "粉色", labelEn: "Pink" },
  { id: "orange", color: "#F97316", labelZh: "橙色", labelEn: "Orange" },
  { id: "purple", color: "#8B5CF6", labelZh: "紫色", labelEn: "Purple" },
  { id: "white", color: "#F5F5F4", labelZh: "白色", labelEn: "White" },
  { id: "custom", color: "#E66AA8", labelZh: "自定义", labelEn: "Custom" },
];

/** 按已选 UI 字体映射到浏览器可用的字体回退栈。 */
export const UI_FONT_STACKS: Record<UiFontId, string> = {
  system: "\"Segoe UI\", \"Microsoft YaHei UI\", system-ui, -apple-system, sans-serif",
  sans: "\"Inter\", \"Segoe UI\", \"PingFang SC\", \"Microsoft YaHei UI\", sans-serif",
  serif: "\"Georgia\", \"Noto Serif SC\", \"Songti SC\", serif",
  mono: "\"JetBrains Mono\", \"Cascadia Code\", \"Consolas\", monospace",
};

/** 按已选代码字体映射到支持的等宽字体回退栈。 */
export const CODE_FONT_STACKS: Record<CodeFontId, string> = {
  system: "ui-monospace, \"Cascadia Code\", \"Consolas\", monospace",
  jetbrains: "\"JetBrains Mono\", ui-monospace, \"Consolas\", monospace",
  cascadia: "\"Cascadia Code\", ui-monospace, \"Consolas\", monospace",
  consolas: "\"Consolas\", \"Courier New\", monospace",
};

export const FONT_WEIGHT_VALUES: Record<FontWeightId, string> = {
  normal: "400",
  medium: "500",
  semibold: "580",
};

/** 提供首次打开工作台以及缺少历史设置字段时的外观默认值。 */
export const DEFAULT_APPEARANCE_CONFIG: AppearanceConfig = {
  mode: "system",
  preset: "liquidGlass",
  separateLightDark: false,
  light: {
    accent: "pink",
    customAccent: "#E66AA8",
    background: THEME_PRESETS.liquidGlass.light.background,
    foreground: THEME_PRESETS.liquidGlass.light.foreground,
    font: "system",
  },
  dark: {
    accent: "pink",
    customAccent: "#E66AA8",
    background: THEME_PRESETS.liquidGlass.dark.background,
    foreground: THEME_PRESETS.liquidGlass.dark.foreground,
    font: "system",
  },
  uiFontSize: 14,
  codeFontSize: 12,
  reducedMotion: "system",
  uiFontWeight: "normal",
  contentFont: "same",
  codeFont: "system",
  translucentSidebar: true,
  contrast: 60,
  diffMarker: "color",
  pointerCursor: true,
};

/** 整理外部或导入的颜色值，丢弃不符合主题契约的输入。 */
export function normalizeHexColor(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/u.test(trimmed)) return trimmed.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/u.test(trimmed)) {
    const [, r, g, b] = trimmed.split("");
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return fallback;
}

/** 从强调色配置解析实际应用于界面的颜色。 */
export function resolveAccentColor(variant: ThemeVariantSettings, resolvedScheme: "light" | "dark"): string {
  if (variant.accent === "custom") {
    return normalizeHexColor(variant.customAccent, "#E66AA8");
  }
  if (variant.accent === "default") {
    return resolvedScheme === "dark" ? "#E5E7EB" : "#292B26";
  }
  const match = ACCENT_PRESETS.find((item) => item.id === variant.accent);
  return match ? match.color : "#E66AA8";
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback;
}

function sanitizeVariant(raw: unknown, fallback: ThemeVariantSettings): ThemeVariantSettings {
  if (!raw || typeof raw !== "object") return fallback;
  const record = raw as Record<string, unknown>;
  const accent = ACCENT_PRESETS.some((item) => item.id === record.accent)
    ? (record.accent as AccentPresetId)
    : fallback.accent;
  const font: UiFontId = record.font === "system" || record.font === "sans" || record.font === "serif" || record.font === "mono"
    ? record.font
    : fallback.font;
  return {
    accent,
    customAccent: typeof record.customAccent === "string" ? normalizeHexColor(record.customAccent, fallback.customAccent) : fallback.customAccent,
    background: typeof record.background === "string" ? normalizeHexColor(record.background, fallback.background) : fallback.background,
    foreground: typeof record.foreground === "string" ? normalizeHexColor(record.foreground, fallback.foreground) : fallback.foreground,
    font,
  };
}

// 校验并合并外部导入或本地持久化的配置，防止异常字段破坏界面主题。
export function sanitizeAppearanceConfig(raw: unknown): AppearanceConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_APPEARANCE_CONFIG;
  const record = raw as Record<string, unknown>;
  const mode: AppearanceMode = record.mode === "light" || record.mode === "dark" || record.mode === "system"
    ? record.mode
    : DEFAULT_APPEARANCE_CONFIG.mode;
  const preset: ThemePresetId = typeof record.preset === "string" && record.preset in THEME_PRESETS
    ? (record.preset as ThemePresetId)
    : DEFAULT_APPEARANCE_CONFIG.preset;
  const reducedMotion: ReducedMotionMode = record.reducedMotion === "system" || record.reducedMotion === "on" || record.reducedMotion === "off"
    ? record.reducedMotion
    : DEFAULT_APPEARANCE_CONFIG.reducedMotion;
  const uiFontWeight: FontWeightId = record.uiFontWeight === "normal" || record.uiFontWeight === "medium" || record.uiFontWeight === "semibold"
    ? record.uiFontWeight
    : DEFAULT_APPEARANCE_CONFIG.uiFontWeight;
  const contentFont: ContentFontId = record.contentFont === "same" || record.contentFont === "system" || record.contentFont === "serif"
    ? record.contentFont
    : DEFAULT_APPEARANCE_CONFIG.contentFont;
  const codeFont: CodeFontId = typeof record.codeFont === "string" && record.codeFont in CODE_FONT_STACKS
    ? (record.codeFont as CodeFontId)
    : DEFAULT_APPEARANCE_CONFIG.codeFont;
  const diffMarker: DiffMarkerMode = record.diffMarker === "color" || record.diffMarker === "markers"
    ? record.diffMarker
    : DEFAULT_APPEARANCE_CONFIG.diffMarker;

  return {
    mode,
    preset,
    separateLightDark: typeof record.separateLightDark === "boolean" ? record.separateLightDark : DEFAULT_APPEARANCE_CONFIG.separateLightDark,
    light: sanitizeVariant(record.light, DEFAULT_APPEARANCE_CONFIG.light),
    dark: sanitizeVariant(record.dark, DEFAULT_APPEARANCE_CONFIG.dark),
    uiFontSize: clampNumber(record.uiFontSize, 12, 20, DEFAULT_APPEARANCE_CONFIG.uiFontSize),
    codeFontSize: clampNumber(record.codeFontSize, 10, 18, DEFAULT_APPEARANCE_CONFIG.codeFontSize),
    reducedMotion,
    uiFontWeight,
    contentFont,
    codeFont,
    translucentSidebar: typeof record.translucentSidebar === "boolean" ? record.translucentSidebar : DEFAULT_APPEARANCE_CONFIG.translucentSidebar,
    contrast: clampNumber(record.contrast, 0, 100, DEFAULT_APPEARANCE_CONFIG.contrast),
    diffMarker,
    pointerCursor: typeof record.pointerCursor === "boolean" ? record.pointerCursor : DEFAULT_APPEARANCE_CONFIG.pointerCursor,
  };
}
