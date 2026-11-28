// 内置「默认工作区」项目条目的常量与构造函数：不写入 projects.json，由列表与查询时动态合成。
import { existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type { WorkspaceProjectSummary } from "./types";

/** 默认工作区项目固定 id：会话绑定它即绑定到项目外工作目录。 */
export const DEFAULT_WORKSPACE_PROJECT_ID = "default-workspace";
export const DEFAULT_WORKSPACE_PROJECT_NAME = "默认工作区";
export const DEFAULT_WORKSPACE_SUBDIR = "lfaa";
export const DEFAULT_OUTSIDE_SUBDIR = "default-workspace";
/** 默认工作区内物理隔离的两个子区：代码默认工作区与画布区。 */
export const DEFAULT_CODE_SUBDIR = "code";
export const DEFAULT_CANVAS_SUBDIR = "canvas";

/** 首次启动时登记到 projects.json 的默认工作区项目；之后与普通项目一样可编辑、置顶、移除。 */
export function buildDefaultWorkspaceProject(rootPath: string): WorkspaceProjectSummary {
  return {
    id: DEFAULT_WORKSPACE_PROJECT_ID,
    name: DEFAULT_WORKSPACE_PROJECT_NAME,
    createdAt: Date.now(),
    rootPath,
    rootPaths: [rootPath],
    locationType: "local",
    trusted: true,
    pinned: false,
    sectionId: null,
    chatCount: 0,
    isDefault: true,
    kind: "workspace",
    canvasFolderId: null,
    exists: existsSync(rootPath),
  };
}

/** 未配置时的兜底目录：`~/lfaa/default-workspace/code`。 */
export function fallbackDefaultWorkspacePath(home: string): string {
  return join(home, DEFAULT_WORKSPACE_SUBDIR, DEFAULT_OUTSIDE_SUBDIR, DEFAULT_CODE_SUBDIR);
}

/** 兼容 outsideDir 指向 default-workspace 或其 code 子目录，统一拆出容器目录、代码区与画布区，避免嵌套 code/code。 */
export function resolveDefaultWorkspaceDirs(outsideDir: string): {
  containerDir: string;
  codeDir: string;
  canvasDir: string;
} {
  const normalized = resolve(outsideDir);
  if (basename(normalized).toLowerCase() === DEFAULT_CODE_SUBDIR) {
    const containerDir = dirname(normalized);
    return {
      containerDir,
      codeDir: normalized,
      canvasDir: join(containerDir, DEFAULT_CANVAS_SUBDIR),
    };
  }
  return {
    containerDir: normalized,
    codeDir: join(normalized, DEFAULT_CODE_SUBDIR),
    canvasDir: join(normalized, DEFAULT_CANVAS_SUBDIR),
  };
}