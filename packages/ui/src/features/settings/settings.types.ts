/**
 * 文件：settings.types.ts
 * 作用：定义共享 Settings Surface 的纯 UI 契约。
 * 负责：设置分类、主题偏好、AI ViewModel 注入类型。
 * 不负责：Config 真值、Provider 网络请求、宿主路由实现。
 */
import type { ThemePreference } from "../appearance/ThemeModeMenu";
import type { AiSettingsProviderView } from "./ai/ai-settings.types";

export type SettingsSectionId = "general" | "appearance" | "ai" | "permissions" | "workspace" | "developer";

export interface SettingsPageProps {
  activeSection: SettingsSectionId;
  onSectionChange: (section: SettingsSectionId) => void;
  onClose: () => void;
  themePreference: ThemePreference;
  onThemePreferenceChange: (value: ThemePreference) => void;
  aiProviders: readonly AiSettingsProviderView[];
  selectedAiProviderId: string;
  onSelectAiProvider: (providerId: string) => void;
}
