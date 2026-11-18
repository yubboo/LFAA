// 定义工作区 Host 侧与 RPC 共享的无 DOM 领域数据结构。
import type { WorkbenchProjectItem } from "@lfaa/ui-layout";

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

export interface WorkspaceDirectoryEntry {
  name: string;
  kind: "directory" | "file";
  size?: number;
  updatedAt: number;
}

export interface WorkspaceInspection {
  projectId: string;
  rootPath: string;
  exists: boolean;
  directoryCount: number;
  fileCount: number;
  entries: WorkspaceDirectoryEntry[];
}

export interface FolderPickResult {
  cancelled: boolean;
  path?: string;
  name?: string;
  error?: string;
}

export interface ResolveDefaultPathResult {
  targetPath: string;
  documentsDir: string;
  folderName: string;
}

export interface CreateProjectInput {
  name: string;
  rootPath?: string;
  trusted: boolean;
}

export interface UpdateProjectInput {
  name?: string;
  rootPaths?: string[];
  pinned?: boolean;
  sectionId?: string | null;
}
