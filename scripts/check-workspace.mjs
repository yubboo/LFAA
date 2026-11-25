// 仓库边界检查：校验包命名、跨包子路径、Host/Client 隔离、依赖一致性、锁文件顺序、循环依赖、中文文件头与文件规模。
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, posix, relative, resolve, sep } from "node:path";
import yaml from "js-yaml";
import ts from "typescript";

// 支持 --root <dir> 指向任意仓库根，便于用临时夹具验证检查规则本身。
const rootFlag = process.argv.indexOf("--root");
const ROOT = rootFlag === -1
  ? resolve(import.meta.dirname, "..")
  : resolve(process.argv[rootFlag + 1] ?? ".");
const PACKAGES_DIR = join(ROOT, "packages");
const LOCKFILE_PATH = join(ROOT, "pnpm-lock.yaml");

/** 各检查级别；error 影响退出码，warn 只提示。 */
const LEVELS = { error: "error", warn: "warn" };

/** client 侧禁止出现的 Node 内建模块。 */
const NODE_BUILTINS = new Set([
  "assert", "buffer", "child_process", "cluster", "crypto", "dgram", "dns", "events",
  "fs", "http", "https", "net", "os", "path", "process", "readline", "stream",
  "timers", "tls", "tty", "url", "util", "v8", "vm", "worker_threads", "zlib",
]);

/** Host 侧禁止的浏览器依赖。 */
const HOST_FORBIDDEN = new Set(["react", "react-dom", "react-dom/client", "react/jsx-runtime"]);

const findings = [];

function report(level, rule, file, message) {
  findings.push({ level, rule, file: file ? relative(ROOT, file).split(sep).join("/") : "", message });
}

// ---------------------------------------------------------------------------
// 规则棘轮：新增规则不能一次性把既有债务变成红灯，但也不允许债务继续扩大。
// `scripts/check-allowlist.json` 只登记「已存在且已知」的违规文件；新增违规必须直接修掉。
// 豁免项一旦不再违规会以 warn 提示删除，保证清单只会变短。
// ---------------------------------------------------------------------------
const ALLOWLIST_RULES = ["file-size", "client-host-relative", "css-theme-literal"];
const ALLOWLIST_PATH = join(ROOT, "scripts", "check-allowlist.json");
const allowlist = new Map(ALLOWLIST_RULES.map((rule) => [rule, new Set()]));
const usedAllowlist = new Set();

/** 读取豁免清单；文件不存在时视为空清单，便于只读夹具直接跑规则。 */
function loadAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) return;
  let raw;
  try {
    raw = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8").replace(/^\uFEFF/u, ""));
  } catch (error) {
    report(LEVELS.error, "allowlist", ALLOWLIST_PATH, `清单不是合法 JSON：${error.message}`);
    return;
  }
  for (const [rule, entries] of Object.entries(raw)) {
    if (rule.startsWith("$")) continue;
    const target = allowlist.get(rule);
    if (!target) {
      report(LEVELS.error, "allowlist", ALLOWLIST_PATH, `未登记的规则名「${rule}」；可用规则：${ALLOWLIST_RULES.join(" / ")}`);
      continue;
    }
    for (const entry of Array.isArray(entries) ? entries : Array.isArray(entries?.files) ? entries.files : []) {
      target.add(String(entry).split("\\").join("/"));
    }
  }
}

/** 判断某文件的违规是否已登记豁免；命中时记录使用情况，供末尾清理过期条目。 */
function isAllowed(rule, relPath) {
  // --no-allowlist 按「如果现在没有豁免」来报告，便于盘点存量债务。
  if (process.argv.includes("--no-allowlist")) return false;
  const entries = allowlist.get(rule);
  if (!entries?.has(relPath)) return false;
  usedAllowlist.add(`${rule}\u0000${relPath}`);
  return true;
}

