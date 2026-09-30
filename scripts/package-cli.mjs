/**
 * 功能：组装 @yubboo/lfaa 的 npm 发布目录。
 * 作用：只收录编译后的界面、控制端/节点能力与长期运行工具，排除工作区依赖协议、测试和用户数据。
 * 关联文件：apps/cli/bin/lfaa.mjs、apps/cli/package.json、build-harness.mjs、根 package.json。
 */
import { cp, mkdir, readFile, writeFile, rm, stat, chmod } from "node:fs/promises";
import { dirname, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "dist/npm/lfaa");
const within = relative(resolve(root, "dist/npm"), output);
if (!within || within === ".." || within.startsWith(`..${sep}`)) throw new Error("npm 组装输出必须位于根 dist/npm 内。");
const cli = JSON.parse(await readFile(resolve(root, "apps/cli/package.json"), "utf8"));
for (const required of ["dist/apps/control-plane/workspace.json", "dist/apps/control-plane/index.js", "dist/apps/web/index.html"]) await stat(resolve(root, required));
const runtimePackages = JSON.parse(await readFile(resolve(root, "dist/apps/control-plane/workspace.json"), "utf8"));
if (runtimePackages.some((pkg) => pkg.path.startsWith("packages/test-support/") || pkg.path.startsWith("packages/client/"))) throw new Error("发布运行树包含测试支持或客户端源码包。");

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const path of ["dist/apps/control-plane", "dist/apps/web", "packages/util/home-paths/src"]) {
  await mkdir(dirname(resolve(output, path)), { recursive: true });
  await cp(resolve(root, path), resolve(output, path), { recursive: true });
}
for (const path of ["apps/cli/register-package-loader.mjs", "apps/cli/package-loader.mjs", "scripts/harness-workspace.mjs", "scripts/resolve-data-directory.mjs", "scripts/get-project-drive-type.ps1", "README.md", ".env.example"]) {
  await mkdir(dirname(resolve(output, path)), { recursive: true });
  await cp(resolve(root, path), resolve(output, path));
}
// 发布包内部的能力由 workspace.json 解析；npm 只安装真实的外部运行依赖。
const dependencies = {};
for (const pkg of [cli, ...runtimePackages]) {
  for (const [name, version] of Object.entries(pkg.dependencies ?? {})) {
    if (version.startsWith("workspace:")) continue;
    // 发布包必须携带所有运行能力的外部依赖；版本冲突明确失败，不能静默覆盖。
    if (dependencies[name] && dependencies[name] !== version) throw new Error(`运行包的依赖版本不一致：${name}（${dependencies[name]} / ${version}）。`);
    dependencies[name] = version;
  }
}
const manifest = {
  name: cli.name, version: cli.version, description: "LFAA Harness：由大模型驱动的应用与节点工作台",
  type: "module", private: false, bin: cli.bin, engines: cli.engines,
  repository: cli.repository, homepage: "https://github.com/yubboo/LFAA", publishConfig: { access: "public" },
  files: ["bin", "apps/cli", "scripts", "packages/util/home-paths/src", "dist/apps/control-plane", "dist/apps/web", ".env.example"],
  dependencies
};
await mkdir(resolve(output, "bin"), { recursive: true });
await cp(resolve(root, "apps/cli/bin/lfaa.mjs"), resolve(output, "bin/lfaa.mjs"));
await chmod(resolve(output, "bin/lfaa.mjs"), 0o755);
await writeFile(resolve(output, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(resolve(output, "apps/cli/package.json"), `${JSON.stringify({ name: cli.name, version: cli.version, type: "module", dependencies }, null, 2)}\n`);
process.stdout.write(`npm 发布目录已准备：${output}\n发布名：${manifest.name}@${manifest.version}\n`);
