/**
 * 功能：校验工作区包、依赖、类型路径、版本投影和文档入口。
 * 作用：只读门禁；--write 仅同步可重建的包目录清单及 TypeScript 路径映射。
 * 关联文件：harness-workspace.mjs、docs/harness-packages.json、tsconfig.*.json、package.json、.github/workflows/check.yml。
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { workspacePackages, workspaceSourceEntry, workspaceTypeScriptPaths, productRuntimePackages } from "./harness-workspace.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const writing = process.argv.includes("--write");
const errors = [];
const readJson = path => JSON.parse(readFileSync(resolve(root, path), "utf8").replace(/^\uFEFF/u, ""));
const pkgs = workspacePackages(root).sort((a, b) => a.path.localeCompare(b.path, "en"));
const byName = new Map(pkgs.map(pkg => [pkg.name, pkg]));
if (byName.size !== pkgs.length) errors.push("存在重复包名");
function files(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.isSymbolicLink() || ["node_modules", "dist", ".git"].includes(entry.name)) return [];
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}
for (const pkg of pkgs) {
  const entry = workspaceSourceEntry(root, pkg);
  if (entry && !existsSync(resolve(root, pkg.path, entry))) errors.push(`${pkg.path} 公开入口不存在：${entry}`);
  for (const file of files(resolve(root, pkg.path, "src"))) {
    if (!/\.(?:ts|tsx|mjs|cjs)$/u.test(file) || /\.test\./u.test(file)) continue;
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/(?:from\s*|import\s*(?:\(\s*)?)["'](lfaa-[^"']+)["']/gu)) {
      const name = match[1].split("/")[0];
      if (name === pkg.name) continue;
      if (!byName.has(name)) errors.push(`${relative(root, file)} 引用未知包 ${name}`);
      else if (!pkg.dependencies?.[name] && !pkg.devDependencies?.[name]) errors.push(`${pkg.path} 未声明内部依赖 ${name}`);
    }
  }
  for (const [name, version] of Object.entries(pkg.dependencies ?? {})) {
    if (version.startsWith("workspace:") && !byName.has(name)) errors.push(`${pkg.path} 的工作区依赖不存在：${name}`);
  }
  for (const directory of ["dist", "build", "target"]) if (existsSync(resolve(root, pkg.path, directory))) errors.push(`${pkg.path} 含包内构建目录 ${directory}`);
}
const visited = new Set();
function visit(name, stack = []) {
  if (stack.includes(name)) { errors.push(`包依赖环：${[...stack, name].join(" → ")}`); return; }
  if (visited.has(name)) return;
  for (const dependency of Object.keys(byName.get(name)?.dependencies ?? {})) if (byName.has(dependency)) visit(dependency, [...stack, name]);
  visited.add(name);
}
for (const pkg of pkgs) visit(pkg.name);

const expectedPaths = workspaceTypeScriptPaths(root);
for (const file of ["tsconfig.client.json", "tsconfig.host.json"]) {
  const config = readJson(file);
  if (writing) {
    config.compilerOptions.paths = expectedPaths;
    writeFileSync(resolve(root, file), `${JSON.stringify(config, null, 2)}\n`);
  } else if (JSON.stringify(config.compilerOptions.paths) !== JSON.stringify(expectedPaths)) errors.push(`${file} 路径映射过期，运行 pnpm run sync:workspace`);
}

const inventoryPath = "docs/harness-packages.json";
const previous = readJson(inventoryPath);
const previousByPath = new Map(previous.packages.map(pkg => [pkg.path, pkg]));
const directories = readdirSync(resolve(root, "packages"), { withFileTypes: true }).filter(entry => entry.isDirectory()).flatMap(group =>
  readdirSync(resolve(root, "packages", group.name), { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => `packages/${group.name}/${entry.name}`)).sort();
const current = { reference: previous.reference, commit: previous.commit, packages: directories.map(path => {
  const pkg = pkgs.find(item => item.path === path);
  const old = previousByPath.get(path);
  return { path, name: pkg?.name ?? null, upstreamName: old?.upstreamName ?? null, upstream: old?.upstream ?? false, status: pkg ? "implemented" : "placeholder" };
}) };
const productCount = pkgs.filter(pkg => pkg.lfaa?.runtime !== false && !pkg.path.startsWith("packages/test-support/")).length;
const markdown = ["# LFAA Harness 目录对标清单", "", "<!-- 由 scripts/check-workspace.mjs --write 生成，不手工维护计数或路径。 -->", "",
  `参考 [DeepSeek Harness](${current.reference})，上游基线 commit \`${current.commit}\`。`, "",
  `当前 ${directories.length} 个两级目录、${pkgs.length} 个实际 workspace 包（${productCount} 个产品源码/组合包，${pkgs.length - productCount} 个工程/测试包），${directories.length - pkgs.length} 个占位目录。控制端/节点运行树含 ${productRuntimePackages(root).length} 个包；客户端源码包单独进入 Web 构建。`, "",
  "`implemented` 仅表示有 package.json 和源码/装配；不代表已经进入 Profile、通过运行验收或与 DSH 等价。`placeholder` 不可执行。产品能力现状见 [系统总体架构](系统总体架构.md)，历史核验见 [P0 记录](archive/audits/harness-p0-audit.md)。", "",
  "| 仓库相对目录 | 包名 | 状态 | 来源 |", "|---|---|---|---|",
  ...current.packages.map(pkg => `| [${pkg.path}](../${pkg.path}) | ${pkg.name ?? "—"} | ${pkg.status} | ${pkg.upstream ? "DSH 同名目录" : "LFAA 扩展"} |`), ""].join("\n");
if (writing) {
  writeFileSync(resolve(root, inventoryPath), `${JSON.stringify(current, null, 2)}\n`);
  writeFileSync(resolve(root, "docs/harness-packages.md"), markdown);
} else {
  if (JSON.stringify(previous) !== JSON.stringify(current)) errors.push("包目录 JSON 清单过期");
  if (readFileSync(resolve(root, "docs/harness-packages.md"), "utf8") !== markdown) errors.push("包目录 Markdown 清单过期");
}
const versions = ["apps/cli/package.json", "apps/web/package.json", "apps/desktop-electron/package.json", "update.json"].map(path => readJson(path).version);
const changelog = readFileSync(resolve(root, "docs/updata-log.md"), "utf8");
const latest = /\*\*项目版本：\*\*\s*`LFAA (\d+\.\d+\.\d+)`/u.exec(changelog)?.[1];
if (!latest || versions.some(version => version !== latest)) errors.push("当前产品版本与更新日志/清单不一致");
const headings = [...changelog.matchAll(/^## #([0-9]+) /gmu)].map(match => Number(match[1]));
if (headings.some((number, index) => number !== headings.length - index)) errors.push("更新日志编号不连续");

// 历史材料中的机器路径是记录证据；门禁只检查当前文档的可移植文件链接。
for (const file of [resolve(root, "README.md"), ...(existsSync(resolve(root, "README.en.md")) ? [resolve(root, "README.en.md")] : []), resolve(root, "开发规范.md"), ...files(resolve(root, "docs"))]) {
  if (!file.endsWith(".md") || /[\\/]archive[\\/]/u.test(file)) continue;
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/!?\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+"[^"]*")?\)/gu)) {
    const link = match[1] ?? match[2];
    if (/^(?:https?:|mailto:|codex:)/u.test(link)) continue;
    if (/^[A-Za-z]:[\\/]/u.test(link)) { errors.push(`${relative(root, file)} 含机器绝对链接：${link}`); continue; }
    const target = decodeURIComponent(link.split("#")[0]);
    if (target && !existsSync(resolve(dirname(file), target))) errors.push(`${relative(root, file)} 链接不存在：${link}`);
    const anchor = link.split("#")[1];
    const linkedFile = target ? resolve(dirname(file), target) : file;
    if (anchor?.startsWith("lfaa-") && existsSync(linkedFile) && !readFileSync(linkedFile, "utf8").includes(`<a id="${anchor}"></a>`)) errors.push(`${relative(root, file)} 合同锚点不存在：${link}`);
  }
  if (file.endsWith(".zh.md") && !existsSync(file.replace(/\.zh\.md$/u, ".md"))) errors.push(`${relative(root, file)} 缺少配对英文入口`);
}
const uniqueErrors = [...new Set(errors)];
if (uniqueErrors.length) {
  process.stderr.write(`${uniqueErrors.slice(0, 50).join("\n")}\n共 ${uniqueErrors.length} 项错误。\n`); process.exitCode = 1;
} else process.stdout.write(`工作区检查通过：${pkgs.length} 个包，版本 ${latest}，类型映射/依赖/文档一致。\n`);
