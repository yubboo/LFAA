/**
 * 文件：ai-settings.types.ts
 * 作用：定义 AI 设置 UI 的纯 ViewModel/Props 契约。
 * 负责：Provider 卡片、认证选项、配置字段的展示结构。
 * 不负责：Config System 类型复用、网络请求、Secret、持久化。
 * 状态归属：类型契约，无运行时状态。
 * 对外接口：AiSettingsProviderView、AiSettingsPageProps 等。
 * 关联文件：AiSettingsPage.tsx。
 * 修改注意事项：保持 UI 与 config-system 解耦，由 app-shell/controller 做结构映射。
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
}
export interface AiSettingsProviderView {
  id: string;
  name: string;
  description: string;
  authMethods: readonly AiSettingsAuthView[];
  fields: readonly AiSettingsFieldView[];
}
export interface AiSettingsPageProps {
  providers: readonly AiSettingsProviderView[];
  selectedProviderId: string;
  onSelectProvider(id: string): void;
  onClose(): void;
}
