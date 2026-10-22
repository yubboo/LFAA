import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const workspace = read("../../../packages/client/ui-workspace/src/ApplicationWorkspace.tsx");
const rightMenuCss = read("../../../packages/client/ui-workspace/src/css/right-menu.css");
const right = workspace.match(/const right = \([\s\S]*?\n  const bottom/u)?.[0] ?? "";
const launcher = right.match(/<div className="module-context__launcher">[\s\S]*?<\/div>\s*<\/div>\s*<\/aside>/u)?.[0] ?? "";

test("右侧新标签页将常用工具、更多工具和推荐分为独立区域", () => {
  assert.ok(right, "右侧面板 JSX 应可定位");
  assert.match(launcher, /module-context__launcher-quick-tools/u);
  assert.match(launcher, /openWorkspaceUtility\("git"\)/u);
  assert.match(launcher, /terminalPanelAvailable && settings\.general\.showBottomPanelControl[\s\S]*?onClick=\{openTerminal\}/u);
  assert.match(launcher, /onNavigate\("\/files"\)/u);
  assert.match(launcher, /openWorkspaceUtility\("side-chat"\)/u);
  assert.match(launcher, /<details className="module-context__launcher-more">[\s\S]*?<summary>[\s\S]*?更多工具…[\s\S]*?<\/details>/u);
  assert.match(launcher, /openWorkspaceUtility\("browser"\)/u);
  assert.match(launcher, /openWorkspaceUtility\("applications"\)/u);
  assert.match(launcher, /openWorkspaceUtility\("extension", tab\.id\)/u);
  assert.match(launcher, /registeredExtensions\.filter\(item => !item\.applicationIds \|\| item\.applicationIds\.includes\(app\)\)\.map/u);
  assert.match(launcher, /module-context__launcher-recommendation[\s\S]*?推荐[\s\S]*?browserOpenTabs\.map/u);
  assert.match(launcher, /openBrowserWebsite\(tab\.url\)/u);
  assert.match(launcher, /module-context__launcher-recent[\s\S]*?最近/u);
  assert.ok(workspace.includes("visibleBrowserRecentSites.map(site =>"), "最近条目读取 Browser Owner 返回的账户记录");
  assert.ok(workspace.includes("browserSiteHost(site.url)"), "最近条目只展示站点主机名");
  assert.ok(workspace.includes("openBrowserWebsite(site.url)"), "点击最近条目复用现有浏览器导航");
  assert.match(workspace, /loadBrowserRecentSites\(12, controller\.signal\)/u, "最近网站按需加载并可在切换时取消过期请求");
  assert.match(workspace, /recordBrowserRecentSites\(changedUrls\.slice\(0, 64\)\)/u, "原生 Browser Dock 的实际标签地址回传 Browser Owner");
  assert.match(launcher, /onClick=\{\(\) => openWorkspaceUtility\("browser"\)\}/u);
  assert.match(launcher, /打开浏览器后，这里会显示当前已打开的网页/u);
  assert.doesNotMatch(launcher, /LFAA 工作台/u, "推荐区不得再显示固定的品牌卡");
  assert.match(launcher, /module-context__launcher-status/u);
});

test("右侧新标签页按区域容器宽度响应，并沿用主题令牌", () => {
  assert.match(rightMenuCss, /\.module-context__browser-toolbar \{[^}]*display: flex;[^}]*min-width: 0/u);
  assert.match(rightMenuCss, /@container module-context \(max-width: 340px\)[\s\S]*?\.module-context__browser-navigation button,[\s\S]*?\.module-context__browser-address button \{ width: 26px/u);
  assert.match(rightMenuCss, /\.module-context__launcher-grid,[\s\S]*?\.module-context__launcher-extra-grid \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/u);
  assert.match(rightMenuCss, /@container module-context \(max-width: 520px\)[\s\S]*?\.module-context__launcher-grid,[\s\S]*?\.module-context__launcher-extra-grid \{ grid-template-columns: minmax\(0, 1fr\); \}/u);
  assert.match(rightMenuCss, /\.module-context__launcher-more\[open\] \{ grid-column: 1 \/ -1; \}/u);
  assert.match(rightMenuCss, /\.module-context__launcher\s*\{[^}]*overflow: auto/u);
  assert.match(rightMenuCss, /\.module-context__launcher-grid button[\s\S]*?var\(--color-surface-muted\)/u);
  assert.match(rightMenuCss, /\.module-context__launcher-tabs[\s\S]*?repeat\(auto-fill/u);
  assert.match(rightMenuCss, /\.module-context__launcher-site:focus-visible[\s\S]*?var\(--settings-accent, var\(--color-brand\)\)/u);
  assert.match(rightMenuCss, /\.module-context__launcher-recent-site \{[^}]*grid-template-columns: 20px minmax\(0, 1fr\) auto/u);
  assert.match(rightMenuCss, /@container module-context \(max-width: 340px\)[\s\S]*?\.module-context__launcher-recent-site \{ grid-template-columns: 18px minmax\(0, 1fr\); \}/u);
  assert.doesNotMatch(rightMenuCss, /--color-accent/u, "推荐区沿用实际存在的主题强调色令牌");
  assert.doesNotMatch(rightMenuCss, /display:\s*inline-block/u);
});

test("新标签页地址栏与推荐、最近共用 Browser Dock 页面导航", () => {
  const toolbar = right.match(/activeWorkspaceUtilityTabKind === "new" \? <div className="module-context__browser-toolbar-wrap">[\s\S]*?<div className="module-context__launcher">/u)?.[0] ?? "";
  assert.ok(toolbar, "浏览器导航栏应位于新标签页内容之前");
  assert.match(toolbar, /aria-label="后退"[\s\S]*?openBrowserDockAction\("back"\)/u);
  assert.match(toolbar, /aria-label="前进"[\s\S]*?openBrowserDockAction\("forward"\)/u);
  assert.match(toolbar, /aria-label="刷新网页"[\s\S]*?openBrowserDockAction\("reload"\)/u);
  assert.match(toolbar, /onSubmit=\{submitBrowserAddress\}[\s\S]*?aria-label="搜索或输入网址"/u);
  assert.match(workspace, /resolveBrowserAddress\(browserAddress, settings\.browserUse\.searchEngine\)[\s\S]*?openBrowserWebsite\(url\)/u, "地址栏读取当前搜索引擎设置并复用推荐/最近的 Browser Dock 导航入口");
  assert.match(workspace, /browserActionRequest\?: \{ id: string; action: "back" \| "forward" \| "reload" \}/u);
  assert.match(workspace, /actionRequest=\{activeWorkspaceUtilityTab\?\.browserActionRequest[\s\S]*?onActionRequestHandled=\{handleBrowserActionRequest\}/u);
  const browser = read("../../../packages/client/ui-sidebar-browser/src/BrowserPanel.tsx");
  const nativeBrowser = read("../../../packages/client/ui-sidebar-browser/src/NativeBrowserPanel.tsx");
  assert.match(browser, /actOnBrowser\(sessionId, providerId, \{ action: actionRequest\.action \}\)/u);
  assert.match(nativeBrowser, /actionRequest\.action === "back"[\s\S]*?api\.forward\(activeTab\.id\)[\s\S]*?api\.reload\(activeTab\.id\)/u);
});

test("推荐区显示 Browser Dock 当前打开标签，并复用一次性导航请求", () => {
  assert.match(workspace, /browserNavigationRequest\?: \{ id: string; url: string \}/u);
  assert.match(workspace, /navigationRequest=\{activeWorkspaceUtilityTab\?\.browserNavigationRequest/u);
  assert.match(workspace, /onNavigationRequestHandled=\{handleBrowserNavigationRequest\}/u);
  assert.match(workspace, /onOpenTabsChange=\{handleBrowserOpenTabsChange\}/u);
  assert.match(workspace, /useEffect\(\(\) => \{ setBrowserOpenTabs\(\[\]\); \}, \[activeAiSessionId, mode, userId\]\)/u);
  const browser = read("../../../packages/client/ui-sidebar-browser/src/BrowserPanel.tsx");
  const nativeBrowser = read("../../../packages/client/ui-sidebar-browser/src/NativeBrowserPanel.tsx");
  assert.match(browser, /onOpenTabsChange\?\.\(snapshot\?\.tabs \?\? \[\]\)/u);
  assert.match(nativeBrowser, /onOpenTabsChange\?\.\(state\.tabs\.map\(tab => \(\{ id: tab\.id, title: tab\.title, url: tab\.url, active: tab\.active \}\)\)\)/u);
  assert.match(browser, /navigationRequest[\s\S]*?navigateBrowser\(sessionId, providerId, target\)/u);
  assert.match(nativeBrowser, /navigationRequest[\s\S]*?api\.navigate\(activeTab\.id, target\)/u);
  assert.doesNotMatch(workspace, /recommendedSites|管理网站/u);
  const settingsPage = read("../../../packages/client/ui-settings/src/SettingsPage.tsx");
  assert.match(settingsPage, /settings\.browserUse\.recordRecentSites/u);
  assert.match(settingsPage, /clearBrowserRecentSites\(\)/u);
  const browserController = read("../../../packages/api/browser-controller/src/index.ts");
  assert.match(browserController, /router\.get\("\/browser\/recent-sites", \.\.\.auth/u, "读取最近网站走现有认证链");
  assert.match(browserController, /router\.post\("\/browser\/recent-sites", \.\.\.auth, actionLimit/u, "记录最近网站经认证并受写入速率限制");
  assert.match(browserController, /router\.delete\("\/browser\/recent-sites", \.\.\.auth/u, "清除最近网站仅作用于当前认证账户");
  const migration = read("../../../packages/storage/storage-domain/src/migration.ts");
  assert.match(migration, /migrateWorkspaceLocalDefaultSchema\(\);\s*migrateBrowserRecentSitesSchema\(\)/u, "新表只能在旧文件迁移协调和版本 60 完成后创建");
  const sqlite = read("../../../packages/storage/storage-sqlite/src/database.ts");
  assert.match(sqlite, /if \(version < 60 \|\| version >= 61\) return/u, "数据库版本 30 不能被跳过直接标成版本 61");
});
