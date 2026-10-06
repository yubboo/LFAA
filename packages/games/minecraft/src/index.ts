/** 功能：登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。 */
import type { Context } from "@deepseek-ai/cordis";
import * as capability from "./service.js";
import * as coreSources from "./core-sources.js";
import * as deployment from "./deployment-service.js";
import { getMinecraftConnectivityTarget, listMinecraftConnectivityTargets } from "./service.js";
import type { ConnectivityTargetAdapter } from "lfaa-game-connectivity/src/service.js";
export const name = "lfaaMinecraft";
export const inject = ["lfaaGameConnectivity"];
export function apply(ctx: Context): void {
  ctx.provide(name, { ...capability, ...coreSources, ...deployment });
  const adapter: ConnectivityTargetAdapter = {
    list: (ownerId) => listMinecraftConnectivityTargets(ownerId),
    get: (ownerId, targetId) => getMinecraftConnectivityTarget(ownerId, targetId)
  };
  ctx.lfaaGameConnectivity.registerTargetAdapter(ctx, "minecraft", adapter);
}
