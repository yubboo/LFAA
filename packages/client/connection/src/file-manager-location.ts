/**
 * 功能：将设置中心存储位置映射到统一文件管理来源。
 * 作用：通过现有路由历史传递账户限定的浏览目标，不把路径变成访问授权。
 * 关联文件：SettingsPage、FileManagerPage；服务端仍实时校验账户、权限和真实磁盘。
 */
const locationKey = "lfaaFileManagerLocation";
export type FileManagerReturnApp = "minecraft" | "steamcmd";
export function storageFileManagerPath(directory: string, dataRoot: string): string {
  const normalize = (value: string) => value.replace(/\\/gu, "/").replace(/\/+$/u, "");
  const root = normalize(dataRoot), input = normalize(directory);
  const path = /^[a-z]:\//iu.test(input) || input.startsWith("/") ? input : `${root}/${input}`;
  if (path.split("/").some(part => part === ".." || part === ".") || /[\u0000-\u001f]/u.test(path)) throw new Error("存储位置路径无效。");
  const insensitive = /^[a-z]:/iu.test(path);
  const compare = (value: string) => insensitive ? value.toLowerCase() : value;
  if (compare(path) === compare(root)) return "";
  if (compare(path).startsWith(compare(root) + "/")) return path.slice(root.length + 1);
  if (/^[a-z]:\//iu.test(path)) return `local-drives/${path[0]!.toUpperCase()}/${path.slice(3)}`.replace(/\/$/u, "");
  if (path.startsWith("/")) return `local-drives/root/${path.slice(1)}`.replace(/\/$/u, "");
  throw new Error("无法将存储目录映射到本机磁盘。");
}
export function setFileManagerLocation(userId: string, path: string, returnPath?: string, returnApp?: FileManagerReturnApp): void {
  window.history.replaceState({ ...window.history.state, [locationKey]: { userId, path, ...(returnPath ? { returnPath } : {}), ...(returnPath && returnApp ? { returnApp } : {}) } }, "");
}
export function readFileManagerLocation(userId: string): string | null {
  const location = window.history.state?.[locationKey];
  if (!location || location.userId !== userId || typeof location.path !== "string" || location.path.length > 1024 || location.path.includes("\\") || location.path.split("/").some((part: string) => part === ".." || part === ".")) return null;
  return location.path;
}
export function readFileManagerReturnPath(userId: string): string | null {
  const location = window.history.state?.[locationKey];
  if (!location || location.userId !== userId || typeof location.returnPath !== "string") return null;
  const path = location.returnPath;
  if (!path.startsWith("/") || path.startsWith("//") || path.length > 1024 || path.includes("\\") || /[?#\u0000-\u001f]/u.test(path) || path.split("/").some((part: string) => part === ".." || part === ".")) return null;
  return path;
}
export function readFileManagerReturnApp(userId: string): FileManagerReturnApp | null {
  const location = window.history.state?.[locationKey];
  if (!location || location.userId !== userId || (location.returnApp !== "minecraft" && location.returnApp !== "steamcmd")) return null;
  return location.returnApp;
}
export function consumeFileManagerLocation(): void {
  if (!window.history.state?.[locationKey]) return;
  const { [locationKey]: _location, ...state } = window.history.state;
  window.history.replaceState(state, "");
}
