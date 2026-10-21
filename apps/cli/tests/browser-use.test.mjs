import assert from "node:assert/strict";
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
      return { evaluateAll: async () => state.controls ?? [] };
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
