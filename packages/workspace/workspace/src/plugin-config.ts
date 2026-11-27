// 工作区插件配置契约：与工作区服务主体分开，供装配层与测试引用。
import type { FolderPickResult } from "./types";

export interface WorkspacePluginConfig {
  storeFilePath?: string;
  documentsDir?: string;
  defaultProjectsDirResolver?: () => Promise<string | undefined>;
  /** 「项目外聊天」的工作目录；扫描默认项目目录时要跳过它，避免把它当成项目。 */
  outsideProjectDirResolver?: () => Promise<string | undefined>;
  folderPicker?: (title?: string, initialDir?: string) => Promise<FolderPickResult>;
}