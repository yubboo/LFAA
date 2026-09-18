/**
 * 文件：governance-check.mjs
 * 作用：检查 LFAA 项目治理骨架和不可破坏的项目级约束。
 * 负责：关键文件存在性、包管理器、作者/命名空间、资源根、Rustup、安全工具链与质量脚本基础约束。
 * 不负责：业务单元测试、TypeScript/Rust 编译、UI 视觉验证。
 * 状态归属：无运行时状态；直接读取当前工作树配置。
 * 对外接口：`node scripts/governance-check.mjs`。
 * 关联文件：DEVELOPMENT.md、docs/README.md、docs/PROMPTS.md、docs/DEVELOPMENT_LOG.md、package.json、scripts/comment-check.mjs、scripts/windows-script-encoding-check.mjs、scripts/release-consistency-check.mjs、scripts/prompt-lifecycle-check.mjs、scripts/ui-contract-check.mjs。
 * 修改注意事项：新增真正的硬规则时才进入本文件；不要把一次性业务测试塞进治理检查。
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const required = [
  "AGENTS.md",
  "DEVELOPMENT.md",
  "ARCHITECTURE.md",
  "PROJECT_PLAN.md",
  "CHANGELOG.md",
  "README.md",
  "NOTICE.md",
  "lfaa.release.json",
  "rust-toolchain.toml",
  "docs/README.md",
  "docs/项目结构与代码地图.md",
  "docs/PROMPTS.md",
  "docs/DEVELOPMENT_LOG.md",
  "docs/MODULES.md",
  "docs/UI.md",
  "docs/TESTING.md",
  "docs/RELEASES.md",
  "docs/RUNTIME.md",
  "apps/README.md",
  "packages/README.md",
  "crates/README.md",
  "scripts/README.md",
  "scripts/docs-check.mjs",
  "scripts/dev-log-check.mjs",
  "scripts/comment-check.mjs",
  "scripts/windows-script-encoding-check.mjs",
  "scripts/release-consistency-check.mjs",
  "scripts/prompt-lifecycle-check.mjs",
  "scripts/ui-contract-check.mjs",
  "scripts/check-node-pty.mjs",
  ".lfaa/README.md",
  ".lfaa/manifest.json",
  ".lfaa/lock.json",
  ".lfaa/skills/README.md",
  ".lfaa/experts/README.md",
  ".lfaa/plugins/README.md",
  ".lfaa/extensions/README.md",
  ".lfaa/mcp/README.md",
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
  "pnpm-workspace.yaml",
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

// Windows PowerShell 5.1 对无 BOM UTF-8 脚本识别不可靠。
// 这里直接做字节级门禁，避免 standalone governance 在 Sync 后漏掉编码回归。
const utf8Bom = Buffer.from([0xef, 0xbb, 0xbf]);
for (const name of ["lfaa-sync.ps1", "lfaa-github.ps1", "lfaa-setup.ps1", "lfaa-update.ps1"]) {
  const relative = `scripts/windows/${name}`;
  const bytes = fs.readFileSync(path.join(root, relative));
  if (bytes.length < 3 || !bytes.subarray(0, 3).equals(utf8Bom)) {
    console.error(`LFAA governance check failed: ${relative} must be UTF-8 with BOM.`);
    process.exit(1);
  }
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


const pnpmWorkspace = fs.readFileSync(path.join(root, "pnpm-workspace.yaml"), "utf8");
if (!/^strictDepBuilds:\s*true\s*$/m.test(pnpmWorkspace)) {
  console.error("LFAA governance check failed: pnpm strictDepBuilds must stay enabled.");
  process.exit(1);
}
if (!/^\s*["']?node-pty@1\.1\.0["']?:\s*true\s*$/m.test(pnpmWorkspace)) {
  console.error("LFAA governance check failed: node-pty@1.1.0 must be explicitly approved in allowBuilds.");
  process.exit(1);
}
if (/dangerouslyAllowAllBuilds:\s*true/i.test(pnpmWorkspace)) {
  console.error("LFAA governance check failed: dangerouslyAllowAllBuilds must not be enabled.");
  process.exit(1);
}


const setupScript = fs.readFileSync(path.join(root, "scripts/windows/lfaa-setup.ps1"), "utf8");
if (!/function\s+Get-WindowsRustupTarget\s*\{/i.test(setupScript)) {
  console.error("LFAA governance check failed: Windows Rustup target resolver is missing.");
  process.exit(1);
}
for (const rustTarget of [
  "x86_64-pc-windows-msvc",
  "aarch64-pc-windows-msvc",
  "i686-pc-windows-msvc",
]) {
  if (!setupScript.includes(rustTarget)) {
    console.error(`LFAA governance check failed: missing Windows Rustup target ${rustTarget}.`);
    process.exit(1);
  }
}
if (!setupScript.includes("https://static.rust-lang.org/rustup/dist/{0}/rustup-init.exe")) {
  console.error("LFAA governance check failed: Rustup installer must use the official static.rust-lang.org distribution URL.");
  process.exit(1);
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

const releaseVersion = String(releaseJson.displayVersion ?? "");
if (packageJson.version !== releaseVersion) {
  console.error(`LFAA governance check failed: root package version ${packageJson.version} != release ${releaseVersion}.`);
  process.exit(1);
}
for (const relative of ["README.md", "CHANGELOG.md"]) {
  const text = fs.readFileSync(path.join(root, relative), "utf8");
  if (!text.includes(`v${releaseVersion}`)) {
    console.error(`LFAA governance check failed: ${relative} must identify current version v${releaseVersion}.`);
    process.exit(1);
  }
}
for (const relative of ["docs/RELEASES.md", "docs/PROMPTS.md", "docs/DEVELOPMENT_LOG.md"]) {
  const text = fs.readFileSync(path.join(root, relative), "utf8");
  if (!text.includes(`v${releaseVersion}`)) {
    console.error(`LFAA governance check failed: ${relative} must contain current version v${releaseVersion}.`);
    process.exit(1);
  }
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


const configPlan = fs.readFileSync(path.join(root, "docs/MODULES.md"), "utf8");
const configPrompt = fs.readFileSync(path.join(root, "docs/PROMPTS.md"), "utf8");

if (/v0\.\d{2}(?!\.)/.test(configPlan) || /v0\.\d{2}(?!\.)/.test(configPrompt)) {
  console.error("LFAA governance check failed: config-system version must use MAJOR.MINOR.PATCH.");
  process.exit(1);
}

console.log("LFAA governance check passed.");
