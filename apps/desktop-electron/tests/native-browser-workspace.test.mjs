import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { NativeBrowserWorkspace, validateNativeBrowserUrl } from "../src/native-browser-workspace.mjs";
import { isTrustedFrontendUrl } from "../src/trusted-frontend.mjs";

class FakeWebContents extends EventEmitter {
  constructor(options) {
    super();
    this.options = options;
    this.url = "about:blank";
    this.destroyed = false;
    this.zoom = 1;
    this.loading = false;
    this.holdLoad = false;
    this.failNextLoad = false;
    this.targetId = `fixture_target_${FakeWebContents.nextTarget++}`;
    let attached = false;
    this.debugger = {
      isAttached: () => attached,
      attach: () => { attached = true; },
      sendCommand: async method => method === "Target.getTargetInfo" ? { targetInfo: { targetId: this.targetId } } : {},
      detach: () => { attached = false; }
    };
  }
  setWindowOpenHandler(handler) { this.windowOpenHandler = handler; }
  loadURL(url) {
    if (this.failNextLoad) { this.failNextLoad = false; throw new Error("fixture load failed"); }
    this.url = url;
    this.loading = true;
    this.emit("did-navigate", {}, url);
    if (this.holdLoad) return new Promise(resolve => { this.finishLoad = () => { this.loading = false; resolve(); }; });
    this.loading = false;
    return Promise.resolve();
  }
  isDestroyed() { return this.destroyed; }
  close() { if (!this.destroyed) { this.destroyed = true; this.emit("destroyed"); } }
  getURL() { return this.url; }
  getTitle() { return this.url === "about:blank" ? "" : "Fixture page"; }
  isLoading() { return this.loading; }
  canGoBack() { return false; }
  canGoForward() { return false; }
  getZoomFactor() { return this.zoom; }
  setZoomFactor(value) { this.zoom = value; }
  stopFindInPage() {}
  findInPage() { return { matches: 0, activeMatch: 0 }; }
  print() {}
  executeJavaScript() { return Promise.resolve({ url: this.url, title: "Fixture page", text: "hello", controls: [] }); }
}
FakeWebContents.nextTarget = 0;

class FakeWebContentsView {
  constructor(options) {
    this.options = options;
    this.webContents = new FakeWebContents(options.webPreferences);
    this.webContents.failNextLoad = FakeWebContentsView.failNextLoad;
    FakeWebContentsView.failNextLoad = false;
    FakeWebContentsView.created.push(this);
  }
  setVisible(value) { this.visibleCalls = (this.visibleCalls ?? 0) + 1; this.visible = value; }
  setBounds(bounds) { this.boundsCalls = (this.boundsCalls ?? 0) + 1; this.bounds = bounds; }
}
FakeWebContentsView.created = [];
FakeWebContentsView.failNextLoad = false;

class FakeDownloadItem extends EventEmitter {
  constructor(filename) { super(); this.filename = filename; this.cancelled = false; }
  getFilename() { return this.filename; }
  getURL() { return "https://example.com/file?token=private"; }
  getSavePath() { return this.savePath ?? ""; }
  cancel() { this.cancelled = true; }
  setSavePath(value) { this.savePath = value; }
}

function createFixture(dialog = {}, options = {}) {
  FakeWebContentsView.created = [];
  FakeWebContents.nextTarget = 0;
  const defaultSession = new EventEmitter();
  defaultSession.setPermissionRequestHandler = handler => { defaultSession.permissionRequestHandler = handler; };
  defaultSession.setPermissionCheckHandler = handler => { defaultSession.permissionCheckHandler = handler; };
  const browserSession = new EventEmitter();
  browserSession.setPermissionRequestHandler = handler => { browserSession.permissionRequestHandler = handler; };
  browserSession.setPermissionCheckHandler = handler => { browserSession.permissionCheckHandler = handler; };
  browserSession.clearStorageData = async () => { browserSession.storageCleared = true; };
  browserSession.clearCache = async () => { browserSession.cacheCleared = true; };
  browserSession.clearAuthCache = async () => { browserSession.authCleared = true; };
  const loadedExtensions = new Map();
  browserSession.extensions = {
    getAllExtensions: () => [...loadedExtensions.values()],
    getExtension: id => loadedExtensions.get(id),
    loadExtension: async path => {
      const manifest = JSON.parse(await readFile(join(path, "manifest.json"), "utf8"));
      const extension = { id: "a".repeat(32), path, name: manifest.name, version: manifest.version, manifest, url: `chrome-extension://${"a".repeat(32)}/` };
      loadedExtensions.set(extension.id, extension);
      return extension;
    },
    removeExtension: id => loadedExtensions.delete(id)
  };
  const session = { defaultSession, fromPartition: partition => { session.partition = partition; return browserSession; } };
  const children = new Set();
  const window = {
    isDestroyed: () => false,
    webContents: { send() {} },
    contentView: {
      addChildView: view => children.add(view),
      removeChildView: view => children.delete(view)
    }
  };
  const nativeDialog = {
    showMessageBox: async () => ({ response: 1 }),
    showSaveDialog: async () => ({ canceled: true }),
    ...dialog
  };
  const workspace = new NativeBrowserWorkspace({ window, WebContentsView: FakeWebContentsView, session, dialog: nativeDialog, ...options });
  return { workspace, session, browserSession, children, nativeDialog, loadedExtensions };
}

