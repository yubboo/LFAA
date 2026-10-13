/** 功能：读取工作区包清单。作用：统一浏览器、Node 和构建的包映射。关联文件：Vite 配置、package-loader.mjs、build-harness.mjs。 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
export function workspacePackages(root) {
  return readdirSync(resolve(root, "packages")).flatMap((group) =>
    readdirSync(resolve(root, "packages", group)).flatMap((entry) => {
      const path = `packages/${group}/${entry}`;
      const manifest = resolve(root, path, "package.json");
      return existsSync(manifest) ? [{ path, ...JSON.parse(readFileSync(manifest, "utf8")) }] : [];
    }));
}
/** 返回可进入产品运行树的包；工程期与测试支持包仅参与开发/构建。 */
export function productRuntimePackages(root) {
  return workspacePackages(root).filter((pkg) =>
    pkg.lfaa?.runtime !== false && !pkg.path.startsWith("packages/client/") && !pkg.path.startsWith("packages/test-support/"));
}
export function workspaceAliases(root) {
  return workspacePackages(root).flatMap((pkg) => {
    const entry = workspaceSourceEntry(root, pkg);
    return [
      { find: `${pkg.name}/src`, replacement: resolve(root, pkg.path, "src") },
      ...(entry ? [{ find: pkg.name, replacement: resolve(root, pkg.path, entry) }] : [])
    ];
  });
}

/** 公开入口优先读取 manifest；TSX/MJS 入口不能被固定的 index.ts 覆盖。 */
export function workspaceSourceEntry(root, pkg) {
  const declared = pkg.exports?.["."];
  const entry = typeof declared === "string" ? declared : declared?.import ?? declared?.default;
  if (typeof entry === "string") return entry.replace(/^\.\//u, "");
  return ["src/index.ts", "src/index.tsx", "src/index.mjs"].find(path => existsSync(resolve(root, pkg.path, path)));
}

/** TypeScript、Vite 和 Node 从同一 workspace 清单取得包位置。 */
export function workspaceTypeScriptPaths(root) {
  return Object.fromEntries(workspacePackages(root).flatMap(pkg => {
    const entry = workspaceSourceEntry(root, pkg);
    return [
      [`${pkg.name}/src/*`, [`${pkg.path}/src/*`]],
      ...(entry ? [[pkg.name, [`${pkg.path}/${entry}`]]] : [])
    ];
  }).sort(([left], [right]) => left.localeCompare(right, "en")));
}
