import { randomUUID } from "node:crypto";
import { basename, join } from "node:path";
import { readFile, realpath, stat } from "node:fs/promises";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const MAX_BOUNDS = 16_384;
const MAX_TABS = 32;
const MAX_PERMISSION_DECISIONS = 256;
const MAX_PENDING_PERMISSIONS = 16;
const MAX_ACTIVE_DOWNLOADS = 8;
const MAX_DOWNLOAD_HISTORY = 200;
const BROWSER_SESSION_PARTITION = "lfaa-native-browser-v1";
const PERMISSION_LABELS = new Map([
  ["media", "摄像头或麦克风"], ["geolocation", "位置信息"], ["notifications", "桌面通知"],
  ["midi", "MIDI 设备"], ["midiSysex", "MIDI 系统独占功能"], ["usb", "USB 设备"],
  ["serial", "串口设备"], ["hid", "HID 设备"], ["clipboard-read", "读取剪贴板"],
  ["clipboardRead", "读取剪贴板"],
  ["pointerLock", "锁定鼠标指针"], ["fullscreen", "全屏显示"], ["window-management", "查看屏幕布局"],
  ["local-network", "访问本地网络设备"], ["local-network-access", "访问本地网络设备"], ["loopback-network", "访问本机回环地址"]
]);

function permissionKey(originInput, permission) {
  try {
    const origin = new URL(originInput).origin;
    return origin === "null" ? "" : `${origin}\0${permission}`;
  } catch { return ""; }
}

export function validateNativeBrowserUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("浏览器地址无效。"); }
  if (!ALLOWED_PROTOCOLS.has(url.protocol) || url.username || url.password || url.href.length > 2_048) {
    throw new Error("浏览器只允许不含账号密码的 HTTP(S) 地址。");
  }
  return url.href;
}

function readBounds(value) {
  if (!value || typeof value !== "object") return { x: 0, y: 0, width: 0, height: 0 };
  const read = (key) => {
    const number = Number(value[key]);
    return Number.isFinite(number) ? Math.max(0, Math.min(MAX_BOUNDS, Math.round(number))) : 0;
  };
  return { x: read("x"), y: read("y"), width: read("width"), height: read("height") };
}

function normalizeDownloadUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return `${url.origin}${url.pathname}`.slice(0, 2048);
  } catch { return ""; }
}

function sanitizeDownloadHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-MAX_DOWNLOAD_HISTORY).flatMap(item => {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || typeof item.fileName !== "string"
      || typeof item.startedAt !== "string" || !Number.isFinite(Date.parse(item.startedAt))
      || !["in-progress", "completed", "cancelled", "interrupted"].includes(item.status)) return [];
    return [{
      id: item.id.slice(0, 80), fileName: basename(item.fileName).slice(0, 200),
      source: normalizeDownloadUrl(item.source), startedAt: item.startedAt,
      status: item.status, ...(typeof item.path === "string" ? { path: item.path.slice(0, 2048) } : {})
    }];
  });
}

function sanitizeBrowserExtensions(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.slice(0, 64).flatMap(item => {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || !/^[a-p]{32}$/u.test(item.id)
      || typeof item.path !== "string" || item.path.length > 2_048 || typeof item.name !== "string" || !item.name.trim()
      || typeof item.version !== "string" || typeof item.enabled !== "boolean") return [];
    const path = item.path;
    const key = path.toLocaleLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ id: item.id, path, name: item.name.slice(0, 160), version: item.version.slice(0, 64), enabled: item.enabled }];
  });
}

function permissionKinds(permission, details) {
  if (permission === "media") {
    const mediaTypes = Array.isArray(details?.mediaTypes) ? details.mediaTypes : [];
    return mediaTypes.flatMap(type => type === "video" ? ["camera"] : type === "audio" ? ["microphone"] : []);
  }
  if (permission === "geolocation") return ["geolocation"];
  if (permission === "notifications") return ["notifications"];
  return [];
}

function isBrowserPreferenceSnapshot(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const defaults = value.sitePermissionDefaults;
  return typeof value.askBeforeDownload === "boolean"
    && defaults && typeof defaults === "object" && ["camera", "microphone", "geolocation", "notifications"].every(key => ["ask", "allow", "block"].includes(defaults[key]))
    && Array.isArray(value.sitePermissionOverrides) && value.sitePermissionOverrides.length <= 256;
}

