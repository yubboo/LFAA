import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createServer } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { isolateData } from "./isolated-data.mjs";

isolateData(test, "browser-use");
const { BrowserSessionManager } = await import("lfaa-browser-use/src/session-manager.js");
const { BUILTIN_BROWSER_WORKSPACE_ID } = await import("lfaa-util-values/src/browser-provider.js");
const { database } = await import("lfaa-storage-sqlite/src/database.js");

function makePage(state = {}) {
  let currentUrl = state.url ?? "about:blank";
  const listeners = new Map();
  return {
    isClosed: () => false,
    url: () => currentUrl,
    title: async () => state.title ?? "Example",
    viewportSize: () => state.viewport ?? ({ width: 1280, height: 800 }),
    setViewportSize: async viewport => { state.viewport = { ...viewport }; },
    evaluate: async () => ({
      loading: (state.readyState ?? "complete") === "loading",
      hasRenderableContent: state.hasRenderableContent ?? true,
      viewport: state.viewport ?? { width: 1280, height: 800 }
    }),
    screenshot: async options => {
      state.screenshotOptions = [...(state.screenshotOptions ?? []), options];
      return state.screenshot ?? Buffer.from("jpeg");
    },
    on(event, listener) {
      const eventListeners = listeners.get(event) ?? new Set();
      eventListeners.add(listener);
      listeners.set(event, eventListeners);
    },
    once(event, listener) {
      const wrapped = (...args) => { listeners.get(event)?.delete(wrapped); listener(...args); };
      this.on(event, wrapped);
    },
    off(event, listener) { listeners.get(event)?.delete(listener); },
    emit(event, ...args) { for (const listener of listeners.get(event) ?? []) listener(...args); },
    locator(selector) {
      if (selector === "body") return { innerText: async () => { state.pageTextReads = (state.pageTextReads ?? 0) + 1; return state.pageText ?? "body"; } };
      return { evaluateAll: async (_map, limit) => { state.controlReads = (state.controlReads ?? 0) + 1; return (state.controls ?? []).slice(0, limit); } };
    },
    getByRole() { return { count: async () => state.roleCount ?? 1, first: () => ({ click: async () => undefined }), nth: index => ({ click: async () => { state.clickedOccurrence = index; } }) }; },
    mouse: {
      click: async () => undefined,
      move: async () => undefined,
      down: async () => undefined,
      up: async () => undefined,
      wheel: async () => undefined
    },
    async goto(url, options) {
      state.gotoOptions = options;
      state.started?.();
      if (state.waitUntilClosed) await new Promise((resolve, reject) => {
        state.release = resolve;
        state.reject = reject;
      });
      currentUrl = url;
      for (const listener of listeners.get("domcontentloaded") ?? []) listener();
    },
    state
  };
}

function makeBrowser(optionsLog = []) {
  const contexts = [];
  return {
    contexts,
    async newContext(options) {
      optionsLog.push(options);
      const pages = [];
      const page = makePage();
      pages.push(page);
      const context = {
        pages: () => pages,
        newCDPSession: async () => {
          const client = new EventEmitter();
          client.send = async method => {
            page.state.cdpCalls = [...(page.state.cdpCalls ?? []), method];
            if (method === "Page.stopLoading") {
              page.state.stopLoadingCalls = (page.state.stopLoadingCalls ?? 0) + 1;
              page.state.waitUntilClosed = false;
              page.state.release?.();
            }
            if (method === "Page.startScreencast") setImmediate(() => client.emit("Page.screencastFrame", { data: "/9j/2Q==", sessionId: 7, metadata: { deviceWidth: 640, deviceHeight: 480 } }));
            return {};
          };
          client.detach = async () => { page.state.cdpDetachCount = (page.state.cdpDetachCount ?? 0) + 1; };
          return client;
        },
        newPage: async () => page,
        exposeBinding: async (_name, callback) => {
          page.state.exposedBindings = [...(page.state.exposedBindings ?? []), callback];
        },
        addInitScript: async () => undefined,
        route: async () => undefined,
        on: () => undefined,
        async close() {
          page.state.release?.();
          page.state.reject?.(new Error("context closed"));
        }
      };
      contexts.push(context);
      return context;
    },
    async close() {}
  };
}

