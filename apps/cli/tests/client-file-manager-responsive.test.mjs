import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const fileManagerCss = readFileSync(fileURLToPath(new URL("../../../packages/client/ui-sidebar-files/src/FileManagerPage.css", import.meta.url)), "utf8");
const fileManagerPage = readFileSync(fileURLToPath(new URL("../../../packages/client/ui-sidebar-files/src/FileManagerPage.tsx", import.meta.url)), "utf8");
const workbenchHeaderCss = readFileSync(fileURLToPath(new URL("../../../packages/client/ui-primitives/src/WorkbenchHeader.css", import.meta.url)), "utf8");

test("文件管理资源分类保留稳定目录 ID 并显示中英名称", () => {
  for (const [id, english] of Object.entries({ data: "Data", "game-instances": "Game Instances", "game-storage": "Game Storage", "game-servers": "Node Resources", knowledge: "My Library", backups: "Backups", environments: "Runtime Environments", lib: "Tools", logs: "Logs", cache: "Cache", tmp: "Temporary Files", "local-drives": "Local Drives" })) {
    assert.match(fileManagerPage, new RegExp(`(?:^|\\n)\\s*["']?${id}["']?:\\s*["']${english}["']`, "u"));
  }
  assert.match(fileManagerPage, /title=\{location\.description\}[\s\S]*?\{location\.name\}<small lang="en">\{resourceEnglishNames\[location\.id\] \?\? location\.id\}<\/small><\/span>/u);
  assert.doesNotMatch(fileManagerPage, /file-manager__resource-path/u);
  assert.match(fileManagerPage, /name === "steamcmd-runtime" \? "SteamCMD 工具目录"/u);
  assert.match(fileManagerCss, /\.file-manager__resource-list button > span\s*\{[^}]*display:\s*grid/u);
});

test("窄文件管理器按实际容器宽度压缩空态留白，避免底部操作被固定页脚遮住", () => {
  assert.match(fileManagerCss, /\.file-manager__empty\s*\{\s*padding:\s*55px 0;\s*\}/u);
  assert.match(fileManagerCss, /@container file-manager \(max-width: 620px\)[\s\S]*?\.file-manager__empty\s*\{\s*padding-block:\s*clamp\(12px, 5cqi, 55px\);\s*\}/u);
  assert.doesNotMatch(fileManagerCss, /\.file-manager__empty\s*\{[^}]*padding-block:[^}]*\b(?:vh|vw)\b/u);
});

test("文件管理复用工作区统一标题栏，并在窄容器按内容重新排布", () => {
  assert.match(fileManagerPage, /<WorkbenchHeader className="file-manager__workbench-header" layoutMode=\{metrics\.mode\} moduleMode="normal">[\s\S]*?data-workbench-header-slot="leading"[\s\S]*?lfaa-workbench-header__toggle[\s\S]*?文件管理[\s\S]*?data-workbench-header-slot="actions"[\s\S]*?ServiceStatus state=\{serverState\} compact[\s\S]*?aria-controls="file-manager-directory-tree"/u);
  assert.match(workbenchHeaderCss, /\.lfaa-workbench-header\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto minmax\(0,\s*1fr\)/u);
  assert.match(workbenchHeaderCss, /@container module-center \(max-width:\s*420px\)[\s\S]*?data-workbench-header-slot="center"/u);
  assert.match(fileManagerCss, /container-name:\s*file-manager module-center/u);
  const headerStart = fileManagerPage.indexOf('<header className="file-manager__header">');
  const headerEnd = fileManagerPage.indexOf("</header>", headerStart);
  assert.ok(headerStart >= 0 && headerEnd > headerStart, "文件管理页头存在");
  const header = fileManagerPage.slice(headerStart, headerEnd);
  assert.match(header, /className="file-manager__heading"[\s\S]*?文件与资源/u);
  assert.doesNotMatch(header, /管理游戏、备份和运行资源/u);
  assert.match(header, /className="file-manager__header-side"[\s\S]*?className="file-manager__root-path"[\s\S]*?dataRootLabel[\s\S]*?className="file-manager__header-controls"[\s\S]*?className="file-manager__header-actions"[\s\S]*?回收站[\s\S]*?操作记录/u);
  assert.match(fileManagerCss, /\.file-manager__header\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*minmax\(0,\s*\.8fr\)\s+minmax\(280px,\s*1fr\)/u);
  assert.match(fileManagerCss, /@container file-manager \(max-width:\s*980px\)[\s\S]*?\.file-manager__header\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/u);
  assert.match(fileManagerCss, /\.file-manager__root-path\s*\{[^}]*font-size:\s*\.84em[^}]*text-overflow:\s*ellipsis/u);
});

