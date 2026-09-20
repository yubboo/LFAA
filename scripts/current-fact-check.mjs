/**
 * 文件：current-fact-check.mjs
 * 作用：阻止当前事实文档回退到 v0.0.100 前的平铺 package、App 业务或仓库级 Runtime 目录。
 * 负责：核对当前版本、Harness capability-family 主骨架、薄 App、Runtime Home 与主要 UI Owner。
 * 不负责：改写历史日志、TypeScript 编译、Vite 构建或用户验收。
 * 状态归属：无状态；只读取工作区文件。
 * 对外接口：node scripts/current-fact-check.mjs。
 * 关联文件：ARCHITECTURE.md、DEVELOPMENT.md、docs/MODULES.md、docs/RUNTIME.md、docs/UI.md、docs/项目结构与代码地图.md。
 * 修改注意事项：只约束“当前真相文档”；CHANGELOG/DEVELOPMENT_LOG/PROMPTS 的历史路径不得因此被伪造重写。
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const version = JSON.parse(fs.readFileSync(path.join(root, "lfaa.release.json"), "utf8")).displayVersion;
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const exists = (relative) => fs.existsSync(path.join(root, relative));
const fail = (message) => { console.error(`LFAA current fact check failed: ${message}`); process.exit(1); };

const currentDocs = [
  "README.md",
  "AGENTS.md",
  "ARCHITECTURE.md",
  "DEVELOPMENT.md",
  "PROJECT_PLAN.md",
  "docs/README.md",
  "docs/MODULES.md",
  "docs/RUNTIME.md",
  "docs/UI.md",
  "docs/TESTING.md",
  "docs/RELEASES.md",
  "docs/项目结构与代码地图.md",
];
for (const relative of currentDocs) {
  const source = read(relative);
  if (!source.slice(0, 2400).includes(version)) fail(`${relative} 开头未标识当前版本 ${version}`);
}

const architecture = read("ARCHITECTURE.md");
for (const token of [
  "packages/<capability-family>/<package>",
  "apps/web/src/main.ts",
  "packages/bundle/web-app",
  "packages/llm/",
  "packages/client/workspace",
  "packages/client/app-shell",
  "LFAA_HOME",
  "native/secret-store",
]) if (!architecture.includes(token)) fail(`ARCHITECTURE.md 缺少当前事实 ${token}`);

const map = read("docs/项目结构与代码地图.md");
for (const target of [
  "app-shell/src/workbench/center/composer/",
  "app-shell/src/workbench/settings/",
  "workspace/src/work/",
  "workspace/src/shared/logic/",
  "packages/llm/openai-compatible",
]) if (!map.includes(target)) fail(`项目结构地图缺少当前 Owner ${target}`);

for (const relative of [
  "apps/web/src/main.ts",
  "packages/client/web/src/App.tsx",
  "packages/client/connection/src/agent-runtime-client.ts",
  "packages/client/app-shell/src/workbench/settings/view/SettingsPage.tsx",
  "packages/client/workspace/src/work/logic/useWorkCanvasController.ts",
  "packages/bundle/web-app/src/vite.ts",
  "packages/llm/openai-compatible/src/index.ts",
  "native/secret-store/src/lib.rs",
]) if (!exists(relative)) fail(`缺少真实 Owner ${relative}`);

const ignoredLegacyShellSegments = new Set([
  "node_modules",
  "target",
  "dist",
  "coverage",
  ".cache",
  ".tmp",
]);

function legacyOwnerHasProjectContent(relative) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) return false;

  const pending = [absolute];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (ignoredLegacyShellSegments.has(entry.name)) continue;
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(next);
      else return true;
    }
  }

  return false;
}

for (const legacy of [
  ".lfaa",
  "apps/web/dev",
  "apps/web/src/host-clients",
  "apps/web/src/terminal",
  "crates/secret-store",
  "packages/agent-runtime",
  "packages/app-shell",
]) {
  if (legacyOwnerHasProjectContent(legacy)) fail(`旧物理 Owner 回流：${legacy}`);
}

const appManifest = JSON.parse(read("apps/web/package.json"));
const appDeps = Object.keys(appManifest.dependencies ?? {}).sort();
if (JSON.stringify(appDeps) !== JSON.stringify(["@lfaa/bundle-web-app", "@lfaa/client-web"])) {
  fail(`apps/web 依赖必须保持薄入口，当前为 ${appDeps.join(", ")}`);
}

console.log(`LFAA current fact check passed (v${version}).`);
