import type { ManagedPluginRecord } from "lfaa-client-connection/src/api.js";

const wallpaperEngineRecordIds = new Set([
  "elysia395-dsh-wallpaper-engine",
  "npm-dsh-plugin-wallpaper-engine"
]);

/** 按 DshWallpaperEngineRuntime 接受的稳定记录身份判断是否为壁纸引擎插件。 */
export function hasWallpaperEnginePlugin(plugins: readonly Pick<ManagedPluginRecord, "id" | "name" | "compatibility">[]): boolean {
  return plugins.some(plugin => wallpaperEngineRecordIds.has(plugin.id)
    && plugin.name === "dsh-plugin-wallpaper-engine"
    && plugin.compatibility === "dsh-v1");
}
