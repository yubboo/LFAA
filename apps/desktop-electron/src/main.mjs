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
import electronUpdater from "electron-updater";
import { compareStableVersions, getElectronUpdateFeedUrl, getLfaaUpdateManifestUrl, validateLfaaUpdateManifest } from "./update-manifest.mjs";
import { createDesktopUpdateFlow, getDesktopUpdateErrorMessage } from "./update-flow.mjs";
import { createDesktopUpdatePromptBroker } from "./update-prompt-broker.mjs";
import { createDesktopUpdatePreferencesStore } from "./update-preferences.mjs";

const { autoUpdater } = electronUpdater;
const INITIAL_UPDATE_CHECK_DELAY_MS = 3_000;
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1_000;

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();

let mainWindow = null;
const desktopUpdatePromptBroker = createDesktopUpdatePromptBroker();
let desktopUpdatePreferencesStore = null;
let availableDesktopUpdate = null;
let serverProcess = null;
let daemonProcess = null;
let serviceShutdownPromise = null;
let serviceShutdownComplete = false;
let packagedFrontendUrl = "";
let logFilePath = "";
let updateCheckTimer = null;
let activeUpdateManifest = null;
let acceptedUpdateManifest = null;
let updateDownloadRequestedVersion = "";
let downloadedUpdateVersion = "";
let automaticInstallVersion = "";
let updateInstallRequested = false;
let systemSessionEnding = false;
let updaterListenersConfigured = false;
let desktopUpdateFlow = null;
let desktopAppClosing = false;
const loggedUpdaterErrors = new WeakSet();

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
  const rendererId = mainWindow.webContents.id;
  mainWindow.webContents.on("did-start-loading", () => desktopUpdatePromptBroker.setRendererNotReady(rendererId));
  mainWindow.on("session-end", event => {
    systemSessionEnding = true;
    void writeLog("桌面端", `Windows 会话即将结束（${event.reasons.join("、")}）；更新安装将延期。`);
  });
  mainWindow.on("closed", () => {
    desktopUpdatePromptBroker.setRendererNotReady(rendererId);
    desktopUpdatePromptBroker.cancelAll();
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
  if (!child || child.exitCode !== null || child.signalCode !== null) return true;
  await writeLog("桌面端", `正在关闭${name}。`);
  child.kill("SIGTERM");
  let exited = await waitForProcessExit(child, timeoutMilliseconds);
  if (!exited && child.exitCode === null && child.signalCode === null) {
    await writeLog("桌面端", `${name}未及时退出，结束该服务进程。`);
    child.kill();
    exited = await waitForProcessExit(child, 5_000);
  }
  return exited || child.exitCode !== null || child.signalCode !== null;
}

async function stopLocalServices() {
  const daemonStopped = await stopChild(daemonProcess, "本机 Daemon", 30_000);
  if (daemonStopped) daemonProcess = null;
  const serverStopped = await stopChild(serverProcess, "本机控制端", 10_000);
  if (serverStopped) serverProcess = null;
  return daemonStopped && serverStopped;
}

function getConfiguredUpdateFeedUrl() {
  const updateConfigPath = join(process.resourcesPath, "app-update.yml");
  return getElectronUpdateFeedUrl(readFileSync(updateConfigPath, "utf8"));
}

async function readRemoteUpdateManifest() {
  const feedUrl = getConfiguredUpdateFeedUrl();
  const manifestUrl = getLfaaUpdateManifestUrl(feedUrl);
  const response = await fetch(manifestUrl, { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`更新清单请求失败，HTTP ${response.status}。`);
  const finalUrl = new URL(response.url);
  const expectedUrl = new URL(manifestUrl);
  if (finalUrl.protocol !== "https:" || finalUrl.origin !== expectedUrl.origin || finalUrl.pathname !== expectedUrl.pathname) {
    throw new Error("更新清单发生了非预期的主机或路径跳转。");
  }
  return validateLfaaUpdateManifest(await response.text(), feedUrl);
}

async function promptToDownloadUpdate(manifest, { mustInstall }) {
  await writeLog("更新", `已发现 LFAA ${manifest.version}，等待用户选择是否下载。`);
  const action = await desktopUpdatePromptBroker.request({
    kind: "download",
    version: manifest.version,
    publishedAt: manifest.publishedAt,
    releaseNotes: manifest.releaseNotes,
    mandatory: mustInstall
  });
  await writeLog("更新", `LFAA ${manifest.version} 更新提示已结束，用户选择：${action}。`);
  return action === "accept" || action === "skip" ? action : "defer";
}

async function promptToInstallUpdate(info, manifest) {
  if (!manifest || downloadedUpdateVersion !== info.version) return;
  const mustInstall = manifest.mandatory
    && compareStableVersions(app.getVersion(), manifest.minimumSupportedVersion) < 0;
  const action = await desktopUpdatePromptBroker.request({
    kind: "install",
    version: info.version,
    publishedAt: manifest.publishedAt,
    releaseNotes: manifest.releaseNotes,
    mandatory: mustInstall
  });
  if (action === "install") {
    await requestDownloadedUpdateInstall();
  } else {
    await writeLog("更新", `已下载 LFAA ${info.version}；用户选择在退出 LFAA 时安装。`);
  }
}

function showUpdateNotice(title, message, detail) {
  return desktopUpdatePromptBroker.request({ kind: "notice", title, message, detail });
}

async function requestDownloadedUpdateInstall() {
  if (!downloadedUpdateVersion || updateInstallRequested) return;
  if (systemSessionEnding) {
    await writeLog("更新", "Windows 正在注销或关机，跳过本次更新安装；下次启动后重新检查。 ");
    return;
  }
  updateInstallRequested = true;
  await writeLog("更新", `开始安装 LFAA ${downloadedUpdateVersion}，先关闭本机服务。`);
  if (serviceShutdownComplete) {
    autoUpdater.quitAndInstall(false, true);
    return;
  }
  continueQuitAfterServiceShutdown();
}

function continueQuitAfterServiceShutdown() {
  if (serviceShutdownPromise) return;
  serviceShutdownPromise = (async () => {
    const servicesStopped = await stopLocalServices();
    if (!servicesStopped) {
      updateInstallRequested = false;
      await writeLog("桌面端 错误", "本机服务仍有进程未能确认退出，未安装更新，应用保持打开。 ");
      await showUpdateNotice("无法关闭 LFAA 服务", "本机控制端或 Daemon 尚未退出。更新未安装，请检查活动实例后重试。");
      return;
    }

    serviceShutdownComplete = true;
    if (downloadedUpdateVersion && updateInstallRequested && !systemSessionEnding) {
      autoUpdater.quitAndInstall(false, true);
      return;
    }
    if (downloadedUpdateVersion && updateInstallRequested && systemSessionEnding) {
      updateInstallRequested = false;
      await writeLog("更新", "Windows 正在注销或关机，已跳过启动更新安装器；下次启动后重新检查。 ");
    }
    app.quit();
  })().catch(async error => {
    updateInstallRequested = false;
    await writeLog("桌面端 错误", `关闭本机服务失败：${error instanceof Error ? error.message : String(error)}`);
    await showUpdateNotice("无法关闭 LFAA 服务", "关闭本机服务时发生错误。更新未安装，应用保持打开。", error instanceof Error ? error.message : String(error));
  }).finally(() => {
    serviceShutdownPromise = null;
  });
}

function isDesktopUpdateSupported() {
  return app.isPackaged && process.platform === "win32";
}

function configureAutoUpdater() {
  if (updaterListenersConfigured) return;
  updaterListenersConfigured = true;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.on("update-available", info => {
    if (info?.version !== activeUpdateManifest?.version) {
      void writeLog("更新 错误", `更新清单版本 ${String(activeUpdateManifest?.version)} 与安装源版本 ${String(info?.version)} 不一致，未下载。`);
      return;
    }
    void writeLog("更新", `确认 Release feed 提供 LFAA ${info.version}。`);
  });
  autoUpdater.on("update-downloaded", info => {
    const manifest = acceptedUpdateManifest;
    if (!manifest || info?.version !== manifest.version || !desktopUpdateFlow?.markDownloaded(info.version)) {
      if (updateDownloadRequestedVersion) desktopUpdateFlow?.markDownloadFailed(updateDownloadRequestedVersion);
      updateDownloadRequestedVersion = "";
      acceptedUpdateManifest = null;
      automaticInstallVersion = "";
      void writeLog("更新 错误", `下载版本 ${String(info?.version)} 与用户接受的更新清单不一致，拒绝安装。`);
      return;
    }
    downloadedUpdateVersion = info.version;
    updateDownloadRequestedVersion = "";
    void writeLog("更新", `LFAA ${info.version} 下载完成。`);
    if (automaticInstallVersion === info.version) {
      automaticInstallVersion = "";
      void readDesktopUpdatePreferences().then(preferences => {
        if (preferences.autoDownloadAndInstall) {
          void requestDownloadedUpdateInstall().catch(() => {
            void writeLog("更新 错误", `自动安装 LFAA ${info.version} 失败。`);
          });
          return;
        }
        void promptToInstallUpdate(info, manifest).catch(error => {
          void writeLog("更新 错误", `显示更新安装提示失败：${error instanceof Error ? error.message : String(error)}`);
        });
      }).catch(() => {
        void promptToInstallUpdate(info, manifest).catch(() => undefined);
      });
      return;
    }
    automaticInstallVersion = "";
    void promptToInstallUpdate(info, manifest).catch(error => {
      void writeLog("更新 错误", `显示更新安装提示失败：${error instanceof Error ? error.message : String(error)}`);
    });
  });
  autoUpdater.on("error", error => {
    if (error && typeof error === "object") loggedUpdaterErrors.add(error);
    const phase = updateDownloadRequestedVersion ? "download" : "check";
    if (phase === "download") automaticInstallVersion = "";
    void writeLog("更新 错误", getDesktopUpdateErrorMessage(error, phase));
  });
}

function beginDesktopUpdateDownload(manifest, { automaticInstall = false } = {}) {
  if (updateDownloadRequestedVersion === manifest.version || downloadedUpdateVersion === manifest.version) return;
  acceptedUpdateManifest = manifest;
  updateDownloadRequestedVersion = manifest.version;
  automaticInstallVersion = automaticInstall ? manifest.version : "";
  void writeLog("更新", `开始下载 LFAA ${manifest.version}。`);
  try {
    return Promise.resolve(autoUpdater.downloadUpdate()).catch(error => {
      if (automaticInstallVersion === manifest.version) automaticInstallVersion = "";
      throw error;
    });
  } catch (error) {
    automaticInstallVersion = "";
    throw error;
  }
}

function publishDesktopUpdateAvailability(manifest) {
  availableDesktopUpdate = manifest ? {
    version: manifest.version,
    publishedAt: manifest.publishedAt,
    releaseNotes: [...manifest.releaseNotes]
  } : null;
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    mainWindow.webContents.send("lfaa:desktop:update-availability", availableDesktopUpdate);
  } catch {
    // A closing renderer can miss this event; a newly mounted UI reads the current availability over IPC.
  }
}

async function readDesktopUpdatePreferences() {
  return desktopUpdatePreferencesStore?.read() ?? { autoDownloadAndInstall: false, ignoredVersion: "" };
}

function getDesktopUpdateFlow() {
  if (desktopUpdateFlow) return desktopUpdateFlow;
  desktopUpdateFlow = createDesktopUpdateFlow({
    isSupported: isDesktopUpdateSupported,
    getCurrentVersion: () => app.getVersion(),
    readManifest: async () => {
      activeUpdateManifest = await readRemoteUpdateManifest();
      return activeUpdateManifest;
    },
    checkReleaseFeed: async () => {
      configureAutoUpdater();
      return autoUpdater.checkForUpdates();
    },
    promptForUpdate: promptToDownloadUpdate,
    beginDownload: beginDesktopUpdateDownload,
    getPreferences: readDesktopUpdatePreferences,
    ignoreVersion: async version => {
      try {
        if (!desktopUpdatePreferencesStore) throw new Error("桌面更新偏好尚未初始化。");
        await desktopUpdatePreferencesStore.ignoreVersion(version);
      } catch {
        await writeLog("更新 错误", "跳过版本设置未能保存到本机，未跳过该版本。 ");
        await showUpdateNotice("无法跳过此版本", `LFAA ${version} 的跳过设置没有保存；下次检查时仍会提醒你。`);
        throw new Error("跳过版本的本机设置未保存。");
      }
    },
    onUpdateAvailable: publishDesktopUpdateAvailability,
    onError: async (error, phase, manifest, safeMessage) => {
      const message = safeMessage || getDesktopUpdateErrorMessage(error, phase);
      if (!(error && typeof error === "object" && loggedUpdaterErrors.has(error))) {
        await writeLog("更新 错误", message);
      }
      if (phase !== "download") return;
      if (updateDownloadRequestedVersion === manifest?.version) updateDownloadRequestedVersion = "";
      if (automaticInstallVersion === manifest?.version) automaticInstallVersion = "";
      if (acceptedUpdateManifest?.version === manifest?.version) acceptedUpdateManifest = null;
      await showUpdateNotice(
        "LFAA 更新下载失败",
        `LFAA ${manifest?.version ?? "新版本"} 下载失败。`,
        message
      );
    }
  });
  return desktopUpdateFlow;
}

function getDesktopUpdateRuntimeInfo() {
  return { supported: isDesktopUpdateSupported(), currentVersion: app.getVersion() };
}

function assertTrustedUpdateRenderer(event) {
  if (!mainWindow || event.sender !== mainWindow.webContents
    || (event.senderFrame && event.senderFrame !== mainWindow.webContents.mainFrame)) {
    throw new Error("拒绝未授权窗口访问桌面更新能力。");
  }
}

async function runDesktopUpdateCheck({ manual = false } = {}) {
  return getDesktopUpdateFlow().check({ manual });
}

function scheduleDesktopUpdateCheck(delay = INITIAL_UPDATE_CHECK_DELAY_MS) {
  if (!isDesktopUpdateSupported() || desktopAppClosing || updateCheckTimer) return;
  updateCheckTimer = setTimeout(() => {
    updateCheckTimer = null;
    void runDesktopUpdateCheck({ manual: false })
      .catch(error => { void writeLog("更新 错误", getDesktopUpdateErrorMessage(error, "check")); })
      .finally(() => scheduleDesktopUpdateCheck(UPDATE_CHECK_INTERVAL_MS));
  }, delay);
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

  ipcMain.handle("lfaa:desktop:update-runtime", (event) => {
    assertTrustedUpdateRenderer(event);
    return getDesktopUpdateRuntimeInfo();
  });

  ipcMain.handle("lfaa:desktop:update-preferences", (event) => {
    assertTrustedUpdateRenderer(event);
    return readDesktopUpdatePreferences().then(({ autoDownloadAndInstall }) => ({ autoDownloadAndInstall }));
  });

  ipcMain.handle("lfaa:desktop:update-preferences:set-auto", async (event, enabled) => {
    assertTrustedUpdateRenderer(event);
    if (typeof enabled !== "boolean") throw new TypeError("自动更新偏好必须是布尔值。");
    if (!desktopUpdatePreferencesStore) throw new Error("桌面更新偏好尚未初始化。");
    const preferences = await desktopUpdatePreferencesStore.setAutoDownloadAndInstall(enabled);
    return { autoDownloadAndInstall: preferences.autoDownloadAndInstall };
  });

  ipcMain.handle("lfaa:desktop:update-availability", (event) => {
    assertTrustedUpdateRenderer(event);
    return availableDesktopUpdate;
  });

  ipcMain.handle("lfaa:desktop:check-updates", (event) => {
    assertTrustedUpdateRenderer(event);
    return runDesktopUpdateCheck({ manual: true });
  });

  ipcMain.handle("lfaa:desktop:update-prompt-ui-ready", (event) => {
    assertTrustedUpdateRenderer(event);
    const sender = event.sender;
    desktopUpdatePromptBroker.setRendererReady(sender.id, payload => {
      if (!mainWindow || mainWindow.webContents !== sender || mainWindow.isDestroyed()) return;
      sender.send("lfaa:desktop:update-prompt", payload);
    });
    return true;
  });

  ipcMain.handle("lfaa:desktop:update-prompt-ui-not-ready", (event) => {
    assertTrustedUpdateRenderer(event);
    desktopUpdatePromptBroker.setRendererNotReady(event.sender.id);
    return true;
  });

  ipcMain.handle("lfaa:desktop:update-prompt-response", (event, input) => {
    assertTrustedUpdateRenderer(event);
    if (!input || typeof input.requestId !== "string" || typeof input.action !== "string") return false;
    return desktopUpdatePromptBroker.respond(input.requestId, input.action);
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
    if (serviceShutdownComplete) return;
    if (!serverProcess && !daemonProcess && !downloadedUpdateVersion) {
      serviceShutdownComplete = true;
      return;
    }
    event.preventDefault();
    if (downloadedUpdateVersion && !systemSessionEnding) updateInstallRequested = true;
    continueQuitAfterServiceShutdown();
  });

  app.whenReady().then(async () => {
    const logDirectory = join(app.getPath("userData"), "logs");
    await mkdir(logDirectory, { recursive: true });
    logFilePath = join(logDirectory, "desktop.log");
    desktopUpdatePreferencesStore = createDesktopUpdatePreferencesStore(join(app.getPath("userData"), "update-preferences.json"));

    try {
      const runtimeRoot = getRuntimeRoot();
      if (app.isPackaged) {
        await applyPendingDesktopStorageMigration(runtimeRoot);
        await startLocalServices(runtimeRoot);
      }
      await createMainWindow();
      scheduleDesktopUpdateCheck();
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知启动错误。";
      await writeLog("桌面端 错误", message);
      await stopLocalServices();
      serviceShutdownComplete = true;
      dialog.showErrorBox("LFAA 启动失败", `${message}\n\n日志位置：${logFilePath}`);
      app.quit();
    }
  });

  app.on("before-quit", () => {
    desktopAppClosing = true;
    if (updateCheckTimer) {
      clearTimeout(updateCheckTimer);
      updateCheckTimer = null;
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0 && (!app.isPackaged || packagedFrontendUrl)) {
      void createMainWindow();
    }
  });
}
