import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const fileManagerCss = readFileSync(fileURLToPath(new URL("../../../packages/client/ui-sidebar-files/src/FileManagerPage.css", import.meta.url)), "utf8");
const fileManagerPage = readFileSync(fileURLToPath(new URL("../../../packages/client/ui-sidebar-files/src/FileManagerPage.tsx", import.meta.url)), "utf8");

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

test("文件管理页头在宽容器左右排布，窄容器按内容宽度堆叠", () => {
  const headerStart = fileManagerPage.indexOf('<header className="file-manager__header">');
  const headerEnd = fileManagerPage.indexOf("</header>", headerStart);
  assert.ok(headerStart >= 0 && headerEnd > headerStart, "文件管理页头存在");
  const header = fileManagerPage.slice(headerStart, headerEnd);
  assert.match(header, /className="file-manager__heading"[\s\S]*?文件管理[\s\S]*?管理游戏、备份和运行资源/u);
  assert.match(header, /className="file-manager__header-side"[\s\S]*?className="file-manager__root-path"[\s\S]*?dataRootLabel[\s\S]*?className="file-manager__header-controls"[\s\S]*?className="file-manager__header-actions"[\s\S]*?回收站[\s\S]*?操作记录/u);
  assert.match(fileManagerCss, /\.file-manager__header\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*minmax\(0,\s*\.8fr\)\s+minmax\(280px,\s*1fr\)/u);
  assert.match(fileManagerCss, /@container file-manager \(max-width:\s*680px\)[\s\S]*?\.file-manager__header\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/u);
  assert.match(fileManagerCss, /\.file-manager__root-path\s*\{[^}]*font-size:\s*\.84em[^}]*text-overflow:\s*ellipsis/u);
});
