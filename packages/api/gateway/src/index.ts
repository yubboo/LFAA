/**
 * 功能：提供可组合的 HTTP 路由服务。
 * 作用：控制器插件登记自己的路由，卸载时从已创建的 Router 中撤销对应路由层。
 * 关联文件：各 api 控制器、host/webserver、health-controller.ts。
 */
import { Context, Service } from "@deepseek-ai/cordis";
import { Router } from "express";
import type { AiPluginHost } from "lfaa-app-boot/src/ai-host.js";
import type { MinecraftRealtimePublisher } from "lfaa-api-remotes/src/socket-server.js";
import type { TypertRegistry } from "lfaa-typert-registry/src/index.js";
import { registerRoutes as registerHealth } from "./health-controller.js";
import { registerTypertRoutes } from "./typert-controller.js";
export type RouteContributor = (router: Router, aiHost: AiPluginHost, realtime: MinecraftRealtimePublisher) => void;
interface MountedRouter { router: Router; aiHost: AiPluginHost; realtime: MinecraftRealtimePublisher; layers: Map<string, Router> }
export class ApiGateway extends Service {
  private readonly contributors = new Map<string, RouteContributor>();
  private readonly mounted = new Set<MountedRouter>();
  constructor(ctx: Context) { super(ctx, "apiGateway"); }
  register(owner: Context, name: string, contributor: RouteContributor): void {
    owner.effect(() => {
      if (this.contributors.has(name)) throw new Error(`HTTP 控制器重复登记：${name}`);
      this.contributors.set(name, contributor);
      for (const mounted of this.mounted) this.mount(mounted, name, contributor);
      return () => {
        this.contributors.delete(name);
        for (const mounted of this.mounted) {
          const layer = mounted.layers.get(name);
          // Express 4 没有移除路由 API，按本插件创建的子 Router 身份撤销，保留其他层顺序。
          mounted.router.stack = mounted.router.stack.filter((entry: { handle: unknown }) => entry.handle !== layer);
          mounted.layers.delete(name);
        }
      };
    });
  }
  private mount(mounted: MountedRouter, name: string, contributor: RouteContributor): void {
    const layer = Router();
    contributor(layer, mounted.aiHost, mounted.realtime);
    mounted.layers.set(name, layer);
    mounted.router.use(layer);
  }
  createRouter(owner: Context, aiHost: AiPluginHost, realtime: MinecraftRealtimePublisher): Router {
    const mounted: MountedRouter = { router: Router(), aiHost, realtime, layers: new Map() };
    for (const [name, contributor] of this.contributors) this.mount(mounted, name, contributor);
    owner.effect(() => { this.mounted.add(mounted); return () => { this.mounted.delete(mounted); }; });
    return mounted.router;
  }
}
declare module "@deepseek-ai/cordis" { interface Context { apiGateway: ApiGateway } }
export const inject = ["lfaaTypertRegistry"];
export function apply(ctx: Context): void {
  const gateway = new ApiGateway(ctx);
  gateway.register(ctx, "health", registerHealth);
  gateway.register(ctx, "typert", (router) => registerTypertRoutes(router, ctx.lfaaTypertRegistry as TypertRegistry));
}
