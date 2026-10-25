import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const workspace = read("../../../packages/client/ui-workspace/src/ApplicationWorkspace.tsx");
const rightMenuCss = read("../../../packages/client/ui-workspace/src/css/right-menu.css");
const right = workspace.match(/const right = \([\s\S]*?\n  const bottom/u)?.[0] ?? "";
const launcher = right.match(/<div className="module-context__launcher">[\s\S]*?<\/section>\s*<\/div>\s*<\/>\s*:\s*null\}/u)?.[0] ?? "";

test("右侧新标签页将常用工具、更多工具和推荐分为独立区域", () => {
  assert.ok(right, "右侧面板 JSX 应可定位");
  assert.match(launcher, /module-context__launcher-quick-tools/u);
  assert.match(launcher, /openWorkspaceUtility\("git"\)/u);
  assert.match(launcher, /terminalPanelAvailable && settings\.general\.showBottomPanelControl[\s\S]*?onClick=\{openTerminal\}/u);
  assert.match(launcher, /onNavigate\("\/files"\)/u);
  assert.match(launcher, /openWorkspaceUtility\("side-chat"\)/u);
  assert.match(launcher, /<details className="module-context__launcher-more">[\s\S]*?<summary>[\s\S]*?更多工具…[\s\S]*?<\/details>/u);
  assert.doesNotMatch(launcher, /openWorkspaceUtility\("browser"\)/u, "浏览器本身不再作为另一个工具标签打开");
  assert.match(launcher, /openWorkspaceUtility\("applications"\)/u);
  assert.match(launcher, /openWorkspaceUtility\("extension", tab\.id\)/u);
  assert.match(launcher, /registeredExtensions\.filter\(item => !item\.applicationIds \|\| item\.applicationIds\.includes\(app\)\)\.map/u);
  assert.match(launcher, /module-context__launcher-recommendation[\s\S]*?推荐[\s\S]*?browserOpenTabs\.map/u);
  assert.match(launcher, /module-context__launcher-name[\s\S]*?新标签页[\s\S]*?选择工具/u);
  assert.match(launcher, /openBrowserWebsite\(tab\.url\)/u);
  assert.match(launcher, /module-context__launcher-recent[\s\S]*?最近/u);
  assert.ok(workspace.includes("visibleBrowserRecentSites.map(site =>"), "最近条目读取 Browser Owner 返回的账户记录");
  assert.ok(workspace.includes("browserSiteHost(site.url)"), "最近条目只展示站点主机名");
  assert.ok(workspace.includes("openBrowserWebsite(site.url)"), "点击最近条目复用现有浏览器导航");
  assert.match(workspace, /loadBrowserRecentSites\(12, controller\.signal\)/u, "最近网站按需加载并可在切换时取消过期请求");
  assert.match(workspace, /recordBrowserRecentSites\(changedUrls\.slice\(0, 64\)\)/u, "原生 Browser Dock 的实际标签地址回传 Browser Owner");
  assert.match(launcher, /browserAddressInputRef\.current\?\.focus\(\)/u, "推荐空态直接聚焦同一浏览器地址栏");
  assert.match(launcher, /打开的网页会显示在这里/u);
  assert.doesNotMatch(launcher, /LFAA 工作台/u, "推荐区不得再显示固定的品牌卡");
  assert.deepEqual([...launcher.matchAll(/<section className="(module-context__launcher-(?:name|section|recommendation|recent))"/gu)].map(match => match[1]), [
    "module-context__launcher-name",
    "module-context__launcher-section",
    "module-context__launcher-recommendation",
    "module-context__launcher-recent",
  ], "主体直接包含名称、工具、推荐、最近四个同级盒子");
  assert.doesNotMatch(launcher, /module-context__launcher-status/u, "状态显示放在名称盒子，主体不增加第五个区域");
  const accountIndex = right.indexOf('<div className="module-context__account">');
  const bodyIndex = right.indexOf('className="module-context__body"');
  assert.ok(accountIndex > bodyIndex && /<\/div>\s*$/.test(right.slice(0, accountIndex)), "账户状态盒子位于主体滚动容器之外并固定在底部");
});

