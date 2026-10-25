/** 功能：呈现现有工作台。作用：消费已保存设置并组合能力包界面。关联文件：client/connection、ui-settings、ui-theme、ui-commands。 */
import { APP_CANVAS_ROUTE_PATTERN, APPLICATION_ROUTE_PATTERN, SHARED_WORK_ROUTE, normalizeWorkRoute, type ApplicationNavigationId } from "lfaa-util-values/src/application-id.js";
import { DshSlotOutlet, loadClientModule } from "lfaa-client-modules/src/client/index.js";
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Button, Checkbox, ConfigProvider, Modal, Popover, Tag, Typography, theme as antdTheme } from "antd";
import { ServiceStatus, type ServiceState } from "lfaa-client-ui-primitives/src/ServiceStatus.js";
import { SetupReminder } from "lfaa-client-ui-settings-general/src/SetupReminder.js";
import { DEFAULT_USER_SETTINGS, resolveAppearanceBackgrounds, resolveShortcutSettings } from "lfaa-client-ui-settings-general/src/default-settings.js";
import { PasskeySetupPrompt } from "lfaa-client-ui-settings-account/src/PasskeySetupPrompt.js";
import { minecraftSceneBackgrounds } from "lfaa-util-values/src/builtin-backgrounds.js";
import { cacheLoginAppearance } from "lfaa-client-ui-theme/src/login-appearance.js";
import { aiWorkGoalRequestEventName, aiWorkSessionOpenEventName, type AiWorkGoalRequest, type AiWorkNotification, type AiWorkNotificationInput, type AiWorkSessionTarget } from "lfaa-client-resources/src/notification-runtime.js";
import { createAiWorkDraftPersistence, readAiWorkDraft, writeAiWorkDraft } from "lfaa-client-store/src/ai-work-drafts.js";
import { createBrowserPersistence, createDebouncedPersistenceWriter, stringPersistenceCodec, type DebouncedPersistenceWriter } from "lfaa-client-store/src/browser-persistence.js";
import { createScrollRestorationKey, useScrollRestoration } from "lfaa-client-store/src/scroll-restoration.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { saveSettings, userRoleLabel, type ApplicationId, type ApplicationMode, type DesktopAvailableUpdate, type DesktopUpdateDownloadProgress, type DesktopUpdatePreferences, type DesktopUpdatePrompt, type DesktopUpdatePromptAction, type User, type UserPreferences, type UserSettings } from "lfaa-client-connection/src/api.js";
import type { ApplicationNavigationItem } from "lfaa-client-ui-sidebar/src/GlobalNavigationRail.js";
import { lfaaProjectBuildInfo } from "lfaa-client-connection/src/project-version.js";
import { shortcutMatches } from "lfaa-client-ui-commands/src/shortcuts.js";
import { appearanceTextFontStacks, appearanceCodeFontStacks } from "lfaa-client-ui-theme/src/fonts.js";
import { applyAppearanceThemeBootstrap, cacheAppearanceCanvasBootstrap } from "lfaa-client-ui-theme/src/appearance-theme-bootstrap.js";
import { bindDshThemeOwner, dshThemeCompatibility, syncDshThemePreference } from "lfaa-client-ui-theme/src/dsh-theme-bridge.js";
import { createDshWallpaperAppearanceTokens } from "lfaa-client-ui-theme/src/dsh-wallpaper-appearance.js";
import { dshLocaleRuntime } from "lfaa-client-ui-workspace/src/dsh-locale-runtime.js";
import { resolveWallpaperCanvasOwnership } from "./wallpaper-canvas-ownership.js";
import { appearanceBackgroundSlotForRoute } from "./appearance-background-slot.js";
import { createReleaseAnnouncementPersistence } from "./release-announcement.js";
import "./css/module-shell.css";
const GameLibraryPage = lazy(() => import("./GameLibraryPage.js").then(module => ({ default: module.GameLibraryPage })));
const SteamcmdWorkspace = lazy(() => import("./SteamcmdWorkspace.js").then(module => ({ default: module.SteamcmdWorkspace })));



interface WorkbenchProps {
  user: User;
  preferences: UserPreferences;
  initialSettings: UserSettings;
  serverState: ServiceState;
  route: string;
  error: string | null;
  onNavigate: (path: string) => void;
  onOpenApplication: (app: ApplicationId, mode: ApplicationMode) => Promise<void>;
  onUserChange: (user: User) => void;
  onLogout: () => void;
  credentialReminder: { usernamePending: boolean; passwordPending: boolean } | null;
  suspendSetupReminder: boolean;
  authTransitionStaging?: boolean;
  onAuthTransitionWarmupReady?: () => void | (() => void);
}

interface AiWorkUiState {
  activeSessionId: string | null;
}

let settingsPageModulePromise: Promise<typeof import("lfaa-client-ui-settings/src/SettingsPage.js")> | null = null;
let fileManagerPageModulePromise: Promise<typeof import("lfaa-client-ui-sidebar-files/src/FileManagerPage.js")> | null = null;
let canvasWorkspaceModulePromise: Promise<typeof import("lfaa-client-ui-workspace/src/CanvasWorkspace.js")> | null = null;
let canvasHomeModulePromise: Promise<typeof import("lfaa-client-ui-workspace/src/CanvasHome.js")> | null = null;
let pluginManagerPageModulePromise: Promise<typeof import("lfaa-client-ui-plugin-manager/src/PluginManagerPage.js")> | null = null;
let aiWorkChatPreloadPromise: Promise<void> | null = null;

const PORTAL_APPEARANCE_VARIABLES = [
  "--settings-accent", "--settings-interface-font", "--settings-content-font", "--settings-code-font",
  "--settings-interface-font-size", "--settings-code-font-size", "--settings-contrast-strong-mix", "--settings-contrast-soft-mix",
  "--settings-background-surface-opacity", "--settings-update-surface-opacity", "--settings-glass-blur", "--settings-background-overlay",
  "--settings-wallpaper-floaters-surface", "--settings-wallpaper-floaters-blur",
  "--font-family-sans", "--font-size-xs", "--font-size-sm", "--font-size-md", "--font-size-base", "--font-size-lg", "--font-size-xl",
  "--color-brand", "--color-brand-hover", "--color-brand-deep", "--color-focus-ring", "--color-shadow-float",
  "--color-text-primary", "--color-text-heading", "--color-text-secondary", "--color-text-muted", "--color-text-caption", "--color-text-subtle", "--color-text-inverse",
  "--color-surface", "--color-canvas", "--color-surface-muted", "--color-surface-hover", "--color-surface-selected",
  "--color-border", "--color-border-strong", "--color-border-subtle", "--color-border-soft", "--color-border-muted"
] as const;

function loadFileManagerPageModule() {
  if (!fileManagerPageModulePromise) {
    fileManagerPageModulePromise = loadClientModule<typeof import("lfaa-client-ui-sidebar-files/src/FileManagerPage.js")>("lfaa-client-ui-sidebar-files/src/FileManagerPage.js").catch((error: unknown) => {
      fileManagerPageModulePromise = null;
      throw error;
    });
  }
  return fileManagerPageModulePromise;
}

function loadCanvasWorkspaceModule() {
  if (!canvasWorkspaceModulePromise) {
    canvasWorkspaceModulePromise = loadClientModule<typeof import("lfaa-client-ui-workspace/src/CanvasWorkspace.js")>("lfaa-client-ui-workspace/src/CanvasWorkspace.js").catch((error: unknown) => {
      canvasWorkspaceModulePromise = null;
      throw error;
    });
  }
  return canvasWorkspaceModulePromise;
}

function loadCanvasHomeModule() {
  if (!canvasHomeModulePromise) {
    canvasHomeModulePromise = loadClientModule<typeof import("lfaa-client-ui-workspace/src/CanvasHome.js")>("lfaa-client-ui-workspace/src/CanvasHome.js").catch((error: unknown) => {
      canvasHomeModulePromise = null;
      throw error;
    });
  }
  return canvasHomeModulePromise;
}

function loadPluginManagerPageModule() {
  if (!pluginManagerPageModulePromise) {
    pluginManagerPageModulePromise = loadClientModule<typeof import("lfaa-client-ui-plugin-manager/src/PluginManagerPage.js")>("lfaa-client-ui-plugin-manager/src/PluginManagerPage.js").catch((error: unknown) => {
      pluginManagerPageModulePromise = null;
      throw error;
    });
  }
  return pluginManagerPageModulePromise;
}

// 懒加载和提前预热共用同一个模块请求；失败时清空缓存，后续进入设置页仍可重试。
function loadSettingsPageModule() {
  if (!settingsPageModulePromise) {
    settingsPageModulePromise = loadClientModule<typeof import("lfaa-client-ui-settings/src/SettingsPage.js")>("lfaa-client-ui-settings/src/SettingsPage.js").catch((error: unknown) => {
      settingsPageModulePromise = null;
      throw error;
    });
  }
  return settingsPageModulePromise;
}

// 直达设置路由与交互预热共用懒加载 Promise；失败时调用方可继续由懒加载流程重试。
export function preloadSettingsPageForRoute(): Promise<void> {
  return loadSettingsPageModule().then(() => undefined);
}

// 后台预热失败不打断工作台；真实打开设置页时仍会进入 Suspense 加载流程。
function preloadSettingsPageModule(): void {
  void preloadSettingsPageForRoute().catch(() => undefined);
}

// AI Work 路由与应用工作区并行预热聊天模块，避免嵌套懒加载串行等待。
function preloadAiWorkChatModule(): Promise<void> {
  if (!aiWorkChatPreloadPromise) {
    aiWorkChatPreloadPromise = loadClientModule<typeof import("lfaa-client-ui-chat/src/AiWorkChat.js")>("lfaa-client-ui-chat/src/AiWorkChat.js")
      .then(() => undefined)
      .catch((error: unknown) => {
        aiWorkChatPreloadPromise = null;
        throw error;
      });
  }
  return aiWorkChatPreloadPromise;
}

