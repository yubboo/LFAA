/** 功能：登记本包能力。作用：通过 Cordis 服务和可撤销资源接入 Harness。关联文件：本包实现、package.json、组合补丁。 */
import type { Context } from "@deepseek-ai/cordis";
import * as capability from "./service.js";
export const name = "lfaaSettings";
export const inject = ["lfaaCredentials"];
export function apply(ctx: Context): void {
  ctx.provide(name, capability);
  // AI 密钥和插件凭据记录都由 Settings 加密持有；凭据插件只获得明确登记的读取/存储适配。
  ctx.effect(() => {
    const unregisterAccountSource = ctx.lfaaCredentials.register(ctx, {
      consumers: ["lfaa-agent-default-model"],
      resolve: (ownerId, referenceId) => capability.resolveAiModelAccountCredential(ownerId, referenceId),
      describe: (ownerId, referenceId) => ({
        configured: capability.listAiAccounts(ownerId).some(account => account.id === referenceId && account.hasSecret),
        source: "settings-encrypted-account",
        writable: false
      })
    });
    const unregisterCredentialStore = ctx.lfaaCredentials.registerRecordStore(ctx, {
      get: capability.readPluginCredentialRecord,
      set: capability.savePluginCredentialRecord,
      delete: capability.deletePluginCredentialRecord,
      list: capability.listPluginCredentialRecords
    });
    return () => {
      unregisterCredentialStore();
      unregisterAccountSource();
    };
  });
}
