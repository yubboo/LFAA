/**
 * 功能：在当前终端打开 LFAA 项目菜单。
 * 作用：让 PowerShell 菜单继承输入输出，禁止辅助进程创建额外控制台窗口。
 * 关联文件：lfaa.bat、scripts/install-dependencies.ps1。
 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Ctrl+C 交给当前前台菜单及服务处理，外层等待退出，不遗留后台启动进程。
process.on("SIGINT", () => {});
const result = spawnSync("powershell.exe", [
  "-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass",
  "-File", resolve(projectRoot, "scripts/install-dependencies.ps1")
], { cwd: projectRoot, stdio: "inherit", windowsHide: true });
if (result.error) process.stderr.write(`无法打开 LFAA 菜单：${result.error.message}\n`);
process.exitCode = result.status ?? 1;
