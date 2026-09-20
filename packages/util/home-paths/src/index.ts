/**
 * 文件：packages/util/home-paths/src/index.ts
 * 作用：统一解析 LFAA 运行时 Home，彻底把用户运行数据与源码仓库分离。
 * 负责：LFAA_HOME override 与 Windows/macOS/Linux 默认数据目录。
 * 不负责：创建目录、读写业务状态、迁移 Secret。
 */
import os from "node:os";
import path from "node:path";

export interface LfaaHomePaths {
  readonly root: string;
  readonly state: string;
  readonly plugins: string;
  readonly cache: string;
  readonly logs: string;
  readonly tmp: string;
}

export function resolveLfaaHome(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.LFAA_HOME?.trim();
  if (override) return path.resolve(override);
  if (process.platform === "win32") {
    const localAppData = env.LOCALAPPDATA?.trim();
    if (localAppData) return path.join(localAppData, "LFAA");
    return path.join(os.homedir(), "AppData", "Local", "LFAA");
  }
  if (process.platform === "darwin") return path.join(os.homedir(), "Library", "Application Support", "LFAA");
  const xdgDataHome = env.XDG_DATA_HOME?.trim();
  return xdgDataHome ? path.join(xdgDataHome, "lfaa") : path.join(os.homedir(), ".local", "share", "lfaa");
}

export function resolveLfaaHomePaths(env: NodeJS.ProcessEnv = process.env): LfaaHomePaths {
  const root = resolveLfaaHome(env);
  return {
    root,
    state: path.join(root, "state"),
    plugins: path.join(root, "plugins"),
    cache: path.join(root, "cache"),
    logs: path.join(root, "logs"),
    tmp: path.join(root, "tmp"),
  };
}
