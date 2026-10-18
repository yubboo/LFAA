/** 功能：回归业务内容位置复制、手动核对与 ZIP 归档。作用：仅在独立临时 Home 内操作合成游戏/小说/漫剧文件。关联文件：settings/project-storage、content-storage-migration、业务 ZIP PowerShell 脚本。 */
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const testRoot = await mkdtemp(join(tmpdir(), "lfaa-business-content-migration-"));
const homeDirectory = join(testRoot, "home");
const systemDataDirectory = join(testRoot, "system-data");
process.env.NODE_ENV = "test";
process.env.LFAA_HOME = homeDirectory;
process.env.LFAA_DATA_DIR = systemDataDirectory;

const { config } = await import("lfaa-launch-environment/src/config.js");
const { configuration } = await import("lfaa-storage-domain/src/configuration.js");
const { closeDatabase } = await import("lfaa-storage-sqlite/src/database.js");
const storage = await import("lfaa-settings/src/project-storage.js");
const migration = await import("lfaa-settings/src/content-storage-migration.js");

const sourceDirectory = join(homeDirectory, "data");
const accountHash = "a".repeat(64);
const writingFile = `users/${accountHash}/projects/writing/book/chapters/001.md`;
const dramaFile = `users/${accountHash}/projects/aivideo/project-1/project.json`;

storage.saveProjectContentDirectory(sourceDirectory);

async function createBusinessFixtures(root) {
  await mkdir(join(root, "games", "minecraft", "world"), { recursive: true });
  await mkdir(join(root, "users", accountHash, "projects", "writing", "book", "chapters"), { recursive: true });
  await mkdir(join(root, "users", accountHash, "projects", "aivideo", "project-1"), { recursive: true });
  await writeFile(join(root, "games", "minecraft", "world", "level.dat"), "synthetic-world");
  await writeFile(join(root, writingFile), "synthetic-writing");
  await writeFile(join(root, dramaFile), "synthetic-drama");
}

async function resetSource() {
  await rm(sourceDirectory, { recursive: true, force: true });
  await createBusinessFixtures(sourceDirectory);
  storage.saveProjectContentDirectory(sourceDirectory);
}

after(async () => {
  configuration.close();
  closeDatabase();
  assert.ok(resolve(testRoot).startsWith(resolve(tmpdir())));
  await rm(testRoot, { recursive: true, force: true });
});

test("manifest limits operations to game, Writing and AI Video content", async () => {
  await resetSource();
  await mkdir(join(systemDataDirectory, "database"), { recursive: true });
  await writeFile(join(systemDataDirectory, "database", "system-sentinel.sqlite"), "system-secret-sentinel");
  await mkdir(join(homeDirectory, "profiles", "desktop"), { recursive: true });
  await writeFile(join(homeDirectory, "profiles", "desktop", "profile-sentinel.json"), "profile-sentinel");

  const entries = await migration.collectProjectContentManifest(sourceDirectory);
  assert.ok(entries.some(entry => entry.path === "games"));
  assert.ok(entries.some(entry => entry.path === writingFile));
  assert.ok(entries.some(entry => entry.path === dramaFile));
  assert.equal(entries.some(entry => entry.path.includes("system-sentinel")), false);
  assert.equal(entries.some(entry => entry.path.includes("profile-sentinel")), false);
  assert.throws(() => migration.assertProjectContentTarget(systemDataDirectory), /系统账户/u);
  assert.throws(() => migration.assertProjectContentTarget(join(homeDirectory, "profiles", "desktop")), /插件 Profile/u);
});

test("DSH 风格的单一 Home 允许 Home/data，同时保护系统分类和插件 Profile", () => {
  const previousDataDirectory = config.dataDirectory;
  config.dataDirectory = homeDirectory;
  try {
    assert.equal(migration.assertProjectContentTarget(sourceDirectory), sourceDirectory);
    assert.throws(() => migration.assertProjectContentTarget(homeDirectory), /系统账户/u);
    assert.throws(() => migration.assertProjectContentTarget(join(homeDirectory, "database")), /系统账户/u);
    assert.throws(() => migration.assertProjectContentTarget(join(homeDirectory, "profiles", "desktop")), /插件 Profile/u);
  } finally {
    config.dataDirectory = previousDataDirectory;
  }
});

