// 内置浏览器设置回归：下载位置跟随系统「下载」目录、旧默认值迁移、自定义与恢复默认。
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { BrowserSettingsStore } from "./browser-settings";

interface StoreFixture {
  root: string;
  settingsFile: string;
  systemDir: string;
  store: BrowserSettingsStore;
}

/** 每个用例用独立临时目录与固定系统下载目录，避免依赖真实 Windows/macOS 路径。 */
async function createFixture(): Promise<StoreFixture> {
  const root = await mkdtemp(join(tmpdir(), "lfaa-browser-settings-"));
  const settingsFile = join(root, "browser-settings.json");
  const systemDir = join(root, "system-downloads");
  const store = new BrowserSettingsStore(settingsFile, { systemDownloadsDir: async () => systemDir });
  return { root, settingsFile, systemDir, store };
}

async function readStoredValue(settingsFile: string, key: string): Promise<unknown> {
  const parsed = JSON.parse(await readFile(settingsFile, "utf8")) as Record<string, unknown>;
  return parsed[key];
}

async function readStoredDownloadDir(settingsFile: string): Promise<string> {
  const value = await readStoredValue(settingsFile, "downloadDir");
  return typeof value === "string" ? value : "";
}

test("默认下载位置自动解析为本机系统「下载」目录，且不落盘该路径", async () => {
  const fixture = await createFixture();
  try {
    const config = await fixture.store.get();
    assert.equal(config.downloadDir, fixture.systemDir);
    assert.equal(await fixture.store.getDownloadDirSource(), "system");
    await fixture.store.update({ askBeforeDownload: true });
    assert.equal(await readStoredDownloadDir(fixture.settingsFile), "");
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("旧版本写死的 %USERPROFILE%/Downloads 自动迁移为跟随系统目录", async () => {
  const fixture = await createFixture();
  try {
    await writeFile(fixture.settingsFile, JSON.stringify({ downloadDir: join(homedir(), "Downloads") }), "utf8");
    assert.equal((await fixture.store.get()).downloadDir, fixture.systemDir);
    assert.equal(await fixture.store.getDownloadDirSource(), "system");
    // 再次保存设置时把旧默认值从磁盘清掉，换机后不会再显示别人的目录。
    await fixture.store.update({ showFullUrl: true });
    assert.equal(await readStoredDownloadDir(fixture.settingsFile), "");
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("其他机器遗留的 <用户>/Downloads 在本机不存在时回落到系统目录", async () => {
  const fixture = await createFixture();
  try {
    const ghost = process.platform === "win32"
      ? `C:\\Users\\lfaa-ghost-${randomUUID()}\\Downloads`
      : `/home/lfaa-ghost-${randomUUID()}/Downloads`;
    await writeFile(fixture.settingsFile, JSON.stringify({ downloadDir: ghost }), "utf8");
    assert.equal((await fixture.store.get()).downloadDir, fixture.systemDir);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("自定义下载目录原样保存并作为生效路径", async () => {
  const fixture = await createFixture();
  try {
    const custom = join(fixture.root, "browser-downloads");
    const { config } = await fixture.store.update({ downloadDir: custom });
    assert.equal(config.downloadDir, custom);
    assert.equal(await fixture.store.getDownloadDirSource(), "custom");
    assert.equal(await readStoredDownloadDir(fixture.settingsFile), custom);

    const reopened = new BrowserSettingsStore(fixture.settingsFile, { systemDownloadsDir: async () => fixture.systemDir });
    assert.equal((await reopened.get()).downloadDir, custom);
    assert.equal(await reopened.getDownloadDirSource(), "custom");
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("重新选回系统「下载」目录时按跟随系统处理，显式清空同样恢复默认", async () => {
  const fixture = await createFixture();
  try {
    const custom = join(fixture.root, "picked");
    await fixture.store.update({ downloadDir: custom });
    const { config: backToSystem } = await fixture.store.update({ downloadDir: fixture.systemDir });
    assert.equal(backToSystem.downloadDir, fixture.systemDir);
    assert.equal(await readStoredDownloadDir(fixture.settingsFile), "");
    assert.equal(await fixture.store.getDownloadDirSource(), "system");

    await fixture.store.update({ downloadDir: custom });
    const { config: reset } = await fixture.store.update({ downloadDir: "" });
    assert.equal(reset.downloadDir, fixture.systemDir);
    assert.equal(await readStoredDownloadDir(fixture.settingsFile), "");
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("下载前询问保存位置默认开启，旧设置文件读取时迁移为开启", async () => {
  const fixture = await createFixture();
  try {
    assert.equal((await fixture.store.get()).askBeforeDownload, true);

    // v1 文件里存的是旧默认 false（没有 settingsVersion），升级后应变为开启。
    await writeFile(fixture.settingsFile, JSON.stringify({ askBeforeDownload: false }), "utf8");
    const legacy = new BrowserSettingsStore(fixture.settingsFile, { systemDownloadsDir: async () => fixture.systemDir });
    assert.equal((await legacy.get()).askBeforeDownload, true);

    // 迁移后用户显式关闭（落盘为 v2）必须保持关闭。
    const { config } = await legacy.update({ askBeforeDownload: false });
    assert.equal(config.askBeforeDownload, false);
    assert.equal(await readStoredValue(fixture.settingsFile, "askBeforeDownload"), false);
    assert.equal(await readStoredValue(fixture.settingsFile, "settingsVersion"), 2);
    const reopened = new BrowserSettingsStore(fixture.settingsFile, { systemDownloadsDir: async () => fixture.systemDir });
    assert.equal((await reopened.get()).askBeforeDownload, false);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("下载授权走磁盘最新值并解析出真实目录", async () => {
  const fixture = await createFixture();
  try {
    await writeFile(fixture.settingsFile, JSON.stringify({ downloadDir: join(homedir(), "Downloads") }), "utf8");
    assert.equal((await fixture.store.readForDownload()).downloadDir, fixture.systemDir);
    const custom = join(fixture.root, "latest");
    await writeFile(fixture.settingsFile, JSON.stringify({ downloadDir: custom }), "utf8");
    assert.equal((await fixture.store.readForDownload()).downloadDir, custom);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});