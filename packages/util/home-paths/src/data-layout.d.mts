export interface HomePaths {
  root: string;
  database: string;
  users: string;
  sessions: string;
  credentials: string;
  storages: string;
  skills: string;
  directoryGuide: string;
}

/** 列出账户 Home 下的账户/控制数据分类目录。 */
export function resolveHomePaths(homeDirectory: string): HomePaths;

/** 列出业务 LFAA_DATA_DIR 根目录下的运行与内容目录。 */
export interface DataPaths {
  root: string;
  users: string;
  games: string;
  environments: string;
  lib: string;
  cache: string;
  tmp: string;
  logs: string;
  backups: string;
  models: string;
  input: string;
  output: string;
  connectivity: string;
}

export interface UserDataPaths {
  root: string;
  projects: string;
  input: string;
  output: string;
  workflows(applicationId: string): string;
  knowledge: string;
}

export function resolveDataPaths(dataDirectory: string): DataPaths;
/** 创建账户 Home 分类并保护 credentials。 */
export function ensureHomeDirectories(homeDirectory: string): HomePaths;
/** 创建业务 Data 分类；不创建账户或实际内容。 */
export function ensureDataDirectories(dataDirectory: string): DataPaths;
export function resolveUserDataPaths(dataDirectory: string, userId: string): UserDataPaths;
export interface UserAccountPaths {
  root: string;
  settings: string;
  preferences: string;
  settingsDocument: string;
  assets: string;
  backgrounds: string;
}
export function resolveUserAccountPaths(homeDirectory: string, userId: string): UserAccountPaths;
