/**
 * 功能：长期回归源码构建对账和纯净源码备份。
 * 作用：在独立临时工作区验证过期检测、构建期间变更拒绝、敏感文件排除和输出边界。
 * 关联文件：scripts/runtime-build-state.mjs、scripts/backup-project.ps1、lfaa.bat。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runtimeBuildFingerprint, recordRuntimeBuild, staleRuntimeBuilds } from "../../../scripts/runtime-build-state.mjs";

const repository = fileURLToPath(new URL("../../../", import.meta.url));
function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0, result.stderr || result.stdout || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

function createUpdateFixture(t) {
  const root = mkdtempSync(join(repository, "dist/.tmp/project-update-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const remote = join(root, "origin.git");
  const local = join(root, "local");
  const writer = join(root, "writer");
  mkdirSync(local, { recursive: true });
  git(root, ["init", "--bare", "--initial-branch=main", remote]);
  git(local, ["init", "--initial-branch=main"]);
  git(local, ["config", "user.name", "LFAA Update Fixture"]);
  git(local, ["config", "user.email", "update-fixture@example.invalid"]);
  writeFileSync(join(local, ".gitignore"), "/data/\n.env\n");
  writeFileSync(join(local, "package.json"), JSON.stringify({ name: "lfaa-update-fixture" }));
  writeFileSync(join(local, ".env"), "LFAA_DATA_DIR=data\n");
  mkdirSync(join(local, "data"), { recursive: true });
  writeFileSync(join(local, "data", "must-survive.txt"), "local user data\n");
  git(local, ["add", ".gitignore", "package.json"]);
  git(local, ["commit", "-m", "initial source"]);
  git(local, ["remote", "add", "origin", remote]);
  git(local, ["push", "--set-upstream", "origin", "main"]);
  git(root, ["clone", "--branch", "main", remote, writer]);
  git(writer, ["config", "user.name", "LFAA Update Fixture"]);
  git(writer, ["config", "user.email", "update-fixture@example.invalid"]);

  const { LFAA_DATA_DIR: _lfaaDataDir, LFAA_HOME: _lfaaHome, ...childEnvironment } = process.env;
  return { root, remote, local, writer, childEnvironment };
}

function updateProject(fixture, yes = true) {
  const args = ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(repository, "scripts/update-project.ps1"), "-ProjectRoot", fixture.local];
  if (yes) args.push("-Yes");
  return spawnSync("powershell.exe", args, {
    cwd: fixture.local,
    env: fixture.childEnvironment,
    encoding: "utf8",
    windowsHide: true
  });
}

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
  put("dist/apps/web/index.html", '<script type="module" src="/assets/app.js"></script>');
  put("dist/apps/web/assets/app.js");
  put("dist/apps/control-plane/index.js");
  put("dist/apps/control-plane/workspace.json", "[]");
  put("dist/apps/control-plane/packages/boot/app-boot/src/index.js");
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

test("构建记录存在但启动入口或 Web 静态资源缺失时仍要求补建", t => {
  const { root, put } = fixture(t);
  recordRuntimeBuild("host", root); recordRuntimeBuild("web", root);
  assert.deepEqual(staleRuntimeBuilds("web", root), []);
  rmSync(join(root, "dist/apps/control-plane/packages/boot/app-boot/src/index.js"));
  assert.deepEqual(staleRuntimeBuilds("web", root), ["host"]);
  put("dist/apps/control-plane/packages/boot/app-boot/src/index.js");
  rmSync(join(root, "dist/apps/web/assets/app.js"));
  assert.deepEqual(staleRuntimeBuilds("web", root), ["web"]);
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

test("存储布局检查显示安装 Home 与唯一有效数据根", t => {
  const root = mkdtempSync(join(repository, "dist/.tmp/storage-layout-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const home = join(root, "install-home");
  writeFileSync(join(root, ".env"), `LFAA_DATA_DIR=data\n`);
  const environment = { ...process.env, LFAA_HOME: home };
  delete environment.LFAA_DATA_DIR;

  const result = spawnSync(process.execPath, [join(repository, "scripts/resolve-data-directory.mjs"), root, "--layout"], {
    cwd: repository,
    env: environment,
    encoding: "utf8",
    windowsHide: true
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), {
    homeDirectory: home,
    pluginInstallDirectory: join(home, "profiles"),
    defaultDataDirectory: join(home, "data"),
    dataDirectory: join(root, "data")
  });
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

test("Windows 本地源码更新只快进并保留数据根内容", { skip: process.platform !== "win32" }, t => {
  const fixture = createUpdateFixture(t);
  writeFileSync(join(fixture.writer, "latest-source.ts"), "latest upstream source\n");
  git(fixture.writer, ["add", "latest-source.ts"]);
  git(fixture.writer, ["commit", "-m", "upstream update"]);
  git(fixture.writer, ["push", "origin", "main"]);

  const result = updateProject(fixture);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(readFileSync(join(fixture.local, "latest-source.ts"), "utf8").replace(/\r\n/g, "\n"), "latest upstream source\n");
  assert.equal(readFileSync(join(fixture.local, "data", "must-survive.txt"), "utf8"), "local user data\n");
  assert.equal(git(fixture.local, ["rev-parse", "HEAD"]), git(fixture.local, ["rev-parse", "origin/main"]));
  assert.equal(git(fixture.local, ["status", "--porcelain"]), "");
});

test("Windows 本地源码更新在远端 main 重写但本地仍可快进时应用最新源码", { skip: process.platform !== "win32" }, t => {
  const fixture = createUpdateFixture(t);
  const commonRevision = git(fixture.local, ["rev-parse", "HEAD"]);
  writeFileSync(join(fixture.writer, "rewound-source.ts"), "removed by rewritten history\n");
  git(fixture.writer, ["add", "rewound-source.ts"]);
  git(fixture.writer, ["commit", "-m", "upstream commit later removed"]);
  git(fixture.writer, ["push", "origin", "main"]);
  git(fixture.local, ["fetch", "origin", "refs/heads/main:refs/remotes/origin/main"]);

  git(fixture.writer, ["reset", "--hard", commonRevision]);
  writeFileSync(join(fixture.writer, "latest-source.ts"), "latest rewritten source\n");
  git(fixture.writer, ["add", "latest-source.ts"]);
  git(fixture.writer, ["commit", "-m", "replacement upstream commit"]);
  git(fixture.writer, ["push", "--force", "origin", "main"]);
  const remoteRevision = git(fixture.writer, ["rev-parse", "HEAD"]);

  const result = updateProject(fixture);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(git(fixture.local, ["rev-parse", "HEAD"]), remoteRevision);
  assert.equal(git(fixture.local, ["rev-parse", "origin/main"]), remoteRevision);
  assert.equal(readFileSync(join(fixture.local, "latest-source.ts"), "utf8").replace(/\r\n/g, "\n"), "latest rewritten source\n");
  assert.equal(existsSync(join(fixture.local, "rewound-source.ts")), false);
  assert.equal(readFileSync(join(fixture.local, "data", "must-survive.txt"), "utf8"), "local user data\n");
  assert.equal(git(fixture.local, ["status", "--porcelain"]), "");
});

test("Windows 本地源码更新先读取被重写的远端 main 并保留分叉本地历史", { skip: process.platform !== "win32" }, t => {
  const fixture = createUpdateFixture(t);
  const localRevision = git(fixture.local, ["rev-parse", "HEAD"]);
  git(fixture.writer, ["checkout", "--orphan", "replacement-main"]);
  git(fixture.writer, ["rm", "-rf", "."]);
  writeFileSync(join(fixture.writer, "package.json"), JSON.stringify({ name: "lfaa-replacement-fixture" }));
  writeFileSync(join(fixture.writer, "replacement-source.ts"), "latest rewritten source\n");
  git(fixture.writer, ["add", "-A"]);
  git(fixture.writer, ["commit", "-m", "replacement upstream history"]);
  git(fixture.writer, ["push", "--force", "origin", "replacement-main:main"]);
  const remoteRevision = git(fixture.writer, ["rev-parse", "HEAD"]);

  const result = updateProject(fixture);
  assert.notEqual(result.status, 0);
  assert.equal(git(fixture.local, ["rev-parse", "HEAD"]), localRevision);
  assert.equal(git(fixture.local, ["rev-parse", "refs/heads/main"]), localRevision);
  assert.equal(git(fixture.local, ["rev-parse", "origin/main"]), remoteRevision);
  assert.equal(git(fixture.local, ["status", "--porcelain"]), "");
});

test("Windows 当前分支已最新时仍安全快进未检出的本地 main 引用", { skip: process.platform !== "win32" }, t => {
  const fixture = createUpdateFixture(t);
  writeFileSync(join(fixture.writer, "latest-source.ts"), "latest upstream source\n");
  git(fixture.writer, ["add", "latest-source.ts"]);
  git(fixture.writer, ["commit", "-m", "upstream update"]);
  git(fixture.writer, ["push", "origin", "main"]);
  git(fixture.local, ["fetch", "origin", "refs/heads/main:refs/remotes/origin/main"]);
  git(fixture.local, ["checkout", "-b", "codex/current-source", "origin/main"]);

  const currentRevision = git(fixture.local, ["rev-parse", "HEAD"]);
  const oldMainRevision = git(fixture.local, ["rev-parse", "main"]);
  assert.notEqual(oldMainRevision, currentRevision);

  const result = updateProject(fixture);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(git(fixture.local, ["branch", "--show-current"]), "codex/current-source");
  assert.equal(git(fixture.local, ["rev-parse", "HEAD"]), currentRevision);
  assert.equal(git(fixture.local, ["rev-parse", "main"]), git(fixture.local, ["rev-parse", "origin/main"]));
  assert.equal(readFileSync(join(fixture.local, "latest-source.ts"), "utf8").replace(/\r\n/g, "\n"), "latest upstream source\n");
  assert.equal(git(fixture.local, ["status", "--porcelain"]), "");
});

test("Windows 本地源码更新在工作区有改动但没有待更新提交时成功检查并保留本地文件", { skip: process.platform !== "win32" }, t => {
  const fixture = createUpdateFixture(t);
  const before = git(fixture.local, ["rev-parse", "HEAD"]);
  writeFileSync(join(fixture.local, "unfinished-change.ts"), "keep this change\n");

  const result = updateProject(fixture);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(git(fixture.local, ["rev-parse", "HEAD"]), before);
  assert.equal(git(fixture.local, ["rev-parse", "origin/main"]), before);
  assert.equal(readFileSync(join(fixture.local, "unfinished-change.ts"), "utf8"), "keep this change\n");
});

test("Windows 本地源码更新在工作区有改动且确有更新时停止合并并保留两边内容", { skip: process.platform !== "win32" }, t => {
  const fixture = createUpdateFixture(t);
  const before = git(fixture.local, ["rev-parse", "HEAD"]);
  writeFileSync(join(fixture.local, "unfinished-change.ts"), "keep this change\n");
  writeFileSync(join(fixture.writer, "latest-source.ts"), "latest upstream source\n");
  git(fixture.writer, ["add", "latest-source.ts"]);
  git(fixture.writer, ["commit", "-m", "upstream update"]);
  git(fixture.writer, ["push", "origin", "main"]);
  const upstreamRevision = git(fixture.writer, ["rev-parse", "HEAD"]);

  const result = updateProject(fixture);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /unfinished-change\.ts/u);
  assert.equal(git(fixture.local, ["rev-parse", "HEAD"]), before);
  assert.equal(git(fixture.local, ["rev-parse", "origin/main"]), upstreamRevision);
  assert.equal(readFileSync(join(fixture.local, "unfinished-change.ts"), "utf8"), "keep this change\n");
  assert.equal(existsSync(join(fixture.local, "latest-source.ts")), false);
});

test("Windows 本地源码更新拒绝远端改动触及自定义数据根", { skip: process.platform !== "win32" }, t => {
  const fixture = createUpdateFixture(t);
  const before = git(fixture.local, ["rev-parse", "HEAD"]);
  mkdirSync(join(fixture.writer, "data"), { recursive: true });
  writeFileSync(join(fixture.writer, "data", "remote-entry.txt"), "must not replace local data\n");
  git(fixture.writer, ["add", "-f", "data/remote-entry.txt"]);
  git(fixture.writer, ["commit", "-m", "unsafe data path"]);
  git(fixture.writer, ["push", "origin", "main"]);

  const result = updateProject(fixture);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /data\/remote-entry\.txt/u);
  assert.equal(git(fixture.local, ["rev-parse", "HEAD"]), before);
  assert.equal(readFileSync(join(fixture.local, "data", "must-survive.txt"), "utf8"), "local user data\n");
  assert.equal(existsSync(join(fixture.local, "data", "remote-entry.txt")), false);
});