/** 汇总豁免清单里本轮未命中的条目：文件已修好或已删除，提示同步删清单。 */
function reportStaleAllowlist() {
  for (const [rule, entries] of allowlist) {
    for (const entry of entries) {
      if (!usedAllowlist.has(`${rule}\u0000${entry}`)) {
        report(LEVELS.warn, "allowlist-stale", join(ROOT, entry), `豁免已不再违规（${rule}），请从 scripts/check-allowlist.json 删除`);
      }
    }
  }
}

/** 读取目录下所有匹配后缀的文件，跳过 node_modules 与产物目录。 */
function walk(dir, suffixes, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === "dist" || entry === "lib" || entry === ".git" || entry === "builtin-skills") continue;
    const full = join(dir, entry);
    const info = statSync(full);
    if (info.isDirectory()) walk(full, suffixes, out);
    else if (suffixes.some((suffix) => entry.endsWith(suffix))) out.push(full);
  }
  return out;
}

/** 枚举 workspace 内的包：packages/<group>/<pkg> 与 packages/<pkg> 两种布局。 */
function discoverPackages() {
  const packages = [];
  for (const entry of readdirSync(PACKAGES_DIR)) {
    const groupDir = join(PACKAGES_DIR, entry);
    if (!statSync(groupDir).isDirectory()) continue;
    const maybeManifest = join(groupDir, "package.json");
    if (statSafe(maybeManifest)) {
      packages.push(groupDir);
      continue;
    }
    for (const child of readdirSync(groupDir)) {
      const childDir = join(groupDir, child);
      if (statSafe(join(childDir, "package.json"))) packages.push(childDir);
    }
  }
  return packages;
}

function statSafe(target) {
  try {
    return statSync(target).isFile();
  } catch {
    return false;
  }
}

// 读取 package.json；容忍 Windows 编辑器写入的 UTF-8 BOM。
function readJson(target) {
  const raw = readFileSync(target, "utf8").replace(/^\uFEFF/u, "");
  return JSON.parse(raw);
}

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/** apps 允许直接依赖的 boot 包；其余 Host 包只能经 client 子路径进入前端。 */
const APP_BOOT_ALLOW = new Set(["@lfaa/web-server"]);
const SELF_SCOPE = "@lfaa/";

/** 从说明符中取出 @lfaa 包名与子路径。 */
function parseScoped(spec) {
  if (!spec.startsWith(SELF_SCOPE)) return null;
  const rest = spec.slice(SELF_SCOPE.length);
  const slash = rest.indexOf("/");
  if (slash === -1) return { pkg: `${SELF_SCOPE}${rest}`, subpath: "" };
  return { pkg: `${SELF_SCOPE}${rest.slice(0, slash)}`, subpath: rest.slice(slash + 1) };
}

/** 提取一个源文件的导入说明符；去掉 BOM，避免首行注释检测误判。 */
function collectImports(file) {
  const text = readFileSync(file, "utf8").replace(/^\uFEFF/u, "");
  const info = ts.preProcessFile(text, true, true);
  return {
    text,
    specs: info.importedFiles.map((item) => item.fileName).filter((name) => typeof name === "string"),
  };
}

function checkPackageName(pkgDir, manifest) {
  const dirName = basename(pkgDir);
  if (!KEBAB.test(dirName)) {
    report(LEVELS.error, "name-kebab", join(pkgDir, "package.json"), `目录名「${dirName}」不是 kebab-case`);
  }
  const name = manifest.name ?? "";
  if (!name.startsWith(SELF_SCOPE)) {
    report(LEVELS.error, "name-kebab", join(pkgDir, "package.json"), `包名「${name}」缺少 ${SELF_SCOPE} 作用域`);
    return;
  }
  const bare = name.slice(SELF_SCOPE.length);
  if (!KEBAB.test(bare)) {
    report(LEVELS.error, "name-kebab", join(pkgDir, "package.json"), `包名「${name}」不是 kebab-case`);
  }
  if (!manifest.exports || typeof manifest.exports !== "object" || !manifest.exports["."]) {
    report(LEVELS.error, "exports-present", join(pkgDir, "package.json"), "缺少 exports 且必须包含 \".\" 入口");
  }
}

