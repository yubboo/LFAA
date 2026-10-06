/**
 * 功能：记录并检查正式运行树对应的源码指纹。
 * 作用：菜单启动前发现过期的 Web/控制端构建，避免源码修复后仍运行旧输出；不读取运行数据或秘密配置。
 * 关联文件：build-harness.mjs、apps/web/vite.config.ts、install-dependencies.ps1。
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, lstatSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const excluded = new Set(["node_modules", "data", "dist", "target", "gen", ".git"]);
const outputs = { host: "dist/apps/control-plane", web: "dist/apps/web" };

function inputs(repository, kind) {
  const files = [];
  function walk(path) {
    if (!existsSync(path)) return;
    const info = lstatSync(path);
    if (info.isSymbolicLink()) return;
    if (!info.isDirectory()) { files.push(path); return; }
    for (const entry of readdirSync(path).sort()) {
      if (excluded.has(entry)) continue;
      if (relative(repository, path).replaceAll("\\", "/") === "apps/web" && /^vite\.config\.ts\.timestamp-\d+-[a-f0-9]+\.mjs$/u.test(entry)) continue;
      walk(resolve(path, entry));
    }
  }
  for (const path of ["package.json", "pnpm-lock.yaml", `tsconfig.${kind === "host" ? "host" : "client"}.json`, "scripts/harness-workspace.mjs", "scripts/runtime-build-state.mjs"]) walk(resolve(repository, path));
  walk(resolve(repository, kind === "host" ? "scripts/build-harness.mjs" : "apps/web"));
  if (kind === "host") { walk(resolve(repository, "apps/cli/src")); walk(resolve(repository, "apps/cli/config")); }
  for (const group of readdirSync(resolve(repository, "packages"))) {
    if (group === "test-support" || kind === "host" && group === "client") continue;
    for (const name of readdirSync(resolve(repository, "packages", group))) {
      const path = resolve(repository, "packages", group, name);
      if (existsSync(resolve(path, "package.json"))) walk(path);
    }
  }
  return files.sort();
}

export function runtimeBuildFingerprint(kind, repository = root) {
  if (!outputs[kind]) throw new Error("未知构建职责。");
  const hash = createHash("sha256");
  for (const file of inputs(repository, kind)) {
    hash.update(relative(repository, file).replaceAll("\\", "/")); hash.update("\0");
    hash.update(readFileSync(file)); hash.update("\0");
  }
  return hash.digest("hex");
}

export function recordRuntimeBuild(kind, repository = root, expectedFingerprint) {
  const fingerprint = runtimeBuildFingerprint(kind, repository);
  if (expectedFingerprint !== undefined && fingerprint !== expectedFingerprint) throw new Error("构建期间源码发生变化，请重新构建，避免记录过期输出。");
  const output = resolve(repository, outputs[kind]);
  mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, "build-state.json"), JSON.stringify({ kind, fingerprint }));
}

export function staleRuntimeBuilds(profile = "web", repository = root) {
  return (profile === "web" ? ["host", "web"] : ["host"]).filter(kind => {
    const output = resolve(repository, outputs[kind]);
    if (!existsSync(resolve(output, kind === "host" ? "index.js" : "index.html"))) return true;
    try { return JSON.parse(readFileSync(resolve(output, "build-state.json"), "utf8")).fingerprint !== runtimeBuildFingerprint(kind, repository); }
    catch { return true; }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify(staleRuntimeBuilds(process.argv[2]))}\n`);
}
