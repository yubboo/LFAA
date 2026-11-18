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

/** 约定创建项目时提交的名称、路径与目录选择信息。 */
export interface CreateProjectInput {
  name: string;
  rootPath?: string;
  trusted: boolean;
}

/** 约定更新既有项目档案时提交的可编辑字段。 */
export interface UpdateProjectInput {
  name?: string;
  rootPaths?: string[];
  pinned?: boolean;
  sectionId?: string | null;
}
