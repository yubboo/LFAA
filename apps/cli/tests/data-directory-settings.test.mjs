/** 功能：回归独立系统数据根及业务内容位置边界。作用：只使用隔离目录，证明内容设置不能迁移系统账户数据。关联文件：home-paths、workspace/data-directory、settings/project-storage、content-storage-migration。 */
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveDataDirectory } from "../../../packages/util/home-paths/src/resolve-data-directory.mjs";
const root = mkdtempSync(join(tmpdir(), "lfaa-data-settings-test-"));
const userProfile = join(root, "user");
const home = join(root, "home");
mkdirSync(userProfile, { recursive: true });
mkdirSync(home, { recursive: true });
const source = join(root, "source", "data"); mkdirSync(source, { recursive: true });
const project = join(root, "project"); mkdirSync(project);
process.env.NODE_ENV = "development";
process.env.USERPROFILE = userProfile;
process.env.LFAA_HOME = home;
process.env.LFAA_DATA_DIR = source;
process.env.LFAA_DATA_DIR_MANAGED_BY_LAUNCHER = "1";
process.env.LFAA_DATA_DIRECTORY_MIGRATION_SUPPORTED = "0";
process.env.LFAA_LOCAL_MODE = "true";
process.env.SERVER_HOST = "127.0.0.1";
process.env.SERVER_PORT = "3193";
process.env.LFAA_DATA_DIRECTORY_MIGRATION_REQUEST_PATH = join(project, ".lfaa-data-directory.pending.json");
const { configuration } = await import("lfaa-storage-domain/src/configuration.js");
const { sessionRecords } = await import("lfaa-session-persistence-jsonl/src/repository.js");
const { database, closeDatabase } = await import("lfaa-storage-sqlite/src/database.js");
const { retireLegacyFileTables } = await import("lfaa-storage-domain/src/migration.js"); retireLegacyFileTables();
const service = await import("lfaa-workspace-data-directory/src/service.js");
const { config } = await import("lfaa-launch-environment/src/config.js");
config.repositoryRoot = project;
config.desktopInstallDirectory = null;
const projectStorage = await import("lfaa-settings/src/project-storage.js");
test("空白配置数据根在控制端启动时建立标准分类，不虚构账户、游戏或业务数据", () => {
  const categories = ["database", "users", "sessions", "credentials", "games", "environments", "lib", "cache", "tmp", "logs", "backups", "models", "connectivity", "storages"];
  for (const category of categories) {
    const directory = join(source, category);
    const info = lstatSync(directory);
    assert.ok(info.isDirectory() && !info.isSymbolicLink(), `${category} 应在启动时建立为真实目录`);
  }
  assert.deepEqual(readdirSync(join(source, "users")), []);
  assert.deepEqual(readdirSync(join(source, "games")), []);
  assert.equal(existsSync(join(source, "plugins")), false, "插件安装与私有数据由 LFAA_HOME/Profile 管理，不属于系统 data 根");
});
let closed = false;
function closeStorage() { if (!closed) { configuration.close(); sessionRecords.close(); closeDatabase(); closed = true; } }
after(() => { closeStorage(); assert.ok(root.startsWith(join(tmpdir(), "lfaa-data-settings-test-"))); rmSync(root, { recursive: true, force: true }); });
test("未配置系统根使用用户 .lfaa Home，不随项目盘符或可移动盘变化；显式路径保持", () => {
  for (const project of ["C:\\LFAA", "D:\\apps\\LFAA", "H:\\LFAA"]) for (const driveType of ["Fixed", "Removable"]) assert.equal(resolveDataDirectory(project, "", { platform: "win32", userProfile: "C:\\Users\\Administrator", lfaaHome: "", driveType }), "C:\\Users\\Administrator\\.lfaa");
  assert.equal(resolveDataDirectory("D:\\LFAA", "", { platform: "win32", userProfile: "C:\\Users\\Administrator", lfaaHome: "" }), "C:\\Users\\Administrator\\.lfaa");
  assert.equal(resolveDataDirectory("D:\\LFAA", "data", { platform: "win32", userProfile: "C:\\Users\\Administrator" }), "D:\\LFAA\\data");
  assert.equal(resolveDataDirectory("D:\\LFAA", "E:\\Storage\\data", { platform: "win32" }), "E:\\Storage\\data");
});
test("系统 Home 保持固定；业务默认使用 Home/data，推荐根按项目动态解析", () => {
  const system = service.getDataDirectorySettings();
  const business = projectStorage.getProjectStorageLocations().settings;
  assert.equal(system.currentDirectory, source);
  assert.equal(system.editable, false);
  assert.equal(business.defaultContentDirectory, join(home, "data"));
  assert.equal(business.contentDirectory, join(home, "data"));
  assert.equal(business.recommendedContentDirectory, join(project, "data"));
  assert.notEqual(business.contentDirectory, system.currentDirectory);
  assert.equal(existsSync(join(project, ".lfaa-data-directory.pending.json")), false);
});
test("旧系统数据迁移入口拒绝请求且不创建目标、不触碰系统根", () => {
  const target = join(root, "forbidden-system-migration");
  const sentinel = join(source, "system-sentinel.txt");
  writeFileSync(sentinel, "system-data-stays-here");
  assert.throws(() => service.requestDataDirectoryChange(target), error => error.errorCode === "data_directory_change_unavailable");
  assert.throws(() => service.recommendDataDirectoryLocation(), error => error.errorCode === "data_directory_change_unavailable");
  assert.equal(service.getDataDirectorySettings().pendingDirectory, null);
  assert.equal(existsSync(target), false);
  assert.equal(existsSync(join(project, ".lfaa-data-directory.pending.json")), false);
  assert.equal(readFileSync(sentinel, "utf8"), "system-data-stays-here");
});
