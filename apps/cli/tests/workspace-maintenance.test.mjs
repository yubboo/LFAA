/**
 * 功能：长期回归源码构建对账和纯净源码备份。
 * 作用：在独立临时工作区验证过期检测、构建期间变更拒绝、敏感文件排除和输出边界。
 * 关联文件：scripts/runtime-build-state.mjs、scripts/backup-project.ps1、lfaa.bat。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runtimeBuildFingerprint, recordRuntimeBuild, staleRuntimeBuilds } from "../../../scripts/runtime-build-state.mjs";

const repository = fileURLToPath(new URL("../../../", import.meta.url));
function fixture(t) {
  const root = mkdtempSync(join(repository, "dist/.tmp/workspace-maintenance-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  function put(path, contents = "source") { const target = join(root, path); mkdirSync(resolve(target, ".."), { recursive: true }); writeFileSync(target, contents); }
  put("package.json", JSON.stringify({ name: "lfaa" }));
  put("pnpm-lock.yaml"); put("pnpm-workspace.yaml");
  put("packages/host/example/package.json", "{}"); put("packages/host/example/src/index.ts");
  put("packages/client/example/package.json", "{}"); put("packages/client/example/src/index.ts");
  put("packages/test-support/example/package.json", "{}");
  put("apps/web/index.html"); put("apps/cli/src/index.ts");
  put("scripts/build-harness.mjs");
  put("dist/apps/web/index.html"); put("dist/apps/control-plane/index.js");
  return { root, put };
}

test("启动对账只重建过期职责，客户端、运行数据和测试夹具不污染控制端指纹", t => {
  const { root, put } = fixture(t);
  assert.deepEqual(staleRuntimeBuilds("web", root), ["host", "web"]);
  recordRuntimeBuild("host", root); recordRuntimeBuild("web", root);
  assert.deepEqual(staleRuntimeBuilds("web", root), []);
  put("data/database/runtime.sqlite", "private"); put(".env", "private");
  put("packages/host/example/data/private", "private"); put("packages/test-support/example/fixture", "test");
  assert.deepEqual(staleRuntimeBuilds("web", root), []);
  put("packages/client/example/src/index.ts", "client changed");
  assert.deepEqual(staleRuntimeBuilds("web", root), ["web"]);
  assert.deepEqual(staleRuntimeBuilds("daemon", root), []);
  put("packages/host/example/src/index.ts", "host changed");
  assert.deepEqual(staleRuntimeBuilds("web", root), ["host", "web"]);
});

test("构建期间源码变化不得记为新输出；损坏或缺失记录要求重建", t => {
  const { root, put } = fixture(t);
  const before = runtimeBuildFingerprint("host", root);
  put("apps/cli/src/index.ts", "changed during build");
  assert.throws(() => recordRuntimeBuild("host", root, before), /构建期间源码发生变化/u);
  assert.deepEqual(staleRuntimeBuilds("daemon", root), ["host"]);
  recordRuntimeBuild("host", root);
  put("dist/apps/control-plane/build-state.json", "broken");
  assert.deepEqual(staleRuntimeBuilds("daemon", root), ["host"]);
});

test("Web 源码指纹忽略 Vite 时间戳配置临时 bundle，但保留真实源码变化", t => {
  const { root, put } = fixture(t);
  put("apps/web/vite.config.ts");
  const before = runtimeBuildFingerprint("web", root);
  put("apps/web/vite.config.ts.timestamp-1791108375133-d82a20ccc456c8.mjs", "temporary config bundle");
  assert.equal(runtimeBuildFingerprint("web", root), before);
  put("apps/web/src/main.ts", "real application source");
  const afterSourceChange = runtimeBuildFingerprint("web", root);
  assert.notEqual(afterSourceChange, before);
  put("apps/web/vite.config.ts.timestamp-not-a-vite-hash.mjs", "not the generated filename format");
  assert.notEqual(runtimeBuildFingerprint("web", root), afterSourceChange);
});

test("Windows 源码 ZIP 排除 Git、实际数据、秘密及 dist，并拒绝越界输出", { skip: process.platform !== "win32" }, t => {
  const { root, put } = fixture(t);
  for (const path of ["packages/client/.gitkeep", "packages/boot/app-boot/.gitkeep", "packages/host/daemon/.gitkeep", "native/system/.gitkeep", "开发规范.md", "AGENTS.md"]) put(path);
  put("docs/updata-log.md", '- **项目版本：** `LFAA 0.1.1`');
  put(".git", "gitdir: private-path"); put(".env", "LFAA_DATA_DIR=private-runtime"); put(".env.example", "LFAA_DATA_DIR=data");
  put("private-runtime/credentials/token.json", "private"); put("data/database/private.sqlite", "private");
  put("apps/cli/data/private.json", "private"); put("node_modules/private.js", "dependency");
  put("config/.npmrc", "private"); put("config/id_ed25519", "private"); put("dist/backups/old.zip", "old");
  cpSync(join(repository, "scripts/backup-project.ps1"), join(root, "scripts/backup-project.ps1"));
  const ownerPath = "packages/util/home-paths/src";
  cpSync(join(repository, ownerPath), join(root, ownerPath), { recursive: true });
  const invocation = ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(root, "scripts/backup-project.ps1")];
  const environment = { ...process.env, LFAA_DATA_DIR: join(root, "private-runtime") };
  const result = spawnSync("powershell.exe", invocation, { cwd: root, env: environment, encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const archivePath = join(root, "dist/backups/LFAA 0.1.1.zip");
  const inspect = spawnSync("powershell.exe", ["-NoProfile", "-Command", "Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip = [IO.Compression.ZipFile]::OpenRead($env:LFAA_TEST_ARCHIVE); try { ConvertTo-Json -InputObject @($zip.Entries | ForEach-Object { $_.FullName }) -Compress } finally { $zip.Dispose() }"], { env: { ...environment, LFAA_TEST_ARCHIVE: archivePath }, encoding: "utf8", windowsHide: true });
  assert.equal(inspect.status, 0, inspect.stderr);
  const paths = JSON.parse(inspect.stdout);
  assert(paths.some(path => path.endsWith("/.env.example")));
  assert(paths.some(path => path.endsWith("/packages/client/.gitkeep")));
  assert(paths.every(path => !path.includes("\\") && !/\/(\.git|data|private-runtime|dist|node_modules)\//u.test(path)));
  assert(paths.every(path => !/\/(\.env|\.git|\.npmrc|id_ed25519)$/u.test(path)));
  assert.equal(readdirSync(join(root, "dist/.tmp/backup-project")).filter(name => name !== "backup.lock").length, 0);
  const refused = spawnSync("powershell.exe", [...invocation, "-BackupRoot", join(root, "outside")], { cwd: root, env: environment, encoding: "utf8", windowsHide: true });
  assert.notEqual(refused.status, 0);
  assert.equal(readFileSync(join(root, "dist/backups/old.zip"), "utf8"), "old");
});
