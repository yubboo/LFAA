/**
 * 功能：提供固定 DSH Client 插件需要的 LFAA 主题兼容面。
 * 作用：主题偏好写入 LFAA Appearance Owner，DSH 颜色/字体令牌限定在 Workbench 根节点。
 * 关联文件：packages/client/ui-workspace/src/client/index.ts、packages/client/ui-layout/src/Workbench.tsx。
 */
export type AppearanceThemePreference = "system" | "light" | "dark";
type ThemeTokenValues = { light: string; dark: string };

const TEXT_COLOR_TOKENS: Readonly<Record<string, string>> = Object.freeze({
  "--dsw-alias-label-primary": "--dsw-alias-label-primary",
  "--dsw-alias-label-secondary": "--dsw-alias-label-secondary",
  "--dsw-alias-label-tertiary": "--dsw-alias-label-tertiary",
  "--dsw-alias-label-caption": "--dsw-alias-label-caption",
  "--dsw-alias-label-dimmed": "--dsw-alias-label-dimmed",
  "--dsw-alias-label-primary-dimmed": "--dsw-alias-label-primary-dimmed",
});

const FONT_ROLE_IDS = [
  "markdown-h1", "markdown-h2", "markdown-h3", "markdown-h4", "markdown-base", "markdown-small",
  "markdown-code", "markdown-code-block", "markdown-table", "markdown-table-head", "xs-13", "xxs-12",
] as const;
const FONT_TOKEN_SUFFIXES = ["font-size", "font-weight", "font-family", ""] as const;
const FONT_THEME_TOKENS = new Set(FONT_ROLE_IDS.flatMap((role) => FONT_TOKEN_SUFFIXES.map((suffix) =>
  `--dsw-font-${role}${suffix ? `-${suffix}` : ""}`)));
const MANAGED_THEME_PROPERTIES = new Set([...Object.values(TEXT_COLOR_TOKENS), ...FONT_THEME_TOKENS]);

type ThemeOwner = {
  readPreference(): AppearanceThemePreference;
  savePreference(preference: "light" | "dark"): Promise<void>;
  getRoot(): HTMLElement | null;
};

let owner: ThemeOwner | undefined;
let emitThemeChange: ((preference: AppearanceThemePreference) => void) | undefined;
const tokenLayers = new Map<string, Readonly<Record<string, ThemeTokenValues>>>();

function effectivePreference(): AppearanceThemePreference {
  return owner?.readPreference() ?? "system";
}

function resolvedMode(preference: AppearanceThemePreference): "light" | "dark" {
  if (preference !== "system") return preference;
  return owner?.getRoot()?.dataset.theme === "dark" ? "dark" : "light";
}

function applyTokenLayers(): void {
  const root = owner?.getRoot();
  if (!root) return;
  for (const cssName of MANAGED_THEME_PROPERTIES) root.style.removeProperty(cssName);
  const mode = resolvedMode(effectivePreference());
  for (const layer of tokenLayers.values()) {
    for (const [token, color] of Object.entries(layer)) {
      const cssName = TEXT_COLOR_TOKENS[token] ?? (FONT_THEME_TOKENS.has(token) ? token : undefined);
      if (cssName) root.style.setProperty(cssName, color[mode]);
    }
  }
}

function validFontTokenValue(token: string, value: string): boolean {
  if (token.endsWith("-font-size")) {
    const match = /^(\d{1,2})px$/u.exec(value);
    const px = match ? Number(match[1]) : 0;
    return px >= 8 && px <= 48;
  }
  if (token.endsWith("-font-weight")) return /^(?:100|200|300|400|500|600|700|800|900)$/u.test(value);
  if (token.endsWith("-font-family")) return value.length <= 160 && /^[\p{L}\p{N}_\s'",.-]+$/u.test(value) && /[\p{L}\p{N}]/u.test(value);
  if (!token.startsWith("--dsw-font-")) return false;
  const role = token.slice("--dsw-font-".length);
  if (!FONT_ROLE_IDS.some((id) => role === id)) return false;
  const escapedRole = role.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const shorthand = new RegExp(`^(?:(?:[1-9]00|var\\(--dsw-font-${escapedRole}-font-weight\\))\\s+)?(?:\\d{1,2}px|var\\(--dsw-font-${escapedRole}-font-size\\))\\s*\\/\\s*var\\(--dsw-font-${escapedRole}-line-height\\)\\s+var\\(--dsw-font-${escapedRole}-font-family\\)$`, "u");
  return shorthand.test(value);
}

function publishThemeChange(preference = effectivePreference()): void {
  applyTokenLayers();
  emitThemeChange?.(preference);
}

export const dshThemeCompatibility = {
  getTheme(): { preference: AppearanceThemePreference } {
    return { preference: effectivePreference() };
  },

  setTheme(preference: "light" | "dark"): void {
    if (preference !== "light" && preference !== "dark") return;
    const previous = effectivePreference();
    if (previous === preference) return;
    const save = owner?.savePreference(preference);
    publishThemeChange(preference);
    void save?.catch(() => publishThemeChange(previous));
  },

  overrideTokens(source: string, tokens: Record<string, ThemeTokenValues>): () => void {
    const accepted: Record<string, ThemeTokenValues> = {};
    for (const [token, value] of Object.entries(tokens)) {
      if (!value || typeof value !== "object" || typeof value.light !== "string" || typeof value.dark !== "string") continue;
      if (TEXT_COLOR_TOKENS[token]) {
        if (!/^#[\da-f]{6}$/iu.test(value.light) || !/^#[\da-f]{6}$/iu.test(value.dark)) continue;
      } else if (FONT_THEME_TOKENS.has(token)) {
        if (!validFontTokenValue(token, value.light) || !validFontTokenValue(token, value.dark)) continue;
      } else continue;
      accepted[token] = { light: value.light, dark: value.dark };
    }
    if (!source) return () => undefined;
    const layer = Object.freeze(accepted);
    tokenLayers.set(source, layer);
    applyTokenLayers();
    return () => {
      if (tokenLayers.get(source) !== layer) return;
      tokenLayers.delete(source);
      applyTokenLayers();
    };
  },

  clearWallpaperEngineOverride(): void {
    for (const source of ["wallpaper-engine", "wallpaper-engine-typography"]) tokenLayers.delete(source);
    applyTokenLayers();
  },

  refresh(): void { applyTokenLayers(); },
};

export function bindDshThemeOwner(nextOwner: ThemeOwner): () => void {
  owner = nextOwner;
  applyTokenLayers();
  return () => {
    if (owner !== nextOwner) return;
    for (const cssName of MANAGED_THEME_PROPERTIES) owner.getRoot()?.style.removeProperty(cssName);
    tokenLayers.clear();
    owner = undefined;
  };
}

export function bindDshThemeEvents(context: {
  emit(event: "theme/change", snapshot: { preference: AppearanceThemePreference }): unknown;
}): () => void {
  const emit = (preference: AppearanceThemePreference) => context.emit("theme/change", { preference });
  emitThemeChange = emit;
  return () => { if (emitThemeChange === emit) emitThemeChange = undefined; };
}

export function syncDshThemePreference(): void {
  publishThemeChange();
}