test("右侧新标签页按区域容器宽度响应，并沿用主题令牌", () => {
  assert.match(rightMenuCss, /\.module-context__browser-controls \{[^}]*flex-direction: column/u);
  assert.match(rightMenuCss, /\.module-context__launcher-name,[\s\S]*?\.module-context__launcher-recent \{[^}]*border: 1px solid var\(--color-border-subtle\)/u);
  assert.match(rightMenuCss, /\.module-context__account \{[^}]*flex: 0 0 auto/u);
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

test("同一个新标签页内用地址栏替换主页内容，不新增第二套浏览器壳", () => {
  const controlsStart = right.indexOf('className="module-context__browser-controls"');
  const bodyStart = right.indexOf('className="module-context__body"', controlsStart);
  const toolbar = controlsStart >= 0 && bodyStart > controlsStart ? right.slice(controlsStart, bodyStart) : "";
  assert.ok(toolbar.includes('className="module-context__shell-actions"') && toolbar.includes('className="module-context__browser-toolbar-wrap"'), "工作区标签与浏览器地址栏组合为主体上方的固定顶栏");
  assert.match(toolbar, /aria-label="后退"[\s\S]*?openBrowserDockAction\("back"\)/u);
  assert.match(toolbar, /aria-label="前进"[\s\S]*?openBrowserDockAction\("forward"\)/u);
  assert.match(toolbar, /aria-label="刷新网页"[\s\S]*?openBrowserDockAction\("reload"\)/u);
  assert.match(toolbar, /onSubmit=\{submitBrowserAddress\}[\s\S]*?aria-label="搜索或输入网址"/u);
  assert.match(workspace, /resolveBrowserAddress\(browserAddress, settings\.browserUse\.searchEngine\)[\s\S]*?openBrowserWebsite\(url\)/u, "地址栏读取当前搜索引擎设置并复用推荐/最近的 Browser Dock 导航入口");
  assert.match(workspace, /kind: "new", browserUrl: url, browserNavigationRequest: request/u, "输入网址保留同一个新标签页并直接切换其内容");
  assert.match(workspace, /activeWorkspaceUtilityTabKind === "new" \? <Suspense[\s\S]*?<BrowserPanel[^>]*hidden=\{!activeWorkspaceUtilityTab\?\.browserUrl\}/u, "同一新标签页始终承载 Browser Owner，只有网页区按当前地址显示");
  assert.match(workspace, /!activeWorkspaceUtilityTab\?\.browserUrl \? <>[\s\S]*?module-context__launcher/u, "只有当前页面没有网址时才显示新标签主页");
  assert.doesNotMatch(workspace, /kind: "browser"|aiWorkView === "browser"|openWorkspaceUtility\("browser"\)/u, "不再创建第二个浏览器工作区标签");
  assert.match(workspace, /browserActionRequest\?: \{ id: string; action: "back" \| "forward" \| "reload" \}/u);
  assert.match(workspace, /actionRequest=\{activeWorkspaceUtilityTab\?\.browserActionRequest[\s\S]*?onActionRequestHandled=\{handleBrowserActionRequest\}/u);
  const browser = read("../../../packages/client/ui-sidebar-browser/src/BrowserPanel.tsx");
  const nativeBrowser = read("../../../packages/client/ui-sidebar-browser/src/NativeBrowserPanel.tsx");
  assert.match(browser, /actOnBrowserDock\(sessionId, providerId, \{ action: actionRequest\.action \}\)/u);
  assert.match(browser, /navigateBrowserDock\(sessionId, providerId, target\)/u);
  assert.match(browser, /existing\?\.scope === scope\) return existing\.promise/u, "同一账户会话和 Provider 合并并发状态读取");
  assert.match(browser, /const scope = `\$\{sourceSession\}:\$\{selectedProvider\}`/u, "不同账户会话或浏览器 Provider 不会错误复用旧快照");
  assert.match(browser, /waitForBrowserDockRevision\(sessionId, providerId, current\?\.revision \?\? 0/u, "页面变化通过可撤销的 Browser Owner 修订等待同步，空状态从零开始等待");
  assert.match(browser, /setSnapshot\(current => preferCurrentBrowserSnapshot\(current, next\)\)/u, "Browser Dock 使用 Session 感知快照接纳规则，Owner 重建后的 Session 可以替换旧页面状态");
  assert.match(browser, /Web 使用认证实时帧流，Electron 使用原生 WebContentsView/u, "共享面板明确区分 Web 实时帧流与 Electron 原生网页视图");
  assert.match(browser, /streamBrowserDockFrames\([\s\S]*?<canvas/u, "Web Dock 用同一 Browser Owner 页面帧绘制实时网页");
  assert.match(browser, /const onViewportWheel = useCallback\(\(event: WheelEvent<HTMLDivElement>\) => \{[\s\S]*?event\.preventDefault\(\);[\s\S]*?event\.stopPropagation\(\);/u, "Web Dock 拦截网页区域滚轮，不让事件滚到外层工作区");
  assert.match(browser, /const flushWheel = useCallback\([\s\S]*?actOnBrowserDock\(sessionId, providerId, \{ action: "scroll"/u, "Web Dock 把网页滚动动作发送给 Browser Owner");
  assert.match(browser, /onWheel=\{onViewportWheel\}/u);
  assert.doesNotMatch(browser, /<img\b/u, "Web Dock 不使用静态图片播放器替代实时帧画面");
  assert.doesNotMatch(browser, /接入浏览器|providerConnected|connectProvider\(/u, "LFAA Browser Dock 的手动导航不再出现 Provider 接入门槛");
  assert.doesNotMatch(browser, /lfaa-browser-panel__(?:header|provider-tabs|address|views|footer)/u, "内容区组件不再包含第二套浏览器标题、标签或地址栏");
  assert.match(nativeBrowser, /actionRequest\.action === "back"[\s\S]*?api\.forward\(activeTab\.id\)[\s\S]*?api\.reload\(activeTab\.id\)/u);
  assert.match(nativeBrowser, /window\.requestAnimationFrame\(\(\) => \{\s*frame = 0;\s*readBounds\(\);/u, "原生网页位置更新合并到动画帧，避免逐条处理滚动事件");
  assert.match(nativeBrowser, /if \(!live \|\| hidden \|\| sending \|\| !pending\) return/u, "原生网页视图最多只有一个坐标 IPC 在途");
  assert.match(nativeBrowser, /if \(live && pending\) sendPending\(\)/u, "滚动中的新位置只保留最新一份并在当前 IPC 后发送");
  assert.doesNotMatch(nativeBrowser, /watchPosition|setTimeout\(watchPosition, 160\)/u, "不再用 160ms 轮询拖动原生网页视图");
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
  assert.match(browser, /navigationRequest[\s\S]*?navigateBrowserDock\(sessionId, providerId, target\)/u);
  assert.match(nativeBrowser, /navigationRequest[\s\S]*?api\.navigate\(activeTab\.id, target\)/u);
  assert.doesNotMatch(workspace, /recommendedSites|管理网站/u);
  const settingsPage = read("../../../packages/client/ui-settings/src/SettingsPage.tsx");
  assert.match(settingsPage, /settings\.browserUse\.recordRecentSites/u);
  assert.match(settingsPage, /clearBrowserRecentSites\(\)/u);
  assert.match(settingsPage, /const builtIn = provider\.isolation !== "user-profile"/u, "built-in browsers are not represented by a connect/disconnect switch");
  assert.match(settingsPage, /\{builtIn \? <Tag>/u, "settings displays built-in availability without a user connection action");
  const browserController = read("../../../packages/api/browser-controller/src/index.ts");
  assert.match(browserController, /router\.post\("\/browser\/dock\/sessions\/:sourceSessionId\/navigate"[\s\S]*?manager\.navigate/u, "手动地址栏走独立的认证 Browser Dock 路由");
  assert.match(browserController, /router\.post\("\/browser\/sessions\/:sourceSessionId\/navigate"[\s\S]*?assertProviderLinked/u, "Agent 导航仍受 Agent 浏览器总开关限制");
  assert.match(browserController, /if \(!settings\.browserUse\.enabled\).*?browser_use_disabled/u, "Agent 仍受 Browser Use 总开关控制");
  assert.match(browserController, /router\.get\("\/browser\/recent-sites", \.\.\.auth/u, "读取最近网站走现有认证链");
  assert.match(browserController, /router\.post\("\/browser\/recent-sites", \.\.\.auth, actionLimit/u, "记录最近网站经认证并受写入速率限制");
  assert.match(browserController, /router\.delete\("\/browser\/recent-sites", \.\.\.auth/u, "清除最近网站仅作用于当前认证账户");
  const migration = read("../../../packages/storage/storage-domain/src/migration.ts");
  assert.match(migration, /migrateWorkspaceLocalDefaultSchema\(\);\s*migrateBrowserRecentSitesSchema\(\)/u, "新表只能在旧文件迁移协调和版本 60 完成后创建");
  const sqlite = read("../../../packages/storage/storage-sqlite/src/database.ts");
  assert.match(sqlite, /if \(version < 60 \|\| version >= 61\) return/u, "数据库版本 30 不能被跳过直接标成版本 61");
});

test("右侧能力资源长列表跳过离屏绘制并按外观字号保留滚动尺寸", () => {
  assert.match(rightMenuCss, /\.module-context__resource-list > div \{[^}]*content-visibility: auto;[^}]*contain-intrinsic-block-size: auto calc\(var\(--font-size-xs\) \+ var\(--font-size-xs\) \+ 15px\)/u);
});
