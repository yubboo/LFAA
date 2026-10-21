import { randomUUID } from "node:crypto";
import { basename } from "node:path";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const MAX_BOUNDS = 16_384;
const MAX_TABS = 32;
const MAX_PERMISSION_DECISIONS = 256;
const MAX_PENDING_PERMISSIONS = 16;
const MAX_ACTIVE_DOWNLOADS = 8;
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

export class NativeBrowserWorkspace {
  constructor({ window, WebContentsView, session, dialog, onState }) {
    this.window = window;
    this.WebContentsView = WebContentsView;
    this.session = session;
    this.dialog = dialog;
    this.onState = onState;
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
      return key !== "" && this.permissionDecisions.get(key) === true;
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
      item.once("done", () => this.activeDownloads.delete(item));
      const owner = this.window && !this.window.isDestroyed() ? this.window : undefined;
      const defaultPath = basename(String(item.getFilename()).replace(/[<>:"/\\|?*\u0000-\u001f]/gu, "_")).slice(0, 200) || "download";
      void this.dialog.showSaveDialog(owner, {
        title: "保存下载文件",
        defaultPath,
        buttonLabel: "保存"
      }).then(result => {
        if (this.disposed || result.canceled || !result.filePath) {
          item.cancel();
          return;
        }
        item.setSavePath(result.filePath);
      }).catch(() => item.cancel());
    };
    this.browserSession.on("will-download", this.downloadHandler);
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
    const tab = { id, view, error: null, targetId: "" };
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
      if (initialUrl !== "about:blank") await contents.loadURL(initialUrl);
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
      tab.view.setVisible(pageVisible && active);
      if (active) tab.view.setBounds(this.bounds);
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
    try {
      await tab.view.webContents.loadURL(url);
    } catch {
      if (tab.view.webContents.isDestroyed() || this.disposed) throw new Error("浏览器标签在页面加载期间已关闭。");
      tab.error ??= "页面加载失败，请检查网络或网址后重试。";
    }
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
    const owner = this.window && !this.window.isDestroyed() ? this.window : undefined;
    const confirmation = await this.dialog.showMessageBox(owner, {
      type: "warning",
      title: "清除浏览器网站数据",
      message: "清除 LFAA 浏览器中保存的网站登录状态和本地数据？",
      detail: "这会清除 Cookie、缓存、站点存储和本次运行中的网站权限决定；你可能需要重新登录。不会影响系统 Edge/Chrome 的个人资料。",
      buttons: ["取消", "清除数据"],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    });
    if (confirmation.response !== 1) return { cleared: false };
    await Promise.all([
      this.browserSession.clearStorageData(),
      this.browserSession.clearCache(),
      this.browserSession.clearAuthCache()
    ]);
    this.permissionDecisions.clear();
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
