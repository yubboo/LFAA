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
  plugins: string;
  cache: string;
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
export function resolveUserDataPaths(dataDirectory: string, userId: string): UserDataPaths;
