// 适配 Playwright 下载与附件导航。会话负责把上下文事件接入下载协调器。
import type { BrowserContext, Download, Page } from "playwright-core";
import type { BrowserDownloads } from "./browser-downloads";

export function attachPlaywrightDownloads(context: BrowserContext, sessionId: string, downloads: BrowserDownloads): void {
  const capture = (download: Download) => {
    const page = download.page();
    const sourceUrl = page.url();
    downloads.start(sessionId, {
      url: download.url(),
      sourceUrl,
      filename: download.suggestedFilename(),
      path: () => download.path(),
      cancel: () => download.cancel(),
      cleanup: () => download.delete(),
    });
  };
  context.on("download", capture);
  context.once("close", () => context.off("download", capture));
}

/** Chromium 导航到附件会中止页面导航；只有实际下载事件出现时才按下载处理。 */
export async function navigateOrDownload(page: Page, url: string): Promise<boolean> {
  let notifyDownload: (started: boolean) => void = () => undefined;
  const attachment = new Promise<boolean>((resolve) => { notifyDownload = resolve; });
  const track = () => notifyDownload(true);
  let timer: ReturnType<typeof setTimeout> | undefined;
  page.on("download", track);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25_000 });
    return false;
  } catch (error) {
    if (!(error instanceof Error) || !/Download is starting|ERR_ABORTED/iu.test(error.message)) throw error;
    // Chromium 可能先返回导航中止，再通过另一个事件报告附件。
    timer = setTimeout(() => notifyDownload(false), 1200);
    if (!await attachment) throw error;
    return true;
  } finally {
    clearTimeout(timer);
    page.off("download", track);
  }
}