function useFakeEdge(manager, browser) {
  manager.channels = [{ id: "lfaa-managed-edge", name: "Fake Edge", channel: "msedge", paths: [process.execPath] }];
  manager.getBrowser = async () => browser;
}

function makeNativeBrowser() {
  const context = new EventEmitter();
  const pages = [];
  context.pages = () => [...pages];
  context.newCDPSession = async page => ({
    send: async method => method === "Target.getTargetInfo" ? { targetInfo: { targetId: page.targetId } } : {},
    detach: async () => undefined
  });
  context.closeCount = 0;
  context.close = async () => { context.closeCount += 1; };
  const addPage = (targetId, url, title, text) => {
    const page = new EventEmitter();
    page.targetId = targetId;
    page.isClosed = () => false;
    page.url = () => url;
    page.title = async () => title;
    page.context = () => context;
    page.mainFrame = () => ({ page });
    page.evaluate = async () => ({ loading: false, hasRenderableContent: true });
    page.locator = selector => selector === "body"
      ? { innerText: async () => text }
      : { evaluateAll: async () => [] };
    pages.push(page);
    return page;
  };
  const appPage = addPage("target-app", "http://localhost:3000/work", "LFAA", "app shell");
  const nativePage = addPage("target-native", "https://example.com/", "Example", "native page");
  const browser = { contexts: () => [context], close: async () => undefined };
  return { browser, context, appPage, nativePage };
}

test("native Browser Owner binds only the selected non-app Target to its authenticated LFAA session", async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), "lfaa-native-browser-test-"));
  const portFile = join(tempDirectory, "DevToolsActivePort");
  const previousPortFile = process.env.LFAA_ELECTRON_CDP_PORT_FILE;
  const previousAppOrigin = process.env.LFAA_ELECTRON_BROWSER_APP_ORIGIN;
  await writeFile(portFile, "43210\n/devtools/browser/test\n", "utf8");
  process.env.LFAA_ELECTRON_CDP_PORT_FILE = portFile;
  process.env.LFAA_ELECTRON_BROWSER_APP_ORIGIN = "http://localhost:3000";

  const manager = new BrowserSessionManager(true, undefined, { headless: true });
  const { browser, context, appPage, nativePage } = makeNativeBrowser();
  manager.getBrowser = async channel => {
    assert.equal(channel, "native");
    return browser;
  };
  try {
    await manager.setNativeActiveTarget("user-a", "session-a", "target-app");
    await assert.rejects(manager.observeForRun("user-a", "session-a", "lfaa-native-browser"), /当前活动的原生浏览器标签尚未出现在 Chromium 中/u);
    assert.equal(appPage.listenerCount("framenavigated"), 0, "LFAA app pages are never exposed as native browser targets");

    await manager.setNativeActiveTarget("user-a", "session-a", "target-native");
    const snapshot = await manager.observeForRun("user-a", "session-a", "lfaa-native-browser");
    assert.equal(snapshot.url, "https://example.com/");
    assert.equal(snapshot.pageText, "native page");
    assert.equal(snapshot.screenshot, null, "native pages are observed without a screenshot interaction surface");
    assert.equal(nativePage.listenerCount("framenavigated"), 1);
    assert.equal(snapshot.tabs.length, 1, "the LFAA app page is not included in the Agent's native browser tab snapshot");
    assert.equal(appPage.listenerCount("framenavigated"), 0, "the LFAA app page is not tracked as a browser tab");
    await assert.rejects(manager.observeForRun("user-b", "session-a", "lfaa-native-browser"), /请在浏览器工作区选择要交给 Agent 操作的标签页/u);
    await assert.rejects(manager.setNativeActiveTarget("user-a", "session-a", "missing-target"), /当前活动的原生浏览器标签尚未出现在 Chromium 中/u);

    const afterRejectedTarget = await manager.getPanelSnapshot("user-a", "session-a", "lfaa-native-browser", false);
    assert.equal(afterRejectedTarget?.url, "https://example.com/", "a rejected Target cannot replace the active page");
  } finally {
    try {
      await manager.closeAll();
      assert.equal(context.closeCount, 0, "Browser Owner must not close Electron's shared native context");
    } finally {
      if (previousPortFile === undefined) delete process.env.LFAA_ELECTRON_CDP_PORT_FILE;
      else process.env.LFAA_ELECTRON_CDP_PORT_FILE = previousPortFile;
      if (previousAppOrigin === undefined) delete process.env.LFAA_ELECTRON_BROWSER_APP_ORIGIN;
      else process.env.LFAA_ELECTRON_BROWSER_APP_ORIGIN = previousAppOrigin;
      await rm(tempDirectory, { recursive: true, force: true });
    }
  }
});

