// 项目选择浮层的过滤规则：按项目名称或本地目录路径做不区分大小写的包含匹配。
import type { WorkbenchProjectItem } from "@lfaa/ui-layout";

/** 按关键字过滤本地项目名称或目录路径，供输入栏与标题项目变量共用。 */
export function filterComposerProjects(
  projects: WorkbenchProjectItem[],
  query: string,
): WorkbenchProjectItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return projects;
  return projects.filter((project) => {
    const nameMatch = project.name.toLowerCase().includes(normalized);
    const pathMatch = Boolean(project.rootPath && project.rootPath.toLowerCase().includes(normalized));
    return nameMatch || pathMatch;
  });
}