function checkDeclared(manifest, pkgDir) {
  return new Set(
    Object.keys({ ...manifest.dependencies, ...manifest.devDependencies, ...manifest.peerDependencies })
      .filter((name) => name.startsWith(SELF_SCOPE)),
  );
}

function checkFile(file, pkgDir, manifest, declared) {
  const rel = relative(pkgDir, file).split(sep).join("/");
  const repoRel = relative(ROOT, file).split(sep).join("/");
  const role = rel.startsWith("client/") ? "client" : rel.startsWith("src/") || rel.startsWith("contract/") ? "host" : null;
  if (!role) return null;

  const { text, specs } = collectImports(file);
  // 只约束 Host 侧入口：client 插件由 Vite 静态装配，不经过 Loader。
  if (role === "host" && rel === "src/index.ts") {
    checkPluginDefault(file, text);
    checkPluginInject(file, text);
  }
  if (!/^\/\/.*[\u4e00-\u9fff]/u.test(text.split("\n")[0] ?? "")) {
    report(LEVELS.warn, "cjk-header", file, "首行缺少中文职责注释");
  }

  for (const spec of specs) {
    if (spec.startsWith(".")) {
      const depth = spec.split("/").filter((part) => part === "..").length;
      if (depth >= 3) report(LEVELS.error, "cross-package-relative", file, `相对导入越界：${spec}`);
      // client 只能用相对路径在 client/ 与 contract/ 内走动；跨到 src/ 就是绕过公开契约。
      if (role === "client" && !isClientSafeTarget(rel, spec) && !isAllowed("client-host-relative", repoRel)) {
        report(LEVELS.error, "client-isolation", file, `Client 侧禁止相对导入 Host 内部文件：${spec}（改用 contract 或 @lfaa/*/client 公开入口）`);
      }
      continue;
    }
    const scoped = parseScoped(spec);
    if (scoped) {
      const head = scoped.subpath.split("/")[0];
      if (scoped.subpath && /^(src|client)\//u.test(scoped.subpath)) {
        report(LEVELS.error, "subpath-import", file, `禁止深层导入：${spec}`);
      } else if (scoped.subpath && !["client", "contract", "ark-plan", "token-plan"].includes(head)) {
        report(LEVELS.error, "subpath-import", file, `未声明的子路径导入：${spec}`);
      }
      if (scoped.pkg !== manifest.name && !declared.has(scoped.pkg)) {
        report(LEVELS.error, "dep-declared", file, `导入 ${scoped.pkg} 但 package.json 未声明依赖`);
      }
      if (role === "host" && scoped.subpath === "client") {
        report(LEVELS.error, "host-isolation", file, `Host 侧禁止依赖客户端入口：${spec}`);
      }
      if (role === "client" && /\/src\//u.test(spec)) {
        report(LEVELS.error, "client-isolation", file, `Client 侧禁止导入 Host 内部模块：${spec}`);
      }
    }
    if (role === "host" && HOST_FORBIDDEN.has(spec)) {
      report(LEVELS.error, "host-isolation", file, `Host 侧禁止依赖 ${spec}`);
    }
    if (role === "client") {
      const bare = spec.startsWith("node:") ? spec.slice(5) : spec;
      if (spec.startsWith("node:")) {
        report(LEVELS.error, "client-isolation", file, `Client 侧禁止使用 ${spec}`);
      } else if (NODE_BUILTINS.has(bare.split("/")[0])) {
        report(LEVELS.error, "client-isolation", file, `Client 侧禁止使用 Node 内建模块 ${spec}`);
      }
    }
  }

  for (const spec of specs) {
    if (spec.startsWith(".") && spec.endsWith(".css") && role === "host") {
      report(LEVELS.error, "host-isolation", file, `Host 侧禁止导入样式：${spec}`);
    }
  }
  return specs;
}

