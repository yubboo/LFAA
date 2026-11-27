// 包名到稳定记录 id 的规整规则：安装记录、目录与二创共用同一套 id。
/** 把包名或路径规整成稳定的记录 id。 */
export function toRecordId(moduleName: string): string {
  return moduleName
    .replace(/^@lfaa\//u, "")
    .replace(/[^a-z0-9-]+/giu, "-")
    .replace(/^-+|-+$/gu, "")
    .toLowerCase();
}