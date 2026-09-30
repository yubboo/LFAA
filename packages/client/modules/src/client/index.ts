/** 功能：提供浏览器模块登记服务。作用：按包加载界面并在插件卸载时撤销登记。关联文件：各 ui 包的 client/index.ts、client/web。 */
import { Context, Service } from "@deepseek-ai/cordis";
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
  active = new ClientModules(ctx);
  ctx.effect(() => () => { active = undefined; });
}
export function loadClientModule<T>(id: string): Promise<T> {
  if (!active) return Promise.reject(new Error("浏览器 Harness 尚未就绪。"));
  return active.load<T>(id);
}
