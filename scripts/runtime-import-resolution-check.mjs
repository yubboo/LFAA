/**
 * 文件：runtime-import-resolution-check.mjs
 * 作用：验证 workspace package 的公共导入在真实 package exports 层可解析，避免“TypeScript 通过、Vite 运行时失败”。
 * 负责：扫描 packages/apps 的 @lfaa/* import；验证目标 workspace package、exports 子路径和目标文件真实存在；拒绝 packages 内 tsconfig-only @/ alias。
 * 不负责：启动 Vite、TypeScript 类型正确性、第三方 npm package 解析。
 * 状态归属：无运行时状态；每次读取当前 workspace package.json 与源码。
 * 对外接口：`node scripts/runtime-import-resolution-check.mjs`。
 * 关联文件：scripts/import-path-check.mjs、workspace package.json、DEVELOPMENT.md。
 * 修改注意事项：新增 workspace 公共子路径时必须同时写入 package exports；不得通过宿主 alias 掩盖 package 自身解析缺口。
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
      for (const spec of importsFrom(text)) {
        if (relative.startsWith("packages/") && spec.startsWith("@/")) {
          failures.push(`${relative}: package 源码使用仅 tsconfig 可见的 alias ${spec}。`);
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
