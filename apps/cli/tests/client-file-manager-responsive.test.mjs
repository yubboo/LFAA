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
  assert.match(fileManagerPage, /<span>\{location\.name\}<small lang="en">\{resourceEnglishNames\[location\.id\] \?\? location\.id\}<\/small><small className="file-manager__resource-path">\{location\.description\}<\/small><\/span>/u);
  assert.match(fileManagerPage, /name === "steamcmd-runtime" \? "SteamCMD 工具目录"/u);
  assert.match(fileManagerCss, /\.file-manager__resource-list button small\.file-manager__resource-path\s*\{[^}]*-webkit-line-clamp:\s*2/u);
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
  assert.match(header, /className="file-manager__heading"[\s\S]*?文件与资源[\s\S]*?管理游戏、备份和运行资源/u);
  assert.match(header, /className="file-manager__header-side"[\s\S]*?className="file-manager__root-path"[\s\S]*?dataRootLabel[\s\S]*?className="file-manager__header-controls"[\s\S]*?className="file-manager__header-actions"[\s\S]*?回收站[\s\S]*?操作记录/u);
  assert.match(fileManagerCss, /\.file-manager__header\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*minmax\(0,\s*\.8fr\)\s+minmax\(280px,\s*1fr\)/u);
  assert.match(fileManagerCss, /@container file-manager \(max-width:\s*680px\)[\s\S]*?\.file-manager__header\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/u);
  assert.match(fileManagerCss, /\.file-manager__root-path\s*\{[^}]*font-size:\s*\.84em[^}]*text-overflow:\s*ellipsis/u);
});

test("文件管理将资源分类与真实目录树接入 DockKit 四区并保留窄容器控制", () => {
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