function formatDesktopUpdateBytes(bytes: number): string {
  const value = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  if (value < 1_000) return `${Math.floor(value)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let scaled = value / 1_000;
  let unitIndex = 0;
  while (scaled >= 1_000 && unitIndex < units.length - 1) {
    scaled /= 1_000;
    unitIndex += 1;
  }
  return `${scaled.toFixed(1)} ${units[unitIndex]}`;
}

// 将文件页来源归一为应用模式根页；通用任务的正式入口 `/tasks` 对应 workspace AI Work。
function applicationModeHomeRoute(pathname: string): string | null {
  if (normalizeWorkRoute(pathname) === SHARED_WORK_ROUTE) return SHARED_WORK_ROUTE;
  if (/^\/games(?:\/|$)/u.test(pathname)) return "/games";
  const match = pathname.match(APPLICATION_ROUTE_PATTERN);
  return match ? `/apps/${match[1]}/${match[2]}` : null;
}

function gameLibraryApplicationRoute(pathname: string): string[] | null {
  const match = pathname.match(/^\/games(?:\/(.*))?$/u);
  if (!match) return null;
  const [area, ...parts] = (match[1] ?? "").split("/").filter(Boolean);
  if (area === "minecraft") return [pathname, "minecraft", "normal", parts.join("/") || "overview"];
  if (area === "steamcmd") return [pathname, "steamcmd", "normal", parts.join("/") || "overview"];
  return [pathname, "workspace", "normal", area === "environments" ? "environments" : "library"];
}

const SettingsPage = lazy(() => loadSettingsPageModule().then((module) => ({ default: module.SettingsPage })));
const FileManagerPage = lazy(() => loadFileManagerPageModule().then((module) => ({ default: module.FileManagerPage })));
const CanvasWorkspace = lazy(() => loadCanvasWorkspaceModule().then((module) => ({ default: module.CanvasWorkspace })));
const CanvasHome = lazy(() => loadCanvasHomeModule().then((module) => ({ default: module.CanvasHome })));
const PluginManagerPage = lazy(() => loadPluginManagerPageModule().then((module) => ({ default: module.PluginManagerPage })));
const ApplicationWorkspace = lazy(() => loadClientModule<typeof import("lfaa-client-ui-workspace/src/ApplicationWorkspace.js")>("lfaa-client-ui-workspace/src/ApplicationWorkspace.js").then((module) => ({ default: module.ApplicationWorkspace })));

function readActiveAiSession(userId: string, app: ApplicationId): string | null {
  const value = createBrowserPersistence({
    key: createScrollRestorationKey(userId, "active-ai-session", app),
    codec: stringPersistenceCodec
  }).read();
  return value || null;
}

function persistActiveAiSession(userId: string, app: ApplicationId, sessionId: string | null): void {
  const persistence = createBrowserPersistence({
    key: createScrollRestorationKey(userId, "active-ai-session", app),
    codec: stringPersistenceCodec
  });
  if (sessionId) persistence.write(sessionId);
  else persistence.remove();
}

const AI_WORK_DRAFT_SAVE_DELAY_MS = 250;

const backgroundFiles: Record<string, string> = {
  "service-room": "/backgrounds/service-room.jpg",
  "steamcmd-world": "/backgrounds/steamcmd-world.jpg",
  "minecraft-world": "/backgrounds/minecraft-world.jpg",
  "writing-desk": "/backgrounds/writing-desk.jpg",
  ...Object.fromEntries(minecraftSceneBackgrounds.map(({ id, file }) => [id, file]))
};

function backgroundFileForRoute(route: string, currentSettings: UserSettings): string | null {
  const backgroundSlot = appearanceBackgroundSlotForRoute(route);
  const selectedBackground = resolveAppearanceBackgrounds(currentSettings.appearance.backgrounds)[backgroundSlot];
  if (selectedBackground === "none") return null;
  return selectedBackground.startsWith("user-")
    ? `/api/settings/backgrounds/${encodeURIComponent(selectedBackground)}`
    : backgroundFiles[selectedBackground] ?? null;
}




function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || Boolean(target.closest("input, textarea, select, [contenteditable='true']")));
}



/* 根据侧栏底色亮度生成可读文字、边框和选中态颜色。 */
function customSidebarStyle(background: string, accent: string): CSSProperties {
  const channels = background.slice(1).match(/.{2}/gu)?.map((channel) => Number.parseInt(channel, 16) / 255) ?? [0, 0, 0];
  const luminance = channels.reduce((sum, channel, index) => {
    const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    return sum + linear * ([0.2126, 0.7152, 0.0722][index] ?? 0);
  }, 0);
  const backgroundContrast = luminance + 0.05;
  const whiteContrast = 1.05 / backgroundContrast;
  const blackContrast = backgroundContrast / 0.05;
  const lightText = whiteContrast >= blackContrast;
  const maximumContrast = Math.max(whiteContrast, blackContrast);
  const textColor = (desiredContrast: number) => {
    const target = Math.min(desiredContrast, maximumContrast);
    const textLuminance = lightText ? target * backgroundContrast - 0.05 : backgroundContrast / target - 0.05;
    const linear = Math.max(0, Math.min(1, textLuminance));
    const channel = linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055;
    return `#${Math.round(channel * 255).toString(16).padStart(2, "0").repeat(3)}`;
  };
  const foreground = textColor(7);
  const heading = textColor(7.5);
  const secondary = textColor(6);
  const muted = textColor(5);
  const subtle = textColor(4.5);
  const darkBackground = lightText;
  const borderMix = darkBackground ? "#ffffff 19%" : "#000000 17%";
  const surfaceMix = darkBackground ? "#ffffff 8%" : "#000000 5%";
  const accentChannels = accent.slice(1).match(/.{2}/gu)?.map((channel) => Number.parseInt(channel, 16)) ?? [52, 87, 213];
  const getLuminance = (rgb: number[]) => rgb.reduce((sum, channel, index) => {
    const normalized = channel / 255;
    const linear = normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    return sum + linear * ([0.2126, 0.7152, 0.0722][index] ?? 0);
  }, 0);
  const accentContrast = (rgb: number[]) => {
    const accentLuminance = getLuminance(rgb);
    const lighter = Math.max(accentLuminance, luminance);
    const darker = Math.min(accentLuminance, luminance);
    return (lighter + 0.05) / (darker + 0.05);
  };
  let readableAccent = accentChannels;
  if (accentContrast(readableAccent) < 4.5) {
    const targetChannel = lightText ? 255 : 0;
    let low = 0;
    let high = 1;
    for (let index = 0; index < 12; index += 1) {
      const mix = (low + high) / 2;
      const candidate = accentChannels.map((channel) => Math.round(channel * (1 - mix) + targetChannel * mix));
      if (accentContrast(candidate) >= 4.5) high = mix;
      else low = mix;
    }
    readableAccent = accentChannels.map((channel) => Math.round(channel * (1 - high) + targetChannel * high));
  }
  const readableAccentHex = `#${readableAccent.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
  /* 侧栏底色变量控制四种侧栏的背景；侧栏强调色保留所选色相并在对比不足时向黑白调整。
   * 文字变量按底色亮度计算对比色；强调色必要时向黑白调整到 4.5:1 对比度。表面仅做轻微明暗偏移，边框保留清晰轮廓。
   * 本组包含 --settings-sidebar-color、--settings-sidebar-accent、--settings-sidebar-text-*、
   * --settings-sidebar-surface-* 与 --settings-sidebar-border*，均仅作用于设置导航和应用工作区侧栏。
   */
  return {
    "--settings-sidebar-color": background,
    "--settings-sidebar-accent": readableAccentHex,
    "--settings-sidebar-text-primary": foreground,
    "--settings-sidebar-text-heading": heading,
    "--settings-sidebar-text-secondary": secondary,
    "--settings-sidebar-text-muted": muted,
    "--settings-sidebar-text-caption": muted,
    "--settings-sidebar-text-subtle": subtle,
    "--settings-sidebar-surface": `color-mix(in srgb, ${background} 96%, ${foreground})`,
    "--settings-sidebar-surface-muted": `color-mix(in srgb, ${background} 92%, ${foreground})`,
    "--settings-sidebar-surface-hover": `color-mix(in srgb, ${background}, ${surfaceMix})`,
    "--settings-sidebar-surface-selected": `color-mix(in srgb, ${background} 86%, ${readableAccentHex} 14%)`,
    "--settings-sidebar-border": `color-mix(in srgb, ${background}, ${borderMix})`,
    "--settings-sidebar-border-strong": `color-mix(in srgb, ${background} 76%, ${foreground} 24%)`,
    "--settings-sidebar-border-subtle": `color-mix(in srgb, ${background} 86%, ${foreground} 14%)`
  } as CSSProperties;
}

const applicationCards: Array<{
  id: Exclude<ApplicationId, "workspace">;
  title: string;
  initials: string;
  color: "blue" | "green" | "plum";
}> = [
  {
    id: "steamcmd",
    title: "SteamCMD 游戏服务",
    initials: "S",
    color: "blue"
  },
  {
    id: "minecraft",
    title: "Minecraft 管理",
    initials: "M",
    color: "green"
  },
  {
    id: "connectivity",
    title: "LFAA 联机服务",
    initials: "N",
    color: "blue"
  },
  {
    id: "writing",
    title: "写作空间",
    initials: "W",
    color: "plum"
  },
  {
    id: "aivideo",
    title: "AI 漫剧",
    initials: "漫",
    color: "plum"
  }
];

const allApplicationNavigationItems: ApplicationNavigationItem[] = [
  { id: "games", title: "游戏库", description: "运行环境 · Minecraft · SteamCMD", route: "/games" },
  { id: "canvas", title: "无限画布", description: "系统级创作画布 · 所有 App 可用", route: "/canvas" },
  ...applicationCards
    .filter((application) => application.id !== "steamcmd" && application.id !== "minecraft")
    .map((application) => ({ id: application.id, title: application.title, applicationId: application.id }))
];

/** 画布首页与 App 切换器使用完整 App 清单（含 SteamCMD/Minecraft/工作区）。 */
const canvasApplicationItems: ApplicationNavigationItem[] = [
  ...applicationCards.map((application) => ({ id: application.id, title: application.title, applicationId: application.id })),
  { id: "workspace", title: "小鱼智能体", applicationId: "workspace" }
];

export function Workbench({
  user,
  preferences,
  initialSettings,
  serverState,
  route,
  error,
  onNavigate,
  onOpenApplication,
  onUserChange,
  onLogout,
  credentialReminder,
  suspendSetupReminder,
  authTransitionStaging = false,
  onAuthTransitionWarmupReady
}: WorkbenchProps) {
  const appRoute = route === "/voice"
    ? [route, "workspace", "ai-work", "voice"]
    : normalizeWorkRoute(route) === SHARED_WORK_ROUTE ? [route, "workspace", "ai-work", "overview"] : gameLibraryApplicationRoute(route) ?? route.match(APPLICATION_ROUTE_PATTERN);
  const isGameLibraryRoute = route === "/games" || route.startsWith("/games/");
  const isAiWorkRoute = appRoute?.[1] === "workspace" && appRoute?.[2] === "ai-work";
  const isFileManagerPage = route === "/files";
  const appCanvasRoute = route.match(APP_CANVAS_ROUTE_PATTERN);
  const isCanvasHomePage = route === "/canvas";
  const isCanvasPage = isCanvasHomePage || Boolean(appCanvasRoute);
  const isPluginManagerPage = route === "/plugin-manager";
  const isLegacyAccountsRoute = route === "/admin/users";
  const isSettingsPage = route === "/settings" || isLegacyAccountsRoute;
  const [setupReminderBusy, setSetupReminderBusy] = useState(() => !isSettingsPage && initialSettings.general.notificationPopupsEnabled);
  const [passkeyPromptBusy, setPasskeyPromptBusy] = useState(() => !isSettingsPage && initialSettings.general.notificationPopupsEnabled);
  // 文件页房子返回来源 App/模式根；从设置进入时再追溯设置页保存的来源路由。
  const previousRoute = useRef(route);
  const fileManagerEntryRoute = route === "/files" && previousRoute.current !== "/files" ? previousRoute.current : null;
  useEffect(() => {
    if (route !== "/files") previousRoute.current = route;
  }, [route]);
  useEffect(() => {
    if (isAiWorkRoute) void preloadAiWorkChatModule().catch(() => undefined);
  }, [isAiWorkRoute]);
  useScrollRestoration(
    isSettingsPage || appRoute || isFileManagerPage || isCanvasPage ? "" : createScrollRestorationKey(user.id, "workbench-page", route),
    true,
    "window"
  );
  const [settingsReturnRoute, setSettingsReturnRoute] = useState(() =>
    route === "/settings" || route === "/admin/users" ? `/apps/${preferences.selectedApp}/${preferences.selectedMode}` : SHARED_WORK_ROUTE,
  );
  const fileManagerSourceRoute = fileManagerEntryRoute === "/settings" || fileManagerEntryRoute === "/admin/users"
    ? settingsReturnRoute
    : fileManagerEntryRoute;
  const fileManagerHomeRoute = applicationModeHomeRoute(fileManagerSourceRoute ?? "")
    ?? `/apps/${preferences.selectedApp}/${preferences.selectedMode}`;
  const settingsReturnBackgroundRef = useRef<HTMLImageElement | null>(null);
  const [settingsInitialSection, setSettingsInitialSection] = useState<"ai" | "permissions" | "configuration" | "account" | "workspace" | "security" | "plugins" | undefined>();
  const [settingsSectionRequest, setSettingsSectionRequest] = useState<{ section: "ai" | "permissions" | "configuration" | "account" | "workspace" | "security" | "plugins"; requestId: number; focusTarget?: string } | null>(null);
  const settingsSectionRequestSequenceRef = useRef(0);
  const [recentSessionsOpenRequestId, setRecentSessionsOpenRequestId] = useState<number | null>(null);
  const recentSessionsOpenRequestSequenceRef = useRef(0);
  const [workspaceRightPanelSection, setWorkspaceRightPanelSection] = useState<"context" | "applications">("context");
  const [applicationsOpenRequestId, setApplicationsOpenRequestId] = useState<number | null>(null);
  const applicationsOpenRequestSequenceRef = useRef(0);
  const [settings, setSettings] = useState<UserSettings>(initialSettings);
  const hiddenApplicationNavigationIds = settings.general.hiddenApplicationNavigationIds ?? [];
  const applicationNavigationItems = useMemo(() => {
    const hidden = new Set<ApplicationNavigationId>(hiddenApplicationNavigationIds);
    return allApplicationNavigationItems.filter(application => !hidden.has(application.id));
  }, [hiddenApplicationNavigationIds]);
  const [wallpaperEngineClientAvailable, setWallpaperEngineClientAvailable] = useState(() => document.body.hasAttribute("data-lfaa-wallpaper-engine-client"));
  const shortcutSettingsRef = useRef(settings.shortcuts);
  useLayoutEffect(() => { shortcutSettingsRef.current = settings.shortcuts; }, [settings.shortcuts]);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const workbenchShellRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (isSettingsPage || !settings.general.notificationPopupsEnabled) return;
    setSetupReminderBusy(true);
    setPasskeyPromptBusy(true);
  }, [isSettingsPage, settings.general.notificationPopupsEnabled, user.id]);
  useLayoutEffect(() => onAuthTransitionWarmupReady?.(), [onAuthTransitionWarmupReady]);
  useLayoutEffect(() => {
    const shell = workbenchShellRef.current;
    if (!shell) return;
    shell.toggleAttribute("inert", authTransitionStaging);
    if (authTransitionStaging) shell.setAttribute("aria-hidden", "true");
    else shell.removeAttribute("aria-hidden");
  }, [authTransitionStaging]);
  useEffect(() => {
    const body = document.body;
    const syncWallpaperClientAvailability = () => {
      const available = body.hasAttribute("data-lfaa-wallpaper-engine-client");
      setWallpaperEngineClientAvailable((current) => current === available ? current : available);
    };
    const observer = new MutationObserver(syncWallpaperClientAvailability);
    observer.observe(body, { attributes: true, attributeFilter: ["data-lfaa-wallpaper-engine-client"] });
    syncWallpaperClientAvailability();
    return () => observer.disconnect();
  }, []);
  const wallpaperThemeSaveRevision = useRef(0);
  const updateWorkbenchSettings = useCallback((next: UserSettings) => {
    settingsRef.current = next;
    setSettings(next);
  }, []);
  const saveWallpaperTheme = useCallback(async (theme: "light" | "dark") => {
    const current = settingsRef.current;
    if (current.appearance.theme === theme) return;
    const next = { ...current, appearance: { ...current.appearance, theme } };
    settingsRef.current = next;
    setSettings(next);
    const revision = ++wallpaperThemeSaveRevision.current;
    try {
      const result = await saveSettings("appearance", next.appearance);
      if (wallpaperThemeSaveRevision.current !== revision) return;
      const latest = settingsRef.current;
      const accepted = { ...latest, appearance: { ...result.settings.appearance, ...latest.appearance, theme: result.settings.appearance.theme } };
      settingsRef.current = accepted;
      setSettings(accepted);
      cacheLoginAppearance(user.username, result.settings.appearance);
    } catch (error) {
      if (wallpaperThemeSaveRevision.current === revision && settingsRef.current.appearance.theme === theme) {
        const latest = settingsRef.current;
        const reverted = { ...latest, appearance: { ...latest.appearance, theme: current.appearance.theme } };
        settingsRef.current = reverted;
        setSettings(reverted);
      }
      throw error;
    }
  }, []);
  useLayoutEffect(() => bindDshThemeOwner({
    readPreference: () => settingsRef.current.appearance.theme,
    savePreference: saveWallpaperTheme,
    getRoot: () => workbenchShellRef.current,
  }), [saveWallpaperTheme]);
  useLayoutEffect(() => {
    dshLocaleRuntime.setPreference(settings.general.language);
  }, [settings.general.language]);
  // 草稿按账户/App 从浏览器读取一次；已发送消息和活动会话仍由各自既有 Owner 管理。
  const [aiWorkUiState, setAiWorkUiState] = useState<AiWorkUiState>(() => ({ activeSessionId: readActiveAiSession(user.id, "workspace") ?? readActiveAiSession(user.id, preferences.selectedApp) }));
  const [pendingAiWorkGoal, setPendingAiWorkGoal] = useState<AiWorkGoalRequest | null>(null);
  const [notifications, setNotifications] = useState<AiWorkNotification[]>([]);
  const [notificationToast, setNotificationToast] = useState<AiWorkNotification | null>(null);
  const [desktopUpdatePrompt, setDesktopUpdatePrompt] = useState<DesktopUpdatePrompt | null>(null);
  const [desktopAvailableUpdate, setDesktopAvailableUpdate] = useState<DesktopAvailableUpdate | null>(null);
  const [desktopUpdateAvailabilityLoaded, setDesktopUpdateAvailabilityLoaded] = useState(() => !window.lfaaDesktop);
  const [desktopUpdateDownloadProgress, setDesktopUpdateDownloadProgress] = useState<DesktopUpdateDownloadProgress | null>(null);
  const [downloadProgressOpen, setDownloadProgressOpen] = useState(false);
  const [updateDownloadCancelError, setUpdateDownloadCancelError] = useState("");
  const [desktopUpdatePreferences, setDesktopUpdatePreferences] = useState<DesktopUpdatePreferences | null>(null);
  const [desktopUpdatePreferenceSaving, setDesktopUpdatePreferenceSaving] = useState(false);
  const [desktopUpdatePreferenceError, setDesktopUpdatePreferenceError] = useState("");
  const [updatePopoverOpen, setUpdatePopoverOpen] = useState(false);
  const [releaseAnnouncementOpen, setReleaseAnnouncementOpen] = useState(false);
  const updateAvailabilityRevision = useRef(0);
  const updateDownloadProgressRevision = useRef(0);
  const dismissedReleaseAnnouncementRef = useRef<{ userId: string; version: string } | null>(null);
  const releaseAnnouncementPersistence = useMemo(() => createReleaseAnnouncementPersistence(user.id), [user.id]);
  const releaseAnnouncementVersion = lfaaProjectBuildInfo?.currentVersion ?? "";
  const setSetupReminderActivity = useCallback((active: boolean) => {
    setSetupReminderBusy(current => current === active ? current : active);
  }, []);
  const setPasskeyPromptActivity = useCallback((active: boolean) => {
    setPasskeyPromptBusy(current => current === active ? current : active);
  }, []);
  const notificationSequence = useRef(0);
  const aiWorkDraftWriters = useRef<{ userId: string; writer: DebouncedPersistenceWriter<string> } | null>(null);
  const aiWorkDraftState = useRef<{ userId: string; value: string } | null>(null);
  if (aiWorkDraftState.current?.userId !== user.id) aiWorkDraftState.current = { userId: user.id, value: readAiWorkDraft(user.id, "workspace") || readAiWorkDraft(user.id, preferences.selectedApp) };
  const aiWorkDraft = aiWorkDraftState.current!.value;
  useEffect(() => {
    const desktop = window.lfaaDesktop;
    if (!desktop) return;
    const unsubscribe = desktop.onUpdatePrompt(setDesktopUpdatePrompt);
    const unsubscribeAvailability = desktop.onUpdateAvailable(update => {
      updateAvailabilityRevision.current += 1;
      setDesktopUpdateAvailabilityLoaded(true);
      setDesktopAvailableUpdate(update);
    });
    const unsubscribeDownloadProgress = desktop.onUpdateDownloadProgress(progress => {
      updateDownloadProgressRevision.current += 1;
      setDesktopUpdateDownloadProgress(progress);
      setDownloadProgressOpen(Boolean(progress));
      setUpdateDownloadCancelError("");
    });
    void desktop.getUpdateAvailability().then(update => {
      setDesktopUpdateAvailabilityLoaded(true);
      if (updateAvailabilityRevision.current === 0) setDesktopAvailableUpdate(update);
    }).catch(() => setDesktopUpdateAvailabilityLoaded(true));
    void desktop.getUpdateDownloadProgress().then(progress => {
      if (updateDownloadProgressRevision.current === 0) {
        setDesktopUpdateDownloadProgress(progress);
        setDownloadProgressOpen(Boolean(progress));
      }
    }).catch(() => undefined);
    void desktop.getUpdatePreferences().then(setDesktopUpdatePreferences).catch(() => undefined);
    void desktop.updatePromptUiReady().catch(() => undefined);
    return () => {
      unsubscribe();
      unsubscribeAvailability();
      unsubscribeDownloadProgress();
      void desktop.updatePromptUiNotReady().catch(() => undefined);
    };
  }, []);
  useEffect(() => {
    const version = releaseAnnouncementVersion;
    const sessionAcknowledged = dismissedReleaseAnnouncementRef.current?.userId === user.id
      && dismissedReleaseAnnouncementRef.current.version === version;
    const desktopUpdateActivity = Boolean(window.lfaaDesktop)
      && (!desktopUpdateAvailabilityLoaded || Boolean(desktopAvailableUpdate || desktopUpdatePrompt || desktopUpdateDownloadProgress || downloadProgressOpen));
    if (!version || !settings.general.notificationPopupsEnabled || isSettingsPage || authTransitionStaging
      || setupReminderBusy || passkeyPromptBusy || desktopUpdateActivity) {
      setReleaseAnnouncementOpen(false);
      return;
    }
    if (sessionAcknowledged || releaseAnnouncementPersistence.read() === version) {
      dismissedReleaseAnnouncementRef.current = { userId: user.id, version };
      setReleaseAnnouncementOpen(false);
      return;
    }
    setReleaseAnnouncementOpen(true);
  }, [authTransitionStaging, desktopAvailableUpdate, desktopUpdateAvailabilityLoaded, desktopUpdateDownloadProgress, desktopUpdatePrompt, downloadProgressOpen, isSettingsPage, passkeyPromptBusy, releaseAnnouncementPersistence, releaseAnnouncementVersion, settings.general.notificationPopupsEnabled, setupReminderBusy, user.id]);
  const acknowledgeReleaseAnnouncement = useCallback(() => {
    if (!releaseAnnouncementVersion) return;
    dismissedReleaseAnnouncementRef.current = { userId: user.id, version: releaseAnnouncementVersion };
    releaseAnnouncementPersistence.write(releaseAnnouncementVersion);
    setReleaseAnnouncementOpen(false);
  }, [releaseAnnouncementPersistence, releaseAnnouncementVersion, user.id]);
  useEffect(() => {
    const writer = createDebouncedPersistenceWriter(createAiWorkDraftPersistence(user.id, "workspace"), { delayMs: AI_WORK_DRAFT_SAVE_DELAY_MS, removeWhen: draft => draft.length === 0 });
    writer.bindPageLifecycle(); const state = { userId: user.id, writer }; aiWorkDraftWriters.current = state;
    return () => { writer.dispose(); if (aiWorkDraftWriters.current === state) aiWorkDraftWriters.current = null; };
  }, [user.id]);
  const updateAiWorkDraft = useCallback((draft: string) => {
    aiWorkDraftState.current = { userId: user.id, value: draft };
    const current = aiWorkDraftWriters.current;
    if (current?.userId === user.id) current.writer.schedule(draft); else writeAiWorkDraft(user.id, "workspace", draft);
  }, [user.id]);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);
  const openSettings = useCallback((section?: "ai" | "permissions" | "configuration" | "account" | "workspace" | "security" | "plugins", focusTarget?: string) => {
    setSettingsInitialSection(section);
    if (section) setSettingsSectionRequest({ section, requestId: ++settingsSectionRequestSequenceRef.current, ...(focusTarget ? { focusTarget } : {}) });
    if (route !== "/settings" && route !== "/admin/users") setSettingsReturnRoute(route);
    onNavigate(section ? `/settings?section=${encodeURIComponent(section)}` : "/settings");
  }, [onNavigate, route]);
  const requestRecentSessionsOpen = useCallback(() => {
    const requestId = ++recentSessionsOpenRequestSequenceRef.current;
    setRecentSessionsOpenRequestId(requestId);
    onNavigate(SHARED_WORK_ROUTE);
  }, [onNavigate]);
  const handleRecentSessionsOpenRequest = useCallback((requestId: number) => {
    setRecentSessionsOpenRequestId(current => current === requestId ? null : current);
  }, []);
  const openApplicationFromCurrentPage = useCallback((targetApp: ApplicationId) => {
    void onOpenApplication(targetApp, "normal").catch(() => undefined);
  }, [onOpenApplication]);
  const requestApplicationsOpen = useCallback(() => {
    setWorkspaceRightPanelSection("applications");
    const requestId = ++applicationsOpenRequestSequenceRef.current;
    setApplicationsOpenRequestId(requestId);
    onNavigate(SHARED_WORK_ROUTE);
  }, [onNavigate]);
  const handleApplicationsOpenRequest = useCallback((requestId: number) => {
    setApplicationsOpenRequestId(current => current === requestId ? null : current);
  }, []);
  const updateAiWorkUiState = (update: Partial<AiWorkUiState>) => {
    if (Object.prototype.hasOwnProperty.call(update, "activeSessionId")) persistActiveAiSession(user.id, "workspace", update.activeSessionId ?? null);
    setAiWorkUiState(current => ({ ...current, ...update }));
  };
  const addAiWorkNotification = useCallback((input: AiWorkNotificationInput) => {
    if (!settings.general.notificationPopupsEnabled) return;
    notificationSequence.current += 1;
    const notification: AiWorkNotification = {
      ...input,
      id: `${Date.now()}-${notificationSequence.current}`,
      createdAt: Date.now(),
      read: false
    };
    setNotifications((current) => [notification, ...current].slice(0, 8));
    if (input.kind !== "approval" && input.kind !== "question") setNotificationToast(notification);
  }, [settings.general.notificationPopupsEnabled]);
  const markNotificationsRead = useCallback(() => {
    setNotifications((current) => current.map((notification) => notification.read ? notification : { ...notification, read: true }));
  }, []);
  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setNotificationToast(null);
  }, []);
  const respondToDesktopUpdatePrompt = useCallback((prompt: DesktopUpdatePrompt, action: DesktopUpdatePromptAction) => {
    setDesktopUpdatePrompt(current => current?.requestId === prompt.requestId ? null : current);
    void window.lfaaDesktop?.respondToUpdatePrompt(prompt.requestId, action).catch(() => undefined);
  }, []);
  const openDesktopUpdatePrompt = useCallback(() => {
    setUpdatePopoverOpen(false);
    void window.lfaaDesktop?.checkForUpdates().catch(() => undefined);
  }, []);
  const cancelDesktopUpdateDownload = useCallback(async () => {
    const cancel = window.lfaaDesktop?.cancelUpdateDownload;
    if (!cancel) return;
    setUpdateDownloadCancelError("");
    try {
      if (!await cancel()) setUpdateDownloadCancelError("下载已经结束，请稍候查看更新状态。");
    } catch {
      setUpdateDownloadCancelError("取消下载失败，请稍后重试。");
    }
  }, []);
  const setAutoUpdatePreference = useCallback(async (enabled: boolean) => {
    const savePreference = window.lfaaDesktop?.setAutoUpdateAndInstall;
    if (!savePreference || desktopUpdatePreferenceSaving) return;
    const previous = desktopUpdatePreferences;
    setDesktopUpdatePreferenceSaving(true);
    setDesktopUpdatePreferenceError("");
    setDesktopUpdatePreferences(current => current ? { ...current, autoDownloadAndInstall: enabled } : current);
    try {
      setDesktopUpdatePreferences(await savePreference(enabled));
    } catch {
      setDesktopUpdatePreferences(previous);
      setDesktopUpdatePreferenceError("本机更新设置未保存，请在设置中心重试。");
    } finally {
      setDesktopUpdatePreferenceSaving(false);
    }
  }, [desktopUpdatePreferenceSaving, desktopUpdatePreferences]);
  const openAiWorkNotification = useCallback((target: AiWorkSessionTarget) => {
    persistActiveAiSession(user.id, "workspace", target.sessionId); setAiWorkUiState({ activeSessionId: target.sessionId });
    setNotifications(current => current.map(item => item.sessionId === target.sessionId ? { ...item, read: true } : item));
    setNotificationToast(null); onNavigate(SHARED_WORK_ROUTE);
  }, [onNavigate, user.id]);
  const openNotification = useCallback((notification: AiWorkNotification) => {
    openAiWorkNotification(notification);
  }, [openAiWorkNotification]);

  const consumeAiWorkGoal = useCallback((requestId: string) => {
    setPendingAiWorkGoal(current => current?.requestId === requestId ? null : current);
  }, []);

  useEffect(() => {
    const handleAiWorkGoalRequest = (event: Event) => {
      const detail = (event as CustomEvent<AiWorkGoalRequest>).detail;
      if (!detail || typeof detail.requestId !== "string" || detail.requestId.length > 100 || typeof detail.prompt !== "string" || !detail.prompt.trim() || detail.prompt.length > 4000) return;
      setPendingAiWorkGoal(detail);
      updateAiWorkDraft(detail.prompt);
      onNavigate(SHARED_WORK_ROUTE);
    };
    window.addEventListener(aiWorkGoalRequestEventName, handleAiWorkGoalRequest);
    return () => window.removeEventListener(aiWorkGoalRequestEventName, handleAiWorkGoalRequest);
  }, [onNavigate, updateAiWorkDraft]);

  useEffect(() => {
    const handleSessionNotificationClick = (event: Event) => {
      const detail = (event as CustomEvent<AiWorkSessionTarget>).detail;
      if (!detail || !["steamcmd", "minecraft", "writing", "workspace"].includes(detail.appId) || typeof detail.sessionId !== "string" || !detail.sessionId) return;
      openAiWorkNotification(detail);
    };
    window.addEventListener(aiWorkSessionOpenEventName, handleSessionNotificationClick);
    return () => window.removeEventListener(aiWorkSessionOpenEventName, handleSessionNotificationClick);
  }, [openAiWorkNotification]);

  useEffect(() => {
    if (!notificationToast) return;
    const toastId = notificationToast.id;
    const timeout = window.setTimeout(() => setNotificationToast((current) => current?.id === toastId ? null : current), 8000);
    return () => window.clearTimeout(timeout);
  }, [notificationToast?.id]);

  useEffect(() => {
    if (!settings.general.notificationPopupsEnabled) setNotificationToast(null);
  }, [settings.general.notificationPopupsEnabled]);

  useEffect(() => {
    cacheLoginAppearance(user.username, initialSettings.appearance);
  }, [initialSettings.appearance]);

  useEffect(() => {
    if (!isSettingsPage) return;
    const returnBackgroundFile = backgroundFileForRoute(settingsReturnRoute, settings);
    if (!returnBackgroundFile) {
      settingsReturnBackgroundRef.current = null;
      return;
    }
    // 设置中心单独使用一张背景；提前加载返回目标的背景，减少离开设置页时的空白帧。
    const image = new Image();
    image.decoding = "async";
    image.src = returnBackgroundFile;
    settingsReturnBackgroundRef.current = image;
    void image.decode().catch(() => undefined);
  }, [isSettingsPage, settingsReturnRoute, settings.appearance.backgrounds]);

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!query) return;
    const update = () => setSystemDark(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || isEditableTarget(event.target)) return;
      const entries: Array<[keyof UserSettings["shortcuts"], () => void]> = [
        ["openSettings", openSettings],
        ["openHome", () => onNavigate(SHARED_WORK_ROUTE)],
        ["openSteamcmd", () => onNavigate("/games/steamcmd")],
        ["openMinecraft", () => onNavigate("/games/minecraft")],
        ["openWriting", () => openApplicationFromCurrentPage("writing")]
      ];
      const shortcuts = resolveShortcutSettings(shortcutSettingsRef.current);
      const match = entries.find(([key]) => shortcuts[key].some((chord) => shortcutMatches(event, chord)));
      if (match) {
        event.preventDefault();
        match[1]();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [onNavigate, openApplicationFromCurrentPage, openSettings]);

  const resolvedTheme = settings.appearance.theme === "system"
    ? (systemDark ? "dark" : "light")
    : settings.appearance.theme;
  useLayoutEffect(() => { dshThemeCompatibility.refresh(); }, [resolvedTheme]);
  const previousDshThemePreference = useRef(settings.appearance.theme);
  useEffect(() => {
    if (previousDshThemePreference.current === settings.appearance.theme) return;
    previousDshThemePreference.current = settings.appearance.theme;
    syncDshThemePreference();
  }, [settings.appearance.theme]);
  useLayoutEffect(() => {
    applyAppearanceThemeBootstrap(settings.appearance.theme, resolvedTheme);
  }, [settings.appearance.theme, resolvedTheme]);
  useLayoutEffect(() => {
    const body = document.body;
    if (resolvedTheme === "dark") body.setAttribute("data-ds-dark-theme", "");
    else body.removeAttribute("data-ds-dark-theme");
    return () => body.removeAttribute("data-ds-dark-theme");
  }, [resolvedTheme]);
  useLayoutEffect(() => {
    const body = document.body;
    body.setAttribute("data-lfaa-dialog-motion-effect", settings.general.dialogMotionEffect ?? DEFAULT_USER_SETTINGS.general.dialogMotionEffect);
    body.setAttribute("data-lfaa-reduced-motion", settings.appearance.advanced.reducedMotion);
    return () => {
      body.removeAttribute("data-lfaa-dialog-motion-effect");
      body.removeAttribute("data-lfaa-reduced-motion");
    };
  }, [settings.general.dialogMotionEffect, settings.appearance.advanced.reducedMotion]);
  const appearanceAdvanced = settings.appearance.advanced;
  const activeAccentColor = appearanceAdvanced.separateModes ? appearanceAdvanced.modeStyles[resolvedTheme].accentColor : settings.appearance.accentColor;
  const customSidebarColor = /^#[\da-f]{6}$/iu.test(settings.appearance.sidebarColor) ? settings.appearance.sidebarColor : null;
  const activeAppearanceFonts = appearanceAdvanced.separateModes ? appearanceAdvanced.modeStyles[resolvedTheme].fonts : appearanceAdvanced.fonts;
  const interfaceFontScale = appearanceAdvanced.interfaceFontSize / 14;
  const contrastDelta = appearanceAdvanced.contrast - 60;
  const backgroundSlot = isSettingsPage ? "settings" : appearanceBackgroundSlotForRoute(route);
  const appearanceBackgrounds = useMemo(() => resolveAppearanceBackgrounds(settings.appearance.backgrounds), [settings.appearance.backgrounds]);
  const selectedBackground = appearanceBackgrounds[backgroundSlot];
  const backgroundFile = selectedBackground === "none"
    ? null
    : selectedBackground.startsWith("user-")
      ? `/api/settings/backgrounds/${encodeURIComponent(selectedBackground)}`
      : backgroundFiles[selectedBackground] ?? null;
  const wallpaperCanvasOwnership = resolveWallpaperCanvasOwnership({
    wallpaperEngineEnabled: settings.appearance.wallpaperEngine.enabled,
    wallpaperProjectId: settings.appearance.wallpaperEngine.projectId,
    wallpaperEngineClientAvailable,
    accountBackgroundAvailable: Boolean(backgroundFile)
  });
  const wallpaperAppearanceTokens = wallpaperCanvasOwnership.wallpaperEngineOwnsCanvas
    ? createDshWallpaperAppearanceTokens({
      theme: resolvedTheme,
      accentColor: activeAccentColor,
      overlay: settings.appearance.overlay,
      blur: settings.appearance.blur,
      canvasColor: resolvedTheme === "dark" ? "#181818" : "#ffffff",
      surfaceColor: resolvedTheme === "dark" ? "#202020" : "#ffffff",
      mutedSurfaceColor: resolvedTheme === "dark" ? "#262626" : "#f5f5f5",
      hoverSurfaceColor: resolvedTheme === "dark" ? "#303030" : "#ededed",
      selectedSurfaceColor: resolvedTheme === "dark" ? "#262626" : "#eaf0ff",
      inverseTextColor: resolvedTheme === "dark" ? "#f7f7f7" : "#fafafa"
    })
    : {};
  const shellStyle = {
    "--settings-accent": activeAccentColor,
    ...(customSidebarColor && !wallpaperCanvasOwnership.wallpaperEngineOwnsCanvas ? customSidebarStyle(customSidebarColor, activeAccentColor) : {}),
    "--font-family-sans": appearanceTextFontStacks[activeAppearanceFonts.interface],
    "--settings-interface-font": appearanceTextFontStacks[activeAppearanceFonts.interface],
    "--settings-content-font": appearanceTextFontStacks[activeAppearanceFonts.content],
    "--settings-code-font": appearanceCodeFontStacks[activeAppearanceFonts.code],
    "--settings-interface-font-size": `${appearanceAdvanced.interfaceFontSize}px`,
    "--settings-code-font-size": `${appearanceAdvanced.codeFontSize}px`,
    "--font-size-xs": `${11 * interfaceFontScale}px`,
    "--font-size-sm": `${12 * interfaceFontScale}px`,
    "--font-size-md": `${13 * interfaceFontScale}px`,
    "--font-size-base": `${appearanceAdvanced.interfaceFontSize}px`,
    "--font-size-lg": `${16 * interfaceFontScale}px`,
    // 设置侧栏标题沿用共享字号层级，并随账户的界面字号同步调整。
    "--font-size-xl": `${20 * interfaceFontScale}px`,
    // 设置分类主标题沿用共享字号层级，并随账户的界面字号同步调整。
    "--font-size-2xl": `${32 * interfaceFontScale}px`,
    "--settings-contrast-strong-mix": `${Math.max(0, contrastDelta) * 0.5}%`,
    "--settings-contrast-soft-mix": `${Math.max(0, -contrastDelta) / 3}%`,
    // 插件运行时由 DSH Appearance 桥接覆盖为插件玻璃令牌；无插件时仍由账户遮罩设置控制。
    "--settings-background-surface-opacity": `${settings.appearance.overlay}%`,
    // 更新日志悬浮卡片与确认弹窗的表面不透明度由账户外观设置控制，避免默认壁纸透出过多。
    "--settings-update-surface-opacity": `${settings.appearance.updateSurfaceOpacity}%`,
    "--settings-background-image": backgroundFile && !wallpaperCanvasOwnership.wallpaperEngineOwnsCanvas ? `url("${backgroundFile}")` : "none",
    // 壁纸遮罩使用深色中性灰或浅色纯白，透明度继续读取账户偏好。
    "--settings-background-overlay": resolvedTheme === "dark" ? `rgba(24, 24, 24, ${settings.appearance.overlay / 100})` : `rgba(255, 255, 255, ${settings.appearance.overlay / 100})`,
    "--settings-glass-blur": `${settings.appearance.blur}px`,
    // AI Work 空闲回复区的模糊半径按账户百分比映射到 0–8px。
    "--settings-ai-work-output-focus-blur": `${appearanceAdvanced.aiWorkOutputFocusBlurPercent * 0.08}px`,
    // AI Work 空闲回复区的不透明度，0% 保持完全可见，100% 淡出至完全透明。
    "--settings-ai-work-output-focus-opacity": `${1 - appearanceAdvanced.aiWorkOutputFocusBlurPercent / 100}`,
    // 插件活动时按原 DSH body 令牌即时映射强调色、表面、透明度、模糊和逐面控制；停用时空对象保留 LFAA 偏好。
    ...wallpaperAppearanceTokens
  } as CSSProperties;

  useLayoutEffect(() => {
    const shell = workbenchShellRef.current;
    if (!shell) return;
    const body = document.body;
    const previousValues = new Map<string, { value: string; priority: string }>();
    const computedShellStyle = window.getComputedStyle(shell);
    for (const property of PORTAL_APPEARANCE_VARIABLES) {
      previousValues.set(property, {
        value: body.style.getPropertyValue(property),
        priority: body.style.getPropertyPriority(property)
      });
      const resolvedValue = computedShellStyle.getPropertyValue(property).trim();
      if (resolvedValue) body.style.setProperty(property, resolvedValue);
      else body.style.removeProperty(property);
    }
    const previousTheme = body.getAttribute("data-lfaa-theme");
    const previousWallpaper = body.getAttribute("data-lfaa-dialog-wallpaper");
    body.setAttribute("data-lfaa-theme", resolvedTheme);
    body.setAttribute("data-lfaa-dialog-wallpaper", wallpaperCanvasOwnership.hasWallpaperBackground ? "true" : "false");
    return () => {
      for (const [property, previous] of previousValues) {
        if (previous.value) body.style.setProperty(property, previous.value, previous.priority);
        else body.style.removeProperty(property);
      }
      if (previousTheme === null) body.removeAttribute("data-lfaa-theme");
      else body.setAttribute("data-lfaa-theme", previousTheme);
      if (previousWallpaper === null) body.removeAttribute("data-lfaa-dialog-wallpaper");
      else body.setAttribute("data-lfaa-dialog-wallpaper", previousWallpaper);
    };
  }, [resolvedTheme, settings.appearance, wallpaperCanvasOwnership.hasWallpaperBackground]);

  useLayoutEffect(() => {
    cacheAppearanceCanvasBootstrap(window.location.pathname, backgroundFile && !wallpaperCanvasOwnership.wallpaperEngineOwnsCanvas ? backgroundFile : null, settings.appearance.overlay);
  }, [backgroundFile, route, settings.appearance.overlay, wallpaperCanvasOwnership.wallpaperEngineOwnsCanvas]);

  let pageContent;
  if (isSettingsPage) {
    pageContent = (
      <Suspense fallback={<div className="loading-page loading-page--compact" aria-busy="true" />}>
        <SettingsPage user={user} serverState={serverState} settings={settings} resolvedTheme={resolvedTheme} initialSection={isLegacyAccountsRoute ? "account" : settingsInitialSection} sectionRequest={settingsSectionRequest} applications={allApplicationNavigationItems} navigationApplications={applicationNavigationItems} onOpenApplication={onOpenApplication} onOpenApplications={requestApplicationsOpen} onOpenRecentSessions={requestRecentSessionsOpen} onBack={() => onNavigate(settingsReturnRoute)} onNavigate={onNavigate} onOpenSettings={openSettings} onLogout={onLogout} onUserChange={onUserChange} onSettingsChange={updateWorkbenchSettings} />
      </Suspense>
    );
  } else if (isFileManagerPage) {
    pageContent = (
      <Suspense fallback={<div className="loading-page loading-page--compact"><span className="loading-indicator" aria-hidden="true" /></div>}>
        <FileManagerPage user={user} settings={settings} serverState={serverState} homeRoute={fileManagerHomeRoute} applications={allApplicationNavigationItems} navigationApplications={applicationNavigationItems} onOpenApplication={onOpenApplication} onOpenApplications={requestApplicationsOpen} onOpenRecentSessions={requestRecentSessionsOpen} onNavigate={onNavigate} onOpenSettings={() => openSettings()} onLogout={onLogout} />
      </Suspense>
    );
  } else if (isCanvasHomePage) {
    pageContent = (
      <Suspense fallback={<div className="loading-page loading-page--compact"><span className="loading-indicator" aria-hidden="true" /></div>}>
        <CanvasHome user={user} settings={settings} serverState={serverState} applications={canvasApplicationItems} navigationApplications={applicationNavigationItems} onNavigate={onNavigate} onOpenApplication={onOpenApplication} onOpenApplications={requestApplicationsOpen} onOpenRecentSessions={requestRecentSessionsOpen} onOpenSettings={openSettings} onLogout={onLogout} />
      </Suspense>
    );
  } else if (appCanvasRoute) {
    pageContent = (
      <Suspense fallback={<div className="loading-page loading-page--compact"><span className="loading-indicator" aria-hidden="true" /></div>}>
        <CanvasWorkspace user={user} applicationId={appCanvasRoute[1] as ApplicationId} initialProjectId={appCanvasRoute[2]} settings={settings} serverState={serverState} applications={canvasApplicationItems} navigationApplications={applicationNavigationItems} onNavigate={onNavigate} onOpenApplication={onOpenApplication} onOpenApplications={requestApplicationsOpen} onOpenRecentSessions={requestRecentSessionsOpen} onOpenSettings={openSettings} onLogout={onLogout} />
      </Suspense>
    );
  } else if (isPluginManagerPage) {
    pageContent = (
      <Suspense fallback={<div className="loading-page loading-page--compact"><span className="loading-indicator" aria-hidden="true" /></div>}>
        <PluginManagerPage user={user} settings={settings} resolvedTheme={resolvedTheme} serverState={serverState} applications={allApplicationNavigationItems} navigationApplications={applicationNavigationItems} onNavigate={onNavigate} onOpenApplication={onOpenApplication} onOpenApplications={requestApplicationsOpen} onOpenRecentSessions={requestRecentSessionsOpen} onOpenSettings={openSettings} onLogout={onLogout} onUserChange={onUserChange} onSettingsChange={updateWorkbenchSettings} />
      </Suspense>
    );
  } else if (appRoute) {
    const app = appRoute[1] as ApplicationId;
    const aiState = aiWorkUiState;
    pageContent = (
      <Suspense fallback={<div className="loading-page loading-page--compact"><span className="loading-indicator" aria-hidden="true" /></div>}>
        <ApplicationWorkspace
          key={`${app}:${appRoute[2]}`}
          userId={user.id}
          app={app}
          mode={appRoute[2] as ApplicationMode}
          section={appRoute[3] || "overview"}
          gameLibrary={isGameLibraryRoute}
          workspaceTitle={isGameLibraryRoute ? app === "workspace" ? appRoute[3] === "environments" ? "运行环境" : "游戏库" : app === "steamcmd" ? "Steam 游戏服务" : undefined : undefined}
          applicationContent={isGameLibraryRoute && app === "workspace" ? <GameLibraryPage onOpenStorage={() => openSettings("workspace")} user={user} environments={appRoute[3] === "environments"} onNavigate={onNavigate} />
            : isGameLibraryRoute && app === "steamcmd" ? <SteamcmdWorkspace user={user} onNavigate={onNavigate} /> : undefined}
          settings={settings}
          onSettingsChange={updateWorkbenchSettings}
          apps={[...applicationCards, { id: "workspace", title: "小鱼智能体", initials: "L", color: "blue" }]}
          applicationNavigationItems={applicationNavigationItems}
          username={user.username}
          role={user.role}
          serverState={serverState}
          error={error}
          onBack={() => onNavigate(isGameLibraryRoute ? "/games" : `/apps/${app === "workspace" ? preferences.selectedApp : app}/normal`)}
          onOpenSelectedApplication={() => onOpenApplication(preferences.selectedApp, "normal")}
          onSelectedModeHome={() => onNavigate(isGameLibraryRoute ? "/games" : appRoute[2] === "ai-work" ? SHARED_WORK_ROUTE : `/apps/${app}/normal`)}
          onNavigate={onNavigate}
          onOpenSettings={openSettings}
          onOpenApplication={onOpenApplication}
          recentSessionsOpenRequestId={recentSessionsOpenRequestId}
          onRecentSessionsOpenRequestHandled={handleRecentSessionsOpenRequest}
          rightPanelSection={workspaceRightPanelSection}
          onRightPanelSectionChange={setWorkspaceRightPanelSection}
          applicationsOpenRequestId={applicationsOpenRequestId}
          onApplicationsOpenRequestHandled={handleApplicationsOpenRequest}
          activeAiSessionId={aiState.activeSessionId}
          aiDraft={aiWorkDraft}
          aiWorkGoal={app === "workspace" && appRoute[2] === "ai-work" ? pendingAiWorkGoal : null}
          onAiWorkGoalConsumed={consumeAiWorkGoal}
          onActiveAiSessionChange={(activeSessionId) => updateAiWorkUiState({ activeSessionId })}
          onAiDraftChange={(draft) => updateAiWorkDraft(draft)}
          notifications={notifications}
          onNotification={addAiWorkNotification}
          onMarkNotificationsRead={markNotificationsRead}
          onClearNotifications={clearNotifications}
          onOpenNotification={openNotification}
          onLogout={onLogout}
        />
      </Suspense>
    );
  } else {
    pageContent = (
      <section className="module-page" aria-labelledby="missing-route-heading">
        <Typography.Title id="missing-route-heading" level={2}>页面不存在</Typography.Title>
        <Typography.Paragraph>这个地址没有对应的工作台页面。</Typography.Paragraph>
        <Button type="primary" onClick={() => onNavigate(SHARED_WORK_ROUTE)}>返回首页</Button>
      </section>
    );
  }

  return (
    <ConfigProvider theme={{
      algorithm: resolvedTheme === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      token: {
        colorPrimary: activeAccentColor,
        colorText: resolvedTheme === "dark" ? "#e5e5e5" : "#171717",
        colorTextSecondary: resolvedTheme === "dark" ? "#c7c7c7" : "#525252",
        colorBgBase: resolvedTheme === "dark" ? "#181818" : "#ffffff",
        colorBgContainer: resolvedTheme === "dark" ? "#202020" : "#ffffff",
        colorBorder: resolvedTheme === "dark" ? "#3a3a3a" : "#dedede",
        fontFamily: "var(--font-family-sans)"
      }
    }}>
    <div ref={workbenchShellRef} className={`workbench-shell${appRoute || isFileManagerPage || isCanvasPage || isPluginManagerPage ? " workbench-shell--module" : ""}${isSettingsPage ? " workbench-shell--settings" : ""}`} data-theme={resolvedTheme} data-background-image={wallpaperCanvasOwnership.hasWallpaperBackground ? "true" : "false"} data-wallpaper-engine-owner={wallpaperCanvasOwnership.wallpaperEngineOwnsCanvas ? "true" : "false"} data-custom-sidebar-color={customSidebarColor && !wallpaperCanvasOwnership.wallpaperEngineOwnsCanvas ? "true" : "false"} data-reduced-motion={appearanceAdvanced.reducedMotion} data-card-motion-effect={settings.general.cardMotionEffect ?? DEFAULT_USER_SETTINGS.general.cardMotionEffect} data-translucent-sidebar={appearanceAdvanced.translucentSidebar ? "true" : "false"} data-diff-markers={appearanceAdvanced.diffMarkers} data-pointer-cursor={appearanceAdvanced.pointerCursor ? "true" : "false"} data-ai-work-output-focus-blur={appearanceAdvanced.aiWorkOutputFocusBlurEnabled ? "true" : "false"} style={shellStyle as CSSProperties}>
      {!isSettingsPage ? <header className="topbar">
        <button className="brand-lockup brand-lockup--button" type="button" onClick={() => onNavigate(SHARED_WORK_ROUTE)}>
          <span className="brand-mark" aria-hidden="true">L</span>
          <span className="brand-name">LFAA</span>
        </button>
        {desktopUpdateDownloadProgress ? <Button
          className="lfaa-update-entry lfaa-update-entry--progress"
          aria-label={`LFAA ${desktopUpdateDownloadProgress.version} ${desktopUpdateDownloadProgress.phase === "cancelling" ? "正在取消下载" : "正在下载更新"}`}
          aria-live="polite"
          onClick={() => setDownloadProgressOpen(true)}
        >
          <span className="lfaa-update-entry__spinner" aria-hidden="true" />
          {desktopUpdateDownloadProgress.phase === "cancelling" ? "正在取消更新…" : desktopUpdateDownloadProgress.percent === null
            ? "正在准备下载更新…"
            : `正在下载更新… ${formatDesktopUpdateBytes(desktopUpdateDownloadProgress.transferredBytes)} / ${desktopUpdateDownloadProgress.totalBytes === null ? "未知大小" : formatDesktopUpdateBytes(desktopUpdateDownloadProgress.totalBytes)}`}
        </Button> : desktopAvailableUpdate ? <Popover
          open={updatePopoverOpen}
          onOpenChange={setUpdatePopoverOpen}
          trigger={["hover", "focus"]}
          placement="bottomLeft"
          overlayClassName="lfaa-update-popover"
          getPopupContainer={trigger => trigger.parentElement ?? document.body}
          content={<section className="lfaa-update-card" aria-label={`LFAA ${desktopAvailableUpdate.version} 更新日志`}>
            <Typography.Text className="lfaa-update-card__title">LFAA {desktopAvailableUpdate.version} 更新日志</Typography.Text>
            <Typography.Text className="lfaa-update-card__date">{desktopAvailableUpdate.publishedAt}</Typography.Text>
            <div className="lfaa-update-card__divider" />
            <Typography.Text strong>更新内容</Typography.Text>
            <ul>{desktopAvailableUpdate.releaseNotes.map((note, index) => <li key={`${index}-${note}`}>{note}</li>)}</ul>
          </section>}
        >
          <Button className="lfaa-update-entry" aria-label={`打开 LFAA ${desktopAvailableUpdate.version} 更新提示`} aria-haspopup="dialog" aria-expanded={updatePopoverOpen} onClick={openDesktopUpdatePrompt}>更新</Button>
        </Popover> : null}
        <nav className="topbar-nav" aria-label="主导航">
          <Button type="text" className={normalizeWorkRoute(route) === SHARED_WORK_ROUTE ? "nav-button nav-button--active" : "nav-button"} onClick={() => onNavigate(SHARED_WORK_ROUTE)}>小鱼智能体</Button>
          <Button type="text" className={isFileManagerPage ? "nav-button nav-button--active" : "nav-button"} onClick={() => onNavigate("/files")}>文件管理</Button>
          <Button type="text" className={isSettingsPage ? "nav-button nav-button--active" : "nav-button"} onMouseEnter={preloadSettingsPageModule} onFocus={preloadSettingsPageModule} onClick={() => openSettings()} aria-keyshortcuts="Control+, Meta+,">设置中心</Button>
        </nav>
        <div className="topbar-account">
          {settings.general.showServiceStatus ? <ServiceStatus state={serverState} /> : null}
          <span className="account-identity">
            <span className="account-username">{user.username}</span>
            <span className="account-role">{userRoleLabel(user.role)}</span>
          </span>
          <Button className="logout-button" onClick={onLogout}>退出登录</Button>
        </div>
      </header> : null}

      <main className={`workbench-content${appRoute || isFileManagerPage || isCanvasPage || isPluginManagerPage ? " workbench-content--module" : ""}${isSettingsPage ? " workbench-content--settings" : ""}`}>
        {pageContent}
      </main>
      {desktopUpdateDownloadProgress && downloadProgressOpen ? <Modal
        open
        centered
        width={520}
        footer={null}
        title={null}
        closable
        maskClosable={false}
        getContainer={false}
        className="lfaa-update-modal"
        onCancel={() => setDownloadProgressOpen(false)}
      >
        <section className="lfaa-update-download" aria-labelledby="lfaa-update-download-title" aria-live="polite">
          <header className="lfaa-update-prompt__header">
            <span className="lfaa-update-prompt__brand" aria-hidden="true">L</span>
            <div className="lfaa-update-prompt__heading">
              <Typography.Text className="lfaa-update-prompt__eyebrow">
                {desktopUpdateDownloadProgress.phase === "cancelling" ? "正在取消下载" : desktopUpdateDownloadProgress.percent === null ? "正在准备下载" : "正在下载更新"}
              </Typography.Text>
              <Typography.Title id="lfaa-update-download-title" level={3}>LFAA {desktopUpdateDownloadProgress.version}</Typography.Title>
            </div>
          </header>
          <div className="lfaa-update-download__summary">
            <Typography.Text>下载进度</Typography.Text>
            <Typography.Text className="lfaa-update-download__numbers">
              {desktopUpdateDownloadProgress.percent === null ? "连接更新服务…" : `${formatDesktopUpdateBytes(desktopUpdateDownloadProgress.transferredBytes)} / ${desktopUpdateDownloadProgress.totalBytes === null ? "大小未知" : formatDesktopUpdateBytes(desktopUpdateDownloadProgress.totalBytes)}`}
            </Typography.Text>
          </div>
          <div
            className={`lfaa-update-download__bar${desktopUpdateDownloadProgress.percent === null ? " lfaa-update-download__bar--indeterminate" : ""}`}
            role="progressbar"
            aria-label={`LFAA ${desktopUpdateDownloadProgress.version} 下载进度`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={desktopUpdateDownloadProgress.percent === null ? undefined : Math.round(desktopUpdateDownloadProgress.percent)}
          >
            <span style={{ width: desktopUpdateDownloadProgress.percent === null ? undefined : `${Math.max(0, Math.min(100, desktopUpdateDownloadProgress.percent))}%` }} />
          </div>
          <div className="lfaa-update-download__footnote">
            <Typography.Text type="secondary">{desktopUpdateDownloadProgress.percent === null ? "正在连接更新服务" : `${Math.round(desktopUpdateDownloadProgress.percent)}% · ${formatDesktopUpdateBytes(desktopUpdateDownloadProgress.bytesPerSecond)}/秒`}</Typography.Text>
            {updateDownloadCancelError ? <Typography.Text type="danger">{updateDownloadCancelError}</Typography.Text> : null}
          </div>
          <footer className="lfaa-update-prompt__actions">
            <Button disabled={desktopUpdateDownloadProgress.phase === "cancelling"} onClick={() => void cancelDesktopUpdateDownload()}>
              {desktopUpdateDownloadProgress.phase === "cancelling" ? "正在取消…" : "取消下载"}
            </Button>
          </footer>
        </section>
      </Modal> : null}
      {desktopUpdatePrompt ? <Modal
        open
        centered
        width={520}
        footer={null}
        title={null}
        closable={false}
        maskClosable={desktopUpdatePrompt.kind === "notice" || !desktopUpdatePrompt.mandatory}
        keyboard={desktopUpdatePrompt.kind === "notice" || !desktopUpdatePrompt.mandatory}
        getContainer={false}
        className="lfaa-update-modal"
        onCancel={() => respondToDesktopUpdatePrompt(desktopUpdatePrompt, desktopUpdatePrompt.kind === "install" ? "later" : desktopUpdatePrompt.kind === "download" ? "defer" : "dismiss")}
      >
        <section className="lfaa-update-prompt" aria-labelledby="lfaa-update-prompt-title">
          <header className="lfaa-update-prompt__header">
            <span className="lfaa-update-prompt__brand" aria-hidden="true">L</span>
            <div className="lfaa-update-prompt__heading">
              <Typography.Text className="lfaa-update-prompt__eyebrow">{desktopUpdatePrompt.kind === "notice" ? "更新状态" : desktopUpdatePrompt.kind === "install" ? "更新已准备就绪" : "发现新版本"}</Typography.Text>
              <Typography.Title id="lfaa-update-prompt-title" level={3}>
                {desktopUpdatePrompt.kind === "notice" ? desktopUpdatePrompt.title : `LFAA ${desktopUpdatePrompt.version}`}
              </Typography.Title>
            </div>
            {desktopUpdatePrompt.kind !== "download" || desktopUpdatePrompt.mandatory ? null : <button
              className="lfaa-update-prompt__close"
              type="button"
              onClick={() => respondToDesktopUpdatePrompt(desktopUpdatePrompt, "defer")}
              aria-label="暂不更新"
            ><WorkbenchIcon name="close" size={16} /></button>}
          </header>
          {desktopUpdatePrompt.kind === "notice" ? <div className="lfaa-update-prompt__notice">
            <Typography.Paragraph>{desktopUpdatePrompt.message}</Typography.Paragraph>
            {desktopUpdatePrompt.detail ? <Typography.Text type="secondary">{desktopUpdatePrompt.detail}</Typography.Text> : null}
          </div> : <>
            <div className="lfaa-update-prompt__meta">
              <Tag className="lfaa-update-prompt__tag">{desktopUpdatePrompt.kind === "install" ? "已准备就绪" : desktopUpdatePrompt.mandatory ? "必须更新" : "稳定版"}</Tag>
              <Typography.Text type="secondary">发布于 {desktopUpdatePrompt.publishedAt}</Typography.Text>
            </div>
            <div className="lfaa-update-prompt__notes">
              <Typography.Text strong>本次更新</Typography.Text>
              <ul>{desktopUpdatePrompt.releaseNotes.map((note, index) => <li key={`${index}-${note}`}>{note}</li>)}</ul>
            </div>
            {desktopUpdatePrompt.kind === "download" ? <>
              {desktopUpdatePreferences ? <div className="lfaa-update-prompt__auto-update">
                <Checkbox
                  checked={desktopUpdatePreferences.autoDownloadAndInstall}
                  disabled={desktopUpdatePreferenceSaving}
                  onChange={event => void setAutoUpdatePreference(event.target.checked)}
                >以后自动下载并安装更新</Checkbox>
                <Typography.Text className="lfaa-update-prompt__auto-update-hint">开启后，新版本会自动下载并重启 LFAA；本机控制端和托管中的游戏服务也会先关闭。</Typography.Text>
                {desktopUpdatePreferenceError ? <Typography.Text type="danger">{desktopUpdatePreferenceError}</Typography.Text> : null}
              </div> : null}
              <Typography.Paragraph className="lfaa-update-prompt__hint">
                下载会在确认后开始；未开启自动更新时，安装仍会再次询问。
              </Typography.Paragraph>
            </> : <Typography.Paragraph className="lfaa-update-prompt__hint">
              选择“稍后”可继续使用；退出 LFAA 时会安装已下载更新。选择重启并安装会先关闭本机控制端和 Daemon，再启动 Windows 安装程序。
            </Typography.Paragraph>}
          </>}
          <footer className="lfaa-update-prompt__actions">
            {desktopUpdatePrompt.kind === "notice" ? <Button type="primary" onClick={() => respondToDesktopUpdatePrompt(desktopUpdatePrompt, "dismiss")}>知道了</Button>
              : desktopUpdatePrompt.kind === "download" ? <>
                {desktopUpdatePrompt.mandatory ? null : <Button onClick={() => respondToDesktopUpdatePrompt(desktopUpdatePrompt, "skip")}>跳过此版本</Button>}
                {desktopUpdatePrompt.mandatory ? null : <Button onClick={() => respondToDesktopUpdatePrompt(desktopUpdatePrompt, "defer")}>稍后</Button>}
                <Button type="primary" onClick={() => respondToDesktopUpdatePrompt(desktopUpdatePrompt, "accept")}>{desktopUpdatePrompt.mandatory ? "下载并安装更新" : "下载更新"}</Button>
              </> : <>
                {desktopUpdatePrompt.mandatory ? null : <Button onClick={() => respondToDesktopUpdatePrompt(desktopUpdatePrompt, "later")}>稍后</Button>}
                <Button type="primary" onClick={() => respondToDesktopUpdatePrompt(desktopUpdatePrompt, "install")}>重启并安装</Button>
              </>}
          </footer>
        </section>
      </Modal> : null}
      {lfaaProjectBuildInfo && releaseAnnouncementOpen ? <Modal
        rootClassName="release-announcement-modal"
        open
        centered
        width={840}
        footer={null}
        title={null}
        closable
        maskClosable={false}
        keyboard
        getContainer={() => workbenchShellRef.current ?? document.body}
        onCancel={acknowledgeReleaseAnnouncement}
      >
        <section className="release-announcement" aria-labelledby="release-announcement-title">
          <header className="release-announcement__header">
            <span className="release-announcement__brand">LFAA</span>
            <Typography.Title id="release-announcement-title" level={2}>温馨提醒</Typography.Title>
          </header>
          <div className="release-announcement__body">
            <section className="release-announcement__hero" aria-label={`LFAA ${releaseAnnouncementVersion} 本次公告`}>
              <span className="release-announcement__badge">本次公告</span>
              <Typography.Title level={3}>LFAA {releaseAnnouncementVersion} 版本更新</Typography.Title>
              <Typography.Text>发布日期：{lfaaProjectBuildInfo.publishedAt}</Typography.Text>
            </section>
            <div className="release-announcement__notes" aria-label="更新内容">
              {lfaaProjectBuildInfo.releaseNotes.map((note, index) => <article className="release-announcement__note" key={`${index}-${note}`}>
                <span className="release-announcement__number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <p>{note}</p>
              </article>)}
            </div>
          </div>
          <footer className="release-announcement__footer">
            <Button type="primary" onClick={acknowledgeReleaseAnnouncement}>我知道了</Button>
          </footer>
        </section>
      </Modal> : null}
      {/* DSH overlay 依赖当前应用工作台的右侧栏 Owner；设置页没有该面板，不挂载不可用的入口。 */}
      {appRoute ? <DshSlotOutlet name="shell.overlay" /> : null}
      {notificationToast && settings.general.notificationPopupsEnabled ? <aside className={`ai-work-notification-toast ai-work-notification-toast--${notificationToast.kind}`} role={notificationToast.kind === "complete" ? "status" : "alert"} aria-live={notificationToast.kind === "complete" ? "polite" : "assertive"}>
        <div className="ai-work-notification-toast__main">
          <button className="ai-work-notification-toast__open" type="button" onClick={() => openNotification(notificationToast)} aria-label={`${notificationToast.title}，点击打开${notificationToast.applicationName}会话`}>
            <span className="ai-work-notification-toast__icon"><WorkbenchIcon name={notificationToast.kind === "complete" ? "spark" : "close"} size={17} /></span>
            <span className="ai-work-notification-toast__copy"><strong>{notificationToast.title}</strong><span>{notificationToast.applicationName} · {notificationToast.body}</span><small>点击打开对应会话</small></span>
          </button>
          <button className="ai-work-notification-toast__close" type="button" onClick={() => setNotificationToast(null)} aria-label="关闭会话提醒"><WorkbenchIcon name="close" size={14} /></button>
        </div>
      </aside> : null}
      <SetupReminder
        user={user}
        settings={settings}
        isSettingsPage={isSettingsPage}
        suspended={suspendSetupReminder}
        onSettingsChange={setSettings}
        onOpenSettings={openSettings}
        onModalActivityChange={setSetupReminderActivity}
        priorityPrompt={credentialReminder ? {
          title: "建议修改默认登录凭据",
          description: credentialReminder.usernamePending && credentialReminder.passwordPending
            ? "当前仍在使用系统默认用户名和密码。建议在设置中心的「安全」页面分别修改，之后可使用新凭据登录。"
            : credentialReminder.usernamePending
              ? "当前仍在使用系统默认用户名。建议在设置中心的「安全」页面修改。"
              : "当前仍在使用系统默认密码。建议在设置中心的「安全」页面修改。",
          action: "前往设置中心",
          onAction: () => openSettings("security")
        } : null}
      />
      <PasskeySetupPrompt user={user} isSettingsPage={isSettingsPage} notificationPopupsEnabled={settings.general.notificationPopupsEnabled} onOpenSettings={openSettings} onPromptActivityChange={setPasskeyPromptActivity} />
      {!isSettingsPage ? <footer className={`workbench-footer${appRoute || isFileManagerPage || isCanvasPage || isPluginManagerPage ? " workbench-footer--module" : ""}`}>
        <span>LFAA 本机与远程主机应用工作台</span>
        <span>当前阶段：小鱼智能体工作台</span>
      </footer> : null}
    </div>
    </ConfigProvider>
  );
}
