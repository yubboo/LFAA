/**
 * 文件：settings.types.ts
 * 作用：定义共享 Settings Surface 的纯 UI 契约。
 * 负责：设置分类、主题偏好、AI ViewModel 注入类型。
 * 不负责：Config 真值、Provider 网络请求、宿主路由实现。
 */
import type { ThemePreference } from "../appearance/ThemeModeMenu";
import type { AiSettingsAccountView, AiSettingsDraftInput, AiSettingsModelSettingValue, AiSettingsProbeView, AiSettingsProviderView } from "./ai/ai-settings.types";

export type SettingsSectionId = "general" | "appearance" | "ai" | "permissions" | "workspace" | "developer";

export interface SettingsPageProps {
  activeSection: SettingsSectionId;
  onSectionChange: (section: SettingsSectionId) => void;
  onClose: () => void;
  /** 与主工作台共享的实时左栏宽度。 */
  leftPaneWidth: number;
  onLeftPaneWidthChange: (width: number) => void;
  themePreference: ThemePreference;
  onThemePreferenceChange: (value: ThemePreference) => void;
  aiProviders: readonly AiSettingsProviderView[];
  selectedAiProviderId: string;
  onSelectAiProvider: (providerId: string) => void;
  aiAccounts: readonly AiSettingsAccountView[];
  aiSecretPersistence: "os-credential-store" | "memory" | "unavailable";
  aiHostAvailable: boolean;
  onProbeAiAccount: (draft: AiSettingsDraftInput, secret: string) => Promise<AiSettingsProbeView>;
  onSaveAiAccount: (draft: AiSettingsDraftInput, secret: string) => Promise<AiSettingsProbeView>;
  onReprobeAiAccount: (accountId: string) => Promise<AiSettingsProbeView>;
  onDeleteAiAccount: (accountId: string) => Promise<void>;
  onSelectAiAccountModel: (accountId: string, modelId: string, modelSettings: Readonly<Record<string, AiSettingsModelSettingValue>>) => Promise<void>;
}