export class NativeBrowserWorkspace {
  constructor({ window, WebContentsView, session, dialog, onState, onDownloadHistoryChange, systemDownloadDirectory, downloadDirectory, downloadHistory = [], onDownloadDirectoryChange, extensions = [], onBrowserExtensionsChange }) {
    this.window = window;
    this.WebContentsView = WebContentsView;
    this.session = session;
    this.dialog = dialog;
    this.onState = onState;
    this.onDownloadHistoryChange = onDownloadHistoryChange;
    this.onDownloadDirectoryChange = onDownloadDirectoryChange;
    this.onBrowserExtensionsChange = onBrowserExtensionsChange;
    this.systemDownloadDirectory = typeof systemDownloadDirectory === "string" ? systemDownloadDirectory : "";
    this.downloadDirectory = typeof downloadDirectory === "string" && downloadDirectory.length <= 2048 ? downloadDirectory : this.systemDownloadDirectory;
    this.downloadHistory = sanitizeDownloadHistory(downloadHistory);
    this.extensionRecords = sanitizeBrowserExtensions(extensions);
    this.loadedExtensions = new Map();
    this.extensionWarnings = new Map();
    this.preferences = {
      askBeforeDownload: true,
      sitePermissionDefaults: { camera: "ask", microphone: "ask", geolocation: "ask", notifications: "ask" },
      sitePermissionOverrides: []
    };
    // 独立的进程内 Session 保存当前运行期间的登录态；不读取或修改应用默认 Session 与系统浏览器 Profile。
    this.browserSession = session.fromPartition(BROWSER_SESSION_PARTITION);
    this.tabs = new Map();
    this.activeTabId = null;
    this.bounds = { x: 0, y: 0, width: 0, height: 0 };
    this.visible = false;
    this.disposed = false;
    this.permissionDecisions = new Map();
    this.pendingPermissionCallbacks = new Set();
    this.activeDownloads = new Set();
    this.installSessionHandlers();
  }

