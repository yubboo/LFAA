/**
 * 文件：governance-check.mjs
 * 作用：检查 LFAA 项目治理骨架是否缺失关键入口。
 * 负责：验证当前规范、当前架构、Plan/Progress/Prompt 基础文件存在。
 * 不负责：业务测试、TypeScript/Rust 编译、安全扫描。
 */

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const required = [
  "AGENTS.md",
  "docs/README.md",
  "docs/logs/README.md",
  "docs/logs/runtime/README.md",
  "docs/standards/README.md",
  "docs/architecture/README.md",
  "docs/plans/README.md",
  "docs/progress/README.md",
  "docs/prompts/README.md",
  "docs/changelog/README.md",
  "docs/testing/README.md",
  "docs/logs/development/archive/0020-01-历史编号迁移.md",
  "scripts/docs-check.mjs",
  "DEVELOPMENT.md",
  "ARCHITECTURE.md",
  "PROJECT_PLAN.md",
  "CHANGELOG.md",
  "NOTICE.md",
  "lfaa.release.json",
  "docs/architecture/active/architecture-v1.md",
  "docs/plans/modules/project-foundation/PLAN.md",
  "docs/progress/modules/project-foundation/PROGRESS.md",
  "docs/plans/modules/config-system/PLAN.md",
  "docs/progress/modules/config-system/PROGRESS.md",
  "docs/prompts/active/0002-配置系统.md",
  "docs/standards/IMPORT_PATHS.md",
  "docs/standards/WORKSPACE_SYNC.md",
  "docs/standards/PROJECT_IDENTITY_AND_ATTRIBUTION.md",
  "docs/standards/PROJECT_RESOURCES.md",
  "docs/standards/QUALITY_GATES.md",
  "scripts/dev-log-check.mjs",
  "docs/logs/development/archive/legacy/INDEX.md",
  "docs/logs/development/active/0020-开发日志与文档规范.md",
  "docs/testing/WEB_UI_TEST.md",
  "docs/standards/UI_LAYOUT.md",
  "docs/prompts/active/0021-Web工作台UI.md",
  "docs/logs/development/active/0021-Web工作台UI.md",
  "docs/prompts/archive/v0.0.24/0019-03-统一开发入口.md",
  "docs/logs/development/archive/0021-00-Web工作台初始实现.md",
  "docs/logs/development/archive/0019-02-本地依赖与lockfile.md",
  "docs/prompts/archive/v0.0.22/0019-01-一键准备真实检测.md",
  "docs/logs/development/active/0019-一键准备与依赖检测.md",
  "docs/logs/development/active/0010-GitHub推送确认.md",
  "docs/logs/development/archive/0020-00-开发日志初始分层.md",
  "docs/logs/development/active/0002-配置系统.md",
  "docs/logs/development/INDEX.md",
  "docs/logs/development/README.md",
  "docs/standards/DEV_LOGS.md",
  "docs/standards/SECURITY.md",
  "docs/standards/PERFORMANCE.md",
  ".lfaa/README.md",
  ".lfaa/manifest.json",
  ".lfaa/lock.json",
  ".lfaa/skills/README.md",
  ".lfaa/experts/README.md",
  ".lfaa/plugins/README.md",
  ".lfaa/extensions/README.md",
  ".lfaa/mcp/README.md",
  "docs/logs/runtime/workspace-sync/README.md",
  "docs/logs/runtime/github-push/README.md",
  "docs/logs/runtime/source-update/README.md",
  "LFAA-Sync.bat",
  "LFAA-GitHub.bat",
  "LFAA-Update.bat",
  "LFAA-Setup.bat",
  "scripts/windows/lfaa-sync.ps1",
  "scripts/windows/lfaa-github.ps1",
  "scripts/windows/lfaa-update.ps1",
  "scripts/windows/lfaa-setup.ps1",
  "scripts/pnpm-only.mjs",
  "scripts/quality-not-configured.mjs",
  "pnpm-lock.yaml",
  "apps/desktop/tsconfig.json",
  "apps/web/tsconfig.json",
  "packages/ui/tsconfig.json",
  "packages/agent-runtime/tsconfig.json"
];


const forbiddenDuplicateLaunchers = [
  "LFAA-Web.bat",
  "scripts/windows/lfaa-web.ps1",
];