test("Browser Owner enforces isolated account/session contexts and strict navigation URLs", async () => {
  const manager = new BrowserSessionManager(true, undefined, { headless: true });
  const contextOptions = [];
  const browser = makeBrowser(contextOptions);
  useFakeEdge(manager, browser);
  try {
    const first = await manager.navigate("user-a", "session-a", "lfaa-managed-edge", "http://127.0.0.1:3000/api/health");
    const sameSession = await manager.navigate("user-a", "session-a", "lfaa-managed-edge", "http://127.0.0.1:3000/api/health");
    await manager.navigate("user-a", "session-b", "lfaa-managed-edge", "http://127.0.0.1:3000/api/health");
    await manager.navigate("user-b", "session-a", "lfaa-managed-edge", "http://127.0.0.1:3000/api/health");

    assert.equal(first.sessionId, sameSession.sessionId, "one LFAA account/session shares one preview context");
    assert.equal(browser.contexts.length, 3, "another session or account receives a separate context");
    assert.equal(contextOptions[0].serviceWorkers, "block");
    assert.equal(contextOptions[0].viewport.width, 1280);
    assert.equal(Object.hasOwn(contextOptions[0], "storageState"), false, "personal cookies/profile state are never imported");

    for (const url of ["file:///etc/passwd", "javascript:alert(1)", "https://user:secret@example.test", `https://example.test/${"a".repeat(2050)}`]) {
      await assert.rejects(manager.navigate("user-a", "invalid-session", "lfaa-managed-edge", url), /HTTP\(S\)|HTTP 或 HTTPS/u);
    }
  } finally {
    await manager.closeAll();
  }
});

test("Browser Owner coalesces concurrent navigation so one account/session owns one real Page", async () => {
  const manager = new BrowserSessionManager(true, undefined, { headless: true });
  const browser = makeBrowser();
  useFakeEdge(manager, browser);
  try {
    const [first, concurrent] = await Promise.all([
      manager.navigate("user-a", "session-a", "lfaa-managed-edge", "http://127.0.0.1:3000/api/health"),
      manager.navigate("user-a", "session-a", "lfaa-managed-edge", "http://127.0.0.1:3000/api/health")
    ]);
    assert.equal(browser.contexts.length, 1, "concurrent Dock/Agent startup opens one isolated BrowserContext");
    assert.equal(first.sessionId, concurrent.sessionId, "both callers bind to the same Browser Owner session");
    assert.equal(browser.contexts[0].pages().length, 1, "both callers share one actual Page");
  } finally {
    await manager.closeAll();
  }
});

test("Browser Dock waiting on an empty workspace sees the Page created by Agent", async () => {
  const manager = new BrowserSessionManager(true, undefined, { headless: true });
  const browser = makeBrowser();
  useFakeEdge(manager, browser);
  try {
    const controller = new AbortController();
    const cancelled = manager.waitForPanelRevision("user-a", BUILTIN_BROWSER_WORKSPACE_ID, "lfaa-managed-edge", 0, controller.signal);
    controller.abort();
    await assert.rejects(cancelled, /已取消/u);
    assert.equal(manager.sessionCreationWaiters.size, 0, "cancelled empty-Dock wait releases its listener");
    const waiting = manager.waitForPanelRevision("user-a", BUILTIN_BROWSER_WORKSPACE_ID, "lfaa-managed-edge", 0);
    assert.equal(manager.sessionCreationWaiters.size, 1, "empty Dock keeps one cancellable creation waiter");
    await manager.navigate("user-a", BUILTIN_BROWSER_WORKSPACE_ID, "lfaa-managed-edge", "http://127.0.0.1:3000/api/health");
    assert.ok(await waiting, "the waiting Dock receives the new browser session");
    assert.equal(manager.sessionCreationWaiters.size, 0, "creation notification releases the waiter");
  } finally {
    await manager.closeAll();
  }
});

