import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const { buildPluginRemoveGoal, buildPluginInstallGoal } = await import('lfaa-client-ui-plugin-manager/src/plugin-goals.ts');
const { hasWallpaperEnginePlugin } = await import('lfaa-client-ui-plugin-manager/src/plugin-visibility.ts');
const { detectPluginSourceInput } = await import('lfaa-client-ui-plugin-manager/src/plugin-source-input.ts');
const pluginPage = readFileSync(fileURLToPath(new URL('../../../packages/client/ui-plugin-manager/src/PluginManagerPage.tsx', import.meta.url)), 'utf8');
const pluginPageCss = readFileSync(fileURLToPath(new URL('../../../packages/client/ui-plugin-manager/src/PluginManagerPage.css', import.meta.url)), 'utf8');
const settingsPage = readFileSync(fileURLToPath(new URL('../../../packages/client/ui-settings/src/SettingsPage.tsx', import.meta.url)), 'utf8');
const settingsMenuCatalog = readFileSync(fileURLToPath(new URL('../../../packages/util/values/src/settings-menu-catalog.ts', import.meta.url)), 'utf8');
const managedPluginsSettings = readFileSync(fileURLToPath(new URL('../../../packages/client/ui-settings/src/ManagedPluginsSettings.tsx', import.meta.url)), 'utf8');
const githubConnectionSettings = readFileSync(fileURLToPath(new URL('../../../packages/client/ui-settings/src/GitHubConnectionSettings.tsx', import.meta.url)), 'utf8');
const connectionApi = readFileSync(fileURLToPath(new URL('../../../packages/client/connection/src/api.ts', import.meta.url)), 'utf8');
const mcpConnectionsSettings = readFileSync(fileURLToPath(new URL('../../../packages/client/ui-settings/src/McpConnectionsSettings.tsx', import.meta.url)), 'utf8');
const workbenchPage = readFileSync(fileURLToPath(new URL('../../../packages/client/ui-layout/src/Workbench.tsx', import.meta.url)), 'utf8');
const settingsCss = readFileSync(fileURLToPath(new URL('../../../packages/client/ui-settings/src/SettingsPage.css', import.meta.url)), 'utf8');
const sidebarNavigation = readFileSync(fileURLToPath(new URL('../../../packages/client/ui-sidebar/src/SecondaryNavigation.tsx', import.meta.url)), 'utf8');
const sidebarNavigationCss = readFileSync(fileURLToPath(new URL('../../../packages/client/ui-sidebar/src/SecondaryNavigation.css', import.meta.url)), 'utf8');

test('wallpaper settings section follows the installed Profile plugin identity', () => {
  assert.equal(hasWallpaperEnginePlugin([]), false);
  assert.equal(hasWallpaperEnginePlugin([
    { id: 'elysia395-dsh-wallpaper-engine', name: 'dsh-plugin-wallpaper-engine', compatibility: 'dsh-v1' }
  ]), true);
  assert.equal(hasWallpaperEnginePlugin([
    { id: 'npm-dsh-plugin-wallpaper-engine', name: 'dsh-plugin-wallpaper-engine', compatibility: 'dsh-v1' }
  ]), true);
  assert.equal(hasWallpaperEnginePlugin([
    { id: 'acme-wallpaper', name: 'dsh-plugin-wallpaper-engine', compatibility: 'dsh-v1' },
    { id: 'elysia395-dsh-wallpaper-engine', name: 'another-plugin', compatibility: 'dsh-v1' },
    { id: 'elysia395-dsh-wallpaper-engine', name: 'dsh-plugin-wallpaper-engine', compatibility: 'lfaa-v1' }
  ]), false);
});

test('plugin source input automatically detects npm, GitHub HTTPS and Host absolute paths', () => {
  assert.equal(detectPluginSourceInput('dsh-plugin-whale-pet'), 'npm');
  assert.equal(detectPluginSourceInput('@author/plugin-name@1.2.3'), 'npm');
  assert.equal(detectPluginSourceInput('https://github.com/owner/repository'), 'github');
  assert.equal(detectPluginSourceInput('H:\\LFAA Host\\plugins\\sample'), 'local');
  assert.equal(detectPluginSourceInput('\\\\server\\share\\plugin'), 'local');
  assert.equal(detectPluginSourceInput('https://example.com/package'), null);
});

