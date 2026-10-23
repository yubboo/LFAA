import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { isolateData } from "./isolated-data.mjs";

isolateData(test, "browser-use");
const { BrowserSessionManager } = await import("lfaa-browser-use/src/session-manager.js");

function makePage(state = {}) {
  let currentUrl = state.url ?? "about:blank";
  const listeners = new Map();
  return {
    isClosed: () => false,
    url: () => currentUrl,
    title: async () => state.title ?? "Example",
    viewportSize: () => ({ width: 1280, height: 800 }),
    evaluate: async () => ({
      loading: (state.readyState ?? "complete") === "loading",
      hasRenderableContent: state.hasRenderableContent ?? true
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
    emit(event) { for (const listener of listeners.get(event) ?? []) listener(); },
    locator(selector) {
      if (selector === "body") return { innerText: async () => { state.pageTextReads = (state.pageTextReads ?? 0) + 1; return state.pageText ?? "body"; } };
      return { evaluateAll: async (_map, limit) => { state.controlReads = (state.controlReads ?? 0) + 1; return (state.controls ?? []).slice(0, limit); } };
    },
    getByRole() { return { first: () => ({ click: async () => undefined }) }; },
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
        newCDPSession: async () => ({
          send: async method => {
            if (method === "Page.stopLoading") {
              page.state.stopLoadingCalls = (page.state.stopLoadingCalls ?? 0) + 1;
              page.state.waitUntilClosed = false;
              page.state.release?.();
            }
          },
          detach: async () => undefined
        }),
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

test("Browser Owner can prewarm the managed browser before a page or context exists", async () => {
  const manager = new BrowserSessionManager(true, undefined, { headless: true });
  const browser = makeBrowser();
  useFakeEdge(manager, browser);
  try {
    await manager.prewarm("lfaa-managed-edge");
    assert.equal(browser.contexts.length, 0, "prewarming starts the managed browser without creating a page or account context");
    await manager.navigate("user-a", "session-a", "lfaa-managed-edge", "http://127.0.0.1:3000/api/health");
    assert.equal(browser.contexts.length, 1, "the later navigation creates the normal isolated context on the warmed browser");
    await assert.rejects(manager.prewarm("tabbit-personal"), /只支持 LFAA 隔离 Edge\/Chrome/u);
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
    assert.deepEqual(Object.keys(runA).sort(), ["claimTab", "click", "fill", "listTabs", "navigate", "navigateProjectPreview", "observe", "pressKey", "runId", "scroll"], "the adapter exposes only bounded browser actions");

    const pageA = await runA.navigate("lfaa-managed-edge", "http://127.0.0.1:3000/api/health");
    const pageNextRun = await nextRun.navigate("lfaa-managed-edge", "http://127.0.0.1:3000/api/health");
    const pageOtherAccount = await otherAccount.navigate("lfaa-managed-edge", "http://127.0.0.1:3000/api/health");
    const sharedPage = browser.contexts[0].pages()[0];
    assert.equal(pageA.sessionId, pageNextRun.sessionId, "Browser Session remains shared across Runs in the same LFAA session");
    assert.notEqual(pageA.sessionId, pageOtherAccount.sessionId, "Browser Session stays isolated by account");
    assert.equal(browser.contexts.length, 2);
    assert.equal(pageA.screenshot, null, "Agent navigation returns structured page data without capturing a screenshot");
    assert.equal(sharedPage.state.screenshotOptions?.length ?? 0, 0, "Agent navigation skips the expensive screenshot path");
    assert.equal(cleanupsA.length, 1, "the Run registers only one cleanup callback");

    cleanupsA[0]();
    assert.throws(() => runA.observe("lfaa-managed-edge"), /Run.*浏览器桥接已结束/u);
    const observed = await nextRun.observe("lfaa-managed-edge");
    assert.match(observed.pageText, /body/u, "disposing one Run leaves the Session context available to another Run");
    assert.equal(observed.screenshot, null, "Agent observation stays structured JSON rather than returning an image");
    assert.equal(sharedPage.state.screenshotOptions?.length ?? 0, 0, "Agent observation does not capture an image");
    const clicked = await nextRun.click("lfaa-managed-edge", "button", "Continue");
    assert.equal(clicked.screenshot, null, "Agent actions return structured state without blocking on a screenshot");
    assert.equal(sharedPage.state.screenshotOptions?.length ?? 0, 0, "Agent click skips screenshot capture too");
    const replacement = manager.createRunAdapter({ ...bindingA, signal: new AbortController().signal, onRunDispose: cleanup => cleanupsA.push(cleanup) });
    assert.notStrictEqual(replacement, runA, "disposed bridge registration is removed");
  } finally {
    await manager.closeAll();
  }
});

test("Browser snapshots bound text, controls, tabs, and screenshot bytes", async () => {
  const manager = new BrowserSessionManager(false);
  const activePage = makePage({
    url: "https://example.test/",
    pageText: `${"x".repeat(16_010)}\u0000tail`,
    controls: Array.from({ length: 100 }, (_, index) => ({ role: "button", name: `Button ${index}`, disabled: false })),
    screenshot: Buffer.alloc(2 * 1024 * 1024 + 1)
  });
  const pages = [activePage, ...Array.from({ length: 9 }, (_, index) => makePage({ url: `https://example.test/${index}`, title: `Tab ${index}` }))];
  try {
    const snapshot = await manager.observe({ id: "snapshot", lastUsedAt: 0, page: activePage, context: { pages: () => pages } }, true);
    assert.equal(snapshot.pageText.length, 16_000);
    assert.equal(snapshot.pageText.includes("\u0000"), false);
    assert.equal(snapshot.controls.length, 80);
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
