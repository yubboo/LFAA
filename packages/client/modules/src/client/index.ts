/** 功能：提供浏览器模块登记服务。作用：按包加载界面并在插件卸载时撤销登记。关联文件：各 ui 包的 client/index.ts、client/web。 */
import { Context, Service } from "@deepseek-ai/cordis";
import Loader from "@deepseek-ai/cordis-plugin-loader";
import * as Cordis from "@deepseek-ai/cordis";
import * as React from "react";
import * as ReactJsxRuntime from "react/jsx-runtime";
import * as ReactDom from "react-dom";
import * as ReactDomClient from "react-dom/client";
import * as ClientStore from "@deepseek-ai/dsh-client-store";
import * as UiSlots from "@deepseek-ai/dsh-client-ui-slots";
import * as UiPrimitives from "@deepseek-ai/dsh-client-ui-primitives";
import * as UiDockkit from "@deepseek-ai/dsh-client-ui-dockkit";
import type { DshWindow, ClientModuleLoader } from "@deepseek-ai/dsh-client-modules/client";
import { installLfaaDshSessionScope } from "./session-scope.js";
import { syncClientModuleGraphForAuthentication, type ClientModuleAuthState } from "./auth-sync.js";
import { initializeStaleChunkRecovery, loadClientModuleWithRecovery } from "./stale-chunk-recovery.js";
export { DshSlotOutlet, DshSlotRoot, useDshSlotRenderer } from "./slots.js";

interface DshEntriesSync { sync(graph: unknown): Promise<void> }
interface DshModuleRuntime extends ClientModuleLoader { entries: ClientModuleLoader["entries"] & DshEntriesSync }
interface DshAuthRuntime extends ClientModuleAuthState {
  readonly rawSync: (graph: unknown) => Promise<void>;
}
let dshAuthRuntime: DshAuthRuntime | undefined;
export class ClientModules extends Service {
  private readonly modules = new Map<string, () => Promise<unknown>>();
  constructor(ctx: Context) { super(ctx, "clientModules"); }
  register(owner: Context, id: string, load: () => Promise<unknown>): void {
    owner.effect(() => {
      if (this.modules.has(id)) throw new Error(`浏览器模块重复登记：${id}`);
      this.modules.set(id, load);
      return () => { this.modules.delete(id); };
    });
  }
  async load<T>(id: string): Promise<T> {
    const load = this.modules.get(id);
    if (!load) throw new Error(`浏览器模块未装配：${id}`);
    return await load() as T;
  }
}
declare module "@deepseek-ai/cordis" { interface Context { clientModules: ClientModules } }
let active: ClientModules | undefined;
export function apply(ctx: Context): void {
  initializeStaleChunkRecovery();
  active = new ClientModules(ctx);
  ctx.effect(() => () => { active = undefined; });
}
export function loadClientModule<T>(id: string): Promise<T> {
  if (!active) return Promise.reject(new Error("浏览器 Harness 尚未就绪。"));
  return loadClientModuleWithRecovery(() => active!.load<T>(id));
}

/**
 * Launch the upstream DSH client graph inside LFAA's existing browser Context.
 * The official ClientModuleSystem owns bundle registration, graph order,
 * lazy arrival and revision invalidation; this bridge supplies its platform
 * seed and reuses Cordis Loader without taking over LFAA's React root.
 */
