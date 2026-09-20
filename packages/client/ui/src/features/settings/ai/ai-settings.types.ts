/**
 * 文件：ai-settings.types.ts
 * 作用：定义 AI 设置 UI 的纯 ViewModel/交互契约。
 * 负责：Provider、认证、账户、官方模型能力、模型配置、探测结果和 UI 回调结构。
 * 不负责：Config System 类型复用、厂商网络请求、Secret 持久化、Host 实现。
 * 状态归属：类型契约，无运行时状态。
 * 对外接口：AiSettingsProviderView、AiSettingsPageProps 等。
 * 关联文件：AiSettingsPanel.tsx、packages/client/app-shell/src/workbench/settings/view/SettingsPage.tsx。
 * 修改注意事项：Secret 只允许作为瞬时用户输入传给回调；模型参数只渲染 Host 提供的官方 Capability。
 */
export type AiSettingsModelSettingValue = string | number | boolean;
export interface AiSettingsOptionView { value: string; label: string; }
export interface AiSettingsFieldView {
  id: string; label: string; kind: "text" | "select"; required: boolean;
  defaultValue?: string; placeholder?: string; options?: readonly AiSettingsOptionView[]; help?: string;
}
export interface AiSettingsAuthView {
  id: string; label: string; kind: "api-key" | "subscription" | "token-plan";
  description?: string; secretLabel?: string; available: boolean; unavailableReason?: string;
}
export interface AiSettingsProviderView { id: string; name: string; description: string; authMethods: readonly AiSettingsAuthView[]; fields: readonly AiSettingsFieldView[]; }
export interface AiSettingsModelSettingView {
  id: string;
  label: string;
  kind: "select" | "boolean" | "integer";
  requestPath: string;
  defaultValue?: AiSettingsModelSettingValue;
  options?: readonly AiSettingsOptionView[];
  min?: number;
  max?: number;
  step?: number;
  help?: string;
}
export interface AiSettingsModelCapabilityView {
  source: { kind: "runtime-model-api" | "official-docs"; label: string; url: string; checkedAt: string };
  contextWindow?: number;
  maxOutputTokens?: number;
  inputModalities?: readonly ("text" | "image" | "audio" | "video")[];
  supportsTools?: boolean;
  supportsStructuredOutput?: boolean;
  settings: readonly AiSettingsModelSettingView[];
  notes?: readonly string[];
}
export interface AiSettingsModelView {
  id: string; name?: string; ownedBy?: string; contextWindow?: number; maxOutputTokens?: number;
  discoverySource?: { kind: "runtime-model-api" | "official-docs"; label: string; url: string; checkedAt: string };
  capabilities?: AiSettingsModelCapabilityView;
}
export interface AiSettingsAccountView {
  id: string; providerId: string; displayName: string; authMethodId: string; selectedModelId: string | null;
  modelSettings: Readonly<Record<string, AiSettingsModelSettingValue>>;
  modelCatalog: readonly AiSettingsModelView[];
  verificationStatus: "connected" | "unverified" | "error"; lastVerifiedAt: string | null;
}
export interface AiSettingsDraftInput {
  accountId?: string; providerId: string; displayName: string; authMethodId: string;
  settings: Readonly<Record<string, string>>; selectedModelId?: string | null;
  modelSettings?: Readonly<Record<string, AiSettingsModelSettingValue>>;
}
export interface AiSettingsProbeView { status: "connected" | "unverified"; message: string; models: readonly AiSettingsModelView[]; manualModelEntry?: boolean; resolvedBaseUrl?: string; }
export interface AiSettingsPageProps {
  providers: readonly AiSettingsProviderView[]; selectedProviderId: string; accounts: readonly AiSettingsAccountView[];
  activeModel: { accountId: string; providerId: string; modelId: string } | null;
  secretPersistence: "os-credential-store" | "memory" | "unavailable"; hostAvailable: boolean;
  onSelectProvider(id: string): void;
  onProbe(draft: AiSettingsDraftInput, secret: string): Promise<AiSettingsProbeView>;
  onSave(draft: AiSettingsDraftInput, secret: string): Promise<AiSettingsProbeView>;
  onConnectSubscription(draft: AiSettingsDraftInput): Promise<AiSettingsProbeView>;
  onReprobe(accountId: string): Promise<AiSettingsProbeView>;
  onDeleteAccount(accountId: string): Promise<void>;
  onSelectAccountModel(accountId: string, modelId: string, modelSettings: Readonly<Record<string, AiSettingsModelSettingValue>>): Promise<void>;
  onActivateAccountModel(accountId: string): Promise<void>;
  onClose(): void;
}
