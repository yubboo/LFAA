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
  assert.match(install, /if \(-not \$plan\.NeedsInstall\)/);
  assert.match(functionBody("Show-NodeDependencyPlan"), /跳过 pnpm install/);
  const skipIndex = install.indexOf("if (-not $plan.NeedsInstall)");
  const invokeIndex = install.indexOf('Invoke-Pnpm @("install")');
  assert.ok(skipIndex >= 0 && invokeIndex > skipIndex, "skip branch must be evaluated before install invocation");
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
