// 资料库与存储配置的领域类型：资产元数据、保存输入、存储位置与迁移结果。
export type LibraryItemCategory = "artifact" | "asset";

/** 提供资料库索引中描述本地资产的公开元数据。 */
export interface LibraryAssetItem {
  id: string;
  category: LibraryItemCategory;
  title: string;
  fileName: string;
  relativePath: string;
  mimeType: string;
  sizeBytes: number;
  summary?: string;
  tags: string[];
  projectId: string | null;
  sourceSessionId?: string;
  sourceRunId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SaveLibraryAssetInput {
  category: LibraryItemCategory;
  title: string;
  fileName: string;
  content: string;
  encoding?: "utf8" | "base64";
  mimeType?: string;
  summary?: string;
  tags?: string[];
  projectId?: string | null;
  sourceSessionId?: string;
  sourceRunId?: string;
}

export type StorageLocationMode = "default" | "project" | "custom";

/** 描述当前资料路径、位置模式与系统推荐路径。 */
export interface StorageConfigState {
  dataRoot: string;
  defaultDataRoot: string;
  recommendedProjectDataRoot: string;
  appDataRoot?: string;
  sessionsRoot?: string;
  mode: StorageLocationMode;
  updatedAt: number;
}

export interface StorageStats {
  dataRoot: string;
  memoryCount: number;
  sessionCount: number;
  artifactCount: number;
  assetCount: number;
  totalBytes: number;
}

/** 返回目录切换执行后的状态及迁移结果。 */
export interface StorageMigrationResult {
  fromRoot: string;
  toRoot: string;
  copiedFiles: number;
  copiedBytes: number;
  verified: boolean;
  state: StorageConfigState;
  stats: StorageStats;
}
