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
  assert.match(daemon, /spawn\(executable,\s*server\.launchArguments,\s*\{[^}]*shell:\s*false/isu);
  assert.match(daemon, /validateMinecraftStorageDirectory\(value\.installDirectory\)/u);
  assert.match(daemon, /ServerHeartbeat|steamcmdServers:\s*await getSteamcmdServerHeartbeat\(\)/u);
  assert.match(tools, /steamcmd_create_server/u);
  assert.match(tools, /只有用户明确说已阅读并接受此服务端许可\/EULA/u);
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
