/** 为 server 提供可移植数据根目录解析器的 TypeScript 类型。 */
export interface DataDirectoryOptions {
  platform?: string;
  driveType?: string;
  userProfile?: string;
  lfaaHome?: string;
  useStoredDataDirectory?: boolean;
}

export function resolveDataDirectory(
  projectRoot: string,
  configuredValue?: string,
  options?: DataDirectoryOptions
): string;
export function readStoredDataDirectory(homeDirectory: string, platform?: string): string;
export function saveStoredDataDirectory(homeDirectory: string, directory: string, platform?: string): string;
export function resolveHomeDirectory(
  projectRoot: string,
  configuredValue?: string,
  options?: { platform?: string; userProfile?: string; lfaaHome?: string },
): string;
