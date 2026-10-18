/** 功能：验证停止服务后的复制、手动采用与 ZIP 导入。作用：只在隔离临时目录构造 SQLite 与压缩包；关联文件：apply-data-directory-migration、extract-data-directory-archive。 */
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const script = resolve(repositoryRoot, "scripts/apply-data-directory-migration.mjs");
const root = mkdtempSync(join(tmpdir(), "lfaa-data-migration-modes-"));
const project = join(root, "project");
const source = join(root, "source");
const psPack = join(root, "pack-data.ps1");
mkdirSync(project, { recursive: true });

function createDataRoot(directory) {
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(join(directory, "database"), { recursive: true });
  mkdirSync(join(directory, "plugins", "runtime-data", "profiles", "web"), { recursive: true });
  mkdirSync(join(directory, "plugins", "profiles", "web", "example"), { recursive: true });
  mkdirSync(join(directory, "plugins", "runtime-adapters", "profiles", "web", "example"), { recursive: true });
  const database = new DatabaseSync(join(directory, "database", "lfaa.sqlite"));
  database.exec("PRAGMA user_version=1; CREATE TABLE fixture (value TEXT); INSERT INTO fixture VALUES ('intact');");
  database.close();
  writeFileSync(join(directory, "profile.json"), "{\"fixture\":true}\n");
  writeFileSync(join(directory, "plugins", "profiles", "web", "example", "package.json"), "{\"name\":\"legacy-plugin\"}\n");
  writeFileSync(join(directory, "plugins", "runtime-adapters", "profiles", "web", "example", "adapter.js"), "export {};\n");
  writeFileSync(join(directory, "plugins", "runtime-data", "profiles", "web", "settings.json"), "{}\n");
}

function writeRequest(mode, targetDirectory, archivePath) {
  const request = {
    version: 2,
    migrationId: randomUUID(),
    sourceDirectory: source,
    targetDirectory,
    mode,
    ...(archivePath ? { archivePath } : {}),
    requestedAt: new Date().toISOString()
  };
  writeFileSync(join(project, ".lfaa-data-directory.pending.json"), `${JSON.stringify(request)}\n`);
}

function applyMigration() {
  return execFileSync(process.execPath, [script, project], {
    encoding: "utf8",
    env: { ...process.env, LFAA_DATA_DIR_MANAGED_BY_LAUNCHER: "1" }
  });
}

function createZip(sourceDirectory, archivePath) {
  writeFileSync(psPack, [
    "param([string]$Source, [string]$Archive)",
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName System.IO.Compression.FileSystem",
    "[System.IO.Compression.ZipFile]::CreateFromDirectory($Source, $Archive)"
  ].join("\n"));
  execFileSync("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", psPack, sourceDirectory, archivePath], { windowsHide: true });
}

test.after(() => {
  assert.ok(root.startsWith(join(tmpdir(), "lfaa-data-migration-modes-")));
  rmSync(root, { recursive: true, force: true });
});

test("系统复制忽略旧插件目录且不复制插件运行数据，保留源目录原样", { skip: process.platform !== "win32" }, () => {
  createDataRoot(source);
  const target = join(root, "copy-target", "data");
  mkdirSync(target, { recursive: true });
  writeRequest("copy", target);
  assert.match(applyMigration(), /数据已复制并核验/u);
  assert.equal(readFileSync(join(target, "profile.json"), "utf8"), "{\"fixture\":true}\n");
  assert.equal(existsSync(join(target, "plugins")), false, "新系统数据根不会接收任何旧插件子树");
  assert.equal(existsSync(join(source, "plugins", "runtime-data", "profiles", "web", "settings.json")), true, "旧源文件留在原位");
  assert.equal(existsSync(join(source, "profile.json")), true);
});

test("用户手动复制后，系统核对时忽略旧插件目录并保留现有文件", { skip: process.platform !== "win32" }, () => {
  createDataRoot(source);
  const target = join(root, "manual-target");
  cpSync(source, target, { recursive: true, errorOnExist: true, force: false });
  writeRequest("adopt", target);
  assert.match(applyMigration(), /手动复制数据已核验并采用/u);
  assert.equal(readFileSync(join(target, "profile.json"), "utf8"), readFileSync(join(source, "profile.json"), "utf8"));
  assert.equal(existsSync(join(target, "credentials")), true, "采用标记记录在目标数据根内");
  assert.equal(existsSync(join(target, "plugins", "runtime-data", "profiles", "web", "settings.json")), true, "手动复制已经带入的旧插件数据不被删除或接管");
  assert.equal(existsSync(join(source, "profile.json")), true);
});

test("ZIP 导入忽略旧插件目录并检查数据库", { skip: process.platform !== "win32" }, () => {
  createDataRoot(source);
  const archive = join(root, "lfaa-data.zip");
  createZip(source, archive);
  const target = join(root, "archive-target", "data");
  mkdirSync(target, { recursive: true });
  writeRequest("archive", target, archive);
  assert.match(applyMigration(), /ZIP 数据已安全导入并核验/u);
  assert.equal(readFileSync(join(target, "profile.json"), "utf8"), "{\"fixture\":true}\n");
  assert.equal(existsSync(join(target, "database", "lfaa.sqlite")), true);
  assert.equal(existsSync(join(target, "plugins")), false, "导入后的新系统根不保留旧插件目录");
  assert.equal(existsSync(join(source, "plugins", "runtime-data", "profiles", "web", "settings.json")), true, "源目录数据不受 ZIP 导入影响");
  assert.equal(readdirSync(target).includes("credentials"), true);
});