test("system copy backs up overwritten managed content, preserves target-only files and leaves source/system data intact", async () => {
  await resetSource();
  const targetDirectory = join(testRoot, "recommended", "data");
  await mkdir(join(targetDirectory, "games", "minecraft"), { recursive: true });
  await writeFile(join(targetDirectory, "games", "minecraft", "world-old.txt"), "target-before-copy");
  await writeFile(join(targetDirectory, "notes.txt"), "target-only");
  const systemSentinel = join(systemDataDirectory, "database", "system-sentinel.sqlite");
  await mkdir(join(systemDataDirectory, "database"), { recursive: true });
  await writeFile(systemSentinel, "system-data-stays-put");

  const result = await migration.copyProjectContentToDirectory(targetDirectory);
  assert.equal(result.settings.settings.contentDirectory, targetDirectory);
  assert.equal(result.comparison.differences.some(item => item.kind === "missing" || item.kind === "hash"), false);
  assert.ok(result.backupDirectory);
  assert.equal(await readFile(join(result.backupDirectory, "games", "minecraft", "world-old.txt"), "utf8"), "target-before-copy");
  assert.equal(await readFile(join(targetDirectory, "notes.txt"), "utf8"), "target-only");
  assert.equal(await readFile(join(targetDirectory, writingFile), "utf8"), "synthetic-writing");
  assert.equal(await readFile(join(sourceDirectory, writingFile), "utf8"), "synthetic-writing");
  assert.equal(await readFile(systemSentinel, "utf8"), "system-data-stays-put");
  assert.equal(await readdir(join(systemDataDirectory, "database")).then(items => items.includes("system-sentinel.sqlite")), true);
});

test("manual copy switches only after an exact path, type, size and SHA-256 comparison", async () => {
  await resetSource();
  const targetDirectory = join(testRoot, "manual", "data");
  await mkdir(targetDirectory, { recursive: true });
  await cp(sourceDirectory, targetDirectory, { recursive: true });
  const matching = await migration.compareProjectContentDirectories(targetDirectory);
  assert.equal(matching.matching, true);
  const adopted = await migration.adoptProjectContentDirectory(targetDirectory);
  assert.equal(adopted.settings.settings.contentDirectory, targetDirectory);

  await storage.saveProjectContentDirectory(sourceDirectory);
  await writeFile(join(targetDirectory, writingFile), "changed-after-manual-copy");
  await assert.rejects(migration.adoptProjectContentDirectory(targetDirectory), /核对未通过/u);
  assert.equal(storage.getProjectStorageLocations().settings.contentDirectory, sourceDirectory);
});

test("ZIP export and import move only allowlisted business content", { skip: process.platform !== "win32" }, async () => {
  await resetSource();
  const systemSentinel = join(systemDataDirectory, "database", "system-sentinel.sqlite");
  await mkdir(join(systemDataDirectory, "database"), { recursive: true });
  await writeFile(systemSentinel, "never-archive-system-data");
  const archive = await migration.createProjectContentArchive();
  try {
    assert.match(archive.fileName, /^lfaa-business-content-.*\.zip$/u);
    const targetDirectory = join(testRoot, "archive-import", "data");
    const imported = await migration.importProjectContentArchive(archive.path, targetDirectory);
    assert.equal(imported.settings.settings.contentDirectory, targetDirectory);
    assert.equal(await readFile(join(targetDirectory, writingFile), "utf8"), "synthetic-writing");
    assert.equal(await readFile(join(targetDirectory, dramaFile), "utf8"), "synthetic-drama");
    assert.equal(await readFile(join(targetDirectory, "games", "minecraft", "world", "level.dat"), "utf8"), "synthetic-world");
    assert.equal(await readFile(systemSentinel, "utf8"), "never-archive-system-data");
    const importedPaths = await migration.collectProjectContentManifest(targetDirectory);
    assert.equal(importedPaths.some(entry => entry.path.includes("system-sentinel")), false);
  } finally { await archive.cleanup(); }
});

