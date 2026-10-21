import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { BrowserSessionManager } from "../../../packages/browser-use/browser-use/src/session-manager.ts";

function makePage(state = {}) {
  let currentUrl = state.url ?? "about:blank";
  const listeners = new Map();
  return {
    isClosed: () => false,
    url: () => currentUrl,
    title: async () => state.title ?? "Example",
    viewportSize: () => ({ width: 1280, height: 800 }),
    screenshot: async () => state.screenshot ?? Buffer.from("jpeg"),
    on(event, listener) { listeners.set(event, listener); },
    locator(selector) {
      if (selector === "body") return { innerText: async () => state.pageText ?? "body" };
      return { evaluateAll: async (_map, limit) => (state.controls ?? []).slice(0, limit) };
    },
    async goto(url) {
      state.started?.();
      if (state.waitUntilClosed) await new Promise((resolve, reject) => {
        state.release = resolve;
        state.reject = reject;
      });
      currentUrl = url;
      listeners.get("domcontentloaded")?.();
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
        newPage: async () => page,
        exposeBinding: async () => undefined,
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

  const manager = new BrowserSessionManager(true);
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
  const manager = new BrowserSessionManager(true);
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

test("Browser Run adapter is account/session/run bound and released with the Run", async () => {
  const manager = new BrowserSessionManager(true);
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
    assert.equal(pageA.sessionId, pageNextRun.sessionId, "Browser Session remains shared across Runs in the same LFAA session");
    assert.notEqual(pageA.sessionId, pageOtherAccount.sessionId, "Browser Session stays isolated by account");
    assert.equal(browser.contexts.length, 2);
    assert.equal(cleanupsA.length, 1, "the Run registers only one cleanup callback");

    cleanupsA[0]();
    assert.throws(() => runA.observe("lfaa-managed-edge"), /Run.*浏览器桥接已结束/u);
    assert.match((await nextRun.observe("lfaa-managed-edge")).pageText, /body/u, "disposing one Run leaves the Session context available to another Run");
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
  } finally {
    await manager.closeAll();
  }
});

test("cancelling an active Browser operation closes its context", async () => {
  const manager = new BrowserSessionManager(true);
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
    assert.equal(closedContexts, 1, "cancellation tears down the active context");
  } finally {
    await manager.closeAll();
  }
});
