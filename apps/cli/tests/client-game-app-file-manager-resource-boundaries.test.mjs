/*
 * 功能：回归游戏应用文件管理的资源导航边界。
 * 作用：保证 Minecraft/Steam/实例入口只露出游戏工作需要的快捷分类，左一全局入口仍保留完整清单。
 * 关联文件：packages/client/ui-sidebar-files/src/file-manager-resource-visibility.ts、FileManagerPage.tsx。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { getVisibleFileManagerLocations } from "../../../packages/client/ui-sidebar-files/src/file-manager-resource-visibility.ts";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const fileManagerPage = readFileSync(resolve(repositoryRoot, "packages/client/ui-sidebar-files/src/FileManagerPage.tsx"), "utf8");
const locationIds = [
  "data", "game-instances", "game-storage", "aivideo-projects", "knowledge", "game-servers",
  "backups", "environments", "lib", "logs", "cache", "tmp", "local-drives", "plugins"
];
const locations = locationIds.map(id => ({ id, name: id, path: id, description: id }));
const expectedGameLocationIds = ["data", "game-instances", "game-storage", "backups", "environments", "lib", "logs"];

test("Minecraft、Steam 与实例文件入口只显示游戏相关及明确允许的分类", () => {
  assert.deepEqual(getVisibleFileManagerLocations(locations, "minecraft", ".lfaa-library/game-storage/node-1/minecraft").map(location => location.id), expectedGameLocationIds);
  assert.deepEqual(getVisibleFileManagerLocations(locations, "steamcmd", ".lfaa-library/game-storage/node-1/steamcmd").map(location => location.id), expectedGameLocationIds);
  assert.deepEqual(getVisibleFileManagerLocations(locations, null, ".lfaa-library/game-instances/instance-1").map(location => location.id), expectedGameLocationIds);
  assert.deepEqual(getVisibleFileManagerLocations(locations, null, ".lfaa-library/game-storage/node-1/steamcmd-runtime").map(location => location.id), expectedGameLocationIds);
});

test("左一全局文件总入口与非游戏 App 入口保留完整资源清单", () => {
  assert.deepEqual(getVisibleFileManagerLocations(locations, null, null), locations);
  assert.deepEqual(getVisibleFileManagerLocations(locations, null, ".lfaa-library/aivideo-projects/project-1"), locations);
});

test("游戏文件页中的左一全局入口清除游戏上下文并回到完整总览", () => {
  assert.match(fileManagerPage, /onOpenFiles=\{openGlobalFileManager\}/u);
  assert.match(fileManagerPage, /setFileEntryContext\(\{ userId: user\.id, requestedLocation: null, returnPath: null, returnApp: null \}\)/u);
  assert.match(fileManagerPage, /visibleLocations\.map\(location =>/u);
});
