/**
 * 模块：@lfaa/plugin-sdk
 * 作用：LFAA Native Plugin、外部生态 Adapter 与 App Pack 的公共 SDK。
 * 负责：只导出稳定插件/能力协议，不拥有运行时注册状态。
 * 不负责：执行 Tool、加载进程、修改权限、访问 OS。
 */
export { LFAA_PLUGIN_API_VERSION } from "./contracts.ts";
export type {
  LfaaAppPackComposition,
  LfaaAppPackDescriptor,
  LfaaCapabilityDescriptor,
  LfaaCapabilityEffect,
  LfaaCapabilityKind,
  LfaaCapabilitySource,
  LfaaExtensionBag,
  LfaaCredentialExposure,
  LfaaCredentialKind,
  LfaaCredentialRequirement,
  LfaaExternalAdapter,
  LfaaPermissionRequirement,
  LfaaPluginManifest,
  LfaaPluginRequirement,
  LfaaSurface,
  PluginJsonPrimitive,
  PluginJsonValue,
} from "./contracts.ts";
