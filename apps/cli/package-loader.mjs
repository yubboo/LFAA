/** 功能：解析迁移后的能力包。作用：开发使用源码，生产使用根 dist/apps/control-plane，外部依赖优先由所属包解析。关联文件：register-package-loader.mjs、dist/apps/control-plane/workspace.json、各能力包 package.json。 */
import { createRequire, isBuiltin } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import { resolve as pathResolve, dirname, sep } from "node:path";
import { workspacePackages } from "../../scripts/harness-workspace.mjs";

const requireFromCli = createRequire(new URL("./package.json", import.meta.url));
const root = pathResolve(dirname(fileURLToPath(import.meta.url)), "../..");
const output = pathResolve(root, "dist/apps/control-plane");
const packages = existsSync(pathResolve(root, "pnpm-workspace.yaml"))
  ? workspacePackages(root)
  : JSON.parse(readFileSync(pathResolve(output, "workspace.json"), "utf8"));
const byName = new Map(packages.map((pkg) => [pkg.name, pkg]));
// 编译树没有 node_modules；源码安装时依赖属于各能力包，发布安装时才统一位于 npm 包根。
const packageResolvers = packages.flatMap((pkg) => {
  const sourceRoot = pathResolve(root, pkg.path);
  const manifest = pathResolve(sourceRoot, "package.json");
  return existsSync(manifest) ? [{
    sourcePrefix: sourceRoot + sep,
    compiledPrefix: pathResolve(output, pkg.path) + sep,
    require: createRequire(manifest)
  }] : [];
});

export async function resolve(specifier, context, nextResolve) {
  const slash = specifier.indexOf("/");
  const pkg = byName.get(slash < 0 ? specifier : specifier.slice(0, slash));
  if (pkg) {
    const compiled = context.parentURL?.includes("/dist/apps/control-plane/");
    const exportKey = slash < 0 ? "." : `./${specifier.slice(slash + 1)}`;
    const exported = pkg.exports?.[exportKey];
    // 使用包清单中的公开入口；生产运行树中的 TypeScript 入口已编译为 JavaScript。
    let subpath = typeof exported === "string" ? exported : slash < 0 ? "src/index.js" : specifier.slice(slash + 1);
    if (compiled) subpath = subpath.replace(/\.(ts|tsx)$/u, ".js");
    if (subpath === "client") subpath = "src/client/index.js";
    let target = pathResolve(compiled ? output : root, pkg.path, subpath);
    if (!compiled && target.endsWith(".js")) {
      if (existsSync(target.slice(0, -3) + ".ts")) target = target.slice(0, -3) + ".ts";
      else if (existsSync(target.slice(0, -3) + ".tsx")) target = target.slice(0, -3) + ".tsx";
    }
    return nextResolve(pathToFileURL(target).href, context);
  }
  if (isBuiltin(specifier) || specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("file:") || specifier.startsWith("data:") || specifier.startsWith("#")) {
    return nextResolve(specifier, context);
  }

  const parentPath = context.parentURL?.startsWith("file:") ? fileURLToPath(context.parentURL) : undefined;
  const owner = parentPath && packageResolvers.find((pkg) => parentPath.startsWith(pkg.sourcePrefix) || parentPath.startsWith(pkg.compiledPrefix));
  if (owner) {
    // 使用真实所属包的依赖与导出条件，避免把每个包的依赖重复声明到 CLI。
    return nextResolve(specifier, { ...context, parentURL: pathToFileURL(owner.sourcePrefix + "package.json").href });
  }
  try {
    const resolved = requireFromCli.resolve(specifier);
    return { url: pathToFileURL(resolved).href, shortCircuit: true };
  } catch {
    return nextResolve(specifier, context);
  }
}
