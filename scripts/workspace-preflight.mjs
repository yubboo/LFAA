/**
 * 文件：workspace-preflight.mjs
 * 作用：为 Windows Sync / Git Push 提供同一套、无需 node_modules 的稳定工作区静态预检。
 * 负责：按固定顺序运行项目静态治理 Gate，并在失败时直接输出 Gate 名称与原始原因。
 * 不负责：pnpm install、TypeScript build、Rust build、发布环境 Node24 检查。
 * 状态归属：无状态；只读取指定工作区。
 * 对外接口：`node scripts/workspace-preflight.mjs [--root <workspace>]`。
 * 关联文件：scripts/windows/lfaa-sync.ps1、scripts/windows/lfaa-github.ps1。
 * 修改注意事项：Sync 与 GitHub 禁止再维护第二套 Gate 列表。
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const rootIndex = args.indexOf("--root");
const root = path.resolve(rootIndex >= 0 && args[rootIndex + 1] ? args[rootIndex + 1] : process.cwd());

const gates = [
  ["governance", "scripts/governance-check.mjs"],
  ["import-path", "scripts/import-path-check.mjs"],
  ["runtime-import", "scripts/runtime-import-resolution-check.mjs"],
  ["folder-boundary", "scripts/folder-boundary-check.mjs"],
  ["language-ownership", "scripts/language-ownership-check.mjs"],
  ["tsconfig-reference", "scripts/tsconfig-reference-check.mjs"],
  ["development-log", "scripts/dev-log-check.mjs"],
  ["docs", "scripts/docs-check.mjs"],
  ["current-fact", "scripts/current-fact-check.mjs"],
  ["comments", "scripts/comment-check.mjs"],
  ["windows-encoding", "scripts/windows-script-encoding-check.mjs"],
  ["release-consistency", "scripts/release-consistency-check.mjs"],
  ["prompt-lifecycle", "scripts/prompt-lifecycle-check.mjs"],
  ["config-schema", "scripts/config-schema-check.mjs"],
  ["release-gates", "scripts/release-gates-check.mjs"],
  ["ui-contract", "scripts/ui-contract-check.mjs"],
];

console.log(`[LFAA-PREFLIGHT] workspace=${root}`);
console.log(`[LFAA-PREFLIGHT] node=${process.version}`);

for (const [name, relative] of gates) {
  const script = path.join(root, relative);
  if (!fs.existsSync(script)) {
    console.error(`[LFAA-PREFLIGHT][FAIL] ${name}: missing ${relative}`);
    process.exit(1);
  }

  const result = spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    windowsHide: true,
  });

  const stdout = (result.stdout ?? "").trim();
  const stderr = (result.stderr ?? "").trim();
  if (result.status !== 0) {
    console.error(`[LFAA-PREFLIGHT][FAIL] ${name} (${relative})`);
    if (stdout) console.error(stdout);
    if (stderr) console.error(stderr);
    console.error(`[LFAA-PREFLIGHT][HINT] 先确认工作区已完整 Sync 到当前版本；若仍失败，请按上方具体 Gate/文件修复。`);
    process.exit(result.status || 1);
  }

  console.log(`[LFAA-PREFLIGHT][PASS] ${name}`);
}

console.log("LFAA workspace preflight passed.");
