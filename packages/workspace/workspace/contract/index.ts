// 定义工作区 Host 侧与 RPC 共享的无 DOM 领域数据结构。
import type { WorkbenchProjectItem } from "@lfaa/ui-layout";

/** 描述工作台和项目路由使用的本机项目公开字段。 */
export interface WorkspaceProjectSummary extends WorkbenchProjectItem {
  rootPath: string;
  rootPaths: string[];
  locationType: "local";
  trusted: true;
  pinned: boolean;
  sectionId: string | null;
  chatCount: number;
  exists?: boolean;
}

/** 描述文件工作区中的文件或目录条目。 */
export interface WorkspaceDirectoryEntry {
  name: string;
  kind: "directory" | "file";
  size?: number;
  updatedAt: number;
}

/** 返回对项目目录执行只读检查后可展示的信息。 */
export interface WorkspaceInspection {
  projectId: string;
  rootPath: string;
  exists: boolean;
  directoryCount: number;
  fileCount: number;
  entries: WorkspaceDirectoryEntry[];
}

/** 描述本机目录选取操作返回的路径或取消结果。 */
export interface FolderPickResult {
  cancelled: boolean;
  path?: string;
  name?: string;
  error?: string;
}

/** 描述创建项目时向浏览器返回的建议路径。 */
export interface ResolveDefaultPathResult {
  targetPath: string;
  documentsDir: string;
  folderName: string;
}

/** 约定创建项目时提交的名称、路径、项目简介与目录选择信息。 */
export interface CreateProjectInput {
  name: string;
  rootPath?: string;
  /** 项目目标与交付范围；留空时由 Host 依据目录内容生成初稿。 */
  description?: string;
  /** 浏览器在信任弹窗中展示的默认路径，创建时由 Host 重新核对。 */
  confirmedDefaultPath?: string;
  trusted: boolean;
  /** 项目类型：仅无限画布「+ 开始创作」传 "canvas"，其余均为 "workspace"。 */
  kind?: "workspace" | "canvas";
  /** 画布分类文件夹 ID（仅 kind === "canvas" 生效）。 */
  canvasFolderId?: string | null;
}

/** 约定更新既有项目档案时提交的可编辑字段。 */
export interface UpdateProjectInput {
  name?: string;
  rootPaths?: string[];
  /** 项目目标与交付范围；传空字符串表示清空。 */
  description?: string;
  pinned?: boolean;
  sectionId?: string | null;
  canvasFolderId?: string | null;
}

/** 项目简介初稿：依据目录内 README/清单与顶层条目生成，不写文件。 */
export interface DraftProjectBriefResult {
  brief: string;
  /** 实际读取到的依据，如 README.md、package.json、目录条目。 */
  sources: string[];
}