test("文件管理窄栏把路径快捷项和目录操作排成稳定分组", () => {
  assert.match(fileManagerPage, /className="file-manager__action-group" role="group" aria-label="目录操作"[\s\S]*?aria-label=\{activeFilterCount \? `筛选，已启用 \$\{activeFilterCount\} 项` : "筛选文件"\}[\s\S]*?aria-label="刷新目录"[\s\S]*?新建[\s\S]*?aria-label="上传 \/ 导入"/u);
  assert.match(fileManagerCss, /@container file-manager \(max-width: 980px\)[\s\S]*?\.file-manager__header-side\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto/u);
  assert.match(fileManagerCss, /@container file-manager \(max-width: 980px\)[\s\S]*?\.file-manager__actions\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/u);
  assert.match(fileManagerCss, /@container file-manager \(max-width: 980px\)[\s\S]*?\.file-manager__action-group\s*\{[^}]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/u);
  assert.match(fileManagerCss, /@container file-manager \(max-width: 520px\)[\s\S]*?\.file-manager__header-side\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/u);
  assert.match(fileManagerCss, /@container file-manager \(max-width: 520px\)[\s\S]*?\.file-manager__action-group\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/u);
  assert.match(fileManagerCss, /\.file-manager__action-group \.ant-btn\s*\{\s*min-height:\s*44px;/u);
  assert.doesNotMatch(fileManagerCss, /display:\s*inline-block/u);
});

test("文件管理将资源分类与真实目录树接入 DockKit 四区并保留窄容器控制", () => {
  assert.match(fileManagerCss, /\.file-manager__center-region\s*\{[^}]*display:\s*flex;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden/u);
  assert.match(fileManagerPage, /left=\{<aside id="file-manager-resource-navigation" className="file-manager__resource-pane"/u);
  assert.match(fileManagerPage, /className="file-manager__pane-heading"[\s\S]*?aria-label="收起资源导航"[\s\S]*?onClick=\{\(\) => setLeftCollapsed\(true\)\}/u);
  assert.match(fileManagerPage, /right=\{<aside id="file-manager-directory-tree" className="file-manager__directory-pane"/u);
  assert.match(fileManagerPage, /className="file-manager__directory-heading"[\s\S]*?aria-label="收起目录树"[\s\S]*?onClick=\{\(\) => setRightCollapsed\(true\)\}/u);
  assert.match(fileManagerPage, /lfaa-workbench-header__toggle[^>]*aria-expanded=\{leftCollapsed !== true\} aria-controls="file-manager-resource-navigation"/u);
  assert.match(fileManagerPage, /lfaa-workbench-header__pane-toggle[^>]*aria-expanded=\{rightCollapsed !== true\} aria-controls="file-manager-directory-tree"/u);
  assert.match(fileManagerPage, /initialLeftCollapsed=\{metrics\.mode === "mobile"\}/u);
  assert.match(fileManagerPage, /initialRightCollapsed=\{metrics\.mode !== "desktop"\}/u);
  assert.match(fileManagerPage, /onInitialCollapseState=\{applyInitialCollapseState\}/u);
  assert.match(fileManagerPage, /const updateResourcePaneCollapsed = useCallback\(\(collapsed: boolean\) => \{[\s\S]*?if \(!collapsed && metrics\.mode === "mobile"\) setRightCollapsed\(true\);/u);
  assert.match(fileManagerPage, /const updateDirectoryPaneCollapsed = useCallback\(\(collapsed: boolean\) => \{[\s\S]*?if \(!collapsed && metrics\.mode === "mobile"\) setLeftCollapsed\(true\);/u);
  assert.match(fileManagerPage, /setRightCollapsed\(metrics\.mode === "mobile" && initialLeftCollapsed === false \? true : initialRightCollapsed\)/u);
  assert.match(fileManagerPage, /onLeftCollapsedChange=\{updateResourcePaneCollapsed\}[\s\S]*?onRightCollapsedChange=\{updateDirectoryPaneCollapsed\}/u);
  assert.match(fileManagerPage, /if \(metrics\.mode === "mobile" && leftCollapsed === false && rightCollapsed === false\) setRightCollapsed\(true\)/u);
  assert.match(fileManagerCss, /\.file-manager__resource-region > \.file-manager__resource-pane\s*\{[^}]*min-height:\s*0;[^}]*overflow:\s*hidden/u);
  assert.match(fileManagerCss, /\.file-manager__resource-list\s*\{[^}]*min-height:\s*0;[^}]*flex:\s*1;[^}]*overflow:\s*auto/u);
  assert.match(fileManagerCss, /\.file-manager__tree-scroll\s*\{[^}]*min-height:\s*0;[^}]*flex:\s*1;[^}]*overflow:\s*auto/u);
  assert.match(fileManagerCss, /\.file-manager__body\s*\{[^}]*min-height:\s*0;[^}]*flex:\s*1;[^}]*overflow:\s*auto/u);
  assert.doesNotMatch(fileManagerCss, /file-manager__workspace|\.file-manager__tree\s*\{[^}]*position:\s*absolute/u);
});

test("移动端文件列表按实际容器改为竖向紧凑行且不提供横向表格滚动", () => {
  assert.match(fileManagerPage, /const compactFileTableBreakpoint = 960;/u);
  assert.match(fileManagerPage, /new ResizeObserver\(updateTableMode\)[\s\S]*?observer\.disconnect\(\)/u);
  assert.match(fileManagerPage, /columns\.filter\(column => column\.key === "name" \|\| column\.key === "actions"\)/u);
  assert.match(fileManagerPage, /scroll=\{compactFileTable \? undefined : \{ x: true \}\}/u);
  assert.match(fileManagerPage, /function formatCompactEntryMeta\(entry: ManagedFileEntry\)/u);
  assert.match(fileManagerPage, /formatCompactRootPath\(dataRootLabel\)/u);
  assert.match(fileManagerPage, /file-manager__breadcrumbs--nested/u);
  assert.match(fileManagerCss, /\.file-manager__body--compact \.ant-table-wrapper\s*\{[^}]*min-width:\s*0;[^}]*max-width:\s*100%/u);
  assert.match(fileManagerCss, /\.file-manager__body--compact \.ant-table-content\s*\{\s*overflow-x:\s*hidden !important;/u);
  assert.match(fileManagerCss, /\.file-manager__body--compact \.file-manager__row-actions \.ant-btn\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px/u);
  assert.doesNotMatch(fileManagerCss, /@container file-manager \(max-width:\s*620px\)[\s\S]*?\.file-manager__body \.ant-table-wrapper\s*\{\s*min-width:\s*600px/u);
});
