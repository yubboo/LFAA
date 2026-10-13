/** 功能：定义系统文件来源及操作合同。作用：API、Client 与文件领域共享同一套类型，节点只作为一种来源。关联文件：fs/fs、api/workspace-files、client/connection。 */
export const FILE_MANAGER_OPERATIONS = ["list", "search", "directory-size", "preview", "read", "write", "create-file", "create-folder", "rename", "move", "delete", "upload", "download", "trash-list", "trash-restore", "trash-purge"] as const;
export type FileManagerOperation = typeof FILE_MANAGER_OPERATIONS[number];
export interface ManagedFileEntry {
  name: string;
  path: string;
  kind: "directory" | "file";
  size: number;
  modifiedAt: string;
  fileType?: string;
  trashId?: string;
  operations?: readonly FileManagerOperation[];
}
export interface FileLibrarySource {
  id: string;
  displayName: string;
  description: string;
  kind: "library";
  operations: readonly FileManagerOperation[];
}
export interface FileOperationInput {
  path: string;
  query?: string;
  name?: string;
  destinationPath?: string;
  content?: string;
  dataBase64?: string;
  sha256?: string;
  expectedSha256?: string;
}
