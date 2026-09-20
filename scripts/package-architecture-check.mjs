/**
 * 文件：package-architecture-check.mjs
 * 作用：把 LFAA 的“真实模块、单向依赖、无占位 workspace”变成机器门禁。
 * 负责：package layer/role、内部依赖方向、循环依赖、空壳 package、Rust 空壳 crate 检查。
 * 不负责：业务测试、TypeScript/Rust 编译、跨进程运行时权限。
 * 状态归属：读取当前工作树，无持久状态。
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packageRoots = ["apps", "packages"];
const allowedTargets = new Map([
  ["foundation", new Set()],
  ["runtime", new Set(["foundation"])],
  ["domain", new Set(["foundation"])],
  ["presentation", new Set(["foundation"])],
  ["composition", new Set(["foundation", "runtime", "domain", "presentation"])],
  ["host-adapter", new Set(["foundation", "runtime", "domain"])],
  ["host", new Set(["foundation", "runtime", "domain", "presentation", "composition", "host-adapter"])],
  ["bundle", new Set(["foundation", "runtime", "domain", "presentation", "composition", "host-adapter", "host"])],
  ["app", new Set(["foundation", "runtime", "domain", "presentation", "composition", "host-adapter", "host", "bundle"])],
]);

function walkForPackageJson(dir, result = []) {
  if (!fs.existsSync(dir)) return result;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", "dist", "target", ".git"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkForPackageJson(full, result);
    else if (entry.isFile() && entry.name === "package.json") result.push(full);
  }
  return result;
}

function sourceFiles(dir) {
  const result = [];
  const src = path.join(dir, "src");
  if (!fs.existsSync(src)) return result;
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (/\.(?:ts|tsx|mts|cts)$/.test(entry.name)) result.push(full);
    }
  };
  visit(src);
  return result;
}

function normalizedSource(file) {
  return fs.readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .trim();
}

const manifests = [];
for (const packageRoot of packageRoots) {
  for (const packageFile of walkForPackageJson(path.join(root, packageRoot))) {
    const dir = path.dirname(packageFile);
    const data = JSON.parse(fs.readFileSync(packageFile, "utf8"));
    if (!data.name?.startsWith("@lfaa/")) continue;
    const relative = path.relative(root, dir).replaceAll("\\", "/");
    const layer = data.lfaa?.layer;
    const role = data.lfaa?.role;
    if (!allowedTargets.has(layer)) throw new Error(`${relative}: package.json#lfaa.layer 无效或缺失：${String(layer)}`);
    if (typeof role !== "string" || !role.trim()) throw new Error(`${relative}: package.json#lfaa.role 必须是非空字符串。`);
    const files = sourceFiles(dir);
    if (files.length === 0) throw new Error(`${relative}: workspace package 必须有真实 src 实现；规划占位只能留在文档。`);
    const meaningful = files.some((file) => {
      const code = normalizedSource(file);
      return code !== "" && code !== "export {};" && code !== "export{};";
    });
    if (!meaningful) throw new Error(`${relative}: 仅包含 export {} 的占位 package 禁止进入 workspace。`);
    manifests.push({ name: data.name, layer, role, data, relative });
  }
}

const byName = new Map(manifests.map((item) => [item.name, item]));
const graph = new Map(manifests.map((item) => [item.name, new Set()]));
for (const item of manifests) {
  const dependencyMaps = [item.data.dependencies ?? {}, item.data.optionalDependencies ?? {}, item.data.peerDependencies ?? {}];
  for (const dependencyMap of dependencyMaps) {
    for (const depName of Object.keys(dependencyMap)) {
      const target = byName.get(depName);
      if (!target) continue;
      graph.get(item.name).add(depName);
      const workspaceFeatureComposition = item.layer === "composition"
        && item.role === "product-composition"
        && target.layer === "composition"
        && target.role === "workspace-feature-composition";
      if (!allowedTargets.get(item.layer).has(target.layer) && !workspaceFeatureComposition) {
        throw new Error(`${item.relative}: ${item.layer}/${item.role} 不得依赖 ${target.layer}/${target.role}（${depName}）。`);
      }
    }
  }
}

const visiting = new Set();
const visited = new Set();
function visit(name, trail = []) {
  if (visiting.has(name)) throw new Error(`检测到 @lfaa workspace 循环依赖：${[...trail, name].join(" -> ")}`);
  if (visited.has(name)) return;
  visiting.add(name);
  for (const target of graph.get(name) ?? []) visit(target, [...trail, name]);
  visiting.delete(name);
  visited.add(name);
}
for (const name of graph.keys()) visit(name);

// Rust 的定位是 Frozen Native Kernel。禁止只声明 module_name() 的空壳 crate 进入 Cargo workspace。
const cargoRoot = fs.readFileSync(path.join(root, "Cargo.toml"), "utf8");
const memberMatches = [...cargoRoot.matchAll(/"(native\/[^"]+)"/g)].map((match) => match[1]);
for (const member of memberMatches) {
  const srcDir = path.join(root, member, "src");
  if (!fs.existsSync(srcDir)) throw new Error(`${member}: Cargo workspace member 缺少 src。`);
  const rustFiles = [];
  const visitRust = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visitRust(full);
      else if (entry.isFile() && entry.name.endsWith(".rs")) rustFiles.push(full);
    }
  };
  visitRust(srcDir);
  const code = rustFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
  const withoutComments = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  if (rustFiles.length === 0 || (/module_name\s*\(/.test(withoutComments) && withoutComments.split(/\r?\n/).filter((line) => line.trim()).length < 35)) {
    throw new Error(`${member}: 空壳 Rust crate 禁止进入 workspace；只有真实 Native primitive 才允许新增 crate。`);
  }
}

console.log(`LFAA package architecture check passed. Node workspaces=${manifests.length}, Native crates=${memberMatches.length}.`);