for (const file of forbiddenDuplicateLaunchers) {
  if (fs.existsSync(path.join(root, file))) {
    console.error(
      `LFAA governance check failed: duplicate launcher ${file} is forbidden. ` +
      "Web/Desktop development entrypoints must live under LFAA-Setup.bat."
    );
    process.exit(1);
  }
}

const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length > 0) {
  console.error("LFAA governance check failed. Missing:");
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}


for (const legacyResourceRoot of ["skills", "plugins"]) {
  if (fs.existsSync(path.join(root, legacyResourceRoot))) {
    console.error(
      `LFAA governance check failed: root /${legacyResourceRoot} is forbidden. ` +
      `Project resources must use .lfaa/${legacyResourceRoot}.`
    );
    process.exit(1);
  }
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

if (packageJson.author !== "二鱼") {
  console.error("LFAA governance check failed: root package author must be 二鱼.");
  process.exit(1);
}

if (packageJson.packageManager !== "pnpm@11.17.0") {
  console.error("LFAA governance check failed: packageManager must be pinned to pnpm@11.17.0.");
  process.exit(1);
}

if (packageJson.engines?.pnpm !== "11.17.0") {
  console.error("LFAA governance check failed: engines.pnpm must be 11.17.0.");
  process.exit(1);
}

const forbiddenPackageManager = /\b(?:npm|npx|yarn|bun)\b/i;
for (const [name, command] of Object.entries(packageJson.scripts ?? {})) {
  if (forbiddenPackageManager.test(command)) {
    console.error(`LFAA governance check failed: root script "${name}" must not invoke npm/npx/yarn/bun.`);
    process.exit(1);
  }
}

const releaseJson = JSON.parse(fs.readFileSync(path.join(root, "lfaa.release.json"), "utf8"));
if (releaseJson.author !== "二鱼") {
  console.error("LFAA governance check failed: release author must be 二鱼.");
  process.exit(1);
}

for (const resourceFile of [".lfaa/manifest.json", ".lfaa/lock.json"]) {
  const resourceData = JSON.parse(fs.readFileSync(path.join(root, resourceFile), "utf8"));
  if (resourceData.scope !== "project" || !Array.isArray(resourceData.resources)) {
    console.error(`LFAA governance check failed: ${resourceFile} must be project-scoped.`);
    process.exit(1);
  }
}

function listFiles(directory, targetName) {
  const results = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (["node_modules", "dist", "target", ".git"].includes(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...listFiles(full, targetName));
    if (entry.isFile() && entry.name === targetName) results.push(full);
  }
  return results;
}

for (const packageRoot of ["apps", "packages"]) {
  for (const packageFile of listFiles(path.join(root, packageRoot), "package.json")) {
    const data = JSON.parse(fs.readFileSync(packageFile, "utf8"));
    const relative = path.relative(root, packageFile).replaceAll("\\", "/");
    if (!data.name?.startsWith("@lfaa/") || data.author !== "二鱼") {
      console.error(`LFAA governance check failed: ${relative} must use @lfaa/* and author 二鱼.`);
      process.exit(1);
    }
  }
}

for (const cargoFile of listFiles(path.join(root, "crates"), "Cargo.toml")) {
  const text = fs.readFileSync(cargoFile, "utf8");
  const relative = path.relative(root, cargoFile).replaceAll("\\", "/");
  if (!/^name\s*=\s*"lfaa-[^"]+"/m.test(text) || !/^authors\s*=\s*\["二鱼"\]/m.test(text)) {
    console.error(`LFAA governance check failed: ${relative} must use lfaa-* and author 二鱼.`);
    process.exit(1);
  }
}

for (const scriptName of ["build", "typecheck", "test"]) {
  const script = packageJson.scripts?.[scriptName];
  if (!script || /^\s*echo(?:\s|$)/i.test(script) || /(?:^|&&|;)\s*exit\s+0(?:\s|$)/i.test(script)) {
    console.error(`LFAA governance check failed: ${scriptName} cannot be an empty success placeholder.`);
    process.exit(1);
  }
}


const configPlan = fs.readFileSync(path.join(root, "docs/plans/modules/config-system/PLAN.md"), "utf8");
const configPrompt = fs.readFileSync(path.join(root, "docs/prompts/active/0002-配置系统.md"), "utf8");

if (/v0\.\d{2}(?!\.)/.test(configPlan) || /v0\.\d{2}(?!\.)/.test(configPrompt)) {
  console.error("LFAA governance check failed: config-system version must use MAJOR.MINOR.PATCH.");
  process.exit(1);
}

console.log("LFAA governance check passed.");