test("real Chromium lets Agent operate the page already opened in LFAA browser", async t => {
  const manager = new BrowserSessionManager(true, () => false, { headless: true });
  const provider = manager.listProviders().find(item => item.id === "lfaa-managed-edge" && item.available);
  if (!provider) { await manager.closeAll(); t.skip("Microsoft Edge is unavailable on this host"); return; }
  const server = createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end('<!doctype html><html><head><title>Browser handoff</title></head><body><button id="first">同名</button><button id="second">同名</button><label>姓名 <input id="name"></label><output id="result">尚未操作</output><script>document.querySelector("#first").onclick=()=>document.querySelector("#result").textContent="第一个按钮";document.querySelector("#second").onclick=()=>document.querySelector("#result").textContent="第二个按钮";document.querySelector("#name").oninput=e=>document.querySelector("#result").textContent="输入:"+e.target.value;</script></body></html>');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}/`;
  const controller = new AbortController();
  const cleanups = [];
  try {
    const manual = await manager.navigate("user-a", BUILTIN_BROWSER_WORKSPACE_ID, "lfaa-managed-edge", url, undefined, true, false);
    const agent = manager.createRunAdapter({ ownerId: "user-a", sourceSessionId: "unrelated-ai-chat", runId: "handoff-run", signal: controller.signal, onRunDispose: cleanup => cleanups.push(cleanup) });
    const observed = await agent.observe("lfaa-managed-edge");
    assert.equal(observed.sessionId, manual.sessionId, "Agent observes the manually opened Page rather than a new browser");
    assert.deepEqual(observed.controls.filter(control => control.name === "同名").map(control => control.occurrence), [0, 1]);
    assert.ok(observed.controls.some(control => control.name === "姓名" && control.role === "textbox"), "linked label appears in Agent snapshot");
    await assert.rejects(agent.click("lfaa-managed-edge", "button", "同名"), /多个同名控件/u);
    const clicked = await agent.click("lfaa-managed-edge", "button", "同名", 1);
    assert.match(clicked.pageText, /第二个按钮/u);
    const filled = await agent.fill("lfaa-managed-edge", "姓名", "LFAA");
    assert.match(filled.pageText, /输入:LFAA/u);
  } finally {
    controller.abort();
    for (const cleanup of cleanups) cleanup();
    await manager.closeAll();
    await new Promise(resolve => server.close(resolve));
  }
});

test("Browser Dock streams Chromium compositor frames and releases its CDP subscription on disconnect", async () => {
  const manager = new BrowserSessionManager(true, undefined, { headless: true });
  const browser = makeBrowser();
  useFakeEdge(manager, browser);
  const controller = new AbortController();
  const frames = [];
  try {
    await manager.navigate("user-a", "session-a", "lfaa-managed-edge", "http://127.0.0.1:3000/api/health");
    await manager.streamDockFrames("user-a", "session-a", "lfaa-managed-edge", controller.signal, async frame => {
      frames.push(frame);
      controller.abort();
    });
    assert.deepEqual(frames, [{ dataBase64: "/9j/2Q==", width: 640, height: 480 }], "the Dock receives the current page's compositor frame");
    assert.deepEqual(browser.contexts[0].pages()[0].state.cdpCalls, ["Page.startScreencast", "Page.screencastFrameAck", "Page.stopScreencast"], "each delivered frame is acknowledged and the compositor stream is stopped");
    assert.equal(browser.contexts[0].pages()[0].state.cdpDetachCount, 1, "disconnect releases the page-scoped CDP session");
  } finally {
    controller.abort();
    await manager.closeAll();
  }
});

test("Browser Dock resizes the real Page viewport to the embedded container without taking a screenshot", async () => {
  const manager = new BrowserSessionManager(true, undefined, { headless: true });
  const browser = makeBrowser();
  useFakeEdge(manager, browser);
  try {
    await manager.navigate("user-a", "session-a", "lfaa-managed-edge", "http://127.0.0.1:3000/api/health");
    const screenshotCountBeforeResize = browser.contexts[0].pages()[0].state.screenshotOptions.length;
    const resized = await manager.resizeViewport("user-a", "session-a", "lfaa-managed-edge", 560, 920, undefined, false);
    assert.deepEqual(browser.contexts[0].pages()[0].state.viewport, { width: 560, height: 920 }, "the Chromium viewport follows the right Dock's tall layout");
    assert.deepEqual(resized.viewport, { width: 560, height: 920 });
    assert.equal(resized.screenshot, null, "resizing does not create a parallel static screenshot");
    assert.equal(browser.contexts[0].pages()[0].state.screenshotOptions.length, screenshotCountBeforeResize, "resize uses the compositor stream without invoking another page.screenshot");
  } finally {
    await manager.closeAll();
  }
});

test("Browser Run adapter is account/session/run bound and released with the Run", async () => {
  const manager = new BrowserSessionManager(true, undefined, { headless: true });
  const browser = makeBrowser();
  useFakeEdge(manager, browser);
  const controllerA = new AbortController();
  const controllerB = new AbortController();
  const controllerOther = new AbortController();
  const cleanupsA = [];
  const cleanupsB = [];
  const cleanupsOther = [];
  const bindingA = { ownerId: "user-a", sourceSessionId: "session-a", runId: "run-a", signal: controllerA.signal, onRunDispose: cleanup => cleanupsA.push(cleanup) };
  try {
    const runA = manager.createRunAdapter(bindingA);
    const sameRun = manager.createRunAdapter({ ...bindingA, onRunDispose: cleanup => cleanupsA.push(cleanup) });
    const nextRun = manager.createRunAdapter({ ...bindingA, runId: "run-b", signal: controllerB.signal, onRunDispose: cleanup => cleanupsB.push(cleanup) });
    const otherAccount = manager.createRunAdapter({ ...bindingA, ownerId: "user-b", signal: controllerOther.signal, onRunDispose: cleanup => cleanupsOther.push(cleanup) });

    assert.strictEqual(sameRun, runA, "the same account/session/Run reuses one adapter");
    assert.notStrictEqual(nextRun, runA, "a separate Agent Run receives its own adapter");
    assert.notStrictEqual(otherAccount, runA, "another account receives a separate adapter");
    assert.deepEqual(Object.keys(runA).sort(), ["claimTab", "click", "executeWebsiteTool", "fill", "getWebsiteTools", "listTabs", "navigate", "navigateProjectPreview", "observe", "pressKey", "runId", "scroll", "sendCdpCommand"], "the adapter exposes bounded page actions plus separately gated WebMCP and CDP calls");

    const manualPage = await manager.navigate("user-a", BUILTIN_BROWSER_WORKSPACE_ID, "lfaa-managed-edge", "http://127.0.0.1:3000/api/health");
    assert.equal(manager.listProviders("user-a").find(provider => provider.id === "lfaa-managed-edge")?.activeInWorkspace, true, "provider directory identifies the manually opened browser for Agent selection");
    assert.equal(manager.listProviders("user-b").find(provider => provider.id === "lfaa-managed-edge")?.activeInWorkspace, false, "another account cannot see this workspace as active");
    const manualScreenshotCount = browser.contexts[0].pages()[0].state.screenshotOptions?.length ?? 0;
    const pageA = await runA.navigate("lfaa-managed-edge", "http://127.0.0.1:3000/api/health");
    const pageNextRun = await nextRun.navigate("lfaa-managed-edge", "http://127.0.0.1:3000/api/health");
    const pageOtherAccount = await otherAccount.navigate("lfaa-managed-edge", "http://127.0.0.1:3000/api/health");
    const sharedPage = browser.contexts[0].pages()[0];
    assert.equal(pageA.sessionId, manualPage.sessionId, "Agent connects to the browser page already opened manually");
    assert.equal(pageA.sessionId, pageNextRun.sessionId, "Browser Session remains shared across Runs in the same LFAA session");
    assert.notEqual(pageA.sessionId, pageOtherAccount.sessionId, "Browser Session stays isolated by account");
    assert.equal(browser.contexts.length, 2);
    assert.equal(pageA.screenshot, null, "Agent navigation returns structured page data without capturing a screenshot");
    assert.equal(sharedPage.state.screenshotOptions?.length ?? 0, manualScreenshotCount, "Agent navigation skips the expensive screenshot path");
    assert.equal(cleanupsA.length, 1, "the Run registers only one cleanup callback");

    cleanupsA[0]();
    assert.throws(() => runA.observe("lfaa-managed-edge"), /Run.*浏览器桥接已结束/u);
    const observed = await nextRun.observe("lfaa-managed-edge");
    assert.match(observed.pageText, /body/u, "disposing one Run leaves the Session context available to another Run");
    assert.equal(observed.screenshot, null, "Agent observation stays structured JSON rather than returning an image");
    assert.equal(sharedPage.state.screenshotOptions?.length ?? 0, manualScreenshotCount, "Agent observation does not capture an image");
    const clicked = await nextRun.click("lfaa-managed-edge", "button", "Continue");
    assert.equal(clicked.screenshot, null, "Agent actions return structured state without blocking on a screenshot");
    assert.equal(sharedPage.state.screenshotOptions?.length ?? 0, manualScreenshotCount, "Agent click skips screenshot capture too");
    sharedPage.state.roleCount = 2;
    await assert.rejects(nextRun.click("lfaa-managed-edge", "button", "Continue"), /多个同名控件/u, "Agent must not silently click the first ambiguous control");
    await nextRun.click("lfaa-managed-edge", "button", "Continue", 1);
    assert.equal(sharedPage.state.clickedOccurrence, 1, "Agent can target the occurrence reported by its page observation");
    const replacement = manager.createRunAdapter({ ...bindingA, signal: new AbortController().signal, onRunDispose: cleanup => cleanupsA.push(cleanup) });
    assert.notStrictEqual(replacement, runA, "disposed bridge registration is removed");
  } finally {
    await manager.closeAll();
  }
});

test("full CDP requires the browser, developer, and full-access settings and excludes personal browser sessions", async () => {
  const { getUserSettings, saveUserSettings } = await import("lfaa-settings/src/service.js");
  const manager = new BrowserSessionManager(true, undefined, { headless: true });
  const ownerId = "browser-cdp-gate-user";
  database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role) VALUES(?, 908, ?, 'fixture', 'fixture', 'admin')").run(ownerId, ownerId);
  const defaults = getUserSettings(ownerId).browserUse;
  const invoke = providerId => manager.sendCdpCommand(ownerId, "session-cdp", providerId, "Runtime.evaluate", {});
  try {
    await assert.rejects(invoke("lfaa-managed-edge"), /Agent 浏览器控制已在设置中心关闭/u);
    saveUserSettings(ownerId, "browser-use", { ...defaults, enabled: true });
    await assert.rejects(invoke("lfaa-managed-edge"), /需要在设置中心开启开发者模式和完整 CDP 权限/u);
    saveUserSettings(ownerId, "browser-use", { ...defaults, enabled: true, developerMode: true });
    await assert.rejects(invoke("lfaa-managed-edge"), /需要在设置中心开启开发者模式和完整 CDP 权限/u);
    saveUserSettings(ownerId, "browser-use", { ...defaults, enabled: true, developerMode: true, fullCdpAccess: true });
    await assert.rejects(invoke("tabbit-personal"), /不访问个人浏览器会话/u);
  } finally {
    await manager.closeAll();
  }
});

test("Browser snapshots bound text, controls, tabs, and screenshot bytes", async () => {
  const manager = new BrowserSessionManager(false);
  const activePage = makePage({
    url: "https://example.test/",
    pageText: `${"x".repeat(16_010)}\u0000tail`,
    controls: Array.from({ length: 100 }, (_, index) => ({ role: "button", name: index < 2 ? "Same" : `Button ${index}`, disabled: false })),
    screenshot: Buffer.alloc(2 * 1024 * 1024 + 1)
  });
  const pages = [activePage, ...Array.from({ length: 9 }, (_, index) => makePage({ url: `https://example.test/${index}`, title: `Tab ${index}` }))];
  try {
    const snapshot = await manager.observe({ id: "snapshot", lastUsedAt: 0, page: activePage, context: { pages: () => pages } }, true);
    assert.equal(snapshot.pageText.length, 16_000);
    assert.equal(snapshot.pageText.includes("\u0000"), false);
    assert.equal(snapshot.controls.length, 80);
    assert.deepEqual(snapshot.controls.slice(0, 2).map(control => control.occurrence), [0, 1], "same-name controls expose distinct occurrence numbers");
    assert.equal(snapshot.tabs.length, 8);
    assert.equal(snapshot.screenshot, null, "oversized screenshot bytes are not returned");
    assert.deepEqual(activePage.state.screenshotOptions.map(options => options.animations), ["allow", "allow"], "capturing frames keeps page animations running");
  } finally {
    await manager.closeAll();
  }
});

