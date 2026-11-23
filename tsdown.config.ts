// 包构建配置：把 tsc 产出的 lib/types JS 打包成 lib 下的公开入口（DSH 模型）。
import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { defineConfig } from "tsdown";

/** 精确枚举真实包目录并转为仓库相对路径。 */
function discoverPackages(): string[] {
  const packagesDir = join(import.meta.dirname, "packages");
  const found: string[] = [];
  for (const group of readdirSync(packagesDir)) {
    const groupDir = join(packagesDir, group);
    if (!statSync(groupDir).isDirectory()) continue;
    if (statSync(join(groupDir, "package.json"), { throwIfNoEntry: false })?.isFile()) {
      found.push(groupDir);
      continue;
    }
    for (const child of readdirSync(groupDir)) {
      const childDir = join(groupDir, child);
      if (statSync(join(childDir, "package.json"), { throwIfNoEntry: false })?.isFile()) found.push(childDir);
    }
  }
  const vendorDir = join(import.meta.dirname, "vendor");
  if (statSync(vendorDir, { throwIfNoEntry: false })?.isDirectory()) {
    for (const child of readdirSync(vendorDir)) {
      const childDir = join(vendorDir, child);
      if (statSync(join(childDir, "package.json"), { throwIfNoEntry: false })?.isFile()) found.push(childDir);
    }
  }
  return found.map((dir) => relative(import.meta.dirname, dir).split(sep).join("/"));
}

export default defineConfig({
  workspace: discoverPackages(),
  entry: ["lib/types/index.js"],
  outDir: "lib",
  platform: "node",
  format: ["esm"],
  target: "es2022",
  // 与 DSH 一致：固定输出 .js 而不是 .mjs，保证 main 与 exports 指向同一文件名。
  fixedExtension: false,
  dts: false,
  clean: false,
});

