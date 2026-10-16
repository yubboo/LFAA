/**
 * 功能：为隔离回归装配真实领域工具插件。
 * 作用：复用生产 Cordis/注册表及同一领域服务，测试不再依赖 core 内的旧硬编码目录。
 * 关联文件：games/tool-*、document/tool-writing、prompt/prompt、skill/tool-skill。
 */
import { Context } from "@deepseek-ai/cordis";
export async function createDomainToolTestHost(domains = ["minecraft", "steamcmd", "writing", "runtime"]) {
  const ctx = new Context(), fibers = [];
  // 单领域单元夹具提供实际服务导出；完整 Profile 的生命周期另由 Harness 回归覆盖。
  for (const [service, source] of [["lfaaMinecraft", "lfaa-games-minecraft/src/service.js"], ["lfaaSteamcmd", "lfaa-games-steamcmd/src/service.js"], ["lfaaWriting", "lfaa-document-writing/src/service.js"]]) ctx.provide(service, await import(source));
  ctx.provide("lfaaRuntimeManager", (await import("lfaa-runtime-manager/src/service.js")).runtimeManager);
  const names = ["lfaa-agent", "lfaa-tools", "lfaa-skill", "lfaa-prompt-minecraft", "lfaa-prompt-writing", "lfaa-prompt", "lfaa-skill-writing", "lfaa-tool-skill", ...domains.map(domain => `lfaa-tool-${domain}`)];
  try {
    for (const name of names) { const plugin = await import(name); fibers.push(await ctx.plugin(plugin.apply ? plugin : plugin.default)); }
    return { ctx, close: async () => { for (const fiber of fibers.reverse()) await fiber.dispose(); } };
  } catch (error) { for (const fiber of fibers.reverse()) await fiber.dispose(); throw error; }
}