test("native browser URLs accept only credential-free HTTP(S)", () => {
  assert.equal(validateNativeBrowserUrl("https://example.com/path"), "https://example.com/path");
  assert.throws(() => validateNativeBrowserUrl("file:///C:/secret.txt"), /HTTP\(S\)/u);
  assert.throws(() => validateNativeBrowserUrl("https://user:pass@example.com"), /HTTP\(S\)/u);
});

test("desktop IPC trust accepts only the configured front-end origin and entry document", () => {
  assert.equal(isTrustedFrontendUrl("http://localhost:3200/work", "http://localhost:3200"), true);
  assert.equal(isTrustedFrontendUrl("http://127.0.0.1:3200/work", "http://localhost:3200"), false);
  assert.equal(isTrustedFrontendUrl("https://attacker.example/", "http://localhost:3200"), false);
  assert.equal(isTrustedFrontendUrl("file:///app/index.html#/work", "file:///app/index.html"), true);
  assert.equal(isTrustedFrontendUrl("file:///other.html", "file:///app/index.html"), false);
});

test("native tabs use an isolated in-memory browser session, expose exact CDP targets, and keep failed pages available for retry", async () => {
  const { workspace, session, children, browserSession } = createFixture();
  const initial = await workspace.createTab("https://example.com");
  const firstView = FakeWebContentsView.created[0];
  assert.equal(session.partition, "lfaa-native-browser-v1");
  assert.equal(firstView.options.webPreferences.session, browserSession);
  assert.equal(session.defaultSession.permissionRequestHandler, undefined);
  assert.equal(initial.tabs[0].targetId, "fixture_target_0");

  workspace.setBounds({ x: -10, y: 7.4, width: 20_000, height: 300 });
  workspace.setVisible(true);
  assert.deepEqual(firstView.bounds, { x: 0, y: 7, width: 16_384, height: 300 });
  assert.equal(firstView.visible, true);
  const boundsCalls = firstView.boundsCalls;
  const visibilityCalls = firstView.visibleCalls;
  workspace.setBounds({ x: -10, y: 7.4, width: 20_000, height: 300 });
  workspace.setVisible(true);
  assert.equal(firstView.boundsCalls, boundsCalls, "reapplying identical native bounds does not schedule Chromium layout work");
  assert.equal(firstView.visibleCalls, visibilityCalls, "reapplying identical visibility does not toggle the native view");

  FakeWebContentsView.failNextLoad = true;
  const failedNavigation = await workspace.createTab("https://bad.example");
  assert.equal(children.size, 2, "网络失败的标签仍留在工作区，可再次导航");
  assert.equal(workspace.tabs.size, 2, "网络失败不丢失标签状态");
  assert.match(failedNavigation.tabs.find(tab => tab.id === failedNavigation.activeTabId).error, /检查网络或网址/u);
  await workspace.navigate(failedNavigation.activeTabId, "https://recovered.example");
  assert.equal(workspace.tabs.get(failedNavigation.activeTabId).error, null, "重新导航清除旧错误状态");

  await workspace.closeTab(initial.activeTabId);
  assert.equal(children.size, 1, "关闭失败标签释放页面视图");
  workspace.dispose();
  assert.equal(children.size, 0);
  assert.equal(browserSession.permissionRequestHandler, null);
  assert.equal(browserSession.permissionCheckHandler, null);
  assert.equal(browserSession.listenerCount("will-download"), 0);
});

test("native browser bounds every tab set", async () => {
  const { workspace } = createFixture();
  for (let index = 0; index < 32; index += 1) await workspace.createTab();
  await assert.rejects(workspace.createTab(), /最多同时打开 32 个/u);
  workspace.dispose();
});

