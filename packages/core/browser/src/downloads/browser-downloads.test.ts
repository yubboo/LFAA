// 浏览器下载回归：验证规则、同名并发落盘、确认归属及真实 Chromium 附件导航。
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { setTimeout as wait } from "node:timers/promises";
import { promisify } from "node:util";
import { chromium } from "playwright-core";
import { detectLocalBrowserExecutable } from "../runtime-utils";
import { BrowserDataStore } from "../settings/browser-data-store";
import { DEFAULT_SETTINGS } from "../settings/browser-settings";
import { BrowserDownloads } from "./browser-downloads";
import { downloadFilename } from "./download-file";
import { resolveDownloadPolicy } from "./download-policy";
import { attachPlaywrightDownloads, navigateOrDownload } from "./playwright-download";

test("下载规则匹配真实域名，来源禁止优先，文件名不能含路径和设备名", () => {
  const config = {
    ...DEFAULT_SETTINGS,
    defaultDownloadPolicy: "ask" as const,
    siteRules: [
      { id: "1", pattern: "downloads.test", browse: "allow" as const, download: "allow" as const },
      { id: "2", pattern: "*.blocked.test", browse: "allow" as const, download: "block" as const },
    ],
  };
  assert.equal(resolveDownloadPolicy(config, "https://downloads.test/a?token=1").url, "https://downloads.test/a");
  assert.equal(resolveDownloadPolicy(config, "https://fake.test/downloads.test").decision, "ask");
  assert.equal(resolveDownloadPolicy(config, "https://downloads.test/a", "https://sub.blocked.test").decision, "block");
  assert.equal(resolveDownloadPolicy(config, "blob:https://downloads.test/abc").decision, "allow");
  assert.equal(resolveDownloadPolicy({ ...config, defaultDownloadPolicy: "allow" }, "data:text/plain,x").decision, "ask");
  assert.equal(downloadFilename("../folder\\COM1.txt"), "_COM1.txt");
});

async function eventually(check: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (check()) return;
    await wait(20);
  }
  assert.ok(check(), "等待下载状态超时");
}

test("下载仅由所属会话确认，同名并发不覆盖，历史写入幂等", async () => {
  const root = await mkdtemp(join(tmpdir(), "lfaa-downloads-test-"));
  const destination = join(root, "save");
  const staging = join(root, "stage");
  await writeFile(staging, "fixture");
  const store = new BrowserDataStore(root);
  const downloads = new BrowserDownloads(async () => ({ ...DEFAULT_SETTINGS, downloadDir: destination }), store);
  const source = {
    url: "https://files.test/file",
    filename: "report.txt",
    path: async () => staging,
    cancel: async () => undefined,
    cleanup: async () => undefined,
  };
  try {
    const first = downloads.start("first", source);
    const second = downloads.start("second", source);
    await eventually(() => downloads.list().every((item) => item.state === "awaiting"));
    assert.throws(() => downloads.decide("second", first, "save"), /不属于/);
    await downloads.chooseLocation("first", first, async (dir) => {
      assert.equal(dir, destination);
      return { cancelled: true };
    }).then(() => assert.fail("未启用询问位置时不能选目录"), (error: Error) => assert.match(error.message, /更改/));
    downloads.decide("first", first, "save");
    assert.throws(() => downloads.decide("first", first, "save"), /已处理/);
    downloads.decide("second", second, "save");
    await eventually(() => downloads.list().every((item) => item.state === "saved"));
    assert.deepEqual((await readdir(destination)).sort(), ["report (1).txt", "report.txt"]);
    assert.equal(await readFile(join(destination, "report.txt"), "utf8"), "fixture");
    const otherHost = new BrowserDataStore(root);
    const items = await otherHost.listDownloads();
    assert.equal(items.length, 2);
    const item = items[0]!;
    const again = await otherHost.recordDownload(item, item.id);
    assert.equal(again.id, item.id);
    assert.equal((await store.listDownloads()).length, 2);
    await otherHost.removeDownload(item.id);
    assert.equal(await readFile(item.savePath, "utf8"), "fixture");
  } finally {
    await downloads.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("独立 Host 进程并发写历史不会丢记录", async () => {
  const root = await mkdtemp(join(tmpdir(), "lfaa-download-lock-"));
  const moduleUrl = new URL("../settings/browser-data-store.ts", import.meta.url).href;
  const program = `
    const { BrowserDataStore } = await import(process.argv[1]);
    const store = new BrowserDataStore(process.argv[2]);
    const prefix = process.argv[3];
    for (let i = 0; i < 6; i++) {
      const id = prefix + i;
      await store.recordDownload({ url: "http://localhost", filename: id, savePath: "" }, id);
    }
  `;
  const run = promisify(execFile);
  try {
    await Promise.all(["desktop", "web"].map((prefix) => run(process.execPath, [
      "--import", "tsx", "--input-type=module", "-e", program, moduleUrl, root, prefix,
    ])));
    const history = await new BrowserDataStore(root).listDownloads();
    assert.equal(history.length, 12);
    assert.equal(new Set(history.map((item) => item.id)).size, 12);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("真实 Chromium 下载事件覆盖直接导航与新窗口，取消时不写历史", async (t) => {
  const executablePath = detectLocalBrowserExecutable(DEFAULT_SETTINGS);
  if (!executablePath) {
    t.skip("本机缺少 Edge 或 Chrome");
    return;
  }
  const root = await mkdtemp(join(tmpdir(), "lfaa-download-browser-"));
  const server = createServer((request, response) => {
    if (request.url === "/file") {
      response.setHeader("Content-Disposition", 'attachment; filename="fixture.txt"');
      response.end("fixture");
      return;
    }
    response.setHeader("Content-Type", "text/html");
    response.end('<a href="/file" target="_blank">Download fixture</a>');
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}`;
  const store = new BrowserDataStore(root);
  const downloads = new BrowserDownloads(async () => ({
    ...DEFAULT_SETTINGS, askBeforeDownload: true, downloadDir: join(root, "default"),
  }), store);
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const context = await browser.newContext({ acceptDownloads: true });
    attachPlaywrightDownloads(context, "web", downloads);
    const page = await context.newPage();
    assert.equal(await navigateOrDownload(page, `${url}/file`), true);
    await eventually(() => downloads.list()[0]?.state === "awaiting");
    const first = downloads.list()[0]!;
    const chosen = join(root, "chosen");
    await downloads.chooseLocation("web", first.id, async () => ({ cancelled: false, path: chosen }));
    downloads.decide("web", first.id, "save");
    await eventually(() => downloads.list()[0]?.state === "saved");
    assert.equal(await readFile(join(chosen, "fixture.txt"), "utf8"), "fixture");

    await page.goto(url);
    await page.getByRole("link", { name: "Download fixture" }).click();
    await eventually(() => downloads.list().some((item) => item.state === "awaiting"));
    const pending = downloads.list().find((item) => item.state === "awaiting")!;
    downloads.decide("web", pending.id, "cancel");
    assert.equal((await store.listDownloads()).length, 1);
  } finally {
    await downloads.close();
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(root, { recursive: true, force: true });
  }
});