export async function bootDshClientModules(context: Context): Promise<ClientModuleLoader> {
  const dshWindow = window as unknown as DshWindow;
  const target = dshWindow.__ModuleLoader__;
  if (!target || dshWindow.__DSH_BOOT__ === undefined) {
    throw new Error("DSH 启动图缺失；请确认 Web Host 已注入 DSH Client Runtime。");
  }

  const staticModules = {
    "react": React,
    "react/jsx-runtime": ReactJsxRuntime,
    "react-dom": ReactDom,
    "react-dom/client": ReactDomClient,
    "@deepseek-ai/cordis": Cordis,
    "@deepseek-ai/dsh-client-store": ClientStore,
    "@deepseek-ai/dsh-client-ui-slots": UiSlots,
    "@deepseek-ai/dsh-client-ui-primitives": UiPrimitives,
    "@deepseek-ai/dsh-client-ui-dockkit": UiDockkit
  };
  const fullGraph = dshWindow.__DSH_BOOT__;
  const modules = target.create({ boot: graphWithoutWallpaperEngine(fullGraph), staticModules }) as DshModuleRuntime;
  const rawSync = modules.entries.sync.bind(modules.entries);
  const authRuntime: DshAuthRuntime = {
    rawSync,
    graph: fullGraph,
    authenticated: false,
    appliedAuthentication: null,
    pending: null,
    revision: 0
  };
  modules.entries.sync = (graph: unknown) => {
    authRuntime.graph = graph;
    return rawSync(authRuntime.authenticated ? graph : graphWithoutWallpaperEngine(graph));
  };
  dshAuthRuntime = authRuntime;
  context.effect(() => () => {
    if (dshAuthRuntime === authRuntime) dshAuthRuntime = undefined;
  });

  await context.plugin(Loader);
  context.loader.internal = modules as unknown as typeof context.loader.internal;
  await modules.entries.start(context.loader, modules.manifest);
  authRuntime.appliedAuthentication = false;
  installLfaaDshSessionScope(context);

  const expected = new Set(modules.manifest.plugins.map((entry) => entry.id));
  const entries = [...context.loader.entries()].filter((entry) => expected.has(entry.options.name));
  const failed = entries.filter((entry) => entry.fiber?.state !== 2 /* FiberState.ACTIVE in the upstream DSH/Cordis contract. */);
  if (entries.length !== expected.size || failed.length > 0) {
    const details = failed.map((entry) => `${entry.options.name}: ${entry.fiber?.state ?? "no fiber"}`);
    throw new Error(`DSH Client Runtime 未全部就绪：${details.join("；") || "Host 启动图与浏览器条目数不一致。"}`);
  }
  return modules;
}

/** Keep the upstream plugin unloaded until LFAA has restored a real account session. */
export async function syncDshClientModulesForAuthentication(authenticated: boolean): Promise<void> {
  const runtime = dshAuthRuntime;
  if (!runtime) return;
  await syncClientModuleGraphForAuthentication(runtime, authenticated, {
    async loadAuthenticatedGraph() {
      const response = await fetch("/__dsh/index-injections", { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error(`DSH Host 启动图读取失败（HTTP ${response.status}）。`);
      const injections = await response.json() as Array<{ kind?: string; name?: string; value?: unknown }>;
      const graph = injections.find((row) => row.kind === "global" && row.name === "__DSH_BOOT__")?.value;
      if (!graph) throw new Error("DSH Host 未返回有效的 Client Module 启动图。");
      return graph;
    },
    filterUnauthenticatedGraph: graphWithoutWallpaperEngine,
    applyGraph: (graph) => runtime.rawSync(graph)
  });
}

function graphWithoutWallpaperEngine(graph: unknown): unknown {
  if (typeof graph !== "object" || graph === null || !Array.isArray((graph as { entries?: unknown }).entries)
    || !Array.isArray((graph as { batches?: unknown }).batches)) return graph;
  const source = graph as { entries: Array<Record<string, unknown>>; batches: Array<Record<string, unknown>> };
  const entries = source.entries.filter((entry) => entry.id !== "dsh-plugin-wallpaper-engine");
  const batches = source.batches.flatMap((batch) => {
    if (!Array.isArray(batch.entries)) return [batch];
    const selected = batch.entries.filter((id): id is string => typeof id === "string" && id !== "dsh-plugin-wallpaper-engine");
    return selected.length ? [{ ...batch, entries: selected }] : [];
  });
  return { ...graph, entries, batches };
}
