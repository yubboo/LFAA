// 桌面宿主的私有下载 IPC。校验消息并把 Electron 暂存文件交给浏览器服务，HTTP 客户端无法发布该消息。
import { join } from "node:path";
import type { BrowserService } from "@lfaa/browser";

type Reply = { type: "download:cancel" | "download:release"; id: string };
type Pending = (state: string) => void;

function isDownloadId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/u.test(value);
}

export function createDesktopDownloadReceiver(directory: string, getBrowser: () => BrowserService | undefined) {
  const pending = new Map<string, Pending>();

  return (message: unknown, send: (reply: Reply) => void): void => {
    if (typeof message !== "object" || message === null) return;
    const data = message as Record<string, unknown>;
    const { id, type } = data;
    if (!isDownloadId(id)) return;

    if (type === "download:done" && typeof data.state === "string") {
      pending.get(id)?.(data.state);
      return;
    }
    if (type !== "download:start" || pending.has(id)) return;
    const { url, sourceUrl, filename, sessionId } = data;
    const browser = getBrowser();
    if (!browser || typeof sessionId !== "string" || !sessionId || sessionId.length > 256
        || typeof filename !== "string" || filename.length > 4096
        || typeof url !== "string" || typeof sourceUrl !== "string") {
      send({ type: "download:cancel", id });
      send({ type: "download:release", id });
      return;
    }

    const path = join(directory, id);
    const completion = new Promise<string>((resolve, reject) => {
      pending.set(id, (state) => {
        if (state === "completed") resolve(path);
        else reject(new Error("Electron 下载未完成。"));
      });
    });
    void completion.catch(() => undefined);
    browser.downloads.start(sessionId, {
      url,
      sourceUrl,
      filename,
      path: () => completion,
      cancel: async () => { send({ type: "download:cancel", id }); },
      cleanup: async () => {
        pending.get(id)?.("cancelled");
        pending.delete(id);
        send({ type: "download:release", id });
      },
    }, id);
  };
}
