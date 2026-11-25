// 统一管理内置浏览器下载的确认、传输、落盘与终态，供 Playwright 和桌面 Host 共用。
import { randomUUID } from "node:crypto";
import type { BrowserDataStore } from "../settings/browser-data-store";
import type { BrowserDownloadStatus, BrowserSettingsConfig } from "../types";
import { downloadFilename, publishDownload } from "./download-file";
import { resolveDownloadPolicy } from "./download-policy";

const APPROVAL_TIMEOUT_MS = 120_000;
const MAX_ACTIVE_DOWNLOADS = 24;
const MAX_RECENT_DOWNLOADS = 60;

interface DownloadSource {
  url: string;
  sourceUrl?: string;
  filename: string;
  path(): Promise<string>;
  cancel(): Promise<void>;
  cleanup(): Promise<void>;
}

interface ActiveDownload {
  status: BrowserDownloadStatus;
  source: DownloadSource;
  timer?: ReturnType<typeof setTimeout>;
  publishing: boolean;
  choosing: boolean;
  staged?: Promise<string>;
  completion?: Promise<void>;
}

type Picker = (directory: string) => Promise<{ cancelled: boolean; path?: string; error?: string }>;

/** 设置读取与用户决定都走宿主，下载引擎只提供暂存文件。 */
export class BrowserDownloads {
  private readonly active = new Map<string, ActiveDownload>();
  private readonly recent: BrowserDownloadStatus[] = [];
  private readonly releasing = new Map<ActiveDownload, Promise<void>>();

  constructor(
    private readonly getSettings: () => Promise<BrowserSettingsConfig>,
    private readonly store: BrowserDataStore,
  ) {}

  list(sessionId?: string): BrowserDownloadStatus[] {
    const items = [...this.active.values()].map((item) => item.status).concat(this.recent);
    return items.filter((item) => !sessionId || item.sessionId === sessionId);
  }

  start(sessionId: string, source: DownloadSource, id: string = randomUUID()): string {
    if (this.active.has(id) || this.recent.some((item) => item.id === id)) return id;
    const item: ActiveDownload = {
      status: {
        id, sessionId, filename: downloadFilename(source.filename), url: "",
        directory: "", chooseLocation: false, state: "checking", startedAt: Date.now(),
      },
      source,
      publishing: false,
      choosing: false,
    };
    if (this.active.size >= MAX_ACTIVE_DOWNLOADS) {
      this.finish(item, "failed", "busy");
      void this.release(item, true);
      return id;
    }
    this.active.set(id, item);
    void this.prepare(item);
    return id;
  }

  async chooseLocation(sessionId: string, id: string, picker: Picker) {
    const item = this.pending(sessionId, id);
    if (!item.status.chooseLocation || item.choosing) throw new Error("当前无法更改下载位置。");
    item.choosing = true;
    try {
      const result = await picker(item.status.directory);
      if (result.error) throw new Error(result.error);
      if (!result.cancelled && result.path) this.pending(sessionId, id).status.directory = result.path;
      return { cancelled: result.cancelled, item: this.pending(sessionId, id).status };
    } finally {
      item.choosing = false;
    }
  }

  decide(sessionId: string, id: string, decision: "save" | "cancel") {
    const item = this.pending(sessionId, id);
    if (decision === "cancel") return this.cancel(item);
    if (item.choosing) throw new Error("请先完成保存位置选择。");
    this.transfer(item);
    return item.status;
  }

  async close(sessionId?: string): Promise<void> {
    const items = [...this.active.values()].filter((item) => !sessionId || item.status.sessionId === sessionId);
    await Promise.all(items.map(async (item) => {
      if (item.publishing) return item.completion;
      this.finish(item, "cancelled", "closed");
      await this.release(item, true);
    }));
    await Promise.all([...this.releasing]
      .filter(([item]) => !sessionId || item.status.sessionId === sessionId)
      .map(([, completion]) => completion));
  }

  private pending(sessionId: string, id: string): ActiveDownload {
    const item = this.active.get(id);
    if (item?.status.sessionId !== sessionId || item.status.state !== "awaiting") {
      throw new Error("下载请求已处理、已过期或不属于该会话。");
    }
    return item;
  }

  private async prepare(item: ActiveDownload) {
    try {
      const config = await this.getSettings();
      if (!this.active.has(item.status.id)) return;
      const { decision, url } = resolveDownloadPolicy(config, item.source.url, item.source.sourceUrl);
      item.status.url = url;
      item.status.directory = config.downloadDir ?? "";
      item.status.chooseLocation = config.askBeforeDownload === true;
      if (decision === "block") {
        this.finish(item, "blocked", "policy");
        await this.release(item, true);
      } else if (decision === "ask" || item.status.chooseLocation) {
        item.status.state = "awaiting";
        item.staged = item.source.path();
        void item.staged.catch(() => {
          if (item.status.state !== "awaiting") return;
          this.finish(item, "failed", "transfer");
          void this.release(item, false);
        });
        item.timer = setTimeout(() => this.cancel(item, "timeout"), APPROVAL_TIMEOUT_MS);
        item.timer.unref();
      } else {
        this.transfer(item);
      }
    } catch (error) {
      if (!this.active.has(item.status.id)) return;
      this.finish(item, "failed", "settings");
      await this.release(item, true);
    }
  }

  private transfer(item: ActiveDownload) {
    clearTimeout(item.timer);
    item.status.state = "transferring";
    item.completion = this.save(item);
  }

  private async save(item: ActiveDownload) {
    let reason: BrowserDownloadStatus["reason"] = "transfer";
    try {
      const path = await (item.staged ?? item.source.path());
      if (!this.active.has(item.status.id)) return;
      item.publishing = true;
      reason = "destination";
      const file = await publishDownload(path, item.status.directory, item.status.filename);
      item.status.filename = file.filename;
      item.status.savePath = file.savePath;
      reason = "history";
      await this.store.recordDownload({ ...file, url: item.status.url }, item.status.id);
      this.finish(item, "saved");
    } catch (error) {
      if (this.active.has(item.status.id)) this.finish(item, "failed", reason);
    } finally {
      await this.release(item, false);
    }
  }

  private cancel(item: ActiveDownload, reason?: BrowserDownloadStatus["reason"]) {
    this.finish(item, "cancelled", reason);
    void this.release(item, true);
    return item.status;
  }

  private finish(item: ActiveDownload, state: BrowserDownloadStatus["state"], reason?: BrowserDownloadStatus["reason"]) {
    clearTimeout(item.timer);
    item.status.state = state;
    if (reason) item.status.reason = reason;
    this.active.delete(item.status.id);
    this.recent.unshift(item.status);
    if (this.recent.length > MAX_RECENT_DOWNLOADS) this.recent.pop();
  }

  private release(item: ActiveDownload, cancel: boolean): Promise<void> {
    const current = this.releasing.get(item);
    if (current) return current;
    const completion = (async () => {
      if (cancel) {
        try {
          await item.source.cancel();
        } catch (error) {
          process.emitWarning(`无法停止内置浏览器下载 ${item.status.id}: ${(error as NodeJS.ErrnoException).code ?? "engine"}`);
        }
      }
      try {
        await item.source.cleanup();
      } catch (error) {
        process.emitWarning(`无法清理内置浏览器下载 ${item.status.id}: ${(error as NodeJS.ErrnoException).code ?? "engine"}`);
      }
    })();
    this.releasing.set(item, completion);
    void completion.then(() => this.releasing.delete(item));
    return completion;
  }
}
