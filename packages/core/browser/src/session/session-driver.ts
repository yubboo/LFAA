// 浏览器页面驱动：导航、前进后退、刷新、快照、求值，以及点击/悬停/输入/按键/滚动等页面交互。
// 从 BrowserRuntime 拆出：这些方法只在页面上做事，会话创建、截图与串流由宿主（BrowserRuntime）提供。
import type { BrowserSessionSnapshot } from "../types";
import type { BrowserTabEntry, SessionBrowserState } from "./browser-session-types";
import { clampViewport, validateBrowserUrl } from "../runtime-utils";

/** 驱动所需的宿主能力：会话准备、接管暂停校验、截图与串流。 */
export interface SessionDriverHost {
  ensureSession(
    sessionId: string,
    appearance?: { deviceScaleFactor?: number; colorScheme?: "dark" | "light" },
  ): Promise<{ state: SessionBrowserState; tab: BrowserTabEntry }>;
  assertNotTakeoverPaused(state: SessionBrowserState, fromAgent: boolean): void;
  capture(state: SessionBrowserState, tab: BrowserTabEntry, withScreenshot: boolean, fromAgent: boolean): Promise<BrowserSessionSnapshot>;
  hasStreamSubscribers(sessionId: string): boolean;
  refreshStream(sessionId: string, state: SessionBrowserState): Promise<void>;
}

/** 页面驱动：所有方法都按「准备会话 → 校验接管 → 操作页面 → 截图返回」的同一节奏执行。 */
export class SessionDriver {
  constructor(private readonly host: SessionDriverHost) {}

  async navigate(
    sessionId: string,
    rawUrl: string,
    fromAgent = false,
    viewport?: { width: number; height: number },
    appearance?: { deviceScaleFactor?: number; colorScheme?: "dark" | "light" },
  ): Promise<BrowserSessionSnapshot> {
    const { url } = validateBrowserUrl(rawUrl);
    const { state, tab } = await this.host.ensureSession(sessionId, appearance);
    this.host.assertNotTakeoverPaused(state, fromAgent);
    state.lastActor = fromAgent ? "agent" : "user";
    let vpChanged = false;
    if (viewport) {
      const nextVp = clampViewport(viewport.width, viewport.height);
      if (state.viewport.width !== nextVp.width || state.viewport.height !== nextVp.height) {
        state.viewport = nextVp;
        vpChanged = true;
        await tab.page.setViewportSize(nextVp).catch(() => {});
      }
    }
    delete state.lastError;
    await tab.page.goto(url, { waitUntil: "domcontentloaded", timeout: 25_000 });
    await tab.page.waitForLoadState("networkidle", { timeout: fromAgent ? 2500 : 1000 }).catch(() => {});
    if (vpChanged && this.host.hasStreamSubscribers(sessionId)) {
      await this.host.refreshStream(sessionId, state);
    }
    return this.host.capture(state, tab, true, fromAgent);
  }

