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
  "DEVELOPMENT.md",
  "ARCHITECTURE.md",
  "PROJECT_PLAN.md",
  "CHANGELOG.md",
  "lfaa.release.json",
  "docs/architecture/active/architecture-v1.md",
  "docs/plans/modules/project-foundation/PLAN.md",
  "docs/progress/modules/project-foundation/PROGRESS.md",
  "docs/plans/modules/config-system/PLAN.md",
  "docs/progress/modules/config-system/PROGRESS.md",
  "docs/prompts/active/0002-config-system.md",
  "docs/standards/IMPORT_PATHS.md",
  "docs/standards/WORKSPACE_SYNC.md",
  "docs/logs/workspace-sync/README.md",
  "docs/logs/github-push/README.md",
  "docs/logs/source-update/README.md",
  "LFAA-Sync.bat",
  "LFAA-GitHub.bat",
  "LFAA-Update.bat",
  "scripts/windows/lfaa-sync.ps1",
  "scripts/windows/lfaa-github.ps1",
  "scripts/windows/lfaa-update.ps1",
  "apps/desktop/tsconfig.json",
  "apps/web/tsconfig.json",
  "packages/ui/tsconfig.json",
  "packages/agent-runtime/tsconfig.json"
];

const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));

if (missing.length > 0) {
  console.error("LFAA governance check failed. Missing:");
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

console.log("LFAA governance check passed.");
