#!/usr/bin/env node
/** 功能：提供仓库源码模式的 LFAA CLI 入口。作用：按 TypeScript CLI 启动约定转交给源码与 npm 共用的启动器。关联文件：根 package.json、apps/cli/bin/lfaa.mjs。 */
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const profile = args[0] === "--profile" ? args[1] : args[0];
const isInformationalCommand = args.some((argument) => ["--help", "-h", "--version", "-v"].includes(argument));
if (process.platform === "win32" && profile === "web" && !isInformationalCommand) {
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const preflightScript = resolve(projectRoot, "scripts/lfaa-web-startup-preflight.ps1");
  const powershell = process.env.SystemRoot
    ? resolve(process.env.SystemRoot, "System32/WindowsPowerShell/v1.0/powershell.exe")
    : "powershell.exe";
  const result = spawnSync(powershell, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", preflightScript], {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw new Error(`无法执行 Web 数据锁预检：${result.error.message}`);
  if (result.status !== 0) process.exitCode = result.status ?? 1;
}

if (process.exitCode === undefined) {
  const launcher = new URL("../bin/lfaa.mjs", import.meta.url);
  await import(launcher.href);
}
