/**
 * 文件：ai-settings.types.ts
 * 作用：定义 AI 设置 UI 的纯 ViewModel/交互契约。
 * 负责：Provider、认证、账户、模型、探测结果和 UI 回调结构。
 * 不负责：Config System 类型复用、厂商网络请求、Secret 持久化、Host 实现。
 * 状态归属：类型契约，无运行时状态。
 * 对外接口：AiSettingsProviderView、AiSettingsPageProps 等。
 * 关联文件：AiSettingsPanel.tsx、SettingsPage.tsx。
 * 修改注意事项：Secret 只允许作为瞬时用户输入传给回调，禁止进入 SavedAccount View 或持久状态。
 */
export interface AiSettingsOptionView { value: string; label: string; }
export interface AiSettingsFieldView {
  id: string;
  label: string;
  kind: "text" | "select";
  required: boolean;
  defaultValue?: string;
  placeholder?: string;
  options?: readonly AiSettingsOptionView[];
  help?: string;
}
export interface AiSettingsAuthView {
  id: string;
  label: string;
  kind: "api-key" | "subscription" | "token-plan";
  description?: string;
  secretLabel?: string;
  available: boolean;
  unavailableReason?: string;
}
export interface AiSettingsProviderView {
  id: string;
  name: string;
  description: string;
  authMethods: readonly AiSettingsAuthView[];
  fields: readonly AiSettingsFieldView[];
}
export interface AiSettingsModelView {
  id: string;
  name?: string;
  ownedBy?: string;
  contextWindow?: number;
  maxOutputTokens?: number;
}
export interface AiSettingsAccountView {
  id: string;
  providerId: string;
  displayName: string;
  authMethodId: string;
  selectedModelId: string | null;
  verificationStatus: "connected" | "unverified" | "error";
  lastVerifiedAt: string | null;
}
export interface AiSettingsDraftInput {
  accountId?: string;
  providerId: string;
  displayName: string;
  authMethodId: string;
  settings: Readonly<Record<string, string>>;
  selectedModelId?: string | null;
}
export interface AiSettingsProbeView {
  status: "connected" | "unverified";
  message: string;
  models: readonly AiSettingsModelView[];
  resolvedBaseUrl?: string;
}
export interface AiSettingsPageProps {
  providers: readonly AiSettingsProviderView[];
  selectedProviderId: string;
  accounts: readonly AiSettingsAccountView[];
  secretPersistence: "os-credential-store" | "memory" | "unavailable";
  hostAvailable: boolean;
  onSelectProvider(id: string): void;
  onProbe(draft: AiSettingsDraftInput, secret: string): Promise<AiSettingsProbeView>;
  onSave(draft: AiSettingsDraftInput, secret: string): Promise<AiSettingsProbeView>;
  onReprobe(accountId: string): Promise<AiSettingsProbeView>;
  onDeleteAccount(accountId: string): Promise<void>;
  onSelectAccountModel(accountId: string, modelId: string): Promise<void>;
  onClose(): void;
}
