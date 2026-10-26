/**
 * 功能：锁定联机服务与运行环境在四栏中间容器内的响应式行为。
 * 作用：避免只看全局窗口断点，导致中栏变窄时卡片和分类入口挤成竖排。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("联机服务按自己的中栏容器宽度重排状态卡和表单", () => {
  const css = read("../../../packages/client/ui-connectivity/src/connectivity.css");
  const ownerReadme = read("../../../packages/client/ui-connectivity/README.md");

  assert.match(css, /\.connectivity-workspace\s*\{[^}]*box-sizing:\s*border-box;[^}]*container-type:\s*inline-size;[^}]*container-name:\s*connectivity-workspace;/u);
  assert.match(css, /@container connectivity-workspace \(max-width:\s*720px\)[\s\S]*?\.connectivity-status-grid\s*\{\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/u);
  assert.match(css, /@container connectivity-workspace \(max-width:\s*600px\)[\s\S]*?\.connectivity-form-grid\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/u);
  assert.match(css, /@container connectivity-workspace \(max-width:\s*460px\)[\s\S]*?\.connectivity-status-grid\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/u);
  assert.match(css, /\.connectivity-status-card\s*\{[^}]*min-width:\s*0/u);
  assert.match(css, /\.connectivity-route-target code, \.connectivity-route-address code\s*\{[^}]*min-width:\s*0;[^}]*overflow-wrap:\s*anywhere/u);
  assert.doesNotMatch(css, /@media\s*\(max-width:/u, "中心区布局不应依赖整个浏览器视口宽度");
  assert.match(ownerReadme, /中心内容以自身容器宽度响应/u);
});

test("运行环境分类与内容卡按游戏库和分类面板的实际宽度换行", () => {
  const css = read("../../../packages/client/ui-layout/src/GameLibraryPage.css");
  const ownerReadme = read("../../../packages/client/ui-layout/README.md");

  assert.match(css, /\.game-library\s*\{[^}]*box-sizing:\s*border-box;[^}]*padding:\s*clamp\(\.75rem,\s*3cqi,\s*2\.5rem\);[^}]*container-type:\s*inline-size;[^}]*container-name:\s*game-library;/u);
  assert.match(css, /\.runtime-manager\s*\{[^}]*container-type:\s*inline-size;[^}]*container-name:\s*runtime-manager;/u);
  assert.match(css, /\.runtime-manager__tabs\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*10rem\),\s*1fr\)\)/u);
  assert.match(css, /\.runtime-manager__tabs button\s*\{[^}]*min-width:\s*0;[^}]*white-space:\s*normal;[^}]*overflow-wrap:\s*anywhere/u);
  assert.match(css, /@container game-library \(max-width:\s*39rem\)[\s\S]*?\.game-library__environment-controls > \.ant-btn\s*\{\s*width:\s*100%;\s*white-space:\s*normal;/u);
  assert.match(css, /@container game-library \(max-width:\s*39rem\)[\s\S]*?\.game-library__environment-controls:not\(\.game-library__environment-controls--toolbar\) label\s*\{\s*flex-basis:\s*auto;/u, "窄栏切成纵向表单后标签应按控件内容高度排列");
  assert.match(css, /@container runtime-manager \(max-width:\s*42rem\)[\s\S]*?\.runtime-manager__cards\s*\{\s*grid-template-columns:\s*minmax\(0,1fr\)/u);
  assert.match(css, /@container runtime-manager \(max-width:\s*24rem\)[\s\S]*?\.runtime-manager__tabs\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/u);
  assert.match(ownerReadme, /真实中心容器宽度重排卡片、分类入口及操作控件/u);
});

test("运行环境顶部控制区紧凑对齐，窄容器使用可访问图标按钮", () => {
  const css = read("../../../packages/client/ui-layout/src/GameLibraryPage.css");
  const page = read("../../../packages/client/ui-layout/src/GameLibraryPage.tsx");
  const panel = read("../../../packages/client/ui-layout/src/RuntimeEnvironmentPanel.tsx");
  const ownerReadme = read("../../../packages/client/ui-layout/README.md");

  assert.match(css, /\.game-library--environments \.game-library__header\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto;[^}]*margin-bottom:\s*\.75rem/u);
  assert.match(css, /\.game-library__environment-controls--toolbar\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(14rem,\s*1fr\)\s+auto\s+auto;[^}]*margin:\s*\.75rem\s+0\s+1rem/u);
  assert.match(css, /@container game-library \(max-width:\s*39rem\)[\s\S]*?\.game-library__environment-controls--toolbar\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+repeat\(2,\s*2\.75rem\)/u);
  assert.match(css, /\.game-library--environments \.game-library__environment-controls--toolbar > \.game-library__environment-action\s*\{[^}]*width:\s*2\.75rem;[^}]*height:\s*2\.75rem/u);
  assert.match(css, /\.game-library__environment-controls--toolbar \.game-library__action-label\s*\{\s*display:\s*none;/u);
  assert.match(page, /aria-label="返回游戏库" title="返回游戏库" icon=\{<WorkbenchIcon[^>]*name="arrowRight"/u);
  assert.match(panel, /aria-label="运行环境执行设备"/u);
  assert.match(panel, /aria-label="重新检测环境" title="重新检测环境" icon=\{<WorkbenchIcon name="refresh"/u);
  assert.match(panel, /aria-label="项目与存储设置" title="项目与存储设置" icon=\{<WorkbenchIcon name="settings"/u);
  assert.match(ownerReadme, /窄中栏将返回、重检和存储操作收为有可访问名称的图标按钮/u);
});

test("SteamCMD 未验证提示链接按告警卡片宽度换行", () => {
  const css = read("../../../packages/client/ui-layout/src/SteamcmdWorkspace.css");
  const page = read("../../../packages/client/ui-layout/src/SteamcmdWorkspace.tsx");
  const ownerReadme = read("../../../packages/client/ui-layout/README.md");

  assert.match(page, /className="steamcmd-workspace__alert" type="warning"[\s\S]*?description=\{<Button type="link"/u);
  assert.match(css, /\.steamcmd-workspace__alert \.ant-alert-description\s*\{[^}]*min-width:\s*0;[^}]*overflow-wrap:\s*anywhere;/u);
  assert.match(css, /\.steamcmd-workspace__alert \.ant-alert-description \.ant-btn-link\s*\{[^}]*max-width:\s*100%;[^}]*height:\s*auto;[^}]*white-space:\s*normal;[^}]*overflow-wrap:\s*anywhere;[^}]*text-align:\s*start;/u);
  assert.match(ownerReadme, /SteamCMD 未验证提示卡片中的操作链接受提示卡可用宽度约束并允许折行/u);
});

test("SteamCMD 窄栏目标设备与刷新状态占同一行", () => {
  const css = read("../../../packages/client/ui-layout/src/SteamcmdWorkspace.css");
  const narrowRules = css.match(/@container \(max-width: 38rem\) \{([\s\S]*?)\n\}/u)?.[1] ?? "";
  const ownerReadme = read("../../../packages/client/ui-layout/README.md");

  assert.match(narrowRules, /\.steamcmd-workspace__node-picker\s*\{[^}]*width:\s*100%;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto;/u);
  assert.match(narrowRules, /\.steamcmd-workspace__node-picker label\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/u);
  assert.doesNotMatch(narrowRules, /\.steamcmd-workspace__node-picker\s*>\s*\.ant-btn\s*\{[^}]*width:\s*100%;/u);
  assert.match(ownerReadme, /窄栏下目标设备选择器与刷新状态按钮在同一行/u);
});
