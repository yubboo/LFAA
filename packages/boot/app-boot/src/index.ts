/**
 * 功能：启动 LFAA Harness 的共享 Cordis 上下文。
 * 作用：按上游的 profile → bundle patch → profile patch → 显式 patch 顺序装配插件，并统一关闭资源。
 * 关联文件：apps/cli/config/profiles、packages/bundle、host/webserver、ai-host.ts。
 */
import { Context } from "@deepseek-ai/cordis";
import Loader from "@deepseek-ai/cordis-plugin-loader";
import Timer from "@deepseek-ai/cordis-plugin-timer";
import { readFileSync, existsSync, mkdirSync, lstatSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { config } from "lfaa-launch-environment/src/config.js";
import { PluginRuntimeManager } from "./plugin-runtime.js";
interface PluginRow { id: string; name?: string; inject?: string[]; config?: Record<string, unknown>; disabled?: boolean; required?: boolean | undefined }
interface PatchRow extends PluginRow { insert?: PluginRow[] }
interface BundleManifest { name: string; lfaa: { bundle: { patch: string } } }
interface ProfileManifest { lfaa: { profile: { bundles: string[]; patch?: string } } }
function applyPatch(rows: Map<string, PluginRow>, path: string): void {
  const patch = yaml.load(readFileSync(path, "utf8"));
  if (!Array.isArray(patch)) throw new Error(`装配补丁必须是列表：${path}`);
  for (const item of patch as PatchRow[]) {
    if (item.insert) {
      for (const row of item.insert) {
        if (!row.id || !row.name || rows.has(row.id)) throw new Error(`重复或无效的插件登记：${row.id}`);
        rows.set(row.id, { ...row });
      }
    } else {
      const previous = rows.get(item.id);
      if (!previous) throw new Error(`补丁引用了不存在的插件：${item.id}`);
      if (previous.required && item.disabled) throw new Error(`必需插件不能被停用：${item.id}`);
      if (item.name !== undefined && (typeof item.name !== "string" || !item.name.trim())) throw new Error(`插件实现包名无效：${item.id}`);
      rows.set(item.id, { ...previous, ...item, required: previous.required });
    }
  }
}

function ensureUserProfileDirectory(homeRoot: string, profile: string): string {
  const profileRoot = resolve(homeRoot, "profiles", profile);
  mkdirSync(profileRoot, { recursive: true, mode: 0o700 });
  const profileStat = lstatSync(profileRoot);
  if (profileStat.isSymbolicLink() || !profileStat.isDirectory()) {
    throw new Error(`用户 Profile 目录必须是真实目录：${profileRoot}`);
  }

  const patchPath = resolve(profileRoot, "cordis.patch.yml");
  try {
    writeFileSync(patchPath, "# 用户级 Profile 覆盖；可替换已有模块实现或插入受支持的模块。\n[]\n", { encoding: "utf8", flag: "wx", mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  return profileRoot;
}

export async function boot(args: string[] = []): Promise<Context> {
  const profileIndex = args.indexOf("--profile");
  const profile = profileIndex >= 0 ? args[profileIndex + 1] : args[0] && !args[0].startsWith("-") ? args[0] : "web";
  if (!profile || !/^[a-z][a-z0-9-]*$/u.test(profile)) throw new Error("运行组合名称无效。");
  // 源码与控制端编译输出保留同一包目录结构。
  const treeRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
  const homeIndex = args.indexOf("--home");
  const homeArgument = homeIndex >= 0 ? args[homeIndex + 1] : process.env.LFAA_HARNESS_HOME?.trim() || config.homeDirectory;
  if (homeIndex >= 0 && !homeArgument) throw new Error("--home 需要配置目录路径。");
  const homeRoot = resolve(homeArgument);
  const localProfile = ensureUserProfileDirectory(homeRoot, profile);
  const defaultProfile = resolve(treeRoot, "apps/cli/config/profiles", profile);
  const profileRoot = existsSync(resolve(localProfile, "package.json")) ? localProfile : defaultProfile;
  const manifest = JSON.parse(readFileSync(resolve(profileRoot, "package.json"), "utf8")) as ProfileManifest;
  const rows = new Map<string, PluginRow>();
  for (const bundle of manifest.lfaa.profile.bundles) {
    const manifestPath = fileURLToPath(import.meta.resolve(`${bundle}/package.json`));
    const bundleManifest = JSON.parse(readFileSync(manifestPath, "utf8")) as BundleManifest;
    const patchPath = resolve(dirname(manifestPath), bundleManifest.lfaa.bundle.patch);
    applyPatch(rows, patchPath);
  }
  const declaredProfilePatch = manifest.lfaa.profile.patch ? resolve(profileRoot, manifest.lfaa.profile.patch) : null;
  if (declaredProfilePatch) applyPatch(rows, declaredProfilePatch);
  const userProfilePatch = resolve(localProfile, "cordis.patch.yml");
  if (existsSync(userProfilePatch) && declaredProfilePatch !== userProfilePatch) applyPatch(rows, userProfilePatch);
  const homePatch = resolve(homeRoot, "cordis.patch.yml");
  if (existsSync(homePatch)) applyPatch(rows, homePatch);
  for (let i = 0; i < args.length; i += 1) if (args[i] === "--patch") {
    const path = args[++i];
    if (!path) throw new Error("--patch 需要补丁路径。");
    applyPatch(rows, resolve(path));
  }
  const context = new Context();
  context.baseUrl = import.meta.url;
  try {
    await context.plugin(Loader, { baseUrl: import.meta.url });
    await context.plugin(Timer);
    context.provide("profileContext", { name: profile });
    const pluginRuntime = new PluginRuntimeManager(context, [...rows.values()].map((row) => ({ id: row.id, required: Boolean(row.required), profileDisabled: Boolean(row.disabled) })));
    context.provide("lfaaPluginRuntime", pluginRuntime);
    for (const row of rows.values()) {
      const specifier = row.name!.includes("/") ? row.name! : `${row.name}/src/index.js`;
      const entrypoint = import.meta.resolve(specifier);
      const disabled = pluginRuntime.isDisabledAtStartup(row.id);
      if (!disabled) {
        // Loader 会记录并吞掉模块导入错误；显式导入让 CLI 报告真实原因，并清理已装配的资源。
        try { await import(entrypoint); }
        catch (error) { throw new Error(`插件加载失败：${row.id}（${row.name}）：${error instanceof Error ? error.message : String(error)}`, { cause: error }); }
      }
      let runtimeId: string;
      try { runtimeId = await context.loader.create({ name: entrypoint, inject: row.inject ?? [], config: row.config ?? {}, disabled }); }
      catch (error) { throw new Error(`插件装配失败：${row.id}（${row.name}）：${error instanceof Error ? error.message : String(error)}`, { cause: error }); }
      pluginRuntime.registerEntry(row.id, runtimeId);
    }
    await context.loader.await();
    const failed = [...context.loader.entries()].filter((entry) => !entry.disabled && entry.fiber?.state !== 2);
    if (failed.length) {
      const diagnostics = await Promise.all(failed.map(async (entry) => {
        let detail = "";
        if (entry.fiber?.state === 3) {
          try { await entry.fiber.await(); }
          catch (error) { detail = error instanceof Error ? `；原因：${error.message}` : `；原因：${String(error)}`; }
        }
        return `${entry.options.name}（Cordis 状态 ${entry.fiber?.state ?? "缺失"}${detail}）`;
      }));
      throw new Error(`插件未就绪：${diagnostics.join("、")}`);
    }
    let shutdownPromise: Promise<void> | undefined;
    /** 退出前先让 Agent 循环停止派发新步骤，并在宽限期内等待活动 Run 收尾；不取消已在执行的工具。 */
    const agentShutdownGrace = Number(process.env.LFAA_SHUTDOWN_RUN_GRACE_MS ?? 15_000);
    const shutdown = () => {
      shutdownPromise ??= (async () => {
        const loop = (context as unknown as { lfaaAgentLoop?: { prepareShutdown?: (milliseconds: number) => Promise<unknown> } }).lfaaAgentLoop;
        if (loop?.prepareShutdown) {
          try {
            const result = await loop.prepareShutdown(Number.isFinite(agentShutdownGrace) ? Math.max(0, agentShutdownGrace) : 15_000);
            if (result && typeof result === "object" && (result as { timedOut?: unknown }).timedOut === true) {
              console.warn("LFAA 退出等待已达到宽限期，仍有活动 Agent Run；未取消的步骤按会话记录保持真实状态。");
            }
          } catch (error) {
            console.warn("LFAA 退出前的 Agent 收尾失败；继续执行既有卸载流程。", error);
          }
        }
        await context.fiber.dispose().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
      })();
      return shutdownPromise;
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
    const onMessage = (message: unknown) => {
      if (typeof message === "object" && message !== null && "type" in message && message.type === "lfaa-shutdown") {
        void shutdown().then(() => { if (process.connected) process.disconnect(); });
      }
    };
    process.on("message", onMessage);
    const shutdownInput = process.env.LFAA_DESKTOP_SHUTDOWN_STDIN === "1"
      ? createInterface({ input: process.stdin, crlfDelay: Infinity, terminal: false })
      : undefined;
    shutdownInput?.on("line", line => {
      if (line.trim() !== '{"type":"lfaa-shutdown"}') return;
      shutdownInput.close();
      process.stdin.pause();
      void shutdown();
    });
    context.effect(() => () => { shutdownInput?.close(); process.off("SIGINT", shutdown); process.off("SIGTERM", shutdown); process.off("message", onMessage); });
    return context;
  } catch (error) {
    await context.fiber.dispose();
    throw error;
  }
}
