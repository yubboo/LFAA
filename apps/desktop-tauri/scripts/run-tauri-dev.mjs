/**
 * 功能：在根 dist 目录内启动 Tauri 桌面开发壳。
 * 作用：把 Cargo 调试产物固定到 dist/apps/desktop-tauri/target，避免桌面源码目录出现 target 构建目录。
 * 关联文件：apps/desktop-tauri/package.json、apps/desktop-tauri/src-tauri/tauri.conf.json、根目录 package.json。
 */
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(appRoot, "../..");
const cargoTargetRoot = resolve(repositoryRoot, "dist", "apps", "desktop-tauri", "target");
const processRunner = spawn("cmd.exe", ["/d", "/s", "/c", "pnpm exec tauri dev"], {
  cwd: appRoot,
  env: { ...process.env, CARGO_TARGET_DIR: cargoTargetRoot },
  stdio: "inherit",
  windowsHide: true
});

processRunner.once("error", (error) => {
  process.stderr.write(`无法启动 Tauri 桌面开发壳：${error.message}\n`);
  process.exitCode = 1;
});
processRunner.once("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
