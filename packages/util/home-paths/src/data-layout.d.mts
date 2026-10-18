/** 列出既有 LFAA_DATA_DIR 根目录下的职责目录，不改变根解析策略。 */
export interface DataPaths {
  root: string;
  database: string;
  users: string;
  sessions: string;
  credentials: string;
  games: string;
  environments: string;
  lib: string;
  cache: string;
  tmp: string;
  logs: string;
  backups: string;
  models: string;
  connectivity: string;
  storages: string;
}

export interface UserDataPaths {
  root: string;
  settings: string;
  preferences: string;
  settingsDocument: string;
  assets: string;
  backgrounds: string;
  projects: string;
  workflows(applicationId: string): string;
  knowledge: string;
}

export function resolveDataPaths(dataDirectory: string): DataPaths;
/** 创建既有数据布局的顶层分类目录并保护 credentials；不创建账户或业务内容。 */
export function ensureDataDirectories(dataDirectory: string): DataPaths;
export function resolveUserDataPaths(dataDirectory: string, userId: string): UserDataPaths;
