// 解析桌面端运行路径：开发态指向仓库内产物，安装态指向 resources/app；用户数据仍在 ~/.lfaa。
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { app } from "electron";

export interface DesktopPaths {
  /** 已构建的 Web 产物目录（含 index.html 与 assets/）。 */
  webRoot: string;
  /** 桌面宿主进程入口（apps/desktop-host 的构建产物）。 */
  hostEntry: string;
  /** 默认工作区（项目未绑定时的回退）：<系统文档>/lfaa/default-workspace，首次启动自动创建。 */
  projectRoot: string;
  /** 与 Web 入口共享的数据根 `~/.lfaa`。 */
  dataRoot: string;
  /** 开发态窗口图标；安装态由 exe 内嵌图标提供。 */
  iconPath?: string;
}

/** 按「开发 / 安装」两种运行形态解析路径，并保证默认工作区存在。 */
export function resolveDesktopPaths(): DesktopPaths {
  // 开发态：apps/desktop；安装态：resources/app（electron-builder 的 app 目录）。
  const appRoot = app.getAppPath();
  const webRoot = app.isPackaged ? join(appRoot, "web") : join(appRoot, "..", "web", "dist");
  const hostEntry = app.isPackaged
    ? join(appRoot, "desktop-host", "index.js")
    : join(appRoot, "..", "desktop-host", "lib", "index.js");
  const dataRoot = join(homedir(), ".lfaa");
  // 跟随系统「文档」位置（用户可能把它重定向到 D 盘），不写死盘符或用户名。
  const projectRoot = join(app.getPath("documents"), "lfaa", "default-workspace");
  mkdirSync(projectRoot, { recursive: true });
  const iconPath = join(appRoot, "resources", "icon.ico");
  return {
    webRoot,
    hostEntry,
    projectRoot,
    dataRoot,
    ...(existsSync(iconPath) ? { iconPath } : {}),
  };
}