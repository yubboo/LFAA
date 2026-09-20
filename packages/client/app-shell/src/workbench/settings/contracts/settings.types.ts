/**
 * 文件：settings.types.ts
 * 作用：定义 App Shell Settings Surface 的产品 UI 契约。
 * 负责：设置分类、主题偏好、AI/Plugin ViewModel 注入类型。
 * 不负责：Config 真值、Provider 网络请求、宿主路由实现。
 * 状态归属：无运行时状态；只定义类型。
 * 对外接口：SettingsPageProps、SettingsSectionId、PluginSettingsPanelProps。
 * 关联文件：../view/SettingsPage.tsx、../view/PluginSettingsPanel.tsx。
 * 修改注意事项：Provider 业务类型只通过公开 ViewModel 接入，不深链内部源码。
 */
import type { ThemePreference, AiSettingsAccountView, AiSettingsDraftInput, AiSettingsModelSettingValue, AiSettingsProbeView, AiSettingsProviderView } from "@lfaa/ui";

export type SettingsSectionId = "general" | "appearance" | "ai" | "plugins" | "permissions" | "workspace" | "developer";

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
  activeAiModel: { accountId: string; providerId: string; modelId: string } | null;
  aiSecretPersistence: "os-credential-store" | "memory" | "unavailable";
  aiHostAvailable: boolean;
  onProbeAiAccount: (draft: AiSettingsDraftInput, secret: string) => Promise<AiSettingsProbeView>;
  onSaveAiAccount: (draft: AiSettingsDraftInput, secret: string) => Promise<AiSettingsProbeView>;
  onConnectAiSubscription: (draft: AiSettingsDraftInput) => Promise<AiSettingsProbeView>;
  onReprobeAiAccount: (accountId: string) => Promise<AiSettingsProbeView>;
  onDeleteAiAccount: (accountId: string) => Promise<void>;
  onSelectAiAccountModel: (accountId: string, modelId: string, modelSettings: Readonly<Record<string, AiSettingsModelSettingValue>>) => Promise<void>;
  onActivateAiAccountModel: (accountId: string) => Promise<void>;
  pluginSettings: PluginSettingsPanelProps;
}

export interface PluginSettingsCapabilityView {
  readonly id: string;
  readonly kind: string;
  readonly displayName: string;
}

export interface PluginSettingsCredentialView {
  readonly id: string;
  readonly displayName: string;
  readonly exposure: "host-mediated" | "isolated-process";
}

export interface PluginSettingsInstalledView {
  readonly packageName: string;
  readonly packageVersion: string;
  readonly pluginId: string;
  readonly displayName: string;
  readonly description?: string;
  readonly enabled: boolean;
  readonly capabilities: readonly PluginSettingsCapabilityView[];
  readonly credentials: readonly PluginSettingsCredentialView[];
}

export type PluginSettingsInspectionView =
  | ({ readonly status: "accepted"; readonly sourceKind: string; readonly spec: string; readonly pluginApiVersion: number; readonly permissions: readonly string[] } & PluginSettingsInstalledView)
  | { readonly status: "refused"; readonly spec: string; readonly reason: string };

export interface PluginSettingsInstallResultView {
  readonly status: "installed" | "failed" | "cancelled";
  readonly packageName?: string;
  readonly bundleDisplayName?: string;
  readonly failureKind?: string;
  readonly diagnostic?: string;
  readonly pendingBuilds?: readonly string[];
}

export interface PluginSettingsPanelProps {
  readonly hostAvailable: boolean;
  readonly registryGeneration: number;
  readonly installed: readonly PluginSettingsInstalledView[];
  onInspectPlugin(spec: string): Promise<PluginSettingsInspectionView>;
  onInstallPlugin(spec: string, requestId: string, approvedBuilds?: readonly string[]): Promise<PluginSettingsInstallResultView>;
  onSetPluginEnabled(packageName: string, enabled: boolean): Promise<void>;
  onRemovePlugin(packageName: string): Promise<void>;
  onCancelPlugin(requestId: string): Promise<void>;
}