/**
 * 插件包必须默认导出插件本体：Cordis Loader 按 `default` 取插件，
 * 只有具名导出会导致「装得上但拿不到插件」。
 */
function checkPluginDefault(file, text) {
  if (!/^\s*export\s+(?:function|const)\s+\w+Plugin\b/mu.test(text)) return;
  if (/^\s*export\s+default\s+/mu.test(text)) return;
  report(LEVELS.error, "plugin-default-export", file, "导出 *Plugin 但缺少 export default（Loader 依赖默认导出）");
}

/**
 * Cordis Context 自带成员不是服务：`ctx.get("x")` 这类读取不计入 inject 覆盖检查。
 * 其余 `ctx.x` 一律视为服务依赖，必须出现在插件声明的 inject 里，否则装配顺序不保证。
 */
const CONTEXT_MEMBERS = new Set([
  "get", "set", "plugin", "effect", "on", "off", "once", "emit", "parallel", "waterfall", "bail", "serial",
  "provide", "inject", "logger", "loader", "fiber", "reflect", "scope", "root", "name", "registry",
]);

/**
 * 插件声明的 inject 必须覆盖它实际访问的 `ctx.*` 服务。
 * 反例：Service.static inject 补了 `llm`，插件级 `xxx.inject` 没补，构造函数读 `ctx.llm` 时 Host 启动即崩。
 * 只检查自己声明了 inject 的入口；没声明的插件由 Service 基类或调用方负责，不在本规则范围。
 */
function checkPluginInject(file, text) {
  if (!/\binject\b/u.test(text)) return;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const provided = new Set();
  const selfServices = new Set();
  const accessed = new Map();
  let partial = false;

  const readStringArray = (node) => {
    // 去掉 `as const` / 括号 / satisfies，拿到真正的数组字面量。
    let current = node;
    while (ts.isAsExpression(current) || ts.isParenthesizedExpression(current) || ts.isSatisfiesExpression?.(current)) {
      current = current.expression;
    }
    if (!ts.isArrayLiteralExpression(current)) return;
    for (const element of current.elements) {
      if (ts.isStringLiteral(element)) provided.add(element.text);
      else partial = true; // 展开或变量：无法静态判断，放弃本文件的覆盖检查以免误报
    }
  };

  const walk = (node) => {
    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && node.name.text === "inject") {
      readStringArray(node.initializer);
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && ts.isPropertyAccessExpression(node.left) && node.left.name.text === "inject") {
      readStringArray(node.right);
    }
    // Service 构造器里的 `super(ctx, "serviceName")`：自身服务不需要注入。
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.SuperKeyword
      && node.arguments.length >= 2 && ts.isIdentifier(node.arguments[0]) && node.arguments[0].text === "ctx") {
      const serviceName = node.arguments[1];
      if (ts.isStringLiteral(serviceName)) selfServices.add(serviceName.text);
    }
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "ctx") {
      const name = node.name.text;
      if (!CONTEXT_MEMBERS.has(name) && !accessed.has(name)) accessed.set(name, node.getStart(source));
    }
    ts.forEachChild(node, walk);
  };
  walk(source);

  if (partial) return;
  const missing = [...accessed.keys()].filter((name) => !provided.has(name) && !selfServices.has(name));
  if (missing.length === 0) return;
  report(
    LEVELS.error,
    "plugin-inject",
    file,
    `访问了 ${missing.map((name) => `ctx.${name}`).join("、")} 但 inject 未声明（Cordis 会在服务就绪前构建插件）`,
  );
}

/** 文件规模阈值（AGENTS §4）：软阈值提示拆分，硬阈值必须拆分或登记豁免。 */
const SIZE_LIMITS = [
  { suffix: ".module.css", warn: 250, error: 400 },
  { suffix: ".tsx", warn: 250, error: 400 },
  { suffix: ".ts", warn: 300, error: 500 },
];