test("Dock waits for real page revisions, reads a light frame, and releases cancelled waiters", async () => {
  const manager = new BrowserSessionManager(true, undefined, { headless: true });
  const browser = makeBrowser();
  useFakeEdge(manager, browser);
  try {
    const initial = await manager.navigate("user-a", "session-dock", "lfaa-managed-edge", "http://127.0.0.1:3000/api/health");
    const session = [...manager.sessions.values()][0];
    const controller = new AbortController();
    const waiting = manager.waitForPanelRevision("user-a", "session-dock", "lfaa-managed-edge", initial.revision, controller.signal);
    assert.equal(session.revisionWaiters.size, 1, "the Dock waits on the current Browser Owner session");
    session.page.emit("domcontentloaded");
    const updated = await waiting;
    assert.ok(updated.revision > initial.revision, "a page change wakes the waiting Dock");
    assert.equal(session.revisionWaiters.size, 0, "a successful wait unregisters its listener");

    const bodyReadsBefore = session.page.state.pageTextReads ?? 0;
    const controlReadsBefore = session.page.state.controlReads ?? 0;
    const lightSnapshot = await manager.getPanelSnapshot("user-a", "session-dock", "lfaa-managed-edge", true, false);
    assert.equal(lightSnapshot.pageText, "", "the Dock frame does not fetch full page text");
    assert.deepEqual(lightSnapshot.controls, [], "the Dock frame does not rescan interactive controls");
    assert.equal(session.page.state.pageTextReads ?? 0, bodyReadsBefore);
    assert.equal(session.page.state.controlReads ?? 0, controlReadsBefore);

    const screenshotsBeforeClick = session.page.state.screenshotOptions?.length ?? 0;
    const clickResult = await manager.clickAt("user-a", "session-dock", "lfaa-managed-edge", 80, 40, undefined, false, false);
    assert.equal(clickResult.screenshot, null, "Dock click can return immediately and refresh its screenshot separately");
    assert.equal(session.page.state.screenshotOptions?.length ?? 0, screenshotsBeforeClick, "Dock click with screenshots disabled skips capture");

    const cancelledController = new AbortController();
    const cancelledWait = manager.waitForPanelRevision("user-a", "session-dock", "lfaa-managed-edge", session.revision, cancelledController.signal);
    cancelledController.abort();
    await assert.rejects(cancelledWait, /浏览器页面更新等待已取消/u);
    assert.equal(session.revisionWaiters.size, 0, "cancellation clears both the waiter and its timeout");
  } finally {
    await manager.closeAll();
  }
});

