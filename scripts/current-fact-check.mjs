/**
 * 文件：current-fact-check.mjs
 * 作用：阻止当前事实文档与 Settings/UI Kit Owner 回退到已迁出的目录。
 * 负责：核对当前版本文档首节、真实 Owner 路径与 UI 公共出口。
 * 不负责：历史版本段落、TypeScript 编译、Vite 构建或用户验收。
 * 状态归属：无状态；只读取工作区文件。
 * 对外接口：node scripts/current-fact-check.mjs。
 * 关联文件：ARCHITECTURE.md、docs/MODULES.md、docs/RUNTIME.md、docs/UI.md、docs/项目结构与代码地图.md。
 * 修改注意事项：迁移 Owner 时同步更新当前事实首节和本检查，历史时间线不重写。
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const version = JSON.parse(fs.readFileSync(path.join(root, "lfaa.release.json"), "utf8")).displayVersion;
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const fail = (message) => { console.error(`LFAA current fact check failed: ${message}`); process.exit(1); };
const currentSection = (relative) => {
  const source = read(relative);
  const next = source.indexOf("\n## ", 1);
  return next < 0 ? source : source.slice(0, next);
};

const required = new Map([
  ["ARCHITECTURE.md", ["packages/workspace/src/work/logic/", "packages/workspace/src/shared/logic/", "packages/app-shell/src/workbench/settings/"]],
  ["docs/MODULES.md", ["packages/workspace/src/work/logic/", "packages/workspace/src/shared/logic/", "packages/app-shell/src/workbench/settings/"]],
  ["docs/RUNTIME.md", ["packages/workspace/src/work/logic/", "packages/workspace/src/shared/logic/", "pnpm run quality:full"]],
  ["docs/UI.md", ["packages/app-shell/src/workbench/settings/", "packages/ui/src/features/settings/ai/"]],
  ["docs/项目结构与代码地图.md", ["packages/app-shell/src/workbench/settings/view/", "packages/workspace/src/work/logic/"]],
]);
for (const [relative, paths] of required) {
  const section = currentSection(relative);
  if (!section.startsWith(`## v${version} `)) fail(`${relative} 的首节不是当前版本 v${version}`);
  for (const target of paths) if (!section.includes(target)) fail(`${relative} 首节缺少当前 Owner ${target}`);
  for (const legacy of ["workbench/session/", "workbench/center/conversation/", "packages/ui/src/features/settings/SettingsPage.tsx"]) {
    if (section.includes(legacy)) fail(`${relative} 首节仍引用旧 Owner ${legacy}`);
  }
}

if (!read("docs/README.md").includes(`当前候选版本：v${version}`)) fail("docs/README.md 当前候选版本不匹配");
for (const relative of [
  "packages/app-shell/src/workbench/settings/view/SettingsPage.tsx",
  "packages/app-shell/src/workbench/settings/view/PluginSettingsPanel.tsx",
  "packages/app-shell/src/workbench/shell/view/UserMenu.tsx",
  "packages/ui/src/features/settings/ai/AiSettingsPanel.tsx",
]) if (!fs.existsSync(path.join(root, relative))) fail(`缺少真实 Owner ${relative}`);
for (const relative of [
  "packages/ui/src/features/settings/SettingsPage.tsx",
  "packages/ui/src/features/settings/plugins/PluginSettingsPanel.tsx",
  "packages/ui/src/features/account/UserMenu.tsx",
]) if (fs.existsSync(path.join(root, relative))) fail(`旧 UI Kit Owner 回流 ${relative}`);

const uiEntry = read("packages/ui/src/index.ts");
if (/export\s+\{\s*(?:SettingsPage|UserMenu|PluginSettingsPanel)\s*\}/u.test(uiEntry)) fail("@lfaa/ui 重新导出产品页面");
console.log(`LFAA current fact check passed (v${version}).`);
