/**
 * 功能：校验工作区包、依赖、类型路径、版本投影和文档入口。
 * 作用：只读门禁；--write 仅同步可重建的包目录清单及 TypeScript 路径映射。
 * 关联文件：harness-workspace.mjs、docs/harness-packages.json、docs/workspace-entry-map.md、tsconfig.*.json、package.json、.github/workflows/check.yml。
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { workspacePackages, workspaceSourceEntry, workspaceTypeScriptPaths, productRuntimePackages } from "./harness-workspace.mjs";
import { packageResponsibilities } from "./package-responsibilities.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const writing = process.argv.includes("--write");
const errors = [];
const readJson = path => JSON.parse(readFileSync(resolve(root, path), "utf8").replace(/^\uFEFF/u, ""));
const pkgs = workspacePackages(root).sort((a, b) => a.path.localeCompare(b.path, "en"));
const byName = new Map(pkgs.map(pkg => [pkg.name, pkg]));
/** 静态代码调用方用于职责追踪，不能作为实际运行/权限验证的证明。 */
const consumers = new Map(pkgs.map(pkg => [pkg.name, new Set()]));
const testConsumers = new Map(pkgs.map(pkg => [pkg.name, new Set()]));
const manifestConsumers = new Map(pkgs.map(pkg => [pkg.name, []]));
const profileConsumers = new Map(pkgs.map(pkg => [pkg.name, new Map()]));
if (byName.size !== pkgs.length) errors.push("存在重复包名");
function files(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.isSymbolicLink() || ["node_modules", "dist", ".git"].includes(entry.name)) return [];
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}
function packageForSpecifier(specifier) {
  return [...byName.keys()].filter(name => specifier === name || specifier.startsWith(`${name}/`))
    .sort((left, right) => right.length - left.length)[0];
}
function yamlScalar(value) {
  const scalar = value.replace(/\s+#.*$/u, "").trim();
  if (scalar.startsWith("\"") && scalar.endsWith("\"")) return scalar.slice(1, -1).replaceAll("\\\"", "\"");
  if (scalar.startsWith("'") && scalar.endsWith("'")) return scalar.slice(1, -1).replaceAll("''", "'");
  return scalar;
}
function bundlePlugins(content) {
  return content.split(/(?=^[ \t]{4}- id:)/mu).flatMap(block => {
    const id = /^[ \t]{4}- id:\s*(.*?)\s*$/mu.exec(block)?.[1];
    const pluginNameValue = /^[ \t]{6}name:\s*(.*?)\s*$/mu.exec(block)?.[1];
    if (!id || !pluginNameValue) return [];
    const name = yamlScalar(pluginNameValue);
    return [{ id: yamlScalar(id), name, required: /^[ \t]{6}required:\s*true\s*$/mu.test(block), packageName: packageForSpecifier(name) ?? null }];
  });
}
function addManifestConsumers(manifest, consumerPath) {
  for (const field of ["dependencies", "optionalDependencies", "peerDependencies", "devDependencies"]) {
    for (const name of Object.keys(manifest[field] ?? {})) {
      if (byName.has(name)) manifestConsumers.get(name).push({ consumer: consumerPath, field });
      if (manifest[field]?.[name]?.startsWith("workspace:") && !byName.has(name)) {
        errors.push(`${consumerPath} 的工作区依赖不存在：${name}`);
      }
    }
  }
}
function addProfileConsumer(name, profile, role) {
  const roles = profileConsumers.get(name).get(profile) ?? new Set();
  roles.add(role);
  profileConsumers.get(name).set(profile, roles);
}
for (const pkg of pkgs) {
  addManifestConsumers(pkg, pkg.path);
  const entry = workspaceSourceEntry(root, pkg);
  if (entry && !existsSync(resolve(root, pkg.path, entry))) errors.push(`${pkg.path} 公开入口不存在：${entry}`);
  for (const file of [...files(resolve(root, pkg.path, "src")), ...files(resolve(root, pkg.path, "tests"))]) {
    if (!/\.(?:ts|tsx|mjs|cjs)$/u.test(file)) continue;
    const source = readFileSync(file, "utf8");
    const isTest = /(?:\.test\.|\.spec\.|[\\/]tests[\\/])/u.test(file);
    for (const match of source.matchAll(/(?:from\s*|import\s*(?:\(\s*)?)["'](lfaa-[^"']+)["']/gu)) {
      const name = match[1].split("/")[0];
      if (name === pkg.name) continue;
      if (isTest) testConsumers.get(name)?.add(relative(root, file).replaceAll("\\", "/"));
      else {
        consumers.get(name)?.add(pkg.path);
        if (!byName.has(name)) errors.push(`${relative(root, file)} 引用未知包 ${name}`);
        else if (!pkg.dependencies?.[name] && !pkg.devDependencies?.[name] && !pkg.optionalDependencies?.[name] && !pkg.peerDependencies?.[name]) errors.push(`${pkg.path} 未声明内部依赖 ${name}`);
      }
    }
  }
  for (const directory of ["dist", "build", "target"]) if (existsSync(resolve(root, pkg.path, directory))) errors.push(`${pkg.path} 含包内构建目录 ${directory}`);
}
const applicationManifests = readdirSync(resolve(root, "apps"), { withFileTypes: true })
  .filter(entry => entry.isDirectory() && existsSync(resolve(root, "apps", entry.name, "package.json")))
  .map(entry => ({ path: `apps/${entry.name}`, ...readJson(`apps/${entry.name}/package.json`) }))
  .sort((left, right) => left.path.localeCompare(right.path, "en"));
for (const app of applicationManifests) addManifestConsumers(app, app.path);
// App 清单记录直接工作区依赖；源码导入记录调用方，测试导入单独保留。
for (const app of applicationManifests) {
  for (const directory of ["src", "bin", "tests"]) for (const file of files(resolve(root, app.path, directory))) {
    if (!/\.(?:ts|tsx|mjs|cjs)$/u.test(file)) continue;
    const isTest = directory === "tests" || /(?:\.test\.|\.spec\.)/u.test(file);
    for (const match of readFileSync(file, "utf8").matchAll(/(?:from\s*|import\s*(?:\(\s*)?)["'](lfaa-[^"']+)["']/gu)) {
      const name = match[1].split("/")[0];
      (isTest ? testConsumers : consumers).get(name)?.add(isTest ? relative(root, file).replaceAll("\\", "/") : app.path);
    }
  }
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
for (const path of directories) if (!packageResponsibilities[path]) errors.push(`${path} 缺少逐包职责注解，不能仅按包组推测`);
for (const path of Object.keys(packageResponsibilities)) if (!directories.includes(path)) errors.push(`逐包职责注解指向不存在目录：${path}`);
const bundlePatches = files(resolve(root, "packages/bundle")).filter(path => /\.ya?ml$/u.test(path)).map(path => ({ path: relative(root, path).replaceAll("\\", "/"), content: readFileSync(path, "utf8") }));
const bundlePackages = new Map();
for (const pkg of pkgs.filter(item => item.lfaa?.bundle?.patch)) {
  const patchPath = resolve(root, pkg.path, pkg.lfaa.bundle.patch);
  if (!existsSync(patchPath)) {
    errors.push(`${pkg.path} 声明的 Bundle patch 不存在：${pkg.lfaa.bundle.patch}`);
    continue;
  }
  const patchRelative = relative(root, patchPath).replaceAll("\\", "/");
  const patchContent = readFileSync(patchPath, "utf8");
  bundlePackages.set(pkg.name, { name: pkg.name, path: pkg.path, patch: patchRelative, plugins: bundlePlugins(patchContent) });
}
const bundleDeclarations = new Map(pkgs.map(pkg => [pkg.name, new Set()]));
for (const patch of bundlePatches) {
  for (const plugin of bundlePlugins(patch.content)) if (plugin.packageName) bundleDeclarations.get(plugin.packageName).add(patch.path);
}
const profilesRoot = resolve(root, "apps/cli/config/profiles");
const profileReports = [];
for (const directory of readdirSync(profilesRoot, { withFileTypes: true }).filter(entry => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name, "en"))) {
  const profilePath = `apps/cli/config/profiles/${directory.name}/package.json`;
  const manifest = readJson(profilePath);
  const bundleNames = manifest.lfaa?.profile?.bundles;
  if (!Array.isArray(bundleNames)) {
    errors.push(`${profilePath} 未声明 lfaa.profile.bundles 数组`);
    continue;
  }
  const selectedBundles = [];
  const roots = new Set();
  const plugins = [];
  for (const bundleName of bundleNames) {
    const bundlePackage = byName.get(bundleName);
    const bundle = bundlePackages.get(bundleName);
    if (!bundlePackage || !bundle) {
      errors.push(`${profilePath} 引用的 Bundle 不存在或未声明 patch：${bundleName}`);
      continue;
    }
    roots.add(bundleName);
    addProfileConsumer(bundleName, directory.name, "bundle");
    selectedBundles.push({ name: bundleName, packagePath: bundle.path, patch: bundle.patch });
    for (const plugin of bundle.plugins) {
      const packagePath = plugin.packageName ? byName.get(plugin.packageName)?.path ?? null : null;
      if (!plugin.packageName && plugin.name.startsWith("lfaa-")) errors.push(`${bundle.patch} 声明了无法解析的 LFAA 插件包：${plugin.name}`);
      if (plugin.packageName) {
        roots.add(plugin.packageName);
        addProfileConsumer(plugin.packageName, directory.name, "plugin");
      }
      plugins.push({ ...plugin, packagePath, bundle: bundle.name, patch: bundle.patch });
    }
  }
  const dependencyClosure = new Set();
  const pending = [...roots];
  while (pending.length) {
    const name = pending.pop();
    if (dependencyClosure.has(name)) continue;
    const pkg = byName.get(name);
    if (!pkg) continue;
    dependencyClosure.add(name);
    for (const field of ["dependencies", "optionalDependencies"]) {
      for (const dependency of Object.keys(pkg[field] ?? {})) if (byName.has(dependency)) pending.push(dependency);
    }
  }
  for (const name of dependencyClosure) if (!roots.has(name)) addProfileConsumer(name, directory.name, "dependency");
  profileReports.push({ name: directory.name, path: profilePath, bundles: selectedBundles, plugins,
    workspacePackages: [...dependencyClosure].sort((a, b) => a.localeCompare(b, "en")) });
}
const applicationReports = applicationManifests.map(app => {
  const productionDependencies = [...new Set(["dependencies", "optionalDependencies"].flatMap(field => Object.keys(app[field] ?? {}).filter(name => byName.has(name))))].sort();
  const developmentDependencies = [...new Set(["devDependencies", "peerDependencies"].flatMap(field => Object.keys(app[field] ?? {}).filter(name => byName.has(name))))].sort();
  return { path: app.path, name: app.name, workspaceDependencies: productionDependencies, developmentDependencies };
});
const current = { reference: previous.reference, commit: previous.commit, applications: applicationReports, profiles: profileReports, packages: directories.map(path => {
  const pkg = pkgs.find(item => item.path === path);
  const old = previousByPath.get(path);
  const entry = pkg ? workspaceSourceEntry(root, pkg) : undefined;
  return { path, name: pkg?.name ?? null, upstreamName: old?.upstreamName ?? null, upstream: old?.upstream ?? false, status: pkg ? "implemented" : "placeholder",
    responsibility: packageResponsibilities[path] ?? null,
    evidence: { entry: entry ? `${path}/${entry}` : null, readme: existsSync(resolve(root, path, "README.md")) ? `${path}/README.md` : null,
      consumers: pkg ? [...consumers.get(pkg.name)].sort() : [],
      testConsumers: pkg ? [...testConsumers.get(pkg.name)].sort() : [],
      manifestConsumers: pkg ? manifestConsumers.get(pkg.name).sort((a, b) => a.consumer.localeCompare(b.consumer, "en") || a.field.localeCompare(b.field, "en")) : [],
      profileConsumers: pkg ? [...profileConsumers.get(pkg.name)].flatMap(([profile, roles]) => [...roles].sort().map(role => ({ profile, role }))).sort((a, b) => a.profile.localeCompare(b.profile, "en") || a.role.localeCompare(b.role, "en")) : [],
      bundleDeclarations: pkg ? [...bundleDeclarations.get(pkg.name)].sort() : [],
      boundary: pkg ? "仅源接口/静态引用/装配声明，不代表已加载或实测" : "目标职责；占位不可执行" } };
}) };
const productCount = pkgs.filter(pkg => pkg.lfaa?.runtime !== false && !pkg.path.startsWith("packages/test-support/")).length;
const markdown = ["# LFAA Harness 目录对标清单", "", "<!-- 由 scripts/check-workspace.mjs --write 生成，不手工维护计数或路径。 -->", "",
  `参考 [DeepSeek Harness](${current.reference})，上游基线 commit \`${current.commit}\`。`, "",
  `当前 ${directories.length} 个两级目录、${pkgs.length} 个实际 workspace 包（${productCount} 个产品源码/组合包，${pkgs.length - productCount} 个工程/测试包），${directories.length - pkgs.length} 个占位目录。控制端/节点运行树含 ${productRuntimePackages(root).length} 个包；客户端源码包单独进入 Web 构建。`, "",
  "`implemented` 仅表示有 package.json 和源码/装配；不代表已经进入 Profile、通过运行验收或与 DSH 等价。`placeholder` 不可执行。产品能力现状见 [系统总体架构](系统总体架构.md)，历史核验见 [P0 记录](archive/audits/harness-p0-audit.md)。", "",
  "每个目录单独标注职责，来源为 `scripts/package-responsibilities.mjs`，由 Gate 对实际包树逐项核对；占位行描述目标职责。源码入口、代码/清单消费者、Profile 使用及 Bundle 声明完整记录在同名 JSON 中，它们不冒充运行验收。", "",
  "按入口查 Profile、Bundle 和插件包声明，请看[入口装配图](workspace-entry-map.md)。", "",
  "| 仓库相对目录 | 包名 | 状态 | 专属职责 | 源入口/证据边界 | 来源 |", "|---|---|---|---|---|---|",
  ...current.packages.map(pkg => `| [${pkg.path}](../${pkg.path}) | ${pkg.name ?? "—"} | ${pkg.status} | ${pkg.responsibility ?? "缺少注解"} | ${pkg.evidence.entry ? `[源码](../${pkg.evidence.entry})；${pkg.evidence.consumers.length} 个代码消费者；${pkg.evidence.manifestConsumers.length} 个清单消费者；${pkg.evidence.profileConsumers.length} 个 Profile 角色；${pkg.evidence.bundleDeclarations.length} 个 Bundle 声明` : pkg.status === "placeholder" ? "占位不可执行" : "仅组合/清单；未证实运行"} | ${pkg.upstream ? "DSH 同名目录" : "LFAA 扩展"} |`), ""].join("\n");
const placeholderPackages = current.packages.filter(pkg => pkg.status === "placeholder");
const placeholderMarkdown = ["# 上游占位包索引（未实现）", "", "<!-- 由 scripts/check-workspace.mjs --write 从 docs/harness-packages.json 的同一目录扫描生成，不手工维护计数或路径。 -->", "",
  "这些目录当前没有 package.json，不能作为 workspace 包装载或执行。空目录仅表示目标职责尚未实现，不代表已有能力，也不要求机械填充；目录职责、消费者和装配状态以[全包清单](../harness-packages.md)及源码为准。", "",
  "| # | 目录 | 分组 |", "|---|---|---|",
  ...placeholderPackages.map((pkg, index) => `| ${index + 1} | \`${pkg.path}\` | ${pkg.path.split("/")[1] ?? "—"} |`), "",
  `合计 ${placeholderPackages.length} 个占位目录。实现一个目录后重新运行 \`pnpm run sync:workspace\`；本索引由工作区 Gate 检查并同步。`, ""].join("\n");
const packageLink = name => {
  const pkg = byName.get(name);
  return pkg ? `[\`${name}\`](../${pkg.path})` : `\`${name}\` (外部包)`;
};
const entryMapPath = "docs/workspace-entry-map.md";
const entryMapMarkdown = ["# LFAA 运行入口与包装配图", "", "<!-- 由 scripts/check-workspace.mjs --write 生成，不手工维护包名、Profile 或 Bundle 列表。 -->", "",
  "本图从 App 的 `package.json`、CLI Profile 的 `package.json`、Bundle package metadata 与 `cordis.patch.yml` 生成。它显示源码中的依赖/装配声明；不证明插件已运行、能力可用或通过真实宿主验收。", "",
  "## 应用入口直接依赖", "", "| 入口 | package | 生产 workspace 依赖 | 工程/测试 workspace 依赖 |", "|---|---|---:|---:|",
  ...current.applications.map(app => `| [${app.path}](../${app.path}) | \`${app.name}\` | ${app.workspaceDependencies.length} | ${app.developmentDependencies.length} |`), "",
  ...current.applications.flatMap(app => [
    `<details><summary>${app.path} 生产 workspace 依赖（${app.workspaceDependencies.length}）</summary>`, "",
    ...(app.workspaceDependencies.length ? app.workspaceDependencies.map(name => `- ${packageLink(name)}`) : ["无直接 workspace 生产依赖。"]), "", "</details>", "",
    `<details><summary>${app.path} 工程/测试 workspace 依赖（${app.developmentDependencies.length}）</summary>`, "",
    ...(app.developmentDependencies.length ? app.developmentDependencies.map(name => `- ${packageLink(name)}`) : ["无直接 workspace 工程/测试依赖。"]), "", "</details>", ""
  ]),
  "## Control Plane Profile", "", "| Profile | 来源 | Bundle 顺序 | Plugin 声明数 | 工作区包依赖闭包 |"];
entryMapMarkdown.push("|---|---|---|---:|---:|",
  ...current.profiles.map(profile => `| \`${profile.name}\` | [${profile.path}](../${profile.path}) | ${profile.bundles.map(bundle => packageLink(bundle.name)).join(" → ") || "无"} | ${profile.plugins.length} | ${profile.workspacePackages.length} |`), "");
for (const profile of current.profiles) {
  entryMapMarkdown.push(`### Profile \`${profile.name}\``, "", `Bundle 顺序来自 [${profile.path}](../${profile.path})；插件清单由各 Bundle patch 按顺序合并。工作区依赖闭包只沿包清单中的 \`dependencies\` 和 \`optionalDependencies\` 展开。`, "",
    `包依赖闭包：${profile.workspacePackages.length} 个 workspace 包；逐包角色见 [JSON 清单](harness-packages.json)。`, "");
}
const usedBundles = [...new Set(current.profiles.flatMap(profile => profile.bundles.map(bundle => bundle.name)))].sort((a, b) => a.localeCompare(b, "en"));
entryMapMarkdown.push("## Profile 所选 Bundle 的插件声明", "", "`required` 记录来自 patch；未标记为必需的条目显示为可选。外部依赖与 LFAA workspace 包分开列出。", "");
for (const bundleName of usedBundles) {
  const bundle = bundlePackages.get(bundleName);
  entryMapMarkdown.push(`### ${packageLink(bundleName)}`, "", `来源：[${bundle.patch}](../${bundle.patch})`, "", "| Plugin ID | Cordis 名称 | 工作区包/来源 | 必需 |", "|---|---|---|---|",
    ...bundle.plugins.map(plugin => `| \`${plugin.id}\` | \`${plugin.name}\` | ${plugin.packageName ? packageLink(plugin.packageName) : "外部包/未进入 workspace"} | ${plugin.required ? "是" : "否"} |`), "");
}
const sourceOnlyPackages = current.packages.filter(pkg => pkg.name && pkg.status === "implemented"
  && byName.get(pkg.name)?.lfaa?.runtime !== false
  && pkg.evidence.consumers.length === 0
  && pkg.evidence.profileConsumers.length === 0
  && !pkg.evidence.manifestConsumers.some(consumer => ["dependencies", "optionalDependencies"].includes(consumer.field))
  && !pkg.path.startsWith("packages/test-support/"));
entryMapMarkdown.push("## 没有已知产品代码或 Profile 消费者的源码包", "", "以下仅是静态复核线索：已登记测试、工程清单依赖或 README 用途会一并列出。没有当前产品消费者不等于可以删除；需要结合包合同和外部消费者继续判断。", "", "| 包 | 运行树标记 | 测试消费者 | 清单消费者 | 结论提示 |", "|---|---|---|---|---|");
for (const pkg of sourceOnlyPackages) {
  const tests = pkg.evidence.testConsumers.length ? pkg.evidence.testConsumers.map(path => `[${path}](../${path})`).join(", ") : "无静态测试引用";
  const manifests = pkg.evidence.manifestConsumers.length ? pkg.evidence.manifestConsumers.map(consumer => `${consumer.consumer} (${consumer.field})`).join(", ") : "无";
  const marker = pkg.path.startsWith("packages/client/") ? "Client 源码包；未列入 apps/web 依赖" : "随控制端运行树打包";
  const hint = pkg.evidence.testConsumers.length ? "无当前产品代码/Profile 引用；存在测试引用，需确认产品或工程用途" : "无当前代码/Profile 引用，需确认接入、工程用途或退役状态";
  entryMapMarkdown.push(`| [${pkg.name}](../${pkg.path}) | ${marker} | ${tests} | ${manifests} | ${hint} |`);
}
entryMapMarkdown.push("");
const entryMap = entryMapMarkdown.join("\n");
if (writing) {
  writeFileSync(resolve(root, inventoryPath), `${JSON.stringify(current, null, 2)}\n`);
  writeFileSync(resolve(root, "docs/harness-packages.md"), markdown);
  writeFileSync(resolve(root, "docs/development/placeholder-packages.md"), placeholderMarkdown);
  writeFileSync(resolve(root, entryMapPath), entryMap);
} else {
  if (JSON.stringify(previous) !== JSON.stringify(current)) errors.push("包目录 JSON 清单过期");
  if (readFileSync(resolve(root, "docs/harness-packages.md"), "utf8").replace(/\r\n?/gu, "\n") !== markdown) errors.push("包目录 Markdown 清单过期");
  const placeholderIndexPath = resolve(root, "docs/development/placeholder-packages.md");
  if (!existsSync(placeholderIndexPath) || readFileSync(placeholderIndexPath, "utf8").replace(/\r\n?/gu, "\n") !== placeholderMarkdown) errors.push("上游占位包索引过期，运行 pnpm run sync:workspace");
  if (!existsSync(resolve(root, entryMapPath)) || readFileSync(resolve(root, entryMapPath), "utf8").replace(/\r\n?/gu, "\n") !== entryMap) errors.push("运行入口与包装配图过期，运行 pnpm run sync:workspace");
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
