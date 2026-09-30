/**
 * 功能：启动 LFAA Windows 本机一体版桌面应用。
 * 作用：开发时连接共用 Vite 前端；安装后启动本机控制端和 Daemon，再通过 localhost 展示同一套 React 界面。
 * 关联文件：apps/desktop-electron/src/preload.cjs、apps/desktop-electron/package.json、apps/desktop-electron/nsis/installer.nsh、apps/desktop-electron/scripts/prepare-runtime.mjs、packages/host/webserver/src/server.ts、packages/workspace/data-directory/src/service.ts、scripts/apply-data-directory-migration.mjs、packages/host/daemon/src/daemon.mjs。
 */
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { createServer as createTcpServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { app, BrowserWindow, dialog, ipcMain } from "electron";

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();

let mainWindow = null;
let serverProcess = null;
let daemonProcess = null;
let serviceShutdownPromise = null;
let serviceShutdownComplete = false;
let packagedFrontendUrl = "";
let logFilePath = "";

function getRuntimeRoot() {
  return app.isPackaged
    ? join(process.resourcesPath, "app-runtime")
    : resolve(app.getAppPath(), "..", "..");
}

function getDesktopStorageSettingsPath() {
  return join(app.getPath("userData"), "storage.json");
}

function getDesktopStorageMigrationRequestPath() {
  return join(app.getPath("userData"), ".lfaa-data-directory.pending.json");
}

function getPackagedNodePath(runtimeRoot) {
  return app.isPackaged ? join(runtimeRoot, "node.exe") : process.execPath;
}

function canUseDataDirectory(directory) {
  try {
    mkdirSync(directory, { recursive: true });
    const probePath = join(directory, `.lfaa-write-check-${process.pid}`);
    writeFileSync(probePath, "LFAA", { flag: "wx" });
    rmSync(probePath);
    return true;
  } catch {
    return false;
  }
}

function readSavedDataDirectory() {
  try {
    const settings = JSON.parse(readFileSync(getDesktopStorageSettingsPath(), "utf8"));
    return typeof settings?.dataDirectory === "string" ? settings.dataDirectory.trim() : "";
  } catch (error) {
    if (error?.code !== "ENOENT") throw new Error("桌面端的数据目录配置无法读取，请检查应用用户配置目录。");
    return "";
  }
}

function saveDesktopDataDirectory(directory) {
  const settingsPath = getDesktopStorageSettingsPath();
  mkdirSync(dirname(settingsPath), { recursive: true });
  let settings = {};
  try {
    const parsed = JSON.parse(readFileSync(settingsPath, "utf8"));
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) settings = parsed;
  } catch (error) {
    if (error?.code !== "ENOENT") throw new Error("桌面端的数据目录配置无法读取，请检查应用用户配置目录。");
  }

  settings.dataDirectory = directory;
  const temporaryPath = `${settingsPath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
  try {
    renameSync(temporaryPath, settingsPath);
  } catch (error) {
    rmSync(temporaryPath, { force: true });
    throw error;
  }
}

function resolveDesktopDataDirectory(runtimeRoot) {
  const externalDataDirectory = process.env.LFAA_DATA_DIR?.trim() ?? "";
  if (externalDataDirectory) return { directory: externalDataDirectory, managedByDesktop: false };

  const savedDirectory = readSavedDataDirectory();
  if (savedDirectory) {
    const directory = resolve(savedDirectory);
    if (!existsSync(directory) || !canUseDataDirectory(directory)) {
      throw new Error(`已保存的数据目录不可用或不可写：${directory}。请连接原磁盘后重启，或修复该目录权限。`);
    }
    return { directory, managedByDesktop: true };
  }

  const preferredDirectory = app.isPackaged
    ? join(dirname(app.getPath("exe")), "data")
    : join(runtimeRoot, "data");
  if (canUseDataDirectory(preferredDirectory)) {
    const directory = resolve(preferredDirectory);
    saveDesktopDataDirectory(directory);
    return { directory, managedByDesktop: true };
  }

  const userDataDirectory = join(app.getPath("userData"), "data");
  if (canUseDataDirectory(userDataDirectory)) {
    const directory = resolve(userDataDirectory);
    saveDesktopDataDirectory(directory);
    return { directory, managedByDesktop: true };
  }
  throw new Error("无法在应用安装目录或当前账户的应用数据目录创建可写 LFAA 数据目录。请检查磁盘权限或设置 LFAA_DATA_DIR。");
}

async function applyPendingDesktopStorageMigration(runtimeRoot) {
  const requestPath = getDesktopStorageMigrationRequestPath();
  if (!existsSync(requestPath)) return;

  if (process.env.LFAA_DATA_DIR?.trim()) {
    await writeLog("数据迁移", "发现待迁移请求，但系统环境变量 LFAA_DATA_DIR 优先；保留请求并继续使用环境变量目录。");
    return;
  }

  const nodePath = getPackagedNodePath(runtimeRoot);
  const migrationScript = join(runtimeRoot, "scripts", "apply-data-directory-migration.mjs");
  const result = spawnSync(nodePath, [migrationScript, runtimeRoot, "--desktop-config", getDesktopStorageSettingsPath(), "--request", requestPath], {
    encoding: "utf8",
    windowsHide: true,
    env: {
      ...process.env,
      LFAA_DESKTOP_MODE: "true",
      LFAA_DATA_DIRECTORY_MIGRATION_SUPPORTED: "1"
    }
  });
  if (result.stdout) await writeLog("数据迁移", String(result.stdout).trim());
  if (result.stderr) await writeLog("数据迁移", String(result.stderr).trim());
  if (result.error || result.status !== 0) {
    await writeLog("数据迁移", "本次未切换数据目录，应用会继续从原目录启动；可在设置中心处理原因后重试。");
  }
}

async function writeLog(source, message) {
  if (!logFilePath) return;
  const line = `[${new Date().toISOString()}] [${source}] ${message}`;
  try {
    await appendFile(logFilePath, `${line}\n`, "utf8");
  } catch {
    // 桌面日志不可写时不阻断应用启动或服务关闭。
  }
}

function connectProcessOutput(child, name) {
  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (chunk) => void writeLog(name, String(chunk).trimEnd()));
  child.stderr?.on("data", (chunk) => void writeLog(`${name} 错误`, String(chunk).trimEnd()));
  child.once("error", (error) => void writeLog(name, `进程启动失败：${error.message}`));
  child.once("exit", (code, signal) => void writeLog(name, `进程退出，代码 ${code ?? "无"}，信号 ${signal ?? "无"}。`));
}

function findAvailableLocalPort() {
  return new Promise((resolvePort, reject) => {
    const probe = createTcpServer();
    probe.once("error", reject);
    probe.listen(0, "localhost", () => {
      const address = probe.address();
      if (!address || typeof address === "string") {
        probe.close(() => reject(new Error("无法分配本机服务端口。")));
        return;
      }

      probe.close((error) => {
        if (error) reject(error);
        else resolvePort(address.port);
      });
    });
  });
}

function wait(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function waitForControlPlane(child, port) {
  const healthUrl = `http://localhost:${port}/api/health`;
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error("本机控制端意外退出；请查看桌面日志。 ");
    }

    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(2_000) });
      const health = await response.json();
      if (response.ok && health?.status === "ok" && health?.service === "lfaa-server") return;
    } catch {
      // 控制端初始化数据库和 AI 扩展宿主时，短暂的连接失败属于正常启动过程。
    }
    await wait(300);
  }

  throw new Error("等待本机控制端就绪超时；请查看桌面日志。 ");
}

