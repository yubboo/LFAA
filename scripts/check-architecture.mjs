// 依赖方向护栏：扫全仓 packages/ 的跨包导入，按 docs/architecture/dependency-rules.json 判定是否越界。
// 规则覆盖：跨功能 UI 复用、客户端引 Node/宿主包、.tsx 落位、内核反向依赖、装配边、深导入、BOM 与未声明依赖。
// 运行：`node scripts/check-architecture.mjs [--root <dir>]`；CI 与 `pnpm check` 会调用，违规即退出 1。
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rootArgIndex = process.argv.indexOf("--root");
const ROOT = rootArgIndex >= 0 && process.argv[rootArgIndex + 1] ? resolve(process.argv[rootArgIndex + 1]) : DEFAULT_ROOT;
const RULES_PATH = join(ROOT, "docs", "architecture", "dependency-rules.json");

// 构建产物、依赖与上游内嵌源码/内置技能资产不参与本仓结构判定。
const SKIP_DIRS = new Set(["node_modules", "lib", "dist", ".git", ".desktop-build", "data", "vendor", ".mcdev", "shots", "coverage", "builtin-skills"]);
const SOURCE_EXT = /\.(?:ts|tsx|mts|cts|js|mjs|cjs)$/u;
// BOM 只查「人写的源码与配置」，二进制与构建信息不查。
const BOM_EXT = /\.(?:ts|tsx|mts|cts|js|mjs|cjs|css|json|md|yml|yaml|html|bat|ps1)$/u;

/** 递归收集文件，跳过构建产物与依赖目录。 */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

