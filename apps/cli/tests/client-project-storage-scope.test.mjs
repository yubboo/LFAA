/** 功能：锁定项目与存储页面的业务数据范围。作用：防止重新加入 system-data 管理展示或额外读取系统目录；关联文件：ui-settings/SettingsPage.tsx。 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const settingsPage = readFileSync(new URL("../../../packages/client/ui-settings/src/SettingsPage.tsx", import.meta.url), "utf8");

test("项目与存储只管理业务内容和游戏节点路径", () => {
  assert.match(settingsPage, /title="业务内容存储位置"/u);
  assert.match(settingsPage, /title="游戏节点数据位置"/u);
  assert.doesNotMatch(settingsPage, /title="系统数据位置"|title="系统运行目录"|title="控制端数据"/u);
  assert.doesNotMatch(settingsPage, /loadDataDirectorySettings|dataDirectorySettings|RuntimeStorageSettings/u);
});