  installSessionHandlers() {
    this.permissionCheckHandler = (_contents, permission, requestingOrigin, details) => {
      const key = permissionKey(details?.securityOrigin || requestingOrigin || details?.requestingUrl || "", permission);
      if (!key) return false;
      if (this.permissionDecisions.has(key)) return this.permissionDecisions.get(key) === true;
      return this.readPermissionDecision(key.split("\0", 1)[0], permission, details) === "allow";
    };
    this.browserSession.setPermissionCheckHandler(this.permissionCheckHandler);

    this.permissionHandler = (_contents, permission, callback, details) => {
      let completed = false;
      const complete = allowed => {
        if (completed) return;
        completed = true;
        this.pendingPermissionCallbacks.delete(complete);
        callback(allowed);
      };
      this.pendingPermissionCallbacks.add(complete);
      if (this.disposed) {
        complete(false);
        return;
      }
      const origin = String(details?.securityOrigin || details?.requestingUrl || "");
      const key = permissionKey(origin, permission);
      if (!key || this.pendingPermissionCallbacks.size > MAX_PENDING_PERMISSIONS || !PERMISSION_LABELS.has(permission)) {
        complete(false);
        return;
      }
      const displayOrigin = key.split("\0", 1)[0];
      if (this.permissionDecisions.has(key)) {
        complete(this.permissionDecisions.get(key));
        return;
      }
      const preference = this.readPermissionDecision(displayOrigin, permission, details);
      if (preference === "allow" || preference === "block") {
        complete(preference === "allow");
        return;
      }
      const owner = this.window && !this.window.isDestroyed() ? this.window : undefined;
      void this.dialog.showMessageBox(owner, {
        type: "question",
        title: "网站权限请求",
        message: `${displayOrigin} 请求访问${PERMISSION_LABELS.get(permission)}。`,
        detail: "允许后仅对当前 LFAA 浏览器运行期间的此网站请求生效。",
        buttons: ["允许", "拒绝"],
        defaultId: 1,
        cancelId: 1,
        noLink: true
      }).then(result => {
        const allowed = result.response === 0;
        if (!this.disposed) {
          if (!this.permissionDecisions.has(key) && this.permissionDecisions.size >= MAX_PERMISSION_DECISIONS) {
            this.permissionDecisions.delete(this.permissionDecisions.keys().next().value);
          }
          this.permissionDecisions.set(key, allowed);
        }
        complete(!this.disposed && allowed);
      }).catch(() => complete(false));
    };
    this.browserSession.setPermissionRequestHandler(this.permissionHandler);

    this.downloadHandler = (event, item) => {
      if (this.disposed || this.activeDownloads.size >= MAX_ACTIVE_DOWNLOADS) {
        event.preventDefault();
        return;
      }
      this.activeDownloads.add(item);
      const id = randomUUID();
      const fileName = basename(String(item.getFilename()).replace(/[<>:"/\\|?*\u0000-\u001f]/gu, "_")).slice(0, 200) || "download";
      const entry = { id, fileName, source: normalizeDownloadUrl(item.getURL()), startedAt: new Date().toISOString(), status: "in-progress" };
      this.downloadHistory.push(entry);
      this.downloadHistory = this.downloadHistory.slice(-MAX_DOWNLOAD_HISTORY);
      this.persistDownloadHistory();
      item.once("done", (_event, state) => {
        this.activeDownloads.delete(item);
        entry.status = state === "completed" ? "completed" : state === "cancelled" ? "cancelled" : "interrupted";
        if (state === "completed") entry.path = item.getSavePath().slice(0, 2048);
        this.persistDownloadHistory();
      });
      const defaultPath = this.downloadDirectory ? `${this.downloadDirectory}/${fileName}` : fileName;
      if (!this.preferences.askBeforeDownload) {
        item.setSavePath(defaultPath);
        return;
      }
      const owner = this.window && !this.window.isDestroyed() ? this.window : undefined;
      void this.dialog.showSaveDialog(owner, { title: "保存下载文件", defaultPath, buttonLabel: "保存" }).then(result => {
        if (this.disposed || result.canceled || !result.filePath) { item.cancel(); return; }
        item.setSavePath(result.filePath);
      }).catch(() => item.cancel());
    };
    this.browserSession.on("will-download", this.downloadHandler);
  }

  readPermissionDecision(origin, permission, details) {
    const kinds = permissionKinds(permission, details);
    if (!kinds.length) return "ask";
    const decisions = kinds.map(kind => {
      const override = this.preferences.sitePermissionOverrides.find(rule => rule.origin === origin && rule.permission === kind);
      return override?.decision ?? this.preferences.sitePermissionDefaults[kind] ?? "ask";
    });
    if (decisions.includes("block")) return "block";
    return decisions.every(decision => decision === "allow") ? "allow" : "ask";
  }

  persistDownloadHistory() {
    this.onDownloadHistoryChange?.(sanitizeDownloadHistory(this.downloadHistory));
    this.publish();
  }

  setPreferences(value) {
    this.assertActive();
    if (!isBrowserPreferenceSnapshot(value)) throw new Error("浏览器权限设置格式无效。");
    const overrides = value.sitePermissionOverrides.flatMap(rule => {
      if (!rule || typeof rule.origin !== "string" || typeof rule.permission !== "string" || !["camera", "microphone", "geolocation", "notifications"].includes(rule.permission) || !["allow", "block"].includes(rule.decision)) return [];
      try { const url = new URL(rule.origin); if ((url.protocol !== "http:" && url.protocol !== "https:") || url.origin !== rule.origin || url.username || url.password) return []; } catch { return []; }
      return [{ origin: rule.origin, permission: rule.permission, decision: rule.decision }];
    });
    this.preferences = {
      askBeforeDownload: value.askBeforeDownload,
      sitePermissionDefaults: { ...value.sitePermissionDefaults },
      sitePermissionOverrides: overrides.slice(0, 256)
    };
    this.permissionDecisions.clear();
    return { applied: true };
  }

  getDownloadSettings() {
    return { directory: this.downloadDirectory || "", systemDirectory: this.systemDownloadDirectory, usingSystemDirectory: this.downloadDirectory === this.systemDownloadDirectory };
  }

  setDownloadDirectory(value) {
    this.assertActive();
    if (typeof value !== "string" || value.length > 2048) throw new Error("下载位置无效。");
    this.downloadDirectory = value;
    this.onDownloadDirectoryChange?.(value);
    return this.getDownloadSettings();
  }

  async chooseDownloadDirectory() {
    this.assertActive();
    const owner = this.window && !this.window.isDestroyed() ? this.window : undefined;
    const result = await this.dialog.showOpenDialog(owner, { title: "选择下载文件夹", properties: ["openDirectory", "createDirectory"] });
    if (result.canceled || !result.filePaths?.[0]) return this.getDownloadSettings();
    return this.setDownloadDirectory(result.filePaths[0]);
  }

  useSystemDownloadDirectory() { return this.setDownloadDirectory(this.systemDownloadDirectory); }

  getDownloadHistory() { return sanitizeDownloadHistory(this.downloadHistory).map(({ path: _path, ...entry }) => entry); }

  clearDownloadHistory() {
    this.downloadHistory = [];
    this.persistDownloadHistory();
    return { cleared: true };
  }

  removeDownloadHistory(id) {
    if (typeof id !== "string" || id.length > 80) throw new Error("下载记录标识无效。");
    const before = this.downloadHistory.length;
    this.downloadHistory = this.downloadHistory.filter(entry => entry.id !== id);
    if (this.downloadHistory.length !== before) this.persistDownloadHistory();
    return { deleted: this.downloadHistory.length !== before };
  }

  async restoreBrowserExtensions() {
    this.assertActive();
    for (const record of this.extensionRecords.filter(item => item.enabled)) {
      try { await this.loadBrowserExtension(record.path, record.id, false); }
      catch (error) {
        record.enabled = false;
        this.extensionWarnings.set(record.id, error instanceof Error ? error.message.slice(0, 180) : "未知错误");
        this.onBrowserExtensionsChange?.(sanitizeBrowserExtensions(this.extensionRecords));
      }
    }
    return this.getBrowserExtensions();
  }

  getBrowserExtensions() {
    return sanitizeBrowserExtensions(this.extensionRecords).map(record => ({
      id: record.id, name: record.name, version: record.version, enabled: record.enabled,
      loaded: this.loadedExtensions.has(record.id), configurable: this.extensionHasOptions(record),
      warning: this.extensionWarnings.get(record.id) ?? null
    }));
  }

  async chooseBrowserExtension() {
    this.assertActive();
    const owner = this.window && !this.window.isDestroyed() ? this.window : undefined;
    const result = await this.dialog.showOpenDialog(owner, { title: "选择已解压的浏览器扩展目录", properties: ["openDirectory"] });
    if (result.canceled || !result.filePaths?.[0]) return this.getBrowserExtensions();
    const selectedPath = await realpath(result.filePaths[0]);
    const directory = await stat(selectedPath);
    if (!directory.isDirectory()) throw new Error("所选路径不是扩展目录。");
    const manifest = await this.readExtensionManifest(selectedPath);
    const samePath = this.extensionRecords.find(item => item.path.toLocaleLowerCase() === selectedPath.toLocaleLowerCase());
    if (samePath && samePath.enabled && this.loadedExtensions.has(samePath.id)) return this.getBrowserExtensions();
    const confirmation = await this.dialog.showMessageBox(owner, {
      type: "warning", title: "安装浏览器扩展", message: `要在 LFAA 内置浏览器安装“${manifest.name}”吗？`,
      detail: "扩展会按它声明的权限访问网站。仅支持已解压扩展；LFAA 使用 Electron 支持的 Chromium 扩展 API 子集。",
      buttons: ["安装扩展", "取消"], defaultId: 1, cancelId: 1, noLink: true
    });
    if (confirmation.response !== 0) return this.getBrowserExtensions();
    const loaded = await this.loadBrowserExtension(selectedPath, samePath?.id ?? "", true);
    const idConflict = this.extensionRecords.find(item => item.id === loaded.id && item.path.toLocaleLowerCase() !== selectedPath.toLocaleLowerCase());
    if (idConflict) {
      if (!samePath) this.browserSession.extensions.removeExtension(loaded.id);
      this.loadedExtensions.delete(loaded.id);
      throw new Error("扩展标识已由另一个目录使用，请先移除旧记录。");
    }
    if (!samePath) this.extensionRecords.push({ id: loaded.id, path: selectedPath, name: loaded.name, version: loaded.version, enabled: true });
    else Object.assign(samePath, { id: loaded.id, name: loaded.name, version: loaded.version, enabled: true });
    this.extensionWarnings.delete(loaded.id);
    this.extensionRecords = sanitizeBrowserExtensions(this.extensionRecords);
    this.persistBrowserExtensions();
    return this.getBrowserExtensions();
  }

  async setBrowserExtensionEnabled(id, enabled) {
    this.assertActive();
    if (typeof id !== "string" || !/^[a-p]{32}$/u.test(id) || typeof enabled !== "boolean") throw new Error("浏览器扩展开关参数无效。");
    const record = this.extensionRecords.find(item => item.id === id);
    if (!record) throw new Error("此浏览器扩展没有登记在 LFAA 中。");
    if (record.enabled === enabled && this.loadedExtensions.has(id) === enabled) return this.getBrowserExtensions();
    if (enabled) {
      const loaded = await this.loadBrowserExtension(record.path, record.id, false);
      Object.assign(record, { id: loaded.id, name: loaded.name, version: loaded.version, enabled: true });
    } else {
      this.browserSession.extensions.removeExtension(id);
      this.loadedExtensions.delete(id);
      record.enabled = false;
    }
    this.extensionRecords = sanitizeBrowserExtensions(this.extensionRecords);
    this.persistBrowserExtensions();
    return this.getBrowserExtensions();
  }

  removeBrowserExtension(id) {
    this.assertActive();
    if (typeof id !== "string" || !/^[a-p]{32}$/u.test(id)) throw new Error("浏览器扩展标识无效。");
    const record = this.extensionRecords.find(item => item.id === id);
    if (!record) return { removed: false, extensions: this.getBrowserExtensions() };
    if (this.loadedExtensions.has(id)) this.browserSession.extensions.removeExtension(id);
    this.loadedExtensions.delete(id);
    this.extensionRecords = this.extensionRecords.filter(item => item.id !== id);
    this.persistBrowserExtensions();
    return { removed: true, extensions: this.getBrowserExtensions() };
  }

  async configureBrowserExtension(id) {
    this.assertActive();
    if (typeof id !== "string" || !/^[a-p]{32}$/u.test(id)) throw new Error("浏览器扩展标识无效。");
    const extension = this.browserSession.extensions?.getExtension?.(id);
    if (!extension) throw new Error("请先启用此扩展，再打开它的设置页面。");
    const manifest = extension.manifest;
    const optionsPage = typeof manifest?.options_ui?.page === "string" ? manifest.options_ui.page
      : typeof manifest?.options_page === "string" ? manifest.options_page : "";
    if (!optionsPage || optionsPage.startsWith("/") || optionsPage.split(/[\\/]/u).some(part => part === "..")) throw new Error("此扩展没有可用的设置页面。");
    const extensionOrigin = `chrome-extension://${extension.id}`;
    const optionsUrl = new URL(optionsPage, `${extensionOrigin}/`);
    if (optionsUrl.protocol !== "chrome-extension:" || optionsUrl.host !== extension.id) throw new Error("扩展设置页面地址不属于该扩展。");
    const state = await this.createTab();
    const tab = this.requireTab(state.activeTabId);
    tab.extensionOrigin = extensionOrigin;
    await tab.view.webContents.loadURL(optionsUrl.href);
    this.publish();
    return this.getState();
  }

  extensionHasOptions(record) {
    const extension = this.browserSession.extensions?.getExtension?.(record.id);
    const manifest = extension?.manifest;
    return typeof manifest?.options_ui?.page === "string" || typeof manifest?.options_page === "string";
  }

  async loadBrowserExtension(path, expectedId, isNew) {
    this.assertActive();
    if (!this.browserSession.extensions || typeof this.browserSession.extensions.loadExtension !== "function") throw new Error("当前 Electron Host 不提供扩展管理接口。");
    let selectedPath;
    try { selectedPath = await realpath(path); }
    catch { throw new Error("扩展目录已不存在或当前账户无权读取。"); }
    const directory = await stat(selectedPath);
    if (!directory.isDirectory()) throw new Error("扩展路径不是目录。");
    const manifest = await this.readExtensionManifest(selectedPath);
    const existing = this.browserSession.extensions.getAllExtensions().find(extension => extension.path.toLocaleLowerCase() === selectedPath.toLocaleLowerCase());
    const extension = existing ?? await this.browserSession.extensions.loadExtension(selectedPath, { allowFileAccess: false });
    if (!extension || typeof extension.id !== "string" || !/^[a-p]{32}$/u.test(extension.id)) throw new Error("Electron 没有返回有效扩展标识。");
    if (expectedId && extension.id !== expectedId) throw new Error("扩展目录对应的标识已变化，请重新添加以核对权限。");
    const loaded = {
      id: extension.id, path: selectedPath, name: String(extension.name || manifest.name).slice(0, 160),
      version: String(extension.version || manifest.version).slice(0, 64)
    };
    this.loadedExtensions.set(loaded.id, loaded);
    if (isNew && !loaded.name) throw new Error("扩展清单缺少有效名称。");
    return loaded;
  }

  async readExtensionManifest(path) {
    let manifest;
    try { manifest = JSON.parse(await readFile(join(path, "manifest.json"), "utf8")); }
    catch { throw new Error("扩展目录缺少有效 manifest.json。"); }
    if (!manifest || typeof manifest !== "object" || ![2, 3].includes(manifest.manifest_version)
      || typeof manifest.name !== "string" || !manifest.name.trim() || manifest.name.length > 160
      || typeof manifest.version !== "string" || manifest.version.length > 64) throw new Error("扩展清单的名称、版本或 Manifest 版本无效。");
    return manifest;
  }

  persistBrowserExtensions() {
    this.onBrowserExtensionsChange?.(sanitizeBrowserExtensions(this.extensionRecords));
    this.publish();
  }

  async createTab(value = "about:blank") {
    this.assertActive();
    if (this.tabs.size >= MAX_TABS) throw new Error(`最多同时打开 ${MAX_TABS} 个浏览器标签页。`);
    const initialUrl = value === "about:blank" ? value : validateNativeBrowserUrl(value);
    const id = randomUUID();
    const view = new this.WebContentsView({
      webPreferences: {
        session: this.browserSession,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });
    const tab = { id, view, error: null, targetId: "", appliedVisible: false, appliedBoundsKey: "" };
    this.tabs.set(id, tab);
    this.window.contentView.addChildView(view);
    view.setVisible(false);
    const contents = view.webContents;
    contents.setWindowOpenHandler(({ url }) => {
      let nextUrl = "";
      try { nextUrl = validateNativeBrowserUrl(url); } catch { return { action: "deny" }; }
      void this.createTab(nextUrl).catch(() => undefined);
      return { action: "deny" };
    });
    const guardNavigation = (event, url) => {
      if (url === "about:blank") return;
      if (tab.extensionOrigin) {
        try {
          const parsed = new URL(url);
          if (parsed.protocol === "chrome-extension:" && `${parsed.protocol}//${parsed.host}` === tab.extensionOrigin) return;
        } catch { /* Continue with normal URL validation. */ }
      }
      try { validateNativeBrowserUrl(url); } catch { event.preventDefault(); }
    };
    contents.on("will-navigate", guardNavigation);
    contents.on("will-redirect", guardNavigation);
    const publish = () => this.publish();
    contents.on("did-start-navigation", (_event, _navigation, _isInPlace, isMainFrame) => {
      if (isMainFrame) tab.error = null;
      publish();
    });
    contents.on("did-navigate", publish);
    contents.on("did-navigate-in-page", publish);
    contents.on("did-stop-loading", publish);
    contents.on("page-title-updated", publish);
    contents.on("did-fail-load", (_event, errorCode, _errorDescription, _validatedUrl, isMainFrame) => {
      if (isMainFrame && errorCode !== -3) tab.error = "页面加载失败，请检查网络或网址后重试。";
      publish();
    });
    contents.on("render-process-gone", () => {
      tab.error = "网页进程已退出，可以刷新后重试。";
      publish();
    });
    contents.on("before-input-event", (event, input) => this.handleShortcut(event, input, id));
    contents.once("destroyed", () => {
      this.tabs.delete(id);
      if (this.activeTabId === id) this.activeTabId = this.tabs.keys().next().value ?? null;
      this.applyLayout();
      this.publish();
    });
    this.activeTabId = id;
    this.applyLayout();
    try {
      tab.targetId = await this.readTargetId(contents);
      if (initialUrl !== "about:blank") await this.navigate(id, initialUrl);
    } catch {
      if (contents.isDestroyed() || this.disposed) {
        this.tabs.delete(id);
        try { this.window.contentView.removeChildView(view); } catch { /* 窗口可能已关闭。 */ }
        if (!contents.isDestroyed()) contents.close();
        if (this.activeTabId === id) this.activeTabId = this.tabs.keys().next().value ?? null;
        this.applyLayout();
        throw new Error("浏览器标签在页面加载期间已关闭。");
      }
      // A reachable browser tab must survive normal network and site failures.
      tab.error ??= "页面加载失败，请检查网络或网址后重试。";
    }
    this.publish();
    return this.getState();
  }

  async readTargetId(contents) {
    const debuggerApi = contents?.debugger;
    if (!debuggerApi || typeof debuggerApi.isAttached !== "function" || typeof debuggerApi.sendCommand !== "function") return "";
    let attachedHere = false;
    try {
      if (!debuggerApi.isAttached()) {
        debuggerApi.attach("1.3");
        attachedHere = true;
      }
      const result = await debuggerApi.sendCommand("Target.getTargetInfo");
      return typeof result?.targetInfo?.targetId === "string" && /^[A-Za-z0-9_-]{1,128}$/u.test(result.targetInfo.targetId)
        ? result.targetInfo.targetId
        : "";
    } catch {
      return "";
    } finally {
      if (attachedHere && debuggerApi.isAttached()) debuggerApi.detach();
    }
  }

  handleShortcut(event, input, tabId) {
    if (input.type !== "keyDown" || !input.control) return;
    const key = input.key?.toLowerCase();
    if (key === "t") { event.preventDefault(); void this.createTab().catch(() => undefined); }
    else if (key === "w") { event.preventDefault(); void this.closeTab(tabId); }
    else if (key === "r") { event.preventDefault(); void this.reload(tabId); }
    else if (key === "f") { event.preventDefault(); this.window.webContents.send("lfaa:native-browser:shortcut", "find"); }
    else if (key === "l") { event.preventDefault(); this.window.webContents.send("lfaa:native-browser:shortcut", "address"); }
    else if (key === "p") { event.preventDefault(); void this.print(tabId); }
    else if (key === "0") { event.preventDefault(); void this.setZoom(tabId, 1); }
    else if (key === "+") { event.preventDefault(); void this.zoomBy(tabId, 0.1); }
    else if (key === "-") { event.preventDefault(); void this.zoomBy(tabId, -0.1); }
  }

  getState() {
    const tabs = [...this.tabs.values()].map(tab => {
      const contents = tab.view.webContents;
      return {
        id: tab.id,
        targetId: tab.targetId,
        title: contents.isDestroyed() ? "已关闭" : contents.getTitle() || "新标签页",
        url: contents.isDestroyed() ? "" : contents.getURL(),
        loading: !contents.isDestroyed() && contents.isLoading(),
        error: tab.error,
        canGoBack: !contents.isDestroyed() && (contents.navigationHistory?.canGoBack() ?? contents.canGoBack()),
        canGoForward: !contents.isDestroyed() && (contents.navigationHistory?.canGoForward() ?? contents.canGoForward()),
        zoomFactor: contents.isDestroyed() ? 1 : contents.getZoomFactor(),
        active: tab.id === this.activeTabId
      };
    });
    return { tabs, activeTabId: this.activeTabId, visible: this.visible };
  }

  publish() {
    if (!this.disposed) this.onState?.(this.getState());
  }

  setBounds(value) {
    this.assertActive();
    this.bounds = readBounds(value);
    this.applyLayout();
  }

  setVisible(value) {
    this.assertActive();
    if (typeof value !== "boolean") throw new TypeError("浏览器页面显示状态无效。");
    this.visible = value;
    this.applyLayout();
  }

  applyLayout() {
    const pageVisible = this.visible && this.bounds.width > 0 && this.bounds.height > 0;
    for (const tab of this.tabs.values()) {
      const active = tab.id === this.activeTabId;
      const visible = pageVisible && active;
      if (tab.appliedVisible !== visible) {
        tab.view.setVisible(visible);
        tab.appliedVisible = visible;
      }
      if (active) {
        const boundsKey = `${this.bounds.x}:${this.bounds.y}:${this.bounds.width}:${this.bounds.height}`;
        if (tab.appliedBoundsKey !== boundsKey) {
          tab.view.setBounds(this.bounds);
          tab.appliedBoundsKey = boundsKey;
        }
      }
    }
  }

  async ensureTab() {
    this.assertActive();
    if (!this.tabs.size) return this.createTab();
    if (!this.activeTabId || !this.tabs.has(this.activeTabId)) this.activeTabId = this.tabs.keys().next().value;
    this.applyLayout();
    return this.getState();
  }

  async selectTab(id) {
    this.assertActive();
    if (!this.tabs.has(id)) throw new Error("浏览器标签已关闭或不存在。");
    this.activeTabId = id;
    this.applyLayout();
    this.publish();
    return this.getState();
  }

  async closeTab(id) {
    this.assertActive();
    const tab = this.tabs.get(id);
    if (!tab) return this.getState();
    if (this.tabs.size === 1) return this.navigate(id, "about:blank");
    this.tabs.delete(id);
    this.window.contentView.removeChildView(tab.view);
    if (!tab.view.webContents.isDestroyed()) tab.view.webContents.close();
    if (this.activeTabId === id) this.activeTabId = this.tabs.keys().next().value ?? null;
    this.applyLayout();
    this.publish();
    return this.getState();
  }

  async navigate(id, value) {
    this.assertActive();
    const url = value === "about:blank" ? value : validateNativeBrowserUrl(value);
    const tab = this.requireTab(id);
    this.activeTabId = id;
    tab.error = null;
    this.applyLayout();
    const contents = tab.view.webContents;
    tab.navigationFinish?.();
    const navigationToken = Symbol("native-browser-navigation");
    tab.navigationToken = navigationToken;
    const expectedUrls = new Set([url]);
    let finishNavigation = () => undefined;
    const committed = new Promise(resolve => {
      let settled = false;
      const cleanup = () => {
        contents.off("did-navigate", onNavigate);
        contents.off("will-redirect", onRedirect);
        contents.off("did-fail-load", onFailure);
        contents.off("render-process-gone", onProcessGone);
        contents.off("destroyed", onDestroyed);
        if (tab.navigationToken === navigationToken) {
          tab.navigationToken = null;
          tab.navigationFinish = null;
        }
      };
      const finish = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };
      const onNavigate = (_event, committedUrl) => {
        if (tab.navigationToken === navigationToken && expectedUrls.has(committedUrl)) finish();
      };
      const onRedirect = (_event, redirectedUrl, _isInPlace, isMainFrame) => {
        if (isMainFrame && tab.navigationToken === navigationToken) expectedUrls.add(redirectedUrl);
      };
      const onFailure = (_event, errorCode, _description, failedUrl, isMainFrame) => {
        if (isMainFrame && expectedUrls.has(failedUrl)) finish();
      };
      const onProcessGone = () => finish();
      const onDestroyed = () => finish();
      finishNavigation = finish;
      tab.navigationFinish = finish;
      contents.on("did-navigate", onNavigate);
      contents.on("will-redirect", onRedirect);
      contents.on("did-fail-load", onFailure);
      contents.once("render-process-gone", onProcessGone);
      contents.once("destroyed", onDestroyed);
    });
    try {
      void Promise.resolve(contents.loadURL(url)).catch(() => {
        if (tab.navigationToken === navigationToken) {
          tab.error ??= "页面加载失败，请检查网络或网址后重试。";
          this.publish();
        }
        finishNavigation();
      });
    } catch {
      tab.error ??= "页面加载失败，请检查网络或网址后重试。";
      finishNavigation();
    }
    await committed;
    this.publish();
    return this.getState();
  }

  back(id) { const contents = this.requireTab(id).view.webContents; const history = contents.navigationHistory; if (history ? history.canGoBack() : contents.canGoBack()) { if (history) history.goBack(); else contents.goBack(); } return this.getState(); }
  forward(id) { const contents = this.requireTab(id).view.webContents; const history = contents.navigationHistory; if (history ? history.canGoForward() : contents.canGoForward()) { if (history) history.goForward(); else contents.goForward(); } return this.getState(); }
  reload(id) { this.requireTab(id).view.webContents.reload(); return this.getState(); }
  stop(id) { this.requireTab(id).view.webContents.stop(); return this.getState(); }
  print(id) { this.requireTab(id).view.webContents.print(); }
  copyAddress(id) { return this.requireTab(id).view.webContents.getURL(); }
  find(id, text, forward = true) {
    if (typeof text !== "string" || text.length > 512) throw new Error("查找内容超出长度限制。");
    if (!text) { this.requireTab(id).view.webContents.stopFindInPage("clearSelection"); return { matches: 0, activeMatch: 0 }; }
    return this.requireTab(id).view.webContents.findInPage(text, { forward: Boolean(forward), matchCase: false });
  }
  async inspect(id) {
    const contents = this.requireTab(id).view.webContents;
    if (contents.isLoading()) throw new Error("页面尚在加载，请稍后查看。");
    const script = `(() => {
      const visible = element => { const rect = element.getBoundingClientRect(); return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== "hidden"; };
      const label = element => (element.getAttribute("aria-label") || element.getAttribute("title") || element.innerText || element.getAttribute("alt") || "").trim().replace(/\\s+/g, " ").slice(0, 160);
      const controls = [...document.querySelectorAll('a,button,input,textarea,select,[role="button"],[role="link"],[role="textbox"]')]
        .filter(visible).slice(0, 100).map(element => ({
          role: element.getAttribute("role") || ({ A: "link", BUTTON: "button", INPUT: "textbox", TEXTAREA: "textbox", SELECT: "combobox" }[element.tagName] || "element"),
          name: label(element), type: element.getAttribute("type") || "",
          disabled: Boolean(element.disabled || element.getAttribute("aria-disabled") === "true")
        }));
      return { url: location.href.slice(0, 2048), title: document.title.slice(0, 500), text: (document.body?.innerText || "").slice(0, 16000), controls };
    })()`;
    const result = await contents.executeJavaScript(script, true);
    return {
      url: typeof result?.url === "string" ? result.url.slice(0, 2048) : contents.getURL(),
      title: typeof result?.title === "string" ? result.title.slice(0, 500) : contents.getTitle(),
      text: typeof result?.text === "string" ? result.text.slice(0, 16_000) : "",
      controls: Array.isArray(result?.controls) ? result.controls.slice(0, 100).map(item => ({
        role: String(item?.role ?? "element").slice(0, 32), name: String(item?.name ?? "").slice(0, 160),
        type: String(item?.type ?? "").slice(0, 32), disabled: item?.disabled === true
      })) : []
    };
  }
  async clearData() {
    this.assertActive();
    await Promise.all([
      this.browserSession.clearStorageData(),
      this.browserSession.clearCache(),
      this.browserSession.clearAuthCache()
    ]);
    this.permissionDecisions.clear();
    this.clearDownloadHistory();
    this.publish();
    return { cleared: true };
  }
  stopFind(id) { this.requireTab(id).view.webContents.stopFindInPage("clearSelection"); }
  setZoom(id, value) {
    const zoom = Number(value);
    if (!Number.isFinite(zoom) || zoom < 0.5 || zoom > 2) throw new Error("网页缩放范围为 50% 到 200%。");
    this.requireTab(id).view.webContents.setZoomFactor(zoom);
    this.publish();
    return this.getState();
  }
  zoomBy(id, change) {
    const contents = this.requireTab(id).view.webContents;
    return this.setZoom(id, Math.max(0.5, Math.min(2, Math.round((contents.getZoomFactor() + change) * 10) / 10)));
  }

  requireTab(id) {
    this.assertActive();
    const tab = this.tabs.get(id);
    if (!tab || tab.view.webContents.isDestroyed()) throw new Error("浏览器标签已关闭或不存在。");
    return tab;
  }

  assertActive() {
    if (this.disposed || !this.window || this.window.isDestroyed()) throw new Error("LFAA 浏览器工作区当前不可用。");
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const tab of this.tabs.values()) {
      try { this.window.contentView.removeChildView(tab.view); } catch { /* 窗口可能已关闭。 */ }
      if (!tab.view.webContents.isDestroyed()) tab.view.webContents.close();
    }
    this.tabs.clear();
    this.permissionDecisions.clear();
    for (const complete of this.pendingPermissionCallbacks) complete(false);
    for (const item of this.activeDownloads) {
      try { item.cancel(); } catch { /* 下载可能已经结束。 */ }
    }
    this.activeDownloads.clear();
    this.browserSession.removeListener("will-download", this.downloadHandler);
    this.browserSession.setPermissionCheckHandler(null);
    this.browserSession.setPermissionRequestHandler(null);
  }
}
