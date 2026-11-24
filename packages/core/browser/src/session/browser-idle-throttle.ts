// 后台无头浏览器空闲省电节流器：当前端使用原生 iframe 展示且无推流订阅与 Agent 操作时，暂停后台动画渲染并在下次操作前毫秒唤醒。
import type { CDPSession } from "playwright-core";
import type { SessionBrowserState } from "./browser-session-types";

const DEFAULT_IDLE_PAUSE_MS = 2500;

interface PausedEntry {
  tabId: string;
  cdp: CDPSession;
}

export class BrowserIdleThrottle {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly paused = new Map<string, PausedEntry>();
  private readonly generations = new Map<string, number>();

  /** 查询会话当前是否处于后台省电暂停态（便于单测与诊断）。 */
  isPaused(sessionId: string): boolean {
    return this.paused.has(sessionId);
  }

  /** 标记会话活跃：递增代次取消在途省电操作，若已暂停则立刻恢复 1x 动画与全速 CPU。 */
  async markActive(sessionId: string): Promise<void> {
    this.generations.set(sessionId, (this.generations.get(sessionId) ?? 0) + 1);
    const timer = this.timers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(sessionId);
    }
    const entry = this.paused.get(sessionId);
    if (!entry) return;
    this.paused.delete(sessionId);
    await entry.cdp.send("Animation.setPlaybackRate", { playbackRate: 1 }).catch(() => {});
    await entry.cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 }).catch(() => {});
    await entry.cdp.detach().catch(() => {});
  }

  /** 安排空闲省电暂停：仅在无 SSE 推流且页面支持前端原生直连时暂停后台重复动画，杜绝双倍吃 CPU。 */
  schedule(
    sessionId: string,
    getState: () => SessionBrowserState | undefined,
    hasSubscribers: () => boolean,
    delayMs = DEFAULT_IDLE_PAUSE_MS,
  ): void {
    const prev = this.timers.get(sessionId);
    if (prev) clearTimeout(prev);
    const gen = this.generations.get(sessionId) ?? 0;
    const timer = setTimeout(() => {
      this.timers.delete(sessionId);
      void this.tryPause(sessionId, gen, getState, hasSubscribers);
    }, delayMs);
    timer.unref?.();
    this.timers.set(sessionId, timer);
  }

  private async tryPause(
    sessionId: string,
    gen: number,
    getState: () => SessionBrowserState | undefined,
    hasSubscribers: () => boolean,
  ): Promise<void> {
    if (hasSubscribers() || this.paused.has(sessionId) || (this.generations.get(sessionId) ?? 0) !== gen) return;
    const state = getState();
    const tab = state?.tabs.get(state.activeTabId);
    if (!state || !tab || tab.page.isClosed()) return;
    const url = tab.page.url();
    if (!url || url === "about:blank" || tab.embeddable === false) return;
    let cdp: CDPSession | null = null;
    try {
      cdp = await state.context.newCDPSession(tab.page);
      if (hasSubscribers() || this.timers.has(sessionId) || (this.generations.get(sessionId) ?? 0) !== gen) {
        await cdp.detach().catch(() => {});
        return;
      }
      await cdp.send("Animation.enable").catch(() => {});
      await cdp.send("Animation.setPlaybackRate", { playbackRate: 0 }).catch(() => {});
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 }).catch(() => {});
      this.paused.set(sessionId, { tabId: tab.tabId, cdp });
    } catch {
      if (cdp) await cdp.detach().catch(() => {});
    }
  }

  async clear(sessionId: string): Promise<void> {
    await this.markActive(sessionId);
  }

  async disposeAll(): Promise<void> {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    const entries = [...this.paused.values()];
    this.paused.clear();
    await Promise.all(entries.map(async (entry) => {
      await entry.cdp.send("Animation.setPlaybackRate", { playbackRate: 1 }).catch(() => {});
      await entry.cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 }).catch(() => {});
      await entry.cdp.detach().catch(() => {});
    }));
  }
}