/** 读取规则文件；缺失时直接判错，避免护栏静默失效。 */
function readRules() {
  if (!existsSync(RULES_PATH)) {
    console.error("✖ 缺少 docs/architecture/dependency-rules.json，依赖护栏无法判定。");
    process.exit(1);
  }
  const text = readFileSync(RULES_PATH, "utf8").replace(/^\uFEFF/u, "");
  try {
    return JSON.parse(text);
  } catch (error) {
    console.error(`✖ dependency-rules.json 无法解析：${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/** 枚举 packages/<组>/<包>，返回包标识、分组、目录与清单。 */
function collectPackages() {
  const packagesRoot = join(ROOT, "packages");
  const result = [];
  if (!existsSync(packagesRoot)) return result;
  for (const groupEntry of readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!groupEntry.isDirectory() || SKIP_DIRS.has(groupEntry.name)) continue;
    const groupDir = join(packagesRoot, groupEntry.name);
    for (const pkgEntry of readdirSync(groupDir, { withFileTypes: true })) {
      if (!pkgEntry.isDirectory() || SKIP_DIRS.has(pkgEntry.name)) continue;
      const pkgDir = join(groupDir, pkgEntry.name);
      const manifestPath = join(pkgDir, "package.json");
      if (!existsSync(manifestPath)) continue;
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8").replace(/^\uFEFF/u, ""));
      const clientDir = join(pkgDir, "client");
      const hasClient = existsSync(clientDir);
      result.push({
        name: manifest.name ?? `${groupEntry.name}/${pkgEntry.name}`,
        group: groupEntry.name,
        dir: pkgDir,
        relDir: relative(ROOT, pkgDir).split(sep).join("/"),
        hasClient,
        clientFiles: hasClient ? walk(clientDir).length : 0,
        declared: new Set([
          ...Object.keys(manifest.dependencies ?? {}),
          ...Object.keys(manifest.devDependencies ?? {}),
          ...Object.keys(manifest.peerDependencies ?? {}),
        ]),
      });
    }
  }
  return result;
}

/** 提取一个源码文件里的模块说明符（静态 import / export from / 动态 import）。 */
function importSpecifiers(text) {
  const specs = new Set();
  const patterns = [
    /\bfrom\s+["']([^"']+)["']/gu,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/gu,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/gu,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) if (match[1]) specs.add(match[1]);
  }
  return [...specs];
}

/** 取 @lfaa 包说明符的包名：`@lfaa/ui-theme/client` → `@lfaa/ui-theme`。 */
function packageOf(specifier) {
  const parts = specifier.split("/");
  return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier;
}

const rules = readRules();
const packages = collectPackages();
const byName = new Map(packages.map((pkg) => [pkg.name, pkg]));
const sharedUi = new Set(rules.sharedUiPackages ?? []);
const hostOnly = new Set(rules.hostOnlyPackages ?? []);
const crossUi = new Set((rules.crossUiImports ?? []).map((entry) => `${entry.from}\u0000${entry.to}`));
const assemblyEdges = new Set((rules.assemblyEdges ?? []).map((entry) => `${entry.from}\u0000${entry.to}`));
const upward = new Map((rules.upwardForbidden ?? []).map((entry) => [entry.group, new Set(entry.forbids ?? [])]));

const violations = [];
const seen = new Set();
/** 记录一处违规；同一条（规则 + 文件 + 说明符）只报一次。 */
function report(rule, file, detail, hint = "") {
  const key = `${rule}\u0000${file}\u0000${detail}`;
  if (seen.has(key)) return;
  seen.add(key);
  violations.push({ rule, file: relative(ROOT, file).split(sep).join("/"), detail, hint });
}

let scannedFiles = 0;
let scannedImports = 0;

for (const pkg of packages) {
  for (const file of walk(pkg.dir)) {
    const name = file.split(sep).pop() ?? "";
    const rel = relative(ROOT, file).split(sep).join("/");
    const underClient = file.startsWith(join(pkg.dir, "client") + sep);
    const underTests = rel.includes("/tests/") || /\.test\.[a-z]+$/u.test(name);

    // 规则 bom 在包循环之后统一全仓扫描，这里只做结构与导入判定。

    // 规则 tsx-place：界面组件只能住在包内 client/，或测试文件里。
    if (name.endsWith(".tsx") && !underClient && !underTests) {
      report("tsx-place", file, "包内的 .tsx 不在 client/ 下", "界面代码放进 <包>/client/，能力入口保持无 React");
    }

    if (!SOURCE_EXT.test(name)) continue;
    scannedFiles += 1;
    const text = readFileSync(file, "utf8").replace(/^\uFEFF/u, "");

    for (const spec of importSpecifiers(text)) {
      // 规则 deep-src-import：只允许包的公开入口，不得深入 src/。
      if (/^@lfaa\/[^/]+\/[^/]+\/src\//u.test(spec)) {
        report("deep-src-import", file, spec, "改用包的公开入口（`.` 或 `./client`）");
        continue;
      }
      const target = spec.startsWith("@lfaa/") ? byName.get(packageOf(spec)) : undefined;

      // 规则 client-node-import：浏览器侧不得引 Node 专有模块或宿主专属包。
      // 先于「是否本仓 @lfaa 包」判断，否则 node: 说明符会被提前跳过。
      if (underClient && (spec.startsWith("node:") || (target && hostOnly.has(target.name)))) {
        report("client-node-import", file, spec, "客户端代码只能依赖浏览器可用的包；宿主能力走 HTTP/契约");
      }

      if (!spec.startsWith("@lfaa/")) continue;
      scannedImports += 1;
      if (!target) continue;

      // 规则 undeclared-dependency：用到别的包必须在自己的 package.json 里声明。
      if (target.name !== pkg.name && !pkg.declared.has(target.name)) {
        report("undeclared-dependency", file, `${spec}（${pkg.name} 未声明 ${target.name}）`, "在 package.json 的 dependencies 里登记");
      }

      // 规则 ui-cross-import：跨包复用界面组件必须走 ui/* 或登记过的例外。
      if (spec.endsWith("/client") && target.name !== pkg.name && !sharedUi.has(target.name)) {
        if (!crossUi.has(`${pkg.name}\u0000${target.name}`)) {
          report("ui-cross-import", file, `${pkg.name} → ${target.name}/client`, "跨功能界面复用请走 ui/* 共享包、Cordis 服务或插槽；确有必要则在 dependency-rules.json 登记理由");
        }
      }

      // 规则 upward-dependency：内核组不得反向依赖业务领域、界面与装配。
      const forbids = upward.get(pkg.group);
      if (forbids?.has(target.group)) {
        report("upward-dependency", file, `${pkg.name}（${pkg.group}）→ ${target.name}（${target.group}）`, "把共享类型下沉到 core 或 api，界面/业务包只向下依赖");
      }

      // 规则 assembly-edge：bundle 是装配叶子，只能被登记过的装配点引用。
      if (target.group === "bundle" && pkg.group !== "bundle" && !assemblyEdges.has(`${pkg.name}\u0000${target.name}`)) {
        report("assembly-edge", file, `${pkg.name} → ${target.name}`, "只有宿主装配点可以引用 bundle；能力包不得依赖装配包");
      }
    }
  }
}

// 规则 ui-package-required / legacy-client-grow：界面只住在 ui/* 与 packages/client/ui-* 两组。
// 存量包按 dependency-rules.json 的 baseline 记账，只许变少不许变多——这样拆包可以分批做，
// 但「新界面继续塞进能力包」从今天起被拦住。
const clientUi = rules.clientUi ?? {};
const allowedClientGroups = new Set(clientUi.allowedGroups ?? ["ui", "client"]);
const legacyClient = new Map((clientUi.legacy ?? []).map((entry) => [entry.package, entry.files ?? 0]));
const staleClientBaselines = [];
for (const pkg of packages) {
  if (!pkg.hasClient) {
    if (legacyClient.has(pkg.name)) staleClientBaselines.push(pkg.name);
    continue;
  }
  if (allowedClientGroups.has(pkg.group)) continue;
  const limit = legacyClient.get(pkg.name);
  if (limit === undefined) {
    report(
      "ui-package-required",
      join(pkg.dir, "package.json"),
      `${pkg.name} 的 client/ 不在允许的分组里`,
      "界面移进 packages/client/ui-<功能>/，能力包只留 src/ 与契约",
    );
    continue;
  }
  if (pkg.clientFiles > limit) {
    report(
      "legacy-client-grow",
      join(pkg.dir, "client"),
      `${pkg.name} 的界面文件 ${pkg.clientFiles} 个，超过基线 ${limit} 个`,
      "存量包不再接收新界面文件；新界面放 packages/client/ui-*，拆分时同步下调基线",
    );
  } else if (pkg.clientFiles < limit) {
    staleClientBaselines.push(`${pkg.name}（${pkg.clientFiles}/${limit}）`);
  }
}

// 规则 app-undeclared-dependency：apps 的源码可以引用 @lfaa/*，但必须在自己的清单里声明。
// 反例（真实踩过）：界面迁到 packages/client/ui-* 后 apps/web 仍声明旧包名，
// 类型检查走 tsconfig paths 通过、Vite 开发服务器却解析不到 → 整站起不来。
const appsRoot = join(ROOT, "apps");
if (existsSync(appsRoot)) {
  for (const appEntry of readdirSync(appsRoot, { withFileTypes: true })) {
    if (!appEntry.isDirectory() || SKIP_DIRS.has(appEntry.name)) continue;
    const appDir = join(appsRoot, appEntry.name);
    const manifestPath = join(appDir, "package.json");
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8").replace(/^\uFEFF/u, ""));
    const declared = new Set([
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.devDependencies ?? {}),
      ...Object.keys(manifest.peerDependencies ?? {}),
    ]);
    for (const file of walk(appDir)) {
      const name = file.split(sep).pop() ?? "";
      if (!SOURCE_EXT.test(name)) continue;
      // 打包/发布脚本常用字符串拼 subprocess 命令，不代表应用运行时依赖，跳过 apps/*/scripts/。
      if (relative(appDir, file).startsWith(`scripts${sep}`)) continue;
      for (const spec of importSpecifiers(readFileSync(file, "utf8"))) {
        if (!spec.startsWith("@lfaa/")) continue;
        const target = packageOf(spec);
        if (!declared.has(target)) {
          report(
            "app-undeclared-dependency",
            file,
            `${manifest.name ?? appEntry.name} 未声明 ${target}（引用了 ${spec}）`,
            `在 apps/${appEntry.name}/package.json 的 dependencies 里补 ${target}`,
          );
        }
      }
    }
  }
}

// 规则 bom：源码与配置不得带 UTF-8 BOM。全仓扫描一次：历史上 BOM 曾让启动期 JSON.parse 失败。
// 例外：`.ps1` 必须保留 BOM —— Windows PowerShell 5.1 读无 BOM 的脚本会按 ANSI 解码，
// 中文注释被解成乱码后可能被当成引号，直接语法报错（lfaa.ps1 就是这样崩过一次）。
// 只读前 3 个字节，不把整个文件读进内存。
for (const file of walk(ROOT)) {
  const name = file.split(sep).pop() ?? "";
  if (!BOM_EXT.test(name) || name.endsWith(".ps1")) continue;
  const head = readFileSync(file).subarray(0, 3);
  if (head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf) {
    report("bom", file, "文件带 UTF-8 BOM", "编辑器/PowerShell 写回时去掉 BOM；.editorconfig 要求 charset = utf-8（.ps1 例外，需保留 BOM）");
  }
}

if (staleClientBaselines.length > 0) {
  console.warn(`⚠ 界面基线可收紧（拆完后请下调 dependency-rules.json 的 clientUi.legacy）：${staleClientBaselines.join("、")}`);
}

if (violations.length === 0) {
  const legacyCount = packages.filter((pkg) => pkg.hasClient && !allowedClientGroups.has(pkg.group)).length;
  console.log(`✔ 依赖护栏通过：${packages.length} 个包、${scannedFiles} 个源文件、${scannedImports} 条跨包导入，无越界（界面待迁包 ${legacyCount} 个）。`);
  process.exit(0);
}

const byRule = new Map();
for (const violation of violations) {
  if (!byRule.has(violation.rule)) byRule.set(violation.rule, []);
  byRule.get(violation.rule).push(violation);
}
console.error(`✖ 依赖护栏发现 ${violations.length} 处越界（${byRule.size} 类规则）：`);
for (const [rule, list] of byRule) {
  console.error(`\n[${rule}] ${list.length} 处`);
  for (const item of list.slice(0, 20)) {
    console.error(`  - ${item.file} → ${item.detail}`);
    if (item.hint) console.error(`    提示：${item.hint}`);
  }
  if (list.length > 20) console.error(`  … 另有 ${list.length - 20} 处同类问题`);
}
console.error("\n规则与例外清单见 docs/architecture/dependency-rules.json。");
process.exit(1);