test("native navigation returns after the main document commits while page resources continue", async () => {
  const { workspace } = createFixture();
  const initial = await workspace.createTab();
  const contents = workspace.tabs.get(initial.activeTabId).view.webContents;
  contents.holdLoad = true;
  const snapshot = await workspace.navigate(initial.activeTabId, "https://slow.example/");
  assert.equal(snapshot.tabs[0].url, "https://slow.example/", "the committed URL is available immediately");
  assert.equal(snapshot.tabs[0].loading, true, "the browser reports continued page loading after returning");
  contents.finishLoad();
  assert.equal(contents.isLoading(), false);
  workspace.dispose();
});

test("site permission prompts are scoped, remembered only in memory, and cancelled on dispose", async () => {
  let promptCount = 0;
  const { workspace, browserSession } = createFixture({
    showMessageBox: async () => { promptCount += 1; return { response: 0 }; }
  });
  const answers = [];
  browserSession.permissionRequestHandler({}, "media", allowed => answers.push(allowed), { securityOrigin: "https://example.com" });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(browserSession.permissionCheckHandler({}, "media", "https://example.com", {}), true);
  assert.equal(browserSession.permissionCheckHandler({}, "media", "https://other.example", {}), false);
  browserSession.permissionRequestHandler({}, "media", allowed => answers.push(allowed), { securityOrigin: "https://example.com" });
  assert.deepEqual(answers, [true, true]);
  assert.equal(promptCount, 1);
  workspace.dispose();

  let resolvePrompt;
  const pending = createFixture({ showMessageBox: () => new Promise(resolve => { resolvePrompt = resolve; }) });
  const pendingAnswers = [];
  pending.browserSession.permissionRequestHandler({}, "geolocation", allowed => pendingAnswers.push(allowed), { securityOrigin: "https://example.org" });
  pending.workspace.dispose();
  assert.deepEqual(pendingAnswers, [false]);
  resolvePrompt({ response: 0 });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(pendingAnswers, [false], "关闭期间不会重复回调或保留授权");
});

test("downloads use a sanitized suggestion and are cancelled if the workspace closes", async () => {
  let options;
  const fixture = createFixture({ showSaveDialog: async (_owner, value) => { options = value; return { canceled: false, filePath: "C:\\Users\\test\\report.pdf" }; } });
  const item = new FakeDownloadItem("..\\unsafe:report?.pdf");
  fixture.browserSession.emit("will-download", { preventDefault() {} }, item);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(options.defaultPath.includes("\\"), false);
  assert.equal(options.defaultPath.includes("/"), false);
  assert.equal(item.savePath, "C:\\Users\\test\\report.pdf");
  fixture.workspace.dispose();

  const pending = createFixture({ showSaveDialog: () => new Promise(() => {}) });
  const pendingItem = new FakeDownloadItem("fixture.txt");
  pending.browserSession.emit("will-download", { preventDefault() {} }, pendingItem);
  pending.workspace.dispose();
  assert.equal(pendingItem.cancelled, true);
});

test("browser preferences control website permission decisions and default download behavior", async () => {
  let promptCount = 0;
  let persistedDownloads = [];
  const fixture = createFixture({ showMessageBox: async () => { promptCount += 1; return { response: 0 }; } });
  fixture.workspace.setPreferences({
    askBeforeDownload: false,
    sitePermissionDefaults: { camera: "ask", microphone: "ask", geolocation: "block", notifications: "ask" },
    sitePermissionOverrides: [{ origin: "https://example.com", permission: "camera", decision: "allow" }]
  });
  const denied = [];
  fixture.browserSession.permissionRequestHandler({}, "geolocation", value => denied.push(value), { securityOrigin: "https://example.com" });
  assert.deepEqual(denied, [false], "blocked permission preferences are applied without an extra prompt");
  const allowed = [];
  fixture.browserSession.permissionRequestHandler({}, "media", value => allowed.push(value), { securityOrigin: "https://example.com", mediaTypes: ["video"] });
  assert.deepEqual(allowed, [true], "site exceptions override the account default");
  assert.equal(promptCount, 0);

  fixture.workspace.onDownloadHistoryChange = value => { persistedDownloads = value; };
  fixture.workspace.systemDownloadDirectory = "C:\\Users\\test\\Downloads";
  fixture.workspace.downloadDirectory = fixture.workspace.systemDownloadDirectory;
  const item = new FakeDownloadItem("report.pdf");
  fixture.browserSession.emit("will-download", { preventDefault() {} }, item);
  assert.equal(item.savePath, "C:\\Users\\test\\Downloads/report.pdf");
  assert.equal(fixture.workspace.getDownloadHistory()[0].source, "https://example.com/file", "download history strips query strings");
  item.emit("done", {}, "completed");
  assert.equal(persistedDownloads[0].status, "completed");
  assert.equal(persistedDownloads[0].path, "C:\\Users\\test\\Downloads/report.pdf");
  assert.equal(fixture.workspace.removeDownloadHistory(persistedDownloads[0].id).deleted, true);
  fixture.workspace.dispose();
});