  async goBack(sessionId: string): Promise<BrowserSessionSnapshot> {
    const { state, tab } = await this.host.ensureSession(sessionId);
    if (tab.historyIndex > 0) {
      await tab.page.goBack({ waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => {});
      tab.historyIndex -= 1;
    }
    return this.host.capture(state, tab, true, false);
  }

  async goForward(sessionId: string): Promise<BrowserSessionSnapshot> {
    const { state, tab } = await this.host.ensureSession(sessionId);
    if (tab.historyIndex < tab.history.length - 1) {
      await tab.page.goForward({ waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => {});
      tab.historyIndex += 1;
    }
    return this.host.capture(state, tab, true, false);
  }

  async reload(sessionId: string): Promise<BrowserSessionSnapshot> {
    const { state, tab } = await this.host.ensureSession(sessionId);
    if (tab.page.url() && tab.page.url() !== "about:blank") {
      await tab.page.reload({ waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => {});
    }
    return this.host.capture(state, tab, true, false);
  }

  async snapshot(sessionId: string, withScreenshot = true): Promise<BrowserSessionSnapshot> {
    const { state, tab } = await this.host.ensureSession(sessionId);
    return this.host.capture(state, tab, withScreenshot, true);
  }

  /** 在当前页面上下文执行表达式，用于读取 DOM、computed style、尺寸与动画等文本模型看不到的状态。 */
  async evaluate(sessionId: string, expression: string, awaitPromise = false, fromAgent = false): Promise<unknown> {
    const { state, tab } = await this.host.ensureSession(sessionId);
    this.host.assertNotTakeoverPaused(state, fromAgent);
    const source = expression.trim();
    if (!source) throw new Error("要执行的表达式不能为空。");
    return tab.page.evaluate(
      async ({ source: code, awaitPromise: wait }) => {
        // 页面上下文里执行；不经过 Node，也不读取本机文件。
        const value = new Function(`return (${code})`)();
        return wait && value && typeof (value as Promise<unknown>).then === "function"
          ? await (value as Promise<unknown>)
          : value;
      },
      { source, awaitPromise },
    );
  }

  async click(
    sessionId: string,
    target: { ref?: string; selector?: string; x?: number; y?: number; button?: "left" | "right" | "middle"; clickCount?: number },
    fromAgent = false,
    fast = false,
  ): Promise<BrowserSessionSnapshot> {
    const { state, tab } = await this.host.ensureSession(sessionId);
    this.host.assertNotTakeoverPaused(state, fromAgent);
    state.lastActor = fromAgent ? "agent" : "user";
    if (typeof target.x === "number" && typeof target.y === "number") {
      await tab.page.mouse.click(target.x, target.y, {
        button: target.button ?? "left",
        clickCount: target.clickCount ?? 1,
      });
    } else if (target.ref) {
      await tab.page.locator(`[data-lfaa-ref="${target.ref}"]`).first().click({ timeout: 8000 });
    } else if (target.selector) {
      await tab.page.locator(target.selector).first().click({ timeout: 8000 });
    } else {
      throw new Error("请提供 ref、selector 或坐标 (x, y)。");
    }
    if (fromAgent) await tab.page.waitForTimeout(200);
    else if (!fast) await tab.page.waitForTimeout(25);
    const needShot = fromAgent || (!fast && !this.host.hasStreamSubscribers(sessionId));
    return this.host.capture(state, tab, needShot, fromAgent);
  }

  async hover(
    sessionId: string,
    target: { ref?: string; selector?: string; x?: number; y?: number },
    fromAgent = false,
    fast = false,
  ): Promise<BrowserSessionSnapshot> {
    const { state, tab } = await this.host.ensureSession(sessionId);
    this.host.assertNotTakeoverPaused(state, fromAgent);
    state.lastActor = fromAgent ? "agent" : "user";
    if (typeof target.x === "number" && typeof target.y === "number") {
      await tab.page.mouse.move(target.x, target.y);
    } else if (target.ref) {
      await tab.page.locator(`[data-lfaa-ref="${target.ref}"]`).first().hover({ timeout: 8000 });
    } else if (target.selector) {
      await tab.page.locator(target.selector).first().hover({ timeout: 8000 });
    }
    if (fromAgent) await tab.page.waitForTimeout(120);
    const needShot = fromAgent || (!fast && !this.host.hasStreamSubscribers(sessionId));
    return this.host.capture(state, tab, needShot, fromAgent);
  }

  async typeText(
    sessionId: string,
    target: { ref?: string; selector?: string; text: string; submit?: boolean },
    fromAgent = false,
    fast = false,
  ): Promise<BrowserSessionSnapshot> {
    const { state, tab } = await this.host.ensureSession(sessionId);
    this.host.assertNotTakeoverPaused(state, fromAgent);
    state.lastActor = fromAgent ? "agent" : "user";
    const locator = target.ref
      ? tab.page.locator(`[data-lfaa-ref="${target.ref}"]`).first()
      : target.selector
        ? tab.page.locator(target.selector).first()
        : null;
    if (locator) {
      await locator.fill(target.text, { timeout: 8000 });
      if (target.submit) await locator.press("Enter");
    } else {
      await tab.page.keyboard.type(target.text);
      if (target.submit) await tab.page.keyboard.press("Enter");
    }
    if (fromAgent) await tab.page.waitForTimeout(150);
    const needShot = fromAgent || (!fast && !this.host.hasStreamSubscribers(sessionId));
    return this.host.capture(state, tab, needShot, fromAgent);
  }

  async scroll(
    sessionId: string,
    deltaY: number,
    deltaX = 0,
    fromAgent = false,
    fast = false,
    point?: { x?: number; y?: number },
  ): Promise<BrowserSessionSnapshot> {
    const { state, tab } = await this.host.ensureSession(sessionId);
    this.host.assertNotTakeoverPaused(state, fromAgent);
    state.lastActor = fromAgent ? "agent" : "user";
    if (typeof point?.x === "number" && typeof point?.y === "number") {
      await tab.page.mouse.move(point.x, point.y);
    }
    await tab.page.mouse.wheel(deltaX, deltaY);
    if (fromAgent) await tab.page.waitForTimeout(120);
    const needShot = fromAgent || (!fast && !this.host.hasStreamSubscribers(sessionId));
    return this.host.capture(state, tab, needShot, fromAgent);
  }

  async pressKey(sessionId: string, key: string, fromAgent = false, fast = false): Promise<BrowserSessionSnapshot> {
    const { state, tab } = await this.host.ensureSession(sessionId);
    this.host.assertNotTakeoverPaused(state, fromAgent);
    state.lastActor = fromAgent ? "agent" : "user";
    await tab.page.keyboard.press(key);
    if (fromAgent) await tab.page.waitForTimeout(120);
    const needShot = fromAgent || (!fast && !this.host.hasStreamSubscribers(sessionId));
    return this.host.capture(state, tab, needShot, fromAgent);
  }
}