// 管理基于 Playwright 常驻 CDPSession 的 2x 无损 PNG Screencast 实时推流与毫秒级输入直通。
import type { BrowserContext, CDPSession, Page } from "playwright-core";
import type { BrowserInputPayload, BrowserStreamFramePayload } from "../types";
import { dispatchCdpInput } from "./cdp-input";

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
  embeddable?: boolean | undefined;
  lastActor?: "user" | "agent" | undefined;
  onFrameStored?: (base64: string, mime: "image/jpeg" | "image/png") => void;
}

export type StreamFrameListener = (frame: BrowserStreamFramePayload) => void;

interface ActiveStreamHandle {
  tabId: string;
  cdp: CDPSession;
  getMeta: () => ScreencastTabMeta | null;
  lastEmitAt: number;
}

/** 与浏览器启动参数 --force-device-scale-factor=2 对齐，保证每帧均为恒定 2x Retina 像素，绝不来回跳变。 */
const STREAM_DPR = 2;
/** 协同帧流上限约 30fps（33ms），配合 2x 高质量 JPEG 避免 60fps 动画页打满 CPU 造成卡顿。 */
const MIN_FRAME_INTERVAL_MS = 33;

export class ScreencastManager {
  private readonly listeners = new Map<string, Set<StreamFrameListener>>();
  private readonly streams = new Map<string, ActiveStreamHandle>();
  private readonly generations = new Map<string, number>();

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

  /** 向当前会话订阅者广播一帧恒定 2x Retina JPEG 画面及最新页面元数据。 */
  private emitFrame(sessionId: string, latest: ScreencastTabMeta, data: string): void {
    latest.onFrameStored?.(data, "image/jpeg");
    const subscribers = this.listeners.get(sessionId);
    if (!subscribers || subscribers.size === 0) return;
    const payload: BrowserStreamFramePayload = {
      sessionId,
      tabId: latest.tabId,
      data,
      mime: "image/jpeg",
      url: latest.page.url(),
      title: latest.title,
      canGoBack: latest.canGoBack,
      canGoForward: latest.canGoForward,
      errorCount: latest.errorCount,
      consoleCount: latest.consoleCount,
      networkCount: latest.networkCount,
      viewport: latest.viewport,
      deviceScaleFactor: STREAM_DPR,
      colorScheme: latest.colorScheme,
      ...(latest.embeddable !== undefined ? { embeddable: latest.embeddable } : {}),
      ...(latest.lastActor ? { lastActor: latest.lastActor } : {}),
      updatedAt: Date.now(),
    };
    for (const fn of subscribers) fn(payload);
  }

  /** 向当前会话订阅者主动推送一帧新画面（例如视口尺寸或预设切换后静态页不会触发重绘时）。 */
  pushFrame(sessionId: string, meta: ScreencastTabMeta, data: string): void {
    this.emitFrame(sessionId, meta, data);
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

    const gen = (this.generations.get(sessionId) ?? 0) + 1;
    this.generations.set(sessionId, gen);

    let cdp: CDPSession | null = null;
    try {
      cdp = await context.newCDPSession(meta.page);
      // 并发重建或订阅已取消时丢弃过期 CDP 会话，防止双会话竞态。
      if (this.generations.get(sessionId) !== gen || !this.hasSubscribers(sessionId)) {
        await cdp.detach().catch(() => {});
        return;
      }
      const handle: ActiveStreamHandle = { tabId: meta.tabId, cdp, getMeta, lastEmitAt: 0 };
      this.streams.set(sessionId, handle);

      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: meta.viewport.width,
        height: meta.viewport.height,
        deviceScaleFactor: STREAM_DPR,
        mobile: meta.viewport.width <= 480,
      }).catch(() => {});

      cdp.on("Page.screencastFrame", (event) => {
        const now = Date.now();
        const latest = handle.getMeta();
        if (latest && latest.tabId === handle.tabId && now - handle.lastEmitAt >= MIN_FRAME_INTERVAL_MS) {
          handle.lastEmitAt = now;
          this.emitFrame(sessionId, latest, event.data);
        }
        void cdp!.send("Page.screencastFrameAck", { sessionId: event.sessionId }).catch(() => {});
      });

      const maxWidth = Math.max(320, Math.min(3840, Math.round(meta.viewport.width * STREAM_DPR)));
      const maxHeight = Math.max(240, Math.min(2880, Math.round(meta.viewport.height * STREAM_DPR)));
      // 恒定 2x Retina + 高质量 JPEG + 隔帧采样：比 60fps 全量 PNG 编码快约 10 倍，且永不切分辨率抖动。
      await cdp.send("Page.startScreencast", {
        format: "jpeg",
        quality: 88,
        everyNthFrame: 2,
        maxWidth,
        maxHeight,
      });
    } catch {
      if (cdp) await cdp.detach().catch(() => {});
      if (this.generations.get(sessionId) === gen) {
        this.streams.delete(sessionId);
      }
    }
  }

  /** 直接复用常驻 CDPSession 派发键鼠输入；返回是否已通过 CDP 处理。 */
  async dispatchInput(
    sessionId: string,
    tabId: string,
    payload: BrowserInputPayload,
  ): Promise<boolean> {
    const handle = this.streams.get(sessionId);
    if (!handle || handle.tabId !== tabId) return false;
    try {
      await dispatchCdpInput(handle.cdp, payload);
      return true;
    } catch {
      return false;
    }
  }

  async stopSession(sessionId: string): Promise<void> {
    this.generations.set(sessionId, (this.generations.get(sessionId) ?? 0) + 1);
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
