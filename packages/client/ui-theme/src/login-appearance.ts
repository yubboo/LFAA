/**
 * 功能：为未认证登录页提供最近一次服务端确认的安全外观快照。
 * 作用：只缓存登录页可用的内置背景和非敏感视觉设置，不缓存凭据、账户私有图片或插件配置。
 * 关联文件：packages/client/ui-settings-account/src/AuthView.tsx、packages/client/ui-settings/src/SettingsPage.tsx、packages/client/ui-layout/src/Workbench.tsx。
 */
import { DEFAULT_USER_SETTINGS, type AppearanceSettings } from "lfaa-util-values/src/settings-contract.js";
import { minecraftSceneBackgrounds } from "lfaa-util-values/src/builtin-backgrounds.js";
import { resolveLoginAreaOverlay } from "./appearance-area-effects.js";

const loginAppearanceStorageKey = "lfaa:login-appearance.v1";
const legacyLoginBackgroundStorageKey = "lfaa:login-background";
const loginUsernamePattern = /^[\p{L}\p{N}_.-]{3,32}$/u;
export const defaultLoginBackgroundId = DEFAULT_USER_SETTINGS.appearance.backgrounds.login;

const loginBackgroundFiles: Record<string, string> = {
  "service-room": "/backgrounds/service-room.jpg",
  "steamcmd-world": "/backgrounds/steamcmd-world.jpg",
  "minecraft-world": "/backgrounds/minecraft-world.jpg",
  "writing-desk": "/backgrounds/writing-desk.jpg",
  "writing-yunjian": "/backgrounds/writing-yunjian.png",
  ...Object.fromEntries(minecraftSceneBackgrounds.map(({ id, file }) => [id, file]))
};

type AppearanceFonts = AppearanceSettings["advanced"]["fonts"];
type AppearanceModeStyle = AppearanceSettings["advanced"]["modeStyles"]["light"];

export interface LoginAppearanceSnapshot {
  theme: AppearanceSettings["theme"];
  accentColor: string;
  loginBackgroundId: string;
  overlay: number;
  loginOverlayOverride: number | null;
  advanced: {
    interfaceFontSize: number;
    reducedMotion: AppearanceSettings["advanced"]["reducedMotion"];
    separateModes: boolean;
    fonts: AppearanceFonts;
    modeStyles: AppearanceSettings["advanced"]["modeStyles"];
    contrast: number;
  };
}

export interface ResolvedLoginAppearance {
  theme: "light" | "dark";
  accentColor: string;
  loginBackgroundId: string;
  overlay: number;
  loginOverlayOverride: number | null;
  interfaceFontSize: number;
  reducedMotion: AppearanceSettings["advanced"]["reducedMotion"];
  fonts: AppearanceFonts;
  contrast: number;
}

const defaultAppearance = DEFAULT_USER_SETTINGS.appearance;
const defaultSnapshot: LoginAppearanceSnapshot = {
  theme: defaultAppearance.theme,
  accentColor: defaultAppearance.accentColor,
  loginBackgroundId: defaultAppearance.backgrounds.login,
  overlay: defaultAppearance.overlay,
  loginOverlayOverride: null,
  advanced: {
    interfaceFontSize: defaultAppearance.advanced.interfaceFontSize,
    reducedMotion: defaultAppearance.advanced.reducedMotion,
    separateModes: defaultAppearance.advanced.separateModes,
    fonts: { ...defaultAppearance.advanced.fonts },
    modeStyles: {
      light: { ...defaultAppearance.advanced.modeStyles.light, fonts: { ...defaultAppearance.advanced.modeStyles.light.fonts } },
      dark: { ...defaultAppearance.advanced.modeStyles.dark, fonts: { ...defaultAppearance.advanced.modeStyles.dark.fonts } }
    },
    contrast: defaultAppearance.advanced.contrast
  }
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[\da-f]{6}$/iu.test(value);
}

function isLoginBackgroundId(value: unknown): value is string {
  return value === "none" || (typeof value === "string" && Object.hasOwn(loginBackgroundFiles, value));
}

