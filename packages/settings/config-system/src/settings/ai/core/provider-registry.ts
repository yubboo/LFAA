/**
 * 文件：provider-registry.ts
 * 作用：提供无厂商分支的 AI Provider 插件注册表。
 * 负责：注册、唯一性校验、按 ID 查询、只读列表输出。
 * 不负责：Provider 具体配置、网络请求、Secret、UI。
 * 状态归属：AiProviderRegistry 实例拥有插件 Map；builtinAiProviderRegistry 是内置只读基线。
 * 对外接口：AiProviderRegistry、createAiProviderRegistry。
 * 关联文件：provider.types.ts、../providers/index.ts。
 * 修改注意事项：新增 Provider 通过 register 扩展，不允许在 Registry 内增加厂商 if/switch。
 */
import type { AiProviderId, AiProviderPlugin } from "./provider.types.ts";

export class AiProviderRegistry {
  readonly #plugins = new Map<AiProviderId, AiProviderPlugin>();

  constructor(initial: readonly AiProviderPlugin[] = []) {
    for (const plugin of initial) this.register(plugin);
  }

  register(plugin: AiProviderPlugin): void {
    if (this.#plugins.has(plugin.id)) {
      throw new Error(`AI Provider 已注册：${plugin.id}`);
    }
    this.#plugins.set(plugin.id, plugin);
  }

  get(id: AiProviderId): AiProviderPlugin {
    const plugin = this.#plugins.get(id);
    if (!plugin) throw new Error(`未知 AI Provider：${id}`);
    return plugin;
  }

  list(): readonly AiProviderPlugin[] {
    return [...this.#plugins.values()];
  }
}

export function createAiProviderRegistry(plugins: readonly AiProviderPlugin[]): AiProviderRegistry {
  return new AiProviderRegistry(plugins);
}
