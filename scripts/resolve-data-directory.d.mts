/** 为 server 提供可移植数据根目录解析器的 TypeScript 类型。 */
export interface DataDirectoryOptions {
  platform?: string;
  driveType?: string;
  userProfile?: string;
}

export function resolveDataDirectory(
  projectRoot: string,
  configuredValue?: string,
  options?: DataDirectoryOptions
): string;