/** 统计物理行数；剥离 BOM，末尾换行不计入。 */
function countLines(file) {
  const text = readFileSync(file, "utf8").replace(/^\uFEFF/u, "");
  if (text.length === 0) return 0;
  const lines = text.split(/\r?\n/u);
  return text.endsWith("\n") ? lines.length - 1 : lines.length;
}

/** 文件规模：越过硬上限必须按职责拆分，确需保留的要登记到豁免清单。 */
const softSizeFindings = [];

function checkFileSize(file) {
  const limit = SIZE_LIMITS.find((item) => file.endsWith(item.suffix));
  if (!limit) return;
  const relPath = relative(ROOT, file).split(sep).join("/");
  const lines = countLines(file);
  if (lines > limit.error) {
    if (isAllowed("file-size", relPath)) return;
    report(
      LEVELS.error,
      "file-size",
      file,
      `${lines} 行超过硬上限 ${limit.error}（按职责拆分；确需保留须在 scripts/check-allowlist.json 登记）`,
    );
    return;
  }
  if (lines > limit.warn) softSizeFindings.push(`${relPath} (${lines})`);
}

/** client 内相对导入只允许落在 client/ 或 contract/，其余视为越界访问 Host 内部。 */
function isClientSafeTarget(relPath, spec) {
  const target = posix.normalize(posix.join(posix.dirname(relPath), spec));
  return (
    target === "client" || target.startsWith("client/")
    || target === "contract" || target.startsWith("contract/")
  );
}

/** CSS 里颜色字面量的判定：`url(#id)`、注释与语义变量不算。 */
const CSS_COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/gu;

/** 逐条取出颜色字面量并解析其透明度；hex 与 hsl 没有 alpha 时返回 null。 */
function extractColorLiterals(value) {
  const found = [];
  const pattern = /#([0-9a-fA-F]{3,8})\b|rgba?\(\s*(\d+)\s+(\d+)\s+(\d+)\s*\/\s*([\d.]+%?)\s*\)|rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)|hsla?\([^)]*\)/gu;
  for (const match of value.matchAll(pattern)) {
    let alpha = null;
    const rawAlpha = match[5] ?? match[9];
    if (rawAlpha !== undefined) {
      alpha = rawAlpha.endsWith("%") ? Number.parseFloat(rawAlpha) / 100 : Number.parseFloat(rawAlpha);
    } else if (match[1]?.length === 8) {
      alpha = Number.parseInt(match[1].slice(6, 8), 16) / 255;
    } else if (match[1]?.length === 4) {
      alpha = Number.parseInt(`${match[1][3]}${match[1][3]}`, 16) / 255;
    }
    found.push({ text: match[0], alpha });
  }
  return found;
}

