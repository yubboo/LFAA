/**
 * 文件：dependency-setup.test.mjs
 * 作用：验证 Windows 菜单 1 的依赖检测是“先检测、后增量同步”，不会在 unchanged 状态重复安装。
 * 负责：依赖指纹、状态缓存、差异提示、禁止自动升级、Rust 复用契约的静态防回归。
 * 不负责：在 Linux 容器执行 Windows PowerShell、访问 npm registry 或真实安装依赖。
 * 状态归属：无运行时状态；读取当前工作树脚本与 .gitignore。
 * 对外接口：Node test runner。
 * 关联文件：scripts/windows/lfaa-setup.ps1、.gitignore、package.json。
 * 修改注意事项：运行逻辑仍归 PS1；本测试只锁长期契约，禁止把依赖安装迁入 MJS。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const setup = fs.readFileSync("scripts/windows/lfaa-setup.ps1", "utf8");
const gitignore = fs.readFileSync(".gitignore", "utf8");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

function functionBody(name) {
  const startToken = `function ${name} {`;
  const start = setup.indexOf(startToken);
  assert.notEqual(start, -1, `missing PowerShell function ${name}`);
  const next = setup.indexOf("\nfunction ", start + startToken.length);
  return setup.slice(start, next === -1 ? setup.length : next);
}

test("dependency fingerprint uses manifests and lockfiles, not LFAA product version", () => {
  const body = functionBody("Get-NodeDependencySnapshot");
  for (const token of ["packageManager", "pnpm-lock.yaml", "pnpm-workspace.yaml", "Get-NodeDependencyInventory", "Fingerprint"]) {
    assert.ok(body.includes(token), `missing fingerprint input: ${token}`);
  }
  assert.doesNotMatch(body, /lfaa\.release\.json/i);
  assert.doesNotMatch(body, /displayVersion|releaseSequence/);
});

test("unchanged dependency path can return without pnpm install", () => {
  const plan = functionBody("Get-NodeDependencyPlan");
  const install = functionBody("Install-NodeDependencies");
  assert.match(plan, /NeedsInstall/);
  assert.match(plan, /CanAdopt/);
  assert.match(install, /if \(\$plan\.NeedsInstall\)/);
  assert.match(functionBody("Show-NodeDependencyPlan"), /无需 pnpm install/);
  const decisionIndex = install.indexOf("if ($plan.NeedsInstall)");
  const invokeIndex = install.indexOf('Invoke-Pnpm @("install","--frozen-lockfile")');
  assert.ok(decisionIndex >= 0 && invokeIndex > decisionIndex, "install invocation must stay inside the NeedsInstall branch");
});

test("dependency changes are summarized and confirmed before writing", () => {
  const compare = functionBody("Compare-NodeDependencyInventory");
  const show = functionBody("Show-NodeDependencyPlan");
  const install = functionBody("Install-NodeDependencies");
  for (const token of ["Added", "Removed", "Changed"]) assert.ok(compare.includes(token));
  for (const token of ["新增", "删除", "版本变化"]) assert.ok(show.includes(token));
  assert.match(install, /Confirm-WriteOperation/);
  assert.match(install, /当前项目锁定依赖/);
});

test("menu 1 never auto-updates packages or clears pnpm caches", () => {
  assert.doesNotMatch(setup, /pnpm\s+update|@\("update"\)/i);
  assert.doesNotMatch(setup, /store\s+prune|@\("store","prune"\)/i);
  assert.doesNotMatch(setup, /Remove-Item[^\n]*(?:node_modules|pnpm)/i);
  assert.equal(packageJson.packageManager, "pnpm@11.17.0");
});

test("local dependency state is cache-only and gitignored", () => {
  assert.match(setup, /\.lfaa\\state\\dependency-state\.json/);
  assert.match(gitignore, /^\.lfaa\/state\/$/m);
  const stateWriter = functionBody("Write-DependencyState");
  assert.doesNotMatch(stateWriter, /api.?key|token|secret|password/i);
});

test("Rust toolchain and Cargo fetch are reused when unchanged", () => {
  const readiness = functionBody("Get-RustToolchainReadiness");
  const ensure = functionBody("Ensure-ProjectRustToolchain");
  const deps = functionBody("Install-RustDependencies");
  assert.match(readiness, /toolchain list/);
  assert.match(readiness, /component list --toolchain \$channel --installed/);
  assert.match(ensure, /跳过 rustup toolchain install/);
  assert.match(deps, /lockHash/);
  assert.match(deps, /跳过 cargo fetch/);
  assert.match(deps, /尚未声明外部 crate；无需执行 cargo fetch/);
});

test("menu 1 shows dependency locations from runtime paths", () => {
  const locations = functionBody("Show-DependencyLocations");
  const storePath = functionBody("Get-PnpmStorePath");
  for (const token of ["Node 依赖", "pnpm 虚拟仓库", "pnpm Store", "Node 锁文件", "依赖状态缓存", "Cargo 缓存", "Cargo Git 缓存", "Rust 工具链", "Rust 锁文件"]) {
    assert.ok(locations.includes(token), `missing dependency location label: ${token}`);
  }
  assert.match(locations, /node_modules\\\.pnpm/);
  assert.match(locations, /pnpm-lock\.yaml/);
  assert.match(storePath, /Get-PnpmEnvironmentFacts/);
  const facts = functionBody("Get-PnpmEnvironmentFacts");
  assert.match(facts, /Invoke-PnpmCapture @\("store","path"\)/);
  assert.match(facts, /StorePath/);
});

test("menu 1 avoids duplicate precheck and duplicate completion summaries", () => {
  assert.doesNotMatch(setup, /【预检】" "【Node】/);
  assert.doesNotMatch(setup, /【预检】" "【pnpm】/);
  assert.doesNotMatch(setup, /【预检】" "【workspace】/);
  assert.doesNotMatch(setup, /【完成】" "【Node\/pnpm】/);
  assert.doesNotMatch(setup, /【完成】" "【Rust\/Cargo】/);
  assert.match(setup, /【完成】" "【按需依赖】/);
});

test("unchanged path requires real Node resolution before it may skip install", () => {
  const plan = functionBody("Get-NodeDependencyPlan");
  const runtime = functionBody("Test-NodeDependencyRuntimeHealth");
  assert.match(plan, /Test-NodeDependencyRuntimeHealth/);
  assert.match(plan, /RuntimeHealth/);
  assert.match(plan, /项目依赖真实解析\/加载失败/);
  assert.match(runtime, /node-dependency-health-check\.mjs/);
  assert.match(runtime, /--json/);
});

test("pnpm Store is a real health signal and missing cache cannot report all-ready", () => {
  const store = functionBody("Get-PnpmStoreHealth");
  const repair = functionBody("Repair-PnpmStore");
  assert.match(store, /Get-PnpmEnvironmentFacts/);
  assert.match(store, /Test-Path/);
  assert.match(store, /目录不存在/);
  assert.match(store, /目录为空/);
  const fetcher = functionBody("Invoke-PnpmStoreLockfileFetch");
  assert.match(fetcher, /fetch","--frozen-lockfile","--ignore-scripts/);
  assert.match(fetcher, /--offline/);
  assert.match(fetcher, /GetTempPath/);
  assert.match(repair, /Invoke-PnpmStoreLockfileFetch/);
  assert.match(setup, /项目 Node 依赖当前可用，但 pnpm Store 缓存未恢复/);
  assert.doesNotMatch(repair, /update|store\s+prune/i);
});

test("dependency state cache is never sufficient for real health", () => {
  const plan = functionBody("Get-NodeDependencyPlan");
  const install = functionBody("Install-NodeDependencies");
  assert.match(plan, /RuntimeHealth/);
  assert.match(plan, /StoreHealth/);
  assert.match(install, /finalRuntime/);
  assert.match(install, /finalStore/);
  assert.match(install, /ProjectHealthy/);
  assert.match(install, /StoreHealthy/);
});


test("pnpm machine facts are read live and never replayed from dependency cache", () => {
  const capture = functionBody("Invoke-PnpmCapture");
  const facts = functionBody("Get-PnpmEnvironmentFacts");
  const storePath = functionBody("Get-PnpmStorePath");
  assert.match(capture, /Push-Location \$ProjectRoot/);
  assert.match(facts, /Invoke-PnpmCapture @\("store","path"\)/);
  assert.match(facts, /PNPM_HOME/);
  assert.match(facts, /globalconfig/);
  assert.match(facts, /storeDir/);
  assert.match(storePath, /每次都向当前 pnpm 实时查询/);
  assert.doesNotMatch(storePath, /Read-DependencyState|dependency-state\.json/);
});

test("pnpm Store source is explained without forcing a project store", () => {
  const facts = functionBody("Get-PnpmEnvironmentFacts");
  const workspace = fs.readFileSync("pnpm-workspace.yaml", "utf8");
  for (const token of ["项目配置", "用户全局配置", "pnpm 默认", "环境变量", "Get-ProjectPnpmStoreDir"]) {
    assert.ok(facts.includes(token), `missing Store source label: ${token}`);
  }
  assert.doesNotMatch(workspace, /^\s*storeDir\s*:/m);
  assert.doesNotMatch(workspace, /^\s*store-dir\s*:/m);
});

test("dependency location output includes PNPM_HOME and Store source", () => {
  const locations = functionBody("Show-DependencyLocations");
  for (const token of ["pnpm 可执行", "PNPM_HOME", "pnpm 全局配置", "【来源】", "pnpm Store"]) {
    assert.ok(locations.includes(token), `missing runtime pnpm fact: ${token}`);
  }
  assert.match(locations, /Get-PnpmEnvironmentFacts/);
});


test("Windows PowerShell scripts do not assign to automatic or read-only variables", () => {
  const reserved = ["HOME", "PID", "Host", "Error", "PSHOME", "PWD", "LASTEXITCODE"];
  const assignment = new RegExp(
    String.raw`(^|[;{(]\s*)\$(?:${reserved.join("|")})\s*(?:=|\+=|-=|\*=|/=|\+\+|--)`,
    "gim",
  );
  const files = fs.readdirSync("scripts/windows").filter((name) => name.endsWith(".ps1"));
  assert.ok(files.length > 0, "expected Windows PowerShell scripts");
  for (const file of files) {
    const source = fs.readFileSync(`scripts/windows/${file}`, "utf8");
    assert.doesNotMatch(source, assignment, `${file} assigns to a PowerShell automatic/read-only variable`);
  }
});
