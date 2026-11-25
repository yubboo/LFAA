// LFAA 桌面端主进程：单实例、拉起桌面宿主子进程、创建主窗口，并在退出时先停宿主再退出。
import { app, dialog, ipcMain } from "electron";
import { basename, resolve } from "node:path";
import type { BrowserWindow } from "electron";
import { DesktopHostProcess } from "./host-process";
import { attachEmbeddedBrowser } from "./embedded-browser";
import { logDesktop, desktopLogPath } from "./log";
import { installApplicationMenu } from "./menu";
import { resolveDesktopPaths } from "./paths";
import { createMainWindow } from "./window";

/** Windows 任务栏/快捷方式分组标识，须与 electron-builder 的 appId 一致。 */
const APP_USER_MODEL_ID = "com.lfaa.desktop";

let desktopHost: DesktopHostProcess | null = null;
let mainWindow: BrowserWindow | null = null;
let isStopping = false;

// 主进程未捕获异常统一落盘，避免「双击没反应」时无据可查。
process.on("uncaughtException", (error) => logDesktop("主进程未捕获异常", error));
process.on("unhandledRejection", (reason) => logDesktop("主进程未处理 Promise 拒绝", reason));

// 单实例：第二个进程只负责聚焦已有窗口，不再起第二套宿主。
const hasLock = app.requestSingleInstanceLock();
// 上次异常退出可能残留用户数据锁（表现为双击无反应）；--new-instance 用于强制再开一个窗口。
const forceNewInstance = process.argv.includes("--new-instance");
if (!hasLock && !forceNewInstance) {
  logDesktop("未取得单实例锁，退出（如任务栏无窗口，可用 --new-instance 强制启动）");
  app.quit();
} else {
  app.on("second-instance", focusMainWindow);
  // 首版没有托盘常驻：窗口全部关闭即退出。
  app.on("window-all-closed", () => app.quit());
  // 退出前先幂等停止宿主，避免留下监听端口与后台任务。
  app.on("before-quit", (event) => {
    if (isStopping || !desktopHost) return;
    event.preventDefault();
    isStopping = true;
    const host = desktopHost;
    desktopHost = null;
    void host.stop()
      .catch((error: unknown) => console.error("LFAA 关闭桌面宿主失败：", error))
      .finally(() => app.quit());
  });
  void app.whenReady().then(startDesktop).catch(reportStartupFailure);
}

/** 启动流程：解析路径 → （按需）拉起宿主 → 菜单 → 主窗口。 */
async function startDesktop(): Promise<void> {
  app.setAppUserModelId(APP_USER_MODEL_ID);
  const paths = resolveDesktopPaths();
  const devMode = !app.isPackaged;
  // 调试 UI 时仅允许未打包开发态通过环境变量指向开发服务器，打包态始终启动内置本机宿主。
  const devUrl = devMode ? process.env.LFAA_DESKTOP_URL?.trim() : undefined;
  const url = devUrl ? devUrl : await startLocalHost(paths);

  installApplicationMenu({ dataRoot: paths.dataRoot, devMode });
  mainWindow = createMainWindow({ url, paths, devMode });
  attachEmbeddedBrowser(mainWindow);
  ipcMain.removeHandler("lfaa:dialog:pickFolder");
  ipcMain.handle("lfaa:dialog:pickFolder", async (_event, opts?: { title?: string; defaultPath?: string }) => {
    const win = mainWindow;
    const res = await dialog.showOpenDialog(win ?? undefined as never, {
      title: opts?.title?.trim() || "选择文件夹",
      ...(opts?.defaultPath?.trim() ? { defaultPath: opts.defaultPath.trim() } : {}),
      properties: ["openDirectory", "createDirectory"],
    });
    if (res.canceled || !res.filePaths[0]) return { cancelled: true };
    const picked = resolve(res.filePaths[0]);
    return { cancelled: false, path: picked, name: basename(picked) || picked };
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

/** 拉起独立宿主进程并返回其地址。 */
async function startLocalHost(paths: ReturnType<typeof resolveDesktopPaths>): Promise<string> {
  desktopHost = new DesktopHostProcess({
    entry: paths.hostEntry,
    webRoot: paths.webRoot,
    projectRoot: paths.projectRoot,
    onUnexpectedExit: reportHostFailure,
  });
  const ready = await desktopHost.start();
  // 打印真实地址：排查「窗口空白」时先确认宿主是否起在预期端口。
  console.info(`[LFAA] 桌面宿主已启动：${ready.url}`);
  return ready.url;
}

/** 聚焦已有窗口：还原最小化并置前。 */
function focusMainWindow(): void {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

/** 启动失败必须可见，不能静默退出成「双击没反应」。 */
function reportStartupFailure(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error("LFAA 桌面端启动失败：", error);
  logDesktop("桌面端启动失败", error);
  dialog.showErrorBox(
    "LFAA 启动失败",
    `桌面宿主未能启动：${message}\n\n日志：${desktopLogPath}\n请确认安装目录完整；若已有 LFAA 在运行，请先退出后重试。`,
  );
  app.quit();
}

/** 宿主在运行中意外退出：提示后退出，避免留下一个空白窗口。 */
function reportHostFailure(error: Error): void {
  console.error("LFAA 桌面宿主异常退出：", error);
  logDesktop("桌面宿主异常退出", error);
  dialog.showErrorBox(
    "LFAA 已停止",
    `桌面宿主意外退出：${error.message}\n\n日志：${desktopLogPath}\n请重新启动 LFAA；若反复出现，请把该日志发给开发者。`,
  );
  app.quit();
}