/** 阴影/滤镜/材质叠层属于表面质感而不是主题色：允许写具体数值。 */
const SHADOW_PROPERTY = /(?:shadow|filter|sheen|glow|overlay|scrim)/u;
const MATERIAL_PROPERTY = /^(?:background|background-color|border|border-[a-z]+|border-[a-z]+-color|outline|outline-color)$/u;
/** 写死颜色作为 var() 回退一律禁止：变量缺失时必须暴露问题，而不是退回某个固定色。 */
const LITERAL_FALLBACK = /var\(\s*--[a-z0-9-]+\s*,\s*(?:#|rgba?\(|hsla?\()/iu;

/**
 * 禁止 client 样式写死主题色：文本/边框/背景/状态色必须来自语义变量。
 * 例外只有两类，且有明确理由：
 * - 阴影、滤镜、玻璃材质与半透明叠层（alpha ≤ 0.2 的背景/边框）属于表面质感；
 * - 变量定义层与代码高亮调色板、主题预览样张需要具体色值（登记在豁免清单里）。
 */
function checkCssThemeLiteral(file) {
  const relPath = relative(ROOT, file).split(sep).join("/");
  if (!relPath.split("/").includes("client")) return;
  const text = readFileSync(file, "utf8").replace(/^\uFEFF/u, "");
  const hits = [];
  const lines = text.split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();
    if (trimmed.startsWith("/*") || trimmed.startsWith("*") || trimmed.startsWith("//")) continue;
    const sanitized = line.replace(/url\([^)]*\)/gu, "").replace(/\/\*.*?\*\//gu, "");
    const literals = extractColorLiterals(sanitized);
    if (literals.length === 0) continue;
    // 颜色写进 var() 回退：无论出现在哪一行都算违规。
    if (LITERAL_FALLBACK.test(sanitized)) {
      hits.push(index + 1);
      continue;
    }
    const property = (/^\s*([a-z-]+)\s*:/iu.exec(sanitized)?.[1] ?? "").toLowerCase();
    if (SHADOW_PROPERTY.test(property)) continue;
    const isMaterial = MATERIAL_PROPERTY.test(property);
    const themeColor = literals.some((item) => !(isMaterial && item.alpha !== null && item.alpha <= 0.2));
    if (themeColor) hits.push(index + 1);
  }
  if (hits.length === 0) return;
  if (isAllowed("css-theme-literal", relPath)) return;
  const sample = hits.slice(0, 5).join(", ");
  report(
    LEVELS.error,
    "css-theme-literal",
    file,
    `${hits.length} 处写死颜色（行 ${sample}${hits.length > 5 ? " …" : ""}）；改用 @lfaa/ui-theme 语义变量（定义层在 client/tokens.css），禁止并排放浅色值与暗色值`,
  );
}

/**
 * apps 只做启动：禁止直接依赖 Host 包（装配必须下沉到 packages/bundle 或 packages/host）。
 * 允许项：`@lfaa/*` 的 client 子路径，以及显式 boot 包。
 */
function checkApps() {
  const appsDir = join(ROOT, "apps");
  if (!existsSync(appsDir)) return 0;
  for (const asset of walk(appsDir, [".ts", ".tsx", ".module.css"])) checkFileSize(asset);
  const files = walk(appsDir, [".ts", ".tsx"]).filter((file) => !file.includes(`${sep}tests${sep}`));
  for (const file of files) {
    const { specs } = collectImports(file);
    for (const spec of specs) {
      const scoped = parseScoped(spec);
      if (!scoped) {
        if (spec.startsWith(".") && spec.split("/").filter((part) => part === "..").length >= 3) {
          report(LEVELS.error, "app-host-import", file, `apps 内相对导入越界：${spec}`);
        }
        continue;
      }
      if (scoped.subpath.startsWith("client")) continue;
      if (APP_BOOT_ALLOW.has(scoped.pkg) && !scoped.subpath) continue;
      report(LEVELS.error, "app-host-import", file, `apps 只做启动，禁止直接依赖 Host 包：${spec}`);
    }
  }
  return files.length;
}

/**
 * 源码目录只允许 TypeScript 源文件：构建失败时 tsc 可能把 JS/d.ts 落在 src 旁，
 * 这类残留会被后续构建继承，必须在检查阶段拦住。
 */
function checkStrayEmit(file, rel) {
  if (!rel.startsWith("src/")) return;
  if (/\.(js|jsx|d\.ts|map)$/u.test(rel)) {
    report(LEVELS.error, "stray-emit", file, `源码目录出现构建残留：${rel}`);
  }
}

/** 已登记的包分组；新组必须先写进 docs/architecture/package-taxonomy.md 再扩展此处。 */
const ALLOWED_GROUPS = new Set([
  "api", "bundle", "client", "core", "extension", "host", "sandbox", "ui", "workspace", "shell", "util", "test-support", "web", "goal", "guard", "spill", "plan", "fs", "compaction", "schedule", "feedback", "attachment", "session", "interaction", "media", "chat",
  // 规划中、落地时同轮登记：mcp / session / interaction / credentials / subprocess / telemetry / schedule / todo / plan / compaction
]);
/** 历史遗留的根级单包；已完成迁移，保持为空以禁止新增。 */
const LEGACY_ROOT_PACKAGES = new Set();

/** 校验包所在的分组是否已登记，防止出现根级散包与乱放。 */
function checkGroup(pkgDir, manifest) {
  const relToPkg = relative(PACKAGES_DIR, pkgDir).split(sep);
  if (relToPkg.length === 1) {
    if (LEGACY_ROOT_PACKAGES.has(relToPkg[0])) return;
    report(LEVELS.error, "package-group", join(pkgDir, "package.json"), `禁止在 packages 根目录建散包：${manifest.name}`);
    return;
  }
  const group = relToPkg[0];
  if (!ALLOWED_GROUPS.has(group)) {
    report(LEVELS.error, "package-group", join(pkgDir, "package.json"), `未登记的分组「${group}」：先在 package-taxonomy.md 登记再建包`);
  }
}

/** 每个包必须具备双语文档三件套：README.md、README.zh.md、README.i18n.yaml。 */
function checkReadmePair(pkgDir, manifest) {
  for (const required of ["README.md", "README.zh.md", "README.i18n.yaml"]) {
    if (!existsSync(join(pkgDir, required))) {
      report(LEVELS.error, "readme-pair", join(pkgDir, "package.json"), `缺少 ${required}`);
    }
  }
  const enPath = join(pkgDir, "README.md");
  if (existsSync(enPath)) {
    const head = readFileSync(enPath, "utf8").replace(/^\uFEFF/u, "").slice(0, 400);
    if (!head.startsWith("---")) {
      report(LEVELS.warn, "readme-pair", enPath, "README.md 缺少 YAML 头（description/kind）");
    }
  }
}

/** 检测包级依赖图是否存在环。 */
function checkCycles(graph) {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map([...graph.keys()].map((key) => [key, WHITE]));
  const stack = [];
  const visit = (node) => {
    color.set(node, GRAY);
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      if (!graph.has(next)) continue;
      const state = color.get(next);
      if (state === GRAY) {
        const cycle = stack.slice(stack.indexOf(next)).concat(next);
        report(LEVELS.error, "no-cycle", null, `循环依赖：${cycle.join(" → ")}`);
      } else if (state === WHITE) {
        visit(next);
      }
    }
    stack.pop();
    color.set(node, BLACK);
  };
  for (const node of graph.keys()) {
    if (color.get(node) === WHITE) visit(node);
  }
}

