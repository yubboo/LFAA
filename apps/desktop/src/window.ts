// 创建主窗口并施加导航与弹窗安全策略：只允许本机页面内导航，外部链接交给系统浏览器。
// 窗口尺寸与位置会记住（~/.lfaa/desktop-window.json），下次启动恢复。
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { BrowserWindow, screen, shell } from "electron";
import type { DesktopPaths } from "./paths";
import { logDesktop } from "./log";

export interface MainWindowOptions {
  /** 主窗口加载地址（本机服务地址，或调试时指定的开发服务器地址）。 */
  url: string;
  paths: DesktopPaths;
  devMode: boolean;
}

interface WindowBounds {
  x?: number;
  y?: number;
  width: number;
  height: number;
}

const WINDOW_STATE_FILE = join(homedir(), ".lfaa", "desktop-window.json");
const DEFAULT_WIDTH = 1440;
const DEFAULT_HEIGHT = 900;

/** 读取上次窗口位置；越界（显示器变化）或非数字时回退默认值。 */
function loadWindowBounds(): WindowBounds {
  try {
    const raw = JSON.parse(readFileSync(WINDOW_STATE_FILE, "utf8")) as Partial<WindowBounds>;
    const width = Number(raw.width);
    const height = Number(raw.height);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1040 || height < 680) {
      return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
    }
    const x = Number(raw.x);
    const y = Number(raw.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { width, height };
    // 只恢复仍落在某块显示器工作区内的位置，避免窗口跑到屏幕外。
    const visible = screen.getAllDisplays().some((display) => {
      const area = display.workArea;
      return x >= area.x - 40 && y >= area.y - 40 && x < area.x + area.width - 80 && y < area.y + area.height - 80;
    });
    return visible ? { x, y, width, height } : { width, height };
  } catch {
    return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
  }
}

/** 保存窗口位置；失败只记日志，不影响关窗流程。 */
function saveWindowBounds(window: BrowserWindow): void {
  try {
    const bounds = window.getNormalBounds();
    writeFileSync(WINDOW_STATE_FILE, `${JSON.stringify(bounds)}\n`, "utf8");
  } catch (error) {
    logDesktop("保存窗口位置失败", error);
  }
}

/** 创建 LFAA 主窗口；首屏就绪后再显示，避免白屏闪烁。 */
export function createMainWindow(options: MainWindowOptions): BrowserWindow {
  const saved = loadWindowBounds();
  const window = new BrowserWindow({
    ...(saved.x !== undefined && saved.y !== undefined ? { x: saved.x, y: saved.y } : {}),
    width: saved.width,
    height: saved.height,
    minWidth: 1040,
    minHeight: 680,
    title: "LFAA",
    show: false,
    // 窗口底色只作用于加载前的空白帧；界面颜色仍由主题变量决定。
    backgroundColor: "#171717",
    ...(options.paths.iconPath ? { icon: options.paths.iconPath } : {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      spellcheck: false,
    },
  });

  window.once("ready-to-show", () => window.show());
  window.on("close", () => saveWindowBounds(window));

  const allowedOrigin = new URL(options.url).origin;
  window.webContents.on("will-navigate", (event, target) => {
    if (isSameOrigin(target, allowedOrigin)) return;
    event.preventDefault();
    openExternally(target);
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternally(url);
    return { action: "deny" };
  });
  window.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    console.error(`LFAA 页面加载失败（${errorCode}）：${errorDescription}`);
  });

  // 只有显式开着调试开关的未打包运行才自动打开 DevTools。
  if (options.devMode && process.env.LFAA_DESKTOP_DEV === "1") {
    window.webContents.openDevTools({ mode: "detach" });
  }

  void window.loadURL(options.url);
  return window;
}

/** 同源判断；非法地址按「不允许」处理。 */
function isSameOrigin(target: string, allowedOrigin: string): boolean {
  try {
    return new URL(target).origin === allowedOrigin;
  } catch {
    return false;
  }
}

/** 外部链接只放行 http(s)，其余协议（file、自定义协议）一律忽略。 */
function openExternally(target: string): void {
  if (/^https?:\/\//iu.test(target)) void shell.openExternal(target);
}