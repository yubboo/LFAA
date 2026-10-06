/**
 * 功能：把插件的 Typert 方法贡献接入 Cordis 生命周期。
 * 作用：提供必需的贡献加载服务和可复用插件包装器，卸载贡献插件时由注册表撤销其方法。
 * 关联文件：packages/typert/protocol/src/index.ts、packages/typert/registry/src/index.ts、packages/bundle/base。
 */
import { Service, type Context } from "@deepseek-ai/cordis";
import type { TypertContribution } from "lfaa-typert-protocol/src/index.js";
import type { TypertRegistry } from "lfaa-typert-registry/src/index.js";

export const name = "lfaaTypertLoader";
export const inject = ["lfaaTypertRegistry"];
export interface TypertContributionLoader { register(owner: Context, contribution: TypertContribution): void }

declare module "@deepseek-ai/cordis" { interface Context { lfaaTypertLoader: TypertContributionLoader } }

/** 插件装配后负责把贡献交给注册表；登记所有权仍绑定贡献插件的 Context。 */
export default class TypertContributionLoaderService extends Service implements TypertContributionLoader {
  static readonly inject = inject;
  private readonly registry: TypertRegistry;
  constructor(ctx: Context) { super(ctx, name); this.registry = ctx.lfaaTypertRegistry; }
  register(owner: Context, contribution: TypertContribution): void { this.registry.register(owner, contribution); }
}

/** 为声明型插件贡献生成随其 Fiber 自动撤销的 Cordis 插件入口。 */
export function createTypertContributionPlugin(contribution: TypertContribution): (ctx: Context) => void {
  const plugin = (ctx: Context): void => { ctx.lfaaTypertLoader.register(ctx, contribution); };
  Object.defineProperties(plugin, {
    name: { value: `lfaaTypertContribution:${contribution.package}`, configurable: true },
    inject: { value: ["lfaaTypertLoader"], enumerable: true }
  });
  return plugin;
}