// ---------------------------------------------------------------------------
// 锁文件顺序：pnpm 只会写出按键排序的锁文件，乱序说明条款被人手改或用工具补丁插过。
// 这种文件在 pnpm 眼里「已是最新」，安装时不会重写仓库锁文件，却会把 node_modules/.pnpm/lock.yaml
// 重写成有序形态，于是「仓库锁文件 vs 安装副本」的比对永远不等（历史 bug：菜单 2 启动死锁）。
// ---------------------------------------------------------------------------
function compareLockKeys(left, right) {
  return left > right ? 1 : left < right ? -1 : 0;
}

/** 校验锁文件 packages / snapshots 段的键是否按 pnpm 的逐字节顺序排列。 */
function checkLockfileOrder() {
  if (!existsSync(LOCKFILE_PATH)) return;
  let document;
  try {
    document = yaml.load(readFileSync(LOCKFILE_PATH, "utf8").replace(/^\uFEFF/u, ""));
  } catch (error) {
    report(LEVELS.error, "lockfile-order", LOCKFILE_PATH, `锁文件无法解析：${error.message}`);
    return;
  }
  for (const section of ["packages", "snapshots"]) {
    const keys = Object.keys(document?.[section] ?? {});
    for (let index = 1; index < keys.length; index += 1) {
      if (compareLockKeys(keys[index - 1], keys[index]) > 0) {
        // 每个段只报第一处：一次重排会牵动几十行，逐条刷屏没有意义。
        report(
          LEVELS.error,
          "lockfile-order",
          LOCKFILE_PATH,
          `${section} 段顺序错乱：「${keys[index - 1]}」应排在「${keys[index]}」之后；请让 pnpm 重新生成锁文件，不要手改`,
        );
        break;
      }
    }
  }
}

