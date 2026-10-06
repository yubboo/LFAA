/** 功能：提供刷新前的轻量主题提示。作用：首帧沿用当前标签页的主题模式，账户设置 API 加载后仍由服务端值覆盖。 */

export type AppearanceThemePreference = "light" | "dark" | "system";
export type ResolvedAppearanceTheme = "light" | "dark";

// 此键同时由 apps/web/index.html 的同步首帧脚本读取；只保存主题模式枚举。
export const APPEARANCE_THEME_BOOTSTRAP_STORAGE_KEY = "lfaa.appearance-theme-bootstrap.v1";

interface ThemeStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

interface ThemeDocumentRoot {
  dataset: { lfaaBootstrapTheme?: string };
  style: { colorScheme: string };
  removeAttribute: (name: string) => void;
}

interface ThemeColorMeta {
  content: string;
}

interface ThemeBootstrapTargets {
  storage?: ThemeStorage | null;
  root?: ThemeDocumentRoot | null;
  themeColorMeta?: ThemeColorMeta | null;
}

function getSessionStorage(): ThemeStorage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function getDocumentRoot(): ThemeDocumentRoot | null {
  return typeof document === "undefined" ? null : document.documentElement;
}

function getThemeColorMeta(): ThemeColorMeta | null {
  return typeof document === "undefined"
    ? null
    : document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
}

export function readAppearanceThemeBootstrap(storage: ThemeStorage | null = getSessionStorage()): AppearanceThemePreference | null {
  try {
    const value = storage?.getItem(APPEARANCE_THEME_BOOTSTRAP_STORAGE_KEY);
    return value === "light" || value === "dark" || value === "system" ? value : null;
  } catch {
    return null;
  }
}

export function resolveAppearanceThemeBootstrap(
  preference: AppearanceThemePreference,
  systemDark: boolean
): ResolvedAppearanceTheme {
  return preference === "system" ? systemDark ? "dark" : "light" : preference;
}

export function applyAppearanceThemeBootstrap(
  preference: AppearanceThemePreference,
  resolvedTheme: ResolvedAppearanceTheme,
  targets: ThemeBootstrapTargets = {}
): void {
  const storage = targets.storage === undefined ? getSessionStorage() : targets.storage;
  const root = targets.root === undefined ? getDocumentRoot() : targets.root;
  const themeColorMeta = targets.themeColorMeta === undefined ? getThemeColorMeta() : targets.themeColorMeta;

  try {
    storage?.setItem(APPEARANCE_THEME_BOOTSTRAP_STORAGE_KEY, preference);
  } catch {
    // 标签页存储不可用时仍应用服务端主题，不阻断工作台。
  }

  if (root) {
    root.dataset.lfaaBootstrapTheme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
  }
  if (themeColorMeta) themeColorMeta.content = resolvedTheme === "dark" ? "#181818" : "#f3f5f8";
}

export function clearAppearanceThemeBootstrap(targets: ThemeBootstrapTargets = {}): void {
  const storage = targets.storage === undefined ? getSessionStorage() : targets.storage;
  const root = targets.root === undefined ? getDocumentRoot() : targets.root;
  const themeColorMeta = targets.themeColorMeta === undefined ? getThemeColorMeta() : targets.themeColorMeta;

  try {
    storage?.removeItem(APPEARANCE_THEME_BOOTSTRAP_STORAGE_KEY);
  } catch {
    // 存储不可用时仍清除当前文档的主题提示。
  }

  if (root) {
    root.removeAttribute("data-lfaa-bootstrap-theme");
    root.style.colorScheme = "";
  }
  if (themeColorMeta) themeColorMeta.content = "#f3f5f8";
}
