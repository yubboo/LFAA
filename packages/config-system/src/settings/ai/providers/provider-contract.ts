/**
 * 文件：provider-contract.ts
 * 作用：为各 Provider 子目录提供稳定的父级插件契约入口，避免跨越多层目录直接引用 AI Core。
 * 负责：从 AI Core 重新导出 Provider 插件所需公共类型。
 * 不负责：Provider 注册、网络请求、认证执行、Secret 存储。
 * 状态归属：无运行时状态。
 * 对外接口：AiProviderPlugin 等 Provider 公共类型。
 * 关联文件：../core/provider.types.ts、./index.ts。
 * 修改注意事项：这里只允许重导出公共契约，不得加入厂商分支或业务实现。
 */
export type {
  AiAuthKind,
  AiAuthMethod,
  AiConfigField,
  AiConfigFieldKind,
  AiConfigOption,
  AiModelDiscovery,
  AiProviderId,
  AiProviderPlugin,
  AiProviderProtocol,
  AiProviderResolveInput,
  AiResolvedConnection
} from "../core/provider.types.ts";
