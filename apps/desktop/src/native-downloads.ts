// Electron 主进程下载适配：暂存来自内置视图的文件，并用桌面宿主私有 IPC 报告下载事件。
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import type { DownloadItem, Event, WebContents } from "electron";

export type DesktopDownloadMessage =
  | { type: "download:start"; id: string; sessionId: string; url: string; sourceUrl: string; filename: string }
  | { type: "download:done"; id: string; state: string };

export interface DesktopDownloadChannel {
  directory: string;
  send(message: DesktopDownloadMessage): boolean;
  onControl(listener: (operation: "cancel" | "release", id: string) => void): () => void;
}

export function attachNativeDownloads(
  contents: WebContents,
  getSessionId: () => string | undefined,
  channel: DesktopDownloadChannel,
): () => void {
  const downloads = new Map<string, { item: DownloadItem; done: boolean; release: boolean }>();
  const session = contents.session;

  const disposeFile = (id: string) => {
    const path = join(channel.directory, id);
    void Promise.all([rm(path, { force: true }), rm(`${path}.crdownload`, { force: true })])
      .catch((error: NodeJS.ErrnoException) => process.emitWarning(`无法清理 Electron 下载 ${id}: ${error.code ?? "fs"}`));
  };
  const off = channel.onControl((operation, id) => {
    const entry = downloads.get(id);
    if (!entry) return;
    if (operation === "release") entry.release = true;
    if (entry.done && entry.release) {
      downloads.delete(id);
      disposeFile(id);
    } else if (operation === "cancel" && !entry.done) {
      entry.item.cancel();
    }
  });

  const onDownload = (event: Event, item: DownloadItem, source: WebContents) => {
    if (source !== contents) return;
    const sessionId = getSessionId();
    if (!sessionId) {
      event.preventDefault();
      return;
    }
    const id = randomUUID();
    const accepted = channel.send({
      type: "download:start", id, sessionId, url: item.getURL(),
      sourceUrl: item.getInitiatorOrigin() || source.getURL(), filename: item.getFilename(),
    });
    if (!accepted) {
      event.preventDefault();
      return;
    }
    item.setSavePath(join(channel.directory, id));
    const entry = { item, done: false, release: false };
    downloads.set(id, entry);
    item.once("done", (_event, state) => {
      entry.done = true;
      const delivered = channel.send({ type: "download:done", id, state });
      if (entry.release || !delivered) {
        downloads.delete(id);
        disposeFile(id);
      }
    });
  };
  session.on("will-download", onDownload);
  return () => {
    session.off("will-download", onDownload);
    off();
    for (const [id, entry] of downloads) {
      entry.release = true;
      if (entry.done) disposeFile(id);
      else entry.item.cancel();
    }
    downloads.clear();
  };
}
