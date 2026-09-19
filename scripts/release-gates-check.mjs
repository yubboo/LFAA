/**
 * 文件：release-gates-check.mjs
 * 作用：静态防回归检查正式发布门禁是否仍然完整存在。
 * 负责：检查快速/完整/正式发布三层质量脚本、frozen install、Setup 检查中心与 pnpm 精确版本约束。
 * 不负责：替代真实 pnpm build/test、Cargo 编译或用户验收。
 * 状态归属：无运行时状态；读取 package.json 与发布门禁脚本源码。
 * 对外接口：`node scripts/release-gates-check.mjs`。
 * 关联文件：package.json、scripts/release-environment-check.mjs、scripts/pnpm-only.mjs、scripts/windows/lfaa-setup.ps1。
 * 修改注意事项：只检查长期硬约束，不把临时命令或某次机器路径写死。
 */
import fs from "node:fs";

const fail = (message) => {
  console.error(`LFAA release gates check failed: ${message}`);
  process.exit(1);
};
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const scripts = pkg.scripts ?? {};
const requireScript = (name, tokens) => {
  const value = String(scripts[name] ?? "");
  if (!value) fail(`missing package script: ${name}`);
  for (const token of tokens) if (!value.includes(token)) fail(`${name} missing token: ${token}`);
};

if (pkg.packageManager !== "pnpm@11.17.0") fail(`packageManager must remain pnpm@11.17.0, got ${pkg.packageManager}`);
if (pkg.engines?.pnpm !== "11.17.0") fail("engines.pnpm must remain 11.17.0");
if (pkg.engines?.node !== ">=24.0.0 <25") fail("engines.node must remain >=24.0.0 <25");

requireScript("typecheck", ["typecheck:web", "typecheck:config-system"]);
requireScript("test", ["test:release-environment", "test:release-gates", "test:dependency-setup", "test:node-dependency-health", "test:config-system"]);
requireScript("build", ["build:web"]);
requireScript("quality:quick", ["governance:check", "typecheck", "test"]);
requireScript("quality:full", ["quality:quick", "build"]);
requireScript("release:verify", ["quality:full", "release:rust"]);
requireScript("release:full", ["release:environment", "install --frozen-lockfile", "release:verify"]);

for (const name of ["quality:quick", "quality:full"]) {
  const value = String(scripts[name] ?? "");
  if (/\binstall\b/.test(value)) fail(`${name} must not install dependencies`);
  if (value.includes("release:rust")) fail(`${name} must not require Rust release checks`);
}
if (String(scripts["quality:quick"] ?? "").includes("build")) fail("quality:quick must stay lightweight and skip build");

const preinstall = fs.readFileSync("scripts/pnpm-only.mjs", "utf8");
for (const token of ["packageManager", "engines", "pnpmVersion", "expectedVersion"]) {
  if (!preinstall.includes(token)) fail(`pnpm-only.mjs missing exact-version guard token: ${token}`);
}
const envCheck = fs.readFileSync("scripts/release-environment-check.mjs", "utf8");
for (const token of ["Node.js 必须为 24.x", "pnpm 必须为", "pnpm-lock.yaml"]) {
  if (!envCheck.includes(token)) fail(`release environment check missing: ${token}`);
}
const setup = fs.readFileSync("scripts/windows/lfaa-setup.ps1", "utf8");
for (const token of [
  "Ensure-ProjectPnpm",
  "prepare",
  "【按需依赖】",
  "【检查中心】",
  'Invoke-PnpmScript "quality:quick"',
  'Invoke-PnpmScript "quality:full"',
  'Invoke-PnpmScript "release:full"',
]) {
  if (!setup.includes(token)) fail(`Windows Setup missing layered quality token: ${token}`);
}
for (const token of [
  "Get-NodeDependencyPlan",
  "dependency-state.json",
  "if ($plan.NeedsInstall)",
  "Compare-NodeDependencyInventory",
  "Get-RustToolchainReadiness",
  "toolchain list",
  "lockHash",
  "Show-DependencyLocations",
  "Show-DependencyLocationsCompact",
  "Get-PnpmStorePath",
  "Get-PnpmEnvironmentFacts",
  "Get-PnpmForegroundRunner",
  "pnpm.cmd",
  "PNPM_HOME",
  "用户全局配置",
  "pnpm 默认",
  "Cargo 缓存",
  "Rust 工具链",
  "Test-NodeDependencyRuntimeHealth",
  "Get-PnpmStoreHealth",
  "Repair-PnpmStore",
  "node-dependency-health-check.mjs",
  "fetch","--frozen-lockfile","--ignore-scripts",
]) {
  if (!setup.includes(token)) fail(`Windows Setup missing incremental dependency token: ${token}`);
}
if (/pnpm\s+update|@\("update"\)|store\s+prune/i.test(setup)) {
  fail("Windows Setup must not auto-update dependencies or prune the pnpm store");
}
for (const duplicateToken of ['【预检】" "【Node】', '【预检】" "【pnpm】', '【预检】" "【workspace】']) {
  if (setup.includes(duplicateToken)) fail(`Windows Setup menu 1 must not repeat precheck output: ${duplicateToken}`);
}

const workspaceConfig = fs.readFileSync("pnpm-workspace.yaml", "utf8");
if (/^\s*store(?:Dir|-dir)\s*:/m.test(workspaceConfig)) {
  fail("LFAA workspace must not force a project-level pnpm Store");
}
console.log("LFAA release gates check passed.");
