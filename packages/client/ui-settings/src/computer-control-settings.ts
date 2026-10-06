/** 功能：兼容尚未返回本机电脑操控配置的旧设置对象。作用：缺失或非法状态按默认关闭处理，避免设置页崩溃。关联文件：SettingsPage.tsx、client connection settings。 */
export function isComputerControlEnabled(settings: { computerControl?: { enabled?: unknown } } | null | undefined): boolean {
  return settings?.computerControl?.enabled === true;
}
