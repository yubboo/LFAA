/**
 * 文件：SettingsPage.tsx
 * 作用：提供与参考项目同分类的 LFAA 配置设置中心，并复用工作台已加载的账户设置。
 * 负责：常规、外观、快捷键、AI 模型、插件能力、权限、存储和开发者页面及前端交互。
 * 不负责：模型推理、插件执行、游戏节点操作或密钥本地持久化。
 * 状态归属：账户设置由工作台传入并同步更新；分类数据仅在进入对应设置页时读取；AI 密钥由服务端加密保存。
 * 关联文件：frontend/src/api.ts、frontend/src/components/Workbench.tsx、frontend/src/components/SettingsPage.css、frontend/src/shared/scroll-restoration.ts、server/src/modules/settings/service.ts。
 * 修改注意事项：不可把 AI Secret 写入浏览器存储；未接入的宿主能力必须显示为不可用。
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { Alert, Button, Card, Input, InputNumber, Modal, Popconfirm, Select, Slider, Space, Tag, Typography, message } from "antd";
import {
  activateAiAccount,
  DEFAULT_APPEARANCE_ADVANCED_SETTINGS,
  deleteAppearanceBackground,
  deleteAiAccount,
  archiveAiSession,
  decideAiApproval,
  getErrorMessage,
  loadAiAccounts,
  loadAiApprovals,
  loadAiPermissionGrants,
  loadAiExtensions,
  loadAiSessions,
  loadAiUsage,
  loadAppearanceBackgrounds,
  loadAiProviders,
  loadHealth,
  probeAiProvider,
  reprobeAiAccount,
  saveAiAccount,
  saveRecoveryKey,
  saveSettings,
  revokeAiPermissionGrant,
  uploadAppearanceBackground,
  updateAiAccountModel,
  type AiAccount,
  type AiExtension,
  type AiRuntimeHookInfo,
  type AiProvider,
  type AiProviderProbe,
  type AiRuntimePlugin,
  type AiSession,
  type AiUsageSummary,
  type AiToolApproval,
  type AiToolPermissionGrant,
  type AppearanceBackground,
  type ServerHealth,
  type User,
  type UserSettings
} from "../api.js";
import { minecraftSceneBackgrounds } from "../assets/minecraftScenes.js";
import { cacheLoginBackground } from "../shared/login-background.js";
import { getBrowserNotificationPermission, playNotificationSound, requestBrowserNotificationPermission, sendBrowserNotification, type BrowserNotificationPermission } from "../shared/notification-runtime.js";
import { createScrollRestorationKey, useScrollRestoration } from "../shared/scroll-restoration.js";
import { ResizableWorkbench } from "../workbench/ResizableWorkbench.js";
import { resolveWorkbenchLayoutMetrics, type WorkbenchLayoutMetrics } from "../workbench/workbench-layout.config.js";
import { readWorkbenchLeftWidth, saveWorkbenchLeftWidth } from "../workbench/workbench-preferences.js";
import { WorkbenchIcon, type WorkbenchIconName } from "./workbench/shared/WorkbenchIcon.js";
import { isPasswordAcceptable, PasswordStrengthIndicator } from "./PasswordStrengthIndicator.js";
import { AdminUsersPage } from "./AdminUsersPage.js";
import "./SettingsPage.css";

const SETTINGS_LAYOUT_KEY = "lfaa.settings.layout.v2";

export const DEFAULT_USER_SETTINGS: UserSettings = {
  general: {
    defaultMode: "normal", showServiceStatus: true, showBottomPanelControl: true, taskFolder: "",
    fileOpenLocation: "system", agentEnvironment: "system", integratedShell: "system", language: "system", defaultFullView: true, navigationLayout: "three-column",
    terminalPosition: "bottom", plainTextEditor: true, sendShortcut: "enter", followupBehavior: "queue", popupShortcut: "", defaultStandaloneChat: false,
    completionNotification: "unfocused", permissionNotifications: true, questionNotifications: true, notificationSound: "default", confettiEnabled: false
  },
  appearance: { theme: "system", accentColor: "#3457d5", sidebarColor: "auto", backgrounds: { login: "forest-bridge-evening", appCenter: "cherry-blossom-shore", steamcmd: "ocean-cliff-sunset", minecraft: "cherry-blossom-village", writing: "snowy-cabin-interior", settings: "lakeside-pagoda-morning" }, overlay: 42, blur: 8, advanced: structuredClone(DEFAULT_APPEARANCE_ADVANCED_SETTINGS) },
  shortcuts: { openSettings: ["Ctrl+,"], openHome: ["Alt+0"], openSteamcmd: ["Ctrl+Alt+1"], openMinecraft: ["Ctrl+Alt+2"], openWriting: ["Ctrl+Alt+3"], toggleSidebar: ["Ctrl+B"], toggleContextPanel: ["Ctrl+Alt+B"], toggleBottomPanel: ["Ctrl+J"], openTerminal: ["Ctrl+`"], switchNormalMode: ["Alt+1"], switchAiWorkMode: ["Alt+2"] },
  aiRuntime: { speed: "balanced", promptSuggestions: true, showContextUsage: false, requestTimeoutSeconds: 90, maxOutputTokens: 2048 },
  permissions: { mode: "ask" },
  plugins: { enabled: false }
};

type SectionId = "general" | "notifications" | "import" | "profile" | "appearance" | "parental" | "trustedContacts" | "voice" | "configuration" | "personalization" | "mini" | "shortcuts" | "usage" | "account" | "plugins" | "computerControl" | "snapshots" | "browser" | "hooks" | "connections" | "cloudPreferences" | "codeReview" | "git" | "environment" | "worktrees" | "archived" | "ai" | "permissions" | "workspace" | "developer";
// 只在进入需要真实数据的分类时请求专属数据，避免首次打开设置就并发加载全部分类。
const SETTINGS_DATA_SECTIONS = new Set<SectionId>(["appearance", "usage", "plugins", "archived", "ai", "permissions", "workspace", "developer"]);

const sections: Array<{ id: SectionId; title: string; group: string; icon: WorkbenchIconName }> = [
  { id: "general", title: "常规", group: "个人", icon: "settings" },
  { id: "notifications", title: "通知", group: "个人", icon: "history" },
  { id: "import", title: "导入", group: "个人", icon: "file" },
  { id: "profile", title: "个人资料", group: "个人", icon: "user" },
  { id: "appearance", title: "外观", group: "个人", icon: "sun" },
  { id: "parental", title: "家长控制", group: "个人", icon: "shield" },
  { id: "trustedContacts", title: "受信任联系人", group: "个人", icon: "user" },
  { id: "voice", title: "语音", group: "个人", icon: "spark" },
  { id: "configuration", title: "配置", group: "个人", icon: "settings" },
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

const SETTINGS_ACTIVE_SECTION_STORAGE_KEY = "lfaa.settings.active-section.v1";
const SETTINGS_LEGACY_SCROLL_POSITION_STORAGE_KEY = "lfaa.settings.scroll-position.v1";
const SETTINGS_APPEARANCE_ADVANCED_STORAGE_KEY = "lfaa.settings.appearance-advanced-open.v1";
const SETTINGS_BACKGROUND_TARGET_STORAGE_KEY = "lfaa.settings.background-target.v1";
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
  voice: { description: "语音输入和语音播报将在 AI Work 会话宿主接入后配置。", status: "语音宿主待接入" },
  configuration: { description: "模型连接和运行参数已放在“AI 与模型”中；打开对应页面可查看当前 Provider 配置。", status: "请使用 AI 与模型" },
  personalization: { description: "主题、强调色和各工作区背景已放在“外观”中。", status: "请使用外观设置" },
  mini: { description: "轻量窗口和虚拟宠物尚未进入 LFAA 的桌面产品规划。", status: "桌面能力待接入" },
  account: { description: "查看当前账户并管理已有账户、角色和恢复密钥。", status: "账户管理已接入" },
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
  { id: "minecraft", label: "Minecraft 工作区" },
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
  if (typeof window === "undefined") return resolveWorkbenchLayoutMetrics(1280, 800);
  return resolveWorkbenchLayoutMetrics(window.innerWidth, window.innerHeight);
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
  onSettingsChange: (settings: UserSettings) => void;
}

function shortcutFromEvent(event: KeyboardEvent<HTMLInputElement>): string {
  const modifiers = [event.ctrlKey || event.metaKey ? "Ctrl" : "", event.altKey ? "Alt" : "", event.shiftKey ? "Shift" : ""].filter(Boolean);
  const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
  if (["Control", "Alt", "Shift", "Meta"].includes(event.key)) return "";
  return [...modifiers, key].join("+");
}

function shortcutIdentity(value: string): string {
  return value.split("+").map((part) => part.trim().toLocaleLowerCase()).sort().join("+");
}

function hasShortcutConflicts(shortcuts: UserSettings["shortcuts"]): boolean {
  const identities = Object.values(shortcuts).flat().filter(Boolean).map(shortcutIdentity);
  return new Set(identities).size !== identities.length;
}

export function SettingsPage({ user, serverState, settings: workbenchSettings, resolvedTheme, initialSection, onBack, onSettingsChange }: SettingsPageProps) {
  const [messageApi, messageContext] = message.useMessage();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => initialSettingsMetrics().mode === "mobile");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const layout = useSettingsLayoutMetrics(rootRef);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const initial = initialSettingsMetrics();
    return readWorkbenchLeftWidth(initial.left, initial.containerWidth);
  });
  const [activeSection, setActiveSection] = useState<SectionId>(() => getInitialSettingsSection(initialSection, user.id));
  const [search, setSearch] = useState("");
  const [appearanceAdvancedOpen, setAppearanceAdvancedOpen] = useState(() => readSettingsAppearanceAdvancedOpen(user.id));
  const [settings, setSettings] = useState<UserSettings>(workbenchSettings);
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
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [accounts, setAccounts] = useState<AiAccount[]>([]);
  const [extensions, setExtensions] = useState<AiExtension[]>([]);
  const [runtimePlugins, setRuntimePlugins] = useState<AiRuntimePlugin[]>([]);
  const [runtimeHooks, setRuntimeHooks] = useState<AiRuntimeHookInfo[]>([]);
  const [usage, setUsage] = useState<AiUsageSummary | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<AiToolApproval[]>([]);
  const [permissionGrants, setPermissionGrants] = useState<AiToolPermissionGrant[]>([]);
  const [persistedPermissionMode, setPersistedPermissionMode] = useState<UserSettings["permissions"]["mode"]>(workbenchSettings.permissions.mode);
  const [approvalMemoryPrompt, setApprovalMemoryPrompt] = useState<AiToolApproval | null>(null);
  const [approvalBusyId, setApprovalBusyId] = useState<string | null>(null);
  const [archivedSessions, setArchivedSessions] = useState<AiSession[]>([]);
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [uploadedBackgrounds, setUploadedBackgrounds] = useState<AppearanceBackground[]>([]);
  const [backgroundTarget, setBackgroundTarget] = useState<SettingsBackgroundTarget>(() => readSettingsBackgroundTarget(user.id));
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [providerId, setProviderId] = useState("openai");
  const [providerOptions, setProviderOptions] = useState<Record<string, Record<string, string>>>({});
  const [accountName, setAccountName] = useState("OpenAI 主账户");
  const [secret, setSecret] = useState("");
  const [probe, setProbe] = useState<AiProviderProbe | null>(null);
  const [selectedModel, setSelectedModel] = useState("");
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [recoveryCurrentPassword, setRecoveryCurrentPassword] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [recoveryKeyConfirmation, setRecoveryKeyConfirmation] = useState("");
  const [savingRecoveryKey, setSavingRecoveryKey] = useState(false);
  const loadedSectionsRef = useRef(new Set<SectionId>());
  const sectionLoadsRef = useRef(new Map<SectionId, Promise<void>>());
  const healthRequestRef = useRef<Promise<ServerHealth> | null>(null);
  const healthValueRef = useRef<ServerHealth | null>(null);
  const extensionsRequestRef = useRef<Promise<Awaited<ReturnType<typeof loadAiExtensions>>> | null>(null);
  const extensionsValueRef = useRef<Awaited<ReturnType<typeof loadAiExtensions>> | null>(null);
  const settingsContentScrollReady = !SETTINGS_DATA_SECTIONS.has(activeSection)
    || loadedSectionsRef.current.has(activeSection)
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
    saveWorkbenchLeftWidth(sidebarWidth, layout.left);
  }, [layout.left.max, layout.left.min, sidebarWidth]);

  useEffect(() => {
    persistSettingsSection(activeSection, user.id);
  }, [activeSection, user.id]);

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

  function selectSection(section: SectionId): void {
    setActiveSection(section);
    persistSettingsSection(section, user.id);
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
    setLoadingSection(section);
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
            const [providersResult, accountsResult] = await Promise.all([
              loadAiProviders(),
              loadAiAccounts(),
              loadHealthOnce(),
              loadExtensionsOnce()
            ] as const);
            setProviders(providersResult.providers);
            setAccounts(accountsResult.accounts);
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
          case "workspace":
          case "developer": {
            await loadHealthOnce();
            break;
          }
        }
        loadedSectionsRef.current.add(section);
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
  }, [activeSection]);

  const visibleSections = useMemo(() => {
    const value = search.trim().toLocaleLowerCase();
    return value ? sections.filter((section) => `${section.title} ${section.group}`.toLocaleLowerCase().includes(value)) : sections;
  }, [search]);

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
      setRecoveryKey("");
      setRecoveryKeyConfirmation("");
      messageApi.success("恢复密钥已保存");
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSavingRecoveryKey(false);
    }
  }

  function resetSettings<K extends keyof UserSettings>(category: K): void {
    updateSettings(category, DEFAULT_USER_SETTINGS[category]);
  }

  async function reloadAiAccounts(): Promise<void> {
    const result = await loadAiAccounts();
    setAccounts(result.accounts);
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

  function updatePermissionMode(mode: UserSettings["permissions"]["mode"]): void {
    if (mode !== "full_access") {
      updateSettings("permissions", { mode });
      return;
    }
    Modal.confirm({
      title: "启用完全权限？",
      content: "保存后，LFAA server 对已登记、适用于当前应用且具有有效目标范围的 AI 工具免逐项审批；身份、工具和业务规则仍会校验。当前尚无已接入的 AI 业务执行工具，此设置不会开放本机文件、任意 Shell 或网络命令，也不代表接受 Minecraft EULA。",
      okText: "继续启用",
      cancelText: "取消",
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
    setAiBusy("probe");
    setError("");
    try {
      const result = await probeAiProvider({ providerId, secret, options: currentProviderOptions });
      setProbe(result.result);
      setSelectedModel(result.result.models[0]?.id ?? "");
      messageApi.success(result.result.status === "connected" ? "连接成功，模型目录已更新" : "已载入官方模型目录");
    } catch (probeError) {
      setProbe(null);
      setError(getErrorMessage(probeError));
    } finally {
      setAiBusy(null);
    }
  }

  async function saveAccount(): Promise<void> {
    if (!selectedProvider || !selectedModel) return;
    setAiBusy("save");
    setError("");
    try {
      await saveAiAccount({ providerId, secret, options: currentProviderOptions, displayName: accountName, modelId: selectedModel });
      setSecret("");
      setProbe(null);
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
        setProbe(result.result);
        setSelectedModel(result.result.models[0]?.id ?? "");
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
      messageApi.success("账户默认模型已更新");
    } catch (modelError) {
      setError(getErrorMessage(modelError));
    } finally {
      setAiBusy(null);
    }
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
    default: "允许后，AI Work 回复完成时可投递系统通知。浏览器会在此操作后显示授权请求。",
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
      <SettingRow title="AI Work 回复完成" description="AI Work 成功生成回复后发送系统通知。选择“仅工作台未聚焦时”可避免前台重复提醒。" status="已接入">
        <Select value={settings.general.completionNotification} options={[{ value: "always", label: "始终" }, { value: "unfocused", label: "仅在工作台未聚焦时" }, { value: "never", label: "关闭" }]} onChange={(value) => updateGeneral({ completionNotification: value })} />
      </SettingRow>
      <SettingRow title="AI 工具权限请求" description="当前没有接入可执行 AI 工具，因此不会产生等待审批事件。事件源接入后再启用通知设置。" status="待接入">
        <Typography.Text type="secondary">等待真实审批事件源</Typography.Text>
      </SettingRow>
      <SettingRow title="AI Work 等待回答" description="当前 AI Work 只提供流式对话，没有暂停等待用户回答的任务事件。" status="待接入">
        <Typography.Text type="secondary">等待真实问题事件源</Typography.Text>
      </SettingRow>
      <SettingRow title="通知提示音" description="选择 AI Work 回复完成时的提示音；试听音量受浏览器和系统音量控制。" status="已接入">
        <Space>
          <Select value={settings.general.notificationSound} options={[{ value: "default", label: "默认" }, { value: "subtle", label: "轻柔" }, { value: "off", label: "关闭" }]} onChange={(value) => updateGeneral({ notificationSound: value })} />
          <Button onClick={testNotificationSound} disabled={settings.general.notificationSound === "off"}>试听</Button>
        </Space>
      </SettingRow>
    </SettingGroup>
  );

  const sectionContent = (() => {
    if (activeSection === "general") return (
      <section className="settings-content">
        <header className="settings-content__heading"><div><Typography.Title level={2}>常规</Typography.Title></div></header>
        <SettingGroup title="访问边界">
          <SettingRow title="AI 工具授权策略" description="账户级审批策略由 LFAA server 执行，只影响已登记的 AI 工具。请求审批、记忆授权和完全权限的具体范围见“用户与权限”。" status="账户级设置">
            <Button onClick={() => selectSection("permissions")}>管理权限</Button>
          </SettingRow>
          <SettingRow title="本机与节点访问" description="当前没有直连本机文件系统、任意 Shell 或网络命令的宿主能力。授权模式不会创建或放宽工具能力；节点任务仍需接入真实 Daemon 或业务服务，并由 server 校验目标范围。" status="执行能力未接入">
            <Tag>当前不可用</Tag>
          </SettingRow>
        </SettingGroup>
        <SettingGroup title="常规">
          <SettingRow title="无项目任务文件夹" description="AI Work 任务默认保存位置。当前保存为账户偏好；Web 版不会因填写路径而获得本机文件权限。">
            <div className="settings-folder-value" title={settings.general.taskFolder || "尚未设置"}><span>{settings.general.taskFolder || "尚未设置"}</span><Button onClick={() => { setFolderDraft(settings.general.taskFolder); setFolderModalOpen(true); }}>更改</Button></div>
          </SettingRow>
          <SettingRow title="默认文件打开位置" description="选择文件操作使用系统默认应用，或在执行时再询问。">
            <Select value={settings.general.fileOpenLocation} options={[{ value: "system", label: "系统默认应用" }, { value: "ask", label: "每次询问" }]} onChange={(value) => updateGeneral({ fileOpenLocation: value })} />
          </SettingRow>
          <SettingRow title="智能体环境" description="选择 Agent Runtime 执行任务时使用的主机环境；节点能力接入后生效。">
            <Select value={settings.general.agentEnvironment} options={[{ value: "system", label: "自动检测" }, { value: "windows-native", label: "Windows 原生" }, { value: "wsl", label: "WSL" }, { value: "linux", label: "Linux" }]} onChange={(value) => updateGeneral({ agentEnvironment: value })} />
          </SettingRow>
          <SettingRow title="集成终端 Shell" description="选择集成终端默认打开的 Shell；当前终端执行后端尚未接入。">
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
          <SettingRow title="默认终端位置" description="选择终端快捷入口的默认面板位置；目前仅提供底部终端面板。">
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
          <SettingRow title="默认使用独立聊天" description="在项目外开始新聊天；会话功能接入后生效。">
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
          <SettingRow title="统一侧边栏颜色" description="应用于设置导航、应用导航和工具资源栏；可跟随当前主题或自定义颜色。" status="实时预览">
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
          <p className="settings-background-hint">图片卡片会显示背景预览；保存后应用到所选页面：{backgroundTargets.find((item) => item.id === backgroundTarget)?.label}。登录页只使用内置图片，自定义上传仍限于登录后的工作区。</p>
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
          <SettingRow title="背景遮罩" description="增加遮罩可以提高背景上的文字对比度。" status="已接入"><div className="settings-slider"><Slider min={0} max={75} value={settings.appearance.overlay} onChange={(overlay) => updateSettings("appearance", { ...settings.appearance, overlay })} /><output>{settings.appearance.overlay}%</output></div></SettingRow>
          <SettingRow title="玻璃模糊" description="调整顶栏和半透明导航栏的模糊强度；设置正文保持轻透，不做实时模糊。" status="已接入"><div className="settings-slider"><Slider min={0} max={32} value={settings.appearance.blur} onChange={(blur) => updateSettings("appearance", { ...settings.appearance, blur })} /><output>{settings.appearance.blur}px</output></div></SettingRow>
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
              <SettingRow title="半透明侧边栏" description="让设置导航和应用导航显示为半透明玻璃效果。">
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
          <SettingRow title="Cordis 插件宿主" description={`实际加载 ${runtimePlugins.filter((plugin) => plugin.enabled).length}/${runtimePlugins.length} 个宿主插件；扩展登记 ${extensions.length} 项。`} status={runtimePlugins.length > 0 && runtimePlugins.every((plugin) => plugin.enabled) && extensions.length > 0 ? "运行中" : "未就绪"}><Tag color={runtimePlugins.length > 0 && runtimePlugins.every((plugin) => plugin.enabled) && extensions.length > 0 ? "green" : "orange"}>{runtimePlugins.length > 0 && runtimePlugins.every((plugin) => plugin.enabled) && extensions.length > 0 ? "已就绪" : "检查插件页面"}</Tag></SettingRow>
          <SettingRow title="当前 Provider" description={accounts.find((account) => account.active) ? `${accounts.find((account) => account.active)!.providerId} · ${accounts.find((account) => account.active)!.modelId}` : "添加并启用账户后，AI Work 才能请求模型。"} status={accounts.some((account) => account.active) ? "已启用" : "需要配置"}><Tag color={accounts.some((account) => account.active) ? "green" : "default"}>{accounts.some((account) => account.active) ? "可推理" : "未配置"}</Tag></SettingRow>
          <SettingRow title="会话存储" description="AI Work 会话、消息和 Provider 返回的 Token 用量写入账户隔离的控制端 SQLite。" status={health?.persistence === "ready" ? "已连接" : "不可用"}><Tag>{health?.persistence === "ready" ? "SQLite · 已连接" : "SQLite · 未连接"}</Tag></SettingRow>
        </SettingGroup>
        <div className="ai-settings-layout">
          <Card className="settings-card ai-settings-editor" title="添加模型账户">
            <label className="settings-field"><span>模型提供方</span><Select value={providerId} options={providers.map((provider) => ({ value: provider.id, label: provider.name }))} onChange={(next) => { setProviderId(next); setProbe(null); setSelectedModel(""); setSecret(""); const item = providers.find((provider) => provider.id === next); setAccountName(`${item?.name ?? "AI"} 主账户`); }} /></label>
            {selectedProvider ? <p className="settings-field-help">{selectedProvider.description}</p> : null}
            {selectedProvider?.options.map((option) => <label className="settings-field" key={option.id}><span>{option.label}</span>{option.choices.length ? <Select value={currentProviderOptions[option.id] ?? (option.id === "region" && providerId === "qwen" ? "ap-southeast-1" : option.choices[0]?.value)} options={option.choices.map((choice) => ({ value: choice.value, label: choice.label }))} onChange={(value) => { setProviderOptions((current) => ({ ...current, [providerId]: { ...current[providerId], [option.id]: value } })); setProbe(null); }} /> : <Input value={currentProviderOptions[option.id] ?? ""} onChange={(event) => setProviderOptions((current) => ({ ...current, [providerId]: { ...current[providerId], [option.id]: event.target.value } }))} placeholder="输入百炼 Workspace ID" />}</label>)}
            <label className="settings-field"><span>账户名称</span><Input value={accountName} maxLength={48} onChange={(event) => setAccountName(event.target.value)} placeholder="例如：个人 API 账户" /></label>
            <label className="settings-field"><span>{providerId === "xiaomi" && currentProviderOptions.authMethod === "token-plan" ? "Token Plan Key" : "API Key"}</span><Input.Password autoComplete="new-password" value={secret} onChange={(event) => { setSecret(event.target.value); setProbe(null); }} placeholder="输入密钥，仅在保存前保留" /></label>
            <div className="settings-ai-actions"><Button loading={aiBusy === "probe"} disabled={!secret.trim() || aiBusy !== null} onClick={() => void runProbe()}>测试连接并读取模型</Button></div>
            {probe ? <Alert className="settings-ai-result" type={probe.status === "connected" ? "success" : "warning"} showIcon message={probe.message} /> : null}
            {probe?.models.length ? <label className="settings-field"><span>模型</span><Select value={selectedModel || undefined} placeholder="选择模型" options={probe.models.map((model) => ({ value: model.id, label: model.name === model.id ? model.id : `${model.name} · ${model.id}` }))} onChange={setSelectedModel} showSearch optionFilterProp="label" /></label> : null}
            <Button type="primary" block loading={aiBusy === "save"} disabled={!probe || !selectedModel || !secret.trim() || aiBusy !== null} onClick={() => void saveAccount()}>{probe?.status === "connected" ? "验证并加密保存" : "加密保存账户"}</Button>
          </Card>
          <Card className="settings-card ai-account-list" title="已保存账户" extra={<Tag>{accounts.length}</Tag>}>
            {!accounts.length ? <div className="settings-empty"><strong>还没有模型账户</strong><span>添加 Provider 后，会显示账户和模型目录。</span></div> : accounts.map((account) => <article className={`ai-account-item${account.active ? " is-active" : ""}`} key={account.id}>
              <div className="ai-account-item__header"><div><strong>{account.displayName}</strong><span>{providers.find((provider) => provider.id === account.providerId)?.name ?? account.providerId} · {account.active ? "当前模型" : "已保存"}</span></div><Tag color={account.active ? "green" : "default"}>{account.active ? "当前使用" : "未启用"}</Tag></div>
              <label className="settings-field"><span>当前模型</span><Select value={account.modelId} options={account.models.map((model) => ({ value: model.id, label: model.id }))} onChange={(modelId) => void selectAccountModel(account, modelId)} /></label>
              <div className="ai-account-item__actions">
                {!account.active ? <Button size="small" type="primary" disabled={aiBusy !== null} onClick={() => void runAccountAction(account, "activate")}>设为当前模型</Button> : null}
                <Button size="small" disabled={aiBusy !== null} loading={aiBusy === `retest:${account.id}`} onClick={() => void runAccountAction(account, "retest")}>重测</Button>
                <Popconfirm title="删除这个 AI 账户？" description="删除后，LFAA 将移除加密密钥和已保存的模型目录。" okText="删除" cancelText="取消" onConfirm={() => void runAccountAction(account, "delete")}><Button danger size="small" disabled={aiBusy !== null}>删除</Button></Popconfirm>
              </div>
            </article>)}
          </Card>
        </div>
        <SettingGroup title="推理参数">
          <SettingRow title="响应预算" description="快速限制输出在 1024 tokens 内；深入思考至少允许 4096 tokens；平衡使用下方上限。此选项控制生成长度，不保证 Provider 延迟。">
            <Select value={settings.aiRuntime.speed} options={[{ value: "fast", label: "快速 · 短输出" }, { value: "balanced", label: "平衡" }, { value: "deep", label: "深入 · 长输出" }]} onChange={(value) => updateSettings("aiRuntime", { ...settings.aiRuntime, speed: value })} />
          </SettingRow>
          <SettingRow title="最大输出 tokens" description="平衡模式的输出上限；快速模式最多 1024，深入模式至少 4096，服务端硬上限为 16384。">
            <Input type="number" min={256} max={16384} step={256} value={settings.aiRuntime.maxOutputTokens} onChange={(event) => updateSettings("aiRuntime", { ...settings.aiRuntime, maxOutputTokens: Math.max(256, Math.min(16384, Number(event.target.value) || 256)) })} />
          </SettingRow>
          <SettingRow title="请求超时" description="模型请求等待 Provider 的最长时间。">
            <Input type="number" min={10} max={300} value={settings.aiRuntime.requestTimeoutSeconds} onChange={(event) => updateSettings("aiRuntime", { ...settings.aiRuntime, requestTimeoutSeconds: Math.max(10, Math.min(300, Number(event.target.value) || 10)) })} />
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
          {extensions.length ? extensions.map((extension) => <SettingRow key={extension.id} title={extension.name} description={extension.description} status={`${extension.version} · ${extension.pluginId}`}><Tag>{extension.kind === "agent" ? "Agent 配置" : extension.kind === "skill" ? "Skill" : extension.kind === "expert" ? "领域专家" : extension.kind === "prompt" ? "Prompt" : extension.kind === "tool" ? "Tool" : "Provider"}</Tag></SettingRow>) : <SettingRow title="暂无扩展登记" description="Cordis 插件加载后，其 Agent 配置、Skills、Experts、Prompts、Hooks 和 Tools 会显示在此。" status="空目录"><Tag>0 项</Tag></SettingRow>}
        </SettingGroup>
        <SettingGroup title="Cordis 插件宿主">
          {runtimePlugins.map((plugin) => <SettingRow key={plugin.id} title={plugin.id} description={`生命周期状态：${plugin.state}`} status={plugin.enabled ? "已加载" : "已停用"}><Tag color={plugin.enabled ? "green" : "default"}>{plugin.enabled ? "运行中" : "停用"}</Tag></SettingRow>)}
        </SettingGroup>
        <SettingGroup title="AI Runtime Hooks">
          {runtimeHooks.length ? runtimeHooks.map((hook) => <SettingRow key={hook.id} title={hook.id} description={`订阅事件：${hook.events.map((event) => event === "beforeInference" ? "推理前" : "推理后").join("、")}`} status="受信任插件"><Tag>生命周期钩子</Tag></SettingRow>) : <SettingRow title="暂无已注册钩子" description="AI 推理钩子通过 Cordis 插件生命周期注册；钩子只能观察元数据，不能改变权限或 Provider 请求。" status="空目录"><Tag>0 项</Tag></SettingRow>}
        </SettingGroup>
        <SettingGroup title="运行策略">
          <SettingRow title="允许 AI Work 使用扩展" description="关闭后，模型仍可对话，但登记的 Skills、Experts、Prompts 和 Tools 不会加入运行时。">
            <SettingsSwitch label="启用扩展" checked={settings.plugins.enabled} onChange={() => updateSettings("plugins", { enabled: !settings.plugins.enabled })} />
          </SettingRow>
        </SettingGroup>
        <div className="settings-note-card"><strong>运行安全边界</strong><p>启用只允许 Runtime 使用已登记扩展，不授予扩展权限。扩展不能绕过服务端工具权限策略；当前不会从 npm 或任意地址下载并执行代码。</p></div>
        <SettingsActions saving={saving === "plugins"} onReset={() => resetSettings("plugins")} onSave={() => void persistSettings("plugins")} />
      </section>
    );

    if (activeSection === "permissions") return (
      <section className="settings-content">
        <header className="settings-content__heading"><div><span className="settings-eyebrow">本机账户</span><Typography.Title level={2}>用户与权限</Typography.Title><Typography.Paragraph>管理账户角色、AI 工具默认授权与账户恢复。</Typography.Paragraph></div></header>
        <SettingGroup title="AI 工具授权">
          <SettingRow title="权限模式" description="这是账户级 AI 工具审批策略，由 LFAA server 执行；它不会授予本机或节点执行能力。">
            <Select value={settings.permissions.mode} options={[{ value: "ask", label: "请求审批" }, { value: "approve_remembered", label: "替我审批" }, { value: "full_access", label: "完全权限" }]} onChange={(value: UserSettings["permissions"]["mode"]) => updatePermissionMode(value)} />
          </SettingRow>
          <SettingRow title="当前生效模式" description={settings.permissions.mode === persistedPermissionMode ? "所选权限模式已保存并由 server 执行。" : "权限模式尚未保存；保存前仍按已生效模式授权。"} status={settings.permissions.mode === persistedPermissionMode ? "已生效" : "待保存"}>
            <Tag color={settings.permissions.mode === persistedPermissionMode ? "green" : "gold"}>{settings.permissions.mode === "ask" ? "请求审批" : settings.permissions.mode === "approve_remembered" ? "替我审批" : "完全权限"}</Tag>
          </SettingRow>
        </SettingGroup>
        <SettingGroup title="权限模式说明">
          <SettingRow title="请求审批" description="已登记且适用于当前应用的只读工具按规则执行。每次写入或高风险操作都要单独批准；此模式不保存记忆授权。" status={settings.permissions.mode === "ask" ? "当前选择" : undefined}>
            <Tag>逐项确认</Tag>
          </SettingRow>
          <SettingRow title="替我审批" description="写入或高风险操作首次仍需你批准。批准时可选仅批准一次，或记住授权范围；记忆授权只匹配当前账户、应用、工具 ID 与版本、风险和目标范围，不绑定单次参数值；工具参数仍须通过业务校验。" status={settings.permissions.mode === "approve_remembered" ? "当前选择" : undefined}>
            <Tag>可记住限定范围</Tag>
          </SettingRow>
          <SettingRow title="完全权限" description="已登记且适用于当前应用、具有有效目标范围的工具免逐项审批。server 仍校验身份、应用、工具、目标和业务规则；不会开放任意 Shell 或任意文件路径，也不会代替你同意 Minecraft EULA。" status={settings.permissions.mode === "full_access" ? "当前选择" : undefined}>
            <Tag>免逐项审批</Tag>
          </SettingRow>
        </SettingGroup>
        <Alert className="settings-inline-alert" type="warning" showIcon message="当前尚未接入可执行的 AI 业务工具，因此三种模式只保存授权策略，不会启用本机文件、Shell 或网络命令执行。Minecraft EULA 仍须单独向用户展示并由用户明确同意。" />
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
          </SettingRow>) : <SettingRow title="没有待审批操作" description="当前没有连接可执行业务工具，因此不会产生虚构的审批请求。业务工具接入后，server 会把待审批的单次操作显示在这里。" status="队列为空"><Tag>0 项</Tag></SettingRow>}
        </SettingGroup>
        <SettingGroup title="已记住的授权">
          {permissionGrants.length ? permissionGrants.map((grant) => <SettingRow
            key={grant.id}
            title={grant.summary}
            description={`${grant.appId === "steamcmd" ? "SteamCMD 开服" : grant.appId === "minecraft" ? "Minecraft" : "写作"} · ${grant.toolId}@${grant.toolVersion} · ${grant.risk === "write" ? "写入" : "高风险"} · 目标范围：${grant.scopeSummary}`}
            status={`记住于 ${new Date(grant.createdAt).toLocaleString("zh-CN")}`}
          >
            <Popconfirm title="撤销这条记忆授权？" description="撤销后，相同操作再次发生时会重新请求审批。" okText="撤销授权" cancelText="保留" onConfirm={() => void revokePermissionGrant(grant)}>
              <Button danger size="small">撤销</Button>
            </Popconfirm>
          </SettingRow>) : <SettingRow title="没有已记住的授权" description="在“替我审批”模式中批准操作后选择记住，授权将按当前账户、应用、工具版本、风险和目标范围匹配。" status="0 项"><Tag>未授权</Tag></SettingRow>}
        </SettingGroup>
        <SettingGroup title="当前账户">
          <SettingRow title={user.username} description="当前登录账户" status="已登录"><Tag color={user.role === "admin" ? "blue" : "default"}>{user.role === "admin" ? "管理员" : "普通账户"}</Tag></SettingRow>
          <SettingRow title="角色模型" description="当前版本提供管理员与普通账户两种固定角色；细粒度 Permission 规则尚未接入。" status="部分接入"><Tag>管理员 / 普通账户</Tag></SettingRow>
        </SettingGroup>
        <Card className="settings-card" title="密码找回密钥">
          <Typography.Paragraph type="secondary">已有账户可在这里补设或更新恢复密钥。保存时需验证当前登录密码；恢复密钥以加盐哈希保存在本机 SQLite 文件中。</Typography.Paragraph>
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Input.Password autoComplete="current-password" value={recoveryCurrentPassword} onChange={(event) => setRecoveryCurrentPassword(event.target.value)} placeholder="输入当前登录密码" />
            <div>
              <Input.Password autoComplete="new-password" value={recoveryKey} onChange={(event) => setRecoveryKey(event.target.value)} placeholder="设置独立恢复密钥" />
              <PasswordStrengthIndicator password={recoveryKey} label="恢复密钥" />
            </div>
            <Input.Password autoComplete="new-password" value={recoveryKeyConfirmation} onChange={(event) => setRecoveryKeyConfirmation(event.target.value)} placeholder="再次输入恢复密钥" />
            <Button type="primary" loading={savingRecoveryKey} disabled={serverState !== "online"} onClick={() => void persistRecoveryKey()}>保存恢复密钥</Button>
          </Space>
        </Card>
        <SettingsActions saving={saving === "permissions"} onReset={() => resetSettings("permissions")} onSave={() => void persistSettings("permissions")} />
      </section>
    );

    if (activeSection === "workspace") return (
      <section className="settings-content">
        <header className="settings-content__heading"><div><span className="settings-eyebrow">数据与目录</span><Typography.Title level={2}>项目与存储</Typography.Title><Typography.Paragraph>查看本地数据目录的用途与持久化状态。</Typography.Paragraph></div></header>
        <SettingGroup title="控制端数据">
          <SettingRow title="账户与设置数据库" description="保存账户、会话、用户偏好和加密后的 AI Provider 配置。" status={health?.persistence === "ready" ? "已连接" : "不可用"}><Tag>{health?.persistence === "ready" ? "SQLite · 已连接" : "SQLite · 未连接"}</Tag></SettingRow>
          <SettingRow title="游戏服务器文件" description="SteamCMD、Minecraft 实例、Java 环境、插件、日志和备份目录会由受控节点管理。" status="待节点接入"><Tag>Daemon 待接入</Tag></SettingRow>
          <SettingRow title="数据根目录" description="由控制端的 LFAA_DATA_DIR 环境配置决定；为避免泄露主机路径，此页面不向浏览器公开绝对路径。" status="服务端管理"><Tag>不在浏览器展示</Tag></SettingRow>
        </SettingGroup>
      </section>
    );

    if (activeSection === "account") return (
      <section className="settings-content">
        <header className="settings-content__heading"><div><span className="settings-eyebrow">个人账户</span><Typography.Title level={2}>账户</Typography.Title><Typography.Paragraph>查看当前登录账户与账户安全设置。</Typography.Paragraph></div></header>
        <SettingGroup title="当前账户">
          <SettingRow title={user.username} description="当前登录账户名称。" status="已登录"><Tag color={user.role === "admin" ? "blue" : "default"}>{user.role === "admin" ? "管理员" : "普通账户"}</Tag></SettingRow>
          <SettingRow title="密码恢复" description="通过恢复密钥管理账户找回能力。" status="已接入"><Button onClick={() => selectSection("permissions")}>管理恢复密钥</Button></SettingRow>
        </SettingGroup>
        {user.role === "admin" ? <AdminUsersPage /> : <Alert type="warning" showIcon message="只有管理员可以查看本机账户。" />}
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
          {activeSection === "configuration" ? <Button type="primary" onClick={() => selectSection("ai")}>打开 AI 与模型</Button> : null}
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
        <Input allowClear placeholder="搜索设置" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="搜索设置分类" />
        <nav ref={settingsNavigationScroll.ref} onScroll={settingsNavigationScroll.onScroll} className="settings-nav" aria-label="设置分类">{[...new Set(visibleSections.map((item) => item.group))].map((group) => <section key={group}><span className="settings-nav__group">{group}</span>{visibleSections.filter((item) => item.group === group).map((item) => <button key={item.id} type="button" className={activeSection === item.id ? "is-active" : ""} onClick={() => selectSection(item.id)}><WorkbenchIcon name={item.icon} size={18} />{item.title}</button>)}</section>)}{visibleSections.length === 0 ? <p className="settings-empty-search">没有匹配的设置分类。</p> : null}</nav>
        <div className="settings-sidebar__account"><span className="settings-avatar">{user.username.slice(0, 1).toLocaleUpperCase()}</span><span><strong>{user.username}</strong><small>{user.role === "admin" ? "管理员" : "普通账户"}</small></span></div>
    </aside>
  );
  const activeSettingsCategory = settingsCategoryForSection(activeSection);
  const activeError = error || sectionErrors[activeSection] || (activeSettingsCategory ? settingsSaveErrors[activeSettingsCategory] : undefined);
  const main = (
    <main ref={settingsContentScroll.ref} className="settings-main" onScroll={settingsContentScroll.onScroll}>
      {sidebarCollapsed ? <Button className="settings-sidebar-open" aria-label="展开设置导航" onClick={() => setSidebarCollapsed(false)}>☰ 设置菜单</Button> : null}
        {activeError ? <Alert className="settings-page-alert" type="error" showIcon message={activeError} closable onClose={() => { setError(""); setSectionErrors((current) => ({ ...current, [activeSection]: undefined })); }} /> : null}
        {loadingSection === activeSection ? <div className="settings-loading"><span className="loading-indicator" /><span>正在读取设置…</span></div> : sectionContent}
    </main>
  );

  return (
    <div ref={rootRef} className="settings-page" aria-label="设置中心">
      {messageContext}
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
          <Button key="remember" type="primary" disabled={approvalBusyId !== null} loading={approvalBusyId === approvalMemoryPrompt?.id} onClick={() => { if (approvalMemoryPrompt) void resolveApproval(approvalMemoryPrompt, "approved", true); }}>记住并批准</Button>
        ]}
      >
        <Typography.Paragraph>{approvalMemoryPrompt?.summary}</Typography.Paragraph>
        <Typography.Paragraph type="secondary">目标范围：{approvalMemoryPrompt?.scopeSummary}</Typography.Paragraph>
        <Typography.Paragraph type="secondary">记忆授权只匹配此账户、应用、工具版本、风险和目标范围；工具参数改变仍需本次审批的完整参数校验。相同范围的后续操作才会自动允许。</Typography.Paragraph>
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

function SettingGroup({ title, children }: { title: string; children: ReactNode }) {
  return <section className="settings-group"><h3>{title}</h3><div className="settings-group__rows">{children}</div></section>;
}

function AdvancedGroup({ children }: { children: ReactNode }) {
  return <div className="settings-advanced__group"><div className="settings-group__rows">{children}</div></div>;
}

function SettingRow({ title, description, status, children }: { title: string; description: ReactNode; status?: string; children: ReactNode }) {
  return <div className="settings-row"><div className="settings-row__copy"><strong>{title}</strong><span>{description}</span></div><div className="settings-row__control">{children}{status ? <small>{status}</small> : null}</div></div>;
}

function SettingsSwitch({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return <button type="button" className={`settings-switch${checked ? " is-on" : ""}${disabled ? " is-disabled" : ""}`} role="switch" aria-label={label} aria-checked={checked} disabled={disabled} onClick={onChange}><i /></button>;
}

function ShortcutRow({ title, value, onChange }: { title: string; value: string[]; onChange: (value: string[]) => void }) {
  function updateBinding(index: number, binding: string): void {
    onChange(value.map((item, itemIndex) => itemIndex === index ? binding : item));
  }

  function removeBinding(index: number): void {
    onChange(value.filter((_item, itemIndex) => itemIndex !== index));
  }

  const [listening, setListening] = useState(false);
  return <div className="settings-row settings-row--shortcuts"><div className="settings-row__copy"><strong>{title}</strong><span>每个动作最多绑定四组快捷键；组合键冲突时会暂停自动保存并提示。</span></div><div className="settings-row__control"><div className="settings-shortcut-list">{value.map((binding, index) => <div className="settings-shortcut-binding" key={`${index}-${binding}`}><Input readOnly value={listening ? "按下快捷键…" : binding || "点击录入快捷键"} onFocus={() => setListening(true)} onBlur={() => setListening(false)} onKeyDown={(event) => { if (!listening) return; event.preventDefault(); if (event.key === "Escape") { setListening(false); return; } const next = shortcutFromEvent(event); if (next) { updateBinding(index, next); setListening(false); event.currentTarget.blur(); } }} aria-label={`${title}快捷键 ${index + 1}`} /><Button type="text" danger aria-label={`移除${title}快捷键 ${index + 1}`} onClick={() => removeBinding(index)}>移除</Button></div>)}</div><Button className="settings-shortcut-add" type="dashed" disabled={value.length >= 4} onClick={() => onChange([...value, ""])}>＋ 添加快捷键</Button><small>{listening ? "按 Esc 取消录入" : `${value.filter(Boolean).length}/4 组绑定`}</small></div></div>;
}

function SettingsActions({ saving, onReset, onSave }: { saving: boolean; onReset: () => void; onSave: () => void }) {
  return <div className="settings-actions"><small className="settings-actions__hint">更改会自动保存</small><Button onClick={onReset} disabled={saving}>恢复默认</Button><Button type="primary" loading={saving} onClick={onSave}>立即保存</Button></div>;
}