function main() {
  const pkgDirs = discoverPackages();
  const graph = new Map();
  let fileCount = 0;
  loadAllowlist();

  for (const pkgDir of pkgDirs) {
    const manifest = readJson(join(pkgDir, "package.json"));
    checkPackageName(pkgDir, manifest);
    checkGroup(pkgDir, manifest);
    checkReadmePair(pkgDir, manifest);
    for (const stray of walk(pkgDir, [".js", ".jsx", ".d.ts", ".map"])) {
      const relToPkg = relative(pkgDir, stray).split(sep).join("/");
      checkStrayEmit(stray, relToPkg);
    }
    // 规模与主题色只扫源码，不区分 tests/src/client：规范对全部手写文件生效。
    // 规模与主题色扫描覆盖全部手写样式：主题变量定义层是全局 .css，也必须受主题色规则约束。
    for (const asset of walk(pkgDir, [".ts", ".tsx", ".css"])) {
      checkFileSize(asset);
      if (asset.endsWith(".css")) checkCssThemeLiteral(asset);
    }
    const declared = checkDeclared(manifest, pkgDir);
    const used = new Set();

    const files = walk(pkgDir, [".ts", ".tsx"]).filter((file) => {
      const rel = relative(pkgDir, file).split(sep).join("/");
      return !rel.startsWith("tests/") && !rel.includes("/tests/");
    });

    for (const file of files) {
      fileCount += 1;
      const specs = checkFile(file, pkgDir, manifest, declared);
      for (const spec of specs ?? []) {
        const scoped = parseScoped(spec);
        if (scoped && scoped.pkg !== manifest.name) used.add(scoped.pkg);
      }
    }

    graph.set(manifest.name, new Set([...used].filter((name) => name.startsWith(SELF_SCOPE))));
    for (const dep of declared) {
      if (!used.has(dep) && graph.get(manifest.name)?.has(dep) !== true) {
        report(LEVELS.warn, "dep-unused", join(pkgDir, "package.json"), `声明了 ${dep} 但代码未引用`);
      }
    }
  }

  checkCycles(graph);
  const appFiles = checkApps();
  checkLockfileOrder();
  fileCount += appFiles;
  reportStaleAllowlist();
  // 软阈值只汇总成一条提示：逐文件刷屏会淹没真正的错误与新警告，需要明细时加 --verbose。
  if (softSizeFindings.length > 0) {
    if (process.argv.includes("--verbose")) {
      for (const item of softSizeFindings) report(LEVELS.warn, "file-size", null, `超过拆分提示阈值：${item}`);
    } else {
      report(
        LEVELS.warn,
        "file-size",
        null,
        `${softSizeFindings.length} 个文件处于拆分提示区间（250–400 / 300–500 行），明细用 --verbose 查看`,
      );
    }
  }

  const errors = findings.filter((item) => item.level === LEVELS.error);
  const warns = findings.filter((item) => item.level === LEVELS.warn);

  for (const item of findings) {
    const prefix = item.file ? `${item.file}: ` : "";
    console.log(`${item.level === LEVELS.error ? "✖" : "⚠"} [${item.rule}] ${prefix}${item.message}`);
  }
  const allowedNote = usedAllowlist.size > 0 ? `（其中 ${usedAllowlist.size} 项沿用既有豁免）` : "";
  console.log(`\n检查 ${pkgDirs.length} 个包、${fileCount} 个源文件：${errors.length} 个错误，${warns.length} 个警告${allowedNote}。`);
  process.exitCode = errors.length > 0 ? 1 : 0;
}

main();




