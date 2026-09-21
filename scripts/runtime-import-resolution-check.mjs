/**
 * 文件：runtime-import-resolution-check.mjs
 * 作用：验证 workspace package 的公共导入在真实 package exports 层可解析，避免“TypeScript 通过、Vite 运行时失败”。
 * 负责：扫描 packages/apps 的 @lfaa/* import；验证目标 workspace package、exports 子路径和目标文件真实存在；拒绝 packages 内 tsconfig-only @/ alias；并检查会被 Node/Vite Config 直接执行的 TypeScript ESM 源码必须使用显式相对文件扩展名。
 * 不负责：启动 Vite、TypeScript 类型正确性、第三方 npm package 解析。
 * 状态归属：无运行时状态；每次读取当前 workspace package.json 与源码。
 * 对外接口：`node scripts/runtime-import-resolution-check.mjs`。
 * 关联文件：scripts/import-path-check.mjs、workspace package.json、docs/DEVELOPMENT.md。
 * 修改注意事项：新增 workspace 公共子路径时必须同时写入 package exports；不得通过宿主 alias 掩盖 package 自身解析缺口；foundation/domain/runtime/host-adapter/host/bundle 中由 Node/Vite Host 直接执行的源码，以及 apps/web/vite.config.ts，相对 ESM import 必须写 .ts/.tsx/.js 等真实扩展名。
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const ignored = new Set(["node_modules", "dist", "target", "coverage", ".git"]);
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

function listPackageJsons(base) {
  const result = [];
  const stack = [path.join(root, base)];
  while (stack.length) {
    const current = stack.pop();
    if (!current || !fs.existsSync(current)) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (ignored.has(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name === "package.json") result.push(full);
    }
  }
  return result;
}

const workspacePackages = new Map();
for (const file of [...listPackageJsons("packages"), ...listPackageJsons("apps")]) {
  const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
  if (typeof pkg.name === "string" && pkg.name.startsWith("@lfaa/")) {
    workspacePackages.set(pkg.name, { dir: path.dirname(file), pkg, file });
  }
}

function getExportTarget(exportsField, subpath) {
  if (typeof exportsField === "string") return subpath === "." ? exportsField : null;
  if (!exportsField || typeof exportsField !== "object" || Array.isArray(exportsField)) return null;
  const value = exportsField[subpath];
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    for (const key of ["import", "default", "types"]) {
      if (typeof value[key] === "string") return value[key];
    }
  }
  return null;
}

function importsFrom(text) {
  const specs = [];
  for (const pattern of [
    /\b(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ]) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) specs.push(match[1]);
  }
  return specs;
}


const nodeSourceLayers = new Set(["foundation", "domain", "runtime", "host-adapter", "bundle"]);

function owningWorkspace(relative) {
  const absolute = path.join(root, relative);
  let best = null;
  for (const item of workspacePackages.values()) {
    const prefix = `${item.dir}${path.sep}`;
    if (absolute.startsWith(prefix) && (!best || item.dir.length > best.dir.length)) best = item;
  }
  return best;
}

function isNodeExecutedSource(relative) {
  if (relative === "apps/web/vite.config.ts") return true;
  const owner = owningWorkspace(relative);
  if (!owner) return false;
  if (nodeSourceLayers.has(owner.pkg.lfaa?.layer)) return true;
  return owner.pkg.lfaa?.layer === "host" && owner.pkg.lfaa?.role !== "web-client-composition";
}

function relativeImportHasExplicitExtension(spec) {
  const clean = spec.split(/[?#]/, 1)[0];
  const basename = path.posix.basename(clean);
  return /\.[A-Za-z0-9]+$/.test(basename);
}

function resolveRelativeImport(importerRelative, spec) {
  const clean = spec.split(/[?#]/, 1)[0];
  return path.resolve(path.dirname(path.join(root, importerRelative)), clean);
}

function checkNodeErasableTypeScript(relative, text) {
  if (relative.endsWith(".tsx")) {
    failures.push(`${relative}: Node 直接执行的 source package 禁止 TSX/JSX；请把 UI 留在 presentation/composition。`);
  }
  const rules = [
    [/\b(?:const\s+)?enum\s+[A-Za-z_$]/, "enum/const enum"],
    [/\b(?:namespace|module)\s+[A-Za-z_$]/, "namespace/module"],
    [/\bimport\s+[A-Za-z_$][\w$]*\s*=\s*require\s*\(/, "import = require"],
    [/\bexport\s*=\s*/, "export ="],
    [/^\s*@(?:[A-Za-z_$]|\()/m, "decorator"],
    [/constructor\s*\([^)]*\b(?:public|private|protected|readonly)\s+[A-Za-z_$][\w$]*\s*[?:]/s, "constructor parameter property"],
  ];
  for (const [pattern, label] of rules) {
    if (pattern.test(text)) failures.push(`${relative}: Node source runtime 只允许可擦除 TypeScript 语法，禁止 ${label}。`);
  }
}
function walk(base) {
  const start = path.join(root, base);
  if (!fs.existsSync(start)) return;
  const stack = [start];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (ignored.has(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) { stack.push(full); continue; }
      if (!extensions.has(path.extname(entry.name))) continue;
      const relative = path.relative(root, full).replaceAll("\\", "/");
      const text = fs.readFileSync(full, "utf8");
      if (isNodeExecutedSource(relative)) checkNodeErasableTypeScript(relative, text);
      for (const spec of importsFrom(text)) {
        if (relative.startsWith("packages/") && spec.startsWith("@/")) {
          failures.push(`${relative}: package 源码使用仅 tsconfig 可见的 alias ${spec}。`);
          continue;
        }
        if ((spec.startsWith("./") || spec.startsWith("../")) && isNodeExecutedSource(relative)) {
          if (!relativeImportHasExplicitExtension(spec)) {
            failures.push(`${relative}: Node 直接执行的 TypeScript ESM 相对导入必须写显式扩展名：${spec}`);
            continue;
          }
          const resolvedRelative = resolveRelativeImport(relative, spec);
          if (!fs.existsSync(resolvedRelative)) {
            failures.push(`${relative}: 相对 ESM 导入目标不存在：${spec}`);
          }
          continue;
        }
        if (!spec.startsWith("@lfaa/")) continue;
        const parts = spec.split("/");
        const packageName = `${parts[0]}/${parts[1]}`;
        const targetPackage = workspacePackages.get(packageName);
        if (!targetPackage) continue;
        const subpath = parts.length === 2 ? "." : `./${parts.slice(2).join("/")}`;
        const target = getExportTarget(targetPackage.pkg.exports, subpath);
        if (!target) {
          failures.push(`${relative}: ${spec} 未在 ${path.relative(root, targetPackage.file).replaceAll("\\", "/")} 的 exports 中公开。`);
          continue;
        }
        const resolved = path.resolve(targetPackage.dir, target);
        if (!fs.existsSync(resolved)) {
          failures.push(`${relative}: ${spec} 的 exports 目标不存在：${path.relative(root, resolved).replaceAll("\\", "/")}`);
        }
      }
    }
  }
}

walk("packages");
walk("apps");

if (failures.length) {
  console.error("LFAA runtime import resolution check failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("LFAA runtime import resolution check passed.");
