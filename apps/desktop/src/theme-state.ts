// 桌面端主题持久化与原生标题栏同步：读写 ~/.lfaa/desktop-appearance.json，解决随机端口下 localStorage 丢失与 Windows 标题栏不跟随浅/深色问题。
// 关联：apps/desktop/src/main.ts、packages/ui/theme/client/appearance-store.ts；运行环境：Electron 主进程。
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { nativeTheme, type BrowserWindow } from "electron";
import { logDesktop } from "./log";

export type DesktopThemeMode = "light" | "dark" | "system";
export type DesktopResolvedScheme = "light" | "dark";

export interface DesktopThemeState {
  mode: DesktopThemeMode;
  resolvedScheme: DesktopResolvedScheme;
  configJson?: string;
}

const THEME_STATE_FILE = join(homedir(), ".lfaa", "desktop-appearance.json");
const LIGHT_WINDOW_BG = "#f7f7f7";
const DARK_WINDOW_BG = "#171717";
const LIGHT_OVERLAY_SYMBOL = "#1f2937";
const DARK_OVERLAY_SYMBOL = "#e5e7eb";

/** 单行一体化顶栏高度（px），与渲染进程 DesktopTitleBar 保持一致。 */
export const DESKTOP_TITLEBAR_HEIGHT = 34;

function isValidMode(value: unknown): value is DesktopThemeMode {
  return value === "light" || value === "dark" || value === "system";
}

function isValidScheme(value: unknown): value is DesktopResolvedScheme {
  return value === "light" || value === "dark";
}

/** 读取上次保存的桌面端主题状态；文件缺失或损坏时回退跟随系统。 */
export function loadDesktopThemeState(filePath = THEME_STATE_FILE): DesktopThemeState {
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf8")) as Partial<DesktopThemeState>;
    const mode: DesktopThemeMode = isValidMode(raw.mode) ? raw.mode : "system";
    const resolvedScheme: DesktopResolvedScheme = isValidScheme(raw.resolvedScheme)
      ? raw.resolvedScheme
      : (mode === "light" ? "light" : "dark");
    return {
      mode,
      resolvedScheme,
      ...(typeof raw.configJson === "string" && raw.configJson.trim() ? { configJson: raw.configJson } : {}),
    };
  } catch {
    return {
      mode: "system",
      resolvedScheme: nativeTheme.shouldUseDarkColors ? "dark" : "light",
    };
  }
}

/** 持久化主题配置到本地文件，避免桌面端每次重启换端口导致 localStorage 丢失。 */
export function saveDesktopThemeState(state: DesktopThemeState, filePath = THEME_STATE_FILE): void {
  try {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  } catch (error) {
    logDesktop("保存桌面端主题配置失败", error);
  }
}

/** 根据解析后的明暗返回窗口底色，消除加载首帧白屏/黑屏闪烁。 */
export function resolveWindowBackgroundColor(scheme: DesktopResolvedScheme): string {
  return scheme === "light" ? LIGHT_WINDOW_BG : DARK_WINDOW_BG;
}

/** 返回 Windows 透明叠加窗口控制区（最小化/最大化/关闭）配色参数，与当前明暗同步。 */
export function resolveTitleBarOverlayOptions(scheme: DesktopResolvedScheme): {
  color: string;
  symbolColor: string;
  height: number;
} {
  return {
    color: "#00000000",
    symbolColor: scheme === "light" ? LIGHT_OVERLAY_SYMBOL : DARK_OVERLAY_SYMBOL,
    height: DESKTOP_TITLEBAR_HEIGHT,
  };
}

/** 将用户选择的主题模式实时同步给 Electron nativeTheme（驱动 Windows 标题栏/菜单栏明暗）及主窗口底色。 */
export function applyDesktopNativeTheme(state: DesktopThemeState, win?: BrowserWindow | null): void {
  nativeTheme.themeSource = state.mode;
  if (win && !win.isDestroyed()) {
    win.setBackgroundColor(resolveWindowBackgroundColor(state.resolvedScheme));
    if (process.platform === "win32" && typeof win.setTitleBarOverlay === "function") {
      try {
        win.setTitleBarOverlay(resolveTitleBarOverlayOptions(state.resolvedScheme));
      } catch (error) {
        logDesktop("更新窗口标题栏控制色失败", error);
      }
    }
  }
}
