/** 功能：读取包声明的发布内容范围。作用：Git 与本地目录使用同一规则，排除仓库元数据及已安装依赖。 */
export function packageContentFilter(manifest: Record<string, unknown>): (path: string, directory?: boolean) => boolean {
  const declared = Array.isArray(manifest.files) ? manifest.files.filter((file): file is string => typeof file === "string") : null;
  const files = declared?.map(file => file.replace(/^\.\//u, "").replace(/\/$/u, ""));
  const patterns = files?.filter(file => file && !file.startsWith("/") && !file.split("/").includes(".."))
    .map(file => new RegExp(`^${file.replace(/[.+?^${}()|[\]\\]/gu, "\\$&").replaceAll("*", ".*")}(?:/|$)`, "u"));
  const main = typeof manifest.main === "string" ? manifest.main.replace(/^\.\//u, "") : null;
  return (path, directory = false) => {
    if (path.split("/").some(part => part === ".git" || part === "node_modules")) return false;
    if (!patterns) return true;
    if (/^(?:package\.json|cordis\.patch\.yml|readme(?:\.[^/]*)?|licen[cs]e(?:\.[^/]*)?)$/iu.test(path) || path === main) return true;
    return patterns.some(pattern => pattern.test(path)) || directory && files!.some(file => file.startsWith(`${path}/`) || file.includes("*"));
  };
}
