/**
 * 功能：按文件入口上下文决定左侧资源快捷入口的可见范围。
 * 作用：游戏应用只展示游戏工作需要的资源类别；全局文件总入口保留 Files Owner 的完整清单。
 * 关联文件：FileManagerPage、Connection File Manager Location、Files API 资源位置合同。
 */
import type { FileResourceLocation } from "lfaa-client-connection/src/api.js";
import type { FileManagerReturnApp } from "lfaa-client-connection/src/file-manager-location.js";

const gameContextResourceIds = new Set([
  "data",
  "game-instances",
  "game-storage",
  "backups",
  "environments",
  "lib",
  "logs"
]);

export function getVisibleFileManagerLocations(
  locations: FileResourceLocation[],
  returnApp: FileManagerReturnApp | null,
  requestedLocation: string | null
): FileResourceLocation[] {
  const isGameEntry = returnApp !== null
    || requestedLocation?.startsWith(".lfaa-library/game-instances/") === true
    || requestedLocation?.startsWith(".lfaa-library/game-storage/") === true;

  return isGameEntry ? locations.filter(location => gameContextResourceIds.has(location.id)) : locations;
}
