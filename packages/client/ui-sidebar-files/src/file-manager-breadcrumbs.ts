export interface FileManagerBreadcrumbLocation {
  name: string;
  path: string;
}

export interface FileManagerBreadcrumb {
  name: string;
  path: string;
}

function rootPathFromLabel(rootDirectory: string): string {
  const separator = rootDirectory.lastIndexOf(" · ");
  return (separator >= 0 ? rootDirectory.slice(separator + 3) : rootDirectory).trim();
}

function physicalPathLeaf(rootDirectory: string): string {
  const rootPath = rootPathFromLabel(rootDirectory).replace(/[\\/]+$/u, "");
  return rootPath.split(/[\\/]/u).filter(Boolean).at(-1) ?? "";
}

export function buildFileManagerBreadcrumbs(
  currentPath: string,
  locations: readonly FileManagerBreadcrumbLocation[],
  rootDirectory: string
): FileManagerBreadcrumb[] {
  if (!currentPath) return [];
  const segments = currentPath.split("/");
  const instanceFolderName = physicalPathLeaf(rootDirectory) || "实例目录";
  const nodeName = rootDirectory.includes(" · ") ? rootDirectory.slice(0, rootDirectory.indexOf(" · ")) : "节点资源";

  return segments.map((segment, index) => {
    const path = segments.slice(0, index + 1).join("/");
    let name = segment;
    if (segment === ".lfaa-library") name = "应用资源";
    else if (segment === ".lfaa-resources") name = "受管资源";
    else if (segments[1] === "aivideo-projects" && index === 2) name = "项目媒体";
    else if (segments[1] === "game-storage" && segment === "minecraft") name = "Minecraft 游戏目录";
    else if (segments[1] === "game-storage" && segment === "steamcmd") name = "Steam 游戏目录";
    else if (segment === "steamcmd-runtime") name = "SteamCMD 工具目录";
    else if (segments[1] === "game-instances" && index === 2) name = instanceFolderName;
    else if (segments[1] === "game-servers" && index === 2) name = nodeName;
    else name = locations.find(location => location.path === path)?.name
      ?? (segments[index - 1] === "local-drives" && /^[A-Z]$/iu.test(segment) ? `${segment}:` : segment);
    return { name, path };
  }).filter(crumb => crumb.path !== ".lfaa-resources"
    && !(crumb.path.startsWith(".lfaa-library/game-storage/") && crumb.path.split("/").length === 3));
}

export function getFileManagerBreadcrumbTitle(rootDirectory: string, currentPath: string): string {
  const segments = currentPath.split("/");
  const isGamePath = segments[1] === "game-storage" || segments[1] === "game-instances" || segments[1] === "game-servers";
  if (!rootDirectory || !isGamePath) return currentPath ? "当前目录" : "LFAA 数据";
  const rootPath = rootPathFromLabel(rootDirectory);
  const relativeStart = segments[1] === "game-storage" ? 4 : 3;
  const relativeSegments = segments.slice(relativeStart).filter(Boolean);
  if (!relativeSegments.length) return rootPath;
  const separator = rootPath.includes("\\") ? "\\" : "/";
  return `${rootPath.replace(/[\\/]+$/u, "")}${separator}${relativeSegments.join(separator)}`;
}