function createServiceEnvironment(port, runtimeRoot) {
  const { directory: dataDirectory, managedByDesktop } = resolveDesktopDataDirectory(runtimeRoot);
  return {
    ...process.env,
    NODE_ENV: "production",
    LFAA_DESKTOP_MODE: "true",
    LFAA_SERVE_FRONTEND: "true",
    JWT_SECRET: "",
    LFAA_DATA_DIR: dataDirectory,
    LFAA_DATA_DIR_MANAGED_BY_DESKTOP: managedByDesktop ? "1" : "0",
    LFAA_DATA_DIRECTORY_MIGRATION_SUPPORTED: managedByDesktop ? "1" : "0",
    LFAA_DESKTOP_INSTALL_DIRECTORY: dirname(app.getPath("exe")),
    LFAA_DATA_DIRECTORY_MIGRATION_REQUEST_PATH: getDesktopStorageMigrationRequestPath(),
    SERVER_HOST: "localhost",
    SERVER_PORT: String(port),
    WEBAUTHN_RP_ID: "localhost",
    WEBAUTHN_ORIGIN: `http://localhost:${port}`
  };
}

async function startLocalServices(runtimeRoot) {
  const nodePath = getPackagedNodePath(runtimeRoot);
  const port = await findAvailableLocalPort();
  const environment = createServiceEnvironment(port, runtimeRoot);
  const serverEntry = join(runtimeRoot, "dist", "apps", "control-plane", "index.js");
  const serverLoader = join(runtimeRoot, "apps", "cli", "register-package-loader.mjs");

  await writeLog("桌面端", `正在启动本机控制端，监听端口 ${port}。`);
  serverProcess = spawn(nodePath, ["--import", pathToFileURL(serverLoader).href, serverEntry, "--profile", "desktop"], {
    cwd: runtimeRoot,
    env: environment,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });
  connectProcessOutput(serverProcess, "控制端");
  await waitForControlPlane(serverProcess, port);

  const daemonEntry = serverEntry;
  await writeLog("桌面端", "控制端已就绪，正在启动本机 Daemon。");
  daemonProcess = spawn(nodePath, ["--import", pathToFileURL(serverLoader).href, daemonEntry, "--profile", "daemon"], {
    cwd: runtimeRoot,
    env: environment,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });
  connectProcessOutput(daemonProcess, "本机 Daemon");

  packagedFrontendUrl = `http://localhost:${port}`;
  await writeLog("桌面端", "本机服务已启动。");
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: "LFAA",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: join(app.getAppPath(), "src", "preload.cjs")
    }
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  const frontendUrl = app.isPackaged ? packagedFrontendUrl : "http://localhost:5173";
  await mainWindow.loadURL(frontendUrl);
}

