/**
 * 功能：解析 LFAA server 与 Daemon 共用的数据根目录。
 * 作用：Windows 固定盘默认使用当前用户数据目录，可移动盘和非 Windows 环境默认让数据跟随项目目录。
 * 关联文件：packages/util/launch-environment/src/config.ts、packages/host/daemon/src/daemon.mjs、scripts/start-dev.ps1。
 */
import { execFileSync } from "node:child_process";
import { isAbsolute, posix, resolve, win32 } from "node:path";
import { fileURLToPath } from "node:url";
import { findRepositoryRoot } from "./index.mjs";

const repositoryRoot = findRepositoryRoot(import.meta.url);
const driveTypeScript = resolve(repositoryRoot, "scripts/get-project-drive-type.ps1");

function pathApiFor(platform) {
  return platform === "win32" ? win32 : posix;
}

function pathResolve(pathApi, ...segments) {
  return pathApi ? pathApi.resolve(...segments) : resolve(...segments);
}

function pathIsAbsolute(pathApi, value) {
  return pathApi ? pathApi.isAbsolute(value) : isAbsolute(value);
}

function detectProjectDriveType(projectRoot) {
  try {
    return execFileSync("powershell.exe", [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      driveTypeScript,
      "-ProjectRoot",
      projectRoot
    ], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 10_000,
      windowsHide: true
    }).trim();
  } catch {
    throw new Error("无法检测 LFAA 所在 Windows 卷类型；请先设置有效的 LFAA_DATA_DIR。");
  }
}

export function resolveDataDirectory(projectRoot, configuredValue = "data", options = {}) {
  const platform = options.platform ?? process.platform;
  const pathApi = pathApiFor(platform);
  const configured = String(configuredValue ?? "").trim() || "data";
  const resolvedConfigured = pathResolve(pathApi, projectRoot, configured);
  const defaultDirectory = pathResolve(pathApi, projectRoot, "data");
  const isDefault = !pathIsAbsolute(pathApi, configured) && resolvedConfigured === defaultDirectory;

  if (!isDefault) return resolvedConfigured;
  if (platform !== "win32") return defaultDirectory;

  const driveType = options.driveType ?? detectProjectDriveType(projectRoot);
  if (driveType === "Removable") return defaultDirectory;
  if (driveType !== "Fixed") {
    throw new Error(`LFAA 项目所在 Windows 卷类型为 ${driveType || "未知"}；请设置 LFAA_DATA_DIR 后重试。`);
  }

  const userProfile = options.userProfile ?? process.env.USERPROFILE;
  if (!userProfile || !pathIsAbsolute(pathApi, userProfile)) {
    throw new Error("当前 Windows 用户未提供有效的 USERPROFILE；请设置 LFAA_DATA_DIR 后重试。");
  }
  return pathResolve(pathApi, userProfile, ".LFAA", "data");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [projectRootArgument, configuredValueArgument] = process.argv.slice(2);
  if (!projectRootArgument) {
    throw new Error("用法：node scripts/resolve-data-directory.mjs <项目根目录> [LFAA_DATA_DIR]");
  }
  process.stdout.write(`${resolveDataDirectory(projectRootArgument, configuredValueArgument)}\n`);
}
