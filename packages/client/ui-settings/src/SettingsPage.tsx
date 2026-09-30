/** 功能：呈现现有设置中心。作用：消费已保存设置并组合能力包界面。关联文件：client/connection、ui-settings、ui-theme、ui-commands。 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { Alert, Button, Card, Input, InputNumber, Modal, Popconfirm, Progress, Radio, Select, Slider, Space, Tag, Typography, message } from "antd";
import { activateAiAccount, cancelDataDirectorySettingsChange, changeCurrentPassword, createSteamcmdTask, deleteAppearanceBackground, deleteAiAccount, archiveAiSession, decideAiApproval, getErrorMessage, hasAdminAccess, isDesktopApp, loadAiAccounts, loadAiApprovals, loadAiPermissionGrants, loadAiExtensions, loadAiSessions, loadAiUsage, loadAppearanceBackgrounds, loadAiProviders, loadHealth, loadDataDirectorySettings, loadMinecraftStorageSettings, loadSteamcmdSettings, loadSteamcmdTask, manageAiRuntimePlugin, probeAiProvider, reprobeAiAccount, saveAiAccount, testAiProviderModel, saveRecoveryKey, saveSettings, saveSteamcmdConfigurationDefaults, saveSteamcmdNodeConfiguration, saveSteamcmdNodeStorageSettings, saveSteamcmdStorageDefaults, saveMinecraftNodeStorageSettings, saveMinecraftStorageDefaults, saveDataDirectorySettings, selectDesktopDataDirectory, revokeAiPermissionGrant, uploadAppearanceBackground, updateCurrentUserEmail, userRoleLabel, updateAiAccountModel, updateAiAccountReasoningMode, type AiModelTestResult, type AiAccount, type AiExtension, type AiRuntimeHookInfo, type AiProvider, type AiProviderProbe, type AiRuntimePlugin, type AiSession, type AiUsageSummary, type AiToolApproval, type AiToolPermissionGrant, type AppearanceBackground, type DataDirectorySettings, type ServerHealth, type MinecraftStorageNode, type MinecraftStorageSettings, type SteamcmdConfigurationValues, type SteamcmdSettingsNode, type SteamcmdStorageValues, type SteamcmdTask, type User, type UserSettings } from "lfaa-client-connection/src/api.js";
import { minecraftSceneBackgrounds } from "lfaa-client-ui-minecraft/src/assets/minecraftScenes.js";
import { cacheLoginBackground } from "lfaa-client-ui-theme/src/login-background.js";
import { getBrowserNotificationPermission, playNotificationSound, requestBrowserNotificationPermission, sendBrowserNotification, type BrowserNotificationPermission } from "lfaa-client-resources/src/notification-runtime.js";
import { createScrollRestorationKey, useScrollRestoration } from "lfaa-client-store/src/scroll-restoration.js";
import { clearSetupReminderSnooze, getSetupReminderLocalDay, isSetupReminderSnoozedToday, setSetupReminderSnoozedToday } from "lfaa-client-ui-settings-general/src/setup-reminder.js";
import { ResizableWorkbench } from "lfaa-client-ui-dockkit/src/ResizableWorkbench.js";
import { resolveWorkbenchLayoutMetrics, type WorkbenchLayoutMetrics } from "lfaa-client-ui-dockkit/src/workbench-layout.config.js";
import { readWorkbenchLeftWidth, saveWorkbenchLeftWidth } from "lfaa-client-ui-dockkit/src/workbench-preferences.js";
import { WorkbenchIcon, type WorkbenchIconName } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { isPasswordAcceptable, PasswordStrengthIndicator } from "lfaa-client-ui-settings-account/src/PasswordStrengthIndicator.js";
import { AdminUsersPage } from "lfaa-client-ui-settings-account/src/AdminUsersPage.js";
import { GLOBAL_NAVIGATION_RAIL_COMPACT_WIDTH, GLOBAL_NAVIGATION_RAIL_WIDTH, GlobalNavigationRail } from "lfaa-client-ui-sidebar/src/GlobalNavigationRail.js";
import { PasskeyManager } from "lfaa-client-ui-settings-account/src/PasskeyManager.js";
import "./SettingsPage.css";
import { hasShortcutConflicts, ShortcutRow } from "lfaa-client-ui-shortcuts/src/settings-shortcuts.js";
import { reasoningOptions, modelParameterSummary, modelOptionLabel, fixedThinkingLabel } from "lfaa-client-ui-settings-models/src/model-options.js";
import { DEFAULT_USER_SETTINGS } from "lfaa-client-ui-settings-general/src/default-settings.js";
import { SettingGroup, AdvancedGroup, SettingRow, SettingsSwitch, SettingsActions } from "lfaa-client-ui-primitives/src/settings-controls.js";





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



type SectionId = "general" | "notifications" | "import" | "profile" | "security" | "appearance" | "parental" | "trustedContacts" | "voice" | "configuration" | "personalization" | "mini" | "shortcuts" | "usage" | "account" | "plugins" | "computerControl" | "snapshots" | "browser" | "hooks" | "connections" | "cloudPreferences" | "codeReview" | "git" | "environment" | "worktrees" | "archived" | "ai" | "permissions" | "workspace" | "developer";
// 只在进入需要真实数据的分类时请求专属数据，避免首次打开设置就并发加载全部分类。
const SETTINGS_DATA_SECTIONS = new Set<SectionId>(["configuration", "appearance", "usage", "plugins", "archived", "ai", "permissions", "workspace", "developer"]);

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
  hotReloadEnabled: boolean;
  runtimeHooks: AiRuntimeHookInfo[];
  usage: AiUsageSummary | null;
  pendingApprovals: AiToolApproval[];
  permissionGrants: AiToolPermissionGrant[];
  archivedSessions: AiSession[];
  health: ServerHealth | null;
  steamcmdNodes: SteamcmdSettingsNode[];
  dataDirectorySettings: DataDirectorySettings | null;
  dataDirectoryDraft: string;
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

const settingsDataSnapshots = new Map<string, SettingsDataSnapshot>();

function createEmptySettingsDataSnapshot(): SettingsDataSnapshot {
  return {
    loadedSections: new Set(), providers: [], accounts: [], extensions: [], runtimePlugins: [], hotReloadEnabled: false, runtimeHooks: [],
    usage: null, pendingApprovals: [], permissionGrants: [], archivedSessions: [], health: null, steamcmdNodes: [],
    dataDirectorySettings: null, dataDirectoryDraft: "",
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

const sections: Array<{ id: SectionId; title: string; group: string; icon: WorkbenchIconName }> = [
  { id: "general", title: "常规", group: "个人", icon: "settings" },
  { id: "notifications", title: "通知", group: "个人", icon: "history" },
  { id: "import", title: "导入", group: "个人", icon: "file" },
  { id: "profile", title: "个人资料", group: "个人", icon: "user" },
  { id: "security", title: "安全", group: "个人", icon: "shield" },
  { id: "appearance", title: "外观", group: "个人", icon: "sun" },
  { id: "parental", title: "家长控制", group: "个人", icon: "shield" },
  { id: "trustedContacts", title: "受信任联系人", group: "个人", icon: "user" },
  { id: "voice", title: "语音", group: "个人", icon: "spark" },
  { id: "configuration", title: "SteamCMD 配置", group: "LFAA 配置", icon: "settings" },
  { id: "personalization", title: "个性化", group: "个人", icon: "sun" },
  { id: "mini", title: "Mini 与虚拟宠物", group: "个人", icon: "bolt" },
  { id: "shortcuts", title: "键盘快捷键", group: "个人", icon: "keyboard" },
  { id: "usage", title: "使用情况和计费", group: "个人", icon: "bolt" },
  { id: "account", title: "账户", group: "个人", icon: "user" },
  { id: "plugins", title: "插件", group: "集成", icon: "grid" },
  { id: "computerControl", title: "电脑操控", group: "集成", icon: "tools" },
  { id: "snapshots", title: "应用快照", group: "集成", icon: "archive" },
  { id: "browser", title: "浏览器", group: "集成", icon: "browser" },
  { id: "hooks", title: "钩子", group: "编码", icon: "review" },
  { id: "connections", title: "连接", group: "编码", icon: "tools" },
  { id: "cloudPreferences", title: "云端偏好设置", group: "编码", icon: "browser" },
  { id: "codeReview", title: "代码审查", group: "编码", icon: "review" },
  { id: "git", title: "Git", group: "编码", icon: "refresh" },
  { id: "environment", title: "环境", group: "编码", icon: "terminal" },
  { id: "worktrees", title: "Worktrees", group: "编码", icon: "folder" },
  { id: "archived", title: "已归档的聊天", group: "已归档", icon: "archive" },
  { id: "ai", title: "AI 与模型", group: "LFAA 配置", icon: "spark" },
  { id: "permissions", title: "用户与权限", group: "LFAA 配置", icon: "shield" },
  { id: "workspace", title: "项目与存储", group: "LFAA 配置", icon: "folder" },
  { id: "developer", title: "开发者", group: "LFAA 配置", icon: "terminal" }
];
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
  return sections.some((section) => section.id === value);
}

function settingsCategoryForSection(section: SectionId): keyof UserSettings | null {
  if (section === "general" || section === "notifications") return "general";
  if (section === "appearance") return "appearance";
  if (section === "shortcuts") return "shortcuts";
  if (section === "ai") return "aiRuntime";
  if (section === "permissions") return "permissions";
  if (section === "plugins") return "plugins";
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

function getInitialSettingsSection(initialSection: SectionId | undefined, userId: string): SectionId {
  const querySection = new URLSearchParams(window.location.search).get("section");
  if (isSettingsSection(querySection)) return querySection;
  if (initialSection) return initialSection;

  try {
    const storedSection = window.localStorage.getItem(settingsSectionStorageKey(userId));
    if (isSettingsSection(storedSection)) return storedSection;
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
    const url = new URL(window.location.href);
    if (url.searchParams.get("section") === section) return;
    url.searchParams.set("section", section);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // URL 更新失败不影响设置分类切换。
  }
}

const pendingSections: Partial<Record<SectionId, { description: string; status: string }>> = {
  import: { description: "导入其他工作区的配置和资料。LFAA 当前版本尚未接入导入流程。", status: "导入工具待接入" },
  parental: { description: "管理家庭成员和使用限制。此类账户能力尚未纳入 LFAA 账户模型。", status: "账户能力待接入" },
  trustedContacts: { description: "管理账户恢复和信任联系人。当前账户恢复通过管理员与恢复密钥完成。", status: "恢复联系人待接入" },
  voice: { description: "浏览器语音输入与完成回复播报由账户设置控制；宿主需支持 Web Speech API。", status: "浏览器语音已接入" },
  personalization: { description: "主题、强调色和各工作区背景已放在“外观”中。", status: "请使用外观设置" },
  mini: { description: "轻量窗口和虚拟宠物尚未进入 LFAA 的桌面产品规划。", status: "桌面能力待接入" },
  account: { description: "由超级管理员查看和管理本机账户。", status: "账户管理已接入" },
  computerControl: { description: "电脑操控需要桌面宿主授权和 Agent Runtime；Web 页面不会直接操作主机。", status: "桌面宿主待接入" },
  snapshots: { description: "应用快照用于保存与恢复工作区状态，当前版本尚未接入快照存储。", status: "快照服务待接入" },
  browser: { description: "浏览器工具需要受控浏览器宿主，尚未与 LFAA Agent Runtime 连接。", status: "浏览器宿主待接入" },
  hooks: { description: "此处是编码工作流钩子设置；AI 对话推理生命周期钩子由“插件”管理。编码任务 Runtime 尚未接入。", status: "编码任务 Runtime 待接入" },
  connections: { description: "外部连接器和 MCP 服务需要凭据保管与连接 Runtime，当前版本尚未接入。", status: "连接 Runtime 待接入" },
  cloudPreferences: { description: "当前设置由本机控制端保存，暂未提供云端偏好同步。", status: "云端同步待接入" },
  codeReview: { description: "代码审查工具会在 LFAA 的编码工作台接入后提供。", status: "编码工作台待接入" },
  git: { description: "Git 工作区状态和操作需要编码 Agent 与版本控制 Runtime。", status: "编码工作台待接入" },
  environment: { description: "运行环境偏好已保存在“常规”中；主机环境扫描依赖 Daemon 节点。", status: "Daemon 节点待接入" },
  worktrees: { description: "Worktree 管理需要仓库识别与安全的本机文件操作能力。", status: "编码工作台待接入" },
};

const appearanceBackgrounds = [
  { id: "none", name: "纯色" },
  { id: "service-room", name: "服务机房", file: "/backgrounds/service-room.jpg" },
  { id: "steamcmd-world", name: "游戏世界", file: "/backgrounds/steamcmd-world.jpg" },
  { id: "minecraft-world", name: "方块日落", file: "/backgrounds/minecraft-world.jpg" },
  { id: "writing-desk", name: "写作桌面", file: "/backgrounds/writing-desk.jpg" },
  ...minecraftSceneBackgrounds
];

const backgroundTargets: Array<{ id: keyof UserSettings["appearance"]["backgrounds"]; label: string }> = [
  { id: "login", label: "登录页（当前设备）" },
  { id: "appCenter", label: "应用中心" },
  { id: "steamcmd", label: "SteamCMD 工作区" },
  { id: "minecraft", label: "Minecraft 工作区（常规与 AI Work）" },
  { id: "writing", label: "写作工作区" },
  { id: "settings", label: "设置中心" }
];

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

function useSettingsLayoutMetrics(ref: RefObject<HTMLDivElement | null>): WorkbenchLayoutMetrics {
  const [metrics, setMetrics] = useState<WorkbenchLayoutMetrics>(initialSettingsMetrics);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const rect = element.getBoundingClientRect();
      setMetrics(resolveWorkbenchLayoutMetrics(rect.width, rect.height));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return metrics;
}

interface SettingsPageProps {
  user: User;
  serverState: "checking" | "online" | "offline";
  settings: UserSettings;
  resolvedTheme: "light" | "dark";
  initialSection?: SectionId;
  onBack: () => void;
  onNavigate: (path: string) => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onUserChange: (user: User) => void;
  onSettingsChange: (settings: UserSettings) => void;
}





/** 将节点数据根目录和安全相对路径合成仅管理员可见的安装位置预览。 */
function displaySteamcmdPath(node: { dataRoot: string | null } | null, relativePath: string): string {
  const root = node?.dataRoot?.replace(/[\\/]+$/u, "");
  const separator = root?.includes("\\") ? "\\" : "/";
  return root ? `${root}${separator}${relativePath.split("/").join(separator)}` : `LFAA_DATA_DIR/${relativePath}`;
}









