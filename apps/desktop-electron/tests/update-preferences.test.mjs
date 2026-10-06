import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDesktopUpdatePreferencesStore } from "../src/update-preferences.mjs";

test("桌面更新偏好默认关闭，并可持久化读取自动更新选择", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lfaa-update-preferences-"));
  try {
    const filePath = join(directory, "update-preferences.json");
    const store = createDesktopUpdatePreferencesStore(filePath);
    assert.deepEqual(await store.read(), { autoDownloadAndInstall: false, ignoredVersion: "" });
    assert.deepEqual(await store.setAutoDownloadAndInstall(true), { autoDownloadAndInstall: true, ignoredVersion: "" });
    assert.deepEqual(await createDesktopUpdatePreferencesStore(filePath).read(), { autoDownloadAndInstall: true, ignoredVersion: "" });
    assert.throws(() => store.setAutoDownloadAndInstall("true"), /必须是布尔值/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("跳过版本只记录一个有效版本，保留其他桌面更新偏好", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lfaa-update-preferences-"));
  try {
    const filePath = join(directory, "update-preferences.json");
    const store = createDesktopUpdatePreferencesStore(filePath);
    await store.setAutoDownloadAndInstall(true);
    assert.deepEqual(await store.ignoreVersion("0.0.4"), { autoDownloadAndInstall: true, ignoredVersion: "0.0.4" });
    assert.throws(() => store.ignoreVersion("latest"), /版本无效/u);
    const persisted = JSON.parse(await readFile(filePath, "utf8"));
    assert.deepEqual(persisted, { autoDownloadAndInstall: true, ignoredVersion: "0.0.4" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("损坏或越界偏好文件安全回退为默认关闭", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lfaa-update-preferences-"));
  try {
    const filePath = join(directory, "update-preferences.json");
    const store = createDesktopUpdatePreferencesStore(filePath);
    await writeFile(filePath, "{".repeat(8_000), "utf8");
    assert.deepEqual(await store.read(), { autoDownloadAndInstall: false, ignoredVersion: "" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
