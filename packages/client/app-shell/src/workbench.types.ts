/**
 * 文件：workbench.types.ts
 * 作用：定义共享工作台壳对宿主暴露的最小数据契约。
 * 负责：能力资源投影、终端插槽与 Host Client 契约。
 * 不负责：UI 布局、Secret 实现、Provider HTTP、宿主持久化细节。
 * 状态归属：类型契约，无运行时状态。
 * 对外接口：AgentWorkbenchProps、AgentAiSettingsHost、DevResourceItem、ResourceKind。
 * 关联文件：AgentWorkbench.tsx、packages/client/web/src/App.tsx、packages/client/connection/src/ai-settings-client.ts。
 * 修改注意事项：Host Client 只能暴露业务结果，不能泄漏 Vite/Node/Secret 明文存储细节。
 */
import type { ReactNode } from "react";
import type { AgentRuntimeHost } from "@lfaa/agent-runtime";
import type { PluginInstallOutcome, PluginManagerSnapshot, PluginSpecInspection } from "@lfaa/plugin-runtime";
import type { AiAccountDraft, AiAccountProbeResult, AiAccountSnapshot, AiAccountUsageSnapshot, AiModelSettingValue } from "@lfaa/config-system";
import type { WorkspaceSessionHost } from "@lfaa/session";
import type { CreateIdentityRoleInput, CreateIdentityUserInput, LfaaIdentitySnapshot, UpdateIdentityRoleInput, UpdateIdentityUserInput } from "@lfaa/identity";

export type ResourceKind = "skills" | "experts" | "plugins" | "extensions" | "mcp";

export interface DevResourceItem {
  kind: ResourceKind;
  name: string;
  relativePath: string;
  entryType: "file" | "directory";
  updatedAt: number;
}

export interface AgentAiSettingsHost {
  snapshot(): Promise<AiAccountSnapshot>;
  probe(draft: AiAccountDraft, secret: string): Promise<AiAccountProbeResult>;
  save(draft: AiAccountDraft, secret: string): Promise<{ probe: AiAccountProbeResult; snapshot: AiAccountSnapshot }>;
  connectSubscription(draft: AiAccountDraft): Promise<{ probe: AiAccountProbeResult; snapshot: AiAccountSnapshot }>;
  usage(accountId: string): Promise<AiAccountUsageSnapshot>;
  reprobe(accountId: string): Promise<{ probe: AiAccountProbeResult; snapshot: AiAccountSnapshot }>;
  deleteAccount(accountId: string): Promise<AiAccountSnapshot>;
  selectModel(accountId: string, modelId: string, modelSettings: Readonly<Record<string, AiModelSettingValue>>): Promise<AiAccountSnapshot>;
  /** Composer 日常切换使用缓存模型目录，不重新访问 Provider。 */
  setActiveModel(accountId: string, modelId: string, modelSettings: Readonly<Record<string, AiModelSettingValue>>): Promise<AiAccountSnapshot>;
  activateModel(accountId: string): Promise<AiAccountSnapshot>;
}


export interface AgentPluginSettingsHost {
  snapshot(): Promise<PluginManagerSnapshot>;
  inspect(spec: string): Promise<PluginSpecInspection>;
  install(spec: string, requestId: string, approvedBuilds?: readonly string[]): Promise<{ outcome: PluginInstallOutcome; snapshot: PluginManagerSnapshot }>;
  setEnabled(packageName: string, enabled: boolean): Promise<PluginManagerSnapshot>;
  remove(packageName: string): Promise<PluginManagerSnapshot>;
  cancel(requestId: string): Promise<void>;
}



export interface AgentIdentitySettingsHost {
  snapshot(): Promise<LfaaIdentitySnapshot>;
  createUser(input: CreateIdentityUserInput): Promise<LfaaIdentitySnapshot>;
  updateUser(userId: string, input: UpdateIdentityUserInput): Promise<LfaaIdentitySnapshot>;
  createRole(input: CreateIdentityRoleInput): Promise<LfaaIdentitySnapshot>;
  updateRole(roleId: string, input: UpdateIdentityRoleInput): Promise<LfaaIdentitySnapshot>;
  deleteRole(roleId: string): Promise<LfaaIdentitySnapshot>;
}

export interface AgentIdentityProjection {
  readonly displayName: string;
  readonly subtitle: string;
  /** 仅用于 UI 可见性投影；Host 仍是授权真值。 */
  readonly permissions: readonly string[];
}

export interface AgentWorkbenchProps {
  resources?: readonly DevResourceItem[];
  resourceBridgeStatus?: "connected" | "refreshing" | "offline";
  terminal?: ReactNode;
  aiSettingsHost?: AgentAiSettingsHost;
  /** 插件安装/启用/移除统一 Host；Web/CLI/Agent 都应最终复用同一 PluginManager。 */
  pluginSettingsHost?: AgentPluginSettingsHost;
  /** 统一 Agent Runtime Host；Chat / Work 共用，未提供时 UI 不伪造执行结果。 */
  agentRuntimeHost?: AgentRuntimeHost;
  /** Chat / Work / Manual 共用的正式 Session Host；负责刷新恢复与最近会话。 */
  sessionHost?: WorkspaceSessionHost;
  /** Runtime 使用的工作区稳定 ID；不是本机绝对路径。 */
  workspaceId?: string;
  /** Identity 用户/角色管理 Host；设置页只通过此端口访问身份域。 */
  identitySettingsHost?: AgentIdentitySettingsHost;
  /** Smart Home 进入 Workbench 时的一次性 Composer 初始草稿；只属于 UI handoff，不自动启动 Run。 */
  initialComposerDraft?: string;
  /** 当前已通过 Identity Gate 的用户投影；只给 Shell 展示，不承担授权。 */
  identity?: AgentIdentityProjection;
  /** 返回登录后的 App Hub。 */
  onOpenAppHub?: () => void;
  /** 退出当前 AuthSession。 */
  onLogout?: () => void;
}