// DeepSeek 保留的 Pro 型号 ID 当前路由到 V4.1 Flash；此提示只改显示文字，实际请求仍使用目录返回的 ID。




export function SettingsPage({ user, serverState, settings: workbenchSettings, resolvedTheme, initialSection, onBack, onNavigate, onOpenSettings, onLogout, onUserChange, onSettingsChange }: SettingsPageProps) {
  const [messageApi, messageContext] = message.useMessage();
  const [permissionModal, permissionModalContext] = Modal.useModal();
  const canAdmin = hasAdminAccess(user.role);
  const cacheKey = `${user.id}:${user.role}`;
  const cachedSettingsData = useRef(settingsDataSnapshots.get(cacheKey) ?? null).current;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => initialSettingsMetrics().mode === "mobile");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const layout = useSettingsLayoutMetrics(rootRef);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const initial = initialSettingsMetrics();
    return readWorkbenchLeftWidth(initial.left, initial.containerWidth);
  });
  const [activeSection, setActiveSection] = useState<SectionId>(() => getInitialSettingsSection(initialSection, user.id));
  const [expandedSettingsGroups, setExpandedSettingsGroups] = useState<Set<string>>(() => readExpandedSettingsGroups(user.id));
  const [searchExpandedSettingsGroups, setSearchExpandedSettingsGroups] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState("");
  const [appearanceAdvancedOpen, setAppearanceAdvancedOpen] = useState(() => readSettingsAppearanceAdvancedOpen(user.id));
  const [settings, setSettings] = useState<UserSettings>(workbenchSettings);
  const [setupReminderLocalDay, setSetupReminderLocalDay] = useState(() => getSetupReminderLocalDay());
  const [setupReminderPausedToday, setSetupReminderPausedToday] = useState(() => isSetupReminderSnoozedToday(user.id));
  const settingsRef = useRef(settings);
  const settingsRevisionRef = useRef(new Map<keyof UserSettings, number>());
  const settingsAutoSaveTimersRef = useRef(new Map<keyof UserSettings, number>());
  const settingsSaveRequestsRef = useRef(new Map<keyof UserSettings, Promise<void>>());
  const settingsPageMountedRef = useRef(true);
  const [loadingSection, setLoadingSection] = useState<SectionId | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [sectionErrors, setSectionErrors] = useState<Partial<Record<SectionId, string>>>({});
  const [settingsSaveErrors, setSettingsSaveErrors] = useState<Partial<Record<keyof UserSettings, string>>>({});
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderDraft, setFolderDraft] = useState("");
  const [licensesModalOpen, setLicensesModalOpen] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<BrowserNotificationPermission>(() => getBrowserNotificationPermission());
  const [providers, setProviders] = useState<AiProvider[]>(() => cachedSettingsData?.providers ?? []);
  const [accounts, setAccounts] = useState<AiAccount[]>(() => cachedSettingsData?.accounts ?? []);
  const [, setAiAccountsLoadState] = useState<"idle" | "loading" | "ready" | "error">(() => cachedSettingsData?.loadedSections.has("ai") || cachedSettingsData?.loadedSections.has("configuration") ? "ready" : "idle");
  const [extensions, setExtensions] = useState<AiExtension[]>(() => cachedSettingsData?.extensions ?? []);
  const [extensionSearch, setExtensionSearch] = useState("");
  const [extensionKindFilter, setExtensionKindFilter] = useState<AiExtension["kind"] | "all">("all");
  const [runtimePlugins, setRuntimePlugins] = useState<AiRuntimePlugin[]>(() => cachedSettingsData?.runtimePlugins ?? []);
  const [hotReloadEnabled, setHotReloadEnabled] = useState(() => cachedSettingsData?.hotReloadEnabled ?? false);
  const [expandedRuntimePluginGroups, setExpandedRuntimePluginGroups] = useState<Set<string>>(() => new Set());
  const [runtimePluginBusyId, setRuntimePluginBusyId] = useState<string | null>(null);
  const [runtimeHooks, setRuntimeHooks] = useState<AiRuntimeHookInfo[]>(() => cachedSettingsData?.runtimeHooks ?? []);
  const [usage, setUsage] = useState<AiUsageSummary | null>(() => cachedSettingsData?.usage ?? null);
  const [pendingApprovals, setPendingApprovals] = useState<AiToolApproval[]>(() => cachedSettingsData?.pendingApprovals ?? []);
  const [permissionGrants, setPermissionGrants] = useState<AiToolPermissionGrant[]>(() => cachedSettingsData?.permissionGrants ?? []);
  const [persistedPermissionMode, setPersistedPermissionMode] = useState<UserSettings["permissions"]["mode"]>(workbenchSettings.permissions.mode);
  const [approvalMemoryPrompt, setApprovalMemoryPrompt] = useState<AiToolApproval | null>(null);
  const [approvalBusyId, setApprovalBusyId] = useState<string | null>(null);
  const [archivedSessions, setArchivedSessions] = useState<AiSession[]>(() => cachedSettingsData?.archivedSessions ?? []);
  const [health, setHealth] = useState<ServerHealth | null>(() => cachedSettingsData?.health ?? null);
  const [dataDirectorySettings, setDataDirectorySettings] = useState<DataDirectorySettings | null>(() => cachedSettingsData?.dataDirectorySettings ?? null);
  const [dataDirectoryDraft, setDataDirectoryDraft] = useState(() => cachedSettingsData?.dataDirectoryDraft ?? "");
  const [dataDirectoryAction, setDataDirectoryAction] = useState<"save" | "cancel" | null>(null);
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
  const [steamcmdAction, setSteamcmdAction] = useState<"save" | "install" | "verify" | null>(null);
  const [uploadedBackgrounds, setUploadedBackgrounds] = useState<AppearanceBackground[]>(() => cachedSettingsData?.uploadedBackgrounds ?? []);
  const [backgroundTarget, setBackgroundTarget] = useState<SettingsBackgroundTarget>(() => readSettingsBackgroundTarget(user.id));
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [providerId, setProviderId] = useState("openai");
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [providerOptions, setProviderOptions] = useState<Record<string, Record<string, string>>>({});
  const [accountName, setAccountName] = useState("OpenAI 主账户");
  const [secret, setSecret] = useState("");
  const [providerApiKeyAttention, setProviderApiKeyAttention] = useState(false);
  const [probe, setProbe] = useState<AiProviderProbe | null>(null);
  const [modelTest, setModelTest] = useState<AiModelTestResult | null>(null);
  const [selectedModel, setSelectedModel] = useState("");
  const [reasoningMode, setReasoningMode] = useState("default");
  const [aiBusy, setAiBusy] = useState<string | null>(null);
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
  const settingsNavigationScroll = useScrollRestoration(createScrollRestorationKey(user.id, "settings-navigation"));

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
    settingsRef.current = workbenchSettings;
    setSettings(workbenchSettings);
  }, [workbenchSettings]);

  useEffect(() => {
    // 设置中心保持打开跨过本地午夜时，自动清除“今日暂停”的展示状态。
    const timer = window.setInterval(() => {
      const today = getSetupReminderLocalDay();
      setSetupReminderLocalDay((current) => current === today ? current : today);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setSetupReminderPausedToday(isSetupReminderSnoozedToday(user.id, setupReminderLocalDay));
  }, [setupReminderLocalDay, user.id]);

  useEffect(() => {
    setEmailDraft(user.email ?? "");
  }, [user.email]);

  useEffect(() => {
    if (activeSection === "security") return;
    // 离开安全分类时清除表单内的密码和恢复密钥，避免敏感值留在设置页状态中。
    setEmailCurrentPassword("");
    setPasswordChangeCurrent("");
    setPasswordChangeNext("");
    setPasswordChangeConfirmation("");
    setRecoveryCurrentPassword("");
    setRecoveryKey("");
    setRecoveryKeyConfirmation("");
  }, [activeSection]);

  useEffect(() => {
    saveWorkbenchLeftWidth(sidebarWidth, layout.left);
  }, [layout.left.max, layout.left.min, sidebarWidth]);

  useEffect(() => {
    persistSettingsSection(activeSection, user.id);
  }, [activeSection, user.id]);

  useEffect(() => {
    if (activeSection !== "account") return;
    // 账户页也能从外部入口打开；进入时清空旧筛选，恢复完整的设置分类导航。
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
      providers, accounts, extensions, runtimePlugins, hotReloadEnabled, runtimeHooks, usage, pendingApprovals, permissionGrants,
      archivedSessions, health, steamcmdNodes, steamcmdConfigurationDefaultsConfigured, steamcmdConfigurationDefaults,
      dataDirectorySettings, dataDirectoryDraft,
      selectedSteamcmdConfigurationNodeId, steamcmdConfigurationDraft, steamcmdStorageDefaultsConfigured, steamcmdStorageDefaults,
      selectedSteamcmdStorageNodeId, selectedMinecraftStorageNodeId, selectedSteamcmdInstallNodeId, steamcmdStorageDraft,
      minecraftStorageNodes, minecraftStorageDefaultsConfigured, minecraftStorageDefaults, minecraftStorageDraft,
      uploadedBackgrounds
    });
    settingsDataSnapshots.set(cacheKey, snapshot);
  }, [accounts, archivedSessions, cacheKey, dataDirectoryDraft, dataDirectorySettings, extensions, health, hotReloadEnabled, minecraftStorageDefaults, minecraftStorageDefaultsConfigured, minecraftStorageDraft, minecraftStorageNodes, pendingApprovals, permissionGrants, providers, runtimeHooks, runtimePlugins, selectedMinecraftStorageNodeId, selectedSteamcmdConfigurationNodeId, selectedSteamcmdInstallNodeId, selectedSteamcmdStorageNodeId, steamcmdConfigurationDefaults, steamcmdConfigurationDefaultsConfigured, steamcmdConfigurationDraft, steamcmdNodes, steamcmdStorageDefaults, steamcmdStorageDefaultsConfigured, steamcmdStorageDraft, uploadedBackgrounds, usage]);

  function selectSection(section: SectionId): void {
    // 账户安全页含有多个凭据输入项；离开分类筛选状态，避免浏览器把用户名填入搜索框后隐藏全部导航分类。
    if (section === "account" && search) {
      setSearch("");
      setSearchExpandedSettingsGroups(new Set());
    }
    setActiveSection(section);
    const group = sections.find((item) => item.id === section)?.group;
    if (group) {
      setExpandedSettingsGroups((current) => new Set(current).add(group));
      if (search.trim()) setSearchExpandedSettingsGroups((current) => new Set(current).add(group));
    }
    persistSettingsSection(section, user.id);
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

  // 窄屏先展示设置内容；切回宽屏时保留用户手动选择的导航状态。
  useEffect(() => {
    if (layout.mode === "mobile") setSidebarCollapsed(true);
  }, [layout.mode]);

  const selectedProvider = providers.find((provider) => provider.id === providerId);
  const currentProviderOptions = providerOptions[providerId] ?? {};
  const providerSecretLabel = providerId === "xiaomi" && currentProviderOptions.authMethod === "token-plan" ? "Token Plan Key" : "API Key";
  const selectedModelDetails = probe?.models.find((model) => model.id === selectedModel);

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
          case "configuration": {
            if (canAdmin) {
              const steamcmdResult = await loadSteamcmdSettings();
              setSteamcmdNodes(steamcmdResult.nodes);
              setSteamcmdConfigurationDefaultsConfigured(steamcmdResult.configurationDefaultsConfigured);
              setSteamcmdConfigurationDefaults(steamcmdResult.configurationDefaults);
              setSteamcmdConfigurationDraft(steamcmdResult.configurationDefaults);
              setSteamcmdStorageDefaultsConfigured(steamcmdResult.storageDefaultsConfigured);
              setSteamcmdStorageDefaults(steamcmdResult.storageDefaults);
              setSteamcmdStorageDraft(steamcmdResult.storageDefaults);
              setSelectedSteamcmdConfigurationNodeId("");
              setSelectedSteamcmdStorageNodeId("");
              setSelectedSteamcmdInstallNodeId("");
            }
            break;
          }
          case "ai": {
            if (!cachedSettingsData?.loadedSections.has("ai")) setAiAccountsLoadState("loading");
            try {
              const [providersResult, accountsResult] = await Promise.all([
                loadAiProviders(),
                loadAiAccounts()
              ]);
              setProviders(providersResult.providers);
              setAccounts(accountsResult.accounts);
              setAiAccountsLoadState("ready");
            } catch (loadError) {
              setAiAccountsLoadState("error");
              throw loadError;
            }
            void loadHealthOnce().catch(() => undefined);
            void loadExtensionsOnce().catch(() => undefined);
            break;
          }
          case "plugins": {
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
            await loadHealthOnce();
            if (canAdmin) {
              const [steamcmdResult, minecraftResult, dataDirectoryResult] = await Promise.all([
                loadSteamcmdSettings(),
                loadMinecraftStorageSettings(),
                loadDataDirectorySettings()
              ]);
              setDataDirectorySettings(dataDirectoryResult.settings);
              setDataDirectoryDraft(dataDirectoryResult.settings.pendingDirectory ?? dataDirectoryResult.settings.currentDirectory);
              setSteamcmdNodes(steamcmdResult.nodes);
              setSteamcmdStorageDefaultsConfigured(steamcmdResult.storageDefaultsConfigured);
              setSteamcmdStorageDefaults(steamcmdResult.storageDefaults);
              setMinecraftStorageNodes(minecraftResult.nodes);
              setMinecraftStorageDefaultsConfigured(minecraftResult.defaultsConfigured);
              setMinecraftStorageDefaults(minecraftResult.defaults);
              setSelectedSteamcmdStorageNodeId("");
              setSteamcmdStorageDraft(steamcmdResult.storageDefaults);
              setMinecraftStorageDraft(minecraftResult.defaults);
            }
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
    return value ? sections.filter((section) => `${section.title} ${section.group}`.toLocaleLowerCase().includes(value)) : sections;
  }, [search]);

  // 搜索时临时展开命中分类；清空后恢复用户保存的分组展开状态。
  function updateSettingsSearch(value: string): void {
    setSearch(value);
    const normalized = value.trim().toLocaleLowerCase();
    if (!normalized) {
      setSearchExpandedSettingsGroups(new Set());
      return;
    }
    setSearchExpandedSettingsGroups(new Set(sections
      .filter((section) => `${section.title} ${section.group}`.toLocaleLowerCase().includes(normalized))
      .map((section) => section.group)));
  }

  const selectedSteamcmdConfigurationNode = steamcmdNodes.find((node) => node.id === selectedSteamcmdConfigurationNodeId) ?? null;
  const selectedSteamcmdStorageNode = steamcmdNodes.find((node) => node.id === selectedSteamcmdStorageNodeId) ?? null;
  const selectedMinecraftStorageNode = minecraftStorageNodes.find((node) => node.id === selectedMinecraftStorageNodeId) ?? null;
  const selectedSteamcmdInstallNode = steamcmdNodes.find((node) => node.id === selectedSteamcmdInstallNodeId) ?? null;
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
    setSteamcmdStorageDraft({ ...node.storage });
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

  async function persistSteamcmdStorageDraft(): Promise<void> {
    if (!selectedSteamcmdStorageNodeId) {
      const { settings: savedSettings } = await saveSteamcmdStorageDefaults(steamcmdStorageDraft);
      setSteamcmdStorageDraft(savedSettings);
      setSteamcmdStorageDefaults(savedSettings);
      setSteamcmdStorageDefaultsConfigured(true);
      setSteamcmdNodes((current) => current.map((node) => node.storageConfigured ? node : { ...node, storage: { ...node.storage, ...savedSettings } }));
      return;
    }
    const { settings: savedSettings } = await saveSteamcmdNodeStorageSettings(selectedSteamcmdStorageNodeId, steamcmdStorageDraft);
    setSteamcmdStorageDraft({ gameDirectory: savedSettings.gameDirectory });
    setSteamcmdNodes((current) => current.map((node) => node.id === selectedSteamcmdStorageNodeId
      ? { ...node, storage: { ...node.storage, ...savedSettings }, storageConfigured: true }
      : node));
  }

  async function persistMinecraftStorageDraft(): Promise<void> {
    if (!selectedMinecraftStorageNodeId) {
      const { settings: savedSettings } = await saveMinecraftStorageDefaults(minecraftStorageDraft);
      setMinecraftStorageDraft(savedSettings);
      setMinecraftStorageDefaults(savedSettings);
      setMinecraftStorageDefaultsConfigured(true);
      setMinecraftStorageNodes((current) => current.map((node) => node.settingsConfigured ? node : { ...node, instanceDirectory: savedSettings.instanceDirectory }));
      return;
    }
    const { settings: savedSettings } = await saveMinecraftNodeStorageSettings(selectedMinecraftStorageNodeId, minecraftStorageDraft);
    setMinecraftStorageDraft({ instanceDirectory: savedSettings.instanceDirectory });
    setMinecraftStorageNodes((current) => current.map((node) => node.id === selectedMinecraftStorageNodeId
      ? { ...node, instanceDirectory: savedSettings.instanceDirectory, settingsConfigured: true }
      : node));
  }

  async function saveMinecraftStorageConfiguration(): Promise<void> {
    setSteamcmdAction("save");
    try {
      await persistMinecraftStorageDraft();
      messageApi.success(selectedMinecraftStorageNodeId ? "Minecraft 节点目录已保存；之后的新实例会使用它。" : "Minecraft 默认目录已保存；已有实例位置不会变更。");
    } catch (saveError) {
      messageApi.error(getErrorMessage(saveError));
    } finally {
      setSteamcmdAction(null);
    }
  }

  async function saveDataDirectoryConfiguration(): Promise<void> {
    setDataDirectoryAction("save");
    try {
      const { settings: savedSettings } = await saveDataDirectorySettings(dataDirectoryDraft);
      setDataDirectorySettings(savedSettings);
      setDataDirectoryDraft(savedSettings.pendingDirectory ?? savedSettings.currentDirectory);
      const restartAction = isDesktopApp()
        ? "退出并重新打开 LFAA 桌面程序"
        : "使用项目启动器完整重启";
      messageApi.success(savedSettings.pendingDirectory
        ? `迁移请求已保存。${restartAction}后，会复制并核对数据，再切换到新目录；旧目录会保留。`
        : "数据根目录保持当前设置。");
    } catch (saveError) {
      messageApi.error(getErrorMessage(saveError));
    } finally {
      setDataDirectoryAction(null);
    }
  }

  async function cancelDataDirectoryConfiguration(): Promise<void> {
    setDataDirectoryAction("cancel");
    try {
      const { settings: savedSettings } = await cancelDataDirectorySettingsChange();
      setDataDirectorySettings(savedSettings);
      setDataDirectoryDraft(savedSettings.currentDirectory);
      messageApi.success("待处理的数据目录迁移已取消；原目录仍在使用。");
    } catch (cancelError) {
      messageApi.error(getErrorMessage(cancelError));
    } finally {
      setDataDirectoryAction(null);
    }
  }

  async function chooseDataDirectoryConfiguration(): Promise<void> {
    try {
      const selectedDirectory = await selectDesktopDataDirectory();
      if (selectedDirectory) setDataDirectoryDraft(selectedDirectory);
    } catch (selectionError) {
      messageApi.error(getErrorMessage(selectionError));
    }
  }

  async function saveSteamcmdStorageConfiguration(): Promise<void> {
    setSteamcmdAction("save");
    try {
      await persistSteamcmdStorageDraft();
      messageApi.success(selectedSteamcmdStorageNodeId ? "Steam 游戏节点目录已保存；之后的新部署会使用它。" : "Steam 游戏默认目录已保存；已有文件位置不会变更。");
    } catch (saveError) {
      messageApi.error(getErrorMessage(saveError));
    } finally {
      setSteamcmdAction(null);
    }
  }

  async function saveSteamcmdConfiguration(): Promise<void> {
    setSteamcmdAction("save");
    try {
      await persistSteamcmdConfigurationDraft();
      messageApi.success(selectedSteamcmdConfigurationNodeId ? "当前 daemon 节点的 SteamCMD 安装配置已保存。" : "SteamCMD 默认安装配置已保存；新 daemon 节点会继承。");
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
    const timer = window.setInterval(() => {
      void loadSteamcmdTask(taskId).then(({ task }) => {
        setSteamcmdTask(task);
        if (task.status === "succeeded" || task.status === "failed") {
          if (task.status === "succeeded") {
            setSteamcmdNodes((current) => current.map((node) => node.id === task.nodeId ? { ...node, steamcmdInstalled: true } : node));
          } else {
            void loadSteamcmdSettings().then((result) => setSteamcmdNodes(result.nodes)).catch(() => undefined);
          }
        }
      }).catch((loadError: unknown) => {
        messageApi.error(getErrorMessage(loadError));
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [steamcmdTask?.id, steamcmdTask?.status]);

  function clearSettingsAutoSave(category: keyof UserSettings): void {
    const timer = settingsAutoSaveTimersRef.current.get(category);
    if (timer !== undefined) window.clearTimeout(timer);
    settingsAutoSaveTimersRef.current.delete(category);
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
          throw saveError;
        }

        if ((settingsRevisionRef.current.get(category) ?? 0) !== revision) continue;

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
          if (category === "appearance") cacheLoginBackground(result.settings.appearance.backgrounds.login);
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
        if (settingsPageMountedRef.current) setSettingsSaveErrors((current) => ({ ...current, [category]: getErrorMessage(saveError) }));
      });
    }
  }

  useEffect(() => {
    settingsPageMountedRef.current = true;
    const flush = () => flushScheduledSettingsSaves();
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      settingsPageMountedRef.current = false;
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
        if (settingsPageMountedRef.current) setSettingsSaveErrors((current) => ({ ...current, [category]: getErrorMessage(saveError) }));
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

  function updateSetupReminderSnooze(paused: boolean): void {
    const saved = paused
      ? setSetupReminderSnoozedToday(user.id, setupReminderLocalDay)
      : clearSetupReminderSnooze(user.id);
    if (!saved) {
      messageApi.error("浏览器当前无法保存本地提醒状态，请检查本地存储权限后重试。");
      return;
    }
    setSetupReminderPausedToday(paused);
    messageApi.success(paused ? "首次配置提醒今天已暂停。" : "已恢复今天的首次配置提醒。");
  }

  function updateAppearanceAdvanced(patch: Partial<UserSettings["appearance"]["advanced"]>): void {
    updateSettings("appearance", { ...settings.appearance, advanced: { ...settings.appearance.advanced, ...patch } });
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

  async function persistSettings<K extends keyof UserSettings>(category: K): Promise<void> {
    if (category === "shortcuts" && hasShortcutConflicts(settingsRef.current.shortcuts)) {
      setError("快捷键不能重复，请修改冲突项后再保存");
      return;
    }
    clearSettingsAutoSave(category);
    setSaving(category);
    setError("");
    try {
      await persistLatestSettings(category);
      messageApi.success("设置已保存");
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(null);
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

  async function reloadAiAccounts(): Promise<void> {
    const result = await loadAiAccounts();
    setAccounts(result.accounts);
    setAiAccountsLoadState("ready");
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

  async function resolveApproval(approval: AiToolApproval, decision: "approved" | "denied", remember = false): Promise<void> {
    setApprovalBusyId(approval.id);
    setError("");
    try {
      await decideAiApproval(approval.id, decision, remember);
      const result = await loadAiApprovals();
      setPendingApprovals(result.approvals);
      if (remember) {
        const grants = await loadAiPermissionGrants();
        setPermissionGrants(grants.grants);
      }
      setApprovalMemoryPrompt(null);
      messageApi.success(decision === "approved" ? remember ? "本次操作已批准，并记住了相同范围的操作。" : "本次操作已批准；执行器仍须校验并消费本次授权。" : "操作已拒绝");
    } catch (approvalError) {
      setError(getErrorMessage(approvalError));
    } finally {
      setApprovalBusyId(null);
    }
  }

  function confirmApproval(approval: AiToolApproval): void {
    if (persistedPermissionMode === "approve_remembered") {
      setApprovalMemoryPrompt(approval);
      return;
    }
    void resolveApproval(approval, "approved");
  }

  async function revokePermissionGrant(grant: AiToolPermissionGrant): Promise<void> {
    try {
      await revokeAiPermissionGrant(grant.id);
      setPermissionGrants((current) => current.filter((item) => item.id !== grant.id));
      messageApi.success("记忆授权已撤销；下次匹配的操作将重新询问。");
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
      const result = await probeAiProvider({ providerId, secret, options: currentProviderOptions });
      setProbe(result.result);
      setSelectedModel(result.result.models[0]?.id ?? "");
      setReasoningMode("default");
      messageApi.success(`已从官方 API 拉取 ${result.result.models.length} 个模型`);
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
      await saveAiAccount({ providerId, secret, options: currentProviderOptions, displayName: accountName, modelId: selectedModel, reasoningMode });
      setSecret("");
      setProbe(null);
      setModelTest(null);
      setProviderModalOpen(false);
      await reloadAiAccounts();
      messageApi.success("AI 账户已安全保存");
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setAiBusy(null);
    }
  }

  async function runAccountAction(account: AiAccount, action: "activate" | "retest" | "delete", modelId?: string): Promise<void> {
    setAiBusy(`${action}:${account.id}`);
    setError("");
    try {
      if (action === "activate") await activateAiAccount(account.id);
      if (action === "retest") {
        const result = await reprobeAiAccount(account.id);
        messageApi.success(result.result.message);
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
    setProviderId(nextProvider.id);
    setAccountName(`${nextProvider.name} 主账户`);
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

  async function addBackground(file: File): Promise<void> {
    setUploadingBackground(true);
    setError("");
    try {
      const result = await uploadAppearanceBackground(file);
      setUploadedBackgrounds((current) => [result.background, ...current]);
      updateSettings("appearance", { ...settingsRef.current.appearance, backgrounds: { ...settingsRef.current.appearance.backgrounds, [backgroundTarget]: result.background.id } });
      messageApi.success("背景图片已上传，选择会自动保存后应用");
    } catch (uploadError) {
      setError(getErrorMessage(uploadError));
    } finally {
      setUploadingBackground(false);
    }
  }

  async function removeBackground(background: AppearanceBackground): Promise<void> {
    setError("");
    try {
      const backgrounds = Object.fromEntries(Object.entries(settingsRef.current.appearance.backgrounds).map(([target, value]) => [target, value === background.id ? "none" : value])) as UserSettings["appearance"]["backgrounds"];
      updateSettings("appearance", { ...settingsRef.current.appearance, backgrounds });
      clearSettingsAutoSave("appearance");
      await persistLatestSettings("appearance");
      await deleteAppearanceBackground(background.id);
      setUploadedBackgrounds((current) => current.filter((item) => item.id !== background.id));
      messageApi.success("背景图片已删除");
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
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
    if (sendBrowserNotification("LFAA 通知测试", "浏览器已成功接收 LFAA 通知。")) messageApi.success("测试通知已发送。");
    else messageApi.error("测试通知未发送，请检查浏览器通知授权。");
  }

  function testNotificationSound(): void {
    if (playNotificationSound(settings.general.notificationSound)) messageApi.info("已触发提示音试听；实际音量受浏览器和系统设置控制。");
    else messageApi.warning(settings.general.notificationSound === "off" ? "提示音当前已关闭。" : "当前浏览器无法播放提示音。");
  }

  const backgroundChoices = [
    ...appearanceBackgrounds,
    ...uploadedBackgrounds.map((background) => ({ id: background.id, name: `自定义 · ${background.name}`, file: background.url }))
  ];
  const visibleBackgroundChoices = backgroundTarget === "login"
    ? backgroundChoices.filter((background) => !background.id.startsWith("user-"))
    : backgroundChoices;
  const selectedBackgroundForTarget = settings.appearance.backgrounds[backgroundTarget];

  const notificationPermissionLabels: Record<BrowserNotificationPermission, string> = {
    granted: "已授权",
    default: "需要授权",
    denied: "已被阻止",
    insecure: "需要安全连接",
    unsupported: "当前环境不支持"
  };
  const notificationPermissionDescriptions: Record<BrowserNotificationPermission, string> = {
    granted: "此浏览器已允许 LFAA 发送系统通知。授权保存在浏览器中，不随账户设置同步。",
    default: "允许后，AI Work 会话提醒可投递到系统通知。浏览器会在此操作后显示授权请求。",
    denied: "浏览器已拒绝通知权限。请打开地址栏的网站权限并允许通知，再返回此页。",
    insecure: "浏览器通知要求 HTTPS 或 localhost 安全连接。",
    unsupported: "此浏览器或桌面容器没有提供 Notifications API。"
  };
  const notificationGroup = (
    <SettingGroup title="LFAA 通知">
      <SettingRow title="浏览器通知权限" description={notificationPermissionDescriptions[notificationPermission]} status={notificationPermissionLabels[notificationPermission]}>
        {notificationPermission === "default" ? <Button onClick={() => void enableBrowserNotifications()}>启用通知</Button> : null}
        {notificationPermission === "granted" ? <Button onClick={sendNotificationTest}>发送测试通知</Button> : null}
      </SettingRow>
      <SettingRow title="AI Work 回复完成" description="回复完成后在工作台通知栏和右下角提醒；浏览器系统通知按下方策略投递。" status="已接入">
        <Select value={settings.general.completionNotification} options={[{ value: "always", label: "始终" }, { value: "unfocused", label: "仅在工作台未聚焦时" }, { value: "never", label: "关闭" }]} onChange={(value) => updateGeneral({ completionNotification: value })} />
      </SettingRow>
      <SettingRow title="AI Work 会话出错" description="回复生成失败时，在通知栏和右下角显示提醒；点击可返回出错的会话查看详情。" status={settings.general.sessionIssueNotifications ? "已开启" : "已关闭"}>
        <SettingsSwitch label="会话问题提醒" checked={settings.general.sessionIssueNotifications} onChange={() => updateGeneral({ sessionIssueNotifications: !settings.general.sessionIssueNotifications })} />
      </SettingRow>
      <SettingRow title="首次配置提醒" description="永久总开关。SteamCMD 安装目录、游戏默认目录或 AI API 尚未配置时，在工作台显示提醒；配置完成后自动停止。只想暂停今天时，使用下方的临时开关。" status={settings.general.setupReminderEnabled ? "已开启" : "已关闭"}>
        <SettingsSwitch label="首次配置提醒" checked={settings.general.setupReminderEnabled} onChange={() => updateGeneral({ setupReminderEnabled: !settings.general.setupReminderEnabled })} />
      </SettingRow>
      <SettingRow title="今日不再提醒" description="仅对当前账户和此浏览器生效，暂停到本地今天结束；明天自动恢复，不会关闭上方的永久总开关。可随时关闭此开关以恢复今天的提醒。" status={!settings.general.setupReminderEnabled ? setupReminderPausedToday ? "总开关已关闭，今日也已暂停" : "总开关已关闭" : setupReminderPausedToday ? "今日已暂停" : "今日未暂停"}>
        <SettingsSwitch label="今日不再提醒" checked={setupReminderPausedToday} disabled={!settings.general.setupReminderEnabled} onChange={() => updateSetupReminderSnooze(!setupReminderPausedToday)} />
      </SettingRow>
      <SettingRow title="AI 工具权限请求" description="AI Work 等待工具审批时，在通知栏和右下角提醒；点击可打开对应会话处理审批。" status={settings.general.permissionNotifications ? "已开启" : "已关闭"}>
        <SettingsSwitch label="审批提醒" checked={settings.general.permissionNotifications} onChange={() => updateGeneral({ permissionNotifications: !settings.general.permissionNotifications })} />
      </SettingRow>
      <SettingRow title="AI Work 等待回答" description="当前 AI Work 只提供流式对话，没有暂停等待用户回答的任务事件。" status="待接入">
        <Typography.Text type="secondary">等待真实问题事件源</Typography.Text>
      </SettingRow>
      <SettingRow title="通知提示音" description="选择 AI Work 回复完成、审批请求和会话错误的提示音；试听音量受浏览器和系统音量控制。" status="已接入">
        <Space>
          <Select value={settings.general.notificationSound} options={[{ value: "default", label: "默认" }, { value: "subtle", label: "轻柔" }, { value: "off", label: "关闭" }]} onChange={(value) => updateGeneral({ notificationSound: value })} />
          <Button onClick={testNotificationSound} disabled={settings.general.notificationSound === "off"}>试听</Button>
        </Space>
      </SettingRow>
    </SettingGroup>
  );

  const sectionContent = (() => {
    if (activeSection === "profile") return (
      <section className="settings-content">
        <header className="settings-content__heading"><div><span className="settings-eyebrow">当前账户</span><Typography.Title level={2}>个人资料</Typography.Title><Typography.Paragraph>显示当前登录账户的资料。切换登录账号后，这里会对应显示新账号的信息。</Typography.Paragraph></div></header>
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
      <section className="settings-content">
        <header className="settings-content__heading"><div><span className="settings-eyebrow">账户保护</span><Typography.Title level={2}>安全</Typography.Title><Typography.Paragraph>集中管理当前账户的邮箱、登录密码、恢复密钥和通行密钥。更改邮箱或密码时需要重新验证当前密码。</Typography.Paragraph></div></header>
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
        <SettingsActions saving={saving === "aiRuntime"} onReset={() => { updateSettings("aiRuntime", { ...settings.aiRuntime, voiceInputEnabled: DEFAULT_USER_SETTINGS.aiRuntime.voiceInputEnabled, readResponsesAloud: DEFAULT_USER_SETTINGS.aiRuntime.readResponsesAloud }); }} onSave={() => void persistSettings("aiRuntime")} />
      </section>
    );

    if (activeSection === "general") return (
      <section className="settings-content">
        <header className="settings-content__heading"><div><Typography.Title level={2}>常规</Typography.Title></div></header>
        <SettingGroup title="访问边界">
          <SettingRow title="AI Work 项目权限模式" description="完全权限下，模型可自主执行当前应用的全部项目操控，不再逐项审批；实际操作由项目 Runtime 与对应 Host/Daemon 执行。" status="账户级设置">
            <Button onClick={() => selectSection("permissions")}>管理权限</Button>
          </SettingRow>
        </SettingGroup>
        <SettingGroup title="常规">
          <SettingRow title="默认任务文件夹" description="项目文件操作的默认根目录与节点命令的默认工作目录。必须是目标节点上的真实绝对路径；任务通过认证 Daemon 和项目权限合同执行。">
            <div className="settings-folder-value" title={settings.general.taskFolder || "尚未设置"}><span>{settings.general.taskFolder || "尚未设置"}</span><Button onClick={() => { setFolderDraft(settings.general.taskFolder); setFolderModalOpen(true); }}>更改</Button></div>
          </SettingRow>
          <SettingRow title="默认文件打开位置" description="选择文件操作使用系统默认应用，或在执行时再询问。">
            <Select value={settings.general.fileOpenLocation} options={[{ value: "system", label: "系统默认应用" }, { value: "ask", label: "每次询问" }]} onChange={(value) => updateGeneral({ fileOpenLocation: value })} />
          </SettingRow>
          <SettingRow title="智能体环境" description="选择 Agent Runtime 执行任务时使用的主机环境；节点能力接入后生效。">
            <Select value={settings.general.agentEnvironment} options={[{ value: "system", label: "自动检测" }, { value: "windows-native", label: "Windows 原生" }, { value: "wsl", label: "WSL" }, { value: "linux", label: "Linux" }]} onChange={(value) => updateGeneral({ agentEnvironment: value })} />
          </SettingRow>
          <SettingRow title="集成终端 Shell" description="选择 AI Host 在目标 Daemon 上执行命令时使用的 Shell。">
            <Select value={settings.general.integratedShell} options={[{ value: "system", label: "系统默认" }, { value: "powershell", label: "PowerShell" }, { value: "cmd", label: "命令提示符" }, { value: "bash", label: "Bash" }, { value: "zsh", label: "Zsh" }]} onChange={(value) => updateGeneral({ integratedShell: value })} />
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
          <SettingRow title="默认终端位置" description="选择节点任务输出面板的位置，可显示在底部或右侧。当前面板显示真实执行结果，交互式终端仍待接入。">
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
        <SettingGroup title="编辑器">
          <SettingRow title="纯文本编辑器" description="在写作编辑器接入后，按纯文本方式编辑内容。">
            <SettingsSwitch label="纯文本编辑器" checked={settings.general.plainTextEditor} onChange={() => updateGeneral({ plainTextEditor: !settings.general.plainTextEditor })} />
          </SettingRow>
          <SettingRow title="发送快捷键" description="设置 AI Work 输入框按 Enter 时发送，或插入新行。">
            <Select value={settings.general.sendShortcut} options={[{ value: "enter", label: "Enter 发送" }, { value: "ctrl-enter", label: "Ctrl + Enter 发送" }]} onChange={(value) => updateGeneral({ sendShortcut: value })} />
          </SettingRow>
          <SettingRow title="跟进处理方式" description="AI Work 正在运行时，选择后续消息排队或引导当前任务。">
            <Select value={settings.general.followupBehavior} options={[{ value: "queue", label: "加入队列" }, { value: "steer", label: "引导当前运行" }]} onChange={(value) => updateGeneral({ followupBehavior: value })} />
          </SettingRow>
        </SettingGroup>
        <SettingGroup title="弹出窗口">
          <SettingRow title="弹出窗口快捷键" description="为桌面弹出窗口保存全局快捷键；不设置则保持关闭。">
            <Input value={settings.general.popupShortcut} placeholder="关闭" maxLength={48} onChange={(event) => updateGeneral({ popupShortcut: event.target.value })} />
          </SettingRow>
          <SettingRow title="默认使用独立聊天" description="开启后从首页登录或恢复账户时默认进入通用任务工作区。">
            <SettingsSwitch label="默认使用独立聊天" checked={settings.general.defaultStandaloneChat} onChange={() => updateGeneral({ defaultStandaloneChat: !settings.general.defaultStandaloneChat })} />
          </SettingRow>
        </SettingGroup>
        {notificationGroup}
        <SettingGroup title="趣味实验">
          <SettingRow title="彩纸礼炮" description="任务完成时显示彩纸效果；需要任务完成事件和桌面动效接入。">
            <SettingsSwitch label="彩纸礼炮" checked={settings.general.confettiEnabled} onChange={() => updateGeneral({ confettiEnabled: !settings.general.confettiEnabled })} />
          </SettingRow>
        </SettingGroup>
        <SettingGroup title="LFAA 工作台">
          <SettingRow title="应用默认工作模式" description="进入 SteamCMD、Minecraft 或写作应用时默认打开的模式。">
            <Select value={settings.general.defaultMode} options={[{ value: "normal", label: "常规模式" }, { value: "ai-work", label: "AI Work" }]} onChange={(value) => updateGeneral({ defaultMode: value })} />
          </SettingRow>
          <SettingRow title="服务连接状态" description="在应用中心顶部显示控制端连接状态。">
            <SettingsSwitch label="服务连接状态" checked={settings.general.showServiceStatus} onChange={() => updateGeneral({ showServiceStatus: !settings.general.showServiceStatus })} />
          </SettingRow>
        </SettingGroup>
        <SettingsActions saving={saving === "general"} onReset={() => resetSettings("general")} onSave={() => void persistSettings("general")} />
      </section>
    );

    if (activeSection === "notifications") return (
      <section className="settings-content">
        <header className="settings-content__heading"><div><Typography.Title level={2}>通知</Typography.Title></div></header>
        <Alert className="settings-inline-alert" type="info" showIcon message="当前接入 LFAA 自身通知" description="AI Work 成功回复已接入。ChatGPT/Codex 任务、用量重置、健康数据、群聊、营销、资料库和项目邀请属于外部产品事件，LFAA 当前没有相应连接器或事件源。" />
        {notificationGroup}
        <SettingsActions saving={saving === "general"} onReset={() => resetSettings("general")} onSave={() => void persistSettings("general")} />
      </section>
    );

    if (activeSection === "appearance") return (
      <section className="settings-content">
        <header className="settings-content__heading"><div><span className="settings-eyebrow">界面显示</span><Typography.Title level={2}>外观</Typography.Title><Typography.Paragraph>调整主题、强调色，并为登录页和不同工作区选择背景图片。</Typography.Paragraph></div><span className="settings-preview" style={{ "--preview-accent": "var(--settings-accent)" } as CSSProperties}>LFAA</span></header>
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
          {!settings.appearance.advanced.separateModes ? <SettingRow title="强调色" description="应用到按钮、链接和选中状态。" status="已接入">
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
                  value={settings.appearance.sidebarColor === "auto" ? (resolvedTheme === "dark" ? "#262626" : "#f5f7fb") : settings.appearance.sidebarColor}
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
            <Select value={backgroundTarget} options={backgroundTargets.map((item) => ({ value: item.id, label: item.label }))} onChange={setBackgroundTarget} />
          </SettingRow>
          <div className="settings-background-picker" role="group" aria-label={`${backgroundTargets.find((item) => item.id === backgroundTarget)?.label ?? "工作区"}背景图片`}>
            {visibleBackgroundChoices.map((item) => {
              const selected = selectedBackgroundForTarget === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`settings-background-card${selected ? " is-selected" : ""}${item.file ? "" : " settings-background-card--plain"}`}
                  aria-pressed={selected}
                  aria-label={`为${backgroundTargets.find((target) => target.id === backgroundTarget)?.label ?? "工作区"}选择${item.name}`}
                  onClick={() => updateSettings("appearance", { ...settings.appearance, backgrounds: { ...settings.appearance.backgrounds, [backgroundTarget]: item.id } })}
                >
                  {item.file ? <img className="settings-background-card__image" src={item.file} alt="" aria-hidden="true" loading="lazy" decoding="async" /> : null}
                  <span className="settings-background-card__check" aria-hidden="true">{selected ? "✓" : ""}</span>
                  <span className="settings-background-card__name">{item.name}</span>
                </button>
              );
            })}
          </div>
          <p className="settings-background-hint">图片卡片会显示背景预览；Minecraft 常规与 AI Work 共用同一张 Minecraft 工作区背景，设置中心、应用中心和各应用工作区分别保存。当前图片应用于：{backgroundTargets.find((item) => item.id === backgroundTarget)?.label}。登录页只使用内置图片，自定义上传仍限于登录后的工作区。</p>
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
        {uploadedBackgrounds.length ? <SettingGroup title="自定义背景库">{uploadedBackgrounds.map((background) => <SettingRow key={background.id} title={background.name} description={`${background.mimeType} · 上传于 ${new Date(background.createdAt).toLocaleDateString("zh-CN")}`} status="账户私有"><Popconfirm title="删除这张背景图片？" description="如果正在使用，对应位置将恢复为纯色。" okText="删除" cancelText="取消" onConfirm={() => void removeBackground(background)}><Button danger size="small">删除</Button></Popconfirm></SettingRow>)}</SettingGroup> : null}
        <SettingGroup title="背景显示">
          <SettingRow title="背景遮罩" description="统一控制整张工作区壁纸的遮罩透明度，设置和应用的顶部栏、导航及 AI Work 输入区等独立表面同步使用该值；0% 时壁纸最清晰，数值越高整体底色越明显。消息画布不另加局部遮罩。" status="已接入"><div className="settings-slider"><Slider min={0} max={75} value={settings.appearance.overlay} onChange={(overlay) => updateSettings("appearance", { ...settings.appearance, overlay })} /><output>{settings.appearance.overlay}%</output></div></SettingRow>
          <SettingRow title="玻璃模糊" description="调整顶栏、半透明导航栏、AI Work 输入区和写作上下文作品卡片的玻璃模糊强度；消息画布保持透明并显示工作区壁纸，设置正文不做实时模糊。" status="已接入"><div className="settings-slider"><Slider min={0} max={32} value={settings.appearance.blur} onChange={(blur) => updateSettings("appearance", { ...settings.appearance, blur })} /><output>{settings.appearance.blur}px</output></div></SettingRow>
        </SettingGroup>
        <section className="settings-advanced">
          <button className="settings-advanced__toggle" type="button" aria-expanded={appearanceAdvancedOpen} onClick={() => setAppearanceAdvancedOpen((open) => !open)}>
            <span>高级</span>
            <svg className="settings-advanced__chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="m4 2.5 3.5 3.5L4 9.5" /></svg>
          </button>
          {appearanceAdvancedOpen ? <div className="settings-advanced__content">
            <AdvancedGroup>
              <SettingRow title="减少动态效果" description="开启后减少动画；系统模式遵循操作系统的减少动态效果设置。">
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
        <SettingsActions saving={saving === "appearance"} onReset={() => resetSettings("appearance")} onSave={() => void persistSettings("appearance")} />
      </section>
    );

    if (activeSection === "shortcuts") return (
      <section className="settings-content">
        <header className="settings-content__heading"><div><span className="settings-eyebrow">键盘操作</span><Typography.Title level={2}>键盘快捷键</Typography.Title><Typography.Paragraph>点击输入框并按下新的组合键。快捷键会在本工作台中生效。</Typography.Paragraph></div></header>
        <SettingGroup title="导航">
          <ShortcutRow title="打开设置中心" value={settings.shortcuts.openSettings} onChange={(value) => updateShortcut("openSettings", value)} />
          <ShortcutRow title="返回应用中心" value={settings.shortcuts.openHome} onChange={(value) => updateShortcut("openHome", value)} />
          <ShortcutRow title="打开 SteamCMD 应用" value={settings.shortcuts.openSteamcmd} onChange={(value) => updateShortcut("openSteamcmd", value)} />
          <ShortcutRow title="打开 Minecraft 应用" value={settings.shortcuts.openMinecraft} onChange={(value) => updateShortcut("openMinecraft", value)} />
          <ShortcutRow title="打开写作应用" value={settings.shortcuts.openWriting} onChange={(value) => updateShortcut("openWriting", value)} />
        </SettingGroup>
        <SettingGroup title="应用工作区面板">
          <ShortcutRow title="切换应用导航栏" value={settings.shortcuts.toggleSidebar} onChange={(value) => updateShortcut("toggleSidebar", value)} />
          <ShortcutRow title="切换工具与资源栏" value={settings.shortcuts.toggleContextPanel} onChange={(value) => updateShortcut("toggleContextPanel", value)} />
          <ShortcutRow title="切换底部面板" value={settings.shortcuts.toggleBottomPanel} onChange={(value) => updateShortcut("toggleBottomPanel", value)} />
          <ShortcutRow title="打开终端面板" value={settings.shortcuts.openTerminal} onChange={(value) => updateShortcut("openTerminal", value)} />
        </SettingGroup>
        <SettingGroup title="应用模式">
          <ShortcutRow title="切换到常规模式" value={settings.shortcuts.switchNormalMode} onChange={(value) => updateShortcut("switchNormalMode", value)} />
          <ShortcutRow title="切换到 AI Work" value={settings.shortcuts.switchAiWorkMode} onChange={(value) => updateShortcut("switchAiWorkMode", value)} />
        </SettingGroup>
        <SettingsActions saving={saving === "shortcuts"} onReset={() => resetSettings("shortcuts")} onSave={() => void persistSettings("shortcuts")} />
      </section>
    );

    if (activeSection === "ai") return (
      <section className="settings-content">
        <header className="settings-content__heading"><div><span className="settings-eyebrow">模型账户</span><Typography.Title level={2}>AI 与模型</Typography.Title><Typography.Paragraph>配置各应用 AI Work 使用的 Provider 账户，并选择模型。</Typography.Paragraph></div></header>
        <Alert className="settings-inline-alert" type="info" showIcon message="模型账户、推理参数与 AI Work 共用此处的活动 Provider。密钥只在控制端解密并发送至所选 Provider，不会返回浏览器。" />
        <SettingGroup title="AI Runtime 状态">
          <SettingRow title="Cordis 插件宿主" description={`当前运行组合已加载 ${activeRuntimePluginCount}/${runtimePlugins.length} 个宿主模块；AI 扩展登记 ${extensions.length} 项。`} status={runtimePluginHostReady ? "运行中" : "检查状态"}><Tag color={runtimePluginHostReady ? "green" : "orange"}>{runtimePluginHostReady ? "已就绪" : "检查插件页面"}</Tag></SettingRow>
          <SettingRow title="当前 Provider" description={accounts.find((account) => account.active) ? `${accounts.find((account) => account.active)!.providerId} · ${accounts.find((account) => account.active)!.modelId}` : "添加并启用账户后，AI Work 才能请求模型。"} status={accounts.some((account) => account.active) ? "已启用" : "需要配置"}><Tag color={accounts.some((account) => account.active) ? "green" : "default"}>{accounts.some((account) => account.active) ? "可推理" : "未配置"}</Tag></SettingRow>
          <SettingRow title="会话存储" description="AI Work 会话、消息和 Provider 返回的 Token 用量写入账户隔离的控制端 SQLite。" status={health?.persistence === "ready" ? "已连接" : "不可用"}><Tag>{health?.persistence === "ready" ? "SQLite · 已连接" : "SQLite · 未连接"}</Tag></SettingRow>
        </SettingGroup>
        <SettingGroup title="模型服务商">
          {providers.length ? <div className="ai-provider-grid">{providers.map((provider) => {
            const providerAccounts = accounts.filter((account) => account.providerId === provider.id);
            const activeAccount = providerAccounts.find((account) => account.active);
            return <button className={`ai-provider-card${activeAccount ? " is-active" : ""}`} key={provider.id} type="button" onClick={() => openProviderConfiguration(provider)}>
              <span className={`ai-provider-card__brand is-${provider.id}`} aria-hidden="true">{provider.name.slice(0, 2)}</span>
              <span className="ai-provider-card__body"><strong>{provider.name}</strong><span>{provider.description}</span><small>{activeAccount ? `当前使用 · ${activeAccount.modelId}` : providerAccounts.length ? `已保存 ${providerAccounts.length} 个账户` : "点击配置模型账户"}</small></span>
              <Tag color={activeAccount ? "green" : undefined}>{activeAccount ? "当前使用" : providerAccounts.length ? "已配置" : "未配置"}</Tag>
            </button>;
          })}</div> : <div className="settings-empty"><strong>正在读取服务商目录</strong><span>服务商列表由控制端提供。</span></div>}
        </SettingGroup>

        <Card className="settings-card ai-account-list" title="已保存账户" extra={<Tag>{accounts.length}</Tag>}>
          {!accounts.length ? <div className="settings-empty"><strong>还没有模型账户</strong><span>选择上方服务商卡片，配置并测试你的 API Key。</span></div> : accounts.map((account) => {
            const accountModel = account.models.find((model) => model.id === account.modelId);
            const accountReasoningOptions = reasoningOptions(accountModel);
            return <article className={`ai-account-item${account.active ? " is-active" : ""}`} key={account.id}>
              <div className="ai-account-item__header"><div><strong>{account.displayName}</strong><span>{providers.find((provider) => provider.id === account.providerId)?.name ?? account.providerId} · {account.active ? "当前模型" : "已保存"}</span></div><Tag color={account.active ? "green" : "default"}>{account.active ? "当前使用" : "未启用"}</Tag></div>
              <label className="settings-field"><span>当前模型</span><Select value={account.modelId} options={account.models.length ? account.models.map((model) => ({ value: model.id, label: modelOptionLabel(account.providerId, model) })) : [{ value: account.modelId, label: account.modelId }]} onChange={(modelId) => void selectAccountModel(account, modelId)} /></label>
              <p className="settings-field-help">{modelParameterSummary(accountModel)}</p>
              {accountReasoningOptions.length ? <label className="settings-field"><span>官方思考参数</span><Select value={accountReasoningOptions.some((option) => option.value === account.reasoningMode) ? account.reasoningMode : "default"} options={accountReasoningOptions} disabled={aiBusy !== null} onChange={(value) => void selectAccountReasoningMode(account, value)} /></label>
                : accountModel?.thinking?.kind === "fixed" ? <p className="ai-thinking-note">{fixedThinkingLabel(accountModel)}</p>
                  : <p className="ai-thinking-note">当前模型没有已确认的可配置官方思考参数；请求会跟随模型默认值，不发送思考字段。</p>}
              <div className="ai-account-item__actions">
                {!account.active ? <Button size="small" type="primary" disabled={aiBusy !== null} onClick={() => void runAccountAction(account, "activate")}>设为当前模型</Button> : null}
                <Button size="small" disabled={aiBusy !== null} loading={aiBusy === `retest:${account.id}`} onClick={() => void runAccountAction(account, "retest")}>重测模型</Button>
                <Popconfirm title="删除这个 AI 账户？" description="删除后，LFAA 将移除加密密钥和已保存的模型目录。" okText="删除" cancelText="取消" onConfirm={() => void runAccountAction(account, "delete")}><Button danger size="small" disabled={aiBusy !== null}>删除</Button></Popconfirm>
              </div>
            </article>;
          })}
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
            <p className="ai-provider-modal__description">{selectedProvider.description}。模型列表从该 Provider 官方 API 拉取，密钥仅在控制端验证与加密保存。</p>
            <div className="ai-provider-form-grid">
              {selectedProvider.options.length ? <div className="ai-provider-options-grid">
                {selectedProvider.options.map((option) => <label className="settings-field" key={option.id}><span>{option.label}</span>{option.choices.length ? <Select value={currentProviderOptions[option.id] ?? (option.id === "region" && providerId === "qwen" ? "ap-southeast-1" : option.choices[0]?.value)} options={option.choices.map((choice) => ({ value: choice.value, label: choice.label }))} onChange={(value) => { setProviderOptions((current) => ({ ...current, [providerId]: { ...current[providerId], [option.id]: value } })); setProviderApiKeyAttention(false); setError(""); setProbe(null); setModelTest(null); }} /> : <Input value={currentProviderOptions[option.id] ?? ""} onChange={(event) => { setProviderOptions((current) => ({ ...current, [providerId]: { ...current[providerId], [option.id]: event.target.value } })); setProviderApiKeyAttention(false); setError(""); setProbe(null); setModelTest(null); }} placeholder="输入 Workspace ID" />}</label>)}
              </div> : null}
              <div className="ai-provider-credentials-grid">
                <label className="settings-field"><span>账户名称</span><Input value={accountName} maxLength={48} onChange={(event) => setAccountName(event.target.value)} placeholder="例如：个人 API 账户" /></label>
                <label className="settings-field"><span>{providerSecretLabel}</span><Input.Password status={providerApiKeyAttention ? "error" : undefined} aria-describedby={providerApiKeyAttention ? "provider-api-key-warning" : undefined} autoComplete="new-password" value={secret} onChange={(event) => { setSecret(event.target.value); if (event.target.value.trim()) setProviderApiKeyAttention(false); setError(""); setProbe(null); setModelTest(null); }} placeholder="输入密钥，仅在保存前保留" /></label>
              </div>
            </div>
            {error ? <Alert className="settings-inline-alert" type="error" showIcon message={error} /> : providerApiKeyAttention ? <Alert id="provider-api-key-warning" className="settings-inline-alert" type="warning" showIcon message={`请先填写上方标红的 ${providerSecretLabel}；如果已填写仍拉取失败，请检查密钥、服务商参数和 API 地址。`} /> : null}
            <div className="ai-provider-catalog-row">
              <span><strong>官方模型目录</strong><small>{probe ? `已读取 ${probe.models.length} 个模型` : !secret.trim() ? `请先填写 ${providerSecretLabel}` : "尚未拉取"}</small></span>
              <Button loading={aiBusy === "probe"} disabled={aiBusy !== null} title={!secret.trim() ? `请先填写 ${providerSecretLabel} 后再拉取模型` : undefined} onClick={() => void runProbe()}>拉取模型</Button>
            </div>
            {probe ? <Alert className="settings-ai-result" type="success" showIcon message={probe.message} description="此步骤只读取模型目录；请选择具体模型后，再发起真实对话测试。" /> : null}
            {probe?.models.length ? <>
              <label className="settings-field"><span>模型</span><Select value={selectedModel || undefined} placeholder="选择官方目录中的模型" options={probe.models.map((model) => ({ value: model.id, label: modelOptionLabel(providerId, model) }))} onChange={(nextModel) => { setSelectedModel(nextModel); setReasoningMode("default"); setModelTest(null); }} showSearch optionFilterProp="label" /></label>
              {selectedModelDetails ? <p className="settings-field-help">{modelParameterSummary(selectedModelDetails)}</p> : null}
              {selectedModelDetails?.thinking && selectedModelDetails.thinking.kind !== "fixed" ? <label className="settings-field"><span>思考模式 / 力度</span><Select value={reasoningMode} options={reasoningOptions(selectedModelDetails)} disabled={aiBusy !== null} onChange={(value) => { setReasoningMode(value); setModelTest(null); }} /></label>
                : selectedModelDetails?.thinking?.kind === "fixed" ? <p className="ai-thinking-note">{fixedThinkingLabel(selectedModelDetails)}</p>
                  : selectedModelDetails ? <p className="ai-thinking-note">此型号没有已确认的可配置官方思考参数；将跟随模型默认值，不发送思考字段。</p> : null}
              <div className="ai-provider-test-row">
                <div><strong>真实模型测试</strong><span>会发送一条简短请求至所选模型，可能产生 Provider 用量。</span></div>
                <Button loading={aiBusy === "test"} disabled={!selectedModel || !secret.trim() || aiBusy !== null} onClick={() => void runModelTest()}>测试模型</Button>
              </div>
              {modelTest ? <Alert className="settings-ai-result" type="success" showIcon message={`模型请求通过 · ${modelTest.elapsedMs} ms`} description={modelTest.sample} /> : null}
              <div className="ai-provider-modal__footer"><Button onClick={() => setProviderModalOpen(false)} disabled={aiBusy !== null}>取消</Button><Button type="primary" loading={aiBusy === "save"} disabled={!modelTest || !selectedModel || !secret.trim() || aiBusy !== null} onClick={() => void saveAccount()}>加密保存账户</Button></div>
            </> : null}
          </div> : null}
        </Modal>
        <SettingGroup title="推理参数">
          <SettingRow title="输出长度策略" description="此策略只形成请求的最大输出 token 上限，不控制模型思考力度，也不保证 Provider 延迟。思考参数请在对应模型账户卡片中选择。">
            <Select value={settings.aiRuntime.speed} options={[{ value: "fast", label: "短输出 · 最多 1024" }, { value: "balanced", label: "使用下方上限" }, { value: "deep", label: "加长输出 · 至少 4096" }]} onChange={(value) => updateSettings("aiRuntime", { ...settings.aiRuntime, speed: value })} />
          </SettingRow>
          <SettingRow title="最大输出 tokens" description="作为 LFAA 的输出 token 上限，服务端最多发送 16384 tokens；Provider 或所选型号限制更低时仍以其限制为准。">
            <Input type="number" min={256} max={16384} step={256} value={settings.aiRuntime.maxOutputTokens} onChange={(event) => updateSettings("aiRuntime", { ...settings.aiRuntime, maxOutputTokens: Math.max(256, Math.min(16384, Number(event.target.value) || 256)) })} />
          </SettingRow>
          <SettingRow title="请求超时" description="模型请求等待 Provider 的最长时间。">
            <Input type="number" min={10} max={300} value={settings.aiRuntime.requestTimeoutSeconds} onChange={(event) => updateSettings("aiRuntime", { ...settings.aiRuntime, requestTimeoutSeconds: Math.max(10, Math.min(300, Number(event.target.value) || 10)) })} />
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
          <SettingRow title="每轮模型请求上限" description="限制一次任务的模型调用次数；达到预算后停止并保留已执行结果。">
            <InputNumber min={1} max={100} value={settings.aiRuntime.maxModelRequests} onChange={(value) => value !== null && updateSettings("aiRuntime", { ...settings.aiRuntime, maxModelRequests: value })} />
          </SettingRow>
          <SettingRow title="每轮工具调用上限" description="限制一次任务中实际尝试的工具调用数；不会重放已经执行的操作。">
            <InputNumber min={1} max={200} value={settings.aiRuntime.maxToolCalls} onChange={(value) => value !== null && updateSettings("aiRuntime", { ...settings.aiRuntime, maxToolCalls: value })} />
          </SettingRow>
          <SettingRow title="提示词建议" description="在空会话输入区显示当前应用的示例任务。">
            <SettingsSwitch label="提示词建议" checked={settings.aiRuntime.promptSuggestions} onChange={() => updateSettings("aiRuntime", { ...settings.aiRuntime, promptSuggestions: !settings.aiRuntime.promptSuggestions })} />
          </SettingRow>
          <SettingRow title="显示上下文使用情况" description="显示 Provider 返回的真实 token 用量；未提供用量时明确显示“Provider 未提供”。">
            <SettingsSwitch label="显示上下文使用情况" checked={settings.aiRuntime.showContextUsage} onChange={() => updateSettings("aiRuntime", { ...settings.aiRuntime, showContextUsage: !settings.aiRuntime.showContextUsage })} />
          </SettingRow>
        </SettingGroup>
        <SettingsActions saving={saving === "aiRuntime"} onReset={() => resetSettings("aiRuntime")} onSave={() => void persistSettings("aiRuntime")} />
      </section>
    );

    if (activeSection === "usage") return (
      <section className="settings-content">
        <header className="settings-content__heading"><div><span className="settings-eyebrow">AI Work</span><Typography.Title level={2}>使用情况和计费</Typography.Title><Typography.Paragraph>查看控制端实际记录的成功模型调用与 Provider 返回的 token 用量。</Typography.Paragraph></div></header>
        <SettingGroup title="本地记录">
          <SettingRow title="成功调用次数" description="只统计已完成并写入本地会话记录的模型请求。" status="本机 SQLite"><Tag>{usage?.requestCount ?? 0} 次</Tag></SettingRow>
          <SettingRow title="输入 tokens" description="按 Provider 返回的 usage.prompt_tokens 汇总；没有返回用量的请求不参与汇总。" status={usage?.promptTokens == null ? "Provider 未提供" : "真实用量"}><Tag>{usage?.promptTokens == null ? "—" : usage.promptTokens.toLocaleString("zh-CN")}</Tag></SettingRow>
          <SettingRow title="输出 tokens" description="按 Provider 返回的 usage.completion_tokens 汇总；没有返回用量的请求不参与汇总。" status={usage?.completionTokens == null ? "Provider 未提供" : "真实用量"}><Tag>{usage?.completionTokens == null ? "—" : usage.completionTokens.toLocaleString("zh-CN")}</Tag></SettingRow>
        </SettingGroup>
        <SettingGroup title="按模型">
          {usage?.providers.length ? usage.providers.map((item) => <SettingRow key={`${item.providerId}:${item.modelId}`} title={`${item.providerId} · ${item.modelId}`} description={`成功调用 ${item.requestCount} 次；输入 ${item.promptTokens?.toLocaleString("zh-CN") ?? "未提供"}，输出 ${item.completionTokens?.toLocaleString("zh-CN") ?? "未提供"} tokens。`} status="本地统计"><Tag>不含费用</Tag></SettingRow>) : <SettingRow title="尚无用量记录" description="完成一次 AI Work 对话后会显示 Provider 返回的 token 用量。" status="等待首次请求"><Tag>暂无数据</Tag></SettingRow>}
        </SettingGroup>
        <div className="settings-note-card"><strong>计费说明</strong><p>LFAA 不向 Provider 账单服务查询费用，也不按静态价格估算账单。实际费用以各 Provider 控制台为准。</p></div>
      </section>
    );

    if (activeSection === "archived") return (
      <section className="settings-content">
        <header className="settings-content__heading"><div><span className="settings-eyebrow">AI Work</span><Typography.Title level={2}>已归档的聊天</Typography.Title><Typography.Paragraph>按账户隔离保存；恢复后会回到对应应用的会话列表。</Typography.Paragraph></div></header>
        <SettingGroup title="归档会话">
          {archivedSessions.length ? archivedSessions.map((session) => <SettingRow key={session.id} title={session.title} description={`${session.appId === "steamcmd" ? "SteamCMD 开服" : session.appId === "minecraft" ? "Minecraft" : "写作"} · 最近活动 ${new Date(session.updatedAt).toLocaleString("zh-CN")}`} status="已归档"><Button onClick={() => void restoreArchivedSession(session)}>恢复会话</Button></SettingRow>) : <SettingRow title="没有归档会话" description="在 AI Work 会话列表选择归档后，会显示在这里。" status="空"><Tag>暂无数据</Tag></SettingRow>}
        </SettingGroup>
      </section>
    );

    if (activeSection === "plugins") return (
      <section className="settings-content">
        <header className="settings-content__heading"><div><span className="settings-eyebrow">扩展能力</span><Typography.Title level={2}>插件</Typography.Title><Typography.Paragraph>管理受信任的内置 Agent、Skills、专家提示、推理 Hooks 与 Tools；MCP 与外部服务请在“连接”中配置。</Typography.Paragraph></div></header>
        <Alert className="settings-inline-alert" type="warning" showIcon message="当前仅运行随 LFAA 发布的受信任内置扩展；第三方插件安装与隔离执行尚未开放。" />
        <SettingGroup title="能力目录">
          {extensions.length ? <div className="settings-extension-catalog">
            <div className="settings-extension-catalog__toolbar">
              <div className="settings-extension-catalog__filters" role="group" aria-label="按能力类型筛选">
                <button type="button" className={`settings-extension-catalog__filter${extensionKindFilter === "all" ? " is-active" : ""}`} aria-pressed={extensionKindFilter === "all"} onClick={() => setExtensionKindFilter("all")}>
                  <span>全部</span><span className="settings-extension-catalog__filter-count">{extensions.length}</span>
                </button>
                {EXTENSION_CATEGORIES.map((category) => (
                  <button key={category.kind} type="button" className={`settings-extension-catalog__filter${extensionKindFilter === category.kind ? " is-active" : ""}`} aria-label={`${category.label}，${extensionKindCounts.get(category.kind) ?? 0} 项`} aria-pressed={extensionKindFilter === category.kind} onClick={() => setExtensionKindFilter(category.kind)}>
                    <span>{category.label}</span><span className="settings-extension-catalog__filter-count">{extensionKindCounts.get(category.kind) ?? 0}</span>
                  </button>
                ))}
              </div>
              <Input className="settings-extension-catalog__search" aria-label="搜索能力目录" placeholder="搜索能力名称、说明或来源" prefix={<WorkbenchIcon name="search" size={16} />} allowClear value={extensionSearch} onChange={(event) => setExtensionSearch(event.target.value)} />
            </div>
            <div className="settings-extension-catalog__result-count" role="status" aria-live="polite">显示 {visibleExtensionCount} / {extensions.length} 项</div>
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
                        <span className="settings-extension-catalog__entry-icon"><WorkbenchIcon name={group.icon} size={21} /></span>
                        <div className="settings-extension-catalog__entry-copy">
                          <strong>{extension.name}</strong>
                          <span>{extension.description || "暂无说明。"}</span>
                        </div>
                        <div className="settings-extension-catalog__entry-meta">
                          <span>v{extension.version}</span>
                          <span title={`来源：${extension.pluginId}`}>{extension.pluginId}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div> : <div className="settings-extension-catalog__empty" role="status">
              <strong>{extensionKindFilter === "all" ? "没有找到匹配的能力" : `没有找到匹配的${EXTENSION_CATEGORIES.find((category) => category.kind === extensionKindFilter)?.label ?? ""}能力`}</strong>
              <span>试试其他关键词或类型。</span>
              <Button type="link" onClick={() => { setExtensionSearch(""); setExtensionKindFilter("all"); }}>清除筛选</Button>
            </div>}
          </div> : <SettingRow title="暂无扩展登记" description="Cordis 插件加载后，Agent、领域专家、提示词、技能和工具会显示在此。" status="空目录"><Tag>0 项</Tag></SettingRow>}
        </SettingGroup>
        <SettingGroup title="Cordis 模块管理">
          <SettingRow title="当前运行组合" description={`已运行 ${activeRuntimePluginCount}/${runtimePlugins.length} 个模块；核心依赖 ${runtimePluginHostReady ? "正常" : "未就绪"}。管理员操作立即生效，并保存为此控制端的全局配置。`} status={runtimePluginHostReady ? "核心模块正常" : "需要检查"}><Tag color={runtimePluginHostReady ? "green" : "orange"}>{canAdmin ? "管理员可管理可选模块" : "只读"}</Tag></SettingRow>
          <SettingRow title="源码热重载" description={hotReloadEnabled ? "开发环境源码监听器正在运行；修改 packages/ 内的受信任模块后由 Cordis 自动热替换，进行中的任务仍保留启动时使用的模块版本。" : "当前没有活动的源码监听器。正式运行环境不监听源码；启用开发环境 HMR 模块后才会自动热替换代码。"} status={hotReloadEnabled ? "自动热重载可用" : "未监听源码"}><Tag color={hotReloadEnabled ? "green" : "default"}>{hotReloadEnabled ? "免重启代码热替换" : "不可用"}</Tag></SettingRow>
          <Alert className="settings-inline-alert" type="warning" showIcon message="停止可选模块会立即撤销其服务和资源；依赖模块或正在执行的相关请求可能受影响。‘重建实例’会重新运行模块，但不会替换已缓存的源码。第三方插件安装与隔离执行尚未开放。" />
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
          {runtimeHooks.length ? runtimeHooks.map((hook) => <SettingRow key={hook.id} title={hook.id} description={`订阅事件：${hook.events.map((event) => event === "beforeInference" ? "推理前" : "推理后").join("、")}`} status="受信任插件"><Tag>生命周期钩子</Tag></SettingRow>) : <SettingRow title="暂无已注册钩子" description="AI 推理钩子通过 Cordis 插件生命周期注册；钩子只能观察元数据，不能改变权限或 Provider 请求。" status="空目录"><Tag>0 项</Tag></SettingRow>}
        </SettingGroup>
        <SettingGroup title="运行策略">
          <SettingRow title="允许 AI Work 使用扩展" description="关闭后，模型仍可对话，但登记的 Skills、Experts、Prompts 和 Tools 不会加入运行时。">
            <SettingsSwitch label="启用扩展" checked={settings.plugins.enabled} onChange={() => updateSettings("plugins", { ...settings.plugins, enabled: !settings.plugins.enabled })} />
          </SettingRow>
        </SettingGroup>
          <SettingGroup title="MCP 连接">
            {settings.plugins.mcpServers.map((server, index) => {
              const change = (patch: Partial<typeof server>) => updateSettings("plugins", { ...settings.plugins, mcpServers: settings.plugins.mcpServers.map((item, position) => position === index ? { ...item, ...patch } : item) });
              return <SettingRow key={server.id} title={server.name || "MCP 服务"} description="连接已运行的 Streamable HTTP 服务。地址不能包含密钥；需要认证的服务须先配置本机代理。">
                <Space direction="vertical"><Input aria-label="MCP 服务名称" value={server.name} maxLength={80} onChange={event => change({ name: event.target.value })} /><Input aria-label="MCP 服务地址" value={server.url} maxLength={1024} placeholder="http://127.0.0.1:端口/mcp" onChange={event => change({ url: event.target.value })} /><Space><SettingsSwitch label="连接 MCP" checked={server.enabled} onChange={() => change({ enabled: !server.enabled })} /><Button onClick={() => updateSettings("plugins", { ...settings.plugins, mcpServers: settings.plugins.mcpServers.filter(item => item.id !== server.id) })}>移除</Button></Space></Space>
              </SettingRow>;
            })}
            <Button disabled={settings.plugins.mcpServers.length >= 16} onClick={() => updateSettings("plugins", { ...settings.plugins, mcpServers: [...settings.plugins.mcpServers, { id: `m${crypto.randomUUID().slice(0, 12)}`, name: "", url: "", enabled: false }] })}>添加 MCP 服务</Button>
          </SettingGroup>
          <div className="settings-note-card"><strong>运行安全边界</strong><p>扩展工具必须提供真实执行实现；MCP 服务由你配置和运行，其工具沿用项目权限模式。模型不能自行添加连接。当前连接不支持 OAuth 或 stdio。</p></div>
        <SettingsActions saving={saving === "plugins"} onReset={() => resetSettings("plugins")} onSave={() => void persistSettings("plugins")} />
      </section>
    );

    if (activeSection === "permissions") return (
      <section className="settings-content">
        <header className="settings-content__heading"><div><span className="settings-eyebrow">本机账户</span><Typography.Title level={2}>用户与权限</Typography.Title><Typography.Paragraph>管理账户角色、项目 AI 权限模式与账户恢复。</Typography.Paragraph></div></header>
        <SettingGroup title="项目权限模式">
          <SettingRow title="项目权限模式" description="控制 AI Work 是否需要逐项审批项目操作；完全权限下，模型自主决定并执行。">
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
          <SettingRow title="替我审批" description="未记住的写入或高风险操作先由你批准；你选择记住后，完全匹配的后续操作自动执行。" status={settings.permissions.mode === "approve_remembered" ? "当前选择" : undefined}>
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
              <Popconfirm title="批准这项操作？" description={`${approval.summary}；目标范围：${approval.scopeSummary}。只授权此参数摘要对应的单次操作，有效 5 分钟。`} okText="批准" cancelText="取消" onConfirm={() => confirmApproval(approval)}>
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
            <Popconfirm title="撤销这条记忆授权？" description="在“替我审批”模式下，匹配的后续操作会自动执行；撤销后需要重新逐项批准。" okText="撤销授权" cancelText="保留" onConfirm={() => void revokePermissionGrant(grant)}>
              <Button danger size="small">撤销</Button>
            </Popconfirm>
          </SettingRow>) : <SettingRow title="没有已记住的授权" description="记忆授权按账户、应用、工具版本、风险和目标范围保存；仅在“替我审批”模式下生效。" status="0 项"><Tag>未授权</Tag></SettingRow>}
        </SettingGroup>
        <SettingGroup title="当前账户">
          <SettingRow title={user.username} description="当前登录账户" status="已登录"><Tag color={canAdmin ? "blue" : "default"}>{userRoleLabel(user.role)}</Tag></SettingRow>
          <SettingRow title="角色模型" description="当前版本提供管理员与普通账户两种固定角色；细粒度 Permission 规则尚未接入。" status="部分接入"><Tag>管理员 / 普通账户</Tag></SettingRow>
        </SettingGroup>
        <SettingsActions saving={saving === "permissions"} onReset={() => resetSettings("permissions")} onSave={() => void persistSettings("permissions")} />
      </section>
    );

    if (activeSection === "workspace") return (
      <section className="settings-content">
        <header className="settings-content__heading"><div><span className="settings-eyebrow">数据与目录</span><Typography.Title level={2}>项目与存储</Typography.Title><Typography.Paragraph>管理本机 LFAA 数据根目录，以及 Steam 游戏和 Minecraft 实例在各节点中的相对存储目录；SteamCMD 工具安装配置单独位于“SteamCMD 配置”。</Typography.Paragraph></div></header>
        {!canAdmin ? <Alert className="settings-inline-alert" type="warning" showIcon message="应用存储路径由管理员配置。" /> : null}
        {canAdmin ? <>
          <SettingGroup title="Steam 游戏存储范围">
            <SettingRow title="Steam 游戏目录范围" description="选择 Steam 游戏目录的编辑范围。全局默认供未单独覆盖的节点使用；此范围不会改变 SteamCMD 安装配置或 Minecraft 实例存储。" status={selectedSteamcmdStorageNode ? "节点覆盖" : "全局默认"}>
              <Select value={selectedSteamcmdStorageNodeId || "__defaults__"} options={[{ value: "__defaults__", label: "全局默认设置" }, ...steamcmdNodes.map((node) => ({ value: node.id, label: node.displayName + " · " + (node.status === "online" ? "在线" : "离线") }))]} onChange={selectSteamcmdStorageNode} />
            </SettingRow>
          </SettingGroup>
          {steamcmdNodes.length === 0 && minecraftStorageNodes.length === 0 ? <Alert className="settings-inline-alert" type="info" showIcon message={loadingSection === "workspace" ? "正在读取 daemon 节点…" : "当前没有已登记的 Daemon 节点"} description="Steam 游戏与 Minecraft 的默认目录可先保存；节点连接后会按各自默认目录工作。" /> : null}
          <SettingGroup title="Steam 游戏存储">
            <SettingRow title="Steam 游戏默认目录" description={"完整位置：" + displaySteamcmdPath(selectedSteamcmdStorageNode, steamcmdStorageDraft.gameDirectory || "games/steamcmd") + "。之后的新 Steam 游戏服务端部署会使用此目录；目录变更不移动已有文件。"} status={selectedSteamcmdStorageNode?.storageConfigured ? "节点目录" : "默认下载目录"}>
              <Input value={steamcmdStorageDraft.gameDirectory} onChange={(event) => setSteamcmdStorageDraft({ gameDirectory: event.target.value })} placeholder="games/steamcmd" disabled={steamcmdAction !== null} />
            </SettingRow>
            <SettingRow title="操作" description="只保存 Steam 游戏文件目录；SteamCMD 工具安装目录在“SteamCMD 配置”中单独保存。">
              <Space wrap>
                <Button onClick={() => setSteamcmdStorageDraft({ gameDirectory: "games/steamcmd" })}>恢复推荐位置</Button>
                <Button type="primary" loading={steamcmdAction === "save"} disabled={steamcmdAction !== null} onClick={() => void saveSteamcmdStorageConfiguration()}>{selectedSteamcmdStorageNode ? "保存当前节点目录" : "保存默认目录"}</Button>
              </Space>
            </SettingRow>
          </SettingGroup>
          <SettingGroup title={selectedMinecraftStorageNode ? "Minecraft 节点存储" : "Minecraft 默认存储"}>
            <SettingRow title="Minecraft 存储范围" description="单独选择 Minecraft 实例目录的编辑范围；切换此项不会更改 Steam 游戏目录范围。" status={selectedMinecraftStorageNode ? "节点覆盖" : "全局默认"}>
              <Select value={selectedMinecraftStorageNodeId || "__defaults__"} options={[{ value: "__defaults__", label: "全局默认设置" }, ...minecraftStorageNodes.map((node) => ({ value: node.id, label: node.displayName + " · " + (node.status === "online" ? "在线" : "离线") }))]} onChange={selectMinecraftStorageNode} />
            </SettingRow>
            <SettingRow title={selectedMinecraftStorageNode ? "当前节点" : "配置范围"} description={selectedMinecraftStorageNode ? selectedMinecraftStorageNode.displayName + " · " + (selectedMinecraftStorageNode.status === "online" ? "实例存储在此节点的数据根目录内。" : "节点离线；路径可保存，节点上线后生效。") : (minecraftStorageNodes.length ? "所有未单独覆盖的节点" : "等待 Windows x64 Daemon 接入") + "；可以在没有 Daemon 时先保存默认目录。"} status="存储状态">
              <Tag color={selectedMinecraftStorageNode?.settingsConfigured ? "blue" : minecraftStorageDefaultsConfigured ? "blue" : "default"}>{selectedMinecraftStorageNode?.settingsConfigured ? "节点已覆盖" : minecraftStorageDefaultsConfigured ? "默认路径已保存" : "推荐默认值"}</Tag>
            </SettingRow>
            <SettingRow title="Minecraft 实例根目录" description={"完整位置：" + displaySteamcmdPath(selectedMinecraftStorageNode, minecraftStorageDraft.instanceDirectory || "games/minecraft") + "。新实例会在根目录下各自保留独立子目录；更改目录不迁移已有实例。"}>
              <Input value={minecraftStorageDraft.instanceDirectory} onChange={(event) => setMinecraftStorageDraft({ instanceDirectory: event.target.value })} placeholder="games/minecraft" disabled={steamcmdAction !== null} />
            </SettingRow>
            <SettingRow title="操作" description="只保存 Minecraft 实例存储目录。">
              <Button type="primary" loading={steamcmdAction === "save"} disabled={steamcmdAction !== null} onClick={() => void saveMinecraftStorageConfiguration()}>{selectedMinecraftStorageNode ? "保存当前节点目录" : "保存默认目录"}</Button>
            </SettingRow>
          </SettingGroup>
          <SettingGroup title="写作作品存储">
            <SettingRow title="建议路径" description="按用户隔离作品目录的建议位置：控制端 / projects/writing/<用户 ID>，相对于控制端实际运行环境的 LFAA_DATA_DIR。" status="尚未接入"><Tag>预留建议路径</Tag></SettingRow>
            <SettingRow title="当前状态" description="当前写作会话和消息保存在控制端 SQLite 数据库。作品目录暂未接入读写或文件管理，因此这个路径现在不会创建目录或保存文件。"><Tag>SQLite 会话存储</Tag></SettingRow>
          </SettingGroup>
        </> : null}
        <SettingGroup title="控制端数据">
          <SettingRow title="账户与设置数据库" description="保存账户、会话、用户偏好和加密后的 AI Provider 配置。" status={health?.persistence === "ready" ? "已连接" : "不可用"}><Tag>{health?.persistence === "ready" ? "SQLite · 已连接" : "SQLite · 未连接"}</Tag></SettingRow>
          <SettingRow title="游戏服务器文件" description="SteamCMD、Minecraft 实例、Java 环境、插件、日志和备份由各自 Daemon 节点管理；应用存储设置决定新内容使用的默认目录。" status="按节点管理"><Tag>节点数据目录</Tag></SettingRow>
          {canAdmin && dataDirectorySettings ? <SettingRow title="本机数据根目录" description="数据库、凭据和本机节点文件都从此目录读取。改动会在下一次完整重启时复制并核对全部数据；原目录会保留。" status={dataDirectorySettings.pendingDirectory ? "等待重启迁移" : "当前生效"}>
            <Space direction="vertical" size="small" style={{ width: "100%" }}>
              <Typography.Text code copyable>{dataDirectorySettings.currentDirectory}</Typography.Text>
              {dataDirectorySettings.pendingDirectory ? <>
                <Alert className="settings-inline-alert" type="warning" showIcon message={`下次完整重启会迁移到：${dataDirectorySettings.pendingDirectory}`} description={dataDirectorySettings.pendingError ? `${dataDirectorySettings.pendingError} 停止本机实例后，可保留或更新目标并重启重试。` : "先停止本机 Minecraft 实例和正在执行的任务，再通过项目启动器或桌面程序完整重启。复制并核对成功后才会切换。"} />
                <Button loading={dataDirectoryAction === "cancel"} disabled={dataDirectoryAction !== null} onClick={() => void cancelDataDirectoryConfiguration()}>取消待处理迁移</Button>
              </> : null}
              {dataDirectorySettings.editable ? <>
                <Space wrap style={{ width: "100%" }}>
                  <Input aria-label="LFAA 数据根目录" value={dataDirectoryDraft} maxLength={2048} placeholder="输入绝对目录路径，例如 D:\\LFAA-Data" disabled={dataDirectoryAction !== null} onChange={(event) => setDataDirectoryDraft(event.target.value)} />
                  {isDesktopApp() ? <Button disabled={dataDirectoryAction !== null} onClick={() => void chooseDataDirectoryConfiguration()}>选择文件夹</Button> : null}
                </Space>
                <Space wrap>
                  <Button type="primary" loading={dataDirectoryAction === "save"} disabled={dataDirectoryAction !== null || !dataDirectoryDraft.trim()} onClick={() => void saveDataDirectoryConfiguration()}>{dataDirectorySettings.pendingDirectory ? "更新迁移目标" : "保存并安排迁移"}</Button>
                </Space>
              </> : <Alert className="settings-inline-alert" type="info" showIcon message="此运行环境由启动配置管理数据位置" description={dataDirectorySettings.unavailableReason ?? "请修改 LFAA_DATA_DIR 部署配置并使用持久化目录。"} />}
            </Space>
          </SettingRow> : <SettingRow title="数据根目录" description="本机绝对路径仅对管理员显示和管理；普通账户不会收到主机路径。" status={canAdmin ? "读取中" : "管理员管理"}><Tag>{canAdmin ? "读取中" : "按部署配置管理"}</Tag></SettingRow>}
        </SettingGroup>
      </section>
    );

    if (activeSection === "account") return (
      <section className="settings-content">
        <header className="settings-content__heading"><div><span className="settings-eyebrow">账户管理</span><Typography.Title level={2}>账户</Typography.Title><Typography.Paragraph>查看和管理本机 LFAA 用户账户。</Typography.Paragraph></div></header>
        {user.role === "super_admin" ? <AdminUsersPage userId={user.id} /> : <Alert type="warning" showIcon message="只有超级管理员可以管理本机账户。" />}
      </section>
    );

    if (activeSection === "configuration") return (
      <section className="settings-content">
        <header className="settings-content__heading"><div><span className="settings-eyebrow">SteamCMD 专项配置</span><Typography.Title level={2}>SteamCMD 配置</Typography.Title><Typography.Paragraph>管理 SteamCMD 安装方式和工具目录。工具目录相对于目标节点自己的 LFAA_DATA_DIR；Steam 游戏与 Minecraft 存储目录在“项目与存储”中独立管理。</Typography.Paragraph></div></header>
        {!canAdmin ? <Alert className="settings-inline-alert" type="warning" showIcon message="SteamCMD 安装配置由管理员管理。" /> : null}
        {canAdmin ? <>
          <SettingGroup title="SteamCMD 配置范围">
            <SettingRow title="编辑配置" description="选择全局默认或一个节点的安装配置。全局默认供未单独覆盖的节点使用；这个选择只决定编辑和保存哪份配置。" status={selectedSteamcmdConfigurationNode ? "节点覆盖" : "全局默认"}>
              <Select value={selectedSteamcmdConfigurationNodeId || "__defaults__"} options={[{ value: "__defaults__", label: "全局默认设置" }, ...steamcmdNodes.map((node) => ({ value: node.id, label: node.displayName + " · " + (node.status === "online" ? "在线" : "离线") }))]} onChange={selectSteamcmdConfigurationNode} />
            </SettingRow>
          </SettingGroup>
        </> : null}
        {canAdmin && steamcmdNodes.length === 0 ? <Alert className="settings-inline-alert" type="info" showIcon message={loadingSection === "configuration" ? "正在读取 daemon 节点…" : "当前没有已登记的 Windows x64 Daemon"} description="仍可保存 SteamCMD 全局默认配置；节点上线后可在下方选择安装目标。" /> : null}
        {canAdmin ? <>
          <SettingGroup title={selectedSteamcmdConfigurationNode ? "SteamCMD 节点配置" : "SteamCMD 默认配置"}>
            <SettingRow title="当前状态" description={selectedSteamcmdConfigurationNode ? selectedSteamcmdConfigurationNode.displayName + " · " + (selectedSteamcmdConfigurationNode.status === "online" ? "在线；可在下方单独选择安装目标。" : "节点离线；仍可保存此节点配置。") : "所有未单独覆盖的节点使用此默认配置；安装目标在下方独立选择。"} status="安装配置">
              <Tag color={selectedSteamcmdConfigurationNode?.configurationConfigured ? "blue" : steamcmdConfigurationDefaultsConfigured ? "blue" : "default"}>{selectedSteamcmdConfigurationNode?.configurationConfigured ? "节点已覆盖" : steamcmdConfigurationDefaultsConfigured ? "默认配置已保存" : "推荐默认值"}</Tag>
            </SettingRow>
            <SettingRow title="安装模式" description={steamcmdConfigurationDraft.installMode === "online" ? "从 Valve 官方 CDN 下载并安装 SteamCMD。" : "使用目录中已有的 steamcmd.exe，并在校验时启动它。"}>
              <Radio.Group value={steamcmdConfigurationDraft.installMode} onChange={(event) => updateSteamcmdConfigurationDraft("installMode", event.target.value)} optionType="button" buttonStyle="solid" options={[{ label: "在线安装", value: "online" }, { label: "手动指定", value: "manual" }]} />
            </SettingRow>
            <SettingRow title="SteamCMD 安装目录" description={"完整位置：" + displaySteamcmdPath(selectedSteamcmdConfigurationNode, steamcmdConfigurationDraft.steamcmdDirectory || "lib/steamcmd") + "。目录必须在目标节点 LFAA_DATA_DIR 内。"}>
              <Input value={steamcmdConfigurationDraft.steamcmdDirectory} onChange={(event) => updateSteamcmdConfigurationDraft("steamcmdDirectory", event.target.value)} placeholder="lib/steamcmd" disabled={steamcmdAction !== null} />
            </SettingRow>
            <SettingRow title="操作" description="保存此范围的 SteamCMD 专项配置，不会修改游戏文件或 Minecraft 实例目录。">
              <Space wrap>
                <Button onClick={() => setSteamcmdConfigurationDraft({ installMode: "online", steamcmdDirectory: "lib/steamcmd" })}>恢复推荐配置</Button>
                <Button type="primary" loading={steamcmdAction === "save"} disabled={steamcmdAction !== null} onClick={() => void saveSteamcmdConfiguration()}>{selectedSteamcmdConfigurationNode ? "保存当前节点配置" : "保存默认配置"}</Button>
              </Space>
            </SettingRow>
          </SettingGroup>
          <SettingGroup title="安装与校验">
            <SettingRow title="安装目标节点" description="单独选择实际执行任务的 Windows x64 节点。任务读取目标节点当前生效的已保存配置；不会自动保存上方正在编辑的草稿。" status={selectedSteamcmdInstallNode ? selectedSteamcmdInstallNode.status === "online" ? "已选择" : "节点离线" : "尚未选择"}>
              <Select allowClear placeholder="选择安装目标节点" value={selectedSteamcmdInstallNodeId || undefined} options={steamcmdNodes.map((node) => ({ value: node.id, label: node.displayName + " · " + (node.status === "online" ? "在线" : "离线") }))} onChange={(nodeId) => { setSelectedSteamcmdInstallNodeId(nodeId ?? ""); setSteamcmdTask(null); }} />
            </SettingRow>
            <SettingRow title="目标节点当前生效配置" description={selectedSteamcmdInstallNode ? (selectedSteamcmdInstallNode.configuration.installMode === "online" ? "在线安装" : "手动指定") + " · " + displaySteamcmdPath(selectedSteamcmdInstallNode, selectedSteamcmdInstallNode.configuration.steamcmdDirectory) + (selectedSteamcmdInstallNode.configurationConfigured ? " · 节点覆盖" : " · 使用全局默认") : "选择目标节点后显示其生效模式和安装目录。"} status={selectedSteamcmdInstallNode?.steamcmdInstalled ? "SteamCMD 已安装" : selectedSteamcmdInstallNodeCanRunTasks ? "可执行任务" : "等待可用节点"}>
              <Tag color={selectedSteamcmdInstallNode?.steamcmdInstalled ? "green" : selectedSteamcmdInstallNodeCanRunTasks ? "blue" : "default"}>{selectedSteamcmdInstallNode?.steamcmdInstalled ? "已安装" : selectedSteamcmdInstallNodeCanRunTasks ? "在线" : selectedSteamcmdInstallNode ? "不可执行" : "未选择"}</Tag>
            </SettingRow>
            <SettingRow title="操作" description={selectedSteamcmdInstallNodeCanRunTasks ? "安装和校验任务提交到上方所选节点。" : "请选择在线且支持 SteamCMD 任务的 Windows x64 Daemon。"}>
              <Space wrap>
                <Button loading={steamcmdAction === "verify"} disabled={!selectedSteamcmdInstallNodeCanRunTasks || steamcmdAction !== null} onClick={() => void submitSteamcmdTask("verify")}>校验 SteamCMD</Button>
                <Button type="primary" loading={steamcmdAction === "install"} disabled={!selectedSteamcmdInstallNodeCanRunTasks || selectedSteamcmdInstallNode?.configuration.installMode !== "online" || steamcmdAction !== null} onClick={() => void submitSteamcmdTask("install")}>开始安装</Button>
              </Space>
            </SettingRow>
            {selectedSteamcmdInstallNode && steamcmdTask?.nodeId === selectedSteamcmdInstallNode.id ? <SettingRow title="最近任务" description={steamcmdTask.message} status="安装任务">
              <Progress percent={steamcmdTask.progress} status={steamcmdTask.status === "failed" ? "exception" : steamcmdTask.status === "succeeded" ? "success" : "active"} />
            </SettingRow> : null}
          </SettingGroup>
          {steamcmdNodes.length === 0 ? <Alert className="settings-inline-alert" type="info" showIcon message={loadingSection === "configuration" ? "正在读取 daemon 节点…" : "当前没有已登记的 Windows x64 Daemon"} description="仍可保存 SteamCMD 全局默认配置；节点上线后可在“安装目标节点”中选择它。" /> : null}
        </> : null}
      </section>
    );

    const pending = pendingSections[activeSection];
    if (pending) {
      const selectedSection = sections.find((section) => section.id === activeSection);
      return (
        <section className="settings-content">
          <header className="settings-content__heading"><div><span className="settings-eyebrow">{selectedSection?.group}</span><Typography.Title level={2}>{selectedSection?.title}</Typography.Title><Typography.Paragraph>{pending.description}</Typography.Paragraph></div></header>
          <SettingGroup title="功能状态">
            <SettingRow title={selectedSection?.title ?? "设置模块"} description={pending.description} status="当前版本状态"><Tag>{pending.status}</Tag></SettingRow>
          </SettingGroup>
          {activeSection === "personalization" ? <Button type="primary" onClick={() => selectSection("appearance")}>打开外观设置</Button> : null}
          {activeSection === "environment" ? <Button type="primary" onClick={() => selectSection("general")}>查看常规环境偏好</Button> : null}
          <div className="settings-note-card"><strong>接入说明</strong><p>此入口已保留在设置导航中。相关宿主能力接入后，会在此页提供可实际使用的配置项和运行状态。</p></div>
        </section>
      );
    }

    return (
      <section className="settings-content">
        <header className="settings-content__heading"><div><span className="settings-eyebrow">运行信息</span><Typography.Title level={2}>开发者</Typography.Title><Typography.Paragraph>查看客户端与控制端连接状态。</Typography.Paragraph></div><Button onClick={() => void refreshHealth()}>刷新状态</Button></header>
        <SettingGroup title="运行环境">
          <SettingRow title="项目版本" description="LFAA 当前项目版本。" status="当前版本"><Tag>LFAA 0.1.1</Tag></SettingRow>
          <SettingRow title="控制端" description={health?.timestamp ? `最近检查：${new Date(health.timestamp).toLocaleString("zh-CN")}` : "尚未获取检查时间。"} status={serverState === "checking" ? "检查中" : health?.status === "ok" ? "运行中" : "未连接"}><Tag color={health?.status === "ok" ? "green" : "red"}>{serverState === "checking" ? "检查中" : health?.status === "ok" ? "在线" : "离线"}</Tag></SettingRow>
          <SettingRow title="当前客户端" description={`${navigator.platform} · ${window.location.origin}`} status="已连接"><Tag>Web 界面</Tag></SettingRow>
        </SettingGroup>
        <div className="settings-note-card"><strong>诊断信息</strong><p>日志、运行时配置编辑和开发工具暂未接入设置中心。密钥与本机绝对路径不会显示在浏览器诊断信息中。</p></div>
      </section>
    );
  })();

  const sidebar = (
    <aside className="settings-sidebar">
        <header className="settings-sidebar__header"><Button type="text" onClick={onBack}>← 返回工作台</Button><Typography.Title level={4}>设置</Typography.Title><Button className="settings-sidebar-collapse" type="text" aria-label="收起设置导航" title="收起设置导航" onClick={() => setSidebarCollapsed(true)}>×</Button></header>
        <form className="settings-search-form" role="search" autoComplete="off" onSubmit={(event) => event.preventDefault()}>
          <Input type="search" name="settings-category-search" autoComplete="off" allowClear placeholder="搜索设置" value={search} onChange={(event) => updateSettingsSearch(event.target.value)} aria-label="搜索设置分类" />
        </form>
        <nav ref={settingsNavigationScroll.ref} onScroll={settingsNavigationScroll.onScroll} className="settings-nav" aria-label="设置分类">
          {[...new Set(visibleSections.map((item) => item.group))].map((group, index) => {
            const groupId = `settings-nav-items-${index}`;
            const groupSections = visibleSections.filter((item) => item.group === group);
            const isExpanded = (search.trim() ? searchExpandedSettingsGroups : expandedSettingsGroups).has(group);
            return (
              <section key={group} className={isExpanded ? "settings-nav__section is-expanded" : "settings-nav__section"}>
                <button type="button" className="settings-nav__group" aria-expanded={isExpanded} aria-controls={groupId} onClick={() => toggleSettingsGroup(group)}><span>{group}</span></button>
                <div id={groupId} className="settings-nav__items" aria-hidden={!isExpanded}>
                  <div className="settings-nav__items-inner">
                    {groupSections.map((item) => <button key={item.id} type="button" tabIndex={isExpanded ? 0 : -1} className={activeSection === item.id ? "is-active" : ""} onClick={() => selectSection(item.id)}><WorkbenchIcon name={item.icon} size={18} />{item.title}</button>)}
                  </div>
                </div>
              </section>
            );
          })}
          {visibleSections.length === 0 ? <p className="settings-empty-search">没有匹配的设置分类。</p> : null}
        </nav>
        <div className="settings-sidebar__account"><span className="settings-avatar">{user.username.slice(0, 1).toLocaleUpperCase()}</span><span><strong>{user.username}</strong><small>{userRoleLabel(user.role)}</small></span></div>
    </aside>
  );
  const activeSettingsCategory = settingsCategoryForSection(activeSection);
  const activeError = (providerModalOpen ? undefined : error) || sectionErrors[activeSection] || (activeSettingsCategory ? settingsSaveErrors[activeSettingsCategory] : undefined);
  const main = (
    <main ref={settingsContentScroll.ref} className="settings-main" onScroll={settingsContentScroll.onScroll}>
      {sidebarCollapsed ? <Button className="settings-sidebar-open" aria-label="展开设置导航" onClick={() => setSidebarCollapsed(false)}>☰ 设置菜单</Button> : null}
        {activeError ? <Alert className="settings-page-alert" type="error" showIcon message={activeError} closable onClose={() => { setError(""); setSectionErrors((current) => ({ ...current, [activeSection]: undefined })); }} /> : null}
        {loadingSection === activeSection ? <div className="settings-loading"><span className="loading-indicator" /><span>正在读取设置…</span></div> : sectionContent}
    </main>
  );

  return (
    <div className="settings-page" aria-label="设置中心">
      {messageContext}
      {permissionModalContext}
      <div ref={rootRef} className="settings-page__stage">
        <GlobalNavigationRail
          username={user.username}
          role={user.role}
          serverState={serverState}
          shortcuts={settings.shortcuts}
          activePage="settings"
          homeLabel="返回进入设置前的位置"
          onHome={onBack}
          onApplicationsHome={() => onNavigate("/")}
          onOpenFiles={() => onNavigate("/files")}
          onOpenSettings={onOpenSettings}
          onLogout={onLogout}
        />
        <ResizableWorkbench
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
      </div>
      <Modal title="无项目任务文件夹" open={folderModalOpen} okText="保存路径" cancelText="取消" onCancel={() => setFolderModalOpen(false)} onOk={() => { updateGeneral({ taskFolder: folderDraft.trim() }); setFolderModalOpen(false); }}>
        <Typography.Paragraph type="secondary">填写桌面宿主或受控节点上的默认任务目录。Web 端不会通过此路径访问本机文件。</Typography.Paragraph>
        <Input autoFocus maxLength={512} value={folderDraft} onChange={(event) => setFolderDraft(event.target.value)} placeholder="例如：C:\\Users\\用户名\\Documents\\LFAA" />
      </Modal>
      <Modal
        title="是否记住这类操作？"
        open={approvalMemoryPrompt !== null}
        closable={false}
        maskClosable={false}
        onCancel={() => setApprovalMemoryPrompt(null)}
        footer={[
          <Button key="cancel" disabled={approvalBusyId !== null} onClick={() => setApprovalMemoryPrompt(null)}>取消审批</Button>,
          <Button key="once" disabled={approvalBusyId !== null} loading={approvalBusyId === approvalMemoryPrompt?.id} onClick={() => { if (approvalMemoryPrompt) void resolveApproval(approvalMemoryPrompt, "approved"); }}>仅批准一次</Button>,
          <Button key="remember" type="primary" disabled={approvalBusyId !== null} loading={approvalBusyId === approvalMemoryPrompt?.id} onClick={() => { if (approvalMemoryPrompt) void resolveApproval(approvalMemoryPrompt, "approved", true); }}>保存授权并批准本次</Button>
        ]}
      >
        <Typography.Paragraph>{approvalMemoryPrompt?.summary}</Typography.Paragraph>
        <Typography.Paragraph type="secondary">目标范围：{approvalMemoryPrompt?.scopeSummary}</Typography.Paragraph>
        <Typography.Paragraph type="secondary">记忆授权只匹配此账户、应用、工具版本、风险和目标范围；工具参数仍绑定本次单次审批。当前 AI Work 写工具即使保存了记忆授权，后续操作也会继续逐次询问。</Typography.Paragraph>
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
