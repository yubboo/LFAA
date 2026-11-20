// 安装仓库级 Git 钩子：把 core.hooksPath 指向 .githooks，并确保钩子可执行。
// 只改当前克隆的本地配置（git config --local），不动全局配置，也不会自动提交任何内容。
import { chmodSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const HOOKS_DIR = join(ROOT, ".githooks");

function git(args) {
  const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  if (result.error) throw new Error(`无法执行 git：${result.error.message}`);
  return result;
}

if (!existsSync(join(HOOKS_DIR, "pre-commit"))) {
  console.error(`找不到钩子文件：${join(HOOKS_DIR, "pre-commit")}`);
  process.exitCode = 1;
} else if (!existsSync(join(ROOT, ".git"))) {
  console.error("当前目录不是 Git 仓库，跳过钩子安装。");
  process.exitCode = 1;
} else {
  // Windows 上没有 POSIX 执行位，但 Git for Windows 会按 shebang 调用 sh，设置失败不视为致命。
  try {
    chmodSync(join(HOOKS_DIR, "pre-commit"), 0o755);
  } catch {
    // 忽略：权限位在 Windows 无实际意义。
  }
  const config = git(["config", "--local", "core.hooksPath", ".githooks"]);
  if (config.status !== 0) {
    console.error("写入 core.hooksPath 失败：", config.stderr.trim());
    process.exitCode = 1;
  } else {
    console.log("✔ 已启用 .githooks（core.hooksPath=.githooks）");
    console.log("  提交前会执行空白检查 + node scripts/check-workspace.mjs；跳过用 git commit --no-verify。");
    console.log("  撤销：git config --local --unset core.hooksPath");
  }
}