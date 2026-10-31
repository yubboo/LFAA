/*
 * 功能：回归 Minecraft / Steam 左二文件管理入口。
 * 作用：确认菜单传递领域游戏存储根与来源 App，且返回信息保持账户隔离。
 * 关联文件：packages/client/ui-workspace/src/ApplicationWorkspace.tsx、packages/client/ui-sidebar-files/src/FileManagerPage.tsx、packages/client/connection/src/file-manager-location.ts。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { consumeFileManagerLocation, readFileManagerLocation, readFileManagerReturnApp, readFileManagerReturnPath, setFileManagerLocation } from "../../../packages/client/connection/src/file-manager-location.ts";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const workspace = readFileSync(resolve(repositoryRoot, "packages/client/ui-workspace/src/ApplicationWorkspace.tsx"), "utf8");
const fileManager = readFileSync(resolve(repositoryRoot, "packages/client/ui-sidebar-files/src/FileManagerPage.tsx"), "utf8");

test("Minecraft 与 Steam 左二文件管理菜单定位到各自存储并返回来源路由", () => {
  assert.match(workspace, /key === "files" \? onOpenGameFiles\?\.\("minecraft"\)/u);
  assert.match(workspace, /loadMinecraftStorageSettings\(\)/u);
  assert.match(workspace, /visibleMinecraftRuntimeContext\?\.nodeId/u);
  assert.match(workspace, /onOpenGameFiles\?\.\("steamcmd"\)/u);
  assert.match(workspace, /loadSteamcmdSettings\(\)/u);
  assert.match(workspace, /sourceApp === "minecraft" \? "minecraft" : "steamcmd"/u);
  assert.match(workspace, /setFileManagerLocation\(userId, `\.lfaa-library\/game-storage\/\$\{encodeURIComponent\(node\.id\)\}\/\$\{storageKind\}`, returnPath, sourceApp\)/u);
  assert.match(workspace, /onNavigate\("\/files"\)/u);
});

test("左一全局文件入口清除上次应用位置并定位 Data 总览", () => {
  assert.match(workspace, /onOpenFiles=\{\(\) => \{ setFileManagerLocation\(userId, ""\); onNavigate\("\/files"\); \}\}/u);

  const originalWindow = globalThis.window;
  const history = { state: { preserved: true }, replaceState(state) { this.state = state; } };
  globalThis.window = { history };
  try {
    setFileManagerLocation("account-a", ".lfaa-library/game-storage/node-a/steamcmd", "/games/steamcmd", "steamcmd");
    setFileManagerLocation("account-a", "");
    assert.equal(readFileManagerLocation("account-a"), "", "empty location selects the Data overview and suppresses stale file snapshots");
    assert.equal(readFileManagerReturnPath("account-a"), null);
    assert.equal(readFileManagerReturnApp("account-a"), null);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("文件页按本次 App 来源显示返回名称，同时保留实例入口的原标签", () => {
  assert.match(fileManager, /readFileManagerReturnApp\(user\.id\)/u);
  assert.match(fileManager, /fileEntryContext\.returnApp === "minecraft" \? "返回 Minecraft" : fileEntryContext\.returnApp === "steamcmd" \? "返回 Steam" : "返回实例"/u);
  assert.match(fileManager, /fileEntryReturnPath\)[\s\S]*?>\{fileEntryReturnLabel\}<\/Button>/u);

  const originalWindow = globalThis.window;
  const history = { state: { preserved: true }, replaceState(state) { this.state = state; } };
  globalThis.window = { history };
  try {
    setFileManagerLocation("account-a", ".lfaa-library/game-storage/node-a/minecraft", "/games/minecraft/instances", "minecraft");
    assert.equal(readFileManagerLocation("account-a"), ".lfaa-library/game-storage/node-a/minecraft");
    assert.equal(readFileManagerReturnPath("account-a"), "/games/minecraft/instances");
    assert.equal(readFileManagerReturnApp("account-a"), "minecraft");
    assert.equal(readFileManagerReturnApp("account-b"), null, "a different account must not inherit the return label");
    consumeFileManagerLocation();
    assert.equal(readFileManagerReturnPath("account-a"), null, "the one-time location is consumed after entering Files");
    setFileManagerLocation("account-a", ".lfaa-library/game-storage/node-a/steamcmd", "/games/steamcmd", "steamcmd");
    assert.equal(readFileManagerLocation("account-a"), ".lfaa-library/game-storage/node-a/steamcmd");
    assert.equal(readFileManagerReturnPath("account-a"), "/games/steamcmd");
    assert.equal(readFileManagerReturnApp("account-a"), "steamcmd");
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
