/**
 * 功能：把 Workspace Git Owner 返回的变更文件整理成可展开的项目相对路径树。
 * 作用：只按真实变更文件构建目录，不扫描或虚构项目文件夹。
 */
import type { WorkspaceGitStatus } from "lfaa-client-connection/src/api.js";

export type ProjectGitTreeFile = WorkspaceGitStatus["files"][number];

export interface ProjectGitTreeDirectory {
  kind: "directory";
  name: string;
  path: string;
  children: ProjectGitTreeNode[];
}

export interface ProjectGitTreeFileNode {
  kind: "file";
  name: string;
  path: string;
  file: ProjectGitTreeFile;
}

export type ProjectGitTreeNode = ProjectGitTreeDirectory | ProjectGitTreeFileNode;

function compareNodes(left: ProjectGitTreeNode, right: ProjectGitTreeNode): number {
  if (left.kind !== right.kind) return left.kind === "directory" ? -1 : 1;
  return left.name.localeCompare(right.name, "zh-CN", { numeric: true, sensitivity: "base" });
}

/** 仅用 Git 状态中的项目相对路径构建树，并过滤空路径与向上路径。 */
export function buildProjectGitTree(files: ProjectGitTreeFile[]): ProjectGitTreeNode[] {
  const root: ProjectGitTreeNode[] = [];
  for (const file of files) {
    const path = (file.projectPath || file.path).replace(/\\/gu, "/").replace(/^\.\//u, "");
    if (path.startsWith("/") || /^[A-Za-z]:\//u.test(path)) continue;
    const segments = path.split("/").filter(segment => segment && segment !== ".");
    if (!segments.length || segments.includes("..")) continue;
    let siblings = root;
    let directoryPath = "";
    for (const segment of segments.slice(0, -1)) {
      directoryPath = directoryPath ? `${directoryPath}/${segment}` : segment;
      let directory = siblings.find((node): node is ProjectGitTreeDirectory => node.kind === "directory" && node.name === segment);
      if (!directory) {
        directory = { kind: "directory", name: segment, path: directoryPath, children: [] };
        siblings.push(directory);
      }
      siblings = directory.children;
    }
    const name = segments.at(-1)!;
    const filePath = segments.join("/");
    if (!siblings.some(node => node.kind === "file" && node.path === filePath)) {
      siblings.push({ kind: "file", name, path: filePath, file });
    }
  }
  const sort = (nodes: ProjectGitTreeNode[]) => {
    nodes.sort(compareNodes);
    for (const node of nodes) if (node.kind === "directory") sort(node.children);
  };
  sort(root);
  return root;
}

export function workspaceGitStatusKind(status: string): "added" | "deleted" | "renamed" | "modified" | "changed" {
  if (status === "??" || status.includes("A")) return "added";
  if (status.includes("D")) return "deleted";
  if (status.includes("R")) return "renamed";
  if (status.includes("M") || status.includes("C")) return "modified";
  return "changed";
}

export function workspaceGitStatusLabel(status: string): string {
  switch (workspaceGitStatusKind(status)) {
    case "added": return "新增";
    case "deleted": return "删除";
    case "renamed": return "重命名";
    case "modified": return "修改";
    default: return status.trim() || "变更";
  }
}
