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
  return workspacePackages(root).flatMap((pkg) => [
    { find: `${pkg.name}/src`, replacement: resolve(root, pkg.path, "src") },
    { find: pkg.name, replacement: resolve(root, pkg.path, "src/index.ts") }
  ]);
}