function isTextFont(value: unknown): value is AppearanceFonts["interface"] {
  return value === "system" || value === "sans" || value === "serif";
}

function isCodeFont(value: unknown): value is AppearanceFonts["code"] {
  return value === "system" || value === "cascadia" || value === "consolas" || value === "jetbrains";
}

function readFonts(value: unknown, fallback: AppearanceFonts): AppearanceFonts {
  if (!isRecord(value)) return { ...fallback };
  return {
    interface: isTextFont(value.interface) ? value.interface : fallback.interface,
    content: isTextFont(value.content) ? value.content : fallback.content,
    code: isCodeFont(value.code) ? value.code : fallback.code
  };
}

function readModeStyle(value: unknown, fallback: AppearanceModeStyle): AppearanceModeStyle {
  if (!isRecord(value)) return { ...fallback, fonts: { ...fallback.fonts } };
  return {
    accentColor: isHexColor(value.accentColor) ? value.accentColor : fallback.accentColor,
    fonts: readFonts(value.fonts, fallback.fonts)
  };
}

function readSnapshot(value: unknown, legacyBackgroundId?: string | null): LoginAppearanceSnapshot {
  if (!isRecord(value)) {
    return {
      ...defaultSnapshot,
      loginBackgroundId: isLoginBackgroundId(legacyBackgroundId) ? legacyBackgroundId : defaultSnapshot.loginBackgroundId
    };
  }

  const advanced = isRecord(value.advanced) ? value.advanced : {};
  const backgrounds = isRecord(value.backgrounds) ? value.backgrounds : {};
  const areaEffects = isRecord(value.areaEffects) ? value.areaEffects : {};
  const loginAreaEffects = isRecord(areaEffects.login) ? areaEffects.login : {};
  const modeStyles = isRecord(advanced.modeStyles) ? advanced.modeStyles : {};
  return {
    theme: value.theme === "light" || value.theme === "dark" || value.theme === "system" ? value.theme : defaultSnapshot.theme,
    accentColor: isHexColor(value.accentColor) ? value.accentColor : defaultSnapshot.accentColor,
    loginBackgroundId: isLoginBackgroundId(backgrounds.login)
      ? backgrounds.login
      : isLoginBackgroundId(legacyBackgroundId) ? legacyBackgroundId : defaultSnapshot.loginBackgroundId,
    overlay: typeof value.overlay === "number" && Number.isInteger(value.overlay) && value.overlay >= 0 && value.overlay <= 75
      ? value.overlay
      : defaultSnapshot.overlay,
    // 新缓存保存独立覆盖；旧缓存从全局遮罩回退，且不读取其他账户或账户私有视觉数据。
    loginOverlayOverride: value.loginOverlayOverride === null || typeof value.loginOverlayOverride === "number" && Number.isInteger(value.loginOverlayOverride) && value.loginOverlayOverride >= 0 && value.loginOverlayOverride <= 75
      ? value.loginOverlayOverride
      : loginAreaEffects.overlay === null || typeof loginAreaEffects.overlay === "number" && Number.isInteger(loginAreaEffects.overlay) && loginAreaEffects.overlay >= 0 && loginAreaEffects.overlay <= 75
        ? loginAreaEffects.overlay
        : defaultSnapshot.loginOverlayOverride,
    advanced: {
      interfaceFontSize: typeof advanced.interfaceFontSize === "number" && Number.isInteger(advanced.interfaceFontSize) && advanced.interfaceFontSize >= 10 && advanced.interfaceFontSize <= 24
        ? advanced.interfaceFontSize
        : defaultSnapshot.advanced.interfaceFontSize,
      reducedMotion: advanced.reducedMotion === "on" || advanced.reducedMotion === "off" || advanced.reducedMotion === "system"
        ? advanced.reducedMotion
        : defaultSnapshot.advanced.reducedMotion,
      separateModes: typeof advanced.separateModes === "boolean" ? advanced.separateModes : defaultSnapshot.advanced.separateModes,
      fonts: readFonts(advanced.fonts, defaultSnapshot.advanced.fonts),
      modeStyles: {
        light: readModeStyle(modeStyles.light, defaultSnapshot.advanced.modeStyles.light),
        dark: readModeStyle(modeStyles.dark, defaultSnapshot.advanced.modeStyles.dark)
      },
      contrast: typeof advanced.contrast === "number" && Number.isInteger(advanced.contrast) && advanced.contrast >= 0 && advanced.contrast <= 100
        ? advanced.contrast
        : defaultSnapshot.advanced.contrast
    }
  };
}

