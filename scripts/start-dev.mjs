/**
 * 功能：提供 Windows 与 Linux 共用的项目级开发启动入口。
 * 作用：Windows 交给 PowerShell 完整启动器处理进程停机和数据迁移；其他平台直接启动工作区开发服务。
 * 关联文件：根目录 package.json、scripts/start-dev.ps1、scripts/apply-data-directory-migration.mjs。
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const windows = process.platform === "win32";
const executable = windows ? "powershell.exe" : "pnpm";
const argumentsForExecutable = windows
  ? ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", resolve(projectRoot, "scripts", "start-dev.ps1")]
  : ["run", "dev:services"];
const result = spawnSync(executable, argumentsForExecutable, {
  cwd: projectRoot,
  stdio: "inherit",
  windowsHide: true
});

if (result.error) {
  throw new Error(`无法启动开发服务：${result.error.message}`);
}
process.exitCode = result.status ?? 1;
