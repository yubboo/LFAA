// 仓库边界检查：校验包命名、跨包子路径、Host/Client 隔离、依赖一致性、循环依赖与中文文件头。
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import ts from "typescript";

// 支持 --root <dir> 指向任意仓库根，便于用临时夹具验证检查规则本身。
const rootFlag = process.argv.indexOf("--root");
const ROOT = rootFlag === -1
  ? resolve(import.meta.dirname, "..")
  : resolve(process.argv[rootFlag + 1] ?? ".");
const PACKAGES_DIR = join(ROOT, "packages");

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

/** 读取目录下所有匹配后缀的文件，跳过 node_modules 与产物目录。 */
function walk(dir, suffixes, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === "dist" || entry === "lib" || entry === ".git") continue;
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
  const role = rel.startsWith("client/") ? "client" : rel.startsWith("src/") || rel.startsWith("contract/") ? "host" : null;
  if (!role) return null;

  const { text, specs } = collectImports(file);
  // 只约束 Host 侧入口：client 插件由 Vite 静态装配，不经过 Loader。
  if (role === "host" && rel === "src/index.ts") checkPluginDefault(file, text);
  if (!/^\/\/.*[\u4e00-\u9fff]/u.test(text.split("\n")[0] ?? "")) {
    report(LEVELS.warn, "cjk-header", file, "首行缺少中文职责注释");
  }

  for (const spec of specs) {
    if (spec.startsWith(".")) {
      const depth = spec.split("/").filter((part) => part === "..").length;
      if (depth >= 3) report(LEVELS.error, "cross-package-relative", file, `相对导入越界：${spec}`);
      continue;
    }
    const scoped = parseScoped(spec);
    if (scoped) {
      const head = scoped.subpath.split("/")[0];
      if (scoped.subpath && /^(src|client)\//u.test(scoped.subpath)) {
        report(LEVELS.error, "subpath-import", file, `禁止深层导入：${spec}`);
      } else if (scoped.subpath && !["client", "contract", "ark-plan"].includes(head)) {
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
 * apps 只做启动：禁止直接依赖 Host 包（装配必须下沉到 packages/bundle 或 packages/host）。
 * 允许项：`@lfaa/*` 的 client 子路径，以及显式 boot 包。
 */
function checkApps() {
  const appsDir = join(ROOT, "apps");
  if (!existsSync(appsDir)) return 0;
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
  "api", "bundle", "core", "extension", "host", "sandbox", "ui", "workspace", "shell", "util", "test-support",
  // 规划中、落地时同轮登记：extension / web / mcp / session / interaction / credentials / sandbox / subprocess / telemetry / schedule / todo / goal / plan
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

function main() {
  const pkgDirs = discoverPackages();
  const graph = new Map();
  let fileCount = 0;

  for (const pkgDir of pkgDirs) {
    const manifest = readJson(join(pkgDir, "package.json"));
    checkPackageName(pkgDir, manifest);
    checkGroup(pkgDir, manifest);
    checkReadmePair(pkgDir, manifest);
    for (const stray of walk(pkgDir, [".js", ".jsx", ".d.ts", ".map"])) {
      const relToPkg = relative(pkgDir, stray).split(sep).join("/");
      checkStrayEmit(stray, relToPkg);
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
  fileCount += appFiles;

  const errors = findings.filter((item) => item.level === LEVELS.error);
  const warns = findings.filter((item) => item.level === LEVELS.warn);

  for (const item of findings) {
    const prefix = item.file ? `${item.file}: ` : "";
    console.log(`${item.level === LEVELS.error ? "✖" : "⚠"} [${item.rule}] ${prefix}${item.message}`);
  }
  console.log(`\n检查 ${pkgDirs.length} 个包、${fileCount} 个源文件：${errors.length} 个错误，${warns.length} 个警告。`);
  process.exitCode = errors.length > 0 ? 1 : 0;
}

main();




