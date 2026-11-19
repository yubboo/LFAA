// 参考 DSH @deepseek-ai/dsh-browser-use 的独占命名注册槽位，确保同一时刻仅有一个浏览器实现注册并受 Cordis 生命周期托管。
import { type Context, Service } from "@deepseek-ai/cordis";

/** 独占浏览器驱动注册表，挂接于 Cordis `browserUse`。 */
export class BrowserUseRegistry extends Service {
  private registration: string | undefined;

  constructor(ctx: Context) {
    super(ctx, "browserUse");
  }

  get providerName(): string | undefined {
    return this.registration;
  }

  register(name: string): () => void {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("浏览器提供者名称不能为空。");
    if (this.registration !== undefined) {
      throw new Error(`浏览器驱动 "${this.registration}" 已注册，同一实例仅允许激活一个驱动。`);
    }
    this.registration = trimmed;
    const dispose = this.ctx.effect(() => () => {
      if (this.registration === trimmed) {
        this.registration = undefined;
      }
    });
    return () => {
      dispose();
    };
  }
}

export function browserUseRegistryPlugin(ctx: Context): void {
  new BrowserUseRegistry(ctx);
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    browserUse: BrowserUseRegistry;
  }
}