test("Browser Owner coalesces rapid DOM mutation notifications", async () => {
  const manager = new BrowserSessionManager(true, undefined, { headless: true });
  const browser = makeBrowser();
  useFakeEdge(manager, browser);
  try {
    await manager.navigate("user-a", "session-mutations", "lfaa-managed-edge", "http://127.0.0.1:3000/api/health", undefined, false, false);
    const session = [...manager.sessions.values()][0];
    const notifyPageMutation = session.page.state.exposedBindings?.[0];
    assert.equal(typeof notifyPageMutation, "function", "the Browser Owner installs the bounded DOM observer bridge");

    const originalNow = Date.now;
    let now = originalNow();
    Date.now = () => now;
    try {
      const before = session.revision;
      await notifyPageMutation();
      const firstMutation = session.revision;
      await notifyPageMutation();
      assert.ok(firstMutation > before, "the first DOM change wakes the browser Dock");
      assert.equal(session.revision, firstMutation, "a rapid follow-up mutation does not trigger another full-frame refresh");

      now += 750;
      await notifyPageMutation();
      assert.ok(session.revision > firstMutation, "later DOM changes continue to refresh after the coalescing interval");
    } finally {
      Date.now = originalNow;
    }
  } finally {
    await manager.closeAll();
  }
});

