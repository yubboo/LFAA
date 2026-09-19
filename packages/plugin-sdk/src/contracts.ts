/**
 * 文件：contracts.ts
 * 作用：定义 LFAA 插件生态唯一公共词汇表，供 Native Plugin、外部生态 Adapter、App Pack 与 Agent Runtime 共享。
 * 负责：Plugin Manifest、Capability Descriptor、App Pack 组合、权限需求、扩展命名空间。
 * 不负责：插件加载、文件监听、能力执行、权限判定、UI 渲染。
 * 状态归属：纯协议；运行时注册事实由 @lfaa/plugin-runtime 拥有。
 * 修改注意事项：公共字段必须保持向后兼容；平台专有能力进入 extensions，禁止为了统一而删除上游能力。
 */


/** 当前 LFAA 原生插件 API 主版本；Registry 只加载完全匹配的 Manifest，兼容迁移由 Adapter/升级器负责。 */
export const LFAA_PLUGIN_API_VERSION = 2 as const;

export type PluginJsonPrimitive = string | number | boolean | null;
export type PluginJsonValue = PluginJsonPrimitive | readonly PluginJsonValue[] | { readonly [key: string]: PluginJsonValue };

export type LfaaSurface = "chat" | "work" | "automation";

/**
 * Capability 是“Agent 可以发现或宿主可以组合的能力”，不是只等于 Tool。
 * 新能力种类应优先扩展这里，而不是让 Core 按具体插件 ID 写分支。
 */
export type LfaaCapabilityKind =
  | "tool"
  | "skill"
  | "expert"
  | "agent"
  | "subagent-provider"
  | "command"
  | "workflow"
  | "mcp"
  | "model-provider"
  | "harness-adapter"
  | "workbench-node"
  | "artifact-renderer"
  | "ui-extension"
  | "app-pack";

export type LfaaCapabilityEffect = "read" | "write" | "execute" | "external" | "compose";


export type LfaaCredentialKind = "api-key" | "oauth-grant" | "token" | "certificate" | "other";
export type LfaaCredentialExposure = "host-mediated" | "isolated-process";

/**
 * 插件只声明“需要什么凭据”，绝不能把凭据值写进 Manifest。
 * host-mediated 表示插件只请求宿主代办认证；isolated-process 表示未来隔离子进程确实需要临时注入。
 */
export interface LfaaCredentialRequirement {
  readonly id: string;
  readonly displayName: string;
  readonly kind: LfaaCredentialKind;
  readonly purpose: string;
  readonly exposure: LfaaCredentialExposure;
  readonly optional?: boolean;
}
export type LfaaCapabilitySource =
  | "lfaa-core"
  | "lfaa-official"
  | "project"
  | "third-party"
  | "official-harness"
  | "external-platform";

export interface LfaaPermissionRequirement {
  /** 稳定的底层 capability 名称，例如 fs.read / process.spawn / network.connect。 */
  readonly capability: string;
  /** 可选资源范围；最终仍由 Policy / Permission / Rust Broker 重新校验。 */
  readonly scope?: string;
  readonly optional?: boolean;
}

/**
 * 上游平台专有字段必须放在命名空间下，例如：
 * - "openai.codex"
 * - "deepseek.harness"
 * - "mcp"
 * LFAA 公共层不得把未知扩展丢弃。
 */
export type LfaaExtensionBag = Readonly<Record<string, PluginJsonValue>>;

export interface LfaaCapabilityDescriptor {
  /** 全局稳定 ID，建议使用 namespace/name，例如 lfaa.game-server/install。 */
  readonly id: string;
  readonly kind: LfaaCapabilityKind;
  readonly version: string;
  readonly displayName: string;
  readonly description?: string;
  readonly source: LfaaCapabilitySource;
  readonly effect: LfaaCapabilityEffect;
  readonly surfaces?: readonly LfaaSurface[];
  readonly tags?: readonly string[];
  readonly permissions?: readonly LfaaPermissionRequirement[];
  /** 保留上游高级能力；Adapter 不得为了公共最小集合而静默删除。 */
  readonly extensions?: LfaaExtensionBag;
}

export interface LfaaAppPackComposition {
  /** App Pack 只是能力组合，不拥有第二套 Agent Runtime。 */
  readonly capabilityIds: readonly string[];
  readonly defaultSkillIds?: readonly string[];
  readonly defaultExpertIds?: readonly string[];
  readonly defaultWorkflowIds?: readonly string[];
  readonly defaultWorkbenchNodeIds?: readonly string[];
}

export interface LfaaAppPackDescriptor extends LfaaCapabilityDescriptor {
  readonly kind: "app-pack";
  readonly effect: "compose";
  readonly composition: LfaaAppPackComposition;
}

export interface LfaaPluginRequirement {
  readonly lfaa?: string;
  readonly pluginApi?: number;
  readonly capabilityIds?: readonly string[];
  readonly nativeCapabilities?: readonly string[];
}

export interface LfaaPluginManifest {
  readonly schemaVersion: 1;
  readonly pluginApiVersion: number;
  readonly pluginId: string;
  readonly pluginVersion: string;
  readonly displayName: string;
  readonly description?: string;
  readonly author?: string;
  readonly capabilities: readonly (LfaaCapabilityDescriptor | LfaaAppPackDescriptor)[];
  /** 这里只允许逻辑需求描述；实际绑定只保存 credentialRef，值由 Credential Store 持有。 */
  readonly credentials?: readonly LfaaCredentialRequirement[];
  readonly requires?: LfaaPluginRequirement;
  /** 插件级上游元数据；同样必须命名空间化并无损保留。 */
  readonly extensions?: LfaaExtensionBag;
}

/**
 * Adapter 把外部生态“翻译”为 LFAA Manifest/Capability，而不是复制外部 Runtime。
 * probe 只证明可用性；loadManifest 只返回描述，不直接产生系统副作用。
 */
export interface LfaaExternalAdapter<TProbe = unknown> {
  readonly id: string;
  readonly displayName: string;
  probe(): Promise<TProbe>;
  loadManifest(): Promise<LfaaPluginManifest>;
}
