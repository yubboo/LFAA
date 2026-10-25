/*
 * 功能：检查通用 Steam 专用服务端的领域、Controller、Daemon 与游戏库入口合同。
 * 作用：防止 Dedicated Server Tool AppID、许可、路径、任务回报或四栏入口退化为占位状态。
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const read = path => readFile(resolve(root, path), "utf8");

test("Steam Dedicated Server 使用独立 Tool AppID 配置并沿用 SteamCMD 任务 Owner", async () => {
  const [service, controller, contracts, daemon, tools] = await Promise.all([
    read("packages/games/steamcmd/src/service.ts"),
    read("packages/api/steamcmd-controller/src/index.ts"),
    read("packages/api/remotes/src/route-contracts.ts"),
    read("packages/host/daemon/src/daemon.mjs"),
    read("packages/games/tool-steamcmd/src/index.ts")
  ]);

  assert.match(service, /toolAppId:\s*number/u);
  assert.match(service, /"install-server"\s*\|\s*"update-server"\s*\|\s*"start-server"\s*\|\s*"stop-server"/u);
  assert.match(service, /INSERT INTO steamcmd_servers/u);
  assert.match(service, /createSteamcmdServerTask/u);
  assert.match(controller, /requireAuthentication, requireRole\("admin"\)/u);
  assert.match(controller, /authorizeExplicitUserAction/u);
  assert.match(contracts, /steamcmdServerSchema[\s\S]*?toolAppId:\s*Joi\.number\(\)\.integer\(\)/u);
  assert.match(contracts, /eulaAccepted:\s*Joi\.boolean\(\)\.required\(\)/u);

  assert.match(daemon, /"\+force_install_dir",\s*directory,\s*"\+login",\s*"anonymous",\s*"\+app_update",\s*String\(server\.toolAppId\),\s*"validate",\s*"\+quit"/u);
  assert.match(daemon, /spawn\(executable,\s*launchArguments,\s*\{[^}]*shell:\s*false/isu);
  assert.match(daemon, /validateMinecraftStorageDirectory\(value\.installDirectory\)/u);
  assert.match(daemon, /ServerHeartbeat|steamcmdServers:\s*await getSteamcmdServerHeartbeat\(\)/u);
  assert.match(daemon, /async function getSteamcmdServerHeartbeat\(\) \{\s*const states = \[\];\s*for \(const id of knownSteamcmdServerIds\) \{[\s\S]*?activeSteamcmdServers\.get\(id\)[\s\S]*?states\.push\(\{ id, status, processId: null \}\);/u);
  assert.match(tools, /steamcmd_create_server/u);
  assert.match(tools, /只有用户明确说已阅读并接受此服务端许可\/EULA/u);
});

test("DST 共用服务端文件，但以独立节点进程、分片配置和受管数据目录运行", async () => {
  const [service, controller, contracts, database, daemon, dst, page] = await Promise.all([
    read("packages/games/steamcmd/src/service.ts"),
    read("packages/api/steamcmd-controller/src/index.ts"),
    read("packages/api/remotes/src/route-contracts.ts"),
    read("packages/storage/storage-sqlite/src/database.ts"),
    read("packages/host/daemon/src/daemon.mjs"),
    read("packages/host/daemon/src/steamcmd-dst.mjs"),
    read("packages/client/ui-layout/src/SteamcmdWorkspace.tsx")
  ]);

  assert.match(service, /createSteamcmdDstCluster/u);
  assert.match(service, /group\.some\(member => !serverIsConfirmedStopped\(member\)\)/u);
  assert.match(service, /UPDATE steamcmd_servers SET installation_status = 'installing'.*dst_cluster_id/u);
  assert.match(controller, /router\.post\("\/steamcmd\/dst-clusters"/u);
  assert.match(contracts, /steamcmdDstClusterSchema/u);
  assert.match(database, /版本 66：DST Master\/Caves/u);
  assert.match(database, /dst_cluster_id TEXT/u);
  assert.match(daemon, /buildSteamcmdDstLaunchArguments\(serverDataDirectory, server\.dstClusterName, server\.dstShard\)/u);
  assert.match(daemon, /verifySteamcmdDstClusterFiles\(configurationDirectory, server\.dstShard, assertSteamcmdServerPathSafe\)/u);
  assert.match(daemon, /serverDataDirectory,\s*dstClusterId/u);
  assert.match(dst, /cluster_token\.txt/u);
  assert.doesNotMatch(dst, /readFile\s*\(/u);
  assert.match(page, /createSteamcmdDstCluster\(input\)/u);
  assert.match(page, /setFileManagerLocation\(user\.id, `\.lfaa-library\/game-storage/u);
  assert.match(page, /Master \+ Caves/u);
});

test("Steam 服务端页面从游戏库中心槽提供列表、安装与节点内配置", async () => {
  const [workbench, page, css, routes] = await Promise.all([
    read("packages/client/ui-layout/src/Workbench.tsx"),
    read("packages/client/ui-layout/src/SteamcmdWorkspace.tsx"),
    read("packages/client/ui-layout/src/SteamcmdWorkspace.css"),
    read("packages/client/ui-workspace/src/ApplicationWorkspace.tsx")
  ]);

  assert.match(workbench, /isGameLibraryRoute && app === "steamcmd" \? <SteamcmdWorkspace/u);
  assert.match(routes, /\["\/games\/steamcmd", "Steam 游戏服务"\]/u);
  assert.match(page, /loadSteamcmdServers/u);
  assert.match(page, /createSteamcmdServerTask\(server\.id, kind\)/u);
  assert.match(page, /Dedicated Server Tool AppID/u);
  assert.match(page, /eulaAccepted/u);
  assert.match(page, /控制台停服指令/u);
  assert.match(css, /@container \(max-width: 38rem\)/u);
  assert.doesNotMatch(css, /display:\s*inline-block/u);
});

test("SteamCMD 运行环境保留官方安装、真实校验、完整卸载和同节点只读文件管理", async () => {
  const [service, controller, contracts, connection, daemon, workspaceFiles, panel, gameLibrary, css] = await Promise.all([
    read("packages/games/steamcmd/src/service.ts"),
    read("packages/api/steamcmd-controller/src/index.ts"),
    read("packages/api/remotes/src/route-contracts.ts"),
    read("packages/client/connection/src/api.ts"),
    read("packages/host/daemon/src/daemon.mjs"),
    read("packages/api/workspace-files/src/index.ts"),
    read("packages/client/ui-layout/src/RuntimeEnvironmentPanel.tsx"),
    read("packages/client/ui-layout/src/GameLibraryPage.tsx"),
    read("packages/client/ui-layout/src/GameLibraryPage.css")
  ]);

  assert.match(service, /"install"\s*\|\s*"verify"\s*\|\s*"uninstall"/u);
  assert.match(service, /server\.status !== "stopped"/u);
  assert.match(controller, /steamcmd\.runtime\.\$\{body\.kind\}/u);
  assert.match(controller, /body\.kind === "uninstall" \? "dangerous" : "write"/u);
  assert.match(contracts, /valid\("install", "verify", "uninstall"\)/u);
  assert.match(connection, /kind: "install" \| "verify" \| "uninstall"/u);
  assert.match(daemon, /steamcdn-a\.akamaihd\.net\/client\/installer\/steamcmd\.zip/u);
  assert.match(daemon, /task\.kind === "uninstall" \? await uninstallSteamcmd\(task\)/u);
  assert.match(daemon, /removeSteamcmdInstallation\(toolDirectory,assertManagedPathIsSafe\)/u);
  assert.match(daemon, /gameStorageKind==='steamcmd-runtime'[\s\S]*?只允许查看/u);
  assert.match(workspaceFiles, /steamcmd-runtime/gu);
  assert.match(workspaceFiles, /SteamCMD 工具目录在文件管理中只允许查看/u);
  assert.match(panel, /官方下载并安装/u);
  assert.match(panel, /完整卸载/u);
  assert.match(panel, /onManageSteamcmd\(targetId\)/u);
  assert.match(panel, /item\.id!=="local"&&item\.status==="online"&&item\.platform==="win32"&&item\.architecture==="x64"/u);
  assert.match(gameLibrary, /setFileManagerLocation\(user\.id,`\.lfaa-library\/game-storage\/\$\{nodeId\}\/steamcmd-runtime`\)/u);
  assert.match(css, /runtime-manager__steamcmd-actions \.runtime-manager__steamcmd-label \{ display: none; \}/u);
});