test("clearing browser data clears the session stores and download history", async () => {
  let persistedDownloads = [ { id: "download-1", fileName: "file.txt", source: "https://example.com/file", startedAt: new Date().toISOString(), status: "completed" } ];
  const fixture = createFixture();
  fixture.workspace.onDownloadHistoryChange = value => { persistedDownloads = value; };
  fixture.workspace.downloadHistory = persistedDownloads;
  const result = await fixture.workspace.clearData();
  assert.deepEqual(result, { cleared: true });
  assert.equal(fixture.browserSession.storageCleared, true);
  assert.equal(fixture.browserSession.cacheCleared, true);
  assert.equal(fixture.browserSession.authCleared, true);
  assert.deepEqual(fixture.workspace.getDownloadHistory(), []);
  assert.deepEqual(persistedDownloads, []);
  fixture.workspace.dispose();
});

test("native extension manager loads only a user-confirmed unpacked extension and manages its lifecycle", async () => {
  const root = await mkdtemp(join(tmpdir(), "lfaa-browser-extension-"));
  const extensionPath = join(root, "example-extension");
  await mkdir(extensionPath);
  await writeFile(join(extensionPath, "manifest.json"), JSON.stringify({
    manifest_version: 3, name: "Fixture extension", version: "1.0.0", options_page: "options.html"
  }));
  await writeFile(join(extensionPath, "options.html"), "<!doctype html><title>Options</title>");
  let persisted;
  const fixture = createFixture({
    showOpenDialog: async () => ({ canceled: false, filePaths: [extensionPath] }),
    showMessageBox: async () => ({ response: 0 })
  }, { onBrowserExtensionsChange: value => { persisted = value; } });
  try {
    const afterInstall = await fixture.workspace.chooseBrowserExtension();
    assert.equal(afterInstall.length, 1);
    assert.equal(afterInstall[0].enabled, true);
    assert.equal(afterInstall[0].loaded, true);
    assert.equal(afterInstall[0].configurable, true);
    assert.equal("path" in afterInstall[0], false, "absolute extension paths never cross the renderer IPC boundary");
    assert.equal(persisted[0].path, extensionPath, "the selected unpacked path is persisted by the host");

    const configured = await fixture.workspace.configureBrowserExtension(afterInstall[0].id);
    assert.match(configured.tabs[0].url, /^chrome-extension:\/\//u);
    assert.equal(fixture.workspace.tabs.get(configured.activeTabId).extensionOrigin, `chrome-extension://${afterInstall[0].id}`);

    const disabled = await fixture.workspace.setBrowserExtensionEnabled(afterInstall[0].id, false);
    assert.equal(disabled[0].enabled, false);
    assert.equal(fixture.loadedExtensions.has(afterInstall[0].id), false);
    const enabled = await fixture.workspace.setBrowserExtensionEnabled(afterInstall[0].id, true);
    assert.equal(enabled[0].loaded, true);
    const removed = fixture.workspace.removeBrowserExtension(afterInstall[0].id);
    assert.equal(removed.removed, true);
    assert.deepEqual(removed.extensions, []);
    assert.equal(persisted.length, 0);
  } finally {
    fixture.workspace.dispose();
    await rm(root, { recursive: true, force: true });
  }
});

test("extension restore failures are reported as extension state without corrupting browser tab state", async () => {
  const errors = [];
  const fixture = createFixture({}, {
    extensions: [{ id: "a".repeat(32), path: join(tmpdir(), "missing-lfaa-extension"), name: "Missing extension", version: "1.0.0", enabled: true }],
    onState: state => errors.push(state)
  });
  const result = await fixture.workspace.restoreBrowserExtensions();
  assert.equal(result[0].enabled, false);
  assert.match(result[0].warning, /目录/u);
  assert.equal(result[0].warning.includes(join(tmpdir(), "missing-lfaa-extension")), false, "host error messages do not leak absolute local paths");
  assert.deepEqual(errors, [], "extension warnings do not enter the native browser tab-state contract");
  fixture.workspace.dispose();
});
