/** 功能：呈现现有设置中心。作用：消费已保存设置并组合能力包界面。关联文件：client/connection、ui-settings、ui-theme、ui-commands。 */
import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createReadPoller } from "lfaa-client-connection/src/read-poller.js";
import { setFileManagerLocation } from "lfaa-client-connection/src/file-manager-location.js";
import { applyAppearancePreset as applyAppearancePresetRequest, autofillBrowserContact, autofillBrowserPassword, clearBrowserData as clearBrowserSessionData, clearBrowserRecentSites, deleteBrowserCredential, deleteBrowserRecentSite, loadBrowserCredentials, loadBrowserRecentSites, loadLocalModels, saveBrowserContact, saveBrowserPassword, startLocalModelDownload, readLocalModelDownload, cancelLocalModelDownload, unloadLocalModel } from "lfaa-client-connection/src/api.js";
import { downloadAppearanceBackground, loadSettings, validateAppearancePresetSnapshot } from "lfaa-client-connection/src/api.js";
import { createSnapshotCache } from "lfaa-client-store/src/snapshot-cache.js";
import { useWorkbenchMetrics } from "lfaa-client-ui-dockkit/src/use-workbench-metrics.js";
import { lfaaProjectBuildInfo } from "lfaa-client-connection/src/project-version.js";
import { inspectWebUpdateManifest, type WebUpdateCheckResult } from "./web-update.mjs";
import { Alert, Button, Card, Input, InputNumber, Modal, Popconfirm, Progress, Radio, Select, Slider, Space, Tag, Typography, message } from "antd";
import { activateAiAccount, changeCurrentPassword, createSteamcmdTask, deleteAppearanceBackground, deleteAiAccount, deleteConversationMemories, loadConversationMemories, saveConversationMemories, archiveAiSession, decideAiApproval, getErrorMessage, hasAdminAccess, isDesktopApp, loadAiAccounts, loadAiApprovals, loadAiPermissionGrants, loadAiExtensions, loadAiSessions, loadAiUsage, loadAppearanceBackgrounds, loadAiProviders, loadClaudeAgentCredentialStatus, saveClaudeAgentCredential, deleteClaudeAgentCredential, loadBrowserProviders, closeBrowserProviderSessions, loadHealth, loadMinecraftStorageSettings, loadMinecraftCoreNames, loadSteamcmdSettings, loadSteamcmdTask, loadProjectStorageLocations, loadWorkspaceProjects, compareProjectContentDirectories, copyProjectContentToDirectory, adoptProjectContentDirectory, importProjectContentArchive, downloadProjectContentArchive, loadCapabilityInstallCatalog, manageAiRuntimePlugin, probeAiProvider, refreshAiAccountModelCatalog, testSavedAiAccountModel, saveAiAccount, testAiAccountCredential, updateAiAccountCredential, testAiProviderModel, saveRecoveryKey, saveSettings, saveSteamcmdConfigurationDefaults, saveSteamcmdNodeConfiguration, saveSteamcmdStorageDefaults, saveSteamcmdNodeStorageSettings, selectDesktopDataDirectory, revokeAiPermissionGrant, uploadAppearanceBackground, updateCurrentUserEmail, updateCurrentUserUsername, userRoleLabel, updateAiAccountModel, updateAiAccountReasoningMode, type ApplicationId, type AiModel, type AiModelTestResult, type AiAccount, type AiExtension, type AiRuntimeHookInfo, type AiProvider, type AiProviderProbe, type AiRuntimePlugin, type CapabilityInstallCatalogEntry, type AiSession, type AiUsageSummary, type AiToolApproval, type AiToolPermissionGrant, type AppearanceBackground, type BrowserProviderSummary, type BrowserRecentSite, type BrowserVaultEntry, type BrowserProviderId, type NativeBrowserDownload, type NativeBrowserDownloadSettings, type NativeBrowserExtension, type ConversationMemorySnapshot, type ProjectContentComparison, type ProjectStorageLocations, type DesktopUpdateCheckResult, type DesktopUpdatePreferences, type DesktopUpdateRuntimeInfo, type ServerHealth, type MinecraftStorageNode, type MinecraftStorageSettings, type SteamcmdConfigurationValues, type SteamcmdSettingsNode, type SteamcmdStorageValues, type SteamcmdTask, type User, type UserSettings, type LocalModelSummary, type LocalModelDownloadSnapshot, type ClaudeAgentCredentialStatus } from "lfaa-client-connection/src/api.js";
import { appearanceBackgroundOptions, appearanceBackgroundTargets } from "lfaa-util-values/src/builtin-backgrounds.js";
import { EXECUTION_SANDBOX_MODES } from "lfaa-util-values/src/sandbox-contract.js";
import { getSettingsCenterMenu, SETTINGS_CENTER_MENUS, type SettingsMenuId } from "lfaa-util-values/src/settings-menu-catalog.js";
import { cacheLoginAppearance } from "lfaa-client-ui-theme/src/login-appearance.js";
import { resolveLoginAreaOverlay, resolveWorkbenchAreaEffects } from "lfaa-client-ui-theme/src/appearance-area-effects.js";
import { getBrowserNotificationPermission, playNotificationSound, requestBrowserNotificationPermission, sendBrowserNotification, type BrowserNotificationPermission } from "lfaa-client-resources/src/notification-runtime.js";
import { createScrollRestorationKey, useScrollRestoration } from "lfaa-client-store/src/scroll-restoration.js";
import { ResizableWorkbench } from "lfaa-client-ui-dockkit/src/ResizableWorkbench.js";
import { resolveWorkbenchLayoutMetrics, type WorkbenchLayoutMetrics } from "lfaa-client-ui-dockkit/src/workbench-layout.config.js";
import { readWorkbenchLeftWidth, saveWorkbenchLeftWidth } from "lfaa-client-ui-dockkit/src/workbench-preferences.js";
import { WorkbenchIcon, type WorkbenchIconName } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { isPasswordAcceptable, PasswordStrengthIndicator } from "lfaa-client-ui-settings-account/src/PasswordStrengthIndicator.js";
import { AdminUsersPage } from "lfaa-client-ui-settings-account/src/AdminUsersPage.js";
import { GLOBAL_NAVIGATION_RAIL_COMPACT_WIDTH, GLOBAL_NAVIGATION_RAIL_WIDTH, GlobalNavigationRail, type ApplicationNavigationItem } from "lfaa-client-ui-sidebar/src/GlobalNavigationRail.js";
import { SecondaryNavigation } from "lfaa-client-ui-sidebar/src/SecondaryNavigation.js";
import { PasskeyManager } from "lfaa-client-ui-settings-account/src/PasskeyManager.js";
import { McpConnectionsSettings } from "./McpConnectionsSettings.js";
import { CloudPreferencesSettings } from "./CloudPreferencesSettings.js";
import { AppearancePresetsPanel } from "./AppearancePresetsPanel.js";
import { AppearancePresetCommitUncertainError, appearancePresetDownloadName, createAppearancePresetFile, importAppearancePresetWithAssets, parseAppearancePresetFile } from "./AppearancePresetFile.js";
import "./SettingsPage.css";
import { hasShortcutConflicts, ShortcutRow } from "lfaa-client-ui-shortcuts/src/settings-shortcuts.js";
import { defaultReasoningMode, effectiveReasoningMode, reasoningOptions, modelParameterSummary, modelOptionLabel, modelOptionVersionTag, fixedThinkingLabel } from "lfaa-client-ui-settings-models/src/model-options.js";
import { DEFAULT_USER_SETTINGS } from "lfaa-client-ui-settings-general/src/default-settings.js";
import { AI_RUNTIME_MAX_MODEL_REQUESTS_PER_RUN, AI_RUNTIME_MAX_TOOL_CALLS_PER_RUN, APPEARANCE_PRESET_LIMIT, UI_MOTION_EFFECT_OPTIONS, CANVAS_DEFAULT_MODE_OPTIONS, CANVAS_GRID_STYLE_OPTIONS, type AppearancePreset, type UiMotionEffect } from "lfaa-util-values/src/settings-contract.js";
import { applyWritingWorkspacePresetAppearance, createAppearancePresetSnapshot } from "lfaa-util-values/src/appearance-presets.js";
import { SettingGroup, AdvancedGroup, SettingRow, SettingsSwitch } from "lfaa-client-ui-primitives/src/settings-controls.js";
import { DshSlotOutlet, LFAA_AUTH_TRANSITION_SLOT, useDshSlotEntries } from "lfaa-client-modules/src/client/index.js";

function aiModelSelectOption(providerId: string, model: AiModel): { value: string; label: ReactNode; title: string; disabled: boolean } {
  const versionTag = modelOptionVersionTag(model);
  return {
    value: model.id,
    label: <span className="settings-ai-model-option"><span className="settings-ai-model-option__name">{model.name}</span>{versionTag ? <Tag color="blue">{versionTag}</Tag> : null}<small className="settings-ai-model-option__id">{model.id}</small></span>,
    title: `${modelOptionLabel(providerId, model)} ${versionTag ?? ""}`,
    disabled: false
  };
}
import { GitWorktreesSettings } from "./GitWorktreesSettings.js";
import { KnowledgeLibraryPanel } from "./KnowledgeLibraryPanel.js";
import { isComputerControlEnabled } from "./computer-control-settings.js";
import { ARK_PLAN_CATALOG_REVISION } from "lfaa-util-values/src/ark-provider.js";
import { ManagedPluginsSettings } from "./ManagedPluginsSettings.js";
import { DeveloperHandbook } from "./DeveloperHandbook.js";
import { AccountAgentUsageSettings } from "./AccountAgentUsageSettings.js";
import { AccountSnapshotsSettings } from "./AccountSnapshotsSettings.js";
import { TrustedContactsSettings } from "./TrustedContactsSettings.js";





const recoveryKeyCharacterGroups = [
  "ABCDEFGHJKLMNPQRSTUVWXYZ",
  "abcdefghijkmnopqrstuvwxyz",
  "23456789",
  "!@#$%^&*-_+="
];

function secureRandomInteger(maxExclusive: number): number {
  const maxUint32 = 0x1_0000_0000;
  const limit = maxUint32 - (maxUint32 % maxExclusive);
  const values = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(values);
  } while ((values[0] ?? maxUint32) >= limit);
  return (values[0] ?? 0) % maxExclusive;
}

/**
 * 功能：生成账户恢复密钥。
 * 作用：使用浏览器密码学随机数生成包含大小写字母、数字和符号的独立密钥，仅在设置页内存中暂存。
 * 关联文件：packages/client/ui-settings/src/SettingsPage.tsx、packages/identity/auth/src/service.ts。
 */
function generateRecoveryKey(): string {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("当前环境无法安全生成随机恢复密钥。");
  }

  const characters = recoveryKeyCharacterGroups.map((group) => group.charAt(secureRandomInteger(group.length)));
  const alphabet = recoveryKeyCharacterGroups.join("");
  while (characters.length < 24) {
    characters.push(alphabet.charAt(secureRandomInteger(alphabet.length)));
  }
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = secureRandomInteger(index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex]!, characters[index]!];
  }
  return characters.join("");
}

const SETTINGS_LAYOUT_KEY = "lfaa.settings.layout.v2";

function formatStorageBytes(value: number): string {
  if (value < 1_024) return `${value} B`;
  const units = ["KiB", "MiB", "GiB", "TiB"];
  let amount = value;
  let unit = -1;
  while (amount >= 1_024 && unit < units.length - 1) { amount /= 1_024; unit += 1; }
  return `${new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 }).format(amount)} ${units[unit]}`;
}



type SectionId = SettingsMenuId | "configuration";
type AccountSettingsSectionId = Extract<SectionId, "profile" | "security" | "account">;
type PluginWorkspaceTab = "overview" | "catalog" | "knowledge" | "mcp" | "diagnostics";
export type StandalonePluginWorkspaceView = "all" | "applications" | "tools" | "skills" | "prompts" | "mcp" | "knowledge" | "diagnostics" | "experts";

function resolveStandalonePluginWorkspaceView(view: StandalonePluginWorkspaceView): { tab: PluginWorkspaceTab; kind: AiExtension["kind"] | "all" } {
  switch (view) {
    case "all": return { tab: "catalog", kind: "all" };
    case "applications": return { tab: "overview", kind: "all" };
    case "tools": return { tab: "catalog", kind: "tool" };
    case "skills": return { tab: "catalog", kind: "skill" };
    case "prompts": return { tab: "catalog", kind: "prompt" };
    case "mcp": return { tab: "mcp", kind: "all" };
    case "knowledge": return { tab: "knowledge", kind: "all" };
    case "diagnostics": return { tab: "diagnostics", kind: "all" };
    case "experts": return { tab: "catalog", kind: "expert" };
  }
}

const PLUGIN_WORKSPACE_TABS: Array<{ id: PluginWorkspaceTab; label: string }> = [
  { id: "overview", label: "总览" },
  { id: "catalog", label: "能力目录" },
  { id: "knowledge", label: "我的资料库" },
  { id: "mcp", label: "MCP 连接" },
  { id: "diagnostics", label: "运行诊断" }
];
const ACCOUNT_SETTINGS_TABS: Array<{ id: AccountSettingsSectionId; label: string }> = [
  { id: "profile", label: "个人资料" },
  { id: "security", label: "安全" },
  { id: "account", label: "账号管理" }
];

function isAccountSettingsSection(section: SectionId): section is AccountSettingsSectionId {
  return section === "profile" || section === "security" || section === "account";
}

function getSettingsSectionSearchText(section: { id: string; title: string; group: string }): string {
  // 分类搜索词与 Agent 设置目录共用 settings-menu-catalog 的别名/工具搜索词，避免两套中文字典。
  const menu = getSettingsCenterMenu(section.id);
  const aliases = section.id === "account" ? "账户 个人资料 安全 账号管理" : "";
  const catalogTerms = [...(menu?.aliases ?? []), ...(menu?.toolSearchTerms ?? [])].join(" ");
  return `${section.title} ${section.group} ${aliases} ${catalogTerms}`.trim();
}

function AccountSettingsTabs({ activeSection, onSelect }: { activeSection: AccountSettingsSectionId; onSelect: (section: AccountSettingsSectionId) => void }) {
  return (
    <div className="settings-account-tabs" role="tablist" aria-label="账号设置分类" onKeyDown={(event) => {
      const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=tab]"));
      if (tabs.length === 0) return;
      const currentIndex = tabs.indexOf(event.target as HTMLButtonElement);
      const nextIndex = event.key === "ArrowRight" ? (currentIndex + 1) % tabs.length
        : event.key === "ArrowLeft" ? (currentIndex - 1 + tabs.length) % tabs.length
          : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
      if (currentIndex >= 0 && nextIndex >= 0) {
        event.preventDefault();
        tabs[nextIndex]?.focus();
        tabs[nextIndex]?.click();
      }
    }}>
      {ACCOUNT_SETTINGS_TABS.map((tab) => <button
        key={tab.id}
        id={`settings-account-tab-${tab.id}`}
        type="button"
        role="tab"
        tabIndex={activeSection === tab.id ? 0 : -1}
        aria-selected={activeSection === tab.id}
        aria-controls="settings-account-panel"
        className={activeSection === tab.id ? "is-active" : ""}
        onClick={() => onSelect(tab.id)}
      >{tab.label}</button>)}
    </div>
  );
}
// 只在进入需要真实数据的分类时请求专属数据，避免首次打开设置就并发加载全部分类。
const SETTINGS_DATA_SECTIONS = new Set<SectionId>(["appearance", "usage", "plugins", "hooks", "archived", "ai", "minecraft", "permissions", "workspace", "developer"]);

const EXTENSION_CATEGORIES: Array<{ kind: AiExtension["kind"]; label: string; description: string; icon: WorkbenchIconName }> = [
  { kind: "agent", label: "Agent", description: "承担任务规划与执行的 Agent 配置。", icon: "spark" },
  { kind: "expert", label: "领域专家", description: "围绕特定领域提供专业分析和建议。", icon: "book" },
  { kind: "prompt", label: "提示词", description: "为 Agent 提供角色、边界和任务指引。", icon: "file" },
  { kind: "skill", label: "技能", description: "可复用的专业知识与工作流程。", icon: "book" },
  { kind: "tool", label: "工具", description: "供模型按任务选择并调用的执行能力。", icon: "tools" },
  { kind: "llm-provider", label: "模型提供方", description: "登记给 AI Runtime 使用的模型服务能力。", icon: "browser" }
];

interface SettingsDataSnapshot {
  loadedSections: Set<SectionId>;
  providers: AiProvider[];
  accounts: AiAccount[];
  extensions: AiExtension[];
  runtimePlugins: AiRuntimePlugin[];
  capabilityInstallCatalog: CapabilityInstallCatalogEntry[];
  hotReloadEnabled: boolean;
  runtimeHooks: AiRuntimeHookInfo[];
  usage: AiUsageSummary | null;
  pendingApprovals: AiToolApproval[];
  permissionGrants: AiToolPermissionGrant[];
  archivedSessions: AiSession[];
  health: ServerHealth | null;
  steamcmdNodes: SteamcmdSettingsNode[];
  projectStorageLocations: ProjectStorageLocations | null;
  steamcmdConfigurationDefaultsConfigured: boolean;
  steamcmdConfigurationDefaults: SteamcmdConfigurationValues;
  selectedSteamcmdConfigurationNodeId: string;
  steamcmdConfigurationDraft: SteamcmdConfigurationValues;
  steamcmdStorageDefaultsConfigured: boolean;
  steamcmdStorageDefaults: SteamcmdStorageValues;
  selectedSteamcmdStorageNodeId: string;
  selectedMinecraftStorageNodeId: string;
  selectedSteamcmdInstallNodeId: string;
  steamcmdStorageDraft: SteamcmdStorageValues;
  minecraftStorageNodes: MinecraftStorageNode[];
  minecraftStorageDefaultsConfigured: boolean;
  minecraftStorageDefaults: MinecraftStorageSettings;
  minecraftStorageDraft: MinecraftStorageSettings;
  uploadedBackgrounds: AppearanceBackground[];
}

const settingsDataSnapshots = createSnapshotCache<SettingsDataSnapshot>();

function createEmptySettingsDataSnapshot(): SettingsDataSnapshot {
  return {
    loadedSections: new Set(), providers: [], accounts: [], extensions: [], runtimePlugins: [], capabilityInstallCatalog: [], hotReloadEnabled: false, runtimeHooks: [],
    usage: null, pendingApprovals: [], permissionGrants: [], archivedSessions: [], health: null, steamcmdNodes: [],
    projectStorageLocations: null,
    steamcmdConfigurationDefaultsConfigured: false, steamcmdConfigurationDefaults: { installMode: "online", steamcmdDirectory: "lib/steamcmd" }, selectedSteamcmdConfigurationNodeId: "",
    steamcmdConfigurationDraft: { installMode: "online", steamcmdDirectory: "lib/steamcmd" }, steamcmdStorageDefaultsConfigured: false,
    steamcmdStorageDefaults: { gameDirectory: "games/steamcmd" }, selectedSteamcmdStorageNodeId: "", selectedSteamcmdInstallNodeId: "",
    selectedMinecraftStorageNodeId: "",
    steamcmdStorageDraft: { gameDirectory: "games/steamcmd" },
    minecraftStorageNodes: [], minecraftStorageDefaultsConfigured: false,
    minecraftStorageDefaults: { instanceDirectory: "games/minecraft" }, minecraftStorageDraft: { instanceDirectory: "games/minecraft" },
    uploadedBackgrounds: []
  };
}

const SETTINGS_SECTION_ICONS: Record<SettingsMenuId, WorkbenchIconName> = {
  general: "settings", notifications: "history", import: "file", profile: "user", security: "shield", appearance: "sun",
  wallpaperEngine: "sun", parental: "shield", trustedContacts: "user", voice: "spark", about: "refresh", personalization: "sun",
  mini: "bolt", canvas: "grid", shortcuts: "keyboard", usage: "bolt", account: "user", plugins: "grid", profilePlugins: "extension",
  computerControl: "tools", snapshots: "archive", browser: "browser", hooks: "review", connections: "tools",
  cloudPreferences: "browser", codeReview: "review", git: "refresh", environment: "terminal", worktrees: "folder",
  archived: "archive", ai: "spark", minecraft: "settings", permissions: "shield", workspace: "folder", developer: "terminal"
};
const sections: Array<{ id: SectionId; title: string; group: string; icon: WorkbenchIconName }> = SETTINGS_CENTER_MENUS.map((section) => ({
  id: section.id,
  title: section.label,
  group: section.group,
  icon: SETTINGS_SECTION_ICONS[section.id]
}));
const LFAA_CONFIGURATION_SECTION_IDS = new Set<SectionId>(["ai", "minecraft", "permissions", "workspace", "developer"]);
const LFAA_CONFIGURATION_SECTIONS = sections.filter((section) => LFAA_CONFIGURATION_SECTION_IDS.has(section.id));
const SETTINGS_NAV_GROUPS = [...new Set(sections.map((section) => section.group))];

const SETTINGS_ACTIVE_SECTION_STORAGE_KEY = "lfaa.settings.active-section.v1";
const SETTINGS_LEGACY_SCROLL_POSITION_STORAGE_KEY = "lfaa.settings.scroll-position.v1";
const SETTINGS_APPEARANCE_ADVANCED_STORAGE_KEY = "lfaa.settings.appearance-advanced-open.v1";
const SETTINGS_BACKGROUND_TARGET_STORAGE_KEY = "lfaa.settings.background-target.v1";
const SETTINGS_NAV_COLLAPSED_GROUPS_STORAGE_KEY = "lfaa.settings.navigation-collapsed-groups.v1";
const SETTINGS_AUTOSAVE_DELAY_MS = 300;
const SETTINGS_BACKGROUND_TARGETS = ["login", "appCenter", "steamcmd", "minecraft", "writing", "settings"] as const;
type SettingsBackgroundTarget = typeof SETTINGS_BACKGROUND_TARGETS[number];

function isSettingsSection(value: string | null): value is SectionId {
  return value === "configuration" || sections.some((section) => section.id === value);
}

function resolveSettingsSection(section: SectionId): SectionId {
  if (section === "configuration") return "workspace";
  if (section === "plugins") return "profilePlugins";
  return section;
}

function settingsCategoryForSection(section: SectionId): keyof UserSettings | null {
  if (section === "general" || section === "notifications") return "general";
  if (section === "appearance") return "appearance";
  if (section === "shortcuts") return "shortcuts";
  if (section === "ai" || section === "voice") return "aiRuntime";
  if (section === "minecraft") return "minecraftRuntime";
  if (section === "permissions") return "permissions";
  if (section === "computerControl") return "computerControl";
  if (section === "browser") return "browserUse";
  if (section === "plugins" || section === "connections") return "plugins";
  if (section === "personalization") return "personalization";
  if (section === "git") return "git";
  if (section === "canvas") return "canvas";
  return null;
}

function settingsSectionStorageKey(userId: string): string {
  return `${SETTINGS_ACTIVE_SECTION_STORAGE_KEY}:${userId}`;
}

function legacySettingsScrollPositionStorageKey(userId: string, section: SectionId): string {
  return `${SETTINGS_LEGACY_SCROLL_POSITION_STORAGE_KEY}:${encodeURIComponent(userId)}:${section}`;
}

function settingsAppearanceAdvancedStorageKey(userId: string): string {
  return `${SETTINGS_APPEARANCE_ADVANCED_STORAGE_KEY}:${encodeURIComponent(userId)}`;
}

function settingsBackgroundTargetStorageKey(userId: string): string {
  return `${SETTINGS_BACKGROUND_TARGET_STORAGE_KEY}:${encodeURIComponent(userId)}`;
}

function settingsNavCollapsedGroupsStorageKey(userId: string): string {
  return `${SETTINGS_NAV_COLLAPSED_GROUPS_STORAGE_KEY}:${encodeURIComponent(userId)}`;
}

function readExpandedSettingsGroups(userId: string): Set<string> {
  try {
    const stored = window.localStorage.getItem(settingsNavCollapsedGroupsStorageKey(userId));
    if (stored === null) return new Set(SETTINGS_NAV_GROUPS);
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return new Set(SETTINGS_NAV_GROUPS);
    const collapsedGroups = new Set(parsed.filter((group): group is string => typeof group === "string"));
    return new Set(SETTINGS_NAV_GROUPS.filter((group) => !collapsedGroups.has(group)));
  } catch {
    return new Set(SETTINGS_NAV_GROUPS);
  }
}

function readSettingsAppearanceAdvancedOpen(userId: string): boolean {
  try {
    return window.localStorage.getItem(settingsAppearanceAdvancedStorageKey(userId)) === "true";
  } catch {
    return false;
  }
}

function readSettingsBackgroundTarget(userId: string): SettingsBackgroundTarget {
  try {
    const target = window.localStorage.getItem(settingsBackgroundTargetStorageKey(userId));
    return SETTINGS_BACKGROUND_TARGETS.find((item) => item === target) ?? "login";
  } catch {
    return "login";
  }
}

function getInitialSettingsSection(initialSection: SectionId | undefined, userId: string, standalonePluginWorkspace = false, standalonePluginSection: "plugins" | "wallpaperEngine" = "plugins"): SectionId {
  if (standalonePluginWorkspace) return standalonePluginSection;
  const querySection = new URLSearchParams(window.location.search).get("section");
  if (isSettingsSection(querySection) && querySection !== "connections" && querySection !== "wallpaperEngine") return resolveSettingsSection(querySection);
  if (initialSection && initialSection !== "connections" && initialSection !== "wallpaperEngine") return resolveSettingsSection(initialSection);

  try {
    const storedSection = window.localStorage.getItem(settingsSectionStorageKey(userId));
    if (isSettingsSection(storedSection) && storedSection !== "connections" && storedSection !== "wallpaperEngine") return resolveSettingsSection(storedSection);
  } catch {
    // 浏览器禁用本地存储时仍可通过 URL 保留当前分类。
  }
  return "general";
}

function persistSettingsSection(section: SectionId, userId: string): void {
  try {
    window.localStorage.setItem(settingsSectionStorageKey(userId), section);
  } catch {
    // 分类不是账户业务数据；存储不可用时仍尝试将其保存在地址栏中。
  }

  try {
    const routeSection = section === "profilePlugins" ? "plugins" : section;
    const url = new URL(window.location.href);
    if (url.searchParams.get("section") === routeSection) return;
    url.searchParams.set("section", routeSection);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // URL 更新失败不影响设置分类切换。
  }
}

const accentColors = ["#3457d5", "#1687a7", "#27845b", "#8956bb", "#d05b37", "#d64d8f"];
const textFontOptions = [
  { value: "system", label: "系统默认" },
  { value: "sans", label: "无衬线" },
  { value: "serif", label: "衬线" }
];
const codeFontOptions = [
  { value: "system", label: "系统默认" },
  { value: "cascadia", label: "Cascadia Code" },
  { value: "consolas", label: "Consolas" },
  { value: "jetbrains", label: "JetBrains Mono" }
];

function initialSettingsMetrics(): WorkbenchLayoutMetrics {
  if (typeof window === "undefined") return resolveWorkbenchLayoutMetrics(1280 - GLOBAL_NAVIGATION_RAIL_WIDTH, 800);
  const railWidth = window.innerWidth <= 420 ? GLOBAL_NAVIGATION_RAIL_COMPACT_WIDTH : GLOBAL_NAVIGATION_RAIL_WIDTH;
  return resolveWorkbenchLayoutMetrics(window.innerWidth - railWidth, window.innerHeight);
}

interface SettingsPageProps {
  user: User;
  serverState: "checking" | "online" | "offline";
  settings: UserSettings;
  resolvedTheme: "light" | "dark";
  initialSection?: SectionId;
  sectionRequest?: { section: "ai" | "permissions" | "configuration" | "account" | "workspace" | "security" | "plugins"; requestId: number; focusTarget?: string } | null;
  applications: ApplicationNavigationItem[];
  navigationApplications?: ApplicationNavigationItem[];
  onOpenApplication: (app: ApplicationId, mode: "normal") => Promise<void>;
  onOpenApplications?: () => void;
  onOpenRecentSessions: () => void;
  onBack: () => void;
  onNavigate: (path: string) => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onUserChange: (user: User) => void;
  onSettingsChange: (settings: UserSettings) => void;
  standalonePluginWorkspace?: boolean;
  standalonePluginView?: StandalonePluginWorkspaceView;
  standalonePluginSection?: "plugins" | "wallpaperEngine";
}

const AppearanceFocusBlurSliders = memo(function AppearanceFocusBlurSliders({
  enabled,
  idleMinutes: savedIdleMinutes,
  percent: savedPercent,
  onIdleMinutesChange,
  onPercentChange
}: {
  enabled: boolean;
  idleMinutes: number;
  percent: number;
  onIdleMinutesChange: (minutes: number) => void;
  onPercentChange: (percent: number) => void;
}) {
  const [idleMinutes, setIdleMinutes] = useState(savedIdleMinutes);
  const [percent, setPercent] = useState(savedPercent);
  useEffect(() => setIdleMinutes(savedIdleMinutes), [savedIdleMinutes]);
  useEffect(() => setPercent(savedPercent), [savedPercent]);

  return <>
    <SettingRow title="空闲多久后虚化" description="页面至少 1 分钟没有鼠标、键盘、滚动或触屏操作后，开始虚化 小鱼智能体 输出区域。">
      <div className="settings-slider"><Slider disabled={!enabled} min={1} max={60} value={idleMinutes} onChange={setIdleMinutes} onChangeComplete={onIdleMinutesChange} /><output>{idleMinutes} 分钟</output></div>
    </SettingRow>
    <SettingRow title="回复虚化与淡出强度" description="按百分比调节 小鱼智能体 空闲后的虚化和淡出；0% 保持清晰可见，100% 完全淡出隐藏回复，中间值同时增加模糊并降低不透明度。">
      <div className="settings-slider"><Slider disabled={!enabled} min={0} max={100} value={percent} onChange={setPercent} onChangeComplete={onPercentChange} /><output>{percent}%</output></div>
    </SettingRow>
  </>;
});

function MotionEffectSelector({ ariaLabel, previewKind, value, onChange }: {
  ariaLabel: string;
  previewKind: "card" | "dialog";
  value: UiMotionEffect;
  onChange: (effect: UiMotionEffect) => void;
}) {
  return <div
    className="settings-motion-options"
    role="radiogroup"
    aria-label={ariaLabel}
    onKeyDown={(event) => {
      const selectedIndex = UI_MOTION_EFFECT_OPTIONS.findIndex(({ id }) => id === value);
      const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
      if (!delta) return;
      event.preventDefault();
      const nextIndex = (selectedIndex + delta + UI_MOTION_EFFECT_OPTIONS.length) % UI_MOTION_EFFECT_OPTIONS.length;
      const nextEffect = UI_MOTION_EFFECT_OPTIONS[nextIndex];
      if (!nextEffect) return;
      onChange(nextEffect.id);
      event.currentTarget.querySelectorAll<HTMLButtonElement>("[role='radio']")[nextIndex]?.focus();
    }}
  >
    {UI_MOTION_EFFECT_OPTIONS.map((effect) => {
      const selected = value === effect.id;
      const description = previewKind === "card" ? effect.cardDescription : effect.dialogDescription;
      return <button
        key={effect.id}
        type="button"
        role="radio"
        className={`settings-motion-option${selected ? " is-selected" : ""}`}
        aria-label={`${effect.label}：${description}`}
        aria-checked={selected}
        tabIndex={selected ? 0 : -1}
        onClick={() => onChange(effect.id)}
      >
        <span className={`settings-motion-option__preview settings-motion-option__preview--${previewKind} settings-motion-option__preview--${effect.id}`} aria-hidden="true">
          {previewKind === "card" ? <><i /><i /><i /></> : <><i /><i /></>}
        </span>
        <strong>{effect.label}</strong>
        <small>{description}</small>
      </button>;
    })}
  </div>;
}





/** 将节点数据根目录和安全相对路径合成仅管理员可见的安装位置预览。 */
function displaySteamcmdPath(node: { dataRoot: string | null } | null, relativePath: string): string {
  if (/^[a-z]:[\\/]/iu.test(relativePath) || relativePath.startsWith("/")) return relativePath;
  const root = node?.dataRoot?.replace(/[\\/]+$/u, "");
  const separator = root?.includes("\\") ? "\\" : "/";
  return root ? `${root}${separator}${relativePath.split("/").join(separator)}` : `LFAA_DATA_DIR/${relativePath}`;
}

/** 本机默认 Steam 游戏目录跟随业务内容根；节点覆盖或远端默认仍按节点根展示。 */
function displaySteamcmdGamePath(node: { dataRoot: string | null } | null, relativePath: string, contentDirectory?: string): string {
  if (/^[a-z]:[\\/]/iu.test(relativePath) || relativePath.startsWith("/")) return relativePath;
  if (node) return displaySteamcmdPath(node, relativePath);
  const root = contentDirectory?.replace(/[\\/]+$/u, "");
  if (!root) return displaySteamcmdPath(null, relativePath);
  const separator = root.includes("\\") ? "\\" : "/";
  return `${root}${separator}${relativePath.split(/[\\/]/u).join(separator)}`;
}










// DeepSeek 保留的 Pro 型号 ID 当前路由到 V4.1 Flash；此提示只改显示文字，实际请求仍使用目录返回的 ID。




export function SettingsPage({ user, serverState, settings: workbenchSettings, resolvedTheme, initialSection, sectionRequest = null, applications, navigationApplications = applications, onOpenApplication, onOpenApplications, onOpenRecentSessions, onBack, onNavigate, onOpenSettings, onLogout, onUserChange, onSettingsChange, standalonePluginWorkspace = false, standalonePluginView, standalonePluginSection = "plugins" }: SettingsPageProps) {
  const authTransitionPlugins = useDshSlotEntries(LFAA_AUTH_TRANSITION_SLOT);
  const [messageApi, messageContext] = message.useMessage();
  const [permissionModal, permissionModalContext] = Modal.useModal();
  const canAdmin = hasAdminAccess(user.role);
  const cacheKey = `${user.id}:${user.role}`;
  const cachedSettingsData = useRef(settingsDataSnapshots.get(cacheKey) ?? null).current;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => initialSettingsMetrics().mode === "mobile");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const layout = useWorkbenchMetrics(rootRef, initialSettingsMetrics);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const initial = initialSettingsMetrics();
    return readWorkbenchLeftWidth(initial.left, initial.containerWidth);
  });
  const [activeSection, setActiveSection] = useState<SectionId>(() => getInitialSettingsSection(initialSection, user.id, standalonePluginWorkspace, standalonePluginSection));
  const [developerHandbookOpen, setDeveloperHandbookOpen] = useState(false);
  const activeSettingsCategory = settingsCategoryForSection(activeSection);
  const initialStandaloneView = standalonePluginView ? resolveStandalonePluginWorkspaceView(standalonePluginView) : null;
  const [pluginWorkspaceTab, setPluginWorkspaceTab] = useState<PluginWorkspaceTab>(() => initialStandaloneView?.tab ?? (getInitialSettingsSection(initialSection, user.id, standalonePluginWorkspace, standalonePluginSection) === "connections" ? "mcp" : "overview"));
  const [knowledgeLibraryOpened, setKnowledgeLibraryOpened] = useState(() => initialStandaloneView?.tab === "knowledge");
  const [minecraftCoreOptions, setMinecraftCoreOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [expandedSettingsGroups, setExpandedSettingsGroups] = useState<Set<string>>(() => readExpandedSettingsGroups(user.id));
  const [searchExpandedSettingsGroups, setSearchExpandedSettingsGroups] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState("");
  const [appearanceAdvancedOpen, setAppearanceAdvancedOpen] = useState(() => readSettingsAppearanceAdvancedOpen(user.id));
  const [appearancePageTab, setAppearancePageTab] = useState<"presets" | "settings">("presets");
  const [appearancePresetBusy, setAppearancePresetBusy] = useState(false);
  const appearancePresetsTabRef = useRef<HTMLButtonElement | null>(null);
  const appearanceSettingsTabRef = useRef<HTMLButtonElement | null>(null);
  const [settings, setSettings] = useState<UserSettings>(workbenchSettings);
  const [skillDirectoriesDraft, setSkillDirectoriesDraft] = useState<string | null>(null);
  const settingsRef = useRef(settings);
  const persistedSettingsRef = useRef(workbenchSettings);
  const settingsRevisionRef = useRef(new Map<keyof UserSettings, number>());
  const settingsAutoSaveTimersRef = useRef(new Map<keyof UserSettings, number>());
  const settingsSaveRequestsRef = useRef(new Map<keyof UserSettings, Promise<void>>());
  const settingsPageMountedRef = useRef(true);
  const settingsSaveFeedbackTimerRef = useRef<number | null>(null);
  const settingsSaveFeedbackSequenceRef = useRef(0);
  const [settingsSaveFeedback, setSettingsSaveFeedback] = useState<{ id: number; status: "success" | "error"; message: string } | null>(null);
  const [loadingSection, setLoadingSection] = useState<SectionId | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [sectionErrors, setSectionErrors] = useState<Partial<Record<SectionId, string>>>({});
  const [settingsSaveErrors, setSettingsSaveErrors] = useState<Partial<Record<keyof UserSettings, string>>>({});
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderDraft, setFolderDraft] = useState("");
  const [defaultWorkspaceLocation, setDefaultWorkspaceLocation] = useState<{ status: "loading" | "ready" | "error"; path: string | null; error: string }>({ status: "loading", path: null, error: "" });
  const [defaultWorkspaceReload, setDefaultWorkspaceReload] = useState(0);
  const [licensesModalOpen, setLicensesModalOpen] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<BrowserNotificationPermission>(() => getBrowserNotificationPermission());
  const [browserProviders, setBrowserProviders] = useState<{ status: "idle" | "loading" | "ready" | "error"; providers: BrowserProviderSummary[]; error: string }>({ status: "idle", providers: [], error: "" });
  const [browserHistoryOpen, setBrowserHistoryOpen] = useState(false);
  const [browserHistoryLoading, setBrowserHistoryLoading] = useState(false);
  const [browserHistory, setBrowserHistory] = useState<BrowserRecentSite[]>([]);
  const [browserHistoryDeletingUrl, setBrowserHistoryDeletingUrl] = useState<string | null>(null);
  const [nativeBrowserPreferencesError, setNativeBrowserPreferencesError] = useState("");
  const [browserDownloadHistoryOpen, setBrowserDownloadHistoryOpen] = useState(false);
  const [browserDownloadHistory, setBrowserDownloadHistory] = useState<NativeBrowserDownload[]>([]);
  const [browserDownloadSettings, setBrowserDownloadSettings] = useState<NativeBrowserDownloadSettings | null>(null);
  const [browserDownloadLoading, setBrowserDownloadLoading] = useState(false);
  const [browserExtensionsOpen, setBrowserExtensionsOpen] = useState(false);
  const [browserExtensions, setBrowserExtensions] = useState<NativeBrowserExtension[]>([]);
  const [browserExtensionsLoading, setBrowserExtensionsLoading] = useState(false);
  const [browserCredentials, setBrowserCredentials] = useState<{ passwords: BrowserVaultEntry[]; contacts: BrowserVaultEntry[] }>({ passwords: [], contacts: [] });
  const [browserCredentialsLoaded, setBrowserCredentialsLoaded] = useState(false);
  const [browserCredentialsOpen, setBrowserCredentialsOpen] = useState<"passwords" | "contacts" | null>(null);
  const [browserCredentialsLoading, setBrowserCredentialsLoading] = useState(false);
  const [browserVaultProviderId, setBrowserVaultProviderId] = useState<BrowserProviderId>("lfaa-managed-edge");
  const [browserPasswordDraft, setBrowserPasswordDraft] = useState({ title: "", origin: "", username: "", password: "" });
  const [browserContactDraft, setBrowserContactDraft] = useState({ title: "", name: "", address: "", email: "", phone: "" });
  const [browserSitePermissionsOpen, setBrowserSitePermissionsOpen] = useState(false);
  const [browserSitePermissionOriginDraft, setBrowserSitePermissionOriginDraft] = useState("");
  const [browserSitePermissionDraft, setBrowserSitePermissionDraft] = useState<"camera" | "microphone" | "geolocation" | "notifications">("camera");
  const [browserSitePermissionDecisionDraft, setBrowserSitePermissionDecisionDraft] = useState<"allow" | "block">("block");
  const [browserWebsiteToolsOpen, setBrowserWebsiteToolsOpen] = useState(false);
  const [browserWebsiteOriginDraft, setBrowserWebsiteOriginDraft] = useState("");
  const [browserWebsiteDecisionDraft, setBrowserWebsiteDecisionDraft] = useState<"allow" | "block">("block");
  const [providers, setProviders] = useState<AiProvider[]>(() => cachedSettingsData?.providers ?? []);
  const [accounts, setAccounts] = useState<AiAccount[]>(() => cachedSettingsData?.accounts ?? []);
  const [localModels, setLocalModels] = useState<LocalModelSummary[]>([]);
  const [localModelsLoading, setLocalModelsLoading] = useState(false);
  const [localModelsError, setLocalModelsError] = useState("");
  const [localModelDownload, setLocalModelDownload] = useState<LocalModelDownloadSnapshot | null>(null);
  useEffect(() => {
    const nativeBrowser = window.lfaaDesktop?.nativeBrowser;
    if (!nativeBrowser) return;
    let live = true;
    void nativeBrowser.setPreferences(settings.browserUse).then(() => {
      if (live) setNativeBrowserPreferencesError("");
    }).catch(reason => {
      if (live) setNativeBrowserPreferencesError(getErrorMessage(reason));
    });
    return () => { live = false; };
  }, [settings.browserUse]);
  const [localModelAction, setLocalModelAction] = useState<string | null>(null);
  const imageGenerationAccounts = accounts.filter(account => account.providerId === "openai" || account.providerId === "doubao"
    || account.providerId === "ark-agent-plan" && account.models.some(model => model.taskType === "image-generation"));
  const selectedImageGenerationAccount = imageGenerationAccounts.find(account => account.id === settings.aiRuntime.imageGenerationAccountId);
  const localImageModels = localModels.filter(model => model.modality === "image");
  const isPlanModelAvailableForTier = (account: AiAccount, model: AiModel): boolean => account.providerId !== "ark-agent-plan"
    || !model.planTiers?.length || account.options.planTier === "unknown" || !account.options.planTier
    || model.planTiers.includes(account.options.planTier as NonNullable<AiModel["planTiers"]>[number]);
  const videoGenerationAccounts = accounts.filter(account => account.providerId === "doubao"
    || account.providerId === "ark-agent-plan" && account.models.some(model => model.taskType === "video-generation" && isPlanModelAvailableForTier(account, model)));
  const selectedVideoGenerationAccount = videoGenerationAccounts.find(account => account.id === settings.aiRuntime.videoGenerationAccountId);
  const videoTranscriptionAccounts = accounts.filter(account => account.providerId === "ark-agent-plan"
    && account.models.some(model => model.id === "doubao-seed-asr-2.0" && model.taskType === "speech-to-text" && isPlanModelAvailableForTier(account, model)));
  const selectedVideoTranscriptionAccount = videoTranscriptionAccounts.find(account => account.id === settings.aiRuntime.videoTranscriptionAccountId);
  const localVideoModels = localModels.filter(model => model.modality === "video");
  const [, setAiAccountsLoadState] = useState<"idle" | "loading" | "ready" | "error">(() => cachedSettingsData?.loadedSections.has("ai") || cachedSettingsData?.loadedSections.has("configuration") ? "ready" : "idle");
  const [extensions, setExtensions] = useState<AiExtension[]>(() => cachedSettingsData?.extensions ?? []);
  const [capabilityInstallCatalog, setCapabilityInstallCatalog] = useState<CapabilityInstallCatalogEntry[]>(() => cachedSettingsData?.capabilityInstallCatalog ?? []);
  const [extensionSearch, setExtensionSearch] = useState("");
  const [extensionKindFilter, setExtensionKindFilter] = useState<AiExtension["kind"] | "all">(() => initialStandaloneView?.kind ?? "all");
  const [runtimePlugins, setRuntimePlugins] = useState<AiRuntimePlugin[]>(() => cachedSettingsData?.runtimePlugins ?? []);
  const [hotReloadEnabled, setHotReloadEnabled] = useState(() => cachedSettingsData?.hotReloadEnabled ?? false);
  const [expandedRuntimePluginGroups, setExpandedRuntimePluginGroups] = useState<Set<string>>(() => new Set());
  const [runtimePluginBusyId, setRuntimePluginBusyId] = useState<string | null>(null);
  const [runtimeHooks, setRuntimeHooks] = useState<AiRuntimeHookInfo[]>(() => cachedSettingsData?.runtimeHooks ?? []);
  const [usage, setUsage] = useState<AiUsageSummary | null>(() => cachedSettingsData?.usage ?? null);
  const [pendingApprovals, setPendingApprovals] = useState<AiToolApproval[]>(() => cachedSettingsData?.pendingApprovals ?? []);
  const [permissionGrants, setPermissionGrants] = useState<AiToolPermissionGrant[]>(() => cachedSettingsData?.permissionGrants ?? []);
  const [persistedPermissionMode, setPersistedPermissionMode] = useState<UserSettings["permissions"]["mode"]>(workbenchSettings.permissions.mode);
  const [approvalBusyId, setApprovalBusyId] = useState<string | null>(null);
  const [archivedSessions, setArchivedSessions] = useState<AiSession[]>(() => cachedSettingsData?.archivedSessions ?? []);
  const [health, setHealth] = useState<ServerHealth | null>(() => cachedSettingsData?.health ?? null);
  const [desktopUpdateRuntime, setDesktopUpdateRuntime] = useState<DesktopUpdateRuntimeInfo | null>(null);
  const [desktopUpdatePreferences, setDesktopUpdatePreferences] = useState<DesktopUpdatePreferences | null>(null);
  const [savingDesktopAutoUpdate, setSavingDesktopAutoUpdate] = useState(false);
  const [desktopUpdateResult, setDesktopUpdateResult] = useState<DesktopUpdateCheckResult | null>(null);
  const [checkingDesktopUpdates, setCheckingDesktopUpdates] = useState(false);
  const [webUpdateResult, setWebUpdateResult] = useState<WebUpdateCheckResult | null>(null);
  const [checkingWebUpdates, setCheckingWebUpdates] = useState(false);
  const webUpdateRequestRef = useRef<AbortController | null>(null);
  const webUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [projectStorageLocations, setProjectStorageLocations] = useState<ProjectStorageLocations | null>(() => cachedSettingsData?.projectStorageLocations ?? null);
  const [contentDirectorySelection, setContentDirectorySelection] = useState<"default" | "recommended" | "custom">("default");
  const [contentDirectoryDraft, setContentDirectoryDraft] = useState(() => cachedSettingsData?.projectStorageLocations?.contentDirectory ?? "");
  const [contentStorageAction, setContentStorageAction] = useState<"save" | "compare" | "import" | "export" | null>(null);
  const [contentMigrationMode, setContentMigrationMode] = useState<"copy" | "adopt" | "archive">("copy");
  const [contentArchivePath, setContentArchivePath] = useState("");
  const [contentComparison, setContentComparison] = useState<ProjectContentComparison | null>(null);
  const canEditContentDirectory = canAdmin && contentStorageAction === null && !projectStorageLocations?.dataDirectoryExternallyManaged;
  const [deletingConversationMemories, setDeletingConversationMemories] = useState(false);
  const [conversationMemorySnapshot, setConversationMemorySnapshot] = useState<ConversationMemorySnapshot | null>(null);
  const [conversationMemoryDraft, setConversationMemoryDraft] = useState("");
  const [loadingConversationMemories, setLoadingConversationMemories] = useState(false);
  const [savingConversationMemories, setSavingConversationMemories] = useState(false);
  const [steamcmdNodes, setSteamcmdNodes] = useState<SteamcmdSettingsNode[]>(() => cachedSettingsData?.steamcmdNodes ?? []);
  const [steamcmdConfigurationDefaultsConfigured, setSteamcmdConfigurationDefaultsConfigured] = useState(() => cachedSettingsData?.steamcmdConfigurationDefaultsConfigured ?? false);
  const [steamcmdConfigurationDefaults, setSteamcmdConfigurationDefaults] = useState<SteamcmdConfigurationValues>(() => cachedSettingsData?.steamcmdConfigurationDefaults ?? { installMode: "online", steamcmdDirectory: "lib/steamcmd" });
  const [selectedSteamcmdConfigurationNodeId, setSelectedSteamcmdConfigurationNodeId] = useState(() => cachedSettingsData?.selectedSteamcmdConfigurationNodeId ?? "");
  const [steamcmdConfigurationDraft, setSteamcmdConfigurationDraft] = useState<SteamcmdConfigurationValues>(() => cachedSettingsData?.steamcmdConfigurationDraft ?? { installMode: "online", steamcmdDirectory: "lib/steamcmd" });
  const [steamcmdStorageDefaultsConfigured, setSteamcmdStorageDefaultsConfigured] = useState(() => cachedSettingsData?.steamcmdStorageDefaultsConfigured ?? false);
  const [steamcmdStorageDefaults, setSteamcmdStorageDefaults] = useState<SteamcmdStorageValues>(() => cachedSettingsData?.steamcmdStorageDefaults ?? { gameDirectory: "games/steamcmd" });
  const [selectedSteamcmdStorageNodeId, setSelectedSteamcmdStorageNodeId] = useState(() => cachedSettingsData?.selectedSteamcmdStorageNodeId ?? "");
  const [selectedMinecraftStorageNodeId, setSelectedMinecraftStorageNodeId] = useState(() => cachedSettingsData?.selectedMinecraftStorageNodeId ?? cachedSettingsData?.selectedSteamcmdStorageNodeId ?? "");
  const [selectedSteamcmdInstallNodeId, setSelectedSteamcmdInstallNodeId] = useState(() => cachedSettingsData?.selectedSteamcmdInstallNodeId ?? "");
  const [steamcmdStorageDraft, setSteamcmdStorageDraft] = useState<SteamcmdStorageValues>(() => cachedSettingsData?.steamcmdStorageDraft ?? { gameDirectory: "games/steamcmd" });
  const [minecraftStorageNodes, setMinecraftStorageNodes] = useState<MinecraftStorageNode[]>(() => cachedSettingsData?.minecraftStorageNodes ?? []);
  const [minecraftStorageDefaultsConfigured, setMinecraftStorageDefaultsConfigured] = useState(() => cachedSettingsData?.minecraftStorageDefaultsConfigured ?? false);
  const [minecraftStorageDefaults, setMinecraftStorageDefaults] = useState<MinecraftStorageSettings>(() => cachedSettingsData?.minecraftStorageDefaults ?? { instanceDirectory: "games/minecraft" });
  const [minecraftStorageDraft, setMinecraftStorageDraft] = useState<MinecraftStorageSettings>(() => cachedSettingsData?.minecraftStorageDraft ?? { instanceDirectory: "games/minecraft" });
  const [steamcmdTask, setSteamcmdTask] = useState<SteamcmdTask | null>(null);
  const [steamcmdAction, setSteamcmdAction] = useState<"save-configuration" | "save-storage" | "install" | "verify" | null>(null);
  const [uploadedBackgrounds, setUploadedBackgrounds] = useState<AppearanceBackground[]>(() => cachedSettingsData?.uploadedBackgrounds ?? []);
  const [backgroundTarget, setBackgroundTarget] = useState<SettingsBackgroundTarget>(() => readSettingsBackgroundTarget(user.id));
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [backgroundActionError, setBackgroundActionError] = useState("");
  const [providerId, setProviderId] = useState("openai");
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [credentialUpdateAccount, setCredentialUpdateAccount] = useState<AiAccount | null>(null);
  const [credentialSecret, setCredentialSecret] = useState("");
  const [credentialTest, setCredentialTest] = useState<AiModelTestResult | null>(null);
  const [claudeAgentCredentialStatus, setClaudeAgentCredentialStatus] = useState<ClaudeAgentCredentialStatus | null>(null);
  const [claudeAgentCredentialDraft, setClaudeAgentCredentialDraft] = useState("");
  const [claudeAgentCredentialBusy, setClaudeAgentCredentialBusy] = useState(false);
  const [providerOptions, setProviderOptions] = useState<Record<string, Record<string, string>>>({});
  const [planModelDrafts, setPlanModelDrafts] = useState<Record<string, string>>({});
  const [accountName, setAccountName] = useState("OpenAI 主账户");
  const [secret, setSecret] = useState("");
  const [providerApiKeyAttention, setProviderApiKeyAttention] = useState(false);
  const [probe, setProbe] = useState<AiProviderProbe | null>(null);
  const [modelTest, setModelTest] = useState<AiModelTestResult | null>(null);
  const [selectedModel, setSelectedModel] = useState("");
  const [reasoningMode, setReasoningMode] = useState("default");
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [usernameDraft, setUsernameDraft] = useState(user.username);
  const [usernameCurrentPassword, setUsernameCurrentPassword] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);
  const [emailDraft, setEmailDraft] = useState(user.email ?? "");
  const [emailCurrentPassword, setEmailCurrentPassword] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [passwordChangeCurrent, setPasswordChangeCurrent] = useState("");
  const [passwordChangeNext, setPasswordChangeNext] = useState("");
  const [passwordChangeConfirmation, setPasswordChangeConfirmation] = useState("");
  const [savingPasswordChange, setSavingPasswordChange] = useState(false);
  const [recoveryCurrentPassword, setRecoveryCurrentPassword] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [recoveryKeyConfirmation, setRecoveryKeyConfirmation] = useState("");
  const [savingRecoveryKey, setSavingRecoveryKey] = useState(false);
  const loadedSectionsRef = useRef(new Set<SectionId>());
  const activeRuntimePluginCount = runtimePlugins.filter((plugin) => plugin.enabled && plugin.state === "ACTIVE").length;
  const visibleCapabilityInstallCatalog = capabilityInstallCatalog.filter(({ kind }) => kind !== "plugin");
  const requiredRuntimePlugins = runtimePlugins.filter((plugin) => plugin.required);
  const runtimePluginHostReady = requiredRuntimePlugins.length > 0 && requiredRuntimePlugins.every((plugin) => plugin.enabled && plugin.state === "ACTIVE");
  const runtimePluginGroups = useMemo(() => {
    const groups = new Map<string, AiRuntimePlugin[]>();
    for (const plugin of runtimePlugins) {
      const group = plugin.name.includes("/") ? plugin.name.slice(0, plugin.name.indexOf("/")) : "other";
      groups.set(group, [...(groups.get(group) ?? []), plugin]);
    }
    const order = ["api", "core", "storage", "games", "document", "host", "boot", "other"];
    const labels: Record<string, string> = { api: "API 服务", core: "核心运行时", storage: "存储", games: "游戏能力", document: "文档能力", host: "宿主", boot: "启动与开发", other: "其他模块" };
    return [...groups.entries()]
      .sort(([left], [right]) => (order.indexOf(left) < 0 ? order.length : order.indexOf(left)) - (order.indexOf(right) < 0 ? order.length : order.indexOf(right)))
      .map(([id, plugins]) => ({ id, label: labels[id] ?? id, plugins }));
  }, [runtimePlugins]);
  const extensionKindCounts = useMemo(() => {
    const counts = new Map<AiExtension["kind"], number>();
    for (const extension of extensions) counts.set(extension.kind, (counts.get(extension.kind) ?? 0) + 1);
    return counts;
  }, [extensions]);
  const extensionKindTotalCount = extensionKindFilter === "all" ? extensions.length : extensionKindCounts.get(extensionKindFilter) ?? 0;
  const extensionCatalogGroups = useMemo(() => {
    const query = extensionSearch.trim().toLocaleLowerCase();
    return EXTENSION_CATEGORIES
      .filter(({ kind }) => extensionKindFilter === "all" || kind === extensionKindFilter)
      .map((category) => ({
        ...category,
        items: extensions.filter((extension) => {
          if (extension.kind !== category.kind) return false;
          if (!query) return true;
          return `${extension.name} ${extension.description} ${extension.pluginId} ${extension.version}`.toLocaleLowerCase().includes(query);
        })
      }))
      .filter((group) => group.items.length > 0);
  }, [extensionKindFilter, extensionSearch, extensions]);
  const visibleExtensionCount = extensionCatalogGroups.reduce((count, group) => count + group.items.length, 0);
  const sectionLoadsRef = useRef(new Map<SectionId, Promise<void>>());
  const healthRequestRef = useRef<Promise<ServerHealth> | null>(null);
  const healthValueRef = useRef<ServerHealth | null>(null);
  const extensionsRequestRef = useRef<Promise<Awaited<ReturnType<typeof loadAiExtensions>>> | null>(null);
  const extensionsValueRef = useRef<Awaited<ReturnType<typeof loadAiExtensions>> | null>(null);
  const settingsContentScrollReady = !SETTINGS_DATA_SECTIONS.has(activeSection)
    || loadedSectionsRef.current.has(activeSection)
    || Boolean(cachedSettingsData?.loadedSections.has(activeSection))
    || Boolean(sectionErrors[activeSection]);
  const settingsContentScroll = useScrollRestoration(
    createScrollRestorationKey(user.id, "settings-content", activeSection),
    settingsContentScrollReady,
    "element",
    legacySettingsScrollPositionStorageKey(user.id, activeSection)
  );
  const standaloneWorkspaceContent = standalonePluginWorkspace && (activeSection === "plugins" || activeSection === "connections");
  const pluginWorkspacePanelLabelledBy = standaloneWorkspaceContent && standalonePluginView
    ? `plugin-manager-${standalonePluginView}-tab`
    : `settings-plugin-tab-${pluginWorkspaceTab}`;

  useEffect(() => {
    if (!standalonePluginWorkspace || !standalonePluginView) return;
    const view = resolveStandalonePluginWorkspaceView(standalonePluginView);
    setPluginWorkspaceTab(view.tab);
    setExtensionKindFilter(view.kind);
    if (view.tab === "knowledge") setKnowledgeLibraryOpened(true);
  }, [standalonePluginWorkspace, standalonePluginView]);
  const settingsNavigationScroll = useScrollRestoration(createScrollRestorationKey(user.id, "settings-navigation"));

  useEffect(() => {
    if (activeSection !== "browser") return;
    const controller = new AbortController();
    setBrowserProviders(current => ({ ...current, status: "loading", error: "" }));
    void loadBrowserProviders(controller.signal).then(result => {
      if (!controller.signal.aborted) setBrowserProviders({ status: "ready", providers: result.providers, error: "" });
    }).catch(reason => {
      if (!controller.signal.aborted) setBrowserProviders(current => ({ ...current, status: "error", error: getErrorMessage(reason) }));
    });
    return () => controller.abort();
  }, [activeSection]);

  useEffect(() => {
    if (activeSection !== resolveSettingsSection("ai")) return;
    const controller = new AbortController();
    setLocalModelsLoading(true);
    setLocalModelsError("");
    void loadLocalModels(controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setLocalModels(result.models);
      setLocalModelDownload(result.activeDownload);
    }).catch(reason => {
      if (!controller.signal.aborted) setLocalModelsError(getErrorMessage(reason));
    }).finally(() => {
      if (!controller.signal.aborted) setLocalModelsLoading(false);
    });
    return () => controller.abort();
  }, [activeSection]);

  useEffect(() => {
    if (activeSection !== resolveSettingsSection("ai") || !localModelDownload || !["queued", "downloading"].includes(localModelDownload.status)) return;
    let cancelled = false;
    let timer: number | null = null;
    const poll = async () => {
      try {
        const result = await readLocalModelDownload(localModelDownload.id);
        if (cancelled) return;
        setLocalModelDownload(result.download);
        if (result.download.status === "completed") void refreshLocalModelLibrary();
        else if (result.download.status === "queued" || result.download.status === "downloading") timer = window.setTimeout(() => void poll(), 1_500);
      } catch (reason) {
        if (cancelled) return;
        setLocalModelsError(getErrorMessage(reason));
        timer = window.setTimeout(() => void poll(), 4_000);
      }
    };
    timer = window.setTimeout(() => void poll(), 1_000);
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [activeSection, localModelDownload?.id, localModelDownload?.status]);

  useEffect(() => {
    if (activeSection !== "about") {
      cancelWebUpdateCheck();
      setCheckingWebUpdates(false);
      return;
    }
    let active = true;
    const getRuntimeInfo = window.lfaaDesktop?.getUpdateRuntimeInfo;
    const getUpdatePreferences = window.lfaaDesktop?.getUpdatePreferences;
    setDesktopUpdatePreferences(null);
    if (getUpdatePreferences) {
      void getUpdatePreferences().then(preferences => {
        if (active) setDesktopUpdatePreferences(preferences);
      }).catch(() => {
        if (active) setDesktopUpdatePreferences({ autoDownloadAndInstall: false });
      });
    }
    if (!getRuntimeInfo) {
      setDesktopUpdateRuntime({ supported: false, currentVersion: isDesktopApp() ? "" : lfaaProjectBuildInfo?.currentVersion ?? "" });
      return () => {
        active = false;
        cancelWebUpdateCheck(false);
      };
    }
    void getRuntimeInfo().then((runtime) => {
      if (active) setDesktopUpdateRuntime(runtime);
    }).catch(() => {
      if (active) setDesktopUpdateRuntime({ supported: false, currentVersion: "" });
    });
    return () => {
      active = false;
      cancelWebUpdateCheck(false);
    };
  }, [activeSection]);

  async function checkDesktopUpdates(): Promise<void> {
    const checkForUpdates = window.lfaaDesktop?.checkForUpdates;
    if (!checkForUpdates) return;
    setCheckingDesktopUpdates(true);
    setDesktopUpdateResult(null);
    try {
      const result = await checkForUpdates();
      setDesktopUpdateResult(result);
      if (result.status === "error") messageApi.error(result.message || "检查更新失败，请查看桌面日志。 ");
    } catch (checkError) {
      const errorMessage = getErrorMessage(checkError);
      setDesktopUpdateResult({
        status: "error",
        currentVersion: desktopUpdateRuntime?.currentVersion ?? "",
        message: errorMessage
      });
      messageApi.error(errorMessage);
    } finally {
      setCheckingDesktopUpdates(false);
    }
  }

  async function setDesktopAutoUpdatePreference(enabled: boolean): Promise<void> {
    const setPreference = window.lfaaDesktop?.setAutoUpdateAndInstall;
    if (!setPreference || savingDesktopAutoUpdate) return;
    setSavingDesktopAutoUpdate(true);
    try {
      setDesktopUpdatePreferences(await setPreference(enabled));
      messageApi.success(enabled ? "已开启后续版本自动下载安装" : "已关闭自动更新");
    } catch {
      messageApi.error("本机更新设置未保存，请重试。");
    } finally {
      setSavingDesktopAutoUpdate(false);
    }
  }

  async function checkWebUpdates(): Promise<void> {
    if (!lfaaProjectBuildInfo?.currentVersion || !lfaaProjectBuildInfo.updateManifestUrl
      || !lfaaProjectBuildInfo.feedUrl || !lfaaProjectBuildInfo.releasePage || webUpdateRequestRef.current) return;
    const controller = new AbortController();
    webUpdateRequestRef.current = controller;
    setCheckingWebUpdates(true);
    setWebUpdateResult(null);
    webUpdateTimeoutRef.current = setTimeout(() => {
      controller.abort(new DOMException("连接 LFAA 官方更新源超时。", "TimeoutError"));
    }, 8_000);
    try {
      const response = await fetch(lfaaProjectBuildInfo.updateManifestUrl, {
        method: "GET",
        mode: "cors",
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        headers: { Accept: "application/json" },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`官方更新清单请求失败（HTTP ${response.status}）。`);
      const input: unknown = await response.json();
      const result = inspectWebUpdateManifest(input, {
        currentVersion: lfaaProjectBuildInfo.currentVersion,
        expectedFeedUrl: lfaaProjectBuildInfo.feedUrl,
        expectedReleasePage: lfaaProjectBuildInfo.releasePage
      });
      if (webUpdateRequestRef.current === controller) setWebUpdateResult(result);
    } catch (error) {
      if (webUpdateRequestRef.current !== controller) return;
      const reason = controller.signal.reason;
      const errorMessage = controller.signal.aborted && reason instanceof Error
        ? reason.message
        : getErrorMessage(error);
      setWebUpdateResult({
        status: "error",
        currentVersion: lfaaProjectBuildInfo.currentVersion,
        message: errorMessage
      });
    } finally {
      if (webUpdateRequestRef.current === controller) {
        webUpdateRequestRef.current = null;
        if (webUpdateTimeoutRef.current) clearTimeout(webUpdateTimeoutRef.current);
        webUpdateTimeoutRef.current = null;
        setCheckingWebUpdates(false);
      }
    }
  }

  function cancelWebUpdateCheck(resetState = true): void {
    const controller = webUpdateRequestRef.current;
    if (!controller) return;
    webUpdateRequestRef.current = null;
    controller.abort();
    if (webUpdateTimeoutRef.current) clearTimeout(webUpdateTimeoutRef.current);
    webUpdateTimeoutRef.current = null;
    if (resetState) setCheckingWebUpdates(false);
  }

  function loadHealthOnce(): Promise<ServerHealth> {
    if (healthValueRef.current) return Promise.resolve(healthValueRef.current);
    if (!healthRequestRef.current) {
      const request = loadHealth().then((result) => {
        healthValueRef.current = result;
        setHealth(result);
        return result;
      });
      const trackedRequest = request.finally(() => {
        if (healthRequestRef.current === trackedRequest) healthRequestRef.current = null;
      });
      healthRequestRef.current = trackedRequest;
    }
    return healthRequestRef.current;
  }

  function loadExtensionsOnce(): Promise<Awaited<ReturnType<typeof loadAiExtensions>>> {
    if (extensionsValueRef.current) return Promise.resolve(extensionsValueRef.current);
    if (!extensionsRequestRef.current) {
      const request = loadAiExtensions().then((result) => {
        extensionsValueRef.current = result;
        setExtensions(result.extensions);
        setRuntimePlugins(result.plugins);
        setHotReloadEnabled(result.hotReloadEnabled);
        setRuntimeHooks(result.hooks);
        return result;
      });
      const trackedRequest = request.finally(() => {
        if (extensionsRequestRef.current === trackedRequest) extensionsRequestRef.current = null;
      });
      extensionsRequestRef.current = trackedRequest;
    }
    return extensionsRequestRef.current;
  }

  useEffect(() => {
    if (settingsRef.current === workbenchSettings) return;
    persistedSettingsRef.current = workbenchSettings;
    settingsRef.current = workbenchSettings;
    setSettings(workbenchSettings);
  }, [workbenchSettings]);

  useEffect(() => {
    setEmailDraft(user.email ?? "");
  }, [user.email]);

  useEffect(() => {
    setUsernameDraft(user.username);
  }, [user.username]);

  useEffect(() => {
    if (activeSection === "security") return;
    // 离开安全分类时清除表单内的密码和恢复密钥，避免敏感值留在设置页状态中。
    setEmailCurrentPassword("");
    setUsernameCurrentPassword("");
    setPasswordChangeCurrent("");
    setPasswordChangeNext("");
    setPasswordChangeConfirmation("");
    setRecoveryCurrentPassword("");
    setRecoveryKey("");
    setRecoveryKeyConfirmation("");
  }, [activeSection]);

  useEffect(() => {
    if (standalonePluginWorkspace) return;
    saveWorkbenchLeftWidth(sidebarWidth, layout.left);
  }, [layout.left.max, layout.left.min, sidebarWidth, standalonePluginWorkspace]);

  useEffect(() => {
    if (standalonePluginWorkspace) return;
    persistSettingsSection(activeSection, user.id);
  }, [activeSection, standalonePluginWorkspace, user.id]);

  useEffect(() => {
    const requestedSection = sectionRequest?.section;
    if (standalonePluginWorkspace || !requestedSection) return;
    const targetSection = resolveSettingsSection(requestedSection);
    setActiveSection(targetSection);
    const group = sections.find((item) => item.id === targetSection)?.group;
    if (group) setExpandedSettingsGroups((current) => new Set(current).add(group));
    persistSettingsSection(targetSection, user.id);
  }, [sectionRequest?.requestId, standalonePluginWorkspace, user.id]);

  useEffect(() => {
    const targetId = sectionRequest?.focusTarget;
    if (standalonePluginWorkspace || !targetId || sectionRequest?.section !== "ai" || activeSection !== resolveSettingsSection("ai")) return;
    const frame = window.requestAnimationFrame(() => document.getElementById(targetId)?.scrollIntoView({ block: "center" }));
    return () => window.cancelAnimationFrame(frame);
  }, [activeSection, sectionRequest?.focusTarget, sectionRequest?.requestId, sectionRequest?.section, standalonePluginWorkspace]);

  useEffect(() => {
    if (!isAccountSettingsSection(activeSection)) return;
    // 账号页也能从外部入口打开；进入时清空旧筛选，恢复完整的设置分类导航。
    setSearch("");
    setSearchExpandedSettingsGroups(new Set());
  }, [activeSection]);

  useEffect(() => {
    try {
      const collapsedGroups = SETTINGS_NAV_GROUPS.filter((group) => !expandedSettingsGroups.has(group));
      window.localStorage.setItem(settingsNavCollapsedGroupsStorageKey(user.id), JSON.stringify(collapsedGroups));
    } catch {
      // 导航展开状态只是本机界面偏好；存储不可用时仍可在当前设置页中展开和收起。
    }
  }, [expandedSettingsGroups, user.id]);

  useEffect(() => {
    try {
      window.localStorage.setItem(settingsAppearanceAdvancedStorageKey(user.id), String(appearanceAdvancedOpen));
    } catch {
      // 展开状态只影响内容布局；本地存储不可用时仍能正常查看和编辑设置。
    }
  }, [appearanceAdvancedOpen, user.id]);

  useEffect(() => {
    try {
      window.localStorage.setItem(settingsBackgroundTargetStorageKey(user.id), backgroundTarget);
    } catch {
      // 目标选择只是界面偏好；本地存储不可用时回退到登录页背景。
    }
  }, [backgroundTarget, user.id]);

  useEffect(() => {
    const snapshot = settingsDataSnapshots.get(cacheKey) ?? createEmptySettingsDataSnapshot();
    Object.assign(snapshot, {
      providers, accounts, extensions, runtimePlugins, capabilityInstallCatalog, hotReloadEnabled, runtimeHooks, usage, pendingApprovals, permissionGrants,
      archivedSessions, health, steamcmdNodes, steamcmdConfigurationDefaultsConfigured, steamcmdConfigurationDefaults,
      projectStorageLocations,
      selectedSteamcmdConfigurationNodeId, steamcmdConfigurationDraft, steamcmdStorageDefaultsConfigured, steamcmdStorageDefaults,
      selectedSteamcmdStorageNodeId, selectedMinecraftStorageNodeId, selectedSteamcmdInstallNodeId, steamcmdStorageDraft,
      minecraftStorageNodes, minecraftStorageDefaultsConfigured, minecraftStorageDefaults, minecraftStorageDraft,
      uploadedBackgrounds
    });
    settingsDataSnapshots.set(cacheKey, snapshot);
  }, [accounts, archivedSessions, cacheKey, capabilityInstallCatalog, extensions, health, hotReloadEnabled, minecraftStorageDefaults, minecraftStorageDefaultsConfigured, minecraftStorageDraft, minecraftStorageNodes, pendingApprovals, permissionGrants, projectStorageLocations, providers, runtimeHooks, runtimePlugins, selectedMinecraftStorageNodeId, selectedSteamcmdConfigurationNodeId, selectedSteamcmdInstallNodeId, selectedSteamcmdStorageNodeId, steamcmdConfigurationDefaults, steamcmdConfigurationDefaultsConfigured, steamcmdConfigurationDraft, steamcmdNodes, steamcmdStorageDefaults, steamcmdStorageDefaultsConfigured, steamcmdStorageDraft, uploadedBackgrounds, usage]);

  function selectSection(section: SectionId): void {
    // 账号页含有多个凭据输入项；进入该组时清除旧搜索，避免浏览器自动填充后隐藏导航分类。
    if (isAccountSettingsSection(section) && search) {
      setSearch("");
      setSearchExpandedSettingsGroups(new Set());
    }
    setActiveSection(section);
    setDeveloperHandbookOpen(false);
    // 手机布局将分类导航作为覆盖层；选择分类后回到正文，避免页面保持隐藏状态。
    if (layout.mode === "mobile") setSidebarCollapsed(true);
    if (section === "plugins") setPluginWorkspaceTab("overview");
    if (section === "connections") setPluginWorkspaceTab("mcp");
    const group = sections.find((item) => item.id === section)?.group;
    if (group) {
      setExpandedSettingsGroups((current) => new Set(current).add(group));
      if (search.trim()) setSearchExpandedSettingsGroups((current) => new Set(current).add(group));
    }
    if (!standalonePluginWorkspace) persistSettingsSection(section, user.id);
  }

  function toggleSettingsGroup(group: string): void {
    const update = (current: Set<string>) => {
      const next = new Set(current);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    };
    if (search.trim()) setSearchExpandedSettingsGroups(update);
    else setExpandedSettingsGroups(update);
  }

  useEffect(() => {
    const refreshNotificationPermission = () => setNotificationPermission(getBrowserNotificationPermission());
    window.addEventListener("focus", refreshNotificationPermission);
    document.addEventListener("visibilitychange", refreshNotificationPermission);
    return () => {
      window.removeEventListener("focus", refreshNotificationPermission);
      document.removeEventListener("visibilitychange", refreshNotificationPermission);
    };
  }, []);

  useEffect(() => {
    if (activeSection !== "general" && activeSection !== "environment") return;
    const controller = new AbortController();
    setDefaultWorkspaceLocation({ status: "loading", path: null, error: "" });
    void loadWorkspaceProjects({ appId: "workspace", signal: controller.signal }).then(({ projects, defaultProjectId }) => {
      if (controller.signal.aborted) return;
      const defaultProject = defaultProjectId ? projects.find(project => project.id === defaultProjectId) : undefined;
      setDefaultWorkspaceLocation({ status: "ready", path: defaultProject?.path ?? null, error: "" });
    }).catch(loadError => {
      if (controller.signal.aborted) return;
      setDefaultWorkspaceLocation({ status: "error", path: null, error: getErrorMessage(loadError) });
    });
    return () => controller.abort();
  }, [activeSection, defaultWorkspaceReload]);

  useEffect(() => {
    if (activeSection !== "personalization") return;
    let active = true;
    setConversationMemorySnapshot(null);
    setConversationMemoryDraft("");
    setLoadingConversationMemories(true);
    void loadConversationMemories().then(({ snapshot }) => {
      if (!active) return;
      setConversationMemorySnapshot(snapshot);
      setConversationMemoryDraft(snapshot.memories.join("\n"));
    }).catch(loadError => {
      if (active) messageApi.error(`读取对话记忆失败：${getErrorMessage(loadError)}`);
    }).finally(() => {
      if (active) setLoadingConversationMemories(false);
    });
    return () => { active = false; };
  }, [activeSection, user.id, messageApi]);

  // 窄屏先展示设置内容；切回宽屏时保留用户手动选择的导航状态。
  useEffect(() => {
    if (layout.mode === "mobile") setSidebarCollapsed(true);
  }, [layout.mode]);

  const selectedProvider = providers.find((provider) => provider.id === providerId);
  const currentProviderOptions = providerOptions[providerId] ?? {};
  const providerSecretLabel = selectedProvider?.secretLabel ?? (providerId === "xiaomi" && currentProviderOptions.authMethod === "token-plan" ? "Token Plan Key" : "API Key");
  const isManualPlanProvider = selectedProvider?.scope === "user" && selectedProvider.modelInput === "manual";
  const systemAiAccounts = accounts.filter(account => account.scope !== "user");
  const personalPlanAccounts = accounts.filter(account => account.scope === "user");
  const effectiveActiveAiAccount = personalPlanAccounts.find(account => account.active) ?? systemAiAccounts.find(account => account.active);
  const selectedModelDetails = probe?.models.find((model) => model.id === selectedModel);
  const selectedModelReasoningOptions = reasoningOptions(selectedModelDetails);
  const conversationMemoryDraftItems = conversationMemoryDraft.split(/\r?\n/u).map(value => value.trim()).filter(Boolean);
  const conversationMemoryDraftUniqueCount = new Set(conversationMemoryDraftItems.map(value => value.toLocaleLowerCase("zh-CN"))).size;
  const conversationMemoryDraftOverLimit = conversationMemoryDraftItems.length > 16 || conversationMemoryDraftUniqueCount !== conversationMemoryDraftItems.length
    || conversationMemoryDraftItems.some(value => value.length > 240)
    || conversationMemoryDraftItems.reduce((total, value) => total + value.length, 0) > 2400;

  useEffect(() => {
    const section = activeSection;
    if (!SETTINGS_DATA_SECTIONS.has(section)) {
      setLoadingSection(null);
      return;
    }
    if (loadedSectionsRef.current.has(section)) {
      setLoadingSection((current) => current === section ? null : current);
      return;
    }

    let active = true;
    if (cachedSettingsData?.loadedSections.has(section)) setLoadingSection((current) => current === section ? null : current);
    else setLoadingSection(section);
    setSectionErrors((current) => ({ ...current, [section]: undefined }));

    let request = sectionLoadsRef.current.get(section);
    if (!request) {
      request = (async () => {
        switch (section) {
          case "appearance": {
            const result = await loadAppearanceBackgrounds();
            setUploadedBackgrounds(result.backgrounds);
            break;
          }
          case "ai": {
            if (!cachedSettingsData?.loadedSections.has("ai")) setAiAccountsLoadState("loading");
            try {
              const [providersResult, accountsResult, claudeCredentialResult] = await Promise.all([
                loadAiProviders(),
                loadAiAccounts(),
                loadClaudeAgentCredentialStatus()
              ]);
              setProviders(providersResult.providers);
              setAccounts(accountsResult.accounts);
              setClaudeAgentCredentialStatus(claudeCredentialResult.credential);
              setAiAccountsLoadState("ready");
            } catch (loadError) {
              setAiAccountsLoadState("error");
              throw loadError;
            }
            void loadHealthOnce().catch(() => undefined);
            void loadExtensionsOnce().catch(() => undefined);
            break;
          }
          case "minecraft": {
            const catalog = await loadMinecraftCoreNames();
            setMinecraftCoreOptions(catalog.cores.map(name => ({ value: name, label: `${name}${name === "Paper" ? "（普通开服推荐）" : ""}` })));
            break;
          }
          case "plugins": {
            const [, capabilityResult] = await Promise.all([loadExtensionsOnce(), loadCapabilityInstallCatalog()]);
            setCapabilityInstallCatalog(capabilityResult.capabilities);
            break;
          }
          case "hooks": {
            await loadExtensionsOnce();
            break;
          }
          case "usage": {
            const result = await loadAiUsage();
            setUsage(result.usage);
            break;
          }
          case "archived": {
            const result = await loadAiSessions({ archived: true });
            setArchivedSessions(result.sessions);
            break;
          }
          case "permissions": {
            const [approvalResult, grantResult] = await Promise.all([
              loadAiApprovals(),
              loadAiPermissionGrants()
            ]);
            setPendingApprovals(approvalResult.approvals);
            setPermissionGrants(grantResult.grants);
            break;
          }
          case "workspace": {
            if (canAdmin) {
              const [, steamcmdResult, minecraftResult, projectStorageResult] = await Promise.all([
                loadHealthOnce(),
                loadSteamcmdSettings(),
                loadMinecraftStorageSettings(),
                loadProjectStorageLocations()
              ]);
              setProjectStorageLocations(projectStorageResult.settings);
              setContentDirectoryDraft(projectStorageResult.settings.contentDirectory);
              setContentDirectorySelection(projectStorageResult.settings.contentDirectory === projectStorageResult.settings.recommendedContentDirectory
                ? "recommended"
                : projectStorageResult.settings.contentDirectory === projectStorageResult.settings.defaultContentDirectory ? "default" : "custom");
              setSteamcmdNodes(steamcmdResult.nodes);
              setSteamcmdConfigurationDefaultsConfigured(steamcmdResult.configurationDefaultsConfigured);
              setSteamcmdConfigurationDefaults(steamcmdResult.configurationDefaults);
              setSteamcmdConfigurationDraft(steamcmdResult.configurationDefaults);
              setSelectedSteamcmdConfigurationNodeId("");
              setSteamcmdStorageDefaultsConfigured(steamcmdResult.storageDefaultsConfigured);
              setSteamcmdStorageDefaults(steamcmdResult.storageDefaults);
              setMinecraftStorageNodes(minecraftResult.nodes);
              setMinecraftStorageDefaultsConfigured(minecraftResult.defaultsConfigured);
              setMinecraftStorageDefaults(minecraftResult.defaults);
              setSelectedSteamcmdStorageNodeId("");
              setSelectedSteamcmdInstallNodeId("");
              setSteamcmdStorageDraft(steamcmdResult.storageDefaults);
              setMinecraftStorageDraft(minecraftResult.defaults);
            } else await loadHealthOnce();
            break;
          }
          case "developer": {
            await loadHealthOnce();
            break;
          }
        }
        loadedSectionsRef.current.add(section);
        const snapshot = settingsDataSnapshots.get(cacheKey) ?? createEmptySettingsDataSnapshot();
        snapshot.loadedSections.add(section);
        settingsDataSnapshots.set(cacheKey, snapshot);
      })().catch((loadError: unknown) => {
        setSectionErrors((current) => ({ ...current, [section]: getErrorMessage(loadError) }));
      }).finally(() => {
        sectionLoadsRef.current.delete(section);
      });
      sectionLoadsRef.current.set(section, request);
    }

    void request.then(() => {
      if (active) {
        setLoadingSection((current) => current === section ? null : current);
      }
    });

    return () => { active = false; };
  }, [activeSection, cacheKey, cachedSettingsData, user.role]);

  const visibleSections = useMemo(() => {
    const value = search.trim().toLocaleLowerCase();
    const settingsSections = sections.filter((section) => section.id !== "plugins" && section.id !== "connections" && section.id !== "wallpaperEngine" && section.id !== "profile" && section.id !== "security");
    const matchesSettingsSection = (section: typeof settingsSections[number]) => {
      return getSettingsSectionSearchText(section).toLocaleLowerCase().includes(value);
    };
    const isConfigurationMatch = (section: typeof settingsSections[number]) => LFAA_CONFIGURATION_SECTION_IDS.has(section.id)
      && (matchesSettingsSection(section) || "配置中心".includes(value));
    const matchingConfigurationSections = settingsSections.filter((section) => LFAA_CONFIGURATION_SECTION_IDS.has(section.id) && (!value || isConfigurationMatch(section)));
    const showConfigurationCenter = !value || matchingConfigurationSections.length > 0;
    const configurationEntrySection = matchingConfigurationSections.some((section) => section.id === activeSection)
      ? activeSection
      : matchingConfigurationSections[0]?.id ?? (LFAA_CONFIGURATION_SECTION_IDS.has(activeSection) ? activeSection : "ai");
    const configurationEntry = { id: configurationEntrySection, title: "配置中心", group: "LFAA 配置", icon: "settings" as const };
    const visible: typeof settingsSections = [];
    let configurationEntryAdded = false;
    for (const section of settingsSections) {
      if (LFAA_CONFIGURATION_SECTION_IDS.has(section.id)) {
        if (!configurationEntryAdded && showConfigurationCenter) {
          visible.push(configurationEntry);
          configurationEntryAdded = true;
        }
        continue;
      }
      if (!value || matchesSettingsSection(section)) visible.push(section);
    }
    return visible;
  }, [activeSection, search]);

  // 搜索时临时展开命中分类；清空后恢复用户保存的分组展开状态。
  function updateSettingsSearch(value: string): void {
    setSearch(value);
    const normalized = value.trim().toLocaleLowerCase();
    if (!normalized) {
      setSearchExpandedSettingsGroups(new Set());
      return;
    }
    setSearchExpandedSettingsGroups(new Set(sections
      .filter((section) => getSettingsSectionSearchText(section).toLocaleLowerCase().includes(normalized))
      .map((section) => section.group)));
  }

  const selectedSteamcmdConfigurationNode = steamcmdNodes.find((node) => node.id === selectedSteamcmdConfigurationNodeId) ?? null;
  const selectedSteamcmdStorageNode = steamcmdNodes.find((node) => node.id === selectedSteamcmdStorageNodeId) ?? null;
  const selectedMinecraftStorageNode = minecraftStorageNodes.find((node) => node.id === selectedMinecraftStorageNodeId) ?? null;
  const selectedSteamcmdInstallNode = steamcmdNodes.find((node) => node.id === selectedSteamcmdInstallNodeId) ?? null;
  const steamcmdGameDirectoryToDisplay = selectedSteamcmdStorageNode && !selectedSteamcmdStorageNode.storageConfigured
    ? selectedSteamcmdStorageNode.storage.gameDirectory
    : steamcmdStorageDraft.gameDirectory;
  const displayedSteamcmdGameDirectory = displaySteamcmdGamePath(selectedSteamcmdStorageNode, steamcmdGameDirectoryToDisplay, projectStorageLocations?.contentDirectory);
  const selectedSteamcmdInstallNodeCanRunTasks = Boolean(selectedSteamcmdInstallNode
    && selectedSteamcmdInstallNode.status === "online"
    && selectedSteamcmdInstallNode.platform === "win32"
    && selectedSteamcmdInstallNode.architecture === "x64"
    && selectedSteamcmdInstallNode.capabilities.includes("node-filesystem-v1"));

  function updateSteamcmdConfigurationDraft<K extends keyof typeof steamcmdConfigurationDraft>(key: K, value: (typeof steamcmdConfigurationDraft)[K]): void {
    setSteamcmdConfigurationDraft((current) => ({ ...current, [key]: value }));
  }

  function selectSteamcmdConfigurationNode(nodeId: string): void {
    if (nodeId === "__defaults__") {
      setSelectedSteamcmdConfigurationNodeId("");
      setSteamcmdConfigurationDraft(steamcmdConfigurationDefaults);
      return;
    }
    const node = steamcmdNodes.find((item) => item.id === nodeId);
    if (!node) return;
    setSelectedSteamcmdConfigurationNodeId(nodeId);
    setSteamcmdConfigurationDraft({ ...node.configuration });
  }

  // Steam 游戏和 Minecraft 由不同业务接口持久化，各自的范围选择只重置自己的草稿。
  function selectSteamcmdStorageNode(nodeId: string): void {
    if (nodeId === "__defaults__") {
      setSelectedSteamcmdStorageNodeId("");
      setSteamcmdStorageDraft(steamcmdStorageDefaults);
      return;
    }
    const node = steamcmdNodes.find((item) => item.id === nodeId);
    if (!node) return;
    setSelectedSteamcmdStorageNodeId(nodeId);
    // 节点未覆盖时保留相对默认值，让本机路径继续跟随当前业务内容根。
    setSteamcmdStorageDraft(node.storageConfigured ? { ...node.storage } : { ...steamcmdStorageDefaults });
  }

  function selectMinecraftStorageNode(nodeId: string): void {
    if (nodeId === "__defaults__") {
      setSelectedMinecraftStorageNodeId("");
      setMinecraftStorageDraft(minecraftStorageDefaults);
      return;
    }
    const node = minecraftStorageNodes.find((item) => item.id === nodeId);
    if (!node) return;
    setSelectedMinecraftStorageNodeId(nodeId);
    setMinecraftStorageDraft({ instanceDirectory: node.instanceDirectory });
  }

  async function persistSteamcmdConfigurationDraft(): Promise<void> {
    if (!selectedSteamcmdConfigurationNodeId) {
      const { settings: savedSettings } = await saveSteamcmdConfigurationDefaults(steamcmdConfigurationDraft);
      setSteamcmdConfigurationDraft(savedSettings);
      setSteamcmdConfigurationDefaults(savedSettings);
      setSteamcmdConfigurationDefaultsConfigured(true);
      setSteamcmdNodes((current) => current.map((node) => node.configurationConfigured ? node : { ...node, configuration: { ...node.configuration, ...savedSettings } }));
      return;
    }
    const { settings: savedSettings } = await saveSteamcmdNodeConfiguration(selectedSteamcmdConfigurationNodeId, steamcmdConfigurationDraft);
    setSteamcmdConfigurationDraft({ installMode: savedSettings.installMode, steamcmdDirectory: savedSettings.steamcmdDirectory });
    setSteamcmdNodes((current) => current.map((node) => node.id === selectedSteamcmdConfigurationNodeId
      ? { ...node, configuration: { ...node.configuration, ...savedSettings }, configurationConfigured: true, steamcmdInstalled: node.configuration.steamcmdDirectory === savedSettings.steamcmdDirectory && node.steamcmdInstalled }
      : node));
  }




  function selectedContentDirectory(): string {
    if (!projectStorageLocations) return "";
    if (contentDirectorySelection === "default") return projectStorageLocations.defaultContentDirectory;
    if (contentDirectorySelection === "recommended") return projectStorageLocations.recommendedContentDirectory;
    const draft = contentDirectoryDraft.trim();
    if (!draft) return "";
    if (draft.toLocaleLowerCase() === projectStorageLocations.contentDirectory.toLocaleLowerCase()) return draft;
    const separator = draft.includes("\\") ? "\\" : "/";
    const trimmed = draft.replace(/[\\/]+$/u, "") || (draft.startsWith("/") ? "/" : "");
    const finalSegment = trimmed.split(/[\\/]/u).pop()?.toLocaleLowerCase() ?? "";
    return finalSegment === "data" ? trimmed : `${trimmed}${separator}data`;
  }

  function applyContentStorageResult(saved: ProjectStorageLocations): void {
    setProjectStorageLocations(saved);
    setContentDirectoryDraft(saved.contentDirectory);
    setContentDirectorySelection(saved.contentDirectory === saved.recommendedContentDirectory
      ? "recommended"
      : saved.contentDirectory === saved.defaultContentDirectory ? "default" : "custom");
    setContentComparison(null);
  }

  async function saveContentStorageSelection(): Promise<void> {
    if (!projectStorageLocations || !canEditContentDirectory) return;
    const directory = selectedContentDirectory();
    if (!directory.trim()) return;
    if (directory.toLocaleLowerCase() === projectStorageLocations.contentDirectory.toLocaleLowerCase()) {
      messageApi.info("当前已经使用这个业务内容目录，无需迁移。");
      return;
    }
    setContentStorageAction(contentMigrationMode === "archive" ? "import" : "save");
    try {
      const result = contentMigrationMode === "copy"
        ? await copyProjectContentToDirectory(directory)
        : contentMigrationMode === "adopt"
        ? await adoptProjectContentDirectory(directory)
        : await importProjectContentArchive(contentArchivePath, directory);
      if (!result.settings.configured) throw new Error("内容目录复制、核对成功，但新位置未保存；原位置仍保持生效。");
      applyContentStorageResult(result.settings.settings);
      const restartMessage = result.settings.settings.restartRequired ? "重启 LFAA 后，控制端和本机 Daemon 才会统一使用新业务 Data 根。" : "当前运行已使用所选业务 Data 根。";
      if (contentMigrationMode === "copy") {
        messageApi.success(result.backupDirectory
          ? `业务内容已复制、校验并切换。源目录保留；目标原内容备份在 ${result.backupDirectory}。${restartMessage}`
          : `业务内容已复制、校验并切换；源目录保留。目标没有需要备份的旧业务文件。${restartMessage}`);
      } else if (contentMigrationMode === "adopt") messageApi.success(`手动复制的业务内容已通过 SHA-256 核对并切换；原目录保留。${restartMessage}`);
      else messageApi.success(`ZIP 中的业务内容已导入、校验并切换；系统数据与插件 Profile 未导入。${restartMessage}`);
    } catch (saveError) {
      messageApi.error(getErrorMessage(saveError));
    } finally {
      setContentStorageAction(null);
    }
  }

  async function compareSelectedContentDirectory(): Promise<void> {
    const directory = selectedContentDirectory();
    if (!directory.trim() || !canEditContentDirectory) return;
    setContentStorageAction("compare");
    try {
      const comparison = await compareProjectContentDirectories(directory);
      setContentComparison(comparison);
      messageApi[comparison.matching ? "success" : "warning"](comparison.matching
        ? "文件和文件夹清单及 SHA-256 全部一致，可以切换位置。"
        : `发现 ${comparison.differenceCount} 处差异；核对通过前不会切换位置。`);
    } catch (compareError) { messageApi.error(getErrorMessage(compareError)); }
    finally { setContentStorageAction(null); }
  }

  async function exportProjectContentArchive(): Promise<void> {
    if (!canEditContentDirectory) return;
    setContentStorageAction("export");
    try {
      const archive = await downloadProjectContentArchive();
      const url = URL.createObjectURL(archive);
      const link = document.createElement("a");
      link.href = url;
      link.download = `lfaa-business-content-${new Date().toISOString().slice(0, 10)}.zip`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      messageApi.success("业务内容 ZIP 已生成并开始下载。");
    } catch (exportError) { messageApi.error(getErrorMessage(exportError)); }
    finally { setContentStorageAction(null); }
  }

  async function chooseContentDirectory(): Promise<void> {
    if (!canEditContentDirectory) return;
    try {
      const selectedDirectory = await selectDesktopDataDirectory();
      if (selectedDirectory) {
        setContentDirectoryDraft(selectedDirectory);
        setContentDirectorySelection("custom");
      }
    } catch (selectionError) {
      messageApi.error(getErrorMessage(selectionError));
    }
  }

  async function saveSteamcmdConfiguration(): Promise<void> {
    setSteamcmdAction("save-configuration");
    try {
      await persistSteamcmdConfigurationDraft();
      messageApi.success(selectedSteamcmdConfigurationNodeId ? "当前 daemon 节点的 SteamCMD 安装配置已保存。" : "SteamCMD 默认安装配置已保存；新 daemon 节点会继承。");
    } catch (saveError) {
      messageApi.error(getErrorMessage(saveError));
    } finally {
      setSteamcmdAction(null);
    }
  }

  async function saveSteamcmdStorage(): Promise<void> {
    setSteamcmdAction("save-storage");
    try {
      if (!selectedSteamcmdStorageNodeId) {
        const { settings: savedSettings } = await saveSteamcmdStorageDefaults(steamcmdStorageDraft);
        setSteamcmdStorageDefaults(savedSettings);
        setSteamcmdStorageDraft(savedSettings);
        setSteamcmdStorageDefaultsConfigured(true);
        const refreshedSettings = await loadSteamcmdSettings();
        setSteamcmdNodes(refreshedSettings.nodes);
        messageApi.success("Steam 游戏默认目录已保存；未单独覆盖的节点会继承此位置。");
      } else {
        const { settings: savedSettings } = await saveSteamcmdNodeStorageSettings(selectedSteamcmdStorageNodeId, steamcmdStorageDraft);
        setSteamcmdStorageDraft({ gameDirectory: savedSettings.gameDirectory });
        setSteamcmdNodes(current => current.map(node => node.id === selectedSteamcmdStorageNodeId
          ? { ...node, storage: { ...node.storage, ...savedSettings }, storageConfigured: true }
          : node));
        messageApi.success("当前 daemon 节点的 Steam 游戏目录已保存。");
      }
    } catch (saveError) {
      messageApi.error(getErrorMessage(saveError));
    } finally {
      setSteamcmdAction(null);
    }
  }

  async function submitSteamcmdTask(kind: "install" | "verify"): Promise<void> {
    if (!selectedSteamcmdInstallNode || !selectedSteamcmdInstallNodeCanRunTasks) {
      messageApi.error("请先选择在线且支持 SteamCMD 的 Windows x64 Daemon 节点。");
      return;
    }
    if (kind === "install" && selectedSteamcmdInstallNode.configuration.installMode !== "online") {
      messageApi.error("所选安装目标当前生效的 SteamCMD 模式是手动指定；请先切换并保存该节点或全局安装配置。");
      return;
    }
    setSteamcmdAction(kind);
    try {
      const { task } = await createSteamcmdTask({ nodeId: selectedSteamcmdInstallNode.id, kind });
      setSteamcmdTask(task);
      messageApi.info(kind === "install" ? "SteamCMD 安装任务已提交到所选节点。" : "SteamCMD 校验任务已提交到所选节点。");
    } catch (taskError) {
      messageApi.error(getErrorMessage(taskError));
    } finally {
      setSteamcmdAction(null);
    }
  }

  useEffect(() => {
    if (!steamcmdTask || steamcmdTask.status === "succeeded" || steamcmdTask.status === "failed") return;
    const taskId = steamcmdTask.id;
    let active = true;
    const poller = createReadPoller(async () => {
      try {
        const { task } = await loadSteamcmdTask(taskId);
        const recoveredNodes = task.status === "failed" ? await loadSteamcmdSettings().catch(() => null) : null;
        if (!active) return;
        setSteamcmdTask(task);
        if (task.status === "succeeded" || task.status === "failed") {
          if (task.status === "succeeded") {
            setSteamcmdNodes((current) => current.map((node) => node.id === task.nodeId ? { ...node, steamcmdInstalled: true } : node));
          } else {
            if (recoveredNodes) setSteamcmdNodes(recoveredNodes.nodes);
          }
        }
      } catch (loadError: unknown) {
        if (active) messageApi.error(getErrorMessage(loadError));
      }
    }, 1000);
    return () => { active = false; poller.stop(); };
  }, [steamcmdTask?.id, steamcmdTask?.status]);

  function clearSettingsAutoSave(category: keyof UserSettings): void {
    const timer = settingsAutoSaveTimersRef.current.get(category);
    if (timer !== undefined) window.clearTimeout(timer);
    settingsAutoSaveTimersRef.current.delete(category);
  }

  function restorePersistedSettings<K extends keyof UserSettings>(category: K, failedRevision: number): void {
    if ((settingsRevisionRef.current.get(category) ?? 0) !== failedRevision) return;
    const next = { ...settingsRef.current, [category]: persistedSettingsRef.current[category] } as UserSettings;
    settingsRevisionRef.current.set(category, failedRevision + 1);
    clearSettingsAutoSave(category);
    settingsRef.current = next;
    if (settingsPageMountedRef.current) {
      setSettings(next);
      onSettingsChange(next);
    }
  }

  function persistLatestSettings<K extends keyof UserSettings>(category: K): Promise<void> {
    const existingRequest = settingsSaveRequestsRef.current.get(category);
    if (existingRequest) return existingRequest;

    const request = (async () => {
      while (true) {
        if (category === "shortcuts" && hasShortcutConflicts(settingsRef.current.shortcuts)) {
          throw new Error("快捷键不能重复，请修改冲突项后再保存");
        }

        const revision = settingsRevisionRef.current.get(category) ?? 0;
        const value = settingsRef.current[category];
        let result: { settings: UserSettings };
        try {
          result = await saveSettings(category, value);
        } catch (saveError) {
          if ((settingsRevisionRef.current.get(category) ?? 0) !== revision) continue;
          restorePersistedSettings(category, revision);
          throw saveError;
        }

        if ((settingsRevisionRef.current.get(category) ?? 0) !== revision) continue;

        persistedSettingsRef.current = { ...persistedSettingsRef.current, [category]: result.settings[category] } as UserSettings;
        if (category === "appearance") cacheLoginAppearance(user.username, result.settings.appearance);
        const nextSettings: UserSettings = { ...settingsRef.current, [category]: result.settings[category] };
        settingsRef.current = nextSettings;
        if (settingsPageMountedRef.current) {
          setSettingsSaveErrors((current) => {
            if (!current[category]) return current;
            const next = { ...current };
            delete next[category];
            return next;
          });
          setSettings(nextSettings);
          onSettingsChange(nextSettings);
          if (category === "permissions") setPersistedPermissionMode(result.settings.permissions.mode);
        }
        return;
      }
    })();

    const trackedRequest = request.finally(() => {
      if (settingsSaveRequestsRef.current.get(category) === trackedRequest) {
        settingsSaveRequestsRef.current.delete(category);
      }
    });
    settingsSaveRequestsRef.current.set(category, trackedRequest);
    return trackedRequest;
  }

  function flushScheduledSettingsSaves(): void {
    for (const category of settingsAutoSaveTimersRef.current.keys()) {
      clearSettingsAutoSave(category);
      void persistLatestSettings(category).catch((saveError: unknown) => {
        if (settingsPageMountedRef.current) {
          const detail = getErrorMessage(saveError);
          setSettingsSaveErrors((current) => ({ ...current, [category]: detail }));
        }
      });
    }
  }

  function showSettingsSaveFeedback(status: "success" | "error", detail: string): void {
    if (!settingsPageMountedRef.current) return;
    if (settingsSaveFeedbackTimerRef.current !== null) window.clearTimeout(settingsSaveFeedbackTimerRef.current);
    const id = ++settingsSaveFeedbackSequenceRef.current;
    setSettingsSaveFeedback({ id, status, message: detail });
    settingsSaveFeedbackTimerRef.current = window.setTimeout(() => {
      setSettingsSaveFeedback(current => current?.id === id ? null : current);
      settingsSaveFeedbackTimerRef.current = null;
    }, status === "success" ? 2300 : 4200);
  }

  useEffect(() => {
    settingsPageMountedRef.current = true;
    const flush = () => flushScheduledSettingsSaves();
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      settingsPageMountedRef.current = false;
      if (settingsSaveFeedbackTimerRef.current !== null) {
        window.clearTimeout(settingsSaveFeedbackTimerRef.current);
        settingsSaveFeedbackTimerRef.current = null;
      }
      flush();
    };
  }, [user.id]);

  function scheduleSettingsAutoSave(category: keyof UserSettings): void {
    clearSettingsAutoSave(category);
    if (category === "shortcuts" && hasShortcutConflicts(settingsRef.current.shortcuts)) {
      setSettingsSaveErrors((current) => ({ ...current, [category]: "快捷键不能重复，请修改冲突项后再保存" }));
      return;
    }

    const timer = window.setTimeout(() => {
      settingsAutoSaveTimersRef.current.delete(category);
      void persistLatestSettings(category).catch((saveError: unknown) => {
        if (settingsPageMountedRef.current) {
          const detail = getErrorMessage(saveError);
          setSettingsSaveErrors((current) => ({ ...current, [category]: detail }));
        }
      });
    }, SETTINGS_AUTOSAVE_DELAY_MS);
    settingsAutoSaveTimersRef.current.set(category, timer);
  }

  function updateSettings<K extends keyof UserSettings>(category: K, value: UserSettings[K]): void {
    const previous = settingsRef.current;
    const next = { ...previous, [category]: value };
    settingsRevisionRef.current.set(category, (settingsRevisionRef.current.get(category) ?? 0) + 1);
    settingsRef.current = next;
    setSettings(next);
    onSettingsChange(next);
    scheduleSettingsAutoSave(category);
  }

  function updateGeneral(patch: Partial<UserSettings["general"]>): void {
    updateSettings("general", { ...settings.general, ...patch });
  }

  function updateAppearanceAdvanced(patch: Partial<UserSettings["appearance"]["advanced"]>): void {
    updateSettings("appearance", { ...settings.appearance, advanced: { ...settings.appearance.advanced, ...patch } });
  }

  function updateSelectedAreaEffects(patch: { overlay?: number | null; blur?: number | null }): void {
    const appearance = settingsRef.current.appearance;
    const areaEffects = {
      ...appearance.areaEffects,
      [backgroundTarget]: { ...appearance.areaEffects[backgroundTarget], ...patch }
    } as UserSettings["appearance"]["areaEffects"];
    updateSettings("appearance", { ...appearance, areaEffects });
  }

  function resetSelectedAreaEffects(): void {
    updateSelectedAreaEffects(DEFAULT_USER_SETTINGS.appearance.areaEffects[backgroundTarget]);
  }

  function updateAppearanceFonts(patch: Partial<UserSettings["appearance"]["advanced"]["fonts"]>): void {
    const advanced = settings.appearance.advanced;
    updateAppearanceAdvanced({ fonts: { ...advanced.fonts, ...patch } });
  }

  function updateAppearanceMode(mode: "light" | "dark", patch: Partial<UserSettings["appearance"]["advanced"]["modeStyles"]["light"]>): void {
    const advanced = settings.appearance.advanced;
    updateAppearanceAdvanced({ modeStyles: { ...advanced.modeStyles, [mode]: { ...advanced.modeStyles[mode], ...patch } } });
  }

  function updateAppearanceModeFonts(mode: "light" | "dark", patch: Partial<UserSettings["appearance"]["advanced"]["modeStyles"]["light"]["fonts"]>): void {
    const profile = settings.appearance.advanced.modeStyles[mode];
    updateAppearanceMode(mode, { fonts: { ...profile.fonts, ...patch } });
  }

  async function saveCurrentAppearancePreset(name: string): Promise<void> {
    if (appearancePresetBusy) throw new Error("请等待当前外观预设操作完成。");
    setAppearancePresetBusy(true);
    const normalizedName = name.trim();
    const current = settingsRef.current;
    try {
      if (!normalizedName) throw new Error("请填写预设名称。");
      if (current.appearance.presets.length >= APPEARANCE_PRESET_LIMIT) throw new Error(`最多保存 ${APPEARANCE_PRESET_LIMIT} 个自定义预设。`);
      const preset: AppearancePreset = {
        id: `preset-${crypto.randomUUID()}`,
        name: normalizedName,
        description: "保存当前外观与常规布局。",
        snapshot: createAppearancePresetSnapshot(current)
      };
      updateSettings("appearance", { ...current.appearance, presets: [...current.appearance.presets, preset] });
      clearSettingsAutoSave("appearance");
      await persistLatestSettings("appearance");
      showSettingsSaveFeedback("success", `已保存外观预设“${normalizedName}”。`);
    } finally {
      setAppearancePresetBusy(false);
    }
  }

  async function applySavedAppearancePreset(preset: AppearancePreset): Promise<void> {
    if (appearancePresetBusy) return;
    setAppearancePresetBusy(true);
    for (const category of ["appearance", "general"] as const) clearSettingsAutoSave(category);
    try {
      await Promise.all(["appearance", "general"].map((category) => settingsSaveRequestsRef.current.get(category as keyof UserSettings)).filter((request): request is Promise<void> => request !== undefined));
      const { settings: next } = await applyAppearancePresetRequest(preset.snapshot);
      for (const category of ["appearance", "general"] as const) {
        settingsRevisionRef.current.set(category, (settingsRevisionRef.current.get(category) ?? 0) + 1);
        setSettingsSaveErrors((current) => {
          if (!current[category]) return current;
          const nextErrors = { ...current };
          delete nextErrors[category];
          return nextErrors;
        });
      }
      persistedSettingsRef.current = next;
      settingsRef.current = next;
      setSettings(next);
      onSettingsChange(next);
      cacheLoginAppearance(user.username, next.appearance);
      showSettingsSaveFeedback("success", `已应用外观预设“${preset.name}”。`);
    } finally {
      setAppearancePresetBusy(false);
    }
  }

  async function applyWritingWorkspacePreset(): Promise<void> {
    if (appearancePresetBusy) return;
    setAppearancePresetBusy(true);
    clearSettingsAutoSave("appearance");
    try {
      const inFlightAppearanceSave = settingsSaveRequestsRef.current.get("appearance");
      if (inFlightAppearanceSave) await inFlightAppearanceSave;
      const current = settingsRef.current;
      updateSettings("appearance", applyWritingWorkspacePresetAppearance(current.appearance));
      clearSettingsAutoSave("appearance");
      await persistLatestSettings("appearance");
      showSettingsSaveFeedback("success", "已应用“云涧书境”到写作工作区。");
    } finally {
      setAppearancePresetBusy(false);
    }
  }

  async function deleteSavedAppearancePreset(preset: AppearancePreset): Promise<void> {
    if (appearancePresetBusy) throw new Error("请等待当前外观预设操作完成。");
    setAppearancePresetBusy(true);
    try {
      const current = settingsRef.current;
      updateSettings("appearance", { ...current.appearance, presets: current.appearance.presets.filter((item) => item.id !== preset.id) });
      clearSettingsAutoSave("appearance");
      await persistLatestSettings("appearance");
      showSettingsSaveFeedback("success", `已删除外观预设“${preset.name}”。`);
    } finally {
      setAppearancePresetBusy(false);
    }
  }

  async function exportSavedAppearancePreset(preset: AppearancePreset): Promise<void> {
    if (appearancePresetBusy) throw new Error("请等待当前外观预设操作完成。");
    setAppearancePresetBusy(true);
    try {
      const archive = await createAppearancePresetFile(preset, async (id) => {
        const background = uploadedBackgrounds.find((item) => item.id === id);
        if (!background) throw new Error("预设引用的账户背景素材已不可用，请先恢复素材后再导出。");
        return { name: background.name, mimeType: background.mimeType, blob: await downloadAppearanceBackground(id) };
      });
      const url = URL.createObjectURL(archive);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = appearancePresetDownloadName(preset.name);
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      messageApi.success(`已导出外观预设“${preset.name}”。`);
    } finally {
      setAppearancePresetBusy(false);
    }
  }

  async function importAppearancePresetFile(file: File): Promise<void> {
    if (appearancePresetBusy) throw new Error("请等待当前外观预设操作完成。");
    setAppearancePresetBusy(true);
    try {
      const imported = await parseAppearancePresetFile(file);
      const current = settingsRef.current;
      if (current.appearance.presets.length >= APPEARANCE_PRESET_LIMIT) throw new Error(`最多保存 ${APPEARANCE_PRESET_LIMIT} 个自定义预设。`);
      await validateAppearancePresetSnapshot(imported.snapshot);
      const importedResult = await importAppearancePresetWithAssets(imported, {
        upload: async (asset) => {
          const importedFile = new File([asset.blob], asset.name, { type: asset.mimeType });
          const result = await uploadAppearanceBackground(importedFile);
          return result.background;
        },
        remove: deleteAppearanceBackground,
        commit: async (snapshot) => {
          const preset: AppearancePreset = {
            id: `preset-${crypto.randomUUID()}`,
            name: imported.name,
            description: imported.description,
            snapshot
          };
          const latest = settingsRef.current;
          if (latest.appearance.presets.length >= APPEARANCE_PRESET_LIMIT) throw new Error(`最多保存 ${APPEARANCE_PRESET_LIMIT} 个自定义预设。`);
          updateSettings("appearance", { ...latest.appearance, presets: [...latest.appearance.presets, preset] });
          clearSettingsAutoSave("appearance");
          try {
            await persistLatestSettings("appearance");
          } catch (saveError) {
            let confirmed: UserSettings;
            try { confirmed = (await loadSettings()).settings; }
            catch {
              throw new AppearancePresetCommitUncertainError("预设保存状态无法确认。为避免破坏可能已保存的预设，背景素材已保留；请刷新页面检查预设列表。");
            }
            if (!confirmed.appearance.presets.some((item) => item.id === preset.id)) throw saveError;
            persistedSettingsRef.current = confirmed;
            settingsRef.current = confirmed;
            if (settingsPageMountedRef.current) {
              setSettings(confirmed);
              onSettingsChange(confirmed);
            }
            cacheLoginAppearance(user.username, confirmed.appearance);
          }
          return preset;
        }
      });
      setUploadedBackgrounds((currentBackgrounds) => [...importedResult.assets, ...currentBackgrounds]);
      showSettingsSaveFeedback("success", `已导入外观预设“${importedResult.value.name}”。`);
    } finally {
      setAppearancePresetBusy(false);
    }
  }

  async function persistToolbarSettingsNow(): Promise<void> {
    const categories = new Set<keyof UserSettings>([
      ...settingsAutoSaveTimersRef.current.keys(),
      ...settingsSaveRequestsRef.current.keys()
    ]);
    if (activeSettingsCategory) categories.add(activeSettingsCategory);
    if (categories.size === 0) {
      messageApi.info("当前没有待保存的用户设置。");
      return;
    }

    for (const category of categories) clearSettingsAutoSave(category);
    setSaving("toolbar");
    setError("");
    try {
      await Promise.all([...categories].map(category => persistLatestSettings(category)));
      showSettingsSaveFeedback("success", "当前分类及已排队的设置已立即保存。");
    } catch (saveError) {
      const detail = getErrorMessage(saveError);
      setError(detail);
      showSettingsSaveFeedback("error", `保存失败：${detail}`);
    } finally {
      setSaving(null);
    }
  }

  async function clearCurrentConversationMemories(): Promise<void> {
    setDeletingConversationMemories(true);
    try {
      await deleteConversationMemories();
      const { snapshot } = await loadConversationMemories();
      setConversationMemorySnapshot(snapshot);
      setConversationMemoryDraft(snapshot.memories.join("\n"));
      messageApi.success("当前账户的 小鱼智能体 记忆已删除。");
    } catch (clearError) {
      messageApi.error(getErrorMessage(clearError));
    } finally {
      setDeletingConversationMemories(false);
    }
  }

  async function saveCurrentConversationMemories(): Promise<void> {
    if (!conversationMemorySnapshot) return;
    const memories = conversationMemoryDraft.split(/\r?\n/u).map(value => value.trim()).filter(Boolean);
    setSavingConversationMemories(true);
    try {
      const { snapshot } = await saveConversationMemories({ revision: conversationMemorySnapshot.revision, memories });
      setConversationMemorySnapshot(snapshot);
      setConversationMemoryDraft(snapshot.memories.join("\n"));
      messageApi.success("对话记忆已保存。");
    } catch (saveError) {
      const detail = getErrorMessage(saveError);
      if (detail.includes("其他请求中更新")) {
        try {
          const { snapshot } = await loadConversationMemories();
          setConversationMemorySnapshot(snapshot);
          setConversationMemoryDraft(snapshot.memories.join("\n"));
        } catch { /* 保留原错误提示；手动刷新设置页仍可重新读取。 */ }
      }
      messageApi.error(detail);
    } finally {
      setSavingConversationMemories(false);
    }
  }

  async function persistRecoveryKey(): Promise<void> {
    setError("");
    if (!recoveryCurrentPassword) {
      setError("请输入当前登录密码以验证身份。");
      return;
    }
    if (!isPasswordAcceptable(recoveryKey)) {
      setError("恢复密钥强度不足，请至少使用 8 位和 3 类字符。");
      return;
    }
    if (recoveryKey === recoveryCurrentPassword) {
      setError("恢复密钥必须与登录密码不同。");
      return;
    }
    if (recoveryKey !== recoveryKeyConfirmation) {
      setError("两次输入的恢复密钥不一致。");
      return;
    }

    setSavingRecoveryKey(true);
    try {
      await saveRecoveryKey({ currentPassword: recoveryCurrentPassword, recoveryKey });
      setRecoveryCurrentPassword("");
      messageApi.success("恢复密钥已保存；离开设置页前请确认已复制并妥善保管。");
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSavingRecoveryKey(false);
    }
  }

  async function persistPasswordChange(): Promise<void> {
    setError("");
    if (!passwordChangeCurrent) {
      setError("请输入当前登录密码以验证身份。");
      return;
    }
    if (!isPasswordAcceptable(passwordChangeNext)) {
      setError("新密码强度不足，请至少使用 8 位和 3 类字符。");
      return;
    }
    if (passwordChangeNext === passwordChangeCurrent) {
      setError("新密码必须与当前登录密码不同。");
      return;
    }
    if (passwordChangeNext !== passwordChangeConfirmation) {
      setError("两次输入的新密码不一致。");
      return;
    }

    setSavingPasswordChange(true);
    try {
      const result = await changeCurrentPassword({ currentPassword: passwordChangeCurrent, newPassword: passwordChangeNext });
      setPasswordChangeCurrent("");
      setPasswordChangeNext("");
      setPasswordChangeConfirmation("");
      messageApi.success(result.message);
    } catch (changeError) {
      setError(getErrorMessage(changeError));
    } finally {
      setSavingPasswordChange(false);
    }
  }

  async function persistAccountEmail(): Promise<void> {
    setError("");
    if (!emailCurrentPassword) {
      setError("请输入当前登录密码以验证身份。");
      return;
    }

    setSavingEmail(true);
    try {
      const result = await updateCurrentUserEmail({ currentPassword: emailCurrentPassword, email: emailDraft.trim() || null });
      onUserChange(result.user);
      setEmailDraft(result.user.email ?? "");
      setEmailCurrentPassword("");
      messageApi.success("邮箱资料已更新。邮箱目前仅用于账户资料和检索，尚未接入验证或找回流程。");
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSavingEmail(false);
    }
  }

  async function persistAccountUsername(): Promise<void> {
    setError("");
    if (!usernameCurrentPassword) {
      setError("请输入当前登录密码以验证身份。");
      return;
    }
    setSavingUsername(true);
    try {
      const result = await updateCurrentUserUsername({ currentPassword: usernameCurrentPassword, username: usernameDraft.trim() });
      onUserChange(result.user);
      setUsernameDraft(result.user.username);
      setUsernameCurrentPassword("");
      messageApi.success("登录用户名已更新。");
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSavingUsername(false);
    }
  }

  function createRecoveryKey(): void {
    setError("");
    try {
      const generatedKey = generateRecoveryKey();
      setRecoveryKey(generatedKey);
      setRecoveryKeyConfirmation(generatedKey);
      messageApi.success("已生成随机恢复密钥，请复制并妥善保管。");
    } catch (generationError) {
      setError(getErrorMessage(generationError));
    }
  }

  async function copyRecoveryKey(): Promise<void> {
    if (!recoveryKey) return;
    setError("");
    try {
      await navigator.clipboard.writeText(recoveryKey);
      messageApi.success("恢复密钥已复制，请妥善保管。");
    } catch {
      setError("复制失败，请显示恢复密钥并手动复制。");
    }
  }

  function resetSettings<K extends keyof UserSettings>(category: K): void {
    updateSettings(category, DEFAULT_USER_SETTINGS[category]);
  }

  function resetActiveSettings(): void {
    if (activeSection === "voice") {
      updateSettings("aiRuntime", {
        ...settings.aiRuntime,
        voiceInputEnabled: DEFAULT_USER_SETTINGS.aiRuntime.voiceInputEnabled,
        readResponsesAloud: DEFAULT_USER_SETTINGS.aiRuntime.readResponsesAloud
      });
      return;
    }
    if (activeSettingsCategory) resetSettings(activeSettingsCategory);
  }

  async function reloadAiAccounts(): Promise<void> {
    const result = await loadAiAccounts();
    setAccounts(result.accounts);
    setAiAccountsLoadState("ready");
  }

  async function refreshLocalModelLibrary(): Promise<void> {
    setLocalModelsLoading(true);
    setLocalModelsError("");
    try {
      const result = await loadLocalModels();
      setLocalModels(result.models);
      setLocalModelDownload(result.activeDownload);
    } catch (scanError) {
      const description = getErrorMessage(scanError);
      setLocalModelsError(description);
      messageApi.error(description);
    } finally {
      setLocalModelsLoading(false);
    }
  }

  async function beginLocalModelDownload(model: LocalModelSummary): Promise<void> {
    setLocalModelAction(model.id);
    setLocalModelsError("");
    try {
      const result = await startLocalModelDownload(model.id);
      setLocalModelDownload(result.download);
      messageApi.info(`已开始下载 ${model.name}。`);
    } catch (downloadError) {
      const description = getErrorMessage(downloadError);
      setLocalModelsError(description);
      messageApi.error(description);
    } finally {
      setLocalModelAction(null);
    }
  }

  async function stopLocalModelDownload(): Promise<void> {
    if (!localModelDownload) return;
    setLocalModelAction(localModelDownload.modelId);
    try {
      const result = await cancelLocalModelDownload(localModelDownload.id);
      setLocalModelDownload(result.download);
    } catch (cancelError) {
      const description = getErrorMessage(cancelError);
      setLocalModelsError(description);
      messageApi.error(description);
    } finally {
      setLocalModelAction(null);
    }
  }

  async function releaseLocalModel(model: LocalModelSummary): Promise<void> {
    setLocalModelAction(model.id);
    try {
      await unloadLocalModel(model.id);
      await refreshLocalModelLibrary();
      messageApi.success(`${model.name} 已释放运行内存。`);
    } catch (unloadError) {
      const description = getErrorMessage(unloadError);
      setLocalModelsError(description);
      messageApi.error(description);
    } finally {
      setLocalModelAction(null);
    }
  }

  async function restoreArchivedSession(session: AiSession): Promise<void> {
    try {
      await archiveAiSession(session.id, false);
      setArchivedSessions((current) => current.filter((item) => item.id !== session.id));
      messageApi.success("会话已恢复到对应应用工作区");
    } catch (restoreError) {
      setError(getErrorMessage(restoreError));
    }
  }

  async function runRuntimePluginAction(plugin: AiRuntimePlugin, action: "start" | "stop" | "reload"): Promise<void> {
    if (!canAdmin || !plugin.canToggle || (action === "reload" && !plugin.canReload)) return;
    setRuntimePluginBusyId(plugin.id);
    try {
      const result = await manageAiRuntimePlugin(plugin.id, action);
      setRuntimePlugins(result.plugins);
      setHotReloadEnabled(result.hotReloadEnabled);
      if (extensionsValueRef.current) extensionsValueRef.current = { ...extensionsValueRef.current, plugins: result.plugins, hotReloadEnabled: result.hotReloadEnabled };
      messageApi.success(action === "start" ? "模块已启动" : action === "stop" ? "模块已停止" : "模块实例已重建");
    } catch (actionError) {
      try {
        const current = await loadAiExtensions();
        extensionsValueRef.current = current;
        setExtensions(current.extensions);
        setRuntimePlugins(current.plugins);
        setHotReloadEnabled(current.hotReloadEnabled);
        setRuntimeHooks(current.hooks);
      } catch { /* 保留动作错误；状态接口不可用时不伪造更新结果。 */ }
      messageApi.error(getErrorMessage(actionError));
    } finally {
      setRuntimePluginBusyId(null);
    }
  }

  function updatePermissionMode(mode: UserSettings["permissions"]["mode"]): void {
    if (mode !== "full_access") {
      updateSettings("permissions", { mode });
      return;
    }
    permissionModal.confirm({
      rootClassName: "lfaa-permission-mode-confirm",
      getContainer: () => document.querySelector<HTMLElement>(".workbench-shell") ?? document.body,
      icon: <WorkbenchIcon name="shield" size={17} />,
      title: "开启项目完全权限？",
      content: "模型将按你的指令自主执行项目操作，可在在线 Daemon 上执行任意终端命令并访问其 OS 账户有权访问的路径；文件、部署和配置操作也不再逐项审批。",
      okText: "开启完全权限",
      cancelText: "取消",
      centered: true,
      width: 400,
      onOk: () => updateSettings("permissions", { mode })
    });
  }

  async function resolveApproval(approval: AiToolApproval, decision: "approved" | "denied"): Promise<void> {
    setApprovalBusyId(approval.id);
    setError("");
    try {
      const previousGrantIds = new Set(permissionGrants.map((grant) => grant.id));
      await decideAiApproval(approval.id, decision, false);
      const result = await loadAiApprovals();
      setPendingApprovals(result.approvals);
      let remembered = false;
      if (decision === "approved" && persistedPermissionMode === "approve_remembered") {
        const grants = await loadAiPermissionGrants();
        setPermissionGrants(grants.grants);
        remembered ||= grants.grants.some((grant) => !previousGrantIds.has(grant.id)
          && grant.appId === approval.appId
          && grant.toolId === approval.toolId
          && grant.toolVersion === approval.toolVersion
          && grant.risk === approval.risk
          && grant.scopeSummary === approval.scopeSummary);
      }
      messageApi.success(decision === "approved" ? remembered
        ? "本次操作已批准；相同范围累计两次后已自动记住，后续匹配操作无需逐项审批。"
        : "本次操作已批准；执行器仍须校验并消费本次授权。" : "操作已拒绝");
    } catch (approvalError) {
      setError(getErrorMessage(approvalError));
    } finally {
      setApprovalBusyId(null);
    }
  }

  function confirmApproval(approval: AiToolApproval): void {
    void resolveApproval(approval, "approved");
  }

  async function revokePermissionGrant(grant: AiToolPermissionGrant): Promise<void> {
    try {
      await revokeAiPermissionGrant(grant.id);
      setPermissionGrants((current) => current.filter((item) => item.id !== grant.id));
      messageApi.success("记忆授权已撤销；该范围重新累计两次明确批准前会逐项等待。");
    } catch (revokeError) {
      setError(getErrorMessage(revokeError));
    }
  }

  async function runProbe(): Promise<void> {
    if (!selectedProvider) return;
    if (!secret.trim()) {
      setProviderApiKeyAttention(true);
      setError("");
      return;
    }
    setProviderApiKeyAttention(false);
    setAiBusy("probe");
    setError("");
    setModelTest(null);
    try {
      const modelId = selectedModel.trim();
      const result = await probeAiProvider({ providerId, secret, options: currentProviderOptions, ...(selectedProvider.modelInput === "manual" && modelId.length > 0 ? { modelId } : {}) });
      setProbe(result.result);
      setSelectedModel(result.result.models[0]?.id ?? "");
      setReasoningMode(defaultReasoningMode(result.result.models[0]));
      messageApi.success(result.result.status === "connected"
        ? isManualPlanProvider
          ? `已加载 ${result.result.models.length} 个套餐目录候选模型；请测试所选模型后再保存。`
          : `已从官方 API 拉取 ${result.result.models.length} 个模型`
        : result.result.message);
    } catch (probeError) {
      setProbe(null);
      setProviderApiKeyAttention(false);
      setError(`模型目录拉取失败，请检查 API Key、服务商参数或 API 地址：${getErrorMessage(probeError)}`);
    } finally {
      setAiBusy(null);
    }
  }

  async function runModelTest(): Promise<void> {
    if (!selectedProvider || !selectedModel) return;
    setAiBusy("test");
    setError("");
    setModelTest(null);
    try {
      const result = await testAiProviderModel({ providerId, secret, options: currentProviderOptions, modelId: selectedModel, reasoningMode });
      setModelTest(result.result);
      messageApi.success("真实模型请求通过");
    } catch (testError) {
      setError(getErrorMessage(testError));
    } finally {
      setAiBusy(null);
    }
  }

  async function saveAccount(): Promise<void> {
    if (!selectedProvider || !selectedModel || !modelTest) return;
    setAiBusy("save");
    setError("");
    try {
      await saveAiAccount({ providerId, secret, options: currentProviderOptions, displayName: accountName, modelId: selectedModel, reasoningMode, ...(modelTest.verificationToken ? { verificationToken: modelTest.verificationToken } : {}) });
      setSecret("");
      setProbe(null);
      setModelTest(null);
      setProviderModalOpen(false);
      await reloadAiAccounts();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setAiBusy(null);
    }
  }

  function openCredentialUpdate(account: AiAccount): void {
    setCredentialUpdateAccount(account);
    setCredentialSecret("");
    setCredentialTest(null);
    setError("");
  }

  async function testReplacementCredential(): Promise<void> {
    if (!credentialUpdateAccount || !credentialSecret.trim()) return;
    setAiBusy(`credential-test:${credentialUpdateAccount.id}`);
    setCredentialTest(null);
    setError("");
    try {
      const result = await testAiAccountCredential(credentialUpdateAccount.id, credentialSecret.trim());
      setCredentialTest(result.result);
      messageApi.success(credentialUpdateAccount.scope === "user" ? "当前套餐模型真实请求通过" : "系统当前模型真实请求通过");
    } catch (testError) {
      setError(getErrorMessage(testError));
    } finally {
      setAiBusy(null);
    }
  }

  async function saveReplacementCredential(): Promise<void> {
    if (!credentialUpdateAccount || !credentialSecret.trim() || !credentialTest) return;
    setAiBusy(`credential-save:${credentialUpdateAccount.id}`);
    setError("");
    try {
      await updateAiAccountCredential(credentialUpdateAccount.id, credentialSecret.trim());
      setCredentialSecret("");
      setCredentialTest(null);
      setCredentialUpdateAccount(null);
      await reloadAiAccounts();
      messageApi.success(credentialUpdateAccount.scope === "user" ? "个人套餐密钥已加密更新，原配置名称和模型保持不变" : "系统模型 API Key 已加密更新，原配置名称和模型保持不变");
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setAiBusy(null);
    }
  }

  async function saveClaudeAgentCredentialDraft(): Promise<void> {
    if (!claudeAgentCredentialDraft.trim()) return;
    setClaudeAgentCredentialBusy(true);
    try {
      const result = await saveClaudeAgentCredential(claudeAgentCredentialDraft.trim());
      setClaudeAgentCredentialStatus(result.credential);
      setClaudeAgentCredentialDraft("");
      messageApi.success("Anthropic Console API Key 已验证并加密保存到当前账户。");
    } catch (saveError) {
      messageApi.error(getErrorMessage(saveError));
    } finally {
      setClaudeAgentCredentialBusy(false);
    }
  }

  async function removeClaudeAgentCredential(): Promise<void> {
    setClaudeAgentCredentialBusy(true);
    try {
      await deleteClaudeAgentCredential();
      setClaudeAgentCredentialStatus({ configured: false });
      setClaudeAgentCredentialDraft("");
      messageApi.success("当前账户的 Anthropic Console API Key 已删除。");
    } catch (deleteError) {
      messageApi.error(getErrorMessage(deleteError));
    } finally {
      setClaudeAgentCredentialBusy(false);
    }
  }

  async function runAccountAction(account: AiAccount, action: "activate" | "refresh" | "retest" | "delete", modelId?: string): Promise<void> {
    setAiBusy(`${action}:${account.id}`);
    setError("");
    try {
      if (action === "activate") await activateAiAccount(account.id);
      if (action === "refresh") {
        const result = await refreshAiAccountModelCatalog(account.id);
        messageApi.success(result.result.message);
      }
      if (action === "retest") {
        const result = await testSavedAiAccountModel(account.id);
        messageApi.success(`当前模型真实请求通过（${result.result.elapsedMs} ms）`);
      }
      if (action === "delete") await deleteAiAccount(account.id);
      if (action === "activate" || action === "delete") messageApi.success(action === "activate" ? "已设为当前模型" : "AI 账户已删除");
      if (modelId) await updateAiAccountModel(account.id, modelId);
      await reloadAiAccounts();
    } catch (actionError) {
      setError(getErrorMessage(actionError));
    } finally {
      setAiBusy(null);
    }
  }

  async function selectAccountModel(account: AiAccount, modelId: string): Promise<void> {
    setAiBusy(`model:${account.id}`);
    setError("");
    try {
      await updateAiAccountModel(account.id, modelId);
      if (account.scope === "user") setPlanModelDrafts(current => ({ ...current, [account.id]: modelId }));
      await reloadAiAccounts();
      messageApi.success("模型通过真实请求测试并已更新");
    } catch (modelError) {
      setError(getErrorMessage(modelError));
    } finally {
      setAiBusy(null);
    }
  }

  async function selectAccountReasoningMode(account: AiAccount, nextMode: string): Promise<void> {
    setAiBusy(`reasoning:${account.id}`);
    setError("");
    try {
      await updateAiAccountReasoningMode(account.id, nextMode);
      await reloadAiAccounts();
      messageApi.success(nextMode === "default" ? "已改为跟随模型官方默认思考参数" : "官方思考参数已应用到此账户");
    } catch (reasoningError) {
      setError(getErrorMessage(reasoningError));
    } finally {
      setAiBusy(null);
    }
  }

  function openProviderConfiguration(nextProvider: AiProvider): void {
    if (!canAdmin && nextProvider.scope !== "user") return;
    if (nextProvider.id === "ark-agent-plan" || nextProvider.id === "ark-coding-plan") {
      setProviderOptions(current => ({ ...current, [nextProvider.id]: { ...current[nextProvider.id], planTier: current[nextProvider.id]?.planTier ?? "unknown" } }));
    }
    setProviderId(nextProvider.id);
    setAccountName(nextProvider.scope === "user" ? `我的 ${nextProvider.name}` : `${nextProvider.name} 主账户`);
    setSecret("");
    setProviderApiKeyAttention(false);
    setProbe(null);
    setModelTest(null);
    setSelectedModel("");
    setReasoningMode("default");
    setError("");
    setProviderModalOpen(true);
  }

  async function refreshHealth(): Promise<void> {
    setHealth(null);
    healthValueRef.current = null;
    try {
      const result = await loadHealth();
      healthValueRef.current = result;
      setHealth(result);
    } catch {
      const result: ServerHealth = { status: "error", service: "lfaa-server", persistence: "unavailable", timestamp: new Date().toISOString() };
      healthValueRef.current = result;
      setHealth(result);
    }
  }

  async function refreshDeveloperStatus(): Promise<void> {
    await refreshHealth();
  }

  async function addBackground(file: File): Promise<void> {
    setUploadingBackground(true);
    setBackgroundActionError("");
    setError("");
    try {
      const result = await uploadAppearanceBackground(file);
      setUploadedBackgrounds((current) => [result.background, ...current]);
      updateSettings("appearance", { ...settingsRef.current.appearance, backgrounds: { ...settingsRef.current.appearance.backgrounds, [backgroundTarget]: result.background.id } });
      clearSettingsAutoSave("appearance");
      await persistLatestSettings("appearance");
      messageApi.success("背景图片已上传并应用到所选工作区");
    } catch (uploadError) {
      const detail = getErrorMessage(uploadError);
      setBackgroundActionError(detail);
      messageApi.error(detail);
    } finally {
      setUploadingBackground(false);
    }
  }

  async function removeBackground(background: AppearanceBackground): Promise<void> {
    setBackgroundActionError("");
    setError("");
    try {
      if (settingsRef.current.appearance.presets.some((preset) => Object.values(preset.snapshot.appearance.backgrounds).includes(background.id))) {
        throw new Error("这张背景图片仍被一个或多个外观预设引用。请先删除或更新相关预设，再删除图片。");
      }
      const backgrounds = Object.fromEntries(Object.entries(settingsRef.current.appearance.backgrounds).map(([target, value]) => [target, value === background.id ? "none" : value])) as UserSettings["appearance"]["backgrounds"];
      updateSettings("appearance", { ...settingsRef.current.appearance, backgrounds });
      clearSettingsAutoSave("appearance");
      await persistLatestSettings("appearance");
      await deleteAppearanceBackground(background.id);
      setUploadedBackgrounds((current) => current.filter((item) => item.id !== background.id));
      messageApi.success("背景图片已删除");
    } catch (deleteError) {
      const detail = getErrorMessage(deleteError);
      setBackgroundActionError(detail);
      messageApi.error(detail);
    }
  }

  function updateShortcut(key: keyof UserSettings["shortcuts"], value: string[]): void {
    updateSettings("shortcuts", { ...settings.shortcuts, [key]: value });
  }

  async function enableBrowserNotifications(): Promise<void> {
    const permission = await requestBrowserNotificationPermission();
    setNotificationPermission(permission);
    if (permission === "granted") messageApi.success("浏览器通知已授权。可发送测试通知确认系统投递。");
    else if (permission === "denied") messageApi.warning("通知已被浏览器阻止。请在地址栏的网站权限中允许 LFAA 通知。");
    else if (permission === "insecure") messageApi.warning("当前页面不是安全上下文；请通过 HTTPS 或 localhost 使用浏览器通知。");
    else messageApi.warning("当前浏览器不支持系统通知。");
  }

  function sendNotificationTest(): void {
    if (!settings.general.notificationPopupsEnabled) return;
    if (sendBrowserNotification("LFAA 通知测试", "浏览器已成功接收 LFAA 通知。")) messageApi.success("测试通知已发送。");
    else messageApi.error("测试通知未发送，请检查浏览器通知授权。");
  }

  function testNotificationSound(): void {
    if (!settings.general.notificationPopupsEnabled) return;
    if (playNotificationSound(settings.general.notificationSound)) messageApi.info("已触发提示音试听；实际音量受浏览器和系统设置控制。");
    else messageApi.warning(settings.general.notificationSound === "off" ? "提示音当前已关闭。" : "当前浏览器无法播放提示音。");
  }

  const backgroundChoices: Array<{ id: string; name: string; file?: string; uploadedBackground?: AppearanceBackground }> = [
    ...appearanceBackgroundOptions,
    ...uploadedBackgrounds.map((background) => ({ id: background.id, name: `自定义 · ${background.name}`, file: background.url, uploadedBackground: background }))
  ];
  const visibleBackgroundChoices = backgroundTarget === "login"
    ? backgroundChoices.filter((background) => !background.id.startsWith("user-"))
    : backgroundChoices;
  const selectedBackgroundForTarget = settings.appearance.backgrounds[backgroundTarget];
  const selectedAreaEffects = settings.appearance.areaEffects?.[backgroundTarget] ?? DEFAULT_USER_SETTINGS.appearance.areaEffects[backgroundTarget];
  const effectiveAreaOverlay = backgroundTarget === "login"
    ? resolveLoginAreaOverlay(settings.appearance.overlay, selectedAreaEffects.overlay)
    : resolveWorkbenchAreaEffects(settings.appearance, backgroundTarget).overlay;
  const effectiveAreaBlur = backgroundTarget === "login"
    ? null
    : resolveWorkbenchAreaEffects(settings.appearance, backgroundTarget).blur;
  const selectedAreaBlurOverride = backgroundTarget === "login"
    ? null
    : settings.appearance.areaEffects?.[backgroundTarget].blur ?? null;
  const hasAreaEffectOverride = selectedAreaEffects.overlay !== null || selectedAreaBlurOverride !== null;

  const notificationPermissionLabels: Record<BrowserNotificationPermission, string> = {
    granted: "已授权",
    default: "需要授权",
    denied: "已被阻止",
    insecure: "需要安全连接",
    unsupported: "当前环境不支持"
  };
  const notificationPermissionDescriptions: Record<BrowserNotificationPermission, string> = {
    granted: "此浏览器已允许 LFAA 发送系统通知。授权保存在浏览器中，不随账户设置同步。",
    default: "允许后，小鱼智能体 会话提醒可投递到系统通知。浏览器会在此操作后显示授权请求。",
    denied: "浏览器已拒绝通知权限。请打开地址栏的网站权限并允许通知，再返回此页。",
    insecure: "浏览器通知要求 HTTPS 或 localhost 安全连接。",
    unsupported: "此浏览器或桌面容器没有提供 Notifications API。"
  };
  const notificationCategoryStatus = (enabled: boolean, enabledLabel = "已开启"): string => {
    if (!enabled) return "已关闭";
    return settings.general.notificationPopupsEnabled ? enabledLabel : `${enabledLabel}（总开关已暂停）`;
  };
  const completionNotificationLabel = settings.general.completionNotification === "always"
    ? "始终提醒"
    : "仅工作台未聚焦时提醒";
  const notificationToastEffect = UI_MOTION_EFFECT_OPTIONS.find(({ id }) => id === settings.general.notificationToastEffect) ?? UI_MOTION_EFFECT_OPTIONS[0];
  const notificationGroup = (
    <SettingGroup title="LFAA 通知">
      {!settings.general.notificationPopupsEnabled ? <Alert
        className="settings-notification-paused"
        type="warning"
        showIcon
        message="所有弹出提醒已暂停"
        description="重新开启后，其他工作台提醒、系统通知和提示音会按原设置继续生效；会话中的审批与澄清卡片不受影响。"
        action={<Button size="small" type="primary" onClick={() => updateGeneral({ notificationPopupsEnabled: true })}>恢复通知</Button>}
      /> : null}
      <SettingRow title="通知总开关" description="关闭后停止工作台提醒、浏览器系统通知和通知提示音；会话里的审批与澄清卡片仍会保留。重新开启后按原偏好继续提醒。" status={settings.general.notificationPopupsEnabled ? "已开启" : "已关闭"}>
        <SettingsSwitch label="通知总开关" checked={settings.general.notificationPopupsEnabled} onChange={() => updateGeneral({ notificationPopupsEnabled: !settings.general.notificationPopupsEnabled })} />
      </SettingRow>
      <SettingRow title="浏览器通知权限" description={notificationPermissionDescriptions[notificationPermission]} status={notificationPermissionLabels[notificationPermission]}>
        {notificationPermission === "default" ? <Button onClick={() => void enableBrowserNotifications()}>启用通知</Button> : null}
        {notificationPermission === "granted" ? <Button onClick={sendNotificationTest} disabled={!settings.general.notificationPopupsEnabled}>发送测试通知</Button> : null}
      </SettingRow>
      <SettingRow title="小鱼智能体 回复完成" description="回复完成后在工作台通知栏和右下角提醒；浏览器系统通知按下方策略投递。" status={notificationCategoryStatus(settings.general.completionNotification !== "never", completionNotificationLabel)}>
        <Select value={settings.general.completionNotification} options={[{ value: "always", label: "始终" }, { value: "unfocused", label: "仅在工作台未聚焦时" }, { value: "never", label: "关闭" }]} onChange={(value) => updateGeneral({ completionNotification: value })} />
      </SettingRow>
      <SettingRow title="小鱼智能体 会话出错" description="回复生成失败时，在通知栏和右下角显示提醒；点击可返回出错的会话查看详情。" status={notificationCategoryStatus(settings.general.sessionIssueNotifications)}>
        <SettingsSwitch label="会话问题提醒" checked={settings.general.sessionIssueNotifications} onChange={() => updateGeneral({ sessionIssueNotifications: !settings.general.sessionIssueNotifications })} />
      </SettingRow>
      <SettingRow title="AI 工具权限请求" description="审批操作统一在当前 小鱼智能体 输入框上方处理；此开关控制通知栏和后台系统通知提醒，不会隐藏当前会话中的待处理审批。" status={notificationCategoryStatus(settings.general.permissionNotifications)}>
        <SettingsSwitch label="审批提醒" checked={settings.general.permissionNotifications} onChange={() => updateGeneral({ permissionNotifications: !settings.general.permissionNotifications })} />
      </SettingRow>
      <SettingRow title="小鱼智能体 澄清问题" description="当模型判断关键信息不足时，可暂停当前任务并提供选项或自定义回答；此开关控制通知栏和后台系统通知，不会隐藏当前会话中的问题卡。" status={notificationCategoryStatus(settings.general.questionNotifications)}>
        <SettingsSwitch label="澄清问题提醒" checked={settings.general.questionNotifications} onChange={() => updateGeneral({ questionNotifications: !settings.general.questionNotifications })} />
      </SettingRow>
      <SettingRow title="操作提示卡时长" description="Minecraft 操作成功后，右下角提示卡按此时长倒计时并自动收起；范围 1–60 秒。" status={`${settings.general.notificationToastDurationSeconds} 秒后收起`}>
        <InputNumber aria-label="操作提示卡时长" min={1} max={60} step={1} precision={0} addonAfter="秒" value={settings.general.notificationToastDurationSeconds} onChange={(value) => { if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 60) updateGeneral({ notificationToastDurationSeconds: value }); }} />
      </SettingRow>
      <SettingRow title="操作提示卡动效" description={`Minecraft 操作提示卡使用“${notificationToastEffect.label}”：${notificationToastEffect.cardDescription} 外观中的减少动态效果设置会优先关闭动画。`} status={notificationToastEffect.label}>
        <Select aria-label="操作提示卡动效" value={settings.general.notificationToastEffect} options={UI_MOTION_EFFECT_OPTIONS.map(({ id, label }) => ({ value: id, label }))} onChange={(value) => updateGeneral({ notificationToastEffect: value })} />
      </SettingRow>
      <SettingRow title="通知提示音" description="选择 小鱼智能体 回复完成、审批请求、澄清问题、会话错误及 Minecraft 操作成功提示卡的提示音；试听音量受浏览器和系统音量控制。" status={notificationCategoryStatus(settings.general.notificationSound !== "off", "提示音已开启")}>
        <Space>
          <Select value={settings.general.notificationSound} options={[{ value: "default", label: "默认" }, { value: "subtle", label: "轻柔" }, { value: "off", label: "关闭" }]} onChange={(value) => updateGeneral({ notificationSound: value })} />
          <Button onClick={testNotificationSound} disabled={!settings.general.notificationPopupsEnabled || settings.general.notificationSound === "off"}>试听</Button>
        </Space>
      </SettingRow>
    </SettingGroup>
  );

  const pluginWorkspaceHeader = (
    <div className="settings-plugin-workspace__header-cards">
      <div className="settings-plugin-workspace__header-card settings-plugin-workspace__header-card--primary">
        <header className="settings-content__heading settings-plugin-workspace__heading"><div><span className="settings-eyebrow">{activeSection === "connections" ? "外部服务" : "AI 扩展 · 运行时"}</span><Typography.Title level={2}>{activeSection === "connections" ? "MCP 连接" : "扩展工作台"}</Typography.Title><Typography.Paragraph>{activeSection === "connections" ? "配置 MCP 服务与应用范围；设置保存仍归账户设置 Owner。" : "管理账户 AI 扩展、浏览已登记能力，并检查 MCP 与运行模块状态。"}</Typography.Paragraph></div></header>
        <nav className="settings-plugin-workspace__tabs" role="tablist" aria-label="扩展与连接分区" onKeyDown={(event) => {
          const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=tab]"));
          const currentIndex = tabs.indexOf(event.target as HTMLButtonElement);
          const nextIndex = event.key === "ArrowRight" ? (currentIndex + 1) % tabs.length
            : event.key === "ArrowLeft" ? (currentIndex - 1 + tabs.length) % tabs.length
              : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : -1;
          if (currentIndex >= 0 && nextIndex >= 0) {
            event.preventDefault();
            tabs[nextIndex]?.focus();
            tabs[nextIndex]?.click();
          }
        }}>
          {PLUGIN_WORKSPACE_TABS.map((tab) => <button key={tab.id} id={`settings-plugin-tab-${tab.id}`} type="button" role="tab" tabIndex={pluginWorkspaceTab === tab.id ? 0 : -1} aria-selected={pluginWorkspaceTab === tab.id} aria-controls="settings-plugin-panel" className={pluginWorkspaceTab === tab.id ? "is-active" : ""} onClick={() => {
            const nextSection: SectionId = tab.id === "mcp" ? "connections" : "plugins";
            if (activeSection !== nextSection) selectSection(nextSection);
            if (tab.id === "knowledge") setKnowledgeLibraryOpened(true);
            setPluginWorkspaceTab(tab.id);
          }}>{tab.label}{tab.id === "mcp" && settings.plugins.mcpServers.length ? <span className="settings-plugin-workspace__tab-count">{settings.plugins.mcpServers.length}</span> : null}</button>)}
        </nav>
      </div>
      {pluginWorkspaceTab === "catalog" ? <div className="settings-plugin-workspace__header-card settings-plugin-workspace__header-card--catalog" aria-labelledby="settings-extension-catalog-title">
        <Alert className="settings-inline-alert" type="info" showIcon message="能力安装与运行状态由各自 Owner 提供；此目录展示账户级扩展与连接适配状态。Minecraft 插件和模组仍由 Minecraft Owner 管理。" />
        <h3 id="settings-extension-catalog-title">能力目录</h3>
      </div> : null}
    </div>
  );

  const renderAiAccountItem = (account: AiAccount) => {
    const provider = providers.find((item) => item.id === account.providerId);
    const canManageAccount = account.scope === "user" || canAdmin;
    const isManualAccount = provider?.modelInput === "manual";
    const accountModel = account.models.find((model) => model.id === account.modelId);
    const accountModelOptions = account.models.map((model) => aiModelSelectOption(account.providerId, model));
    if (!accountModel) accountModelOptions.unshift({ value: account.modelId, label: `${account.modelId}（当前目录未列出）`, title: account.modelId, disabled: true });
    const accountReasoningOptions = reasoningOptions(accountModel);
    const accountReasoningMode = effectiveReasoningMode(accountModel, account.reasoningMode);
    const draftModel = planModelDrafts[account.id] ?? account.modelId;
    const availablePlanModels = account.models.filter(model => (model.taskType ?? "chat") === "chat"
      && (!model.planTiers?.length || account.options.planTier === "unknown" || !account.options.planTier || model.planTiers.includes(account.options.planTier as NonNullable<AiModel["planTiers"]>[number])));
    const planCapabilityModels = account.models.filter(model => model.taskType && model.taskType !== "chat"
      && (!model.planTiers?.length || account.options.planTier === "unknown" || !account.options.planTier || model.planTiers.includes(account.options.planTier as NonNullable<AiModel["planTiers"]>[number])));
    return <article id={`settings-ai-account-${account.id}`} className={`ai-account-item${account.active ? " is-active" : ""}`} key={account.id}>
      <div className="ai-account-item__header"><div><strong>{account.displayName}</strong><span>{provider?.name ?? account.providerId} · {account.scope === "user" ? "个人席位" : "系统模型"} · {account.active ? "当前模型" : "已保存"}</span></div><Tag color={account.active ? "green" : account.scope === "user" ? "blue" : "default"}>{account.active ? "当前使用" : account.scope === "user" ? "我的席位" : "系统账户"}</Tag></div>
      {isManualAccount ? <>
        <label className="settings-field"><span>套餐文本模型</span><div className="ai-plan-model-editor"><Select showSearch optionFilterProp="label" value={availablePlanModels.some(model => model.id === draftModel) ? draftModel : account.modelId} options={availablePlanModels.map(model => ({ value: model.id, label: `${model.name} · ${model.id}` }))} disabled={!canManageAccount || aiBusy !== null} onChange={value => setPlanModelDrafts(current => ({ ...current, [account.id]: value }))} /><Button disabled={!canManageAccount || aiBusy !== null || !draftModel.trim() || draftModel.trim() === account.modelId} loading={aiBusy === `model:${account.id}`} onClick={() => void selectAccountModel(account, draftModel.trim())}>测试并切换</Button></div></label>
        <p className="settings-field-help">已加载官方套餐目录；当前档位：{account.options.planTier && account.options.planTier !== "unknown" ? account.options.planTier.toLocaleUpperCase("en-US") : "未确认"}。切换主模型前会向套餐专属地址发起真实文本请求。</p>
        {planCapabilityModels.length ? <div className="ai-plan-capability-models"><strong>此套餐的其他模型能力</strong><Space wrap size={[6, 6]}>{planCapabilityModels.map(model => <Tag key={`${model.taskType}:${model.id}`} title={model.catalogSource}>{({ embedding: "向量", "image-generation": "生图", "video-generation": "视频", "text-to-speech": "语音合成", "speech-to-text": "语音识别" } as Record<string, string>)[model.taskType!] ?? model.taskType} · {model.name}</Tag>)}</Space></div> : null}
      </> : <>
        <label className="settings-field"><span>当前模型</span><Select disabled={!canManageAccount || aiBusy !== null} value={account.modelId} options={accountModelOptions.length ? accountModelOptions : [{ value: account.modelId, label: account.modelId, title: account.modelId, disabled: false }]} onChange={(modelId) => void selectAccountModel(account, modelId)} /></label>
        <p className="settings-field-help">{accountModel ? modelParameterSummary(accountModel) : "当前模型不在最新模型目录中；原选择已保留，请选择目录中的型号。"}</p>
      </>}
      {accountReasoningOptions.length ? <label className="settings-field"><span>{accountModel?.thinking?.kind === "effort" ? "思考力度" : "思考模式"}</span><Select value={accountReasoningMode} options={accountReasoningOptions} disabled={!canManageAccount || aiBusy !== null} onChange={(value) => void selectAccountReasoningMode(account, value)} /></label>
        : accountModel?.thinking?.kind === "fixed" ? <p className="ai-thinking-note">{fixedThinkingLabel(accountModel)}</p>
          : <p className="ai-thinking-note">模型目录未提供可校验的思考力度参数；请求跟随模型自身默认行为。</p>}
      {canManageAccount ? <div className="ai-account-item__actions">
        {!account.active ? <Button size="small" type="primary" disabled={aiBusy !== null} onClick={() => void runAccountAction(account, "activate")}>设为当前模型</Button> : null}
        <Button size="small" disabled={aiBusy !== null} onClick={() => openCredentialUpdate(account)}>更换密钥</Button>
        <Button size="small" disabled={aiBusy !== null} loading={aiBusy === `refresh:${account.id}`} onClick={() => void runAccountAction(account, "refresh")}>更新目录</Button>
        <Button size="small" disabled={aiBusy !== null || !accountModel} title="向当前模型发起真实请求，可能产生 Provider 用量" loading={aiBusy === `retest:${account.id}`} onClick={() => void runAccountAction(account, "retest")}>重测模型</Button>
        <Popconfirm title={account.scope === "user" ? "删除我的套餐席位？" : "删除这个系统模型？"} description={account.scope === "user" ? "删除后，当前账户将不再使用这个套餐席位。" : "删除后，所有登录账户都无法再使用这份系统配置。"} okText="删除" cancelText="取消" onConfirm={() => void runAccountAction(account, "delete")}><Button danger size="small" disabled={aiBusy !== null}>删除</Button></Popconfirm>
      </div> : <p className="ai-thinking-note">由系统管理员统一管理；当前模型配置供所有 LFAA 登录账户使用。</p>}
    </article>;
  };

  const sectionContent = (() => {
    if (activeSection === "parental") return <AccountAgentUsageSettings user={user} />;
    if (activeSection === "import") return <AccountSnapshotsSettings mode="import" />;
    if (activeSection === "snapshots") return <AccountSnapshotsSettings mode="snapshots" />;
    if (activeSection === "trustedContacts") return <TrustedContactsSettings />;
    if (activeSection === "cloudPreferences") return <CloudPreferencesSettings user={user} onNavigate={onNavigate} />;

    if (activeSection === "mini") return (
      <section className="settings-content">
        <header className="settings-content__heading"><div><span className="settings-eyebrow">个人</span><Typography.Title level={2}>Mini 与虚拟宠物</Typography.Title><Typography.Paragraph>管理 LFAA 桌面 Mini 窗口和伙伴显示偏好。窗口动作由 Electron Host 执行；Web 页面只保存账户偏好，不会伪称打开了原生窗口。</Typography.Paragraph></div></header>
        <SettingGroup title="虚拟伙伴">
          <SettingRow title="伙伴外观" description="只改变 Mini 窗口里显示的 LFAA 伙伴造型。" status={settings.mini.companion === "moss" ? "苔影" : settings.mini.companion === "cloud" ? "云朵" : "微光"}>
            <Select aria-label="虚拟伙伴外观" value={settings.mini.companion} options={[{ value: "moss", label: "苔影" }, { value: "cloud", label: "云朵" }, { value: "ember", label: "微光" }]} onChange={companion => updateSettings("mini", { ...settings.mini, companion })} />
          </SettingRow>
          <SettingRow title="显示虚拟伙伴" description="关闭后 Mini 窗口保留轻量控制面板，不绘制伙伴图形。" status={settings.mini.showCompanion ? "显示" : "隐藏"}>
            <SettingsSwitch label="显示虚拟伙伴" checked={settings.mini.showCompanion} onChange={() => updateSettings("mini", { ...settings.mini, showCompanion: !settings.mini.showCompanion })} />
          </SettingRow>
        </SettingGroup>
        <SettingGroup title="Mini 窗口">
          <SettingRow title="窗口置顶" description="只影响当前设备的 Electron Mini 窗口层级。" status={settings.mini.alwaysOnTop ? "置顶" : "普通窗口"}>
            <SettingsSwitch label="Mini 窗口置顶" checked={settings.mini.alwaysOnTop} onChange={() => updateSettings("mini", { ...settings.mini, alwaysOnTop: !settings.mini.alwaysOnTop })} />
          </SettingRow>
          <SettingRow title="窗口不透明度" description="降低不透明度可透出下方窗口；范围为 40%–100%。" status={`${settings.mini.opacity}%`}>
            <div className="settings-slider"><Slider min={40} max={100} value={settings.mini.opacity} onChange={opacity => updateSettings("mini", { ...settings.mini, opacity })} /><output>{settings.mini.opacity}%</output></div>
          </SettingRow>
          <SettingRow title="宿主能力" description={window.lfaaDesktop?.mini ? "当前 Electron Host 可创建独立 Mini 窗口。" : "当前是 Web Host；可保存偏好，独立 Mini 窗口需 Electron Host。"} status={window.lfaaDesktop?.mini ? "Electron 已接入" : "Web 不支持原生窗口"}>
            {window.lfaaDesktop?.mini ? <Button onClick={() => void window.lfaaDesktop?.mini.open(settings.mini)}>打开 Mini 窗口</Button> : <Tag>当前 Host 不支持</Tag>}
          </SettingRow>
        </SettingGroup>
      </section>
    );

    if (activeSection === "canvas") return (
      <section className="settings-content">
        <header className="settings-content__heading"><div><span className="settings-eyebrow">个人</span><Typography.Title level={2}>画布</Typography.Title><Typography.Paragraph>画布打开模式、网格与视图偏好按账户保存，由 /canvas 首页和画布工作区读取并即时生效。图片/视频生成继续使用「AI 与模型」中已保存的生成账户与模型，不在这里复制第二套模型配置。</Typography.Paragraph></div></header>
        <SettingGroup title="打开与模式">
          <SettingRow title="默认打开模式" description="进入 /canvas 时默认展示生成工作台或空白画布，仍可在顶部随时切换；两种模式都创建真实项目，不伪造生成结果。" status={CANVAS_DEFAULT_MODE_OPTIONS.find(option => option.id === settings.canvas.defaultMode)?.label ?? settings.canvas.defaultMode}>
            <Select value={settings.canvas.defaultMode} options={CANVAS_DEFAULT_MODE_OPTIONS.map(({ id, label }) => ({ value: id, label }))} onChange={value => updateSettings("canvas", { ...settings.canvas, defaultMode: value })} />
          </SettingRow>
          <SettingRow title="Agent 面板默认展开" description="进入画布工作区时是否默认展开右侧小鱼助手；继续使用真实会话、输入和流式回复。" status={settings.canvas.agentPanelDefaultOpen ? "默认展开" : "默认收起"}>
            <SettingsSwitch label="Agent 面板默认展开" checked={settings.canvas.agentPanelDefaultOpen} onChange={() => updateSettings("canvas", { ...settings.canvas, agentPanelDefaultOpen: !settings.canvas.agentPanelDefaultOpen })} />
          </SettingRow>
        </SettingGroup>
        <SettingGroup title="画布视图">
          <SettingRow title="网格样式" description="画布背景网格；关闭网格只隐藏参考线，不改变节点坐标或吸附计算。" status={CANVAS_GRID_STYLE_OPTIONS.find(option => option.id === settings.canvas.gridStyle)?.label ?? settings.canvas.gridStyle}>
            <Select value={settings.canvas.gridStyle} options={CANVAS_GRID_STYLE_OPTIONS.map(({ id, label }) => ({ value: id, label }))} onChange={value => updateSettings("canvas", { ...settings.canvas, gridStyle: value })} />
          </SettingRow>
          <SettingRow title="拖动吸附网格" description="拖动节点时吸附到网格，便于对齐；缩放、连线与导入导出不受影响。" status={settings.canvas.snapToGrid ? "已开启" : "已关闭"}>
            <SettingsSwitch label="拖动吸附网格" checked={settings.canvas.snapToGrid} onChange={() => updateSettings("canvas", { ...settings.canvas, snapToGrid: !settings.canvas.snapToGrid })} />
          </SettingRow>
          <SettingRow title="小地图" description="显示画布左上角的小地图；关闭只隐藏视图，不删除项目数据。" status={settings.canvas.showMiniMap ? "显示" : "隐藏"}>
            <SettingsSwitch label="显示小地图" checked={settings.canvas.showMiniMap} onChange={() => updateSettings("canvas", { ...settings.canvas, showMiniMap: !settings.canvas.showMiniMap })} />
          </SettingRow>
        </SettingGroup>
        <SettingGroup title="生成模型">
          <SettingRow title="图片与视频生成模型" description="继续使用「AI 与模型」中保存的图片/视频生成账户、模型与超时；画布不保存第二套模型配置，未配置时画布会显示真实引导。" status="复用 AI 与模型">
            <Button onClick={() => selectSection("ai")}>前往 AI 与模型设置</Button>
          </SettingRow>
        </SettingGroup>
      </section>
    );

    if (activeSection === "profile") return (
      <section className="settings-content settings-content--account" role="tabpanel" id="settings-account-panel" aria-labelledby="settings-account-tab-profile" tabIndex={0}>
        <header className="settings-content__heading"><div><span className="settings-eyebrow">个人与账户</span><Typography.Title level={2}>账号</Typography.Title><Typography.Paragraph>管理个人资料、登录安全和本机账号。</Typography.Paragraph></div></header>
        <AccountSettingsTabs activeSection={activeSection} onSelect={selectSection} />
        {/* 个人资料直接使用当前认证会话中的用户对象，避免从跨账号共享状态读取身份信息。 */}
        <SettingGroup title="账户资料">
          <SettingRow title="用户名" description="当前账户的登录名称。" status="当前账户"><Typography.Text>{user.username}</Typography.Text></SettingRow>
          <SettingRow title="邮箱" description="当前账户关联的邮箱地址。"><Typography.Text>{user.email ?? "未设置"}</Typography.Text></SettingRow>
          <SettingRow title="账户 UID" description="用于识别当前账户的编号。"><Typography.Text>{user.uid.toLocaleString("zh-CN")}</Typography.Text></SettingRow>
          <SettingRow title="账户角色" description="当前账户在 LFAA 中的权限角色。"><Tag color={canAdmin ? "blue" : undefined}>{userRoleLabel(user.role)}</Tag></SettingRow>
          <SettingRow title="创建时间" description="当前账户的创建时间。"><Typography.Text>{new Date(user.createdAt).toLocaleString("zh-CN")}</Typography.Text></SettingRow>
        </SettingGroup>
      </section>
    );

    if (activeSection === "security") return (
      <section className="settings-content settings-content--account" role="tabpanel" id="settings-account-panel" aria-labelledby="settings-account-tab-security" tabIndex={0}>
        <header className="settings-content__heading"><div><span className="settings-eyebrow">个人与账户</span><Typography.Title level={2}>账号</Typography.Title><Typography.Paragraph>管理个人资料、登录安全和本机账号。</Typography.Paragraph></div></header>
        <AccountSettingsTabs activeSection={activeSection} onSelect={selectSection} />
        <SettingGroup title="登录用户名">
          <SettingRow title="账户用户名" description="用户名用于登录，修改前需要重新验证当前密码。" status={user.username}>
            <Space direction="vertical" size="small" style={{ width: "100%" }}>
              <Input autoComplete="username" maxLength={32} value={usernameDraft} onChange={(event) => setUsernameDraft(event.target.value)} placeholder="3 到 32 个字符" />
              <Input.Password autoComplete="current-password" value={usernameCurrentPassword} onChange={(event) => setUsernameCurrentPassword(event.target.value)} placeholder="输入当前登录密码以确认修改" />
              <Button type="primary" loading={savingUsername} disabled={serverState !== "online" || !usernameCurrentPassword || usernameDraft.trim() === user.username} onClick={() => void persistAccountUsername()}>保存用户名</Button>
            </Space>
          </SettingRow>
        </SettingGroup>
        <SettingGroup title="邮箱资料">
          <SettingRow title="账户邮箱" description="邮箱目前用于账户资料和管理员检索，尚未接入邮箱验证或邮件找回。清空后会移除当前邮箱。" status={user.email ? "已设置" : "未设置"}>
            <Space direction="vertical" size="small" style={{ width: "100%" }}>
              <Input type="email" autoComplete="email" maxLength={254} value={emailDraft} onChange={(event) => setEmailDraft(event.target.value)} placeholder="输入邮箱地址" />
              <Input.Password autoComplete="current-password" value={emailCurrentPassword} onChange={(event) => setEmailCurrentPassword(event.target.value)} placeholder="输入当前登录密码以确认修改" />
              <Button type="primary" loading={savingEmail} disabled={serverState !== "online" || !emailCurrentPassword} onClick={() => void persistAccountEmail()}>保存邮箱</Button>
            </Space>
          </SettingRow>
        </SettingGroup>
        <Card className="settings-card" title="更改登录密码">
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Input.Password autoComplete="current-password" value={passwordChangeCurrent} onChange={(event) => setPasswordChangeCurrent(event.target.value)} placeholder="当前登录密码" />
            <div>
              <Input.Password autoComplete="new-password" value={passwordChangeNext} onChange={(event) => setPasswordChangeNext(event.target.value)} placeholder="新密码" />
              <PasswordStrengthIndicator password={passwordChangeNext} label="新密码" />
            </div>
            <Input.Password autoComplete="new-password" value={passwordChangeConfirmation} onChange={(event) => setPasswordChangeConfirmation(event.target.value)} placeholder="再次输入新密码" />
            <Typography.Text type="secondary">密码至少 8 位，并包含至少 3 类字符。更改后会让其他设备退出登录，当前设备保持登录。</Typography.Text>
            <Button type="primary" loading={savingPasswordChange} disabled={serverState !== "online"} onClick={() => void persistPasswordChange()}>更新密码</Button>
          </Space>
        </Card>
        <Card className="settings-card" title="密码恢复密钥">
          <Typography.Paragraph type="secondary">恢复密钥可用于忘记密码时重设登录密码。密钥只在此页内存中暂存，控制端只保存加盐哈希；离开“安全”分类会清除输入内容。</Typography.Paragraph>
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Input.Password autoComplete="current-password" value={recoveryCurrentPassword} onChange={(event) => setRecoveryCurrentPassword(event.target.value)} placeholder="输入当前登录密码" />
            <Space wrap>
              <Button onClick={createRecoveryKey}>随机生成</Button>
              <Button disabled={!recoveryKey} onClick={() => void copyRecoveryKey()}>复制恢复密钥</Button>
            </Space>
            <div>
              <Input.Password autoComplete="new-password" value={recoveryKey} onChange={(event) => setRecoveryKey(event.target.value)} placeholder="设置独立恢复密钥" />
              <PasswordStrengthIndicator password={recoveryKey} label="恢复密钥" />
            </div>
            <Input.Password autoComplete="new-password" value={recoveryKeyConfirmation} onChange={(event) => setRecoveryKeyConfirmation(event.target.value)} placeholder="再次输入恢复密钥" />
            <Button type="primary" loading={savingRecoveryKey} disabled={serverState !== "online"} onClick={() => void persistRecoveryKey()}>保存恢复密钥</Button>
          </Space>
        </Card>
        <PasskeyManager />
      </section>
    );

    if (activeSection === "voice") return (
      <section className="settings-content">
        <header className="settings-content__heading"><Typography.Title level={2}>语音</Typography.Title><Typography.Paragraph>使用当前浏览器的语音识别与播报能力；识别后的文字进入输入框，由你发送。语言使用常规设置。</Typography.Paragraph></header>
        <SettingGroup title="语音对话">
          <SettingRow title="语音输入" description="开启后可点击会话中的麦克风。浏览器可能使用自身的在线识别服务；不支持的宿主会明确提示。"><SettingsSwitch label="开启语音输入" checked={settings.aiRuntime.voiceInputEnabled} onChange={() => updateSettings("aiRuntime", { ...settings.aiRuntime, voiceInputEnabled: !settings.aiRuntime.voiceInputEnabled })} /></SettingRow>
          <SettingRow title="播报完成的回复" description="使用浏览器语音合成播报本次新完成的回复；新任务会停止当前播报。"><SettingsSwitch label="自动播报" checked={settings.aiRuntime.readResponsesAloud} onChange={() => updateSettings("aiRuntime", { ...settings.aiRuntime, readResponsesAloud: !settings.aiRuntime.readResponsesAloud })} /></SettingRow>
        </SettingGroup>
      </section>
    );

    if (activeSection === "general") return (
      <section className="settings-content">
        <header className="settings-content__heading"><div><Typography.Title level={2}>常规</Typography.Title></div></header>
        <SettingGroup title="访问边界">
          <SettingRow title="小鱼智能体 项目权限模式" description="完全权限下，模型可自主执行当前应用的全部项目操控，不再逐项审批；实际操作由项目 Runtime 与对应 Host/Daemon 执行。" status="账户级设置">
            <Button onClick={() => selectSection("permissions")}>管理权限</Button>
          </SettingRow>
        </SettingGroup>
        <SettingGroup title="常规">
          <SettingRow title="项目外聊天文件夹" description="项目外新聊天默认归入此工作区；会话记录仍保存在 LFAA 的 .lfaa 数据目录中。">
            <div className="settings-folder-value" title={defaultWorkspaceLocation.path ?? (defaultWorkspaceLocation.error || "默认工作区尚未初始化")}>
              <span>{defaultWorkspaceLocation.status === "loading" ? "正在读取…" : defaultWorkspaceLocation.status === "error" ? "读取失败" : defaultWorkspaceLocation.path ?? "默认工作区尚未初始化"}</span>
              <Button disabled={defaultWorkspaceLocation.status === "loading"} onClick={() => defaultWorkspaceLocation.status === "error" ? setDefaultWorkspaceReload(value => value + 1) : onNavigate("/work")}>
                {defaultWorkspaceLocation.status === "error" ? "重试" : "管理工作区"}
              </Button>
            </div>
          </SettingRow>
          <SettingRow title="默认文件打开位置" description="选择文件操作使用系统默认应用，或在执行时再询问。">
            <Select value={settings.general.fileOpenLocation} options={[{ value: "system", label: "系统默认应用" }, { value: "ask", label: "每次询问" }]} onChange={(value) => updateGeneral({ fileOpenLocation: value })} />
          </SettingRow>
          <SettingRow title="智能体环境" description="选择 Agent Runtime 执行任务时使用的主机环境；节点能力接入后生效。">
            <Select value={settings.general.agentEnvironment} options={[{ value: "system", label: "自动检测" }, { value: "windows-native", label: "Windows 原生" }, { value: "wsl", label: "WSL" }, { value: "linux", label: "Linux" }]} onChange={(value) => updateGeneral({ agentEnvironment: value })} />
          </SettingRow>
          <SettingRow title="集成终端 Shell" description="新建终端与未单独指定 Shell 的命令使用此选择；切换后，已打开的终端需新建会话才会生效。">
            <Select value={settings.general.integratedShell} options={[{ value: "system", label: "系统默认" }, { value: "powershell", label: "Windows PowerShell" }, { value: "cmd", label: "命令提示符" }, { value: "bash", label: "Bash" }, { value: "zsh", label: "Zsh" }]} onChange={(value) => updateGeneral({ integratedShell: value })} />
          </SettingRow>
          <SettingRow title="语言" description="当前界面提供简体中文；其他语言需前端翻译资源接入后生效。">
            <Select value={settings.general.language} options={[{ value: "system", label: "自动检测" }, { value: "zh-CN", label: "简体中文" }, { value: "en-US", label: "English" }]} onChange={(value) => updateGeneral({ language: value })} />
          </SettingRow>
          <SettingRow title="默认使用完整视图" description="保存新工作区优先使用完整布局的偏好；当前应用工作区已使用完整视图。">
            <SettingsSwitch label="默认使用完整视图" checked={settings.general.defaultFullView} onChange={() => updateGeneral({ defaultFullView: !settings.general.defaultFullView })} />
          </SettingRow>
          <SettingRow title="底部面板" description="在应用工作区标题栏显示底部终端面板入口。">
            <SettingsSwitch label="底部面板入口" checked={settings.general.showBottomPanelControl} onChange={() => updateGeneral({ showBottomPanelControl: !settings.general.showBottomPanelControl })} />
          </SettingRow>
          <SettingRow title="默认终端位置" description="选择节点任务输出面板的位置，可显示在底部或右侧；交互式终端的 Shell 由上方设置控制。">
            <Select value={settings.general.terminalPosition} options={[{ value: "bottom", label: "底部面板" }, { value: "right", label: "右侧面板" }]} onChange={(value) => updateGeneral({ terminalPosition: value })} />
          </SettingRow>
          <SettingRow title="开源许可证" description="查看 LFAA 前端直接依赖的许可证声明。">
            <Button onClick={() => setLicensesModalOpen(true)}>打开许可证</Button>
          </SettingRow>
        </SettingGroup>
        <SettingGroup title="工作台导航布局">
          <SettingRow title="应用导航栏布局" description="选择应用侧栏、工作区和工具栏的预设排列；可继续拖动分隔线调整宽度。">
            <div className="settings-layout-options" role="group" aria-label="应用导航栏布局">
              {([
                ["left-two-column", "左右布局", "左侧应用导航与主工作区"],
                ["three-column", "三列布局", "左侧导航、主工作区与右侧工具"],
                ["right-tools", "工作区 + 工具", "主工作区与右侧工具"],
                ["focus", "专注模式", "仅显示工作区"]
              ] as const).map(([layout, title, description]) => (
                <button key={layout} type="button" className={`settings-layout-option${settings.general.navigationLayout === layout ? " is-selected" : ""}`} aria-pressed={settings.general.navigationLayout === layout} onClick={() => updateGeneral({ navigationLayout: layout })}>
                  <span className={`settings-layout-option__preview settings-layout-option__preview--${layout}`} aria-hidden="true"><i /><i /><i /></span>
                  <strong>{title}</strong><small>{description}</small>
                </button>
              ))}
            </div>
          </SettingRow>
        </SettingGroup>
        <SettingGroup title="界面动效">
          <SettingRow title="卡片动效" description="统一控制已接入共享动效的卡片。普通卡片加入共享标记即可使用；减少动态效果偏好优先生效。">
            <MotionEffectSelector
              ariaLabel="卡片动画效果"
              previewKind="card"
              value={settings.general.cardMotionEffect ?? DEFAULT_USER_SETTINGS.general.cardMotionEffect}
              onChange={(cardMotionEffect) => updateGeneral({ cardMotionEffect })}
            />
          </SettingRow>
          <SettingRow title="弹窗动效" description="统一控制应用对话框、确认弹窗和确认气泡；减少动态效果偏好优先。">
            <MotionEffectSelector
              ariaLabel="弹窗动画效果"
              previewKind="dialog"
              value={settings.general.dialogMotionEffect ?? DEFAULT_USER_SETTINGS.general.dialogMotionEffect}
              onChange={(dialogMotionEffect) => updateGeneral({ dialogMotionEffect })}
            />
          </SettingRow>
        </SettingGroup>
        <SettingGroup title="编辑器">
          <SettingRow title="纯文本编辑器" description="在写作编辑器接入后，按纯文本方式编辑内容。">
            <SettingsSwitch label="纯文本编辑器" checked={settings.general.plainTextEditor} onChange={() => updateGeneral({ plainTextEditor: !settings.general.plainTextEditor })} />
          </SettingRow>
          <SettingRow title="发送快捷键" description="设置 小鱼智能体 输入框按 Enter 时发送，或插入新行。">
            <Select value={settings.general.sendShortcut} options={[{ value: "enter", label: "Enter 发送" }, { value: "ctrl-enter", label: "Ctrl + Enter 发送" }]} onChange={(value) => updateGeneral({ sendShortcut: value })} />
          </SettingRow>
          <SettingRow title="跟进处理方式" description="小鱼智能体 正在运行时，选择后续消息排队或引导当前任务。">
            <Select value={settings.general.followupBehavior} options={[{ value: "queue", label: "加入队列" }, { value: "steer", label: "引导当前运行" }]} onChange={(value) => updateGeneral({ followupBehavior: value })} />
          </SettingRow>
        </SettingGroup>
        <SettingGroup title="弹出窗口">
          <SettingRow title="弹出窗口快捷键" description="为桌面弹出窗口保存全局快捷键；不设置则保持关闭。">
            <Input value={settings.general.popupShortcut} placeholder="关闭" maxLength={48} onChange={(event) => updateGeneral({ popupShortcut: event.target.value })} />
          </SettingRow>
        </SettingGroup>
        <SettingGroup title="趣味实验">
          <SettingRow title="彩纸礼炮" description="任务完成时显示彩纸效果；需要任务完成事件和桌面动效接入。">
            <SettingsSwitch label="彩纸礼炮" checked={settings.general.confettiEnabled} onChange={() => updateGeneral({ confettiEnabled: !settings.general.confettiEnabled })} />
          </SettingRow>
        </SettingGroup>
        <SettingGroup title="LFAA 工作台">
          <SettingRow title="默认首页" description="登录后直接进入小鱼智能体对话；专业应用可从左侧应用菜单打开。">
            <Typography.Text>小鱼智能体</Typography.Text>
          </SettingRow>
          <SettingRow title="服务连接状态" description="控制工作台顶栏和左侧导航中的控制端连接状态显示。">
            <SettingsSwitch label="服务连接状态" checked={settings.general.showServiceStatus} onChange={() => updateGeneral({ showServiceStatus: !settings.general.showServiceStatus })} />
          </SettingRow>
        </SettingGroup>
      </section>
    );

    if (activeSection === "notifications") return (
      <section className="settings-content">
        <header className="settings-content__heading"><div><Typography.Title level={2}>通知</Typography.Title></div></header>
        <Alert className="settings-inline-alert" type="info" showIcon message="当前接入 LFAA 自身通知" description="目前仅接入小鱼智能体回复通知；ChatGPT/Codex 等外部事件暂无连接器。" />
        {notificationGroup}
      </section>
    );

    if (activeSection === "wallpaperEngine") return (
      <DshSlotOutlet name="settings.section" fallback={(
        <section className="settings-content settings-wallpaper-engine">
          <header className="settings-content__heading"><div><span className="settings-eyebrow">扩展设置</span><Typography.Title level={2}>壁纸引擎</Typography.Title><Typography.Paragraph>这里显示由 DSH 插件提供的原生设置界面。</Typography.Paragraph></div></header>
          <div className="settings-wallpaper-engine__fallback" role="group" aria-labelledby="settings-wallpaper-engine-fallback-title">
            <span className="settings-wallpaper-engine__icon"><WorkbenchIcon name="extension" size={20} /></span>
            <div className="settings-wallpaper-engine__copy">
              <strong id="settings-wallpaper-engine-fallback-title">壁纸插件设置页尚未加载</strong>
              <p>当前没有 DSH Client 内容提供此设置页。请确认 Profile 插件已安装并启用；若插件状态正常，再检查 Client Runtime 或插件入口的加载错误。</p>
            </div>
            <Button type="primary" onClick={() => onNavigate("/plugin-manager")}>查看 Profile 插件</Button>
          </div>
        </section>
      )} />
    );
    if (activeSection === "appearance") return (
      <section className="settings-content settings-content--appearance">
        <header className="settings-content__heading settings-content__heading--appearance">
          <div className="settings-content__heading-copy">
            <span className="settings-eyebrow">界面显示</span>
            <div className="settings-content__heading-title-row">
              <Typography.Title level={2}>外观</Typography.Title>
              <span className="settings-preview" style={{ "--preview-accent": "var(--settings-accent)" } as CSSProperties}>LFAA</span>
            </div>
            <Typography.Paragraph>调整主题、强调色，并为登录页和不同工作区选择背景图片。</Typography.Paragraph>
          </div>
        </header>
        <div className="settings-appearance-tabs" role="tablist" aria-label="外观设置页签" onKeyDown={(event) => {
          if (event.key === "ArrowRight" || event.key === "ArrowLeft" || event.key === "Home" || event.key === "End") {
            event.preventDefault();
            const nextTab = event.key === "Home" ? "presets" : event.key === "End" ? "settings" : appearancePageTab === "presets" ? "settings" : "presets";
            setAppearancePageTab(nextTab);
            (nextTab === "presets" ? appearancePresetsTabRef : appearanceSettingsTabRef).current?.focus();
          }
        }}>
          <button ref={appearancePresetsTabRef} type="button" role="tab" id="appearance-presets-tab" aria-controls="appearance-presets-panel" aria-selected={appearancePageTab === "presets"} tabIndex={appearancePageTab === "presets" ? 0 : -1} disabled={appearancePresetBusy} onClick={() => setAppearancePageTab("presets")}>预设</button>
          <button ref={appearanceSettingsTabRef} type="button" role="tab" id="appearance-settings-tab" aria-controls="appearance-settings-panel" aria-selected={appearancePageTab === "settings"} tabIndex={appearancePageTab === "settings" ? 0 : -1} disabled={appearancePresetBusy} onClick={() => setAppearancePageTab("settings")}>外观设置</button>
        </div>
        {appearancePageTab === "presets" ? <div className="settings-appearance-tabpanel" id="appearance-presets-panel" role="tabpanel" aria-labelledby="appearance-presets-tab" tabIndex={0}>
          <AppearancePresetsPanel settings={settings} resolvedTheme={resolvedTheme} uploadedBackgrounds={uploadedBackgrounds} busy={appearancePresetBusy} onSaveCurrent={saveCurrentAppearancePreset} onApply={applySavedAppearancePreset} onApplyWritingPreset={applyWritingWorkspacePreset} onDelete={deleteSavedAppearancePreset} onExport={exportSavedAppearancePreset} onImport={importAppearancePresetFile} />
        </div> : <div className="settings-appearance-tabpanel" id="appearance-settings-panel" role="tabpanel" aria-labelledby="appearance-settings-tab" tabIndex={0}>
        <SettingGroup title="主题">
          <SettingRow title="颜色主题" description="选择浅色、深色，或跟随操作系统。" status="已接入">
            <div className="settings-theme-options" role="group" aria-label="颜色主题">
              {([
                ["light", "浅色", "明亮清晰的工作台"],
                ["dark", "深色", "适合低光环境"],
                ["system", "跟随系统", "与操作系统外观同步"]
              ] as const).map(([theme, title, description]) => (
                <button
                  key={theme}
                  type="button"
                  className={`settings-theme-option${settings.appearance.theme === theme ? " is-selected" : ""}`}
                  aria-pressed={settings.appearance.theme === theme}
                  onClick={() => updateSettings("appearance", { ...settings.appearance, theme })}
                >
                  <span className={`settings-theme-option__preview settings-theme-option__preview--${theme}`} aria-hidden="true"><i /><i /><i /></span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </button>
              ))}
            </div>
          </SettingRow>
          {!settings.appearance.advanced.separateModes ? <SettingRow id="appearance-accent-color" title="强调色" description="应用到按钮、链接和选中状态。" status="已接入">
            <div className="settings-color-options">{accentColors.map((color) => <button key={color} type="button" aria-label={`选择强调色 ${color}`} aria-pressed={settings.appearance.accentColor === color} style={{ backgroundColor: color }} onClick={() => updateSettings("appearance", { ...settings.appearance, accentColor: color })} />)}</div>
          </SettingRow> : null}
        </SettingGroup>
        <SettingGroup title="字体大小">
          <SettingRow title="界面字号" description="调整界面正文基准字号；页面标题、分组标题和设置说明会按统一层级同步缩放。" status="实时预览">
            <div className="settings-number-control"><InputNumber min={10} max={24} precision={0} value={settings.appearance.advanced.interfaceFontSize} onChange={(value) => { if (typeof value === "number") updateAppearanceAdvanced({ interfaceFontSize: value }); }} /><span>px</span></div>
          </SettingRow>
          <SettingRow title="代码字体大小" description="调整终端、代码片段和差异内容的基础字号。" status="实时预览">
            <div className="settings-number-control"><InputNumber min={8} max={24} precision={0} value={settings.appearance.advanced.codeFontSize} onChange={(value) => { if (typeof value === "number") updateAppearanceAdvanced({ codeFontSize: value }); }} /><span>px</span></div>
          </SettingRow>
        </SettingGroup>
        <SettingGroup title="侧边栏">
          <SettingRow title="统一侧边栏颜色" description="应用于设置导航、应用导航和工具资源栏；此处控制色调，三处底色透明度统一跟随背景遮罩。" status="实时预览">
            <div className="settings-sidebar-color-control">
              <label className="settings-sidebar-color-picker">
                <input
                  type="color"
                  aria-label="自定义侧边栏颜色"
                  value={settings.appearance.sidebarColor === "auto" ? (resolvedTheme === "dark" ? "#262626" : "#f5f5f5") : settings.appearance.sidebarColor}
                  onChange={(event) => updateSettings("appearance", { ...settings.appearance, sidebarColor: event.target.value.toLocaleLowerCase() })}
                />
                <span>自定义</span>
              </label>
              <Button
                size="small"
                aria-pressed={settings.appearance.sidebarColor === "auto"}
                className={settings.appearance.sidebarColor === "auto" ? "is-selected" : ""}
                onClick={() => updateSettings("appearance", { ...settings.appearance, sidebarColor: "auto" })}
              >跟随主题</Button>
              <span className="settings-sidebar-color-value">{settings.appearance.sidebarColor === "auto" ? "自动" : settings.appearance.sidebarColor}</span>
            </div>
          </SettingRow>
        </SettingGroup>
        <SettingGroup title="背景图片">
          <SettingRow title="设置背景位置" description="选择“登录页（当前设备）”并保存后，背景会在本机下一次打开登录页时生效；其他背景保存后用于对应工作区。" status="已接入">
            <Select value={backgroundTarget} options={appearanceBackgroundTargets.map((item) => ({ value: item.id, label: item.label }))} onChange={setBackgroundTarget} />
          </SettingRow>
          <div className="settings-background-picker" role="group" aria-label={`${appearanceBackgroundTargets.find((item) => item.id === backgroundTarget)?.label ?? "工作区"}背景图片`}>
            {visibleBackgroundChoices.map((item) => {
              const selected = selectedBackgroundForTarget === item.id;
              const backgroundToRemove = item.uploadedBackground;
              return <div key={item.id} className="settings-background-choice">
                <button
                  type="button"
                  className={`settings-background-card${selected ? " is-selected" : ""}${item.file ? "" : " settings-background-card--plain"}`}
                  aria-pressed={selected}
                  aria-label={`为${appearanceBackgroundTargets.find((target) => target.id === backgroundTarget)?.label ?? "工作区"}选择${item.name}`}
                  onClick={() => updateSettings("appearance", { ...settings.appearance, backgrounds: { ...settings.appearance.backgrounds, [backgroundTarget]: item.id } })}
                >
                  {item.file ? <img className="settings-background-card__image" src={item.file} alt="" aria-hidden="true" loading="lazy" decoding="async" /> : null}
                  <span className="settings-background-card__check" aria-hidden="true">{selected ? "✓" : ""}</span>
                  <span className="settings-background-card__name" title={backgroundToRemove?.name ?? item.name}>{backgroundToRemove?.name ?? item.name}</span>
                </button>
                {backgroundToRemove ? <Popconfirm title="删除这张背景图片？" description="如果正在使用，对应位置将恢复为纯色。" okText="删除" cancelText="取消" onConfirm={() => void removeBackground(backgroundToRemove)}>
                  <Button className="settings-background-choice__delete" type="text" size="small" aria-label={`删除自定义背景 ${backgroundToRemove.name}`}>删除</Button>
                </Popconfirm> : null}
              </div>;
            })}
          </div>
          <p className="settings-background-hint">图片卡片会显示背景预览；Minecraft 常规与 小鱼智能体 共用同一张 Minecraft 工作区背景，设置中心、小鱼智能体和各应用工作区分别保存。当前图片应用于：{appearanceBackgroundTargets.find((item) => item.id === backgroundTarget)?.label}。登录页只使用内置图片，自定义上传仍限于登录后的工作区。</p>
          {backgroundActionError ? <Alert className="settings-inline-alert" type="error" showIcon message="背景图片操作失败" description={backgroundActionError} /> : null}
          {backgroundTarget === "login" ? (
            <SettingRow title="上传背景图片" description="登录页只支持内置图片；切换到其他位置后可上传账户私有背景。" status="仅内置图片">
              <Tag>不适用于登录页</Tag>
            </SettingRow>
          ) : (
            <SettingRow title="上传背景图片" description="仅支持 PNG、JPEG、WebP；单张不超过 3 MiB、8192 像素边长和 2000 万像素。" status="已接入">
              <label className={`settings-upload-button${uploadingBackground ? " is-busy" : ""}`}>{uploadingBackground ? "上传中…" : "选择图片"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploadingBackground} onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void addBackground(file); event.currentTarget.value = ""; }} /></label>
            </SettingRow>
          )}
        </SettingGroup>
        <SettingGroup title={`${appearanceBackgroundTargets.find((item) => item.id === backgroundTarget)?.label ?? "当前区域"} · 区域效果`}>
          <SettingRow title="本区域效果" description="只影响上方选中的位置；没有覆盖的效果继续跟随全局默认。恢复本区域默认会清除这里的覆盖，不会修改全局值或其他位置。" status={hasAreaEffectOverride ? "有自定义覆盖" : "跟随全局默认"}>
            <Button size="small" disabled={!hasAreaEffectOverride} onClick={resetSelectedAreaEffects}>恢复本区域默认</Button>
          </SettingRow>
          <SettingRow title="背景遮罩" description={backgroundTarget === "login"
            ? selectedAreaEffects.overlay === null
              ? `当前继承全局遮罩 ${settings.appearance.overlay}% 的 40%（${effectiveAreaOverlay}%）；登录页可以单独设置 0–75%。`
              : "登录页使用单独遮罩值；0% 保持背景清晰，数值越高表单周围的遮罩越明显。"
            : selectedAreaEffects.overlay === null
              ? `当前继承全局遮罩 ${settings.appearance.overlay}%；可单独调整此区域，或恢复本区域默认继续跟随全局值。`
              : "当前区域使用自己的遮罩值；0% 时背景最清晰，数值越高遮罩越明显。"}
          status={selectedAreaEffects.overlay === null ? "继承全局" : "本区域自定义"}>
            <div className="settings-slider"><Slider min={0} max={75} value={effectiveAreaOverlay} onChange={(overlay) => updateSelectedAreaEffects({ overlay })} /><output>{effectiveAreaOverlay}%</output></div>
          </SettingRow>
          {backgroundTarget !== "login" && effectiveAreaBlur !== null ? <SettingRow title="玻璃模糊" description={selectedAreaBlurOverride === null
            ? `当前继承全局模糊 ${settings.appearance.blur}px；可单独调整此区域，或恢复本区域默认继续跟随全局值。`
            : "当前区域使用自己的玻璃模糊值；0px 为清晰，数值越高背景虚化越明显。"}
          status={selectedAreaBlurOverride === null ? "继承全局" : "本区域自定义"}>
            <div className="settings-slider"><Slider min={0} max={32} value={effectiveAreaBlur} onChange={(blur) => updateSelectedAreaEffects({ blur })} /><output>{effectiveAreaBlur}px</output></div>
          </SettingRow> : null}
        </SettingGroup>
        <SettingGroup title="背景显示 · 全局默认">
          <SettingRow title="背景遮罩" description="作为未单独设置区域的默认值，控制工作区壁纸遮罩和相关玻璃表面的底色透明度。新账户默认 65%，已有账户设置保持原值。登录页的继承值仍按 40% 强度呈现；消息画布不另加局部遮罩。" status="已接入"><div className="settings-slider"><Slider min={0} max={75} value={settings.appearance.overlay} onChange={(overlay) => updateSettings("appearance", { ...settings.appearance, overlay })} /><output>{settings.appearance.overlay}%</output></div></SettingRow>
          <SettingRow title="玻璃模糊" description="作为未单独设置区域的默认值，调整顶栏、半透明导航栏、小鱼智能体输入区、写作上下文作品卡片和壁纸弹窗表面的模糊强度；消息画布保持透明，设置正文不做实时模糊。" status="已接入"><div className="settings-slider"><Slider min={0} max={32} value={settings.appearance.blur} onChange={(blur) => updateSettings("appearance", { ...settings.appearance, blur })} /><output>{settings.appearance.blur}px</output></div></SettingRow>
          <SettingRow title="写作光线背景" description="在普通写作编辑区显示跟随当前主题强调色的柔和光线；也可通过写作工具栏的灯光开关快速控制。" status="已接入">
            <SettingsSwitch label="写作光线背景" checked={settings.appearance.advanced.writingLightRaysEnabled} onChange={() => updateAppearanceAdvanced({ writingLightRaysEnabled: !settings.appearance.advanced.writingLightRaysEnabled })} />
          </SettingRow>
          <SettingRow title="更新界面不透明度" description="控制顶栏更新悬浮卡片和更新确认弹窗的清晰度；默认 92%，数值越高壁纸透出越少，并继续跟随当前主题的玻璃模糊设置。" status="实时预览"><div className="settings-slider"><Slider min={70} max={100} value={settings.appearance.updateSurfaceOpacity} onChange={(updateSurfaceOpacity) => updateSettings("appearance", { ...settings.appearance, updateSurfaceOpacity })} /><output>{settings.appearance.updateSurfaceOpacity}%</output></div></SettingRow>
        </SettingGroup>
        <SettingGroup title="小鱼智能体 空闲虚化">
          <SettingRow title="空闲时虚化回复" description="开启后，鼠标、键盘、滚动或触屏操作停止达到设定时长后，回复内容、刻度和滚动条按强度虚化并淡出；再次操作后平滑恢复清晰。输入框保持清晰。">
            <SettingsSwitch label="空闲时虚化回复" checked={settings.appearance.advanced.aiWorkOutputFocusBlurEnabled} onChange={() => updateAppearanceAdvanced({ aiWorkOutputFocusBlurEnabled: !settings.appearance.advanced.aiWorkOutputFocusBlurEnabled })} />
          </SettingRow>
          <AppearanceFocusBlurSliders
            enabled={settings.appearance.advanced.aiWorkOutputFocusBlurEnabled}
            idleMinutes={settings.appearance.advanced.aiWorkOutputFocusBlurIdleSeconds / 60}
            percent={settings.appearance.advanced.aiWorkOutputFocusBlurPercent}
            onIdleMinutesChange={minutes => updateAppearanceAdvanced({ aiWorkOutputFocusBlurIdleSeconds: minutes * 60 })}
            onPercentChange={aiWorkOutputFocusBlurPercent => updateAppearanceAdvanced({ aiWorkOutputFocusBlurPercent })}
          />
        </SettingGroup>
        <section className="settings-advanced">
          <button className="settings-advanced__toggle" type="button" aria-expanded={appearanceAdvancedOpen} onClick={() => setAppearanceAdvancedOpen((open) => !open)}>
            <span>高级</span>
            <svg className="settings-advanced__chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="m4 2.5 3.5 3.5L4 9.5" /></svg>
          </button>
          {appearanceAdvancedOpen ? <div className="settings-advanced__content">
            <AdvancedGroup>
              <SettingRow title="登录进入动画" description="登录成功后从登录卡片一镜进入工作台。可选择已装配的 DSH Client 插件动画；未安装或不可用时使用 LFAA 内置动画。">
                <Select
                  value={settings.appearance.advanced.authTransitionPluginId}
                  options={[
                    { value: "builtin", label: "LFAA 内置 · 一镜到底" },
                    ...(authTransitionPlugins.filter((entry) => entry.id !== "builtin").map((entry) => ({ value: entry.id, label: entry.label?.trim() || entry.id }))),
                    ...(!authTransitionPlugins.some((entry) => entry.id === settings.appearance.advanced.authTransitionPluginId) && settings.appearance.advanced.authTransitionPluginId !== "builtin"
                      ? [{ value: settings.appearance.advanced.authTransitionPluginId, label: `所选动画未加载 · ${settings.appearance.advanced.authTransitionPluginId}`, disabled: true }]
                      : [])
                  ]}
                  onChange={(authTransitionPluginId: string) => updateAppearanceAdvanced({ authTransitionPluginId })}
                />
              </SettingRow>
              <SettingRow title="减少动态效果" description="开启后跳过登录进入动画并减少界面动画；系统模式遵循操作系统的减少动态效果设置。">
                <Select value={settings.appearance.advanced.reducedMotion} options={[{ value: "system", label: "系统" }, { value: "on", label: "开启" }, { value: "off", label: "关闭" }]} onChange={(reducedMotion: UserSettings["appearance"]["advanced"]["reducedMotion"]) => updateAppearanceAdvanced({ reducedMotion })} />
              </SettingRow>
              <SettingRow title="分别设置浅色和深色模式" description="分别保存浅色与深色模式的强调色和字体；当前模式由上方主题选择控制。">
                <SettingsSwitch label="分别设置浅色和深色模式" checked={settings.appearance.advanced.separateModes} onChange={() => updateAppearanceAdvanced({ separateModes: !settings.appearance.advanced.separateModes })} />
              </SettingRow>
            </AdvancedGroup>
            <AdvancedGroup>
              {settings.appearance.advanced.separateModes ? <div className="settings-appearance-profiles">
                {(["light", "dark"] as const).map((mode) => {
                  const profile = settings.appearance.advanced.modeStyles[mode];
                  const modeLabel = mode === "light" ? "浅色模式" : "深色模式";
                  return <section className={`settings-appearance-profile settings-appearance-profile--${mode}`} key={mode} style={{ "--settings-profile-accent": profile.accentColor } as CSSProperties}>
                    <h4>{modeLabel}</h4>
                    <div className="settings-appearance-profile__row"><span>强调色</span><div className="settings-color-options">{accentColors.map((color) => <button key={color} type="button" aria-label={`${modeLabel}选择强调色 ${color}`} aria-pressed={profile.accentColor === color} style={{ backgroundColor: color }} onClick={() => updateAppearanceMode(mode, { accentColor: color })} />)}</div></div>
                    <div className="settings-appearance-profile__fields">
                      <label><span>界面字体样式</span><Select value={profile.fonts.interface} options={textFontOptions} onChange={(value: UserSettings["appearance"]["advanced"]["fonts"]["interface"]) => updateAppearanceModeFonts(mode, { interface: value })} /></label>
                      <label><span>内容字体</span><Select value={profile.fonts.content} options={textFontOptions} onChange={(value: UserSettings["appearance"]["advanced"]["fonts"]["content"]) => updateAppearanceModeFonts(mode, { content: value })} /></label>
                      <label><span>代码字体</span><Select value={profile.fonts.code} options={codeFontOptions} onChange={(value: UserSettings["appearance"]["advanced"]["fonts"]["code"]) => updateAppearanceModeFonts(mode, { code: value })} /></label>
                    </div>
                  </section>;
                })}
              </div> : <>
                <SettingRow title="界面字体样式" description="应用于导航、按钮和设置界面。"><Select value={settings.appearance.advanced.fonts.interface} options={textFontOptions} onChange={(value: UserSettings["appearance"]["advanced"]["fonts"]["interface"]) => updateAppearanceFonts({ interface: value })} /></SettingRow>
                <SettingRow title="内容字体" description="应用于工作区说明和普通正文。"><Select value={settings.appearance.advanced.fonts.content} options={textFontOptions} onChange={(value: UserSettings["appearance"]["advanced"]["fonts"]["content"]) => updateAppearanceFonts({ content: value })} /></SettingRow>
                <SettingRow title="代码字体" description="应用于终端、代码片段和差异内容。"><Select value={settings.appearance.advanced.fonts.code} options={codeFontOptions} onChange={(value: UserSettings["appearance"]["advanced"]["fonts"]["code"]) => updateAppearanceFonts({ code: value })} /></SettingRow>
              </>}
            </AdvancedGroup>
            <AdvancedGroup>
              <SettingRow title="半透明侧边栏" description="控制设置与应用导航、工具资源栏的玻璃模糊；有壁纸时，这些主要表面透明度统一跟随背景遮罩。">
                <SettingsSwitch label="半透明侧边栏" checked={settings.appearance.advanced.translucentSidebar} onChange={() => updateAppearanceAdvanced({ translucentSidebar: !settings.appearance.advanced.translucentSidebar })} />
              </SettingRow>
              <SettingRow title="对比度" description="调整界面边界和控件轮廓的对比强度。">
                <div className="settings-slider"><Slider min={0} max={100} value={settings.appearance.advanced.contrast} onChange={(contrast) => updateAppearanceAdvanced({ contrast })} /><output>{settings.appearance.advanced.contrast}</output></div>
              </SettingRow>
            </AdvancedGroup>
            <AdvancedGroup>
              <SettingRow title="差异标记" description="用颜色或 +/− 标记表示新增和删除内容。" status="差异视图接入后显示">
                <Select value={settings.appearance.advanced.diffMarkers} options={[{ value: "color", label: "颜色" }, { value: "symbols", label: "+/− 标记" }]} onChange={(diffMarkers: UserSettings["appearance"]["advanced"]["diffMarkers"]) => updateAppearanceAdvanced({ diffMarkers })} />
              </SettingRow>
              <SettingRow title="使用指针光标" description="悬停按钮、链接和其他可交互元素时显示指针光标。">
                <SettingsSwitch label="使用指针光标" checked={settings.appearance.advanced.pointerCursor} onChange={() => updateAppearanceAdvanced({ pointerCursor: !settings.appearance.advanced.pointerCursor })} />
              </SettingRow>
            </AdvancedGroup>
          </div> : null}
        </section>
        </div>}
      </section>
    );

    if (activeSection === "shortcuts") return (
      <section className="settings-content">
        <header className="settings-content__heading"><div><span className="settings-eyebrow">键盘操作</span><Typography.Title level={2}>键盘快捷键</Typography.Title><Typography.Paragraph>点击输入框并按下新的组合键。快捷键会在本工作台中生效。</Typography.Paragraph></div></header>
        <SettingGroup title="导航">
          <ShortcutRow title="打开设置中心" value={settings.shortcuts.openSettings} onChange={(value) => updateShortcut("openSettings", value)} />
          <ShortcutRow title="返回首页" value={settings.shortcuts.openHome} onChange={(value) => updateShortcut("openHome", value)} />
          <ShortcutRow title="前往游戏库中的 Steam 游戏服务" value={settings.shortcuts.openSteamcmd} onChange={(value) => updateShortcut("openSteamcmd", value)} />
          <ShortcutRow title="前往游戏库中的 Minecraft" value={settings.shortcuts.openMinecraft} onChange={(value) => updateShortcut("openMinecraft", value)} />
          <ShortcutRow title="前往写作入口" value={settings.shortcuts.openWriting} onChange={(value) => updateShortcut("openWriting", value)} />
        </SettingGroup>
        <SettingGroup title="应用工作区面板">
          <ShortcutRow title="切换应用导航栏" value={settings.shortcuts.toggleSidebar} onChange={(value) => updateShortcut("toggleSidebar", value)} />
          <ShortcutRow title="切换工具与资源栏" value={settings.shortcuts.toggleContextPanel} onChange={(value) => updateShortcut("toggleContextPanel", value)} />
          <ShortcutRow title="打开侧边聊天" value={settings.shortcuts.openSideChat} onChange={(value) => updateShortcut("openSideChat", value)} />
          <ShortcutRow title="切换壁纸引擎侧栏" value={settings.shortcuts.wallpaperSidebarToggle} onChange={(value) => updateShortcut("wallpaperSidebarToggle", value)} />
          <ShortcutRow title="切换底部面板" value={settings.shortcuts.toggleBottomPanel} onChange={(value) => updateShortcut("toggleBottomPanel", value)} />
          <ShortcutRow title="打开终端面板" value={settings.shortcuts.openTerminal} onChange={(value) => updateShortcut("openTerminal", value)} />
        </SettingGroup>
        <SettingGroup title="应用模式">
          <ShortcutRow title="切换到常规模式" value={settings.shortcuts.switchNormalMode} onChange={(value) => updateShortcut("switchNormalMode", value)} />
          <ShortcutRow title="切换到 小鱼智能体" value={settings.shortcuts.switchAiWorkMode} onChange={(value) => updateShortcut("switchAiWorkMode", value)} />
        </SettingGroup>
      </section>
    );

    if (activeSection === "ai") return (
      <section className="settings-content settings-content--ai">
        <header className="settings-content__heading"><div><span className="settings-eyebrow">模型服务接入</span><Typography.Title level={2}>AI 与模型</Typography.Title><Typography.Paragraph>普通方舟 API 仍由管理员配置为系统模型；Agent Plan 与 Coding Plan 按登录用户保存各自席位密钥，不再进入系统共享账户。</Typography.Paragraph></div></header>
        <Alert className="settings-inline-alert" type="info" showIcon message="系统 API 与个人套餐分开管理" description="已保存密钥不会返回浏览器。系统 Provider 由管理员维护；每个登录账户只能读取、调用和修改自己的 Agent Plan/Coding Plan 账户。当前账户已启用的个人套餐优先于系统默认模型。" />
        <SettingGroup title="AI Runtime 状态">
          <SettingRow title="Cordis 插件宿主" description={`当前运行组合已加载 ${activeRuntimePluginCount}/${runtimePlugins.length} 个宿主模块；AI 扩展登记 ${extensions.length} 项。`} status={runtimePluginHostReady ? "运行中" : "检查状态"}><Tag color={runtimePluginHostReady ? "green" : "orange"}>{runtimePluginHostReady ? "已就绪" : "检查插件页面"}</Tag></SettingRow>
          <SettingRow title="本账户生效模型" description={effectiveActiveAiAccount ? `${effectiveActiveAiAccount.providerId} · ${effectiveActiveAiAccount.modelId}；${effectiveActiveAiAccount.scope === "user" ? "个人套餐席位" : "系统默认模型"}。` : canAdmin ? "添加并启用系统模型或个人套餐后，小鱼智能体 才能请求模型。" : "系统管理员尚未配置模型；也可添加自己的 Agent Plan/Coding Plan 席位。"} status={effectiveActiveAiAccount ? "已启用" : "需要配置"}><Tag color={effectiveActiveAiAccount ? "green" : "default"}>{effectiveActiveAiAccount ? "可推理" : "未配置"}</Tag></SettingRow>
          <SettingRow title="会话存储" description="小鱼智能体 会话、消息和 Provider 返回的 Token 用量写入账户隔离的控制端 SQLite。" status={health?.persistence === "ready" ? "已连接" : "不可用"}><Tag>{health?.persistence === "ready" ? "SQLite · 已连接" : "SQLite · 未连接"}</Tag></SettingRow>
        </SettingGroup>
        <SettingGroup title="模型服务商">
          {providers.length ? <div className="ai-provider-grid">{providers.map((provider) => {
            const providerScope = provider.scope ?? "system";
            const providerAccounts = accounts.filter((account) => account.providerId === provider.id && (providerScope === "user" ? account.scope === "user" : account.scope !== "user"));
            const activeAccount = providerAccounts.find((account) => account.active);
            const providerAccountTarget = activeAccount ?? providerAccounts[0];
            const isEffective = Boolean(activeAccount && (providerScope === "user" || !personalPlanAccounts.some((account) => account.active)));
            const canConfigure = canAdmin || providerScope === "user";
            return <button className={`ai-provider-card${isEffective ? " is-active" : ""}`} key={provider.id} type="button" disabled={!canConfigure} title={providerAccountTarget ? "查看下方已保存的模型配置" : "添加服务商配置"} onClick={() => {
              if (providerAccountTarget) {
                document.getElementById(`settings-ai-account-${providerAccountTarget.id}`)?.scrollIntoView({ block: "center" });
                return;
              }
              openProviderConfiguration(provider);
            }}>
              <span className={`ai-provider-card__brand is-${provider.id}`} aria-hidden="true">{provider.name.slice(0, 2)}</span>
              <span className="ai-provider-card__body"><strong>{provider.name}</strong><span>{provider.description}</span><small>{activeAccount ? `${isEffective ? "当前生效" : "系统默认 · 个人套餐优先"} · ${activeAccount.modelId}` : providerAccounts.length ? `${providerScope === "user" ? "我的账户" : "系统已保存"} ${providerAccounts.length} 项` : providerScope === "user" ? "为当前登录账户配置个人席位" : canAdmin ? "点击配置系统模型" : "尚未配置，由管理员添加"}</small><span className="ai-provider-card__action">{providerAccountTarget ? "查看已保存配置" : "添加配置"}</span></span>
              <Tag className="ai-provider-card__status" color={isEffective ? "green" : activeAccount ? "blue" : undefined}>{isEffective ? "当前使用" : activeAccount ? "系统默认" : providerAccounts.length ? "已配置" : "未配置"}</Tag>
            </button>;
          })}</div> : <div className="settings-empty"><strong>正在读取服务商目录</strong><span>服务商列表由控制端提供。</span></div>}
        </SettingGroup>

        <SettingGroup title="外部 Coding Agent">
          <SettingRow
            title="Claude Agent SDK API Key"
            description="为当前 LFAA 账户保存 Anthropic Console API Key。密钥由控制端加密保存，仅在 Claude Agent SDK 子任务运行时使用；任务与工作区上下文会发送给 Anthropic。"
            status={claudeAgentCredentialStatus?.configured ? "已验证并加密保存" : "未配置"}
          >
            <div className="settings-ai-external-agent-controls">
              <Input.Password
                autoComplete="new-password"
                aria-label="Anthropic Console API Key"
                placeholder={claudeAgentCredentialStatus?.configured ? "已保存；输入新 Key 可验证并替换" : "输入 Anthropic Console API Key"}
                value={claudeAgentCredentialDraft}
                disabled={claudeAgentCredentialBusy}
                onChange={(event) => setClaudeAgentCredentialDraft(event.target.value)}
              />
              <Button type="primary" loading={claudeAgentCredentialBusy} disabled={!claudeAgentCredentialDraft.trim()} onClick={() => void saveClaudeAgentCredentialDraft()}>
                验证并保存
              </Button>
              <Popconfirm title="删除当前账户的 Anthropic API Key？" description="删除后 Claude Agent SDK 子任务将无法启动。" okText="删除" cancelText="取消" onConfirm={() => void removeClaudeAgentCredential()}>
                <Button danger disabled={!claudeAgentCredentialStatus?.configured || claudeAgentCredentialBusy}>删除密钥</Button>
              </Popconfirm>
            </div>
          </SettingRow>
          <Alert
            className="settings-inline-alert"
            type="info"
            showIcon
            message="使用 Anthropic Console API Key"
            description="系统不会读取本机 Claude Code 的登录态、OAuth 凭据或 claude.ai 账户。保存前会向 Anthropic Models API 验证密钥；SDK 使用独立临时配置目录，结束后清理。"
          />
        </SettingGroup>

        <Card className="settings-card ai-account-list" title="系统模型（按量 API）" extra={<Tag>{systemAiAccounts.length}</Tag>}>
          {!systemAiAccounts.length ? <div className="settings-empty"><strong>还没有系统模型配置</strong><span>{canAdmin ? "选择 OpenAI、DeepSeek 或普通方舟服务商，配置并测试系统 API Key。" : "请联系系统管理员配置系统模型，或添加自己的套餐席位。"}</span></div> : systemAiAccounts.map(renderAiAccountItem)}
        </Card>

        <Card className="settings-card ai-account-list" title="我的 Agent Plan / Coding Plan 席位" extra={<Tag>{personalPlanAccounts.length}</Tag>}>
          {!personalPlanAccounts.length ? <div className="settings-empty"><strong>当前账户没有套餐席位配置</strong><span>从上方选择 Agent Plan 或 Coding Plan，填写自己的专属 API Key 和官方 Model Name。此配置仅归当前登录账户所有。</span></div> : personalPlanAccounts.map(renderAiAccountItem)}
        </Card>

        <Modal
          rootClassName="settings-ai-provider-modal"
          getContainer={() => document.querySelector<HTMLElement>(".settings-page") ?? document.body}
          open={providerModalOpen}
          title={selectedProvider ? `配置 ${selectedProvider.name}` : "配置模型账户"}
          centered
          width={700}
          footer={null}
          closable={aiBusy === null}
          keyboard={aiBusy === null}
          onCancel={() => { if (aiBusy === null) setProviderModalOpen(false); }}
        >
          {selectedProvider ? <div className="ai-provider-modal__content">
            <p className="ai-provider-modal__description">{selectedProvider.description}{selectedProvider.documentationUrl ? <> · <Typography.Link href={selectedProvider.documentationUrl} target="_blank" rel="noreferrer">火山方舟官方接入文档</Typography.Link></> : null}</p>
            <div className="ai-provider-form-grid">
              {selectedProvider.options.length ? <div className="ai-provider-options-grid">
                {selectedProvider.options.map((option) => <label className="settings-field" key={option.id}><span>{option.label}</span>{option.choices.length ? <Select value={currentProviderOptions[option.id] ?? (option.id === "region" && providerId === "qwen" ? "ap-southeast-1" : option.choices[0]?.value)} options={option.choices.map((choice) => ({ value: choice.value, label: choice.label }))} onChange={(value) => { setProviderOptions((current) => ({ ...current, [providerId]: { ...current[providerId], [option.id]: value } })); setProviderApiKeyAttention(false); setError(""); setProbe(null); setModelTest(null); }} /> : <Input value={currentProviderOptions[option.id] ?? ""} onChange={(event) => { setProviderOptions((current) => ({ ...current, [providerId]: { ...current[providerId], [option.id]: event.target.value } })); setProviderApiKeyAttention(false); setError(""); setProbe(null); setModelTest(null); }} placeholder={`请输入${option.label}`} />}</label>)}
              </div> : null}
              <div className="ai-provider-credentials-grid">
                <label className="settings-field"><span>配置名称</span><Input value={accountName} maxLength={48} onChange={(event) => setAccountName(event.target.value)} placeholder={selectedProvider.scope === "user" ? "例如：我的 Coding Plan" : "例如：主模型"} /></label>
                <label className="settings-field"><span>{providerSecretLabel}</span><Input.Password status={providerApiKeyAttention ? "error" : undefined} aria-describedby={providerApiKeyAttention ? "provider-api-key-warning" : undefined} autoComplete="new-password" value={secret} onChange={(event) => { setSecret(event.target.value); if (event.target.value.trim()) setProviderApiKeyAttention(false); setError(""); setProbe(null); setModelTest(null); }} placeholder="输入密钥，仅在保存前保留" /></label>
              </div>
            </div>
            {error ? <Alert className="settings-inline-alert" type="error" showIcon message={error} /> : providerApiKeyAttention ? <Alert id="provider-api-key-warning" className="settings-inline-alert" type="warning" showIcon message={`请先填写上方标红的 ${providerSecretLabel}；如果已填写仍拉取失败，请检查密钥、服务商参数或套餐权限。`} /> : null}
            {isManualPlanProvider ? <>
              <Alert className="settings-inline-alert" type="info" showIcon message="火山方舟官方套餐模型目录" description={`已按火山方舟官方支持列表加载 ${probe?.models.length ?? 0} 个模型（目录版本 ${ARK_PLAN_CATALOG_REVISION}）；套餐专属 API Key 没有公开 models 列表接口。套餐档位决定可用范围，具体账户权限仍以真实请求和控制台为准。`} />
              {providerId === "ark-coding-plan" ? <Alert className="settings-inline-alert" type="warning" showIcon message="Coding Plan 套餐额度由火山方舟识别" description={<>火山文档说明 Coding Plan 额度适用于其支持的 AI 编程工具，普通 API 调用不抵扣套餐。LFAA 使用专属 OpenAI Chat Completions 地址接入；由于当前文档未单独列出 LFAA，实际请求是否计入套餐以控制台用量为准。<Typography.Link href="https://docs.volcengine.com/docs/ark/coding-plan-personal-faq?lang=zh" target="_blank" rel="noreferrer">查看官方说明</Typography.Link></>} /> : null}
              <div className="ai-provider-catalog-row"><span><strong>官方套餐目录</strong><small>{probe ? `已加载 ${probe.models.length} 个模型 · ${ARK_PLAN_CATALOG_REVISION}` : "需要密钥以继续验证"}</small></span><Button loading={aiBusy === "probe"} disabled={!secret.trim() || aiBusy !== null} onClick={() => void runProbe()}>加载套餐模型</Button></div>
              {probe?.models.filter(model => model.taskType && model.taskType !== "chat").length ? <div className="ai-plan-capability-models"><strong>本档位模型能力</strong><Space wrap size={[6, 6]}>{probe.models.filter(model => model.taskType && model.taskType !== "chat").map(model => <Tag key={`${model.taskType}:${model.id}`} title={model.catalogSource}>{({ embedding: "向量", "image-generation": "生图", "video-generation": "视频", "text-to-speech": "语音合成", "speech-to-text": "语音识别" } as Record<string, string>)[model.taskType!] ?? model.taskType} · {model.name}</Tag>)}</Space></div> : null}
              {probe ? <label className="settings-field"><span>套餐文本模型</span><Select showSearch optionFilterProp="title" value={selectedModel || undefined} disabled={aiBusy !== null} options={probe.models.filter(model => (model.taskType ?? "chat") === "chat").map(model => aiModelSelectOption(providerId, model))} onChange={nextModel => { setSelectedModel(nextModel); setModelTest(null); }} /></label> : null}
              <div className="ai-provider-test-row">
                <div><strong>真实模型测试</strong><span>会使用当前套餐密钥和官方 Model Name 发起一次请求，可能产生套餐用量。</span></div>
                <Button loading={aiBusy === "test"} disabled={!selectedModel.trim() || !secret.trim() || aiBusy !== null} onClick={() => void runModelTest()}>测试模型</Button>
              </div>
              {modelTest ? <Alert className="settings-ai-result" type="success" showIcon message={`套餐模型真实请求通过 · ${modelTest.elapsedMs} ms`} description={modelTest.sample} /> : null}
              <div className="ai-provider-modal__footer"><Button onClick={() => setProviderModalOpen(false)} disabled={aiBusy !== null}>取消</Button><Button type="primary" loading={aiBusy === "save"} disabled={!probe || !modelTest?.verificationToken || !selectedModel.trim() || !secret.trim() || aiBusy !== null} onClick={() => void saveAccount()}>保存个人套餐席位</Button></div>
            </> : <>
              <div className="ai-provider-catalog-row">
                <span><strong>官方模型目录</strong><small>{probe ? `已读取 ${probe.models.length} 个模型` : !secret.trim() ? `请先填写 ${providerSecretLabel}` : "尚未拉取"}</small></span>
                <Button loading={aiBusy === "probe"} disabled={aiBusy !== null} title={!secret.trim() ? `请先填写 ${providerSecretLabel} 后再拉取模型` : undefined} onClick={() => void runProbe()}>拉取模型</Button>
              </div>
              {probe ? <Alert className="settings-ai-result" type="success" showIcon message={`模型目录读取成功 · ${probe.models.length} 个模型`} description="此结果只证明 Provider 模型目录可读取，不代表模型请求已通过；请选择具体模型后，再发起真实对话测试。" /> : null}
              {probe?.models.length ? <>
                <label className="settings-field"><span>模型</span><Select value={selectedModel || undefined} placeholder="选择官方目录中的模型" options={probe.models.map((model) => aiModelSelectOption(providerId, model))} onChange={(nextModel) => { setSelectedModel(nextModel); setReasoningMode(defaultReasoningMode(probe.models.find((model) => model.id === nextModel))); setModelTest(null); setError(""); }} showSearch optionFilterProp="title" /></label>
                {selectedModelDetails ? <p className="settings-field-help">{modelParameterSummary(selectedModelDetails)}</p> : null}
                {selectedModelReasoningOptions.length ? <label className="settings-field"><span>{selectedModelDetails?.thinking?.kind === "effort" ? "思考力度" : "思考模式"}</span><Select value={effectiveReasoningMode(selectedModelDetails, reasoningMode)} options={selectedModelReasoningOptions} disabled={aiBusy !== null} onChange={(value) => { setReasoningMode(value); setModelTest(null); setError(""); }} /></label>
                  : selectedModelDetails?.thinking?.kind === "fixed" ? <p className="ai-thinking-note">{fixedThinkingLabel(selectedModelDetails)}</p>
                    : selectedModelDetails ? <p className="ai-thinking-note">此模型目录没有已验证的思考力度选项；将跟随模型自身行为，不发送思考字段。</p> : null}
                <div className="ai-provider-test-row">
                  <div><strong>真实模型测试</strong><span>会发送一条简短请求至所选模型，可能产生 Provider 用量。</span></div>
                  <Button loading={aiBusy === "test"} disabled={!selectedModel || !secret.trim() || aiBusy !== null} onClick={() => void runModelTest()}>测试模型</Button>
                </div>
                {modelTest ? <Alert className="settings-ai-result" type="success" showIcon message={`模型请求通过 · ${modelTest.elapsedMs} ms`} description={modelTest.sample} /> : null}
                <div className="ai-provider-modal__footer"><Button onClick={() => setProviderModalOpen(false)} disabled={aiBusy !== null}>取消</Button><Button type="primary" loading={aiBusy === "save"} disabled={!modelTest || !selectedModel || !secret.trim() || aiBusy !== null} onClick={() => void saveAccount()}>{selectedProvider.scope === "user" ? "保存个人套餐席位" : "加密保存系统模型"}</Button></div>
              </> : null}
            </>}
          </div> : null}
        </Modal>
        <Modal
          rootClassName="settings-ai-provider-modal"
          getContainer={() => document.querySelector<HTMLElement>(".settings-page") ?? document.body}
          open={credentialUpdateAccount !== null}
          title={credentialUpdateAccount?.scope === "user" ? "更新个人套餐密钥" : "更新系统模型 API Key"}
          centered
          width={600}
          footer={null}
          closable={aiBusy === null}
          keyboard={aiBusy === null}
          onCancel={() => { if (aiBusy === null) { setCredentialSecret(""); setCredentialTest(null); setCredentialUpdateAccount(null); setError(""); } }}
        >
          {credentialUpdateAccount ? <div className="ai-provider-modal__content">
            <p className="ai-provider-modal__description">{credentialUpdateAccount.scope === "user" ? `将更新「${credentialUpdateAccount.displayName}」的个人套餐密钥；只影响当前登录账户的席位。` : `将更新「${credentialUpdateAccount.displayName}」的系统凭据；当前 Provider 与模型保持不变，所有 LFAA 登录账户继续共用这份配置。`}新密钥只在控制端测试并加密保存，不会返回账户列表。</p>
            <label className="settings-field"><span>{providers.find((provider) => provider.id === credentialUpdateAccount.providerId)?.secretLabel ?? "新的 API Key 或 Token"}</span><Input.Password disabled={aiBusy !== null} autoComplete="new-password" value={credentialSecret} onChange={(event) => { setCredentialSecret(event.target.value); setCredentialTest(null); setError(""); }} placeholder="输入新的 Provider 凭据" /></label>
            {error ? <Alert className="settings-inline-alert" type="error" showIcon message={error} /> : null}
            <div className="ai-provider-test-row">
              <div><strong>测试当前模型</strong><span>会发送一条真实请求至当前模型，可能产生 Provider 用量。</span></div>
              <Button loading={aiBusy === `credential-test:${credentialUpdateAccount.id}`} disabled={!credentialSecret.trim() || aiBusy !== null} onClick={() => void testReplacementCredential()}>测试密钥</Button>
            </div>
            {credentialTest ? <Alert className="settings-ai-result" type="success" showIcon message={`当前模型真实请求通过 · ${credentialTest.elapsedMs} ms`} description={credentialTest.sample} /> : null}
            <div className="ai-provider-modal__footer">
              <Button disabled={aiBusy !== null} onClick={() => { setCredentialSecret(""); setCredentialTest(null); setCredentialUpdateAccount(null); setError(""); }}>取消</Button>
              <Button type="primary" loading={aiBusy === `credential-save:${credentialUpdateAccount.id}`} disabled={!credentialTest || !credentialSecret.trim() || aiBusy !== null} onClick={() => void saveReplacementCredential()}>{credentialUpdateAccount.scope === "user" ? "加密保存到我的席位" : "加密保存到系统配置"}</Button>
            </div>
          </div> : null}
        </Modal>
        <SettingGroup title="LFAA 本机模型库">
          <SettingRow title="模型目录与识别" description="模型文件存放在 LFAA Data/models；输入和输出暂存目录分别是 Data/input 与 Data/output。目录由 LFAA 适配器识别模型自己的原生组件格式。">
            <Button loading={localModelsLoading} onClick={() => void refreshLocalModelLibrary()}>刷新模型库</Button>
          </SettingRow>
          {localModelsError ? <Alert type="error" showIcon message="本机模型操作失败" description={localModelsError} /> : null}
          {localModelDownload ? <Alert
            type={localModelDownload.status === "failed" ? "error" : localModelDownload.status === "completed" ? "success" : localModelDownload.status === "cancelled" ? "info" : "info"}
            showIcon
            message={`${localModels.find(model => model.id === localModelDownload.modelId)?.name ?? localModelDownload.modelId} · ${({ queued: "排队中", downloading: "下载中", completed: "已完成", failed: "失败", cancelled: "已取消" } as Record<LocalModelDownloadSnapshot["status"], string>)[localModelDownload.status]}`}
            description={<Space direction="vertical" size="small" style={{ width: "100%" }}>
              {localModelDownload.totalBytes !== null ? <Progress percent={Math.min(100, Math.round(localModelDownload.receivedBytes / Math.max(1, localModelDownload.totalBytes) * 100))} status={localModelDownload.status === "failed" ? "exception" : localModelDownload.status === "completed" ? "success" : "active"} /> : <Progress percent={0} status="active" />}
              <Typography.Text>{localModelDownload.totalBytes === null ? "正在读取官方文件清单…" : `${formatStorageBytes(localModelDownload.receivedBytes)} / ${formatStorageBytes(localModelDownload.totalBytes)} · ${localModelDownload.completedFiles}/${localModelDownload.totalFiles ?? "?"} 个文件`}</Typography.Text>
              {localModelDownload.message ? <Typography.Text type={localModelDownload.status === "failed" ? "danger" : "secondary"}>{localModelDownload.message}</Typography.Text> : null}
              {localModelDownload.status === "queued" || localModelDownload.status === "downloading" ? <Button danger size="small" loading={localModelAction === localModelDownload.modelId} onClick={() => void stopLocalModelDownload()}>取消下载</Button> : null}
            </Space>}
          /> : null}
          {localModels.length ? <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            {localModels.map(model => {
              const active = localModelDownload?.modelId === model.id && ["queued", "downloading"].includes(localModelDownload.status);
              const failed = localModelDownload?.modelId === model.id && localModelDownload.status === "failed";
              return <Card key={model.id} size="small" title={<Space wrap><strong>{model.name}</strong><Tag color={model.ready ? "green" : model.installed ? "orange" : undefined}>{model.ready ? "文件完整" : model.installed ? "文件不完整" : "未安装"}</Tag>{model.loaded ? <Tag color="blue">已加载</Tag> : null}</Space>}>
                <Space direction="vertical" size="small" style={{ width: "100%" }}>
                  <Typography.Text type="secondary">{model.family} · {model.modality} · {model.task}</Typography.Text>
                  <Typography.Text>{model.directory} · {model.installedBytes ? formatStorageBytes(model.installedBytes) : model.estimatedDownloadBytes === null ? "下载前读取官方文件清单估算大小" : `文件预计 ${formatStorageBytes(model.estimatedDownloadBytes)}`}</Typography.Text>
                  <Space wrap><Typography.Link href={`https://huggingface.co/${model.repository}`} target="_blank" rel="noreferrer">官方模型仓库</Typography.Link><Typography.Link href={model.licenseUrl} target="_blank" rel="noreferrer">{model.licenseName} 许可</Typography.Link></Space>
                  {!model.ready && model.reason ? <Typography.Text type="warning">{model.reason}</Typography.Text> : null}
                  {failed && localModelDownload.message ? <Typography.Text type="danger">{localModelDownload.message}</Typography.Text> : null}
                  <Space wrap>
                    {!model.ready && !active ? <Button type="primary" loading={localModelAction === model.id} disabled={localModelDownload !== null && ["queued", "downloading"].includes(localModelDownload.status)} onClick={() => void beginLocalModelDownload(model)}>{model.installed ? "补齐并校验文件" : "下载模型"}</Button> : null}
                    {model.loaded ? <Button loading={localModelAction === model.id} onClick={() => void releaseLocalModel(model)}>释放运行内存</Button> : null}
                  </Space>
                </Space>
              </Card>;
            })}
          </Space> : <Alert type="info" showIcon message={localModelsLoading ? "正在读取 LFAA 本机模型库" : "当前没有可识别的模型"} description="这里显示 LFAA 已内置适配器支持的官方原生模型目录。其他格式不会自动执行或改写。" />}
          <Alert type="info" showIcon message="本机推理环境" description="LFAA 会使用随包审阅的模型适配器和受管 Python 进程；当前适配依赖、GPU 与显存要求因模型而异。下载只安装权重，不代表当前电脑满足推理条件；缺少运行依赖时会显示真实错误。" />
        </SettingGroup>
        <SettingGroup title="AI 漫剧与画布图片生成">
          <SettingRow title="AI 漫剧生图引擎" description="此引擎选择只控制 AI 漫剧。无限画布使用下方远程图片模型，并可由小鱼按本轮目标从账户目录中选择 Agent Plan 生图模型。切换模式会保留两边的模型选择。">
            <Select value={settings.aiRuntime.imageGenerationMode} options={[{ value: "provider", label: "远程 Provider" }, { value: "local", label: "LFAA 本机模型" }]} onChange={value => updateSettings("aiRuntime", { ...settings.aiRuntime, imageGenerationMode: value })} />
          </SettingRow>
          {settings.aiRuntime.imageGenerationMode === "local" ? <>
            <SettingRow title="本机图像模型" description="选择已下载且原生组件完整的模型；运行时按模型适配器检查目录并在首次生成时加载。">
              <Select allowClear showSearch optionFilterProp="label" value={settings.aiRuntime.imageGenerationLocalModelId || undefined} placeholder="先在上方模型库下载并刷新" options={localImageModels.map(model => ({ value: model.id, label: `${model.name} · ${model.ready ? model.loaded ? "已加载" : "目录完整" : model.installed ? "文件不完整" : "未下载"}`, title: model.reason ?? model.directory, disabled: !model.ready }))} onChange={value => updateSettings("aiRuntime", { ...settings.aiRuntime, imageGenerationLocalModelId: value ?? "" })} />
            </SettingRow>
            <SettingRow title="本机生图时限" description="包含首次读取权重和生成时间；超时会停止受管进程，不登记生成结果。">
              <InputNumber min={60} max={1800} step={60} value={settings.aiRuntime.imageGenerationLocalTimeoutSeconds} addonAfter="秒" onChange={value => value !== null && updateSettings("aiRuntime", { ...settings.aiRuntime, imageGenerationLocalTimeoutSeconds: value })} />
            </SettingRow>
            <SettingRow title="生图后保留模型" description="模型在此时限内留在受管进程中，空闲到期后自动释放内存。">
              <InputNumber min={1} max={60} step={1} value={settings.aiRuntime.imageGenerationUnloadAfterMinutes} addonAfter="分钟" onChange={value => value !== null && updateSettings("aiRuntime", { ...settings.aiRuntime, imageGenerationUnloadAfterMinutes: value })} />
            </SettingRow>
            {localImageModels.length ? <Alert type="info" showIcon message="MOSS-Image 首发适配能力" description="当前 MOSS-Image 支持文字/布局生图，输出 1024×1024 PNG；不接受参考图片。首次生成会在本机加载原生 Diffusers 组件。" /> : null}
          </> : null}
            <SettingRow title="默认远程图片模型账户" description="这是 AI 漫剧远程模式与无限画布的默认账户。小鱼也可在画布单次生成时，从下方目录选择 Agent Plan 图片模型；不会改写此默认值。">
              <Select allowClear value={settings.aiRuntime.imageGenerationAccountId || undefined} placeholder="选择图片模型账户" options={imageGenerationAccounts.map(account => ({ value: account.id, label: `${account.displayName} · ${account.providerId}` }))} onChange={value => updateSettings("aiRuntime", { ...settings.aiRuntime, imageGenerationAccountId: value ?? "", imageGenerationModelId: "" })} />
            </SettingRow>
            <SettingRow title="默认远程图像模型" description="从已保存账户目录中选择。Agent Plan 仅列出官方标记为图片生成且符合套餐档位的模型；本轮选择只影响当前画布生成，不更改此默认值。">
              <Select allowClear showSearch optionFilterProp="label" disabled={!selectedImageGenerationAccount} value={settings.aiRuntime.imageGenerationModelId || undefined} placeholder={selectedImageGenerationAccount ? "选择模型目录中的图像模型" : "请先选择图片模型账户"} options={selectedImageGenerationAccount?.models.filter(model => selectedImageGenerationAccount.providerId !== "ark-agent-plan" || model.taskType === "image-generation").filter(model => !model.planTiers?.length || selectedImageGenerationAccount.options.planTier === "unknown" || !selectedImageGenerationAccount.options.planTier || model.planTiers.includes(selectedImageGenerationAccount.options.planTier as NonNullable<AiModel["planTiers"]>[number])).map(model => ({ value: model.id, label: model.id })) ?? []} onChange={value => updateSettings("aiRuntime", { ...settings.aiRuntime, imageGenerationModelId: value ?? "" })} />
            </SettingRow>
            {!imageGenerationAccounts.length ? <Alert type="info" showIcon message="请先在上方配置并加密保存 OpenAI、豆包按量或 Agent Plan 图片账户。" /> : null}
        </SettingGroup>
        <SettingGroup title="AI 漫剧视频生成">
          <SettingRow title="视频引擎" description="选择火山方舟异步服务，或 LFAA 本机模型库中的视频模型。两种模式独立保存选择，不会互相覆盖。">
            <Select value={settings.aiRuntime.videoGenerationMode} options={[{ value: "provider", label: "远程 Provider" }, { value: "local", label: "LFAA 本机模型" }]} onChange={value => updateSettings("aiRuntime", { ...settings.aiRuntime, videoGenerationMode: value })} />
          </SettingRow>
          {settings.aiRuntime.videoGenerationMode === "local" ? <>
            <SettingRow title="本机视频模型" description="MiniMax-H3 FL2VA 使用模型原生 Diffusers 目录；支持文字生成视频/音频和单张首帧图，要求兼容的 CUDA GPU。">
              <Select allowClear showSearch optionFilterProp="label" value={settings.aiRuntime.videoGenerationLocalModelId || undefined} placeholder="先在上方模型库下载并刷新" options={localVideoModels.map(model => ({ value: model.id, label: `${model.name} · ${model.ready ? model.loaded ? "已加载" : "目录完整" : model.installed ? "文件不完整" : "未下载"}`, title: model.reason ?? model.directory, disabled: !model.ready }))} onChange={value => updateSettings("aiRuntime", { ...settings.aiRuntime, videoGenerationLocalModelId: value ?? "" })} />
            </SettingRow>
            <SettingRow title="本机视频时限" description="包含首次读取权重和生成时间；超时会停止受管进程，不登记生成结果。">
              <InputNumber min={60} max={1800} step={60} value={settings.aiRuntime.videoGenerationLocalTimeoutSeconds} addonAfter="秒" onChange={value => value !== null && updateSettings("aiRuntime", { ...settings.aiRuntime, videoGenerationLocalTimeoutSeconds: value })} />
            </SettingRow>
            <SettingRow title="视频生成后保留模型" description="模型空闲到此时限后自动卸载，以释放 GPU 显存与系统内存。">
              <InputNumber min={1} max={60} step={1} value={settings.aiRuntime.videoGenerationUnloadAfterMinutes} addonAfter="分钟" onChange={value => value !== null && updateSettings("aiRuntime", { ...settings.aiRuntime, videoGenerationUnloadAfterMinutes: value })} />
            </SettingRow>
          </> : <>
            <SettingRow title="火山方舟视频账户" description="使用 Agent Plan 视频模型创建官方异步任务；AI 漫剧和无限画布共用此处账户。Agent Plan 仅 Large/Max 提供视频生成。">
              <Select allowClear value={settings.aiRuntime.videoGenerationAccountId || undefined} placeholder="选择火山方舟账户" options={videoGenerationAccounts.map(account => ({ value: account.id, label: `${account.displayName} · 火山方舟` }))} onChange={value => updateSettings("aiRuntime", { ...settings.aiRuntime, videoGenerationAccountId: value ?? "", videoGenerationModelId: "" })} />
            </SettingRow>
            <SettingRow title="视频模型 ID" description="从官方 Agent Plan 视频模型目录选择，不会把普通文本模型当成视频模型。">
              <Select allowClear showSearch optionFilterProp="label" disabled={!selectedVideoGenerationAccount} value={settings.aiRuntime.videoGenerationModelId || undefined} placeholder={selectedVideoGenerationAccount ? "选择模型目录中的视频模型" : "请先选择火山方舟账户"} options={selectedVideoGenerationAccount?.models.filter(model => selectedVideoGenerationAccount.providerId !== "ark-agent-plan" || model.taskType === "video-generation").filter(model => !model.planTiers?.length || selectedVideoGenerationAccount.options.planTier === "unknown" || !selectedVideoGenerationAccount.options.planTier || model.planTiers.includes(selectedVideoGenerationAccount.options.planTier as NonNullable<AiModel["planTiers"]>[number])).map(model => ({ value: model.id, label: model.id })) ?? []} onChange={value => updateSettings("aiRuntime", { ...settings.aiRuntime, videoGenerationModelId: value ?? "" })} />
            </SettingRow>
          </>}
          <SettingRow title="生成时长" description="时长单位为秒；模型支持范围和可选离散值由火山方舟实际判定。">
            <InputNumber min={settings.aiRuntime.videoGenerationMode === "local" ? 5 : 1} max={15} step={1} value={settings.aiRuntime.videoGenerationDurationSeconds} onChange={value => value !== null && updateSettings("aiRuntime", { ...settings.aiRuntime, videoGenerationDurationSeconds: value })} />
          </SettingRow>
          <SettingRow title="画面比例" description="不同模型支持的比例不同；“自适应”交由所选模型按参考素材决定。">
            <Select value={settings.aiRuntime.videoGenerationRatio} options={[{ value: "adaptive", label: "自适应" }, { value: "16:9", label: "16:9 横屏" }, { value: "9:16", label: "9:16 竖屏" }, { value: "1:1", label: "1:1 方形" }, { value: "4:3", label: "4:3" }, { value: "3:4", label: "3:4" }]} onChange={value => updateSettings("aiRuntime", { ...settings.aiRuntime, videoGenerationRatio: value })} />
          </SettingRow>
          {settings.aiRuntime.videoGenerationMode === "provider" ? <>
            <SettingRow title="清晰度" description="清晰度选择也受模型和所选比例限制；不支持时显示服务商错误。">
              <Select value={settings.aiRuntime.videoGenerationResolution} options={[{ value: "480p", label: "480p" }, { value: "720p", label: "720p" }, { value: "1080p", label: "1080p" }]} onChange={value => updateSettings("aiRuntime", { ...settings.aiRuntime, videoGenerationResolution: value })} />
            </SettingRow>
            <SettingRow title="生成声音" description="将镜头对白与声音提示交给模型；具体音频支持由模型决定。">
              <SettingsSwitch label="生成音频" checked={settings.aiRuntime.videoGenerationGenerateAudio} onChange={() => updateSettings("aiRuntime", { ...settings.aiRuntime, videoGenerationGenerateAudio: !settings.aiRuntime.videoGenerationGenerateAudio })} />
            </SettingRow>
            <SettingRow title="水印" description="按所选账户模型的水印参数发送偏好；最终结果遵循服务商规则。">
              <SettingsSwitch label="保留水印" checked={settings.aiRuntime.videoGenerationWatermark} onChange={() => updateSettings("aiRuntime", { ...settings.aiRuntime, videoGenerationWatermark: !settings.aiRuntime.videoGenerationWatermark })} />
            </SettingRow>
            {!videoGenerationAccounts.length ? <Alert type="info" showIcon message="请先在上方配置并加密保存火山方舟账户。" /> : null}
          </> : <Alert type="info" showIcon message="本机 MiniMax-H3 会按模型默认生成音频；角色/场景参考图最多合并为一张首帧。" />}
        </SettingGroup>
        <SettingGroup title="视频链接理解">
          <SettingRow title="语音识别账户" description="没有公开字幕时，Agent 可按需把 Bilibili 视频音轨发给该 Ark Agent Plan 账户转写。音频最长 60 分钟、96 MiB，只在内存处理；需要系统 PATH 中有 FFmpeg。转写会消耗语音模型额度，并按当前权限模式交由 Permission Owner 处理。">
            <Select allowClear value={settings.aiRuntime.videoTranscriptionAccountId || undefined} placeholder="不启用语音转写" options={videoTranscriptionAccounts.map(account => ({ value: account.id, label: `${account.displayName} · Ark Agent Plan` }))} onChange={value => updateSettings("aiRuntime", { ...settings.aiRuntime, videoTranscriptionAccountId: value ?? "" })} />
          </SettingRow>
          {!videoTranscriptionAccounts.length ? <Alert type="info" showIcon message="尚无可用于语音识别的 Ark Agent Plan 账户" description="请先在 AI 与模型的账户目录中配置 Plan 席位并加载包含豆包语音识别的官方目录。公开视频字幕和抽样画面不依赖语音账户。" /> : null}
          {settings.aiRuntime.videoTranscriptionAccountId && !selectedVideoTranscriptionAccount ? <Alert type="warning" showIcon message="当前语音识别账户不可用" description="请重新选择一个可见且包含语音识别模型的 Ark Agent Plan 账户。" /> : null}
        </SettingGroup>
        <SettingGroup title="推理参数">
          <SettingRow title="Agent Shell 文件访问限制" description="工作区读写隔离为默认值；只读限制项目文件写入；完全访问仍经现有 Permission Owner 授权。">
            <Select
              value={settings.aiRuntime.executionSandboxMode}
              onChange={value => updateSettings("aiRuntime", { ...settings.aiRuntime, executionSandboxMode: value })}
              options={[
                { value: EXECUTION_SANDBOX_MODES[0], label: "只读工作区" },
                { value: EXECUTION_SANDBOX_MODES[1], label: "工作区读写（默认）" },
                { value: EXECUTION_SANDBOX_MODES[2], label: "完全访问" },
              ]}
              aria-label="Agent Shell 文件访问限制"
            />
          </SettingRow>
          <SettingRow title="输出长度策略" description="快速策略最多请求 1024 tokens；平衡/深入遵循所选模型能力或你填写的上限，不改变模型思考力度。">
            <Select value={settings.aiRuntime.speed} options={[{ value: "fast", label: "快速 · 最多 1024" }, { value: "balanced", label: "平衡 · 按模型/自定义上限" }, { value: "deep", label: "深入 · 尽量使用模型上限" }]} onChange={(value) => updateSettings("aiRuntime", { ...settings.aiRuntime, speed: value })} />
          </SettingRow>
          <SettingRow title="最大输出 tokens" description="0 表示自动：按模型目录声明的单次输出上限发送；目录未提供时省略上限字段，遵循 Provider 对该型号的默认值。正数是你的上限，已验证的模型上限仍会优先约束。部分模型的思考内容也占用 Provider 输出预算。">
            <InputNumber min={0} max={Number.MAX_SAFE_INTEGER} step={1024} value={settings.aiRuntime.maxOutputTokens} onChange={(value) => value !== null && updateSettings("aiRuntime", { ...settings.aiRuntime, maxOutputTokens: value })} />
          </SettingRow>
          <SettingRow title="模型无进展超时" description="Provider 无响应或模型流没有新数据时中止；持续返回内容时不会因累计时长而中断。">
            <Input type="number" min={10} max={300} value={settings.aiRuntime.requestTimeoutSeconds} onChange={(event) => updateSettings("aiRuntime", { ...settings.aiRuntime, requestTimeoutSeconds: Math.max(10, Math.min(300, Number(event.target.value) || 10)) })} />
          </SettingRow>
          <SettingRow title="模型请求重试次数" description="仅在未收到回答或工具选择时恢复临时网络、服务错误或空回答；0 表示关闭。每次重试计入本轮请求预算，已执行工具不会重放。">
            <InputNumber min={0} max={3} value={settings.aiRuntime.requestRetries} onChange={value => value !== null && updateSettings("aiRuntime", { ...settings.aiRuntime, requestRetries: value })} />
          </SettingRow>
          <SettingRow title="模型重试等待（秒）" description="临时请求失败后的基础等待时间，后续重试逐次递增。停止任务会取消等待。">
            <InputNumber min={0} max={30} value={settings.aiRuntime.retryDelaySeconds} onChange={value => value !== null && updateSettings("aiRuntime", { ...settings.aiRuntime, retryDelaySeconds: value })} />
          </SettingRow>
          <SettingRow title="子 Agent 模型账户" description="默认继承主 Agent 的模型账户，也可选择当前账户保存的其他模型；所选账户失效会明确失败，不自动换模型。">
            <Select value={settings.aiRuntime.subagentAccountId} options={[{ value: "", label: "继承主 Agent" }, ...accounts.map(account => ({ value: account.id, label: account.displayName + " · " + account.modelId }))]} onChange={value => updateSettings("aiRuntime", { ...settings.aiRuntime, subagentAccountId: value })} />
          </SettingRow>
          <SettingRow title="每轮子 Agent 数量" description="允许主 Agent 按任务需要委派的子任务数量，0 表示关闭委派。">
            <InputNumber min={0} max={16} value={settings.aiRuntime.maxSubagents} onChange={value => value !== null && updateSettings("aiRuntime", { ...settings.aiRuntime, maxSubagents: value })} />
          </SettingRow>
          <SettingRow title="最大委派深度" description="限制子 Agent 继续派发任务的层数，0 表示关闭委派。">
            <InputNumber min={0} max={4} value={settings.aiRuntime.maxDelegationDepth} onChange={value => value !== null && updateSettings("aiRuntime", { ...settings.aiRuntime, maxDelegationDepth: value })} />
          </SettingRow>
          <SettingRow title="节点命令默认时限（秒）" description="0 表示不限时；模型指定的时限只能缩短已保存的非零上限。停止任务会向执行节点请求终止进程树。">
            <InputNumber min={0} max={1800} value={settings.aiRuntime.commandTimeoutSeconds} onChange={value => value !== null && updateSettings("aiRuntime", { ...settings.aiRuntime, commandTimeoutSeconds: value })} />
          </SettingRow>
          <SettingRow title="每轮模型请求上限" description={`0 使用产品安全上限 ${AI_RUNTIME_MAX_MODEL_REQUESTS_PER_RUN} 次（含重试和上下文摘要）；正数可设置更低预算。`}>
            <InputNumber min={0} max={AI_RUNTIME_MAX_MODEL_REQUESTS_PER_RUN} value={settings.aiRuntime.maxModelRequests} onChange={(value) => value !== null && updateSettings("aiRuntime", { ...settings.aiRuntime, maxModelRequests: value })} />
          </SettingRow>
          <SettingRow title="每轮工具调用上限" description={`0 使用产品安全上限 ${AI_RUNTIME_MAX_TOOL_CALLS_PER_RUN} 次；正数可设置更低预算。超出预算的本批调用均不会派发。`}>
            <InputNumber min={0} max={AI_RUNTIME_MAX_TOOL_CALLS_PER_RUN} value={settings.aiRuntime.maxToolCalls} onChange={(value) => value !== null && updateSettings("aiRuntime", { ...settings.aiRuntime, maxToolCalls: value })} />
          </SettingRow>
          <SettingRow title="提示词建议" description="在空会话输入区显示当前应用的示例任务。">
            <SettingsSwitch label="提示词建议" checked={settings.aiRuntime.promptSuggestions} onChange={() => updateSettings("aiRuntime", { ...settings.aiRuntime, promptSuggestions: !settings.aiRuntime.promptSuggestions })} />
          </SettingRow>
          <SettingRow title="显示上下文使用情况" id="ai-context-usage-setting" description={<><Tag color={settings.aiRuntime.showContextUsage ? "green" : "default"}>当前已{settings.aiRuntime.showContextUsage ? "开启" : "关闭"}</Tag> 开启后，主聊和侧聊输入框下方显示当前模型的上下文占用与分项；Token 总量和缓存命中统计不受此开关影响。</>}>
            <SettingsSwitch label="显示上下文使用情况" checked={settings.aiRuntime.showContextUsage} onChange={() => updateSettings("aiRuntime", { ...settings.aiRuntime, showContextUsage: !settings.aiRuntime.showContextUsage })} />
          </SettingRow>
          <SettingRow title="自动压缩较早上下文" description="模型上下文接近容量时，先摘要较早对话再继续；关闭后保留现有上下文并遵循模型和请求预算。">
            <SettingsSwitch label="自动压缩较早上下文" checked={settings.aiRuntime.autoCompaction ?? DEFAULT_USER_SETTINGS.aiRuntime.autoCompaction!} onChange={() => updateSettings("aiRuntime", { ...settings.aiRuntime, autoCompaction: !(settings.aiRuntime.autoCompaction ?? DEFAULT_USER_SETTINGS.aiRuntime.autoCompaction!) })} />
          </SettingRow>
          <SettingRow title="模型窗口未知时的上下文容量" description="优先使用模型目录提供的窗口；仅在目录未知时按此容量触发摘要，摘要使用当前模型并计入请求预算。">
            <InputNumber min={4096} max={2000000} value={settings.aiRuntime.contextWindowTokens ?? DEFAULT_USER_SETTINGS.aiRuntime.contextWindowTokens!} onChange={value => value !== null && updateSettings("aiRuntime", { ...settings.aiRuntime, contextWindowTokens: value })} />
          </SettingRow>
        </SettingGroup>
      </section>
    );

    if (activeSection === "minecraft") return (
      <section className="settings-content">
        <header className="settings-content__heading"><div><span className="settings-eyebrow">Minecraft</span><Typography.Title level={2}>Minecraft 配置</Typography.Title><Typography.Paragraph>Minecraft 常规面板与 Minecraft 小鱼智能体 共用这些账户级运行默认值。</Typography.Paragraph></div></header>
        <SettingGroup title="默认部署与运行">
          <SettingRow title="Minecraft 默认内存（MB）" description="传统面板新建实例的默认内存；现有实例不变，可在开服表单调整。">
            <InputNumber min={1024} max={32768} value={settings.minecraftRuntime.minecraftDefaultMemoryMb} onChange={value => value !== null && updateSettings("minecraftRuntime", { ...settings.minecraftRuntime, minecraftDefaultMemoryMb: value })} />
          </SettingRow>
          <SettingRow title="Minecraft 执行方式" description="推荐本机原生进程，适合模组与插件开服；以 Daemon 系统账户运行。AppContainer 当前只支持旧 Vanilla 启动合同，缺少 Host 时明确失败，不自动降级。">
            <Select value={settings.minecraftRuntime.minecraftExecutionMode} options={[{ value: "native", label: "本机原生进程（推荐）" }, { value: "appcontainer", label: "Windows AppContainer" }]} onChange={value => updateSettings("minecraftRuntime", { ...settings.minecraftRuntime, minecraftExecutionMode: value })} />
          </SettingRow>
          <SettingRow title="Minecraft 默认核心" description="普通生存和插件服推荐 Paper；模组服按模组包要求选择 Fabric/Forge。来源暂不可用时不会静默替换。">
            <Select value={settings.minecraftRuntime.minecraftDefaultCore} options={minecraftCoreOptions.some(option => option.value === settings.minecraftRuntime.minecraftDefaultCore) ? minecraftCoreOptions : [{ value: settings.minecraftRuntime.minecraftDefaultCore, label: `${settings.minecraftRuntime.minecraftDefaultCore}（已保存，目录待连接）` }, ...minecraftCoreOptions]} onChange={minecraftDefaultCore => updateSettings("minecraftRuntime", { ...settings.minecraftRuntime, minecraftDefaultCore })} />
          </SettingRow>
          <SettingRow title="Minecraft 基岩默认端口" description="Nukkit 与 PocketMine 新实例的默认 UDP 端口，可在开服表单调整。">
            <InputNumber min={1024} max={65535} value={settings.minecraftRuntime.minecraftBedrockDefaultPort} onChange={value => value !== null && updateSettings("minecraftRuntime", { ...settings.minecraftRuntime, minecraftBedrockDefaultPort: value })} />
          </SettingRow>
          <SettingRow title="Minecraft 默认端口" description="Java 服务端和代理的新实例默认监听端口；开服时检查节点端口占用。基岩核心使用协议默认端口。">
            <InputNumber min={1024} max={65535} value={settings.minecraftRuntime.minecraftDefaultPort} onChange={value => value !== null && updateSettings("minecraftRuntime", { ...settings.minecraftRuntime, minecraftDefaultPort: value })} />
          </SettingRow>
          <SettingRow title="Minecraft 下载时限（秒）" description="核心工件下载的等待预算；任务提交时保存当前值，超时报告真实失败。">
            <InputNumber min={30} max={7200} value={settings.minecraftRuntime.minecraftDownloadTimeoutSeconds} onChange={value => value !== null && updateSettings("minecraftRuntime", { ...settings.minecraftRuntime, minecraftDownloadTimeoutSeconds: value })} />
          </SettingRow>
          <SettingRow title="Minecraft 安装时限（秒）" description="Forge、NeoForge 等安装器及运行环境准备的等待预算；超时结束本任务进程树。">
            <InputNumber min={30} max={7200} value={settings.minecraftRuntime.minecraftInstallTimeoutSeconds} onChange={value => value !== null && updateSettings("minecraftRuntime", { ...settings.minecraftRuntime, minecraftInstallTimeoutSeconds: value })} />
          </SettingRow>
          <SettingRow title="Minecraft 就绪等待（秒）" description="启动任务须收到所选核心的就绪日志才成功；超时保留故障证据，不能仅凭进程启动显示开服成功。">
            <InputNumber min={10} max={900} value={settings.minecraftRuntime.minecraftReadyTimeoutSeconds} onChange={value => value !== null && updateSettings("minecraftRuntime", { ...settings.minecraftRuntime, minecraftReadyTimeoutSeconds: value })} />
          </SettingRow>
          <SettingRow title="Minecraft 安全停服等待（秒）" description="发送 stop 后等待保存退出；超时会终止当前实例进程，并在结果中明确报告非正常停服。">
            <InputNumber min={5} max={300} value={settings.minecraftRuntime.minecraftStopTimeoutSeconds} onChange={value => value !== null && updateSettings("minecraftRuntime", { ...settings.minecraftRuntime, minecraftStopTimeoutSeconds: value })} />
          </SettingRow>
        </SettingGroup>
      </section>
    );

    if (activeSection === "usage") return (
      <section className="settings-content">
        <header className="settings-content__heading"><div><span className="settings-eyebrow">小鱼智能体</span><Typography.Title level={2}>使用情况和计费</Typography.Title><Typography.Paragraph>查看控制端实际记录的成功模型调用与 Provider 返回的 token 用量。</Typography.Paragraph></div></header>
        <SettingGroup title="本地记录">
          <SettingRow title="成功调用次数" description="只统计已完成并写入本地会话记录的模型请求。" status="本机 SQLite"><Tag>{usage?.requestCount ?? 0} 次</Tag></SettingRow>
          <SettingRow title="输入 tokens" description="按 Provider 返回的 usage.prompt_tokens 汇总；没有返回用量的请求不参与汇总。" status={usage?.promptTokens == null ? "Provider 未提供" : "真实用量"}><Tag>{usage?.promptTokens == null ? "—" : usage.promptTokens.toLocaleString("zh-CN")}</Tag></SettingRow>
          <SettingRow title="输出 tokens" description="按 Provider 返回的 usage.completion_tokens 汇总；没有返回用量的请求不参与汇总。" status={usage?.completionTokens == null ? "Provider 未提供" : "真实用量"}><Tag>{usage?.completionTokens == null ? "—" : usage.completionTokens.toLocaleString("zh-CN")}</Tag></SettingRow>
        </SettingGroup>
        <SettingGroup title="按模型">
          {usage?.providers.length ? usage.providers.map((item) => <SettingRow key={`${item.providerId}:${item.modelId}`} title={`${item.providerId} · ${item.modelId}`} description={`成功调用 ${item.requestCount} 次；输入 ${item.promptTokens?.toLocaleString("zh-CN") ?? "未提供"}，输出 ${item.completionTokens?.toLocaleString("zh-CN") ?? "未提供"} tokens。`} status="本地统计"><Tag>不含费用</Tag></SettingRow>) : <SettingRow title="尚无用量记录" description="完成一次 小鱼智能体 对话后会显示 Provider 返回的 token 用量。" status="等待首次请求"><Tag>暂无数据</Tag></SettingRow>}
        </SettingGroup>
        <div className="settings-note-card"><strong>计费说明</strong><p>LFAA 不向 Provider 账单服务查询费用，也不按静态价格估算账单。实际费用以各 Provider 控制台为准。</p></div>
      </section>
    );

    if (activeSection === "archived") return (
      <section className="settings-content">
        <header className="settings-content__heading"><div><span className="settings-eyebrow">小鱼智能体</span><Typography.Title level={2}>已归档的聊天</Typography.Title><Typography.Paragraph>按账户隔离保存；恢复后会回到对应应用的会话列表。</Typography.Paragraph></div></header>
        <SettingGroup title="归档会话">
          {archivedSessions.length ? archivedSessions.map((session) => <SettingRow key={session.id} title={session.title} description={`${session.appId === "steamcmd" ? "SteamCMD 开服" : session.appId === "minecraft" ? "Minecraft" : "写作"} · 最近活动 ${new Date(session.updatedAt).toLocaleString("zh-CN")}`} status="已归档"><Button onClick={() => void restoreArchivedSession(session)}>恢复会话</Button></SettingRow>) : <SettingRow title="没有归档会话" description="在 小鱼智能体 会话列表选择归档后，会显示在这里。" status="空"><Tag>暂无数据</Tag></SettingRow>}
        </SettingGroup>
      </section>
    );

    if (activeSection === "profilePlugins") return <ManagedPluginsSettings user={user} applications={applications} settings={settings} onPluginSettingsChange={plugins => updateSettings("plugins", plugins)} onGeneralSettingsChange={general => updateSettings("general", general)} onNavigate={onNavigate} />;

    if (activeSection === "hooks") return (
      <section className="settings-content">
        <header className="settings-content__heading"><div><span className="settings-eyebrow">编码</span><Typography.Title level={2}>钩子</Typography.Title><Typography.Paragraph>查看当前 LFAA Host 中受信任插件实际登记的 AI Runtime 生命周期钩子。</Typography.Paragraph></div></header>
        <SettingGroup title="AI Runtime Hooks">
          {runtimeHooks.length ? runtimeHooks.map((hook) => <SettingRow key={hook.id} title={hook.id} description={`订阅事件：${hook.events.map((event) => event === "beforeInference" ? "推理前" : event === "afterInference" ? "推理后" : "模型请求路由").join("、")}`} status="受信任插件"><Tag>生命周期钩子</Tag></SettingRow>) : <SettingRow title="暂无已注册钩子" description="钩子仅由当前运行组合中已加载的 Cordis 插件注册；此处不编辑或执行插件代码。Agent 可通过运行时钩子 Owner 读取同一目录。" status="空目录"><Tag>0 项</Tag></SettingRow>}
        </SettingGroup>
        {loadingSection === "hooks" ? <div role="status" className="settings-note-card"><strong>正在读取钩子目录</strong><p>状态来自当前 LFAA Host。</p></div> : null}
        {sectionErrors.hooks ? <Alert type="error" showIcon message="读取钩子目录失败" description={sectionErrors.hooks} /> : null}
      </section>
    );

    if (activeSection === "codeReview") {
      return <section className="settings-content">
        <header className="settings-content__heading"><div><span className="settings-eyebrow">编码</span><Typography.Title level={2}>代码审查</Typography.Title><Typography.Paragraph>小鱼 Agent 会读取当前会话绑定的真实 Git 工作区差异，并围绕改动检查缺陷、回归风险和验证覆盖。</Typography.Paragraph></div></header>
        <SettingGroup title="审查入口">
          <SettingRow title="当前项目变更" description="在 AI 工作区提出“审查当前项目代码”。Agent 只读 Git 差异和必要源码；没有绑定仓库时会说明，审查不会自动修改、提交或推送。" status="Git Owner 已接入">
            <Button type="primary" onClick={() => onNavigate("/work")}>前往 AI 工作区</Button>
          </SettingRow>
        </SettingGroup>
      </section>;
    }

    if (activeSection === "plugins" || activeSection === "connections") return (
      <section className={`settings-content settings-content--plugin-workspace${standaloneWorkspaceContent ? " settings-content--plugin-workspace-standalone" : ""}`}>
        {standaloneWorkspaceContent ? null : pluginWorkspaceHeader}
        <div id="settings-plugin-panel" ref={standaloneWorkspaceContent ? settingsContentScroll.ref : undefined} onScroll={standaloneWorkspaceContent ? settingsContentScroll.onScroll : undefined} className={`settings-plugin-workspace__panel${standaloneWorkspaceContent ? " settings-plugin-workspace__panel--standalone" : ""}`} role={standaloneWorkspaceContent ? "region" : "tabpanel"} aria-labelledby={pluginWorkspacePanelLabelledBy}>
        {pluginWorkspaceTab === "overview" ? <>
          <div className="settings-plugin-workspace__overview" aria-label="扩展能力概况">
            <article className="settings-plugin-workspace__overview-card">
              <div className="settings-plugin-workspace__overview-card-heading"><span>已登记能力</span><span className="settings-plugin-workspace__overview-icon"><WorkbenchIcon name="spark" size={18} /></span></div>
              <strong>{extensions.length}<i>项</i></strong>
              <small>来自当前运行时目录</small>
            </article>
            <article className="settings-plugin-workspace__overview-card">
              <div className="settings-plugin-workspace__overview-card-heading"><span>MCP 服务</span><span className="settings-plugin-workspace__overview-icon"><WorkbenchIcon name="browser" size={18} /></span></div>
              <strong>{settings.plugins.mcpServers.length}<i>项</i></strong>
              <small>{settings.plugins.mcpServers.filter((server) => server.enabled).length} 个配置为启用</small>
            </article>
            <article className={`settings-plugin-workspace__overview-card${runtimePluginHostReady ? " is-ready" : " is-attention"}`}>
              <div className="settings-plugin-workspace__overview-card-heading"><span>运行模块</span><span className="settings-plugin-workspace__overview-icon"><WorkbenchIcon name="tools" size={18} /></span></div>
              <strong>{activeRuntimePluginCount}<i> / {runtimePlugins.length}</i></strong>
              <small>{runtimePluginHostReady ? "宿主核心状态正常" : "需要检查宿主状态"}</small>
            </article>
          </div>
          <div className="settings-plugin-workspace__settings-grid">
            <section className="settings-plugin-workspace__setting-card settings-plugin-workspace__setting-card--switch" aria-labelledby="settings-plugin-policy-title">
              <div className="settings-plugin-workspace__setting-heading">
                <span className="settings-plugin-workspace__setting-icon"><WorkbenchIcon name="spark" size={18} /></span>
                <div><h3 id="settings-plugin-policy-title">运行策略</h3><p>控制账户扩展是否加入小鱼智能体的运行时。</p></div>
              </div>
              <div className="settings-plugin-workspace__switch-row">
                <span><strong>允许小鱼智能体使用扩展</strong><small>关闭后，Skills、Experts、Prompts、Tools 与 MCP 服务不会加入运行时；MCP 工具仍只提供给所选应用。</small></span>
                <SettingsSwitch label="启用扩展" checked={settings.plugins.enabled} onChange={() => updateSettings("plugins", { ...settings.plugins, enabled: !settings.plugins.enabled })} />
              </div>
            </section>
            <section className="settings-plugin-workspace__setting-card settings-plugin-workspace__setting-card--skills" aria-labelledby="settings-plugin-skills-title">
              <div className="settings-plugin-workspace__setting-heading">
                <span className="settings-plugin-workspace__setting-icon"><WorkbenchIcon name="book" size={18} /></span>
                <div><h3 id="settings-plugin-skills-title">额外本机 Skill 目录</h3><p>这里只添加额外扫描位置，不是 GitHub Skill 的安装位置。</p></div>
              </div>
              <Input.TextArea className="settings-plugin-workspace__skill-input" aria-label="本机 Skill 目录" autoSize={{ minRows: 2, maxRows: 6 }} value={skillDirectoriesDraft ?? (settings.plugins.skillDirectories ?? []).join("\n")} onChange={event => setSkillDirectoriesDraft(event.target.value)} onBlur={event => { updateSettings("plugins", { ...settings.plugins, skillDirectories: event.target.value.split(/\r?\n/u).map(path => path.trim()).filter(Boolean) }); setSkillDirectoriesDraft(null); }} />
              <small className="settings-plugin-workspace__setting-hint">每行一个绝对目录，最多 16 个。默认本机 Skill 和小鱼安装的 Skill 都在 LFAA Home/skills/&lt;技能名&gt;；项目 Skill 在项目内 .lfaa/skills 或 .agents/skills。远程控制端不会把这些路径当成服务器读取授权。</small>
            </section>
          </div>
          <div className="settings-note-card settings-plugin-workspace__status-note"><strong>状态说明</strong><p>登记、安装、启用和运行分别来自对应目录与 Runtime；MCP“启用”只表示已保存的连接配置，不代表服务当前在线。</p></div>
        </> : null}
        {knowledgeLibraryOpened ? <div hidden={pluginWorkspaceTab !== "knowledge"}><KnowledgeLibraryPanel extensionsEnabled={settings.plugins.enabled} /></div> : null}
        {pluginWorkspaceTab === "catalog" ? <div className="settings-extension-catalog-page">
        <section className="settings-group settings-extension-catalog-group" aria-label="能力目录">
          <div className="settings-group__rows">
          {extensions.length ? <div className="settings-extension-catalog">
            <div className="settings-extension-catalog__toolbar">
              <Input className="settings-extension-catalog__search" aria-label="搜索能力目录" placeholder="搜索能力名称、说明或来源" prefix={<WorkbenchIcon name="search" size={16} />} allowClear value={extensionSearch} onChange={(event) => setExtensionSearch(event.target.value)} />
            </div>
            <div className="settings-extension-catalog__result-count" role="status" aria-live="polite">显示 {visibleExtensionCount} / {extensionKindTotalCount} 项</div>
            {extensionCatalogGroups.length ? <div className="settings-extension-catalog__groups">
              {extensionCatalogGroups.map((group) => (
                <section key={group.kind} className="settings-extension-catalog__category" aria-labelledby={`settings-extension-category-${group.kind}`}>
                  <header className="settings-extension-catalog__category-heading">
                    <div className="settings-extension-catalog__category-copy">
                      <WorkbenchIcon name={group.icon} size={18} />
                      <div><h4 id={`settings-extension-category-${group.kind}`}>{group.label}</h4><p>{group.description}</p></div>
                    </div>
                    <Tag>{group.items.length} 项</Tag>
                  </header>
                  <div className="settings-extension-catalog__list">
                    {group.items.map((extension) => (
                      <article key={extension.id} className="settings-extension-catalog__entry">
                        <div className="settings-extension-catalog__entry-heading">
                          <span className="settings-extension-catalog__entry-icon"><WorkbenchIcon name={group.icon} size={19} /></span>
                          <strong>{extension.name}</strong>
                          <span className="settings-extension-catalog__entry-version">v{extension.version}</span>
                        </div>
                        <p className="settings-extension-catalog__entry-description">{extension.description || "暂无说明。"}</p>
                        <div className="settings-extension-catalog__entry-meta">
                          <span className="settings-extension-catalog__entry-source" title={`来源：${extension.pluginId}`}><span>来源</span>{extension.pluginId}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div> : <div className="settings-extension-catalog__empty" role="status">
              <strong>{extensionKindTotalCount === 0 ? `当前没有登记的${extensionKindFilter === "all" ? "扩展" : `${EXTENSION_CATEGORIES.find((category) => category.kind === extensionKindFilter)?.label ?? ""}`}能力` : `没有找到匹配的${extensionKindFilter === "all" ? "能力" : `${EXTENSION_CATEGORIES.find((category) => category.kind === extensionKindFilter)?.label ?? ""}能力`}`}</strong>
              <span>{extensionSearch.trim() ? "试试其他关键词。" : "该类别暂时没有可展示的内容。"}</span>
              {extensionSearch.trim() ? <Button type="link" onClick={() => setExtensionSearch("")}>清除搜索</Button> : null}
            </div>}
          </div> : <SettingRow title="暂无扩展登记" description="Cordis 插件加载后，Agent、领域专家、提示词、技能和工具会显示在此。" status="空目录"><Tag>0 项</Tag></SettingRow>}
          </div>
        </section>
        <SettingGroup title="能力安装接入状态">
          {visibleCapabilityInstallCatalog.length ? <div className="settings-capability-route-grid">
            {visibleCapabilityInstallCatalog.map((capability) => {
              const kindLabels: Record<CapabilityInstallCatalogEntry["kind"], string> = { plugin: "第三方插件", skill: "Skills", prompt: "提示词", tool: "Tools", mcp: "MCP 服务", "minecraft-plugin": "Minecraft 插件", "minecraft-mod": "Minecraft 模组" };
              const applicationLabels: Record<string, string> = { workspace: "通用工作台", steamcmd: "SteamCMD", minecraft: "Minecraft", connectivity: "联机服务", writing: "写作", aivideo: "AI 漫剧" };
              const operationLabels: Record<string, string> = { search: "搜索", inspect: "检查", install: "安装", list: "清单", enable: "启用", disable: "停用", remove: "移除" };
              const applicationSummary = capability.applicationIds.map((id) => applicationLabels[id] ?? id).join("、");
              const operationSummary = capability.operations.map((operation) => operationLabels[operation] ?? operation).join("、");
              return <article key={capability.kind} className="settings-capability-route-card">
                <header className="settings-capability-route-card__heading">
                  <strong>{kindLabels[capability.kind]}</strong>
                  <Tag color={capability.available ? "green" : "default"}>{capability.available ? "可由 AI 路由" : "自然语言安装尚不可用"}</Tag>
                </header>
                {capability.available ? <div className="settings-capability-route-card__details">
                  <div><small>支持 App</small><p>{applicationSummary}</p></div>
                  <div><small>可用操作</small><p>{operationSummary}</p></div>
                </div> : <p className="settings-capability-route-card__reason">{capability.reason ?? "领域 Owner 适配器尚未接入。"}</p>}
                <footer>{capability.available ? "安装路由已接入" : "安装路由待接入"}</footer>
              </article>;
            })}
          </div> : <SettingRow title="没有其它能力安装适配器" description="当前没有其它可用的能力安装适配器。" status="未登记"><Tag>0 项</Tag></SettingRow>}
        </SettingGroup>
        <SettingGroup title="已安装的 AI 提示词">
          {settings.plugins.prompts.length ? settings.plugins.prompts.map((prompt) => {
            const applicationLabel = prompt.applicationId === "workspace" ? "通用工作台" : prompt.applicationId === "steamcmd" ? "SteamCMD" : prompt.applicationId === "minecraft" ? "Minecraft" : prompt.applicationId === "connectivity" ? "联机服务" : prompt.applicationId === "aivideo" ? "AI 漫剧" : "写作";
            const status = !prompt.enabled ? "已停用" : settings.plugins.enabled ? "可由 AI 按需加载" : "AI 扩展总开关关闭";
            return <SettingRow key={`${prompt.applicationId}:${prompt.id}`} title={prompt.name} description={`${applicationLabel} · ${prompt.description || "第三方提示词"} · ${prompt.sourceRepository}/${prompt.sourcePath} · ${prompt.commit.slice(0, 12)} · 内容 SHA-256 ${prompt.contentSha256.slice(0, 12)}`} status={status}>
              <Tag color={prompt.enabled && settings.plugins.enabled ? "green" : "default"}>{prompt.enabled ? "已登记" : "已停用"}</Tag>
            </SettingRow>;
          }) : <SettingRow title="没有已安装提示词" description="你可以在 小鱼智能体 中让模型检查来源并按当前权限模式安装；提示词会绑定到指定账户和目标 App。" status="空清单"><Tag>0 项</Tag></SettingRow>}
        </SettingGroup>
        </div> : null}
        {pluginWorkspaceTab === "diagnostics" ? <>
        <SettingGroup title="Cordis 模块管理">
          <SettingRow title="当前运行组合" description={`已运行 ${activeRuntimePluginCount}/${runtimePlugins.length} 个模块；核心依赖 ${runtimePluginHostReady ? "正常" : "未就绪"}。管理员操作立即生效，并保存为此控制端的全局配置。`} status={runtimePluginHostReady ? "核心模块正常" : "需要检查"}><Tag color={runtimePluginHostReady ? "green" : "orange"}>{canAdmin ? "管理员可管理可选模块" : "只读"}</Tag></SettingRow>
          <SettingRow title="源码热重载" description={hotReloadEnabled ? "开发环境源码监听器正在运行；修改 packages/ 内的受信任模块后由 Cordis 自动热替换，进行中的任务仍保留启动时使用的模块版本。" : "当前没有活动的源码监听器。正式运行环境不监听源码；启用开发环境 HMR 模块后才会自动热替换代码。"} status={hotReloadEnabled ? "自动热重载可用" : "未监听源码"}><Tag color={hotReloadEnabled ? "green" : "default"}>{hotReloadEnabled ? "免重启代码热替换" : "不可用"}</Tag></SettingRow>
          <Alert className="settings-inline-alert" type="warning" showIcon message="停止可选模块会立即撤销其服务与资源，并可能影响依赖功能或正在执行的请求。重建实例只重新运行当前已加载的模块，不替换已缓存源码。第三方源码快照单独登记；插件 UI 完成 LFAA Owner 映射与实页验收前保持不可用。" />
          {runtimePluginGroups.map((group) => {
            const expanded = expandedRuntimePluginGroups.has(group.id);
            const groupActiveCount = group.plugins.filter((plugin) => plugin.enabled && plugin.state === "ACTIVE").length;
            return <div key={group.id}>
              <SettingRow title={group.label} description={`${groupActiveCount}/${group.plugins.length} 个模块运行中`} status={expanded ? "已展开" : "已收起"}>
                <Button type="link" size="small" aria-expanded={expanded} onClick={() => setExpandedRuntimePluginGroups((current) => {
                  const next = new Set(current);
                  if (next.has(group.id)) next.delete(group.id); else next.add(group.id);
                  return next;
                })}>{expanded ? "收起" : "展开"}</Button>
              </SettingRow>
              {expanded ? group.plugins.map((plugin) => {
                const running = plugin.enabled && plugin.state === "ACTIVE";
                const pluginStatus = plugin.state === "FAILED" ? "启动失败"
                  : plugin.state === "LOADING" ? "启动中"
                    : plugin.state === "UNLOADING" ? "停止中"
                      : running ? "运行中"
                        : plugin.profileDisabled ? "组合未启用"
                          : plugin.disabled ? "已停止"
                            : plugin.state === "DISPOSED" ? "已释放" : "等待依赖";
                return <SettingRow key={plugin.id} title={plugin.name} description={plugin.required ? "运行组合核心依赖，保持运行以确保控制端能力可用。" : plugin.profileDisabled ? "此模块由当前 Profile 固定停用，不能从设置中心启动。" : `Cordis 状态：${plugin.state}`} status={pluginStatus}>
                  <Space wrap>
                    <Tag color={running ? "green" : plugin.state === "FAILED" ? "red" : undefined}>{pluginStatus}</Tag>
                    {plugin.required ? <Tag>核心依赖</Tag> : null}
                    {canAdmin && plugin.canToggle && (running
                      ? <Popconfirm title={`立即停止 ${plugin.name}？依赖它的功能可能同时不可用。`} okText="停止" cancelText="取消" onConfirm={() => void runRuntimePluginAction(plugin, "stop")}><Button size="small" danger disabled={runtimePluginBusyId !== null} loading={runtimePluginBusyId === plugin.id}>停止</Button></Popconfirm>
                      : <Button size="small" disabled={runtimePluginBusyId !== null} loading={runtimePluginBusyId === plugin.id} onClick={() => void runRuntimePluginAction(plugin, "start")}>{plugin.state === "FAILED" ? "重试启动" : "启动"}</Button>)}
                    {canAdmin && plugin.canReload ? <Popconfirm title={`重建 ${plugin.name} 的运行实例？`} okText="重建实例" cancelText="取消" onConfirm={() => void runRuntimePluginAction(plugin, "reload")}><Button size="small" disabled={runtimePluginBusyId !== null} loading={runtimePluginBusyId === plugin.id}>重建实例</Button></Popconfirm> : null}
                  </Space>
                </SettingRow>;
              }) : null}
            </div>;
          })}
        </SettingGroup>
        <SettingGroup title="AI Runtime Hooks">
          {runtimeHooks.length ? runtimeHooks.map((hook) => <SettingRow key={hook.id} title={hook.id} description={`订阅事件：${hook.events.map((event) => event === "beforeInference" ? "推理前" : event === "afterInference" ? "推理后" : "模型请求路由").join("、")}`} status="受信任插件"><Tag>生命周期钩子</Tag></SettingRow>) : <SettingRow title="暂无已注册钩子" description="AI Runtime Hook 由 Cordis 插件生命周期注册；模型请求路由钩子只能从当前账户已配置模型中选择，并遵守其目录支持的思考档位。" status="空目录"><Tag>0 项</Tag></SettingRow>}
        </SettingGroup>
        </> : null}
        {pluginWorkspaceTab === "mcp" ? <>
          <McpConnectionsSettings settings={settings} onChange={plugins => updateSettings("plugins", plugins)} />
          <div className="settings-note-card"><strong>运行安全边界</strong><p>扩展工具必须提供真实执行实现；MCP 服务由你配置和运行，其工具沿用项目权限模式，模型不能自行添加连接。外部服务说明只是能力参考，不能改变用户目标或权限。</p></div>
        </> : null}
        </div>
      </section>
    );

    if (activeSection === "permissions") return (
      <section className="settings-content">
        <header className="settings-content__heading"><div><span className="settings-eyebrow">本机账户</span><Typography.Title level={2}>用户与权限</Typography.Title><Typography.Paragraph>管理账户角色、项目 AI 权限模式与账户恢复。</Typography.Paragraph></div></header>
        <SettingGroup title="项目权限模式">
          <SettingRow title="项目权限模式" description="控制 小鱼智能体 是否需要逐项审批项目操作；完全权限下，模型自主决定并执行。">
            <Select value={settings.permissions.mode} options={[{ value: "ask", label: "请求审批" }, { value: "approve_remembered", label: "替我审批" }, { value: "full_access", label: "完全权限" }]} onChange={(value: UserSettings["permissions"]["mode"]) => updatePermissionMode(value)} />
          </SettingRow>
          <SettingRow title="当前生效模式" description={settings.permissions.mode === persistedPermissionMode ? "所选权限模式已保存并由 server 执行。" : "权限模式尚未保存；保存前仍按已生效模式授权。"} status={settings.permissions.mode === persistedPermissionMode ? "已生效" : "待保存"}>
            <Tag color={settings.permissions.mode === persistedPermissionMode ? "green" : "gold"}>{settings.permissions.mode === "ask" ? "请求审批" : settings.permissions.mode === "approve_remembered" ? "替我审批" : "完全权限"}</Tag>
          </SettingRow>
        </SettingGroup>
        <SettingGroup title="权限模式说明">
          <SettingRow title="请求审批" description="只读操作按规则执行；写入和高风险操作每次都由你明确批准，不保存记忆授权。" status={settings.permissions.mode === "ask" ? "当前选择" : undefined}>
            <Tag>逐项确认</Tag>
          </SettingRow>
          <SettingRow title="替我审批" description="同一账户、应用、工具版本、风险和目标范围经你明确批准两次后自动记忆；此后完全匹配的操作不再逐项等待。不同范围仍分别判断，已记忆的范围可在下方撤销。" status={settings.permissions.mode === "approve_remembered" ? "当前选择" : undefined}>
            <Tag>可记住限定范围</Tag>
          </SettingRow>
          <SettingRow title="完全权限" description="模型按你的任务指令自主执行全部项目操作，可在在线 Daemon 上执行任意命令并指定工作目录，不再逐项审批。" status={settings.permissions.mode === "full_access" ? "当前选择" : undefined}>
            <Tag>AI 自动执行</Tag>
          </SettingRow>
        </SettingGroup>
        <Alert className="settings-inline-alert" type="info" showIcon message="完全权限下，模型可自主执行当前应用的全部项目工具；在线 Daemon 上支持任意终端命令与工作目录，按 Daemon 进程账户权限运行，不再逐项审批。Minecraft EULA 仍由用户在项目界面单独确认。" />
        <SettingGroup title="待审批操作">
          {pendingApprovals.length ? pendingApprovals.map((approval) => <SettingRow
            key={approval.id}
            title={approval.summary}
            description={`${approval.appId === "steamcmd" ? "SteamCMD 开服" : approval.appId === "minecraft" ? "Minecraft" : "写作"} · ${approval.toolId}@${approval.toolVersion} · ${approval.risk === "read" ? "只读" : approval.risk === "write" ? "写入" : "高风险"} · 目标范围：${approval.scopeSummary} · 请求于 ${new Date(approval.requestedAt).toLocaleString("zh-CN")}`}
            status={`有效期至 ${new Date(approval.expiresAt).toLocaleTimeString("zh-CN")}`}
          >
            <Space>
              <Popconfirm title="批准这项操作？" description={`${approval.summary}；目标范围：${approval.scopeSummary}。只授权此参数摘要对应的单次操作，有效 5 分钟。${persistedPermissionMode === "approve_remembered" ? "此明确批准会计入同范围的自动记忆次数；累计两次后后续匹配操作免逐项审批。" : ""}`} okText="批准" cancelText="取消" onConfirm={() => confirmApproval(approval)}>
                <Button type="primary" loading={approvalBusyId === approval.id} disabled={approvalBusyId !== null}>批准</Button>
              </Popconfirm>
              <Popconfirm title="拒绝这项操作？" okText="拒绝" cancelText="取消" onConfirm={() => void resolveApproval(approval, "denied")}>
                <Button danger loading={approvalBusyId === approval.id} disabled={approvalBusyId !== null}>拒绝</Button>
              </Popconfirm>
            </Space>
          </SettingRow>) : <SettingRow title="没有待审批操作" description="仅当前项目权限模式要求逐项确认的操作会出现在这里。" status="队列为空"><Tag>0 项</Tag></SettingRow>}
        </SettingGroup>
        <SettingGroup title="已记住的授权">
          {permissionGrants.length ? permissionGrants.map((grant) => <SettingRow
            key={grant.id}
            title={grant.summary}
            description={`${grant.appId === "steamcmd" ? "SteamCMD 开服" : grant.appId === "minecraft" ? "Minecraft" : "写作"} · ${grant.toolId}@${grant.toolVersion} · ${grant.risk === "write" ? "写入" : "高风险"} · 目标范围：${grant.scopeSummary}`}
            status={`记住于 ${new Date(grant.createdAt).toLocaleString("zh-CN")}`}
          >
            <Popconfirm title="撤销这条记忆授权？" description="在“替我审批”模式下，匹配的后续操作会自动执行；撤销后同范围重新累计两次明确批准。" okText="撤销授权" cancelText="保留" onConfirm={() => void revokePermissionGrant(grant)}>
              <Button danger size="small">撤销</Button>
            </Popconfirm>
          </SettingRow>) : <SettingRow title="没有已记住的授权" description="记忆授权按账户、应用、工具版本、风险和目标范围保存；仅在“替我审批”模式下生效。" status="0 项"><Tag>未授权</Tag></SettingRow>}
        </SettingGroup>
        <SettingGroup title="当前账户">
          <SettingRow title={user.username} description="当前登录账户" status="已登录"><Tag color={canAdmin ? "blue" : "default"}>{userRoleLabel(user.role)}</Tag></SettingRow>
          <SettingRow title="角色模型" description="当前版本提供管理员与普通账户两种固定角色；细粒度 Permission 规则尚未接入。" status="部分接入"><Tag>管理员 / 普通账户</Tag></SettingRow>
        </SettingGroup>
      </section>
    );

    if (activeSection === "personalization") return (
      <section className="settings-content">
        <header className="settings-content__heading"><div><span className="settings-eyebrow">个人</span><Typography.Title level={2}>个性化</Typography.Title><Typography.Paragraph>为后续 小鱼智能体 对话保存少量账户级偏好，帮助 LFAA 更贴合你的工作方式。</Typography.Paragraph></div></header>
        <SettingGroup title="小鱼智能体 记忆">
          <SettingRow title="启用 小鱼智能体 记忆" description="开启后，LFAA 只会处理启用后新完成的 小鱼智能体 对话，不回看或整理旧聊天。关闭会暂停使用与生成，已有记忆会保留；记忆保存在本机控制端，并按当前账户隔离。" status={settings.personalization.memoryEnabled ? "已开启" : "默认关闭"}>
            <SettingsSwitch label="启用 小鱼智能体 记忆" checked={settings.personalization.memoryEnabled} onChange={() => updateSettings("personalization", { ...settings.personalization, memoryEnabled: !settings.personalization.memoryEnabled })} />
          </SettingRow>
          <SettingRow title="允许从使用工具的聊天中生成记忆" description="开启后，符合条件的工具聊天会把本轮问题、助手最终回复和已有记忆发送到当前 Provider 整理；不会发送原始工具参数或工具输出。每次最多增加一次有界模型请求和相应用量。" status={settings.personalization.memoryFromToolChats ? "已允许" : "默认关闭"}>
            <SettingsSwitch label="允许从使用工具的聊天中生成记忆" checked={settings.personalization.memoryFromToolChats} disabled={!settings.personalization.memoryEnabled} onChange={() => updateSettings("personalization", { ...settings.personalization, memoryFromToolChats: !settings.personalization.memoryFromToolChats })} />
          </SettingRow>
          <div className="settings-memory-editor">
            <div className="settings-memory-editor__heading">
              <strong>查看与编辑已保存的记忆</strong>
              <span>每行一条；最多 16 条、每条 240 字。常见凭据和个人标识会在保存或发送整理请求前过滤，但无法保证识别所有敏感表达。</span>
            </div>
            <Input.TextArea aria-label="查看与编辑已保存的 小鱼智能体 记忆" rows={7} value={conversationMemoryDraft} disabled={loadingConversationMemories || !conversationMemorySnapshot} onChange={(event) => setConversationMemoryDraft(event.target.value)} placeholder="每行输入一条稳定偏好或长期背景" />
            <div className="settings-memory-editor__actions">
              <Typography.Text type={conversationMemoryDraftOverLimit ? "danger" : "secondary"}>{loadingConversationMemories ? "正在读取…" : `${conversationMemoryDraftItems.length} / 16 条${conversationMemoryDraftOverLimit ? " · 检查数量、重复项或长度" : ""}`}</Typography.Text>
              <Button type="primary" loading={savingConversationMemories} disabled={loadingConversationMemories || !conversationMemorySnapshot || conversationMemoryDraftOverLimit} onClick={() => void saveCurrentConversationMemories()}>保存记忆</Button>
            </div>
          </div>
          <SettingRow title="删除 小鱼智能体 记忆" description="清除当前账户的全部对话记忆，并从已保存的模型请求快照中移除 LFAA 注入的记忆正文；原始聊天消息、工具审批授权和 Markdown 知识库会保留。" status="当前账户">
            <Popconfirm title="删除当前账户的全部 小鱼智能体 记忆？" description="同时从已保存的模型请求快照中移除注入记忆正文；聊天原文会保留。" okText="删除记忆" cancelText="取消" onConfirm={() => void clearCurrentConversationMemories()}>
              <Button danger loading={deletingConversationMemories}>删除</Button>
            </Popconfirm>
          </SettingRow>
        </SettingGroup>
        <Alert className="settings-inline-alert" type="info" showIcon message="记忆整理在回答完成后后台运行，不会拖延主回答；最多同时整理 4 轮，同一账户已有整理任务时会跳过新一轮。它会使用当前已配置的 Provider 并增加模型用量。发送前会在本机过滤可识别的常见敏感内容，但规则无法识别所有情况。仅成功完成的根级 小鱼智能体 轮次可整理；失败、取消和子 Agent 轮次不会生成记忆。" />
      </section>
    );

    if (activeSection === "workspace") return (
      <section className="settings-content settings-content--storage">
        <header className="settings-content__heading"><div><span className="settings-eyebrow">业务数据</span><Typography.Title level={2}>项目与存储</Typography.Title><Typography.Paragraph>管理本机业务 Data 根、SteamCMD 工具目录和游戏存储位置。账户、会话和设置保留在 LFAA Home；本页更改通过对应区块单独保存。</Typography.Paragraph></div></header>
        {!canAdmin ? <Alert className="settings-inline-alert" type="warning" showIcon message="应用存储路径由管理员配置。" /> : null}
        {canAdmin && projectStorageLocations?.dataDirectoryExternallyManaged ? <Alert className="settings-inline-alert" type="warning" showIcon message="业务 Data 根由部署配置控制" description={projectStorageLocations.changeUnavailableReason ?? "请修改 LFAA_DATA_DIR 部署配置后重启；此页面只读显示实际业务目录。"} /> : null}
        {canAdmin && projectStorageLocations?.restartRequired ? <Alert className="settings-inline-alert" type="warning" showIcon message="业务 Data 根已保存，尚未对齐当前运行进程" description="重启 LFAA 后，控制端与本机 Daemon 会从 LFAA Home 中读取同一条项目与存储配置，并在新 Data 根创建业务目录。旧目录和已有文件会保留。" /> : null}
        {canAdmin && projectStorageLocations ? <SettingGroup title="业务内容存储位置">
          <div className="settings-storage-panel">
            <div className="settings-storage-current">
              <div className="settings-storage-current__heading">
                <div><Typography.Text strong>当前业务 Data 根</Typography.Text><Typography.Text type="secondary">新建的业务文件与运行目录使用此位置</Typography.Text></div>
                <Tag>正在使用</Tag>
              </div>
              <Typography.Text className="settings-storage-current__path" code copyable>{projectStorageLocations.contentDirectory}</Typography.Text>
              <div className="settings-storage-directory-grid" aria-label="当前业务子目录">
                {projectStorageLocations.businessDirectories.map(directory => <div className="settings-storage-directory" key={directory.path}>
                  <span>{directory.name}</span>
                  <Typography.Text className="settings-storage-directory__path" code copyable>{directory.path}</Typography.Text>
                </div>)}
              </div>
            </div>
            <Typography.Paragraph className="settings-storage-scope" type="secondary">切换时新根会创建上述业务分类，旧根和其中的文件保持原样。复制、核对与 ZIP 只处理已有游戏、Writing 和 AI 漫剧项目文件，不复制运行环境、缓存、日志与备份。</Typography.Paragraph>
            <Radio.Group className="settings-storage-options" aria-label="业务内容存储位置选择" value={contentDirectorySelection} disabled={!canEditContentDirectory} onChange={event => { setContentDirectorySelection(event.target.value); setContentComparison(null); }}>
              <Radio value="default" disabled={!canEditContentDirectory}>
                <span className="settings-storage-option__copy"><strong>默认存储位置</strong><span>使用 LFAA Home 下的业务 data；已有项目内容按下方方式处理</span><code>{projectStorageLocations.defaultContentDirectory}</code></span>
              </Radio>
              <Radio value="recommended" disabled={!canEditContentDirectory || !projectStorageLocations.recommendedContentDirectory}>
                <span className="settings-storage-option__copy"><strong>系统推荐位置</strong><span>按当前项目或安装位置动态生成 data 目录</span><code>{projectStorageLocations.recommendedContentDirectory}</code></span>
              </Radio>
              <Radio value="custom" disabled={!canEditContentDirectory}>
                <span className="settings-storage-option__copy"><strong>自定义存储位置</strong><span>选择或输入位置，LFAA 会在其中创建 data 目录</span></span>
              </Radio>
            </Radio.Group>
            {contentDirectorySelection === "custom" ? <div className="settings-storage-custom">
              <label htmlFor="settings-content-directory">自定义存储位置</label>
              <div className="settings-storage-custom__input">
                <Input id="settings-content-directory" aria-label="业务数据存储位置" aria-describedby="settings-content-directory-help" value={contentDirectoryDraft} maxLength={2048} placeholder="输入 LFAA 控制端可访问的绝对路径" disabled={!canEditContentDirectory} onChange={event => { setContentDirectoryDraft(event.target.value); setContentComparison(null); }} />
                {isDesktopApp() ? <Button disabled={!canEditContentDirectory} onClick={() => void chooseContentDirectory()}>打开文件管理器选择</Button> : null}
              </div>
              <Typography.Text id="settings-content-directory-help" type="secondary">{isDesktopApp() ? "选择一个存储位置，LFAA 会在其中创建 data 目录，再在 data 下创建游戏、环境、工具、缓存、日志、备份等业务分类。" : "当前为 Web 运行模式，浏览器无法打开 Windows 文件夹选择器，请输入 LFAA 控制端可访问的绝对路径。LFAA 会在所选位置下创建 data 目录，再创建各业务分类。"}</Typography.Text>
              <Typography.Text type="secondary" style={{ display: "block", overflowWrap: "anywhere" }}>新业务 Data 根：<Typography.Text code copyable>{selectedContentDirectory()}</Typography.Text></Typography.Text>
            </div> : null}
            <div className="settings-storage-migration">
              <div className="settings-storage-migration__heading"><Typography.Text strong>已有项目内容怎么处理</Typography.Text><Typography.Text type="secondary">只处理游戏与项目文件；源目录始终保留。</Typography.Text></div>
              <Radio.Group aria-label="业务内容迁移方式" value={contentMigrationMode} disabled={!canEditContentDirectory} onChange={event => { setContentMigrationMode(event.target.value); setContentComparison(null); }}>
                <Radio value="copy"><span><strong>系统复制并覆盖</strong><small>复制源文件，目标冲突先备份；目标独有文件保留</small></span></Radio>
                <Radio value="adopt"><span><strong>手动复制后核对</strong><small>先在资源管理器复制，再按文件清单和 SHA-256 比对</small></span></Radio>
                <Radio value="archive"><span><strong>从 ZIP 备份导入</strong><small>仅识别并导入 games、Writing 与 AI 漫剧项目树</small></span></Radio>
              </Radio.Group>
              {contentMigrationMode === "archive" ? <div className="settings-storage-custom">
                <label htmlFor="settings-content-archive-path">ZIP 备份路径</label>
                <Input id="settings-content-archive-path" aria-label="业务内容 ZIP 备份路径" value={contentArchivePath} maxLength={2048} placeholder="输入 LFAA 控制端可访问的 .zip 绝对路径" disabled={!canEditContentDirectory} onChange={event => setContentArchivePath(event.target.value)} />
              </div> : null}
              {contentMigrationMode === "adopt" ? <div className="settings-storage-actions">
                <Typography.Text type="secondary">手动复制模式不会写入目标；差异为 0 后才允许切换。</Typography.Text>
                <Button loading={contentStorageAction === "compare"} disabled={!canEditContentDirectory || !selectedContentDirectory().trim()} onClick={() => void compareSelectedContentDirectory()}>比对文件和文件夹</Button>
              </div> : null}
              {contentComparison ? <Alert className="settings-inline-alert" type={contentComparison.matching ? "success" : "warning"} showIcon message={contentComparison.matching ? "手动复制核对通过" : `发现 ${contentComparison.differenceCount} 处差异`} description={`源：${contentComparison.sourceFileCount} 个文件，${formatStorageBytes(contentComparison.sourceBytes)}；目标：${contentComparison.targetFileCount} 个文件，${formatStorageBytes(contentComparison.targetBytes)}。${contentComparison.differences.slice(0, 12).map(item => ` ${item.kind}: ${item.path}`).join("；")}${contentComparison.differenceCount > 12 ? "；其余差异已省略" : ""}`} /> : null}
              <Alert className="settings-inline-alert" type="info" showIcon message="账户数据与业务数据分开保管" description="这里切换的是本机业务 Data 根。账户、Provider/凭据、会话和设置留在 LFAA Home；插件 Profile 与远端节点目录不受影响。业务运行分类在新根创建，已有项目文件只按上方选择的方式处理；冲突文件备份保留在目标 data/.lfaa-content-migration-backups/。" />
            </div>
            {!canAdmin ? <Typography.Text type="secondary">需要管理员账户才能更改本机内容存储目录。</Typography.Text> : <div className="settings-storage-actions settings-storage-final-actions">
              <Button loading={contentStorageAction === "export"} disabled={!canEditContentDirectory} onClick={() => void exportProjectContentArchive()}>导出业务 ZIP</Button>
              <Typography.Text type="secondary">复制/导入成功且 SHA-256 校验通过后才切换；原目录保留。手动模式须先完成比对。</Typography.Text>
              <Button type="primary" loading={contentStorageAction === "save" || contentStorageAction === "import"} disabled={!canEditContentDirectory || (contentDirectorySelection === "custom" && !contentDirectoryDraft.trim()) || (contentMigrationMode === "archive" && !contentArchivePath.trim()) || (contentMigrationMode === "adopt" && !(contentComparison?.matching && contentComparison.targetDirectory.toLocaleLowerCase() === selectedContentDirectory().toLocaleLowerCase()))} onClick={() => void saveContentStorageSelection()}>{contentStorageAction === "save" || contentStorageAction === "import" ? "正在迁移并校验…" : contentMigrationMode === "adopt" ? "核对并切换位置" : contentMigrationMode === "archive" ? "导入 ZIP 并切换" : "复制并切换位置"}</Button>
            </div>}
          </div>
        </SettingGroup> : null}
        {canAdmin ? <SettingGroup title="SteamCMD 工具配置">
          <SettingRow title="编辑配置范围" description="选择全局默认或一个节点的安装配置。全局默认供未单独覆盖的节点使用；只决定编辑和保存哪份配置。" status={selectedSteamcmdConfigurationNode ? "节点覆盖" : "全局默认"}>
            <Select value={selectedSteamcmdConfigurationNodeId || "__defaults__"} options={[{ value: "__defaults__", label: "全局默认设置" }, ...steamcmdNodes.map(node => ({ value: node.id, label: `${node.displayName} · ${node.status === "online" ? "在线" : "离线"}` }))]} onChange={selectSteamcmdConfigurationNode} />
          </SettingRow>
          <SettingRow title="当前安装配置" description={selectedSteamcmdConfigurationNode ? `${selectedSteamcmdConfigurationNode.displayName} · ${selectedSteamcmdConfigurationNode.status === "online" ? "在线；任务目标在下方选择。" : "节点离线；仍可保存此节点配置。"}` : "所有未单独覆盖的节点使用此默认配置。"} status={selectedSteamcmdConfigurationNode?.configurationConfigured ? "节点已覆盖" : steamcmdConfigurationDefaultsConfigured ? "默认配置已保存" : "推荐默认值"}>
            <Tag color={selectedSteamcmdConfigurationNode?.configurationConfigured || steamcmdConfigurationDefaultsConfigured ? "blue" : "default"}>{selectedSteamcmdConfigurationNode?.configurationConfigured ? "节点已覆盖" : steamcmdConfigurationDefaultsConfigured ? "默认配置已保存" : "推荐默认值"}</Tag>
          </SettingRow>
          <SettingRow title="安装模式" description={steamcmdConfigurationDraft.installMode === "online" ? "从 Valve 官方 CDN 下载并安装 SteamCMD。" : "使用目录中已有的 steamcmd.exe，并在校验时启动它。"}>
            <Radio.Group value={steamcmdConfigurationDraft.installMode} disabled={steamcmdAction !== null} onChange={event => updateSteamcmdConfigurationDraft("installMode", event.target.value)} optionType="button" buttonStyle="solid" options={[{ label: "在线安装", value: "online" }, { label: "手动指定", value: "manual" }]} />
          </SettingRow>
          <SettingRow title="SteamCMD 工具目录" description={`完整位置：${displaySteamcmdPath(selectedSteamcmdConfigurationNode, steamcmdConfigurationDraft.steamcmdDirectory || "lib/steamcmd")}。目录相对于目标节点的 LFAA_DATA_DIR，与业务内容根分开保存。`}>
            <Input value={steamcmdConfigurationDraft.steamcmdDirectory} disabled={steamcmdAction !== null} onChange={event => updateSteamcmdConfigurationDraft("steamcmdDirectory", event.target.value)} placeholder="lib/steamcmd" />
          </SettingRow>
          <SettingRow title="保存工具配置" description="只保存所选范围的 SteamCMD 安装方式和工具目录，不移动游戏文件。">
            <Space wrap>
              <Button disabled={steamcmdAction !== null} onClick={() => setSteamcmdConfigurationDraft({ installMode: "online", steamcmdDirectory: "lib/steamcmd" })}>恢复推荐配置</Button>
              <Button type="primary" loading={steamcmdAction === "save-configuration"} disabled={steamcmdAction !== null} onClick={() => void saveSteamcmdConfiguration()}>{selectedSteamcmdConfigurationNode ? "保存当前节点配置" : "保存默认配置"}</Button>
            </Space>
          </SettingRow>
        </SettingGroup> : null}
        {canAdmin ? <>
          <SettingGroup title="SteamCMD 安装与校验">
            <SettingRow title="安装目标节点" description="单独选择实际执行任务的 Windows x64 节点。任务读取目标节点当前生效的已保存配置；不会自动保存上方正在编辑的草稿。" status={selectedSteamcmdInstallNode ? selectedSteamcmdInstallNode.status === "online" ? "已选择" : "节点离线" : "尚未选择"}>
              <Select allowClear placeholder="选择安装目标节点" value={selectedSteamcmdInstallNodeId || undefined} options={steamcmdNodes.map(node => ({ value: node.id, label: `${node.displayName} · ${node.status === "online" ? "在线" : "离线"}` }))} onChange={nodeId => { setSelectedSteamcmdInstallNodeId(nodeId ?? ""); setSteamcmdTask(null); }} />
            </SettingRow>
            <SettingRow title="目标节点当前状态" description={selectedSteamcmdInstallNode ? `${selectedSteamcmdInstallNode.configuration.installMode === "online" ? "在线安装" : "手动指定"} · ${displaySteamcmdPath(selectedSteamcmdInstallNode, selectedSteamcmdInstallNode.configuration.steamcmdDirectory)}${selectedSteamcmdInstallNode.configurationConfigured ? " · 节点覆盖" : " · 使用全局默认"}` : "选择目标节点后显示其生效模式和安装目录。"} status={selectedSteamcmdInstallNode?.steamcmdInstalled ? "SteamCMD 已安装" : selectedSteamcmdInstallNodeCanRunTasks ? "可执行任务" : "等待可用节点"}>
              <Tag color={selectedSteamcmdInstallNode?.steamcmdInstalled ? "green" : selectedSteamcmdInstallNodeCanRunTasks ? "blue" : "default"}>{selectedSteamcmdInstallNode?.steamcmdInstalled ? "已安装" : selectedSteamcmdInstallNodeCanRunTasks ? "在线" : selectedSteamcmdInstallNode ? "不可执行" : "未选择"}</Tag>
            </SettingRow>
            <SettingRow title="操作" description={selectedSteamcmdInstallNodeCanRunTasks ? "安装和校验任务提交到上方所选节点。" : "请选择在线且支持 SteamCMD 任务的 Windows x64 Daemon。"}>
              <Space wrap>
                <Button loading={steamcmdAction === "verify"} disabled={!selectedSteamcmdInstallNodeCanRunTasks || steamcmdAction !== null} onClick={() => void submitSteamcmdTask("verify")}>校验 SteamCMD</Button>
                <Button type="primary" loading={steamcmdAction === "install"} disabled={!selectedSteamcmdInstallNodeCanRunTasks || selectedSteamcmdInstallNode?.configuration.installMode !== "online" || steamcmdAction !== null} onClick={() => void submitSteamcmdTask("install")}>开始安装</Button>
              </Space>
            </SettingRow>
            {selectedSteamcmdInstallNode && steamcmdTask?.nodeId === selectedSteamcmdInstallNode.id ? <SettingRow title="最近任务" description={steamcmdTask.message} status="安装任务"><Progress percent={steamcmdTask.progress} status={steamcmdTask.status === "failed" ? "exception" : steamcmdTask.status === "succeeded" ? "success" : "active"} /></SettingRow> : null}
          </SettingGroup>
          {steamcmdNodes.length === 0 ? <Alert className="settings-inline-alert" type="info" showIcon message={loadingSection === "workspace" ? "正在读取 daemon 节点…" : "当前没有已登记的 Windows x64 Daemon"} description="仍可保存 SteamCMD 全局默认配置；节点上线后可选择安装目标或设置节点覆盖。" /> : null}
        </> : null}
        {canAdmin ? <>
          <SettingGroup title="游戏节点数据位置">
            <SettingRow title="Minecraft 所属节点" description="查看领域 Owner 已登记的位置。默认在该节点 data/games/minecraft，已有自定义实例位置保留，不在此另设一套存储根。"><Select value={selectedMinecraftStorageNodeId || "__defaults__"} options={[{value:"__defaults__",label:"默认目录"},...minecraftStorageNodes.map(node=>({value:node.id,label:node.displayName}))]} onChange={selectMinecraftStorageNode}/></SettingRow>
            <SettingRow title="Minecraft 实例目录" description="实例 ID、节点与实际目录由游戏 Owner 持有；在文件管理的游戏实例入口进入。"><Typography.Text code copyable>{displaySteamcmdPath(selectedMinecraftStorageNode,minecraftStorageDraft.instanceDirectory)}</Typography.Text></SettingRow>
            <SettingRow title="Steam 游戏所属节点" description="默认在该节点 data/games/steamcmd；展示现有真实配置，不能用控制端盘符代替远端位置。"><Select value={selectedSteamcmdStorageNodeId || "__defaults__"} options={[{value:"__defaults__",label:"默认目录"},...steamcmdNodes.map(node=>({value:node.id,label:node.displayName}))]} onChange={selectSteamcmdStorageNode}/></SettingRow>
            <SettingRow title="Steam 游戏目录" description={`完整位置：${displayedSteamcmdGameDirectory}。本机默认目录跟随当前业务内容根；远端节点相对路径使用自己的 LFAA_DATA_DIR。只影响后续 Steam 游戏文件，不自动搬迁已有内容。`} status={selectedSteamcmdStorageNode?.storageConfigured ? "节点覆盖" : steamcmdStorageDefaultsConfigured ? "默认目录已保存" : "推荐默认值"}>
              <Space wrap><Input value={steamcmdStorageDraft.gameDirectory} disabled={steamcmdAction !== null} onChange={event => setSteamcmdStorageDraft({ gameDirectory: event.target.value })} placeholder="games/steamcmd" /><Button type="primary" loading={steamcmdAction === "save-storage"} disabled={steamcmdAction !== null} onClick={() => void saveSteamcmdStorage()}>保存 Steam 游戏目录</Button></Space>
            </SettingRow>
          </SettingGroup>
        </> : null}
      </section>
    );

    if (activeSection === "account") return (
      <section className="settings-content settings-content--account" role="tabpanel" id="settings-account-panel" aria-labelledby="settings-account-tab-account" tabIndex={0}>
        <header className="settings-content__heading"><div><span className="settings-eyebrow">个人与账户</span><Typography.Title level={2}>账号</Typography.Title><Typography.Paragraph>管理个人资料、登录安全和本机账号。</Typography.Paragraph></div></header>
        <AccountSettingsTabs activeSection={activeSection} onSelect={selectSection} />
        {user.role === "super_admin" ? <AdminUsersPage userId={user.id} /> : <Alert type="warning" showIcon message="只有超级管理员可以管理本机账户。" />}
      </section>
    );

    if (activeSection === "computerControl") {
      const computerControlEnabled = isComputerControlEnabled(settings);
      return (
        <section className="settings-content">
          <header className="settings-content__heading"><div><span className="settings-eyebrow">本机桌面</span><Typography.Title level={2}>电脑操控</Typography.Title><Typography.Paragraph>管理 Agent 是否可以使用本机桌面交互工具，以及发现和启动当前 Windows 用户可见的应用与游戏。进入此设置页或切换开关都不会操作电脑。</Typography.Paragraph></div></header>
          <SettingGroup title="本机访问权限">
            <SettingRow title="桌面交互与应用启动" description="允许模型与当前桌面交互，也可发现 Windows 开始菜单快捷方式和 Steam 已安装游戏并请求启动；启动操作仍按当前权限模式执行，需要审批时会等待批准。" status={computerControlEnabled ? "Agent 已获准" : "默认关闭"}>
              <SettingsSwitch label="任意应用" checked={computerControlEnabled} onChange={() => updateSettings("computerControl", { enabled: !computerControlEnabled })} />
            </SettingRow>
          </SettingGroup>
          <div className="settings-note-card"><strong>模型如何使用</strong><p>开关只决定本账户是否向模型开放已装配的电脑操控工具，不会安装或启动驱动。指定应用或游戏时，模型会先查询真实可发现的入口；未指定游戏时可根据本次 Control Plane 运行期间由 LFAA 发起的启动记录给出候选，并等你选择后才启动。该记录不包含实际游玩时长，也不包含 LFAA 外的启动。实际桌面操作先观察屏幕、动作后再观察核对；密码、验证码、支付资料和 API 密钥须由你自行输入。</p></div>
        </section>
      );
    }

    if (activeSection === "about") {
      if (developerHandbookOpen) return <DeveloperHandbook onBack={() => setDeveloperHandbookOpen(false)} />;
      const isWebUpdateRuntime = !isDesktopApp();
      const webUpdateSupported = isWebUpdateRuntime && Boolean(lfaaProjectBuildInfo?.currentVersion && lfaaProjectBuildInfo.updateManifestUrl);
      const updateStatusLabel = webUpdateResult?.status === "available" ? "发现新版"
        : webUpdateResult?.status === "up-to-date" ? "已是最新"
          : webUpdateResult?.status === "disabled" ? "更新未开放"
            : webUpdateResult?.status === "error" ? "检查失败"
              : desktopUpdateResult?.status === "up-to-date" ? "已是最新"
        : desktopUpdateResult?.status === "available" ? "发现新版"
        : desktopUpdateResult?.status === "deferred" ? "已暂缓"
          : desktopUpdateResult?.status === "ignored" ? "已跳过"
          : desktopUpdateResult?.status === "downloading" ? "正在下载"
            : desktopUpdateResult?.status === "downloaded" ? "已下载"
              : desktopUpdateResult?.status === "disabled" ? "更新未开放"
                : desktopUpdateResult?.status === "error" ? "检查失败"
                  : desktopUpdateRuntime?.supported ? "可手动检查" : webUpdateSupported ? "可在线检查" : "当前平台未支持";
      const currentVersion = desktopUpdateRuntime?.supported
        ? desktopUpdateRuntime.currentVersion || desktopUpdateResult?.currentVersion || "读取中"
        : webUpdateSupported ? lfaaProjectBuildInfo!.currentVersion : desktopUpdateRuntime ? "当前平台未接入" : "读取中";
      const updateMessage = webUpdateResult?.status === "available"
        ? `发现 LFAA ${webUpdateResult.latestVersion}。${webUpdateResult.mandatory ? "该版本为强制更新。" : ""}请打开官方发布页获取更新。`
        : webUpdateResult?.status === "up-to-date" ? `LFAA ${currentVersion} 已是最新版本。`
          : webUpdateResult?.status === "disabled" ? "当前官方发布清单暂未开放更新。"
            : webUpdateResult?.status === "error" ? webUpdateResult.message || "检查更新失败，请稍后重试。"
              : desktopUpdateResult?.status === "up-to-date" ? `LFAA ${currentVersion} 已是最新版本。`
        : desktopUpdateResult?.status === "available" ? `发现 LFAA ${desktopUpdateResult.latestVersion ?? "新版本"}；可以在工作台更新入口查看说明并选择下载。`
        : desktopUpdateResult?.status === "deferred" ? `已暂缓 LFAA ${desktopUpdateResult.latestVersion ?? "新版本"}；本次不会下载。`
          : desktopUpdateResult?.status === "ignored" ? `已跳过 LFAA ${desktopUpdateResult.latestVersion ?? "新版本"}；只在新版本发布后再次提示。`
          : desktopUpdateResult?.status === "downloading" ? `已开始下载 LFAA ${desktopUpdateResult.latestVersion ?? "新版本"}。下载完成后会再次询问是否安装。`
            : desktopUpdateResult?.status === "downloaded" ? `LFAA ${desktopUpdateResult.latestVersion ?? "新版本"} 已下载，等待安装确认。`
              : desktopUpdateResult?.status === "disabled" ? "当前发布清单暂未开放更新。"
        : desktopUpdateResult?.status === "error" ? desktopUpdateResult.message || "检查更新失败，请查看桌面日志。"
                  : "应用启动后及运行期间每 6 小时自动检查；你也可以随时手动检查。";
      const updateAlertType = webUpdateResult?.status === "error" || desktopUpdateResult?.status === "error" ? "error"
        : webUpdateResult?.status === "up-to-date" || desktopUpdateResult?.status === "up-to-date" ? "success"
          : "info";
      const updateResult = webUpdateSupported ? webUpdateResult : desktopUpdateResult;
      const checkingUpdates = webUpdateSupported ? checkingWebUpdates : checkingDesktopUpdates;
      const updateCheckSupported = webUpdateSupported || Boolean(desktopUpdateRuntime?.supported);
      return (
        <section className="settings-content">
          <header className="settings-content__heading"><div><span className="settings-eyebrow">应用信息</span><Typography.Title level={2}>关于与更新</Typography.Title><Typography.Paragraph>查看当前版本，检查 LFAA 官方发布的新版本。是否下载由你决定。</Typography.Paragraph></div></header>
          <SettingGroup title="版本与更新">
            <SettingRow title="当前版本" description={desktopUpdateRuntime?.supported ? "版本号由桌面宿主提供，不写入账户设置。" : webUpdateSupported ? "版本号来自当前 Web 构建；在线检查只读取官方发布清单。" : "当前桌面宿主尚未接入版本查询。"} status={desktopUpdateRuntime?.supported ? "已安装" : webUpdateSupported ? "Web 构建" : "平台未接入"}>
              <Tag>{desktopUpdateRuntime?.supported || webUpdateSupported ? `LFAA ${currentVersion}` : currentVersion}</Tag>
            </SettingRow>
            <SettingRow title="检查更新" description={desktopUpdateRuntime?.supported ? "检查官方版本清单；自动下载关闭时，发现新版本会先询问你。" : webUpdateSupported ? "读取 LFAA 官方更新清单并展示版本说明；Web 页面不自动下载或安装程序。" : "自动更新目前仅接入已安装的 Windows Electron 版；Tauri 与 Android 客户端尚未接入更新宿主。"} status={updateStatusLabel}>
              <Button type="primary" disabled={!updateCheckSupported} loading={checkingUpdates} onClick={() => void (webUpdateSupported ? checkWebUpdates() : checkDesktopUpdates())}>检查更新</Button>
            </SettingRow>
            {desktopUpdateRuntime?.supported && desktopUpdatePreferences ? <SettingRow
              title="自动下载并安装"
              description="只保存在这台电脑。开启后，新版本会自动下载并重启 LFAA；安装前会关闭本机控制端和 Daemon，可能中断由本机托管的游戏服务。"
              status={desktopUpdatePreferences.autoDownloadAndInstall ? "本机已开启" : "默认关闭"}
            >
              <SettingsSwitch
                label="新版本自动下载并安装"
                checked={desktopUpdatePreferences.autoDownloadAndInstall}
                disabled={savingDesktopAutoUpdate}
                onChange={() => void setDesktopAutoUpdatePreference(!desktopUpdatePreferences.autoDownloadAndInstall)}
              />
            </SettingRow> : null}
          </SettingGroup>
          {updateResult ? <Alert
            className="settings-inline-alert"
            type={updateAlertType}
            showIcon
            message={updateMessage}
            description={updateResult.releaseNotes?.length ? updateResult.releaseNotes.join("；") : undefined}
            action={webUpdateResult?.status === "available" ? <Button type="link" href={lfaaProjectBuildInfo?.releasePage} target="_blank" rel="noreferrer">打开官方发布页</Button> : undefined}
          /> : null}
          {lfaaProjectBuildInfo?.releaseNotes.length ? <div className="settings-note-card">
            <strong>本次版本公告 · LFAA {currentVersion}</strong>
            <p>发布日期：{lfaaProjectBuildInfo.publishedAt}。关闭首次公告后，也可以随时在这里重新查看。</p>
            <ul>{lfaaProjectBuildInfo.releaseNotes.map((note, index) => <li key={`${index}-${note}`}>{note}</li>)}</ul>
          </div> : null}
          <SettingGroup title="项目文档">
            <SettingRow title="LFAA 开发手册" description="按左一导航、左二侧栏、中间工作区、右侧菜单和设置中心浏览功能实现、Owner、相关开发记录与验收边界。" status="项目内可查看">
              <Button type="primary" onClick={() => setDeveloperHandbookOpen(true)}>打开开发手册</Button>
            </SettingRow>
          </SettingGroup>
        </section>
      );
    }

    if (activeSection === "git") return (
      <section className="settings-content">
        <header className="settings-content__heading"><div><span className="settings-eyebrow">Agent 项目版本管理</span><Typography.Title level={2}>Git</Typography.Title><Typography.Paragraph>Agent 会自动管理当前项目文件夹的 Git 版本。这里的设置控制新建隔离 Worktree 的分支前缀；Agent Git 摘要支持查看变更、分支、提交历史，以及 HTTPS 远端同步。</Typography.Paragraph></div></header>
        <SettingGroup title="AI Worktree 分支">
          <SettingRow title="分支前缀" description="创建 AI Worktree 时添加在分支名称前。必须以斜线结尾；Git 会再次校验完整分支名。" status="账户设置">
            <Input value={settings.git.branchPrefix} maxLength={65} placeholder="codex/" onChange={(event) => updateSettings("git", { ...settings.git, branchPrefix: event.target.value })} />
          </SettingRow>
        </SettingGroup>
        <div className="settings-note-card"><strong>变更与恢复</strong><p>Agent 右侧 Git 摘要读取当前项目文件夹的本机 Git 状态和差异。隔离 Worktree 可恢复到创建时的基线；源项目不会被该恢复操作修改。</p></div>
      </section>
    );

    if (activeSection === "worktrees") return (
      <section className="settings-content">
        <header className="settings-content__heading"><div><span className="settings-eyebrow">本地版本管理</span><Typography.Title level={2}>Worktrees</Typography.Title><Typography.Paragraph>查看并移除当前账户由 LFAA 创建的隔离 AI 工作树。删除工作树会移除其目录；原始项目保留。</Typography.Paragraph></div></header>
        <GitWorktreesSettings />
      </section>
    );

    if (activeSection === "browser") {
      const refreshBrowserHistory = async (): Promise<void> => {
        setBrowserHistoryLoading(true);
        try {
          const result = await loadBrowserRecentSites(50);
          setBrowserHistory(result.sites);
        } catch (reason) {
          messageApi.error(getErrorMessage(reason));
        } finally {
          setBrowserHistoryLoading(false);
        }
      };
      const openBrowserHistory = (): void => {
        setBrowserHistoryOpen(true);
        void refreshBrowserHistory();
      };
      const removeBrowserHistoryItem = async (url: string): Promise<void> => {
        setBrowserHistoryDeletingUrl(url);
        try {
          const result = await deleteBrowserRecentSite(url);
          if (result.deleted) setBrowserHistory(current => current.filter(site => site.url !== url));
        } catch (reason) {
          messageApi.error(getErrorMessage(reason));
        } finally {
          setBrowserHistoryDeletingUrl(null);
        }
      };
      const clearBrowserHistory = async (): Promise<void> => {
        try {
          await clearBrowserRecentSites();
          setBrowserHistory([]);
          messageApi.success("浏览历史已清除。");
        } catch (reason) {
          messageApi.error(getErrorMessage(reason));
        }
      };
      const refreshBrowserDownloads = async (): Promise<void> => {
        const nativeBrowser = window.lfaaDesktop?.nativeBrowser;
        if (!nativeBrowser) return;
        setBrowserDownloadLoading(true);
        try {
          const [history, location] = await Promise.all([nativeBrowser.getDownloadHistory(), nativeBrowser.getDownloadSettings()]);
          setBrowserDownloadHistory(history);
          setBrowserDownloadSettings(location);
        } catch (reason) {
          messageApi.error(getErrorMessage(reason));
        } finally {
          setBrowserDownloadLoading(false);
        }
      };
      const refreshBrowserExtensions = async (): Promise<void> => {
        const nativeBrowser = window.lfaaDesktop?.nativeBrowser;
        if (!nativeBrowser) return;
        setBrowserExtensionsLoading(true);
        try { setBrowserExtensions(await nativeBrowser.getBrowserExtensions()); }
        catch (reason) { messageApi.error(getErrorMessage(reason)); }
        finally { setBrowserExtensionsLoading(false); }
      };
      const openBrowserExtensions = (): void => {
        setBrowserExtensionsOpen(true);
        void refreshBrowserExtensions();
      };
      const addBrowserExtension = async (): Promise<void> => {
        const nativeBrowser = window.lfaaDesktop?.nativeBrowser;
        if (!nativeBrowser) return;
        setBrowserExtensionsLoading(true);
        try { setBrowserExtensions(await nativeBrowser.chooseBrowserExtension()); }
        catch (reason) { messageApi.error(getErrorMessage(reason)); }
        finally { setBrowserExtensionsLoading(false); }
      };
      const setBrowserExtensionEnabled = async (extension: NativeBrowserExtension, enabled: boolean): Promise<void> => {
        const nativeBrowser = window.lfaaDesktop?.nativeBrowser;
        if (!nativeBrowser) return;
        setBrowserExtensionsLoading(true);
        try { setBrowserExtensions(await nativeBrowser.setBrowserExtensionEnabled(extension.id, enabled)); }
        catch (reason) { messageApi.error(getErrorMessage(reason)); }
        finally { setBrowserExtensionsLoading(false); }
      };
      const removeBrowserExtension = async (extension: NativeBrowserExtension): Promise<void> => {
        const nativeBrowser = window.lfaaDesktop?.nativeBrowser;
        if (!nativeBrowser) return;
        setBrowserExtensionsLoading(true);
        try { setBrowserExtensions((await nativeBrowser.removeBrowserExtension(extension.id)).extensions); }
        catch (reason) { messageApi.error(getErrorMessage(reason)); }
        finally { setBrowserExtensionsLoading(false); }
      };
      const configureBrowserExtension = async (extension: NativeBrowserExtension): Promise<void> => {
        const nativeBrowser = window.lfaaDesktop?.nativeBrowser;
        if (!nativeBrowser) return;
        try { await nativeBrowser.configureBrowserExtension(extension.id); }
        catch (reason) { messageApi.error(getErrorMessage(reason)); }
      };
      const refreshBrowserCredentials = async (): Promise<void> => {
        setBrowserCredentialsLoading(true);
        try { setBrowserCredentials(await loadBrowserCredentials()); setBrowserCredentialsLoaded(true); }
        catch (reason) { messageApi.error(getErrorMessage(reason)); }
        finally { setBrowserCredentialsLoading(false); }
      };
      const openBrowserCredentialManager = (kind: "passwords" | "contacts"): void => {
        setBrowserCredentialsOpen(kind);
        void refreshBrowserCredentials();
      };
      const createBrowserPassword = async (): Promise<void> => {
        try {
          await saveBrowserPassword(browserPasswordDraft);
          setBrowserPasswordDraft({ title: "", origin: "", username: "", password: "" });
          await refreshBrowserCredentials();
          messageApi.success("密码已加密保存到当前账户。");
        } catch (reason) { messageApi.error(getErrorMessage(reason)); }
      };
      const createBrowserContact = async (): Promise<void> => {
        try {
          await saveBrowserContact(browserContactDraft);
          setBrowserContactDraft({ title: "", name: "", address: "", email: "", phone: "" });
          await refreshBrowserCredentials();
          messageApi.success("联系信息已加密保存到当前账户。");
        } catch (reason) { messageApi.error(getErrorMessage(reason)); }
      };
      const removeBrowserCredential = async (entry: BrowserVaultEntry): Promise<void> => {
        try {
          await deleteBrowserCredential(entry.id, entry.kind);
          setBrowserCredentials(current => ({
            passwords: current.passwords.filter(item => item.id !== entry.id),
            contacts: current.contacts.filter(item => item.id !== entry.id)
          }));
          messageApi.success("已删除该加密记录。");
        } catch (reason) { messageApi.error(getErrorMessage(reason)); }
      };
      const autofillBrowserCredential = async (entry: BrowserVaultEntry): Promise<void> => {
        try {
          const result = entry.kind === "password"
            ? await autofillBrowserPassword(entry.id, browserVaultProviderId)
            : await autofillBrowserContact(entry.id, browserVaultProviderId);
          messageApi.success(`已在 ${result.origin} 填入${result.filled.join("、")}；未提交表单。`);
        } catch (reason) { messageApi.error(getErrorMessage(reason)); }
      };
      const clearBrowserData = async (): Promise<void> => {
        const nativeBrowser = window.lfaaDesktop?.nativeBrowser;
        const outcomes = await Promise.allSettled([
          clearBrowserSessionData(),
          nativeBrowser ? nativeBrowser.clearData() : Promise.resolve({ cleared: false })
        ]);
        setBrowserHistory([]);
        const failures = outcomes.filter(result => result.status === "rejected");
        if (failures.length) messageApi.error(`部分浏览数据未清除：${getErrorMessage((failures[0] as PromiseRejectedResult).reason)}`);
        else messageApi.success("LFAA 浏览历史、网站数据、缓存与下载历史已清除。");
        if (nativeBrowser) setBrowserDownloadHistory([]);
      };
      const openBrowserDownloads = (): void => {
        setBrowserDownloadHistoryOpen(true);
        void refreshBrowserDownloads();
      };
      const addBrowserSitePermission = (): void => {
        let origin = "";
        try {
          const url = new URL(browserSitePermissionOriginDraft.trim());
          if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) throw new Error("仅支持 HTTP(S) 网站来源。");
          origin = url.origin;
        } catch (reason) {
          messageApi.error(reason instanceof Error ? reason.message : "网站地址无效。");
          return;
        }
        const sitePermissionOverrides = settings.browserUse.sitePermissionOverrides.filter(rule => !(rule.origin === origin && rule.permission === browserSitePermissionDraft));
        sitePermissionOverrides.push({ origin, permission: browserSitePermissionDraft, decision: browserSitePermissionDecisionDraft });
        updateSettings("browserUse", { ...settings.browserUse, sitePermissionOverrides: sitePermissionOverrides.slice(0, 256) });
        setBrowserSitePermissionOriginDraft("");
      };
      const addBrowserWebsiteToolOverride = (): void => {
        let origin = "";
        try {
          const url = new URL(browserWebsiteOriginDraft.trim());
          if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) throw new Error("仅支持 HTTP(S) 网站来源。");
          origin = url.origin;
        } catch (reason) {
          messageApi.error(reason instanceof Error ? reason.message : "网站地址无效。");
          return;
        }
        const websiteToolOverrides = settings.browserUse.websiteToolOverrides.filter(rule => rule.origin !== origin);
        websiteToolOverrides.push({ origin, decision: browserWebsiteDecisionDraft });
        updateSettings("browserUse", { ...settings.browserUse, websiteToolOverrides: websiteToolOverrides.slice(0, 256) });
        setBrowserWebsiteOriginDraft("");
      };
      const toggleBrowserProvider = async (provider: BrowserProviderSummary, linked: boolean): Promise<void> => {
        if (provider.isolation !== "user-profile") return;
        try {
          if (linked) await closeBrowserProviderSessions(provider.id);
          const enabledProviderIds = linked
            ? settings.browserUse.enabledProviderIds.filter(id => id !== provider.id)
            : [...settings.browserUse.enabledProviderIds, provider.id];
          updateSettings("browserUse", { ...settings.browserUse, enabledProviderIds });
        } catch (reason) {
          message.error(getErrorMessage(reason));
        }
      };
      const browserVaultProviders = browserProviders.providers.filter(provider => provider.available && provider.isolation !== "user-profile");
      return <section className="settings-content settings-content--browser" role="tabpanel" id="settings-browser-panel" aria-labelledby="settings-browser-tab" tabIndex={0}>
        <header className="settings-content__heading"><div><Typography.Title level={2}>浏览器</Typography.Title><Typography.Paragraph>管理内置浏览器、Agent Browser Use 偏好与网站访问权限。</Typography.Paragraph></div></header>
        <SettingGroup title="Agent 浏览器控制">
          <SettingRow title="让 Agent 控制浏览器" description="开启后，Agent 可以使用当前 Host 可用的 LFAA 内置浏览器并复用右侧当前页面；无需单独接入内置浏览器。关闭只停用 Agent 工具，你仍可直接操作右侧浏览器。" status={settings.browserUse.enabled ? "已开启" : "默认关闭"}>
            <SettingsSwitch label="允许 Agent 使用浏览器" checked={settings.browserUse.enabled} onChange={() => updateSettings("browserUse", { ...settings.browserUse, enabled: !settings.browserUse.enabled })} />
          </SettingRow>
          <SettingRow title="Agent 操作权限" description="浏览器点击、输入和导航统一遵循此权限模式；不为浏览器另设站点白名单或审批规则。" status={settings.permissions.mode === "ask" ? "请求审批" : settings.permissions.mode === "approve_remembered" ? "替我审批" : "完全访问"}><Button onClick={() => selectSection("permissions")}>管理权限模式</Button></SettingRow>
        </SettingGroup>
        <SettingGroup title="Agent 打开位置">
          <SettingRow title="网页 URL 和链接打开位置" description={`控制 Agent 打开公开网站时使用的浏览器。选择当前已打开的浏览器，需要本机 Windows Host 提供电脑操控，并由 Agent 按权限操作可见窗口、保留 LFAA 工作台标签。${settings.computerControl.enabled ? "电脑操控已开启。" : "当前电脑操控关闭；此选项不会替你开启它。"}`} status={settings.browserUse.webUrlOpenLocation === "current-browser" ? "当前已打开的浏览器" : "LFAA 内置浏览器"}>
            <Select value={settings.browserUse.webUrlOpenLocation} options={[{ value: "lfaa", label: "LFAA 内置浏览器" }, { value: "current-browser", label: "当前已打开的浏览器" }]} onChange={(webUrlOpenLocation: UserSettings["browserUse"]["webUrlOpenLocation"]) => updateSettings("browserUse", { ...settings.browserUse, webUrlOpenLocation })} />
          </SettingRow>
          <SettingRow title="本地开发站点默认打开位置" description={`控制 Agent 打开 localhost/loopback 开发 URL 时使用的浏览器。${settings.computerControl.enabled ? "电脑操控已开启；当前浏览器选择可用本机可见窗口。" : "当前浏览器选项需要先启用设置中心的电脑操控；该选择不会替你开启电脑操控。"} 工作区 HTML/HTM 文件仍由 LFAA 受限预览器打开。`} status={settings.browserUse.localUrlOpenLocation === "current-browser" ? "当前已打开的浏览器" : "LFAA 内置浏览器"}>
            <Select value={settings.browserUse.localUrlOpenLocation} options={[{ value: "lfaa", label: "LFAA 内置浏览器" }, { value: "current-browser", label: "当前已打开的浏览器" }]} onChange={(localUrlOpenLocation: UserSettings["browserUse"]["localUrlOpenLocation"]) => updateSettings("browserUse", { ...settings.browserUse, localUrlOpenLocation })} />
          </SettingRow>
        </SettingGroup>
        <SettingGroup title="内置浏览器与个人浏览器">
          {browserProviders.status === "loading" && browserProviders.providers.length === 0 ? <SettingRow title="正在检查浏览器" description="只检查 Host 支持和浏览器启动器，不读取个人 Profile、标签或登录状态。" status="检查中"><Tag>检查中</Tag></SettingRow> : null}
          {browserProviders.status === "error" ? <Alert type="error" showIcon message="无法读取浏览器 Host 状态" description={browserProviders.error} /> : null}
          {browserProviders.status === "ready" && browserProviders.providers.length === 0 ? <SettingRow title="当前 Host 未提供本机浏览器" description="本机 Web/Desktop Host 装配隔离浏览器；远程 Web Host 不具备这项本机能力。" status="不可用"><Tag>不可用</Tag></SettingRow> : null}
          {browserProviders.providers.map(provider => {
            const builtIn = provider.isolation !== "user-profile";
            const linked = builtIn || settings.browserUse.enabledProviderIds.includes(provider.id);
            const personalControlMissing = provider.isolation === "user-profile" && !settings.computerControl.enabled;
            const description = provider.isolation === "app-session"
              ? "Electron 桌面端的内置网页在右侧浏览器区域运行。Agent 浏览器控制开启后会自动复用当前选中标签；不需要额外接入。登录、站点授权和验证码由你在页面中完成。"
              : provider.isolation === "new-profile"
                ? "LFAA 自动使用当前 Host 可用的隔离浏览器，并按账户和会话共享当前页面；不读取系统浏览器 Cookie 或个人 Profile。"
                : "接入后可在工作区显式查看并选择 Tabbit 标签；不会自动读取标签、登录状态或历史记录。个人会话还要求开启电脑操控并由本轮用户目标明确指定。";
            const providerStatus = !provider.available ? "当前 Host 不可用" : personalControlMissing ? "需启用电脑操控" : builtIn ? "LFAA 内置" : linked ? "已接入 LFAA" : "未接入";
            return <SettingRow key={provider.id} title={provider.name} description={description} status={providerStatus}>
              {builtIn ? <Tag>{provider.available ? "随 LFAA 内置" : "当前 Host 不可用"}</Tag> : !linked && personalControlMissing ? <Button onClick={() => selectSection("computerControl")}>前往电脑操控设置</Button> : <SettingsSwitch label={linked ? "断开" : "接入"} checked={linked} disabled={!provider.available} onChange={() => void toggleBrowserProvider(provider, linked)} />}
            </SettingRow>;
          })}
        </SettingGroup>
        <SettingGroup title="地址栏">
          <SettingRow title="默认搜索引擎" description="地址栏输入普通文字时使用；明确输入 HTTP(S) 网址仍直接导航。此选择由账户设置保存，并在桌面原生浏览器和 Web 浏览器工作区共用。" status={settings.browserUse.searchEngine === "google" ? "Google" : settings.browserUse.searchEngine === "duckduckgo" ? "DuckDuckGo" : "Bing"}>
            <Select value={settings.browserUse.searchEngine} options={[{ value: "bing", label: "Bing" }, { value: "google", label: "Google" }, { value: "duckduckgo", label: "DuckDuckGo" }]} onChange={(searchEngine: UserSettings["browserUse"]["searchEngine"]) => updateSettings("browserUse", { ...settings.browserUse, searchEngine })} />
          </SettingRow>
          <SettingRow title="显示完整网址" description="开启后在 Browser Dock 地址栏展示路径、查询参数和片段；关闭时地址栏只显示站点来源，实际导航地址和 JSON 数据保持完整。" status={settings.browserUse.showFullUrl ? "完整地址" : "仅显示站点"}>
            <SettingsSwitch label="显示完整网址" checked={settings.browserUse.showFullUrl} onChange={() => updateSettings("browserUse", { ...settings.browserUse, showFullUrl: !settings.browserUse.showFullUrl })} />
          </SettingRow>
        </SettingGroup>
        <SettingGroup title="浏览数据">
          <SettingRow title="记录最近访问的网站" description="按账户记录 LFAA 浏览器和 Agent 实际访问的网站；查询参数、片段、页面正文和表单内容不会保存，也不读取系统个人浏览器历史。关闭后停止新增记录，并隐藏已有记录。" status={settings.browserUse.recordRecentSites ? "已开启" : "已关闭"}>
            <SettingsSwitch label="记录最近访问的网站" checked={settings.browserUse.recordRecentSites} onChange={() => updateSettings("browserUse", { ...settings.browserUse, recordRecentSites: !settings.browserUse.recordRecentSites })} />
          </SettingRow>
          <SettingRow title="浏览历史" description="查看或管理 LFAA 内置浏览器与 Agent 最近访问的站点；只保存来源和路径，不包含查询参数、页面正文或表单内容。" status={settings.browserUse.recordRecentSites ? "最多 50 条" : "记录已关闭"}>
            <Button disabled={!settings.browserUse.recordRecentSites} onClick={openBrowserHistory}>管理</Button>
          </SettingRow>
          <SettingRow title="清除浏览历史" description="删除当前账户保存的 LFAA 浏览历史；不会触碰系统 Edge/Chrome 个人资料。" status="账户范围">
            <Popconfirm title="清除当前账户的最近网站记录？" description="此操作会移除 LFAA Browser Dock 与 Agent 保存的网站条目。" okText="清除记录" cancelText="取消" onConfirm={() => void clearBrowserHistory()}><Button>清除记录</Button></Popconfirm>
          </SettingRow>
          <SettingRow title="浏览数据" description="清除 LFAA 浏览历史、原生浏览器网站存储、缓存与下载历史。不会修改系统浏览器个人资料或保存在设置中的密码、联系人及站点权限例外。" status={window.lfaaDesktop?.nativeBrowser ? "LFAA 范围" : "历史可清除"}>
            <Popconfirm title="清除 LFAA 浏览数据？" description="最近网站记录、网站数据、缓存和下载历史将被删除。" okText="清除数据" cancelText="取消" onConfirm={() => void clearBrowserData()}><Button danger>清除数据</Button></Popconfirm>
          </SettingRow>
        </SettingGroup>
        <SettingGroup title="批注截图">
          <SettingRow title="发送页面截图供 Agent 理解" description="截图仅作为当前浏览器工具调用中的临时视觉输入，不写入历史或会话。始终包含可能增加图像处理用量；按需包含由 Agent 根据任务显式请求。" status={settings.browserUse.annotateScreenshots === "always" ? "始终包含" : settings.browserUse.annotateScreenshots === "never" ? "从不包含" : "按需包含"}>
            <Select value={settings.browserUse.annotateScreenshots} options={[{ value: "always", label: "始终包含" }, { value: "on-demand", label: "按需包含" }, { value: "never", label: "从不包含" }]} onChange={(annotateScreenshots: UserSettings["browserUse"]["annotateScreenshots"]) => updateSettings("browserUse", { ...settings.browserUse, annotateScreenshots })} />
          </SettingRow>
        </SettingGroup>
        <SettingGroup title="自动填充和密码">
          <SettingRow title="密码管理器" description="网站密码使用账户凭据 Owner 加密保存；列表不会返回密码内容。填入前校验当前页面来源，只填入用户名/密码字段且不会提交表单。" status={browserCredentialsLoaded ? `${browserCredentials.passwords.length} 个加密条目` : "账户加密库"}>
            <Button onClick={() => openBrowserCredentialManager("passwords")}>管理</Button>
          </SettingRow>
          <SettingRow title="联系信息" description="加密保存姓名、地址、电话和邮箱；仅在你点击填入后，写入当前 LFAA 浏览器页面的唯一标准字段，不提交表单。" status={browserCredentialsLoaded ? `${browserCredentials.contacts.length} 个加密条目` : "账户加密库"}>
            <Button onClick={() => openBrowserCredentialManager("contacts")}>管理</Button>
          </SettingRow>
        </SettingGroup>
        <SettingGroup title="扩展程序">
          <SettingRow title="扩展程序管理器" description="管理 LFAA Electron 内置浏览器中的已解压扩展；安装前会显示权限提示。Electron 仅支持 Chromium 扩展 API 子集。" status={window.lfaaDesktop?.nativeBrowser ? `${browserExtensions.length} 个扩展` : "当前 Web Host 不支持"}>
            <Button disabled={!window.lfaaDesktop?.nativeBrowser} onClick={openBrowserExtensions}>管理</Button>
          </SettingRow>
        </SettingGroup>
        <SettingGroup title="浏览器权限">
          <SettingRow title="Agent 可访问浏览历史" description="允许 Agent 在当前任务确有需要时读取最近 20 条 LFAA 浏览历史；仍受统一权限模式控制，不访问个人浏览器历史。" status={settings.browserUse.allowAgentHistoryAccess ? "已允许" : "默认关闭"}>
            <SettingsSwitch label="允许 Agent 读取浏览历史" checked={settings.browserUse.allowAgentHistoryAccess} onChange={() => updateSettings("browserUse", { ...settings.browserUse, allowAgentHistoryAccess: !settings.browserUse.allowAgentHistoryAccess })} />
          </SettingRow>
          <SettingRow title="默认使用网站工具" description="允许 Agent 发现当前页面通过 WebMCP document.modelContext 公开的同源工具。网站工具说明与结果是不可信内容，执行仍经过统一 Permission Owner。" status={settings.browserUse.useWebsiteToolsByDefault ? "已开启" : "默认关闭"}>
            <Space><Button onClick={() => setBrowserWebsiteToolsOpen(true)}>网站例外</Button><SettingsSwitch label="允许发现网站工具" checked={settings.browserUse.useWebsiteToolsByDefault} onChange={() => updateSettings("browserUse", { ...settings.browserUse, useWebsiteToolsByDefault: !settings.browserUse.useWebsiteToolsByDefault })} /></Space>
          </SettingRow>
          {([ ["camera", "摄像头"], ["microphone", "麦克风"], ["geolocation", "位置信息"], ["notifications", "通知"] ] as const).map(([permission, label]) => (
            <SettingRow key={permission} title={`${label}默认权限`} description="适用于 LFAA 原生浏览器；网站单独设置的例外优先。询问时由桌面 Host 显示来源明确的权限提示。" status={settings.browserUse.sitePermissionDefaults[permission] === "allow" ? "允许" : settings.browserUse.sitePermissionDefaults[permission] === "block" ? "拒绝" : "每次询问"}>
              <Select value={settings.browserUse.sitePermissionDefaults[permission]} options={[{ value: "ask", label: "每次询问" }, { value: "allow", label: "允许" }, { value: "block", label: "拒绝" }]} onChange={(decision: "ask" | "allow" | "block") => updateSettings("browserUse", { ...settings.browserUse, sitePermissionDefaults: { ...settings.browserUse.sitePermissionDefaults, [permission]: decision } })} />
            </SettingRow>
          ))}
          <SettingRow title="网站设置" description="按来源单独允许或拒绝摄像头、麦克风、位置信息和通知。仅保存 HTTP(S) 来源，不保存路径或查询参数。" status={`${settings.browserUse.sitePermissionOverrides.length} 项自定义例外`}>
            <Button onClick={() => setBrowserSitePermissionsOpen(true)}>管理</Button>
          </SettingRow>
        </SettingGroup>
        <Modal
          className="settings-browser-modal"
          title="浏览历史"
          open={browserHistoryOpen}
          onCancel={() => setBrowserHistoryOpen(false)}
          footer={<Space><Popconfirm title="清除当前账户的全部浏览历史？" okText="清除" cancelText="取消" onConfirm={() => void clearBrowserHistory()}><Button danger disabled={browserHistory.length === 0}>清除全部</Button></Popconfirm><Button type="primary" onClick={() => setBrowserHistoryOpen(false)}>完成</Button></Space>}
          width="min(560px, calc(100vw - 32px))"
        >
          {browserHistoryLoading ? <Typography.Text type="secondary">正在读取浏览历史…</Typography.Text>
            : browserHistory.length === 0 ? <Typography.Text type="secondary">暂无浏览历史。</Typography.Text>
              : <div className="settings-browser-history__list">{browserHistory.map(site => <div className="settings-browser-history__item" key={site.url}>
                <div className="settings-browser-history__details"><Typography.Text ellipsis title={site.url}>{site.url}</Typography.Text><Typography.Text type="secondary">{new Date(site.visitedAt).toLocaleString("zh-CN")}</Typography.Text></div>
                <Button aria-label={`删除 ${site.url}`} loading={browserHistoryDeletingUrl === site.url} onClick={() => void removeBrowserHistoryItem(site.url)}>删除</Button>
              </div>)}</div>}
        </Modal>
        <Modal
          className="settings-browser-modal"
          title="密码管理器"
          open={browserCredentialsOpen === "passwords"}
          onCancel={() => setBrowserCredentialsOpen(null)}
          footer={<Button type="primary" onClick={() => setBrowserCredentialsOpen(null)}>完成</Button>}
          width="min(680px, calc(100vw - 32px))"
        >
          <div className="settings-browser-credentials__form">
            <Typography.Text type="secondary">密码由账户凭据 Owner 加密保存，不会返回列表、普通设置或 Agent 上下文。自动填入只匹配保存来源，并且不会提交表单。</Typography.Text>
            <Input aria-label="密码条目名称" autoComplete="off" value={browserPasswordDraft.title} placeholder="条目名称，例如 工作账号" onChange={event => setBrowserPasswordDraft(current => ({ ...current, title: event.target.value }))} />
            <Input aria-label="密码网站来源" autoComplete="off" value={browserPasswordDraft.origin} placeholder="网站来源，例如 https://example.com" onChange={event => setBrowserPasswordDraft(current => ({ ...current, origin: event.target.value }))} />
            <Input aria-label="保存用户名" autoComplete="off" value={browserPasswordDraft.username} placeholder="用户名或邮箱" onChange={event => setBrowserPasswordDraft(current => ({ ...current, username: event.target.value }))} />
            <Input.Password aria-label="保存网站密码" autoComplete="new-password" value={browserPasswordDraft.password} placeholder="网站密码" onChange={event => setBrowserPasswordDraft(current => ({ ...current, password: event.target.value }))} />
            <Button type="primary" disabled={!browserPasswordDraft.title.trim() || !browserPasswordDraft.origin.trim() || !browserPasswordDraft.username.trim() || !browserPasswordDraft.password} onClick={() => void createBrowserPassword()}>加密保存</Button>
            <div className="settings-browser-credentials__provider">
              <Typography.Text type="secondary">填入页面</Typography.Text>
              <Select aria-label="密码填入目标浏览器" value={browserVaultProviderId} options={browserVaultProviders.map(provider => ({ value: provider.id, label: provider.name }))} disabled={browserVaultProviders.length === 0} onChange={setBrowserVaultProviderId} />
            </div>
            {browserCredentialsLoading ? <Typography.Text type="secondary">正在读取加密记录…</Typography.Text>
              : browserCredentials.passwords.length === 0 ? <Typography.Text type="secondary">暂无已保存密码。</Typography.Text>
                : <div className="settings-browser-history__list">{browserCredentials.passwords.map(entry => <div className="settings-browser-history__item" key={entry.id}>
                  <div className="settings-browser-history__details"><Typography.Text ellipsis title={entry.title}>{entry.title}</Typography.Text><Typography.Text type="secondary">{entry.origin} · {entry.username}</Typography.Text></div>
                  <Space><Button disabled={browserVaultProviders.length === 0} onClick={() => void autofillBrowserCredential(entry)}>填入</Button><Popconfirm title={`删除“${entry.title}”的加密密码？`} okText="删除" cancelText="取消" onConfirm={() => void removeBrowserCredential(entry)}><Button danger>删除</Button></Popconfirm></Space>
                </div>)}</div>}
          </div>
        </Modal>
        <Modal
          className="settings-browser-modal"
          title="联系信息"
          open={browserCredentialsOpen === "contacts"}
          onCancel={() => setBrowserCredentialsOpen(null)}
          footer={<Button type="primary" onClick={() => setBrowserCredentialsOpen(null)}>完成</Button>}
          width="min(680px, calc(100vw - 32px))"
        >
          <div className="settings-browser-credentials__form">
            <Typography.Text type="secondary">姓名、地址、电话和邮箱使用账户凭据 Owner 加密保存。填入当前浏览器页面时只匹配唯一标准字段，不会提交表单。</Typography.Text>
            <Input aria-label="联系信息名称" autoComplete="off" value={browserContactDraft.title} placeholder="条目名称，例如 家庭地址" onChange={event => setBrowserContactDraft(current => ({ ...current, title: event.target.value }))} />
            <Input aria-label="联系人姓名" autoComplete="name" value={browserContactDraft.name} placeholder="姓名" onChange={event => setBrowserContactDraft(current => ({ ...current, name: event.target.value }))} />
            <Input aria-label="联系地址" autoComplete="street-address" value={browserContactDraft.address} placeholder="地址" onChange={event => setBrowserContactDraft(current => ({ ...current, address: event.target.value }))} />
            <Input aria-label="联系邮箱" autoComplete="email" value={browserContactDraft.email} placeholder="电子邮箱" onChange={event => setBrowserContactDraft(current => ({ ...current, email: event.target.value }))} />
            <Input aria-label="联系电话" autoComplete="tel" value={browserContactDraft.phone} placeholder="电话号码" onChange={event => setBrowserContactDraft(current => ({ ...current, phone: event.target.value }))} />
            <Button type="primary" disabled={!browserContactDraft.title.trim() || ![browserContactDraft.name, browserContactDraft.address, browserContactDraft.email, browserContactDraft.phone].some(value => value.trim())} onClick={() => void createBrowserContact()}>加密保存</Button>
            <div className="settings-browser-credentials__provider">
              <Typography.Text type="secondary">填入页面</Typography.Text>
              <Select aria-label="联系信息填入目标浏览器" value={browserVaultProviderId} options={browserVaultProviders.map(provider => ({ value: provider.id, label: provider.name }))} disabled={browserVaultProviders.length === 0} onChange={setBrowserVaultProviderId} />
            </div>
            {browserCredentialsLoading ? <Typography.Text type="secondary">正在读取加密记录…</Typography.Text>
              : browserCredentials.contacts.length === 0 ? <Typography.Text type="secondary">暂无已保存联系信息。</Typography.Text>
                : <div className="settings-browser-history__list">{browserCredentials.contacts.map(entry => <div className="settings-browser-history__item" key={entry.id}>
                  <div className="settings-browser-history__details"><Typography.Text ellipsis title={entry.title}>{entry.title}</Typography.Text><Typography.Text type="secondary">{[entry.email, entry.phone].filter(Boolean).join(" · ") || "已加密保存"}</Typography.Text></div>
                  <Space><Button disabled={browserVaultProviders.length === 0} onClick={() => void autofillBrowserCredential(entry)}>填入</Button><Popconfirm title={`删除“${entry.title}”的加密联系信息？`} okText="删除" cancelText="取消" onConfirm={() => void removeBrowserCredential(entry)}><Button danger>删除</Button></Popconfirm></Space>
                </div>)}</div>}
          </div>
        </Modal>
        <Modal
          className="settings-browser-modal"
          title="扩展程序管理器"
          open={browserExtensionsOpen}
          onCancel={() => setBrowserExtensionsOpen(false)}
          footer={<Space><Button onClick={() => void addBrowserExtension()} loading={browserExtensionsLoading}>添加已解压扩展</Button><Button type="primary" onClick={() => setBrowserExtensionsOpen(false)}>完成</Button></Space>}
          width="min(680px, calc(100vw - 32px))"
        >
          <Typography.Paragraph type="secondary">扩展文件仍由你选择的本机目录管理。LFAA 不从商店下载扩展；Chromium 扩展 API 的支持范围由 Electron 决定。</Typography.Paragraph>
          {browserExtensionsLoading ? <Typography.Text type="secondary">正在读取扩展…</Typography.Text>
            : browserExtensions.length === 0 ? <Typography.Text type="secondary">暂无已安装扩展。</Typography.Text>
              : <div className="settings-browser-history__list">{browserExtensions.map(extension => <div className="settings-browser-history__item" key={extension.id}>
                <div className="settings-browser-history__details"><Typography.Text ellipsis title={extension.name}>{extension.name}</Typography.Text><Typography.Text type="secondary">版本 {extension.version} · {extension.loaded ? "已加载" : "未加载"}</Typography.Text>{extension.warning ? <Typography.Text type="danger">{extension.warning}</Typography.Text> : null}</div>
                <Space wrap>
                  <SettingsSwitch label={`${extension.enabled ? "停用" : "启用"} ${extension.name}`} checked={extension.enabled} onChange={() => void setBrowserExtensionEnabled(extension, !extension.enabled)} />
                  <Button disabled={!extension.enabled || !extension.configurable} onClick={() => void configureBrowserExtension(extension)}>设置</Button>
                  <Popconfirm title={`移除扩展“${extension.name}”？`} description="此操作只会从 LFAA 内置浏览器移除扩展，不会删除你电脑上的扩展文件夹。" okText="移除" cancelText="取消" onConfirm={() => void removeBrowserExtension(extension)}><Button danger>移除</Button></Popconfirm>
                </Space>
              </div>)}</div>}
        </Modal>
        <Modal
          className="settings-browser-modal"
          title="网站设置"
          open={browserSitePermissionsOpen}
          onCancel={() => setBrowserSitePermissionsOpen(false)}
          footer={<Button type="primary" onClick={() => setBrowserSitePermissionsOpen(false)}>完成</Button>}
          width="min(600px, calc(100vw - 32px))"
        >
          <div className="settings-browser-permissions__form">
            <Input aria-label="网站来源" value={browserSitePermissionOriginDraft} maxLength={2048} placeholder="https://example.com" onChange={event => setBrowserSitePermissionOriginDraft(event.target.value)} />
            <Select aria-label="网站权限类型" value={browserSitePermissionDraft} options={[{ value: "camera", label: "摄像头" }, { value: "microphone", label: "麦克风" }, { value: "geolocation", label: "位置信息" }, { value: "notifications", label: "通知" }]} onChange={setBrowserSitePermissionDraft} />
            <Select aria-label="网站权限决定" value={browserSitePermissionDecisionDraft} options={[{ value: "allow", label: "允许" }, { value: "block", label: "拒绝" }]} onChange={setBrowserSitePermissionDecisionDraft} />
            <Button type="primary" disabled={!browserSitePermissionOriginDraft.trim()} onClick={addBrowserSitePermission}>添加</Button>
          </div>
          {settings.browserUse.sitePermissionOverrides.length === 0
            ? <Typography.Paragraph className="settings-browser-permissions__empty" type="secondary">此处只显示你设置过例外的网站。</Typography.Paragraph>
            : <div className="settings-browser-history__list settings-browser-history__list--spaced">{settings.browserUse.sitePermissionOverrides.map(rule => <div className="settings-browser-history__item" key={`${rule.origin}:${rule.permission}`}>
              <div className="settings-browser-history__details"><Typography.Text ellipsis title={rule.origin}>{rule.origin}</Typography.Text><Typography.Text type="secondary">{{ camera: "摄像头", microphone: "麦克风", geolocation: "位置信息", notifications: "通知" }[rule.permission]} · {rule.decision === "allow" ? "允许" : "拒绝"}</Typography.Text></div>
              <Button aria-label={`移除 ${rule.origin} 的${rule.permission}例外`} onClick={() => updateSettings("browserUse", { ...settings.browserUse, sitePermissionOverrides: settings.browserUse.sitePermissionOverrides.filter(item => item !== rule) })}>移除</Button>
            </div>)}</div>}
        </Modal>
        <Modal
          className="settings-browser-modal"
          title="网站工具例外"
          open={browserWebsiteToolsOpen}
          onCancel={() => setBrowserWebsiteToolsOpen(false)}
          footer={<Button type="primary" onClick={() => setBrowserWebsiteToolsOpen(false)}>完成</Button>}
          width="min(600px, calc(100vw - 32px))"
        >
          <div className="settings-browser-permissions__form">
            <Input aria-label="WebMCP 网站来源" value={browserWebsiteOriginDraft} maxLength={2048} placeholder="https://example.com" onChange={event => setBrowserWebsiteOriginDraft(event.target.value)} />
            <Select aria-label="WebMCP 网站决定" value={browserWebsiteDecisionDraft} options={[{ value: "allow", label: "允许" }, { value: "block", label: "拒绝" }]} onChange={setBrowserWebsiteDecisionDraft} />
            <Button type="primary" disabled={!browserWebsiteOriginDraft.trim()} onClick={addBrowserWebsiteToolOverride}>添加</Button>
          </div>
          {settings.browserUse.websiteToolOverrides.length === 0
            ? <Typography.Paragraph className="settings-browser-permissions__empty" type="secondary">全局默认关闭时，允许例外才会提供该网站工具；拒绝例外优先于全局允许。</Typography.Paragraph>
            : <div className="settings-browser-history__list settings-browser-history__list--spaced">{settings.browserUse.websiteToolOverrides.map(rule => <div className="settings-browser-history__item" key={rule.origin}>
              <div className="settings-browser-history__details"><Typography.Text ellipsis title={rule.origin}>{rule.origin}</Typography.Text><Typography.Text type="secondary">WebMCP 工具 · {rule.decision === "allow" ? "允许" : "拒绝"}</Typography.Text></div>
              <Button aria-label={`移除 ${rule.origin} 的 WebMCP 例外`} onClick={() => updateSettings("browserUse", { ...settings.browserUse, websiteToolOverrides: settings.browserUse.websiteToolOverrides.filter(item => item.origin !== rule.origin) })}>移除</Button>
            </div>)}</div>}
        </Modal>
        <Modal
          className="settings-browser-modal"
          title="下载历史记录"
          open={browserDownloadHistoryOpen}
          onCancel={() => setBrowserDownloadHistoryOpen(false)}
          footer={<Space><Popconfirm title="清除全部下载历史？" okText="清除" cancelText="取消" onConfirm={() => void window.lfaaDesktop?.nativeBrowser.clearDownloadHistory().then(() => setBrowserDownloadHistory([])).catch(reason => messageApi.error(getErrorMessage(reason)))}><Button danger disabled={browserDownloadHistory.length === 0}>清除全部</Button></Popconfirm><Button type="primary" onClick={() => setBrowserDownloadHistoryOpen(false)}>完成</Button></Space>}
          width="min(600px, calc(100vw - 32px))"
        >
          {browserDownloadLoading ? <Typography.Text type="secondary">正在读取下载历史…</Typography.Text>
            : browserDownloadHistory.length === 0 ? <Typography.Text type="secondary">暂无下载记录。</Typography.Text>
              : <div className="settings-browser-history__list">{browserDownloadHistory.map(download => <div className="settings-browser-history__item" key={download.id}>
                <div className="settings-browser-history__details"><Typography.Text ellipsis title={download.fileName}>{download.fileName}</Typography.Text><Typography.Text type="secondary">{download.source || "未知来源"} · {download.status === "completed" ? "已完成" : download.status === "in-progress" ? "下载中" : download.status === "cancelled" ? "已取消" : "中断"} · {new Date(download.startedAt).toLocaleString("zh-CN")}</Typography.Text></div>
                <Button aria-label={`删除下载记录 ${download.fileName}`} onClick={() => void window.lfaaDesktop?.nativeBrowser.removeDownloadHistory(download.id).then(result => { if (result.deleted) setBrowserDownloadHistory(current => current.filter(item => item.id !== download.id)); }).catch(reason => messageApi.error(getErrorMessage(reason)))}>删除</Button>
              </div>)}</div>}
        </Modal>
        <SettingGroup title="下载">
          <SettingRow title="位置" description={browserDownloadSettings ? browserDownloadSettings.directory : "下载文件保存到此设备的下载文件夹。自定义位置仅保存在本机 Electron Host。"} status={window.lfaaDesktop?.nativeBrowser ? browserDownloadSettings?.usingSystemDirectory === false ? "自定义文件夹" : "系统下载文件夹" : "当前 Host 不支持"}>
            <Space><Button disabled={!window.lfaaDesktop?.nativeBrowser} onClick={() => void window.lfaaDesktop?.nativeBrowser.chooseDownloadDirectory().then(value => setBrowserDownloadSettings(value)).catch(reason => messageApi.error(getErrorMessage(reason)))}>选择文件夹</Button><Button disabled={!window.lfaaDesktop?.nativeBrowser || browserDownloadSettings?.usingSystemDirectory !== false} onClick={() => void window.lfaaDesktop?.nativeBrowser.useSystemDownloadDirectory().then(value => setBrowserDownloadSettings(value)).catch(reason => messageApi.error(getErrorMessage(reason)))}>使用系统位置</Button></Space>
          </SettingRow>
          <SettingRow title="下载前询问保存位置" description="关闭后直接保存到上方目录；下载仍会保留在本机下载历史中。" status={settings.browserUse.askBeforeDownload ? "每次询问" : "直接保存"}>
            <SettingsSwitch label="下载前询问" checked={settings.browserUse.askBeforeDownload} onChange={() => updateSettings("browserUse", { ...settings.browserUse, askBeforeDownload: !settings.browserUse.askBeforeDownload })} />
          </SettingRow>
          <SettingRow title="下载历史记录" description="查看 LFAA 内置浏览器的下载文件名、来源和状态；不会读取系统浏览器下载记录。" status={window.lfaaDesktop?.nativeBrowser ? "本机保存" : "当前 Host 不支持"}>
            <Button disabled={!window.lfaaDesktop?.nativeBrowser} onClick={openBrowserDownloads}>管理</Button>
          </SettingRow>
        </SettingGroup>
        <SettingGroup title="开发者模式">
          <SettingRow title="开发者模式" description="开启后显示浏览器开发能力。该设置不会自动开放开发者工具或改变统一权限模式。" status={settings.browserUse.developerMode ? "已开启" : "已关闭"}>
            <SettingsSwitch label="开发者模式" checked={settings.browserUse.developerMode} onChange={() => updateSettings("browserUse", { ...settings.browserUse, developerMode: !settings.browserUse.developerMode, fullCdpAccess: settings.browserUse.developerMode ? false : settings.browserUse.fullCdpAccess })} />
          </SettingRow>
          <SettingRow title="完整 CDP 访问权限" description="开放当前页面 CDP target 的全部可用方法，可检查或控制页面并可能接触凭据等敏感数据；不访问其他页面或个人 Profile。仅在开发者模式下开放，每次 Agent 调用仍经过 Permission Owner。" status={settings.browserUse.fullCdpAccess ? "风险升高 · 已开启" : "默认关闭"}>
            <SettingsSwitch label="允许完整 CDP" checked={settings.browserUse.fullCdpAccess} disabled={!settings.browserUse.developerMode} onChange={() => updateSettings("browserUse", { ...settings.browserUse, fullCdpAccess: !settings.browserUse.fullCdpAccess })} />
          </SettingRow>
        </SettingGroup>
        {nativeBrowserPreferencesError ? <Alert type="error" showIcon message="浏览器偏好同步失败" description={nativeBrowserPreferencesError} /> : null}
      </section>;
    }

    const pending = getSettingsCenterMenu(activeSection);
    if (activeSection === "environment") {
      const configuredTaskFolder = settings.general.taskFolder.trim();
      const inheritedTaskFolder = defaultWorkspaceLocation.status === "ready" ? defaultWorkspaceLocation.path : null;
      const taskFolderValue = configuredTaskFolder
        || (defaultWorkspaceLocation.status === "loading" ? "正在读取默认工作区…"
          : defaultWorkspaceLocation.status === "error" ? "默认工作区路径读取失败"
            : inheritedTaskFolder || "默认工作区尚未初始化");
      return (
        <section className="settings-content">
          <header className="settings-content__heading"><div><span className="settings-eyebrow">编码</span><Typography.Title level={2}>环境</Typography.Title><Typography.Paragraph>本机未绑定项目时，文件操作默认使用已登记的默认工作区；填写自定义目录后优先使用它。项目外新聊天也归入默认工作区，会话记录仍保存在 LFAA 数据目录中。</Typography.Paragraph></div></header>
          <SettingGroup title="项目操作目录">
            <SettingRow title="默认任务文件夹" description={configuredTaskFolder ? "本机未绑定项目时使用此自定义目录；节点终端按所选目标应用该路径。聊天存储位置不变。" : "本机未绑定项目时当前使用默认工作区；填写自定义目录后优先使用它。节点终端仍使用节点登记的数据目录；此项不会改变聊天存储位置。"}>
              <div className="settings-folder-value" title={taskFolderValue}><span>{taskFolderValue}</span><Button onClick={() => { setFolderDraft(settings.general.taskFolder); setFolderModalOpen(true); }}>更改</Button></div>
            </SettingRow>
          </SettingGroup>
          <SettingGroup title="运行环境能力">
            <SettingRow title="Daemon 环境扫描" description="扫描当前 Host 已登记的节点运行环境，以供任务选择。" status="待接入"><Tag>Daemon 节点待接入</Tag></SettingRow>
          </SettingGroup>
        </section>
      );
    }

    if (pending?.statusLabel) {
      const selectedSection = sections.find((section) => section.id === activeSection);
      return (
        <section className="settings-content">
          <header className="settings-content__heading"><div><span className="settings-eyebrow">{selectedSection?.group}</span><Typography.Title level={2}>{selectedSection?.title}</Typography.Title><Typography.Paragraph>{pending.description}</Typography.Paragraph></div></header>
          <SettingGroup title="功能状态">
            <SettingRow title={selectedSection?.title ?? "设置模块"} description={pending.description} status="当前版本状态"><Tag>{pending.statusLabel}</Tag></SettingRow>
          </SettingGroup>
          <div className="settings-note-card"><strong>接入说明</strong><p>此入口已保留在设置导航中。相关宿主能力接入后，会在此页提供可实际使用的配置项和运行状态。</p></div>
        </section>
      );
    }

    return (
      <section className="settings-content">
        <header className="settings-content__heading"><div><span className="settings-eyebrow">运行信息</span><Typography.Title level={2}>开发者</Typography.Title><Typography.Paragraph>查看客户端与控制端连接状态。</Typography.Paragraph></div><Button onClick={() => void refreshDeveloperStatus()}>刷新状态</Button></header>
        <SettingGroup title="运行环境">
          <SettingRow title="项目版本" description="LFAA 当前项目版本。" status="当前版本"><Tag>LFAA {lfaaProjectBuildInfo?.currentVersion ?? "未知"}</Tag></SettingRow>
          <SettingRow title="控制端" description={health?.timestamp ? `最近检查：${new Date(health.timestamp).toLocaleString("zh-CN")}` : "尚未获取检查时间。"} status={serverState === "checking" ? "检查中" : health?.status === "ok" ? "运行中" : "未连接"}><Tag color={health?.status === "ok" ? "green" : "red"}>{serverState === "checking" ? "检查中" : health?.status === "ok" ? "在线" : "离线"}</Tag></SettingRow>
          <SettingRow title="当前客户端" description={`${navigator.platform} · ${window.location.origin}`} status="已连接"><Tag>Web 界面</Tag></SettingRow>
        </SettingGroup>
        <div className="settings-note-card"><strong>诊断信息</strong><p>日志、运行时配置编辑和开发工具暂未接入设置中心。仅管理员可查看存储路径；密钥不会显示在诊断信息中。</p></div>
      </section>
    );
  })();

  const sidebar = (
    <aside className="settings-sidebar">
        <header className="settings-sidebar__header"><Typography.Title level={4}>设置</Typography.Title></header>
        <form className="settings-search-form" role="search" autoComplete="off" onSubmit={(event) => event.preventDefault()}>
          <Input type="search" name="settings-category-search" autoComplete="off" allowClear placeholder="搜索设置" value={search} onChange={(event) => updateSettingsSearch(event.target.value)} aria-label="搜索设置分类" />
        </form>
        <SecondaryNavigation
          scrollRef={settingsNavigationScroll.ref}
          onScroll={settingsNavigationScroll.onScroll}
          ariaLabel="设置分类"
          emptyState={visibleSections.length === 0 ? <p className="settings-empty-search">没有匹配的设置分类。</p> : null}
          groups={[...new Set(visibleSections.map((item) => item.group))].map((group, index) => {
            const groupId = `settings-nav-items-${index}`;
            const groupSections = visibleSections.filter((item) => item.group === group);
            const isExpanded = (search.trim() ? searchExpandedSettingsGroups : expandedSettingsGroups).has(group);
            return {
              id: groupId,
              label: group,
              expanded: isExpanded,
              onToggle: () => toggleSettingsGroup(group),
              items: groupSections.map((item) => {
                const isConfigurationCenterEntry = item.group === "LFAA 配置" && item.title === "配置中心";
                const active = isConfigurationCenterEntry
                  ? LFAA_CONFIGURATION_SECTION_IDS.has(activeSection)
                  : (item.id === "account" && isAccountSettingsSection(activeSection)) || activeSection === item.id;
                return { id: item.id, label: item.title, icon: item.icon, active, onSelect: () => selectSection(item.id) };
              })
            };
          })}
        />
        <div className="settings-sidebar__account"><span className="settings-avatar">{user.username.slice(0, 1).toLocaleUpperCase()}</span><span><strong>{user.username}</strong><small>{userRoleLabel(user.role)}</small></span></div>
    </aside>
  );
  const activeError = (providerModalOpen ? undefined : error) || sectionErrors[activeSection] || (activeSettingsCategory ? settingsSaveErrors[activeSettingsCategory] : undefined);
  const main = (
    <div className="settings-main">
      <header className={`settings-toolbar${activeSection === "workspace" ? " settings-toolbar--storage" : ""}`}>
        <div className="settings-toolbar__start">
          {sidebarCollapsed ? <Button className="settings-sidebar-open" aria-label="展开设置导航" onClick={() => setSidebarCollapsed(false)}>☰ 设置菜单</Button> : <>
            <Button className="settings-toolbar__back" type="text" onClick={onBack}>← 返回工作区</Button>
            <Button className="settings-toolbar__collapse" type="text" aria-label="收起设置导航" title="收起设置导航" onClick={() => setSidebarCollapsed(true)}>×</Button>
          </>}
        </div>
        <div className="settings-toolbar__status"><small>{activeSection === "workspace" ? "本页配置由各区块单独保存" : "更新会自动保存"}</small></div>
        <div className="settings-toolbar__actions">
          {activeSection !== "workspace" ? <Button disabled={!activeSettingsCategory || saving !== null} onClick={resetActiveSettings}>恢复默认</Button> : null}
          <Button type="primary" loading={saving === "toolbar"} disabled={saving !== null} onClick={() => void persistToolbarSettingsNow()}>{activeSection === "workspace" ? "保存待处理偏好" : "立即保存"}</Button>
        </div>
      </header>
      <main ref={settingsContentScroll.ref} className="settings-main__content" onScroll={settingsContentScroll.onScroll}>
        {activeError ? <Alert className="settings-page-alert" type="error" showIcon message={activeError} closable onClose={() => { setError(""); setSectionErrors((current) => ({ ...current, [activeSection]: undefined })); }} /> : null}
        {LFAA_CONFIGURATION_SECTION_IDS.has(activeSection) ? <nav className="settings-configuration-nav" aria-label="LFAA 配置中心">
          {LFAA_CONFIGURATION_SECTIONS.map((section) => <button key={section.id} type="button" aria-current={activeSection === section.id ? "page" : undefined} className={activeSection === section.id ? "is-active" : ""} onClick={() => selectSection(section.id)}>
            <WorkbenchIcon name={section.icon} size={16} />
            <span>{section.title}</span>
          </button>)}
        </nav> : null}
        {loadingSection === activeSection ? <div className="settings-loading"><span className="loading-indicator" /><span>正在读取设置…</span></div> : sectionContent}
      </main>
    </div>
  );

  return (
    <div className={`settings-page${standalonePluginWorkspace ? " settings-page--plugin-standalone" : ""}`} aria-label={standalonePluginWorkspace ? "插件扩展与运行管理" : "设置中心"}>
      {messageContext}
      {permissionModalContext}
      {standalonePluginWorkspace ? <div ref={rootRef} className="settings-plugin-standalone">
        <main ref={standaloneWorkspaceContent ? undefined : settingsContentScroll.ref} className={`settings-plugin-standalone__content${standaloneWorkspaceContent ? " settings-plugin-standalone__content--workspace" : ""}`} onScroll={standaloneWorkspaceContent ? undefined : settingsContentScroll.onScroll}>
          {activeError ? <Alert className="settings-page-alert" type="error" showIcon message={activeError} closable onClose={() => { setError(""); setSectionErrors((current) => ({ ...current, [activeSection]: undefined })); }} /> : null}
          {loadingSection === activeSection ? <div className="settings-loading"><span className="loading-indicator" /><span>正在读取插件配置…</span></div> : sectionContent}
        </main>
      </div> : <div ref={rootRef} className="settings-page__stage">
        <GlobalNavigationRail
          secondaryNavigationMinWidth={layout.left.min}
          username={user.username}
          role={user.role}
          serverState={serverState}
          shortcuts={settings.shortcuts}
          activePage="settings"
          applications={applications}
          navigationApplications={navigationApplications}
          showServiceStatus={settings.general.showServiceStatus}
          onNavigate={onNavigate}
          onOpenApplication={onOpenApplication}
          onOpenRecentSessions={onOpenRecentSessions}
          onToggleApplications={onOpenApplications ?? (() => onNavigate("/work"))}
          onOpenFiles={() => { setFileManagerLocation(user.id, ""); onNavigate("/files"); }}
          onOpenSettings={onOpenSettings}
          onLogout={onLogout}
        />
        <ResizableWorkbench
          leftRegionClassName="settings-page__navigation-region"
          centerRegionClassName="settings-page__main-region"
          storageKey={SETTINGS_LAYOUT_KEY}
          containerWidth={layout.containerWidth}
          left={sidebar}
          center={main}
          leftLimits={layout.left}
          leftWidth={sidebarWidth}
          onLeftWidthChange={setSidebarWidth}
          rightLimits={layout.right}
          bottomLimits={layout.bottom}
          snapCaptureRatio={layout.snapCaptureRatio}
          snapHysteresis={layout.snapHysteresis}
          minCenterWidth={layout.minCenterWidth}
          leftCollapsed={sidebarCollapsed}
          onLeftCollapsedChange={setSidebarCollapsed}
          rightCollapsed
          bottomOpen={false}
          layoutMode={layout.mode}
        />
      </div>}
      {settingsSaveFeedback ? <div key={settingsSaveFeedback.id} className="settings-save-feedback" role={settingsSaveFeedback.status === "success" ? "status" : "alert"} aria-live={settingsSaveFeedback.status === "success" ? "polite" : "assertive"} aria-atomic="true">
        <div className={`settings-save-feedback__card settings-save-feedback__card--${settingsSaveFeedback.status}`}>
          <span className="settings-save-feedback__icon"><WorkbenchIcon name={settingsSaveFeedback.status === "success" ? "review" : "close"} size={19} /></span>
          <span className="settings-save-feedback__copy"><strong>{settingsSaveFeedback.status === "success" ? "保存成功" : "保存未成功"}</strong><span>{settingsSaveFeedback.message}</span></span>
        </div>
      </div> : null}
      <Modal title="默认任务文件夹" open={folderModalOpen} okText="保存路径" cancelText="取消" onCancel={() => setFolderModalOpen(false)} onOk={() => { updateGeneral({ taskFolder: folderDraft.trim() }); setFolderModalOpen(false); }}>
        <Typography.Paragraph type="secondary">留空时，本机未绑定项目的文件操作使用默认工作区{defaultWorkspaceLocation.path ? `（${defaultWorkspaceLocation.path}）` : ""}；节点终端回退到节点登记的数据目录。填写自定义路径后，按所选执行目标应用该路径。Web 端不会通过此路径访问本机文件。</Typography.Paragraph>
        <Input autoFocus maxLength={512} value={folderDraft} onChange={(event) => setFolderDraft(event.target.value)} placeholder={defaultWorkspaceLocation.path || "留空以继承默认工作区"} />
      </Modal>
      <Modal title="开源许可证" open={licensesModalOpen} footer={<Button onClick={() => setLicensesModalOpen(false)}>关闭</Button>} onCancel={() => setLicensesModalOpen(false)}>
        <Typography.Paragraph type="secondary">以下为 LFAA 前端直接运行依赖的许可证信息；完整依赖锁定记录位于仓库根目录 pnpm-lock.yaml。</Typography.Paragraph>
        <ul className="settings-license-list">
          <li><a href="https://github.com/ant-design/ant-design/blob/master/LICENSE" target="_blank" rel="noreferrer">Ant Design 5 · MIT</a></li>
          <li><a href="https://github.com/facebook/react/blob/main/LICENSE" target="_blank" rel="noreferrer">React 18 · MIT</a></li>
          <li><a href="https://github.com/facebook/react/blob/main/LICENSE" target="_blank" rel="noreferrer">React DOM 18 · MIT</a></li>
        </ul>
      </Modal>
    </div>
  );
}