export function getCachedLoginAppearance(username?: string): LoginAppearanceSnapshot {
  try {
    if (typeof window === "undefined") return readSnapshot(null);
    const legacyBackgroundId = window.localStorage.getItem(legacyLoginBackgroundStorageKey);
    const serialized = window.localStorage.getItem(loginAppearanceStorageKey);
    if (!serialized) return readSnapshot(null, legacyBackgroundId);
    try {
      const envelope: unknown = JSON.parse(serialized);
      if (!isRecord(envelope) || typeof envelope.username !== "string" || !isRecord(envelope.appearance)) {
        return readSnapshot(null, legacyBackgroundId);
      }
      return username && envelope.username === username ? readSnapshot(envelope.appearance, legacyBackgroundId) : readSnapshot(null, legacyBackgroundId);
    } catch {
      return readSnapshot(null, legacyBackgroundId);
    }
  } catch {
    return readSnapshot(null);
  }
}

export function cacheLoginAppearance(username: string, appearance: AppearanceSettings): void {
  if (typeof window === "undefined" || !loginUsernamePattern.test(username)) return;
  const snapshot = readSnapshot(appearance);
  try {
    window.localStorage.setItem(loginAppearanceStorageKey, JSON.stringify({ username, appearance: snapshot }));
    // 旧版登录页只读取背景 ID；短期保留同步写入，避免版本回退后背景选择丢失。
    window.localStorage.setItem(legacyLoginBackgroundStorageKey, snapshot.loginBackgroundId);
  } catch {
    // 浏览器存储不可用时仍以服务端账户设置为准；认证和设置保存不受影响。
  }
}

export function resolveLoginBackgroundImage(backgroundId: string): string | null {
  if (backgroundId === "none") return null;
  return loginBackgroundFiles[backgroundId] ?? loginBackgroundFiles[defaultLoginBackgroundId] ?? null;
}

/**
 * 登录页壁纸沿用账户遮罩设置，但将其强度限制为全局值的 40%，避免整屏白雾或深灰遮暗。
 * 外观设置仍是唯一强度来源，0% 保持无遮罩，设置越高遮罩越明显。
 */
export function resolveLoginBackgroundOverlayColor(overlay: number, theme: "light" | "dark", override?: number | null): string {
  const opacity = Number((resolveLoginAreaOverlay(overlay, override) / 100).toFixed(3));
  const color = theme === "dark" ? "24, 24, 24" : "255, 255, 255";
  return `rgba(${color}, ${opacity})`;
}

export function resolveLoginAppearance(snapshot: LoginAppearanceSnapshot, systemDark: boolean): ResolvedLoginAppearance {
  const theme = snapshot.theme === "system" ? systemDark ? "dark" : "light" : snapshot.theme;
  const modeStyle = snapshot.advanced.modeStyles[theme];
  return {
    theme,
    accentColor: snapshot.advanced.separateModes ? modeStyle.accentColor : snapshot.accentColor,
    loginBackgroundId: snapshot.loginBackgroundId,
    overlay: snapshot.overlay,
    loginOverlayOverride: snapshot.loginOverlayOverride,
    interfaceFontSize: snapshot.advanced.interfaceFontSize,
    reducedMotion: snapshot.advanced.reducedMotion,
    fonts: snapshot.advanced.separateModes ? modeStyle.fonts : snapshot.advanced.fonts,
    contrast: snapshot.advanced.contrast
  };
}
