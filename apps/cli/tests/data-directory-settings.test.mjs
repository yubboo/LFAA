/** 功能：回归默认用户 data、显式位置和安全迁移。作用：只使用隔离目录和合成文件，不迁移真实用户数据。关联文件：home-paths、workspace/data-directory、apply-data-directory-migration。 */
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { lstatSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { resolveDataDirectory } from "../../../packages/util/home-paths/src/resolve-data-directory.mjs";
const root = mkdtempSync(join(tmpdir(), "lfaa-data-settings-test-"));
const source = join(root, "source", "data"); mkdirSync(source, { recursive: true });
const project = join(root, "project"); mkdirSync(project);
process.env.NODE_ENV = "test";
process.env.LFAA_DATA_DIR = source;
process.env.LFAA_DATA_DIR_MANAGED_BY_LAUNCHER = "1";
process.env.LFAA_DATA_DIRECTORY_MIGRATION_SUPPORTED = "1";
process.env.LFAA_LOCAL_MODE = "true";
process.env.LFAA_DATA_DIRECTORY_MIGRATION_REQUEST_PATH = join(project, ".lfaa-data-directory.pending.json");
const { configuration } = await import("lfaa-storage-domain/src/configuration.js");
const { sessionRecords } = await import("lfaa-session-persistence-jsonl/src/repository.js");
const { database, closeDatabase } = await import("lfaa-storage-sqlite/src/database.js");
const { retireLegacyFileTables } = await import("lfaa-storage-domain/src/migration.js"); retireLegacyFileTables();
const service = await import("lfaa-workspace-data-directory/src/service.js");
const { config } = await import("lfaa-launch-environment/src/config.js");
test("空白配置数据根在控制端启动时建立全部标准分类，不虚构账户、游戏或业务数据", () => {
  const categories = ["database", "users", "sessions", "credentials", "games", "environments", "lib", "plugins", "cache", "tmp", "logs", "backups", "models", "connectivity", "storages"];
  for (const category of categories) {
    const directory = join(source, category);
    const info = lstatSync(directory);
    assert.ok(info.isDirectory() && !info.isSymbolicLink(), `${category} 应在启动时建立为真实目录`);
  }
  assert.deepEqual(readdirSync(join(source, "users")), []);
  assert.deepEqual(readdirSync(join(source, "games")), []);
});
let closed = false;
function closeStorage() { if (!closed) { configuration.close(); sessionRecords.close(); closeDatabase(); closed = true; } }
after(() => { closeStorage(); assert.ok(root.startsWith(join(tmpdir(), "lfaa-data-settings-test-"))); rmSync(root, { recursive: true, force: true }); });
test("未配置默认用户 .lfaa/data，不随 C/D/H 盘或可移动盘变化；显式路径保持", () => {
  for (const project of ["C:\\LFAA", "D:\\apps\\LFAA", "H:\\LFAA"]) for (const driveType of ["Fixed", "Removable"]) assert.equal(resolveDataDirectory(project, "", { platform: "win32", userProfile: "C:\\Users\\Administrator", driveType }), "C:\\Users\\Administrator\\.lfaa\\data");
  assert.equal(resolveDataDirectory("D:\\LFAA", "data", { platform: "win32", userProfile: "C:\\Users\\Administrator" }), "D:\\LFAA\\data");
  assert.equal(resolveDataDirectory("D:\\LFAA", "E:\\Storage\\data", { platform: "win32" }), "E:\\Storage\\data");
});
test("默认、推荐和自定义总根分开；显式选择推荐只安排迁移，不改变当前自定义根", () => {
  const originalRoot=config.repositoryRoot, originalData=config.dataDirectory, originalHome=process.env.USERPROFILE;
  const testHome=join(root,"home"), defaultData=join(testHome,".lfaa","data");
  mkdirSync(join(defaultData,"credentials"),{recursive:true});
  try {
    process.env.USERPROFILE=testHome; config.repositoryRoot=project; config.dataDirectory=defaultData;
    const initial=service.getDataDirectorySettings();
    assert.equal(initial.defaultDirectory,defaultData);assert.equal(initial.recommendedDirectory,join(project,"data"));assert.equal(initial.selection,"default");
    const pending=service.recommendDataDirectoryLocation();
    assert.equal(pending.pendingDirectory,join(project,"data"));assert.equal(pending.currentDirectory,defaultData);assert.equal(pending.selection,"recommended");
    service.cancelDataDirectoryChange();
    config.dataDirectory=source;
    assert.equal(service.getDataDirectorySettings().selection,"custom");
    const fromCustom = service.recommendDataDirectoryLocation();
    assert.equal(fromCustom.currentDirectory, source);
    assert.equal(fromCustom.pendingDirectory, join(project, "data"));
    assert.throws(() => service.requestDataDirectoryChange(defaultData), /不是空目录/u);
    assert.equal(service.getDataDirectorySettings().pendingDirectory, join(project, "data"));
    rmdirSync(join(defaultData, "credentials"));
    const backToDefault = service.requestDataDirectoryChange(defaultData);
    assert.equal(backToDefault.selection, "default");
    assert.equal(backToDefault.currentDirectory, source);
    assert.equal(backToDefault.pendingDirectory, defaultData);
    const keptCurrent = service.requestDataDirectoryChange(source);
    assert.equal(keptCurrent.pendingDirectory, null);
    assert.equal(keptCurrent.configured, true);
  } finally {
    service.cancelDataDirectoryChange(); config.repositoryRoot=originalRoot;config.dataDirectory=originalData;
    if(originalHome===undefined)delete process.env.USERPROFILE;else process.env.USERPROFILE=originalHome;
  }
});

test("历史自定义根不叫 data 时，保留当前目录不会误建嵌套迁移", () => {
  const originalData = config.dataDirectory;
  const legacyRoot = join(root, "legacy-storage");
  mkdirSync(join(legacyRoot, "credentials"), { recursive: true });
  try {
    config.dataDirectory = legacyRoot;
    const saved = service.requestDataDirectoryChange(legacyRoot);
    assert.equal(saved.currentDirectory, legacyRoot);
    assert.equal(saved.pendingDirectory, null);
    assert.equal(saved.configured, true);
  } finally { config.dataDirectory = originalData; }
});

test("启动配置锁定位置时，默认、自定义及推荐保存均拒绝且不记录迁移", () => {
  const supported = config.dataDirectoryChangeSupported;
  try {
    config.dataDirectoryChangeSupported = false;
    assert.throws(() => service.recommendDataDirectoryLocation(), error => error.errorCode === "data_directory_change_unavailable");
    assert.throws(() => service.requestDataDirectoryChange(join(root, "locked")), error => error.errorCode === "data_directory_change_unavailable");
    assert.equal(service.getDataDirectorySettings().pendingDirectory, null);
  } finally { config.dataDirectoryChangeSupported = supported; }
});
test("手动复制采用已有目录，ZIP 导入记录归档路径，普通复制仍拒绝非空目标", () => {
  const manualTarget = join(root, "manual-copy");
  mkdirSync(manualTarget, { recursive: true });
  writeFileSync(join(manualTarget, "copied.txt"), "copied-by-user");
  const manual = service.requestDataDirectoryChange(manualTarget, "adopt");
  assert.equal(manual.pendingDirectory, manualTarget);
  assert.equal(manual.pendingMode, "adopt");
  service.cancelDataDirectoryChange();

  const archive = join(root, "backup.zip");
  writeFileSync(archive, "synthetic-zip-fixture");
  const imported = service.requestDataDirectoryChange(join(root, "archive-import"), "archive", archive);
  assert.equal(imported.pendingDirectory, join(root, "archive-import", "data"));
  assert.equal(imported.pendingMode, "archive");
  assert.equal(imported.pendingArchivePath, archive);
  service.cancelDataDirectoryChange();

  const occupiedCopyTarget = join(root, "occupied-copy", "data");
  mkdirSync(occupiedCopyTarget, { recursive: true });
  writeFileSync(join(occupiedCopyTarget, "keep.txt"), "must-not-be-overwritten");
  assert.throws(() => service.requestDataDirectoryChange(join(root, "occupied-copy"), "copy"), /不是空目录/u);
  assert.equal(service.getDataDirectorySettings().pendingDirectory, null);
});
test("确认默认位置并持久化，选择父目录自动使用 data，迁移成功才切换", () => {
  assert.equal(service.getDataDirectorySettings().currentDirectory, source);
  assert.equal(service.confirmDataDirectoryLocation().configured, true);
  const selected = join(root, "chosen-storage");
  const pending = service.requestDataDirectoryChange(selected);
  assert.equal(pending.pendingDirectory, join(selected, "data"));
  assert.equal(pending.currentDirectory, source);
  assert.throws(() => service.requestDataDirectoryChange(join(source, "nested")), /内部或上级/u);
  writeFileSync(join(source, "keep.txt"), "isolated-storage-evidence");
  closeStorage();
  const script = resolve("../../scripts/apply-data-directory-migration.mjs");
  const liveNodeLock = join(source, "credentials", "daemon.lock");
  writeFileSync(liveNodeLock, `${process.pid}\nisolated-live-node\n`);
  assert.throws(() => execFileSync(process.execPath, [script, project], { env: process.env, stdio: ["ignore", "pipe", "pipe"] }), /旧 Web 或 Daemon 仍在运行/u);
  rmSync(liveNodeLock);
  execFileSync(process.execPath, [script, project], { env: process.env, encoding: "utf8" });
  assert.equal(readFileSync(join(selected, "data", "keep.txt"), "utf8"), "isolated-storage-evidence");
  assert.equal(readFileSync(join(source, "keep.txt"), "utf8"), "isolated-storage-evidence");
  assert.ok(readFileSync(join(project, ".env"), "utf8").includes(join(selected, "data").replaceAll("\\", "/")));
});