test("Browser Dock displays the first renderable frame before slow subresources finish", async () => {
  const manager = new BrowserSessionManager(true, undefined, { headless: true });
  const browser = makeBrowser();
  useFakeEdge(manager, browser);
  try {
    const initial = await manager.navigate("user-a", "session-loading", "lfaa-managed-edge", "http://127.0.0.1:3000/api/health");
    const session = [...manager.sessions.values()][0];
    assert.equal(session.page.state.gotoOptions.waitUntil, "commit", "address navigation returns as soon as the main document commits");
    session.page.state.readyState = "loading";
    session.page.state.hasRenderableContent = false;
    const loadingFrame = await manager.getPanelSnapshot("user-a", "session-loading", "lfaa-managed-edge", true, false);
    assert.equal(loadingFrame?.screenshot, null, "a genuinely blank frame does not replace the last visible page");
    assert.equal(loadingFrame?.loading, true, "the Dock can keep showing the loading state while the document is empty");

    const waiting = manager.waitForPanelRevision("user-a", "session-loading", "lfaa-managed-edge", initial.revision, new AbortController().signal);
    session.page.state.readyState = "interactive";
    session.page.state.hasRenderableContent = true;
    session.page.emit("domcontentloaded");
    const domRevision = await waiting;
    assert.ok(domRevision && domRevision.revision > initial.revision, "the first DOM frame wakes the Dock without waiting for every resource");
    const interactiveFrame = await manager.getPanelSnapshot("user-a", "session-loading", "lfaa-managed-edge", true, false);
    assert.equal(interactiveFrame?.loading, false, "DOMContentLoaded clears the loading indicator");
    assert.equal(interactiveFrame?.screenshot?.mimeType, "image/jpeg", "the first renderable DOM frame is captured before the load event");

    assert.ok(interactiveFrame, "the first renderable frame should produce a Dock snapshot");
    const beforeLoadRevision = interactiveFrame.revision;
    const waitingForLoad = manager.waitForPanelRevision("user-a", "session-loading", "lfaa-managed-edge", beforeLoadRevision, new AbortController().signal);
    session.page.state.readyState = "complete";
    session.page.emit("load");
    const completedRevision = await waitingForLoad;
    assert.ok(completedRevision && completedRevision.revision > beforeLoadRevision, "later page completion still refreshes the Dock");
  } finally {
    await manager.closeAll();
  }
});

