/**
 * 文件：index.ts
 * 作用：AI 配置子域公开入口。
 * 负责：导出 Provider 契约、Registry、共享协议工具和内置 Provider 列表。
 * 不负责：UI、宿主 Adapter、Secret 实现、推理 Runtime。
 * 状态归属：无额外状态。
 * 对外接口：本文件 exports。
 * 关联文件：core/*、providers/index.ts、transports/*。
 * 修改注意事项：外部只能从本入口或 @lfaa/config-system 根入口导入稳定 API。
 */
export * from "./core/provider.types.ts";
export * from "./core/provider-registry.ts";
export * from "./transports/openai-compatible.ts";
export * from "./providers/index.ts";

export * from "./core/account.types.ts";
export * from "./core/host-ports.ts";
export * from "./core/account-service.ts";
export * from "./transports/qwen-model-list.ts";