test('plugin install goals preserve each source and its explicit target app', () => {
  const github = buildPluginInstallGoal('github', 'https://github.com/acme/widget', 'main');
  const npm = buildPluginInstallGoal('npm', '@acme/widget@1.2.3');
  const local = buildPluginInstallGoal('local', 'H:\\LFAA Host\\plugins\\widget');

  assert.match(github, /GitHub 仓库/u);
  assert.match(github, /"main"/u);
  assert.match(npm, /NPM 包\/版本/u);
  assert.match(npm, /@acme\/widget@1\.2\.3/u);
  assert.match(local, /Host 绝对路径/u);
  assert.match(local, /H:\\\\LFAA Host\\\\plugins\\\\widget/u);
  for (const goal of [github, npm, local]) {
    assert.match(goal, /目标 App 为 workspace/u);
    assert.match(goal, /Permission Owner/u);
  }
});

test('manual install, start, stop and uninstall call the authenticated lifecycle API', () => {
  const plugin = {
    id: 'dsh-plugin-wallpaper-engine',
    name: 'Wallpaper Engine',
    version: '1.0.0',
    description: '',
    source: { kind: 'github', repository: 'https://github.com/acme/wallpaper', requestedRef: 'main', commit: 'a'.repeat(40), archiveSha256: 'b'.repeat(64), license: 'MIT' },
    compatibility: 'dsh-v1',
    runtimeEntry: 'src/index.js',
    capabilities: [],
    applicationIds: ['workspace'],
    state: 'installed',
    reason: null,
    installedAt: '2026-10-16T00:00:00.000Z',
    installedBy: 'admin'
  };

  const remove = buildPluginRemoveGoal(plugin, 'workspace');

  assert.match(pluginPage, /setManagedPluginEnabled\(plugin\.id/u);
  assert.match(pluginPage, /await removeManagedPlugin\(plugin\.id/u);
  assert.match(pluginPage, /await installManagedPlugin\(/u);
  assert.match(pluginPage, /centered/u);
  assert.match(pluginPage, /aria-haspopup="dialog"/u);
  assert.match(pluginPage, /中国大陆镜像源/u);
  assert.match(pluginPage, /NPM 官方源/u);
  assert.match(pluginPage, /自定义地址/u);
  assert.match(pluginPage, /填入插件 npm 包名/u);
  assert.match(pluginPage, /dsh-plugin-whale-pet/u);
  assert.match(pluginPage, /请只安装你信任的插件来源/u);
  assert.match(pluginPage, /声明脚本（不会执行）/u);
  assert.match(pluginPage, /保存后仍会隔离，插件代码不会运行/u);
  assert.match(pluginPage, /"保存隔离副本"/u);
  assert.match(pluginPage, /立即启用/u);
  assert.doesNotMatch(pluginPage, /插件安装来源类型/u);
  assert.match(pluginPageCss, /plugin-manager-install-modal[\s\S]*?max-height: calc\(100dvh - 16px\)/u);
  assert.doesNotMatch(pluginPage, /requestAiWorkGoal/u);
  assert.doesNotMatch(pluginPage, /buildPluginActionGoal/u);
  assert.match(remove, /卸载/u);
  assert.match(remove, /dsh-plugin-wallpaper-engine/u);
  assert.match(remove, /目标 App：workspace/u);
  assert.match(remove, /不要安装、更新或移除其他插件/u);
  assert.throws(() => buildPluginRemoveGoal(plugin, 'minecraft'), /没有登记到所选目标 App/u);
  assert.match(pluginPage, /domId: .*plugin-manager-\$\{id\}-tab/u);
  assert.match(pluginPage, /id: "wallpaper", label: "壁纸引擎"/u);
  assert.match(pluginPage, /wallpaperEngineInstalled \? <div id="plugin-manager-wallpaper-panel"/u);
});

test('plugin manager uses the shared three-column navigation and keeps existing settings owners', () => {
  const workspaceTabs = ['全部', '插件', '应用', '工具', '技能', '提示词', 'MCP 连接', '我的知识库', '运行诊断', '领域专家'];
  for (const label of workspaceTabs) assert.ok(pluginPage.includes(`label: "${label}"`), `missing plugin workspace tab: ${label}`);
  assert.match(pluginPage, /useState<PluginManagerWorkspaceTab>\(initialPluginManagerWorkspaceTab\)/u);
  assert.match(pluginPage, /function initialPluginManagerWorkspaceTab\(\)[\s\S]*?view === "applications" \|\| view === "mcp" \|\| view === "skills"/u);
  assert.match(pluginPage, /standalonePluginView=\{workspaceTab\}/u);
  assert.match(pluginPage, /domId: .*plugin-manager-\$\{id\}-tab/u);
  assert.match(pluginPage, /<GlobalNavigationRail/u);
  assert.match(pluginPage, /<ResizableWorkbench/u);
  assert.match(pluginPage, /<SecondaryNavigation ariaLabel="插件工作区分类" groups=\{navigationGroups\} activateOnArrow/u);
  assert.match(pluginPage, /leftWidth=\{leftWidth\}[\s\S]*?leftCollapsed=\{leftCollapsed\}/u);
  assert.match(pluginPage, /setWorkspaceTab\(id\)/u);
  assert.match(pluginPage, /visiblePluginTabs\.map\(entry/u);
  assert.doesNotMatch(pluginPage, /plugin-manager-page__tabs|role="tablist"/u);
  assert.doesNotMatch(pluginPage, /role="tabpanel"/u);
  assert.doesNotMatch(pluginPage, /extensions-header|standalonePluginWorkspaceHeaderTarget|plugin-manager-extensions-tab|plugin-manager-profile-tab/u);
  assert.match(pluginPage, /wallpaperEngineInstalled \? <div id="plugin-manager-wallpaper-panel"/u);
  assert.match(sidebarNavigation, /export function SecondaryNavigation/u);
  assert.match(sidebarNavigation, /aria-current=\{item\.active \? "page"/u);
  assert.match(sidebarNavigationCss, /\.secondary-navigation\s*\{[^}]*overflow-y:\s*auto/su);
  assert.match(settingsPage, /<SecondaryNavigation/u);
  assert.match(settingsPage, /role=\{standaloneWorkspaceContent \? "region" : "tabpanel"\}/u);

  assert.match(settingsPage, /className=\{`settings-content settings-content--plugin-workspace\$\{standaloneWorkspaceContent \? " settings-content--plugin-workspace-standalone" : ""\}`\}/u);
  assert.doesNotMatch(settingsPage, /createPortal|standalonePluginWorkspaceHeaderTarget/u);
  assert.match(settingsPage, /standaloneWorkspaceContent \? null : pluginWorkspaceHeader/u);
  assert.match(settingsPage, /case "applications": return \{ tab: "overview", kind: "all" \}/u);
  assert.match(settingsPage, /case "tools": return \{ tab: "catalog", kind: "tool" \}/u);
  assert.match(settingsPage, /case "skills": return \{ tab: "catalog", kind: "skill" \}/u);
  assert.match(settingsPage, /case "prompts": return \{ tab: "catalog", kind: "prompt" \}/u);
  assert.match(settingsPage, /case "mcp": return \{ tab: "mcp", kind: "all" \}/u);
  assert.match(settingsPage, /case "knowledge": return \{ tab: "knowledge", kind: "all" \}/u);
  assert.match(settingsPage, /case "diagnostics": return \{ tab: "diagnostics", kind: "all" \}/u);
  assert.match(settingsPage, /case "experts": return \{ tab: "catalog", kind: "expert" \}/u);
  assert.match(settingsPage, /aria-label="能力目录"/u);
  assert.doesNotMatch(settingsPage, /settings-extension-catalog__filters|settings-extension-catalog__filter/u);
  assert.match(settingsPage, /显示 \{visibleExtensionCount\} \/ \{extensionKindTotalCount\} 项/u);
  assert.match(settingsPage, /清除搜索/u);
  assert.match(settingsPage, /standaloneWorkspaceContent && standalonePluginView[\s\S]*?plugin-manager-\$\{standalonePluginView\}-tab/u);
  assert.match(settingsPage, /ref=\{standaloneWorkspaceContent \? settingsContentScroll\.ref : undefined\} onScroll=\{standaloneWorkspaceContent \? settingsContentScroll\.onScroll : undefined\} className=\{`settings-plugin-workspace__panel\$\{standaloneWorkspaceContent \? " settings-plugin-workspace__panel--standalone" : ""\}`\}/u);
  assert.match(settingsPage, /className="settings-plugin-workspace__overview"/u);
  assert.match(settingsPage, /settings\.plugins\.enabled/u);
  assert.match(settingsPage, /settings\.plugins\.skillDirectories/u);
  assert.match(settingsPage, /settings\.plugins\.mcpServers/u);
  assert.match(mcpConnectionsSettings, /settings\.computerControl\.enabled/u);
  assert.match(mcpConnectionsSettings, /尚未配置 MCP 服务/u);
  assert.match(mcpConnectionsSettings, /添加官方 REA \{REA_PACKAGE_VERSION\}（Windows）/u);
  assert.match(mcpConnectionsSettings, /REA_PACKAGE_VERSION = "6\.7\.0"/u);
  assert.match(mcpConnectionsSettings, /npx -y rea-agents@\$\{REA_PACKAGE_VERSION\} mcp/u);
  assert.match(settingsPage, /扩展工作台/u);
  assert.match(settingsPage, /插件 UI 完成 LFAA Owner 映射与实页验收前保持不可用/u);
  assert.match(pluginPageCss, /grid-template-rows:\s*auto minmax\(0,\s*1fr\)/u);
  assert.doesNotMatch(pluginPageCss, /plugin-manager-page__extensions-header/u);
  assert.match(settingsCss, /\.settings-content--plugin-workspace\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*none;/su);
  assert.match(settingsCss, /\.settings-plugin-standalone__content--workspace\s*\{[^}]*overflow:\s*hidden;/su);
  assert.match(settingsCss, /\.settings-plugin-workspace__panel--standalone\s*\{[^}]*overflow:\s*auto;/su);
  assert.doesNotMatch(settingsCss, /settings-extension-catalog__filters|settings-extension-catalog__filter/u);
  assert.doesNotMatch(settingsCss, /@container plugin-manager-extension-header/u);
  assert.match(settingsCss, /\.settings-plugin-workspace__overview\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/su);
  assert.match(settingsCss, /\.settings-content--plugin-workspace \.knowledge-library__toolbar\s*\{[^}]*grid-template-columns:/su);
  assert.match(settingsCss, /@container settings-main \(max-width: 420px\)/u);
  assert.match(settingsCss, /container:\s*settings-main\s*\/\s*inline-size/u);
  assert.doesNotMatch(settingsCss, /\.settings-plugin-workspace__overview\s*\{[^}]*repeat\(4,/su);
});

test('plugin settings gear opens the existing SettingsPage plugins section and keeps route return', () => {
  assert.match(pluginPage, /aria-label="打开插件设置"[^>]*onClick=\{\(\) => onOpenSettings\("plugins"\)\}/u);
  assert.match(pluginPage, /plugin-manager-page__settings-button/u);
  assert.match(pluginPageCss, /\.plugin-manager-page__settings-button\.ant-btn\s*\{[^}]*width:\s*36px[^}]*height:\s*36px/su);
  assert.match(workbenchPage, /settingsInitialSection, setSettingsInitialSection\] = useState<"ai" \| "permissions" \| "configuration" \| "account" \| "workspace" \| "security" \| "plugins"/u);
  assert.match(workbenchPage, /settingsSectionRequest, setSettingsSectionRequest\] = useState<\{ section: "ai" \| "permissions" \| "configuration" \| "account" \| "workspace" \| "security" \| "plugins"; requestId: number; focusTarget\?: string \}/u);
  assert.match(workbenchPage, /const openSettings = useCallback\(\(section\?: "ai" \| "permissions" \| "configuration" \| "account" \| "workspace" \| "security" \| "plugins", focusTarget\?: string\)/u);
  assert.match(workbenchPage, /setSettingsReturnRoute\(route\)/u);
  assert.match(workbenchPage, /onNavigate\(section \? `\/settings\?section=\$\{encodeURIComponent\(section\)\}` : "\/settings"\)/u);
  assert.match(workbenchPage, /onOpenSettings=\{openSettings\}/u);
  assert.match(settingsPage, /sectionRequest\?: \{ section: "ai" \| "permissions" \| "configuration" \| "account" \| "workspace" \| "security" \| "plugins"; requestId: number; focusTarget\?: string \}/u);
});

test('Settings Center exposes Profile plugins under Integrations and reuses authenticated lifecycle state', () => {
  assert.match(settingsMenuCatalog, /\{ id: "profilePlugins", label: "插件", group: "集成", access: "tools"/u);
  assert.match(settingsPage, /if \(section === "plugins"\) return "profilePlugins"/u);
  assert.match(settingsPage, /const routeSection = section === "profilePlugins" \? "plugins" : section/u);
  assert.match(settingsPage, /if \(activeSection === "profilePlugins"\) return <ManagedPluginsSettings/u);
  assert.match(settingsPage, /section\.id !== "plugins" && section\.id !== "connections"/u);
  assert.match(managedPluginsSettings, /loadManagedPlugins\(controller\.signal\)/u);
  assert.match(managedPluginsSettings, /setManagedPluginEnabled\(plugin\.id/u);
  assert.match(managedPluginsSettings, /expectedSourceCommit: plugin\.source\.commit/u);
  assert.match(managedPluginsSettings, /targetApplicationId/u);
  assert.match(managedPluginsSettings, /<SettingRow/u);
  assert.match(managedPluginsSettings, /<SettingsSwitch/u);
  assert.match(managedPluginsSettings, /plugin\.state === "incompatible"/u);
  assert.match(managedPluginsSettings, /hasAdminAccess\(user\.role\)/u);
  assert.doesNotMatch(managedPluginsSettings, /className="settings-row settings-profile-plugin-row"/u);
  assert.match(settingsCss, /\.settings-profile-plugin-row__icon\s*\{/u);
  assert.match(settingsCss, /@container settings-main \(max-width: 620px\)/u);
  assert.match(managedPluginsSettings, /允许 Agent 使用账户扩展/u);
  assert.match(managedPluginsSettings, /settings\.plugins\.enabled/u);
});

test('Settings integration tabs stay in place and each category uses its real owner state', () => {
  for (const label of ['插件', '应用', 'MCP', '技能', '市场']) assert.ok(managedPluginsSettings.includes(`label: "${label}"`), `missing integration category: ${label}`);
  assert.match(managedPluginsSettings, /<nav className="settings-profile-plugins__categories" role="tablist" aria-label="集成分类"/u);
  assert.match(managedPluginsSettings, /onClick=\{\(\) => setActiveCategory\(category\.id\)\}/u);
  assert.doesNotMatch(managedPluginsSettings, /plugin-manager\?view=/u);
  assert.match(managedPluginsSettings, /LFAA 内置应用/u);
  assert.match(managedPluginsSettings, /hiddenApplicationNavigationIds/u);
  assert.match(managedPluginsSettings, /<GitHubConnectionSettings searchQuery=\{query\} \/>/u);
  assert.match(githubConnectionSettings, /beginGitHubAuthorization/u);
  assert.match(githubConnectionSettings, /listGitHubRepositories/u);
  assert.match(githubConnectionSettings, /listGitHubIssues/u);
  assert.match(githubConnectionSettings, /listGitHubPullRequests/u);
  assert.match(githubConnectionSettings, /只读取这些资料/u);
  assert.doesNotMatch(githubConnectionSettings, /createGitHub|updateGitHub|mergeGitHub|commentGitHub/u);
  assert.match(managedPluginsSettings, /onPluginSettingsChange\(\{ \.\.\.settings\.plugins, disabledSkillNames: \[\.\.\.disabled\] \}\)/u);
  assert.match(managedPluginsSettings, /loadAiExtensions\(controller\.signal\)/u);
  assert.match(managedPluginsSettings, /result\.extensions\.filter\(extension => extension\.kind === "skill"\)/u);
  assert.doesNotMatch(managedPluginsSettings, /loadAiSkillDirectory/u);
  assert.match(managedPluginsSettings, /skill\.skillId/u);
  assert.match(connectionApi, /skillId\?: string;/u);
  assert.match(managedPluginsSettings, /<McpConnectionsSettings settings=\{settings\} onChange=\{onPluginSettingsChange\} searchQuery=\{query\} \/>/u);
  assert.match(mcpConnectionsSettings, /SettingsSwitch label=\{`连接 \$\{server\.name \|\| "MCP 服务"\}`\}/u);
  assert.match(mcpConnectionsSettings, /mcpServers: servers\.map/u);
  assert.match(managedPluginsSettings, /市场暂未接入/u);
  assert.match(managedPluginsSettings, /LFAA 当前没有可浏览的公共市场目录/u);
  assert.match(managedPluginsSettings, /onClick=\{openPluginManager\}>插件管理/u);
  assert.match(pluginPage, /searchParams\.set\("view", id\)/u);
  assert.match(pluginPage, /searchParams\.delete\("view"\)/u);
});

test('Settings integrations align title actions and place plugin search at toolbar end', () => {
  assert.match(managedPluginsSettings, /<Space className="settings-profile-plugins__actions" wrap>/u);
  assert.match(managedPluginsSettings, /settings-profile-plugins__count[\s\S]*?<Input\.Search aria-label=\{searchLabel\}/u);
  assert.match(settingsCss, /\.settings-profile-plugins__toolbar\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s+minmax\(180px,\s*320px\)/su);
  assert.match(settingsCss, /\.settings-profile-plugins__actions\s*\{[^}]*justify-content:\s*flex-end/su);
});

test('Settings integrations keep title actions left-aligned and stack search cleanly on narrow containers', () => {
  assert.match(settingsCss, /@container settings-main \(max-width: 620px\)[\s\S]*?\.settings-profile-plugins \.settings-content__heading\s*\{[^}]*flex-direction:\s*column;/u);
  assert.match(settingsCss, /\.settings-profile-plugins__actions\s*\{[^}]*align-self:\s*flex-start;[^}]*justify-content:\s*flex-start/su);
  assert.match(settingsCss, /\.settings-profile-plugins__toolbar\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)[^}]*gap:\s*var\(--space-2\)[^}]*margin-block:\s*0/su);
  assert.match(settingsCss, /\.settings-profile-plugins__categories,\s*\.settings-profile-plugins__toolbar \.ant-input-search\s*\{[^}]*min-width:\s*0;[^}]*width:\s*100%/su);
  assert.match(settingsCss, /@container settings-main \(max-width: 340px\)[\s\S]*?\.settings-profile-plugins__category\s*\{[^}]*padding-inline:\s*var\(--space-1\)/u);
});

test('Settings toolbar keeps menu and section-specific save status above paired narrow-screen actions', () => {
  assert.match(settingsPage, /<div className="settings-toolbar__status"><small>\{activeSection === "workspace" \? "本页配置由各区块单独保存" : "更新会自动保存"\}<\/small><\/div>/u);
  assert.match(settingsCss, /@container settings-main \(max-width: 760px\)[\s\S]*?\.settings-toolbar\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/u);
  assert.match(settingsCss, /\.settings-toolbar__status\s*\{[^}]*grid-column:\s*2;[^}]*grid-row:\s*1/su);
  assert.match(settingsCss, /\.settings-toolbar__actions\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;[^}]*grid-row:\s*2;[^}]*grid-template-columns:\s*repeat\(2,/su);
  assert.match(settingsCss, /\.settings-toolbar__actions\s*>\s*\.ant-btn\s*\{\s*width:\s*100%;/su);
});

test('plugin inspection confines long source metadata and warning alerts to the card grid', () => {
  assert.match(pluginPage, /className="plugin-manager-install-modal__inspection-meta"/u);
  assert.match(pluginPageCss, /\.plugin-manager-install-modal__body\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/su);
  assert.match(pluginPageCss, /\.plugin-manager-install-modal__inspection,\s*\.plugin-manager-install-modal__result\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/su);
  assert.match(pluginPageCss, /\.plugin-manager-install-modal__inspection-meta\s*\{[^}]*overflow-wrap:\s*anywhere/su);
  assert.doesNotMatch(pluginPageCss, /\.plugin-manager-install-modal__inspection\s*>\s*div:last-of-type/u);
  assert.match(pluginPageCss, /\.plugin-manager-install-modal__inspection\s*>\s*\.ant-alert\s*\{[^}]*min-width:\s*0/su);
});

test('plugin install guide disclosure keeps registry, example and full safety guidance available', () => {
  assert.match(pluginPage, /aria-expanded=\{installGuideOpen\}/u);
  assert.match(pluginPage, /aria-controls="plugin-manager-install-guide"/u);
  assert.match(pluginPage, /id="plugin-manager-install-guide"[^>]*hidden=\{!installGuideOpen\}/u);
  assert.match(pluginPage, /plugin-manager-install-modal__guide-row[\s\S]*?plugin-manager-install-modal__registry/u);
  assert.match(pluginPage, /plugin-manager-install-modal__guide-content[\s\S]*?填入示例/u);
  assert.match(pluginPage, /plugin-manager-install-modal__guide-content[\s\S]*?来源检查会展示版本、完整性、兼容性/u);
  assert.match(pluginPage, /plugin-manager-install-modal__warning--summary/u);
  assert.match(pluginPageCss, /\.plugin-manager-install-modal__guide-content\[hidden\]\s*\{\s*display:\s*none\s*;\s*\}/u);
  assert.match(pluginPageCss, /\.plugin-manager-install-modal__guide-row\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/su);
  assert.match(pluginPageCss, /@media\s*\(max-width:\s*560px\)[\s\S]*?\.plugin-manager-install-modal__guide-row\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/u);
});

test('capability catalog presents readable responsive cards and keeps all entry metadata', () => {
  assert.equal((settingsPage.match(/className="settings-group settings-extension-catalog-group" aria-label="能力目录"/gu) ?? []).length, 1);
  assert.match(settingsPage, /className="settings-extension-catalog-page"/u);
  assert.match(settingsPage, /className="settings-extension-catalog__entry-heading"/u);
  assert.match(settingsPage, /className="settings-extension-catalog__entry-description"/u);
  assert.match(settingsPage, /className="settings-extension-catalog__entry-version"/u);
  assert.match(settingsPage, /className="settings-extension-catalog__entry-source"/u);
  assert.match(settingsPage, /className="settings-capability-route-grid"/u);
  assert.match(settingsPage, /className="settings-capability-route-card"/u);
  assert.match(settingsPage, /extension\.description \|\| "暂无说明。"/u);
  assert.match(settingsPage, /extension\.pluginId/u);
  assert.match(settingsCss, /\.settings-extension-catalog__list\s*\{[^}]*grid-template-columns:\s*repeat\(2,/su);
  assert.match(settingsCss, /@container settings-main \(min-width: 1120px\)[\s\S]*?grid-template-columns:\s*repeat\(3,/u);
  assert.match(settingsCss, /@container settings-main \(max-width: 620px\)[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/u);
  assert.match(settingsCss, /\.settings-extension-catalog__entry-description\s*\{[^}]*line-height:\s*1\.6;/su);
});
