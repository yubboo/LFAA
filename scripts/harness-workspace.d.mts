/** 功能：声明包清单查询类型。作用：供 Vite 类型检查。关联文件：harness-workspace.mjs。 */
export function workspacePackages(root: string): Array<{ path: string; name: string; [key: string]: unknown }>;
export function workspaceAliases(root: string): Array<{ find: string; replacement: string }>;
