/** 功能：构建 Harness。作用：各包仅清理自己的根 dist 子目录，控制端入口输出至 dist/apps/control-plane。关联文件：tsconfig.host.json、工作区包清单。 */
import { spawnSync } from "node:child_process";
import { mkdir, readdir, readFile, writeFile, cp, rm } from "node:fs/promises";
import { dirname, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { transform } from "esbuild";
import { workspacePackages } from "./harness-workspace.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packages = workspacePackages(root);
const require = createRequire(import.meta.url);
async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(path));
    else result.push(path);
  }
  return result;
}
function managedOutput(path) {
  const within = relative(resolve(root, "dist"), path);
  if (!within || within === ".." || within.startsWith(`..${sep}`)) throw new Error("构建输出必须位于根 dist 内。");
  return path;
}
if (process.argv[2] === "host") {
  // 测试支持和浏览器代码均不进入控制端/节点发布运行树。
  const runtimePackages = packages.filter((pkg) => !pkg.path.startsWith("packages/client/") && !pkg.path.startsWith("packages/test-support/"));
  const output = managedOutput(resolve(root, "dist/apps/control-plane"));
  await rm(output, { recursive: true, force: true });
  const result = spawnSync(process.execPath, [require.resolve("typescript/bin/tsc"), "-p", resolve(root, "tsconfig.host.json")], { cwd: root, stdio: "inherit", windowsHide: true });
  if (result.status !== 0) throw new Error("控制端编译失败。");
  for (const pkg of runtimePackages) {
    await mkdir(resolve(output, pkg.path), { recursive: true });
    await cp(resolve(root, pkg.path, "package.json"), resolve(output, pkg.path, "package.json"));
    for (const source of await files(resolve(root, pkg.path))) {
      if (!/\.(mjs|yml|yaml)$/u.test(source)) continue;
      const target = resolve(output, relative(root, source));
      await mkdir(dirname(target), { recursive: true });
      await cp(source, target);
    }
  }
  await cp(resolve(root, "apps/cli/config"), resolve(output, "apps/cli/config"), { recursive: true });
  await writeFile(resolve(output, "workspace.json"), JSON.stringify(runtimePackages));
  await writeFile(resolve(output, "package.json"), JSON.stringify({ type: "module" }));
  await writeFile(resolve(output, "index.js"), '/** 功能：启动编译后的 Harness。作用：供桌面外壳运行。关联文件：apps/cli/src/index.js。 */\nimport "./apps/cli/src/index.js";\n');
  process.stdout.write(`控制端已构建：${output}\n`);
} else {
  const selected = process.argv[2] === "package" ? packages.filter((pkg) => resolve(root, pkg.path) === process.cwd()) : packages.filter((pkg) => !pkg.path.startsWith("packages/test-support/"));
  if (!selected.length) throw new Error("没有找到要构建的工作区包。");
  for (const pkg of selected) {
    const output = managedOutput(resolve(root, "dist", pkg.path));
    await rm(output, { recursive: true, force: true });
    for (const source of await files(resolve(root, pkg.path))) {
      if (source.endsWith(".d.ts") || source.endsWith(".d.mts")) continue;
      let target = resolve(output, relative(resolve(root, pkg.path), source));
      await mkdir(dirname(target), { recursive: true });
      if (/\.(ts|tsx)$/u.test(source)) {
        target = target.replace(/\.(ts|tsx)$/u, ".js");
        const result = await transform(await readFile(source, "utf8"), { loader: source.endsWith(".tsx") ? "tsx" : "ts", format: "esm", target: "es2022", jsx: "automatic" });
        await writeFile(target, result.code);
      } else await cp(source, target);
    }
  }
  process.stdout.write(`已构建 ${selected.length} 个能力包，输出位于根 dist/packages。\n`);
}