function waitForProcessExit(child, timeoutMilliseconds) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);

  return new Promise((resolveExit) => {
    const timer = setTimeout(() => finish(false), timeoutMilliseconds);
    const onExit = () => finish(true);
    function finish(exited) {
      clearTimeout(timer);
      child.off("exit", onExit);
      resolveExit(exited);
    }
    child.once("exit", onExit);
  });
}

async function stopChild(child, name, timeoutMilliseconds) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await writeLog("桌面端", `正在关闭${name}。`);
  child.kill("SIGTERM");
  const exited = await waitForProcessExit(child, timeoutMilliseconds);
  if (!exited && child.exitCode === null && child.signalCode === null) {
    await writeLog("桌面端", `${name}未及时退出，结束该服务进程。`);
    child.kill();
    await waitForProcessExit(child, 5_000);
  }
}

async function stopLocalServices() {
  await stopChild(daemonProcess, "本机 Daemon", 30_000);
  await stopChild(serverProcess, "本机控制端", 10_000);
  daemonProcess = null;
  serverProcess = null;
}

if (singleInstance) {
  ipcMain.handle("lfaa:select-data-directory", async (event) => {
    const ownerWindow = BrowserWindow.fromWebContents(event.sender);
    const options = {
      title: "选择 LFAA 数据根目录",
      properties: ["openDirectory", "createDirectory"]
    };
    const result = ownerWindow
      ? await dialog.showOpenDialog(ownerWindow, options)
      : await dialog.showOpenDialog(options);
    return result.canceled ? null : result.filePaths[0] ?? null;
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on("before-quit", (event) => {
    if (serviceShutdownComplete || (!serverProcess && !daemonProcess)) return;
    event.preventDefault();
    serviceShutdownPromise ??= stopLocalServices().finally(() => {
      serviceShutdownComplete = true;
      app.quit();
    });
  });

  app.whenReady().then(async () => {
    const logDirectory = join(app.getPath("userData"), "logs");
    await mkdir(logDirectory, { recursive: true });
    logFilePath = join(logDirectory, "desktop.log");

    try {
      const runtimeRoot = getRuntimeRoot();
      if (app.isPackaged) {
        await applyPendingDesktopStorageMigration(runtimeRoot);
        await startLocalServices(runtimeRoot);
      }
      await createMainWindow();
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知启动错误。";
      await writeLog("桌面端 错误", message);
      await stopLocalServices();
      serviceShutdownComplete = true;
      dialog.showErrorBox("LFAA 启动失败", `${message}\n\n日志位置：${logFilePath}`);
      app.quit();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0 && (!app.isPackaged || packagedFrontendUrl)) {
      void createMainWindow();
    }
  });
}
