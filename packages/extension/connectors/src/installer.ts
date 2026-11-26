// 静默安装：只执行内置目录声明的固定参数，按可用安装器选择 winget / choco / scoop / npm。
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { CatalogInstallSpec } from "../contract";
import { resolveExecutable } from "./cli-exec";

/** 可用的安装器路径：先查 PATH，Windows 再查 winget 的应用执行别名。 */
export function findInstaller(manager: CatalogInstallSpec["manager"]): string | null {
  const direct = resolveExecutable(manager);
  if (direct) return direct;
  if (process.platform === "win32" && manager === "winget") {
    const alias = join(process.env.LOCALAPPDATA ?? "", "Microsoft", "WindowsApps", "winget.exe");
    if (existsSync(alias)) return alias;
  }
  return null;
}

/** 固定参数：不接受调用方拼接，避免把任意命令塞进安装流程。 */
export function installerArgs(spec: CatalogInstallSpec): string[] {
  switch (spec.manager) {
    case "winget":
      return ["install", "--id", spec.id, "-e", "--silent", "--accept-package-agreements", "--accept-source-agreements", "--disable-interactivity"];
    case "choco":
      return ["install", spec.id, "-y", "--no-progress"];
    case "scoop":
      return ["install", spec.id];
    case "npm":
      return ["install", "-g", spec.id];
  }
}

/** 安装器可读名称，用于进度提示。 */
export function installerLabel(spec: CatalogInstallSpec): string {
  switch (spec.manager) {
    case "winget": return `winget ${spec.id}`;
    case "choco": return `Chocolatey ${spec.id}`;
    case "scoop": return `Scoop ${spec.id}`;
    case "npm": return `npm ${spec.id}`;
  }
}