test("cancelling an active Browser operation stops loading and keeps its page available", async () => {
  const manager = new BrowserSessionManager(true, undefined, { headless: true });
  const browser = makeBrowser();
  useFakeEdge(manager, browser);
  let markStarted;
  const started = new Promise(resolve => { markStarted = resolve; });
  let closedContexts = 0;
  const originalNewContext = browser.newContext.bind(browser);
  browser.newContext = async options => {
    const context = await originalNewContext(options);
    const close = context.close.bind(context);
    context.close = async () => { closedContexts += 1; await close(); };
    const page = context.pages()[0];
    page.state.waitUntilClosed = true;
    page.state.started = markStarted;
    return context;
  };
  const controller = new AbortController();
  try {
    const operation = manager.navigate("user-a", "session-a", "lfaa-managed-edge", "http://127.0.0.1:3000/api/health", controller.signal);
    await started;
    controller.abort();
    await assert.rejects(operation, /浏览器操作已取消/u);
    const page = browser.contexts[0].pages()[0];
    assert.equal(page.state.stopLoadingCalls, 1, "cancellation asks Chromium to stop the current navigation");
    assert.equal(page.isClosed(), false, "cancellation leaves the visible page open");
    assert.equal(closedContexts, 0, "cancellation does not dispose the browser context");
    page.state.waitUntilClosed = false;
    const snapshot = await manager.observeForRun("user-a", "session-a", "lfaa-managed-edge");
    assert.equal(snapshot.url, "http://127.0.0.1:3000/api/health", "the same page remains observable after cancellation");
  } finally {
    await manager.closeAll();
  }
});
