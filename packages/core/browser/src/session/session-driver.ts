// 浏览器页面驱动：导航、前进后退、刷新、快照、求值，以及点击/悬停/输入/按键/滚动等页面交互。
// 从 BrowserRuntime 拆出：这些方法只在页面上做事，会话创建、截图与串流由宿主（BrowserRuntime）提供。
import type { BrowserSessionSnapshot } from "../types";
import { navigateOrDownload } from "../downloads/playwright-download";
import type { BrowserTabEntry, SessionBrowserState } from "./browser-session-types";
import { hideAgentActionOverlay, locateAgentTarget, showAgentActionOverlay, smoothScrollPage } from "./agent-overlay";
import { clampViewport, validateBrowserUrl } from "../runtime-utils";

/** 清洗 Playwright 导航异常（去掉 ANSI 终端转义码与 Call log），转为面向用户的清晰中文提示。 */
function formatNavigationError(error: unknown, url: string): Error {
  const raw = (error instanceof Error ? error.message : String(error))
    .replace(/\u001b\[[0-9;]*m/gu, "")
    .split(/\bCall log:/u)[0]!
    .trim();
  if (/ERR_CONNECTION_REFUSED/u.test(raw)) {
    return new Error(`无法连接到 ${url}（连接被拒绝，请确认对应本地服务是否仍在运行）`);
  }
  if (/ERR_NAME_NOT_RESOLVED/u.test(raw)) {
    return new Error(`无法解析地址 ${url}（域名不存在或网络不可达）`);
  }
  if (/ERR_CONNECTION_TIMED_OUT|Timeout/iu.test(raw)) {
    return new Error(`打开 ${url} 超时，请检查服务响应或稍后重试`);
  }
  return new Error(raw.replace(/^page\.goto:\s*/u, "") || `无法打开 ${url}`);
}

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
    try {
      if (await navigateOrDownload(tab.page, url)) {
        return { ...await this.host.capture(state, tab, true, fromAgent), downloadStarted: true };
      }
    } catch (error) {
      const message = formatNavigationError(error, url);
      const raw = error instanceof Error ? error.message : String(error);
      if (!fromAgent && /ERR_CONNECTION_REFUSED|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION_TIMED_OUT|Timeout/iu.test(raw)) {
        state.lastError = message.message;
        return this.host.capture(state, tab, true, false);
      }
      throw message;
    }
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
    if (withScreenshot) await hideAgentActionOverlay(tab.page);
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
    target: { ref?: string; selector?: string; x?: number; y?: number; button?: "left" | "right" | "middle"; clickCount?: number; label?: string },
    fromAgent = false,
    fast = false,
  ): Promise<BrowserSessionSnapshot> {
    const { state, tab } = await this.host.ensureSession(sessionId);
    this.host.assertNotTakeoverPaused(state, fromAgent);
    state.lastActor = fromAgent ? "agent" : "user";
    if (fromAgent) {
      const pos = await locateAgentTarget(tab.page, target);
      if (pos) {
        const badge = target.label ? `点击 · ${target.label}` : "点击元素";
        await showAgentActionOverlay(tab.page, { kind: "click", x: pos.x, y: pos.y, label: badge, box: pos.box });
        await tab.page.waitForTimeout(50);
      }
    }
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
    if (fromAgent) await tab.page.waitForTimeout(90);
    else if (!fast) await tab.page.waitForTimeout(25);
    const needShot = fromAgent || (!fast && !this.host.hasStreamSubscribers(sessionId));
    return this.host.capture(state, tab, needShot, fromAgent);
  }

  async hover(
    sessionId: string,
    target: { ref?: string; selector?: string; x?: number; y?: number; label?: string },
    fromAgent = false,
    fast = false,
  ): Promise<BrowserSessionSnapshot> {
    const { state, tab } = await this.host.ensureSession(sessionId);
    this.host.assertNotTakeoverPaused(state, fromAgent);
    state.lastActor = fromAgent ? "agent" : "user";
    if (fromAgent) {
      const pos = await locateAgentTarget(tab.page, target);
      if (pos) {
        const badge = target.label ? `悬停 · ${target.label}` : "悬停元素";
        await showAgentActionOverlay(tab.page, { kind: "hover", x: pos.x, y: pos.y, label: badge, box: pos.box });
        await tab.page.waitForTimeout(40);
      }
    }
    if (typeof target.x === "number" && typeof target.y === "number") {
      await tab.page.mouse.move(target.x, target.y);
    } else if (target.ref) {
      await tab.page.locator(`[data-lfaa-ref="${target.ref}"]`).first().hover({ timeout: 8000 });
    } else if (target.selector) {
      await tab.page.locator(target.selector).first().hover({ timeout: 8000 });
    }
    if (fromAgent) await tab.page.waitForTimeout(80);
    const needShot = fromAgent || (!fast && !this.host.hasStreamSubscribers(sessionId));
    return this.host.capture(state, tab, needShot, fromAgent);
  }

  async typeText(
    sessionId: string,
    target: { ref?: string; selector?: string; text: string; submit?: boolean; label?: string },
    fromAgent = false,
    fast = false,
  ): Promise<BrowserSessionSnapshot> {
    const { state, tab } = await this.host.ensureSession(sessionId);
    this.host.assertNotTakeoverPaused(state, fromAgent);
    state.lastActor = fromAgent ? "agent" : "user";
    if (fromAgent) {
      const pos = await locateAgentTarget(tab.page, target);
      if (pos) {
        const badge = target.label ? `输入 · ${target.label}` : "输入内容";
        await showAgentActionOverlay(tab.page, { kind: "type", x: pos.x, y: pos.y, label: badge, box: pos.box });
        await tab.page.waitForTimeout(50);
      }
    }
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
    if (fromAgent) await tab.page.waitForTimeout(90);
    const needShot = fromAgent || (!fast && !this.host.hasStreamSubscribers(sessionId));
    return this.host.capture(state, tab, needShot, fromAgent);
  }

  async scroll(
    sessionId: string,
    deltaY: number,
    deltaX = 0,
    fromAgent = false,
    fast = false,
    point?: { x?: number; y?: number; label?: string },
  ): Promise<BrowserSessionSnapshot> {
    const { state, tab } = await this.host.ensureSession(sessionId);
    this.host.assertNotTakeoverPaused(state, fromAgent);
    state.lastActor = fromAgent ? "agent" : "user";
    if (fromAgent) {
      const cx = typeof point?.x === "number" ? point.x : Math.round(state.viewport.width / 2);
      const cy = typeof point?.y === "number" ? point.y : Math.round(state.viewport.height / 2);
      const dir = deltaY >= 0 ? "向下滚动" : "向上滚动";
      const badge = point?.label ? `${dir} · ${point.label}` : dir;
      await showAgentActionOverlay(tab.page, { kind: "scroll", x: cx, y: cy, label: badge });
      await smoothScrollPage(tab.page, deltaX, deltaY);
    } else {
      if (typeof point?.x === "number" && typeof point?.y === "number") {
        await tab.page.mouse.move(point.x, point.y);
      }
      await tab.page.mouse.wheel(deltaX, deltaY);
    }
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
