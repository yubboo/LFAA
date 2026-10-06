/** 功能：登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。 */
import type { Context } from "@deepseek-ai/cordis";
import * as capability from "./database.js";
import type { StorageHub } from "lfaa-storage-hub/src/index.js";
import { SqliteStorageKvBackend } from "./hub-backend.js";

declare module "@deepseek-ai/cordis" { interface Context { lfaaStorageHub: StorageHub } }

export const name = "lfaaStorage";
export const inject = ["lfaaStorageHub"];
export function apply(ctx: Context): void {
  ctx.provide(name, capability);
  const backend = new SqliteStorageKvBackend();
  const unregister = ctx.lfaaStorageHub.backend.register("sqlite", backend);
  ctx.effect(() => async () => {
    unregister();
    await backend.close();
    capability.closeDatabase();
  });
}
