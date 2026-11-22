// 管理基于 Playwright CDPSession 的 Chromium Screencast 实时推流，代替低帧率截屏轮询。
import type { BrowserContext, CDPSession, Page } from "playwright-core";
import type { BrowserStreamFramePayload } from "../types";

export interface ScreencastTabMeta {
  tabId: string;
  page: Page;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  errorCount: number;
  consoleCount: number;
  networkCount: number;
  viewport: { width: number; height: number };
  deviceScaleFactor: number;
  colorScheme: "dark" | "light";
  onFrameStored?: (base64: string) => void;
}

export type StreamFrameListener = (frame: BrowserStreamFramePayload) => void;

interface ActiveStreamHandle {
  tabId: string;
  cdp: CDPSession;
  getMeta: () => ScreencastTabMeta | null;
}

export class ScreencastManager {
  private readonly listeners = new Map<string, Set<StreamFrameListener>>();
  private readonly streams = new Map<string, ActiveStreamHandle>();

  hasSubscribers(sessionId: string): boolean {
    return (this.listeners.get(sessionId)?.size ?? 0) > 0;
  }

  subscribe(sessionId: string, listener: StreamFrameListener): () => void {
    let set = this.listeners.get(sessionId);
    if (!set) {
      set = new Set();
      this.listeners.set(sessionId, set);
    }
    set.add(listener);
    return () => {
      const target = this.listeners.get(sessionId);
      if (!target) return;
      target.delete(listener);
      if (target.size === 0) {
        this.listeners.delete(sessionId);
        void this.stopSession(sessionId);
      }
    };
  }

  async ensureRunning(
    sessionId: string,
    context: BrowserContext,
    getMeta: () => ScreencastTabMeta | null,
    forceRestart = false,
  ): Promise<void> {
    if (!this.hasSubscribers(sessionId)) return;
    const meta = getMeta();
    if (!meta || meta.page.isClosed()) return;
    const existing = this.streams.get(sessionId);
    if (existing) {
      if (!forceRestart && existing.tabId === meta.tabId) {
        existing.getMeta = getMeta;
        return;
      }
      await this.stopSession(sessionId);
    }

    try {
      const cdp = await context.newCDPSession(meta.page);
      const handle: ActiveStreamHandle = { tabId: meta.tabId, cdp, getMeta };
      this.streams.set(sessionId, handle);

      cdp.on("Page.screencastFrame", (event) => {
        void cdp.send("Page.screencastFrameAck", { sessionId: event.sessionId }).catch(() => {});
        const latest = handle.getMeta();
        if (!latest || latest.tabId !== handle.tabId) return;
        latest.onFrameStored?.(event.data);
        const subscribers = this.listeners.get(sessionId);
        if (!subscribers || subscribers.size === 0) return;
        const payload: BrowserStreamFramePayload = {
          sessionId,
          tabId: latest.tabId,
          data: event.data,
          mime: "image/jpeg",
          url: latest.page.url(),
          title: latest.title,
          canGoBack: latest.canGoBack,
          canGoForward: latest.canGoForward,
          errorCount: latest.errorCount,
          consoleCount: latest.consoleCount,
          networkCount: latest.networkCount,
          viewport: latest.viewport,
          deviceScaleFactor: latest.deviceScaleFactor,
          colorScheme: latest.colorScheme,
          updatedAt: Date.now(),
        };
        for (const fn of subscribers) fn(payload);
      });

      const maxWidth = Math.max(360, Math.min(3840, Math.round(meta.viewport.width * meta.deviceScaleFactor)));
      const maxHeight = Math.max(280, Math.min(2400, Math.round(meta.viewport.height * meta.deviceScaleFactor)));
      await cdp.send("Page.startScreencast", {
        format: "jpeg",
        quality: 90,
        everyNthFrame: 1,
        maxWidth,
        maxHeight,
      });
    } catch {
      // 非 CDP 环境或页面已关闭时静默降级为普通快照
      this.streams.delete(sessionId);
    }
  }

  async stopSession(sessionId: string): Promise<void> {
    const existing = this.streams.get(sessionId);
    if (!existing) return;
    this.streams.delete(sessionId);
    await existing.cdp.send("Page.stopScreencast").catch(() => {});
    await existing.cdp.detach().catch(() => {});
  }

  async stopAll(): Promise<void> {
    const ids = [...this.streams.keys()];
    await Promise.all(ids.map((id) => this.stopSession(id)));
  }
}
