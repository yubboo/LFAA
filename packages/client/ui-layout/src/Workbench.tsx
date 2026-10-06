/** 功能：呈现现有工作台。作用：消费已保存设置并组合能力包界面。关联文件：client/connection、ui-settings、ui-theme、ui-commands。 */
import { DshSlotOutlet, loadClientModule } from "lfaa-client-modules/src/client/index.js";
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Alert, Button, Card, Checkbox, ConfigProvider, Modal, Popover, Tag, Typography, theme as antdTheme } from "antd";
import { ServiceStatus, type ServiceState } from "lfaa-client-ui-primitives/src/ServiceStatus.js";
import { SetupReminder } from "lfaa-client-ui-settings-general/src/SetupReminder.js";
import { resolveAppearanceBackgrounds, resolveShortcutSettings } from "lfaa-client-ui-settings-general/src/default-settings.js";
import { PasskeySetupPrompt } from "lfaa-client-ui-settings-account/src/PasskeySetupPrompt.js";
import { minecraftSceneBackgrounds } from "lfaa-client-ui-minecraft/src/assets/minecraftScenes.js";
import { cacheLoginBackground } from "lfaa-client-ui-theme/src/login-background.js";
import { aiWorkSessionOpenEventName, type AiWorkNotification, type AiWorkNotificationInput, type AiWorkSessionTarget } from "lfaa-client-resources/src/notification-runtime.js";
import { createAiWorkDraftPersistence, readAiWorkDraft, writeAiWorkDraft } from "lfaa-client-store/src/ai-work-drafts.js";
import { createBrowserPersistence, createDebouncedPersistenceWriter, stringPersistenceCodec, type DebouncedPersistenceWriter } from "lfaa-client-store/src/browser-persistence.js";
import { createScrollRestorationKey, useScrollRestoration } from "lfaa-client-store/src/scroll-restoration.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { saveSettings, userRoleLabel, type ApplicationId, type ApplicationMode, type DesktopAvailableUpdate, type DesktopUpdatePreferences, type DesktopUpdatePrompt, type DesktopUpdatePromptAction, type User, type UserPreferences, type UserSettings } from "lfaa-client-connection/src/api.js";
import { shortcutMatches } from "lfaa-client-ui-commands/src/shortcuts.js";
import { appearanceTextFontStacks, appearanceCodeFontStacks } from "lfaa-client-ui-theme/src/fonts.js";
import { applyAppearanceThemeBootstrap } from "lfaa-client-ui-theme/src/appearance-theme-bootstrap.js";
import { bindDshThemeOwner, dshThemeCompatibility, syncDshThemePreference } from "lfaa-client-ui-theme/src/dsh-theme-bridge.js";
import { dshLocaleRuntime } from "lfaa-client-ui-workspace/src/dsh-locale-runtime.js";
import { resolveWallpaperCanvasOwnership } from "./wallpaper-canvas-ownership.js";
import { appearanceBackgroundSlotForRoute } from "./appearance-background-slot.js";



interface WorkbenchProps {
  user: User;
  preferences: UserPreferences;
  initialSettings: UserSettings;
  serverState: ServiceState;
  route: string;
  error: string | null;
  opening: string | null;
  onNavigate: (path: string) => void;
  onOpenApplication: (app: ApplicationId, mode: ApplicationMode) => Promise<void>;
  onUserChange: (user: User) => void;
  onLogout: () => void;
}

interface ApplicationCardProps {
  app: ApplicationId;
  title: string;
  initials: string;
  description: string;
  color: "blue" | "green" | "plum";
  selected: boolean;
  selectedMode: ApplicationMode;
  defaultMode: ApplicationMode;
  opening: string | null;
  focused: boolean;
  continueSession: boolean;
  onOpen: (mode: ApplicationMode) => void;
  supportsAiWork?: boolean;
}

interface AiWorkUiState {
  activeSessionId: string | null;
}

let settingsPageModulePromise: Promise<typeof import("lfaa-client-ui-settings/src/SettingsPage.js")> | null = null;
let fileManagerPageModulePromise: Promise<typeof import("lfaa-client-ui-sidebar-files/src/FileManagerPage.js")> | null = null;

function loadFileManagerPageModule() {
  if (!fileManagerPageModulePromise) {
    fileManagerPageModulePromise = loadClientModule<typeof import("lfaa-client-ui-sidebar-files/src/FileManagerPage.js")>("lfaa-client-ui-sidebar-files/src/FileManagerPage.js").catch((error: unknown) => {
      fileManagerPageModulePromise = null;
      throw error;
    });
  }
  return fileManagerPageModulePromise;
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

// 将文件页来源归一为应用模式根页；通用任务的正式入口 `/tasks` 对应 workspace AI Work。
function applicationModeHomeRoute(pathname: string): string | null {
  if (pathname === "/tasks") return "/apps/workspace/ai-work";
  const match = pathname.match(/^\/apps\/(steamcmd|minecraft|connectivity|writing|workspace)\/(normal|ai-work)(?:\/|$)/u);
  return match ? `/apps/${match[1]}/${match[2]}` : null;
}

const SettingsPage = lazy(() => loadSettingsPageModule().then((module) => ({ default: module.SettingsPage })));
const FileManagerPage = lazy(() => loadFileManagerPageModule().then((module) => ({ default: module.FileManagerPage })));
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

const AI_WORK_APPLICATIONS: readonly ApplicationId[] = ["workspace", "steamcmd", "minecraft", "connectivity", "writing"];
const AI_WORK_DRAFT_SAVE_DELAY_MS = 250;

function readAiWorkDrafts(userId: string): Record<ApplicationId, string> {
  return {
    workspace: readAiWorkDraft(userId, "workspace"),
    steamcmd: readAiWorkDraft(userId, "steamcmd"),
    minecraft: readAiWorkDraft(userId, "minecraft"),
    connectivity: readAiWorkDraft(userId, "connectivity"),
    writing: readAiWorkDraft(userId, "writing")
  };
}

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
  id: ApplicationId;
  title: string;
  initials: string;
  description: string;
  color: "blue" | "green" | "plum";
  supportsAiWork?: boolean;
}> = [
  {
    id: "steamcmd",
    title: "SteamCMD 游戏服务",
    initials: "S",
    description: "为游戏目录、部署参数与实例管理预留统一入口。",
    color: "blue"
  },
  {
    id: "minecraft",
    title: "Minecraft 管理",
    initials: "M",
    description: "为 Java 环境、服务端配置与世界存档建立工作区。",
    color: "green"
  },
  {
    id: "connectivity",
    title: "LFAA 联机服务",
    initials: "N",
    description: "统一管理游戏组网、第三方穿透、自备线路与房间域名。",
    color: "blue",
    supportsAiWork: false
  },
  {
    id: "writing",
    title: "写作空间",
    initials: "W",
    description: "为作品、章节和资料整理提供独立的应用入口。",
    color: "plum"
  }
];

function ApplicationCard({ app, title, initials, description, color, selected, selectedMode, defaultMode, opening, focused, continueSession, onOpen, supportsAiWork = true }: ApplicationCardProps) {
  const normalButtonRef = useRef<HTMLButtonElement | null>(null);
  const aiWorkButtonRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!focused) return;
    const targetButton = supportsAiWork && (continueSession || defaultMode === "ai-work") ? aiWorkButtonRef.current : normalButtonRef.current;
    targetButton?.focus({ preventScroll: true });
  }, [continueSession, defaultMode, focused, supportsAiWork]);

  return (
    <Card className={`application-card application-card--${app} application-card--${color}${selected ? " application-card--selected" : ""}${focused ? " application-card--focus-target" : ""}`}>
      <div className="application-card__topline">
        <span className={`application-monogram application-monogram--${color}`} aria-hidden="true">{initials}</span>
        {continueSession
          ? <Tag className="selected-tag">已选择会话</Tag>
          : selected && <Tag className="selected-tag">上次打开 · {selectedMode === "normal" ? "常规模式" : "AI Work"}</Tag>}
      </div>
      <div className="application-card__copy">
        <Typography.Title level={3}>{title}</Typography.Title>
        <Typography.Paragraph>{description}</Typography.Paragraph>
        <span className="development-state">{app === "minecraft" ? "开服部署已接入 · 实机验收中" : app === "connectivity" ? "独立联机入口 · Relay 与插件接入中" : app === "steamcmd" ? "工具已接入 · 游戏开服待接入" : "正文编辑已接入"}</span>
      </div>
      <div className="application-card__actions">
        <Button
          ref={normalButtonRef}
          type={defaultMode === "normal" || !supportsAiWork ? "primary" : "default"}
          loading={opening === `${app}:normal`}
          disabled={opening !== null}
          onClick={() => onOpen("normal")}
        >
          常规模式
        </Button>
        {supportsAiWork ? <Button
          ref={aiWorkButtonRef}
          className={`ai-work-button${defaultMode === "ai-work" || continueSession ? " ai-work-button--preferred" : ""}`}
          loading={opening === `${app}:ai-work`}
          disabled={opening !== null}
          onClick={() => onOpen("ai-work")}
        >
          {continueSession ? "继续所选会话" : "AI Work"}
        </Button> : null}
      </div>
    </Card>
  );
}

export function Workbench({
  user,
  preferences,
  initialSettings,
  serverState,
  route,
  error,
  opening,
  onNavigate,
  onOpenApplication,
  onUserChange,
  onLogout
}: WorkbenchProps) {
  const appRoute = route === "/tasks" ? [route, "workspace", "ai-work", "overview"] : route.match(/^\/apps\/(steamcmd|minecraft|connectivity|writing|workspace)\/(normal|ai-work)(?:\/(.*))?$/);
  const currentRouteApp = appRoute ? appRoute[1] as ApplicationId : null;
  const generalTaskEntryButtonRef = useRef<HTMLButtonElement | null>(null);
  const isFileManagerPage = route === "/files";
  const isLegacyAccountsRoute = route === "/admin/users";
  const isSettingsPage = route === "/settings" || isLegacyAccountsRoute;
  // 文件页房子返回来源 App/模式根；从设置进入时再追溯设置页保存的来源路由。
  const previousRoute = useRef(route);
  const fileManagerEntryRoute = route === "/files" && previousRoute.current !== "/files" ? previousRoute.current : null;
  useEffect(() => {
    if (route !== "/files") previousRoute.current = route;
  }, [route]);
  useScrollRestoration(
    isSettingsPage || appRoute || isFileManagerPage ? "" : createScrollRestorationKey(user.id, "workbench-page", route),
    true,
    "window"
  );
  const [settingsReturnRoute, setSettingsReturnRoute] = useState(() =>
    route === "/settings" || route === "/admin/users" ? `/apps/${preferences.selectedApp}/${preferences.selectedMode}` : "/",
  );
  const fileManagerSourceRoute = fileManagerEntryRoute === "/settings" || fileManagerEntryRoute === "/admin/users"
    ? settingsReturnRoute
    : fileManagerEntryRoute;
  const fileManagerHomeRoute = applicationModeHomeRoute(fileManagerSourceRoute ?? "")
    ?? `/apps/${preferences.selectedApp}/${preferences.selectedMode}`;
  const settingsReturnBackgroundRef = useRef<HTMLImageElement | null>(null);
  const [settingsInitialSection, setSettingsInitialSection] = useState<"ai" | "permissions" | "configuration" | "account" | undefined>();
  const [settings, setSettings] = useState<UserSettings>(initialSettings);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const workbenchShellRef = useRef<HTMLDivElement | null>(null);
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
  const [aiWorkUiState, setAiWorkUiState] = useState<Record<ApplicationId, AiWorkUiState>>(() => ({
    workspace: { activeSessionId: readActiveAiSession(user.id, "workspace") },
    steamcmd: { activeSessionId: readActiveAiSession(user.id, "steamcmd") },
    minecraft: { activeSessionId: readActiveAiSession(user.id, "minecraft") },
    connectivity: { activeSessionId: readActiveAiSession(user.id, "connectivity") },
    writing: { activeSessionId: readActiveAiSession(user.id, "writing") }
  }));
  const [notifications, setNotifications] = useState<AiWorkNotification[]>([]);
  const [notificationToast, setNotificationToast] = useState<AiWorkNotification | null>(null);
  const [desktopUpdatePrompt, setDesktopUpdatePrompt] = useState<DesktopUpdatePrompt | null>(null);
  const [desktopAvailableUpdate, setDesktopAvailableUpdate] = useState<DesktopAvailableUpdate | null>(null);
  const [desktopUpdatePreferences, setDesktopUpdatePreferences] = useState<DesktopUpdatePreferences | null>(null);
  const [desktopUpdatePreferenceSaving, setDesktopUpdatePreferenceSaving] = useState(false);
  const [desktopUpdatePreferenceError, setDesktopUpdatePreferenceError] = useState("");
  const [updatePopoverOpen, setUpdatePopoverOpen] = useState(false);
  const updateAvailabilityRevision = useRef(0);
  const [applicationCenterFocusApp, setApplicationCenterFocusApp] = useState<ApplicationId | null>(null);
  const [pendingSessionApp, setPendingSessionApp] = useState<ApplicationId | null>(null);
  const notificationSequence = useRef(0);
  const aiWorkDraftWriters = useRef<{ userId: string; writers: Record<ApplicationId, DebouncedPersistenceWriter<string>> } | null>(null);
  const aiWorkDraftState = useRef<{ userId: string; values: Record<ApplicationId, string> } | null>(null);
  if (aiWorkDraftState.current?.userId !== user.id) aiWorkDraftState.current = { userId: user.id, values: readAiWorkDrafts(user.id) };
  const aiWorkDrafts = aiWorkDraftState.current!.values;
  useEffect(() => {
    const desktop = window.lfaaDesktop;
    if (!desktop) return;
    const unsubscribe = desktop.onUpdatePrompt(setDesktopUpdatePrompt);
    const unsubscribeAvailability = desktop.onUpdateAvailable(update => {
      updateAvailabilityRevision.current += 1;
      setDesktopAvailableUpdate(update);
    });
    void desktop.getUpdateAvailability().then(update => {
      if (updateAvailabilityRevision.current === 0) setDesktopAvailableUpdate(update);
    }).catch(() => undefined);
    void desktop.getUpdatePreferences().then(setDesktopUpdatePreferences).catch(() => undefined);
    void desktop.updatePromptUiReady().catch(() => undefined);
    return () => {
      unsubscribe();
      unsubscribeAvailability();
      void desktop.updatePromptUiNotReady().catch(() => undefined);
    };
  }, []);
  useEffect(() => {
    const writers = {} as Record<ApplicationId, DebouncedPersistenceWriter<string>>;
    for (const appId of AI_WORK_APPLICATIONS) {
      writers[appId] = createDebouncedPersistenceWriter(createAiWorkDraftPersistence(user.id, appId), {
        delayMs: AI_WORK_DRAFT_SAVE_DELAY_MS,
        removeWhen: (draft) => draft.length === 0
      });
      writers[appId].bindPageLifecycle();
    }
    const state = { userId: user.id, writers };
    aiWorkDraftWriters.current = state;
    return () => {
      for (const appId of AI_WORK_APPLICATIONS) writers[appId].dispose();
      if (aiWorkDraftWriters.current === state) aiWorkDraftWriters.current = null;
    };
  }, [user.id]);
  const updateAiWorkDraft = useCallback((appId: ApplicationId, draft: string) => {
    aiWorkDrafts[appId] = draft;
    const currentWriters = aiWorkDraftWriters.current;
    if (currentWriters?.userId === user.id) currentWriters.writers[appId].schedule(draft);
    else writeAiWorkDraft(user.id, appId, draft);
  }, [aiWorkDrafts, user.id]);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);
  const openSettings = useCallback((section?: "ai" | "permissions" | "configuration" | "account") => {
    setSettingsInitialSection(section);
    if (route !== "/settings" && route !== "/admin/users") setSettingsReturnRoute(route);
    onNavigate("/settings");
  }, [onNavigate, route]);
  const onOpen = (app: ApplicationId, mode: ApplicationMode) => {
    void onOpenApplication(app, mode);
  };
  const openApplicationFromCurrentPage = useCallback((targetApp: ApplicationId) => {
    if (route !== "/" && currentRouteApp !== targetApp) {
      setApplicationCenterFocusApp(targetApp);
      onNavigate("/");
      return;
    }
    setApplicationCenterFocusApp(null);
    void onOpenApplication(targetApp, settings.general.defaultMode).catch(() => undefined);
  }, [currentRouteApp, onNavigate, onOpenApplication, route, settings.general.defaultMode]);
  const updateAiWorkUiState = (app: ApplicationId, update: Partial<AiWorkUiState>) => {
    if (Object.prototype.hasOwnProperty.call(update, "activeSessionId")) persistActiveAiSession(user.id, app, update.activeSessionId ?? null);
    setAiWorkUiState((current) => ({
      ...current,
      [app]: { ...current[app], ...update }
    }));
  };
  const addAiWorkNotification = useCallback((input: AiWorkNotificationInput) => {
    notificationSequence.current += 1;
    const notification: AiWorkNotification = {
      ...input,
      id: `${Date.now()}-${notificationSequence.current}`,
      createdAt: Date.now(),
      read: false
    };
    setNotifications((current) => [notification, ...current].slice(0, 8));
    if (input.kind !== "approval" && input.kind !== "question") setNotificationToast(notification);
  }, []);
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
    persistActiveAiSession(user.id, target.appId, target.sessionId);
    setAiWorkUiState((current) => ({ ...current, [target.appId]: { ...current[target.appId], activeSessionId: target.sessionId } }));
    setNotifications((current) => current.map((notification) => notification.appId === target.appId && notification.sessionId === target.sessionId ? { ...notification, read: true } : notification));
    setNotificationToast(null);
    if (currentRouteApp !== target.appId) {
      setPendingSessionApp(target.appId);
      setApplicationCenterFocusApp(target.appId);
      if (route !== "/") onNavigate("/");
      return;
    }
    void onOpenApplication(target.appId, "ai-work");
  }, [currentRouteApp, onNavigate, onOpenApplication, route, user.id]);
  const openNotification = useCallback((notification: AiWorkNotification) => {
    openAiWorkNotification(notification);
  }, [openAiWorkNotification]);

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
    if (!pendingSessionApp) return;
    const enteredSelectedSessionApp = pendingSessionApp === "workspace"
      ? route === "/tasks" || route.startsWith("/apps/workspace/ai-work")
      : route.startsWith(`/apps/${pendingSessionApp}/ai-work`);
    if (!enteredSelectedSessionApp) return;
    setPendingSessionApp(null);
    setApplicationCenterFocusApp(null);
  }, [pendingSessionApp, route]);

  useEffect(() => {
    if (route !== "/" || applicationCenterFocusApp !== "workspace") return;
    generalTaskEntryButtonRef.current?.focus({ preventScroll: true });
  }, [applicationCenterFocusApp, route]);

  useEffect(() => {
    if (!notificationToast) return;
    const toastId = notificationToast.id;
    const timeout = window.setTimeout(() => setNotificationToast((current) => current?.id === toastId ? null : current), 8000);
    return () => window.clearTimeout(timeout);
  }, [notificationToast?.id]);

  useEffect(() => {
    cacheLoginBackground(initialSettings.appearance.backgrounds.login);
  }, [initialSettings.appearance.backgrounds.login]);

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
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (idleWindow.requestIdleCallback) {
      const idleHandle = idleWindow.requestIdleCallback(preloadSettingsPageModule, { timeout: 1500 });
      return () => idleWindow.cancelIdleCallback?.(idleHandle);
    }
    const timeoutHandle = window.setTimeout(preloadSettingsPageModule, 1000);
    return () => window.clearTimeout(timeoutHandle);
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || isEditableTarget(event.target)) return;
      const entries: Array<[keyof UserSettings["shortcuts"], () => void]> = [
        ["openSettings", openSettings],
        ["openHome", () => onNavigate("/")],
        ["openSteamcmd", () => openApplicationFromCurrentPage("steamcmd")],
        ["openMinecraft", () => openApplicationFromCurrentPage("minecraft")],
        ["openWriting", () => openApplicationFromCurrentPage("writing")]
      ];
      const shortcuts = resolveShortcutSettings(settings.shortcuts);
      const match = entries.find(([key]) => shortcuts[key].some((chord) => shortcutMatches(event, chord)));
      if (match) {
        event.preventDefault();
        match[1]();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [onNavigate, openApplicationFromCurrentPage, openSettings, settings]);

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
    accountBackgroundAvailable: Boolean(backgroundFile)
  });
  const shellStyle = {
    "--settings-accent": activeAccentColor,
    ...(customSidebarColor ? customSidebarStyle(customSidebarColor, activeAccentColor) : {}),
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
    // 设置中心与应用工作区导航、主画布和 AI Work 输入区的主题底色透明度统一跟随背景遮罩；0% 时透出壁纸。
    "--settings-background-surface-opacity": `${settings.appearance.overlay}%`,
    "--settings-background-image": backgroundFile && !wallpaperCanvasOwnership.wallpaperEngineOwnsCanvas ? `url("${backgroundFile}")` : "none",
    "--settings-background-overlay": resolvedTheme === "dark" ? `rgba(24, 24, 24, ${settings.appearance.overlay / 100})` : `rgba(244, 247, 252, ${settings.appearance.overlay / 100})`,
    "--settings-glass-blur": `${settings.appearance.blur}px`,
    // AI Work 空闲回复区的模糊半径，强度按账户百分比映射到 0–8px，保持内容不透明并控制绘制成本。
    "--settings-ai-work-output-focus-blur": `${appearanceAdvanced.aiWorkOutputFocusBlurPercent * 0.08}px`
  } as CSSProperties;

  let pageContent;
  if (isSettingsPage) {
    pageContent = (
      <Suspense fallback={<div className="loading-page loading-page--compact" aria-busy="true" />}>
        <SettingsPage user={user} serverState={serverState} settings={settings} resolvedTheme={resolvedTheme} initialSection={isLegacyAccountsRoute ? "account" : settingsInitialSection} onBack={() => onNavigate(settingsReturnRoute)} onNavigate={onNavigate} onOpenSettings={openSettings} onLogout={onLogout} onUserChange={onUserChange} onSettingsChange={updateWorkbenchSettings} />
      </Suspense>
    );
  } else if (isFileManagerPage) {
    pageContent = (
      <Suspense fallback={<div className="loading-page loading-page--compact"><span className="loading-indicator" aria-hidden="true" /></div>}>
        <FileManagerPage user={user} settings={settings} serverState={serverState} homeRoute={fileManagerHomeRoute} onNavigate={onNavigate} onOpenSettings={() => openSettings()} onLogout={onLogout} />
      </Suspense>
    );
  } else if (appRoute) {
    const app = appRoute[1] as ApplicationId;
    const aiState = aiWorkUiState[app];
    pageContent = (
      <Suspense fallback={<div className="loading-page loading-page--compact"><span className="loading-indicator" aria-hidden="true" /></div>}>
        <ApplicationWorkspace
          key={`${app}:${appRoute[2]}`}
          userId={user.id}
          app={app}
          mode={appRoute[2] as ApplicationMode}
          section={appRoute[3] || "overview"}
          settings={settings}
          onSettingsChange={updateWorkbenchSettings}
          apps={[...applicationCards, { id: "workspace", title: "通用任务", initials: "L", color: "blue" }]}
          username={user.username}
          role={user.role}
          serverState={serverState}
          error={error}
          onBack={() => onNavigate("/")}
          onSelectedModeHome={() => onNavigate(`/apps/${app}/${appRoute[2]}`)}
          onNavigate={onNavigate}
          onOpenSettings={openSettings}
          onOpenApplication={onOpenApplication}
          activeAiSessionId={aiState.activeSessionId}
          aiDraft={aiWorkDrafts[app]}
          onActiveAiSessionChange={(activeSessionId) => updateAiWorkUiState(app, { activeSessionId })}
          onAiDraftChange={(draft) => updateAiWorkDraft(app, draft)}
          notifications={notifications}
          onNotification={addAiWorkNotification}
          onMarkNotificationsRead={markNotificationsRead}
          onClearNotifications={clearNotifications}
          onOpenNotification={openNotification}
          onLogout={onLogout}
        />
      </Suspense>
    );
  } else if (route === "/") {
    pageContent = (
      <section className="application-center" aria-labelledby="center-heading">
        <header className="page-intro">
          <div className="page-intro__copy">
            <Typography.Title id="center-heading" level={1}>应用中心</Typography.Title>
            <Typography.Paragraph>
              LFAA 专业工作区的统一入口。选择应用和工作模式即可开始操作。
            </Typography.Paragraph>
          </div>
          <Button
            ref={generalTaskEntryButtonRef}
            className="page-intro__action"
            type="primary"
            loading={opening === "workspace:ai-work"}
            disabled={opening !== null}
            onClick={() => {
              setApplicationCenterFocusApp(null);
              void onOpenApplication("workspace", "ai-work");
            }}
          >
            {pendingSessionApp === "workspace"
              ? "继续所选会话"
              : settings.general.defaultStandaloneChat ? "进入通用任务 · 默认入口" : "进入通用任务"}
          </Button>
        </header>

        {error && <Alert className="page-alert" type="error" showIcon message={error} />}

        <section className="application-list" aria-labelledby="application-list-heading">
          <header className="application-list__heading">
            <Typography.Title id="application-list-heading" level={2}>专业应用</Typography.Title>
            <Typography.Text>选择常规模式或 AI Work 进入工作区</Typography.Text>
          </header>
          <div className="application-grid">
            {applicationCards.map((app) => (
              <ApplicationCard
                key={app.id}
                app={app.id}
                title={app.title}
                initials={app.initials}
                description={app.description}
                color={app.color}
                selected={preferences.selectedApp === app.id}
                selectedMode={preferences.selectedMode}
                defaultMode={settings.general.defaultMode}
                opening={opening}
                focused={applicationCenterFocusApp === app.id}
                continueSession={pendingSessionApp === app.id}
                supportsAiWork={app.supportsAiWork}
                onOpen={(mode) => {
                  setApplicationCenterFocusApp(null);
                  onOpen(app.id, mode);
                }}
              />
            ))}
          </div>
        </section>
      </section>
    );
  } else {
    pageContent = (
      <section className="module-page" aria-labelledby="missing-route-heading">
        <Typography.Title id="missing-route-heading" level={2}>页面不存在</Typography.Title>
        <Typography.Paragraph>这个地址没有对应的工作台页面。</Typography.Paragraph>
        <Button type="primary" onClick={() => onNavigate("/")}>返回应用中心</Button>
      </section>
    );
  }

  return (
    <ConfigProvider theme={{
      algorithm: resolvedTheme === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      token: {
        colorPrimary: activeAccentColor,
        colorText: resolvedTheme === "dark" ? "#e5e5e5" : "#263247",
        colorTextSecondary: resolvedTheme === "dark" ? "#c7c7c7" : "#5d6a80",
        colorBgBase: resolvedTheme === "dark" ? "#181818" : "#ffffff",
        colorBgContainer: resolvedTheme === "dark" ? "#202020" : "#ffffff",
        colorBorder: resolvedTheme === "dark" ? "#3a3a3a" : "#dce3ed",
        fontFamily: "var(--font-family-sans)"
      }
    }}>
    <div ref={workbenchShellRef} className={`workbench-shell${appRoute || isFileManagerPage ? " workbench-shell--module" : ""}${isSettingsPage ? " workbench-shell--settings" : ""}`} data-theme={resolvedTheme} data-background-image={wallpaperCanvasOwnership.hasWallpaperBackground ? "true" : "false"} data-wallpaper-engine-owner={wallpaperCanvasOwnership.wallpaperEngineOwnsCanvas ? "true" : "false"} data-custom-sidebar-color={customSidebarColor ? "true" : "false"} data-reduced-motion={appearanceAdvanced.reducedMotion} data-translucent-sidebar={appearanceAdvanced.translucentSidebar ? "true" : "false"} data-diff-markers={appearanceAdvanced.diffMarkers} data-pointer-cursor={appearanceAdvanced.pointerCursor ? "true" : "false"} data-ai-work-output-focus-blur={appearanceAdvanced.aiWorkOutputFocusBlurEnabled ? "true" : "false"} style={shellStyle as CSSProperties}>
      {!isSettingsPage ? <header className="topbar">
        <button className="brand-lockup brand-lockup--button" type="button" onClick={() => onNavigate("/")}>
          <span className="brand-mark" aria-hidden="true">L</span>
          <span className="brand-name">LFAA</span>
        </button>
        {desktopAvailableUpdate ? <Popover
          open={updatePopoverOpen}
          onOpenChange={setUpdatePopoverOpen}
          trigger="click"
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
          <Button className="lfaa-update-entry" aria-label={`发现新版本 LFAA ${desktopAvailableUpdate.version}`} aria-expanded={updatePopoverOpen}>更新</Button>
        </Popover> : null}
        <nav className="topbar-nav" aria-label="主导航">
          <Button type="text" className={route === "/" ? "nav-button nav-button--active" : "nav-button"} onClick={() => onNavigate("/")}>
            应用中心
          </Button>
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

      <main className={`workbench-content${route === "/" ? " workbench-content--app-center" : ""}${appRoute || isFileManagerPage ? " workbench-content--module" : ""}${isSettingsPage ? " workbench-content--settings" : ""}`}>
        {pageContent}
      </main>
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
              <Typography.Text className="lfaa-update-prompt__eyebrow">{desktopUpdatePrompt.kind === "notice" ? "更新状态" : desktopUpdatePrompt.kind === "install" ? "更新已就绪" : "发现新版本"}</Typography.Text>
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
              <Tag color="blue">{desktopUpdatePrompt.kind === "install" ? "已下载" : desktopUpdatePrompt.mandatory ? "必须更新" : "稳定版"}</Tag>
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
              安装将重启 LFAA，并按现有关闭流程停止由本机 Daemon 托管的游戏实例。
            </Typography.Paragraph>}
          </>}
          <footer className="lfaa-update-prompt__actions">
            {desktopUpdatePrompt.kind === "notice" ? <Button type="primary" onClick={() => respondToDesktopUpdatePrompt(desktopUpdatePrompt, "dismiss")}>知道了</Button>
              : desktopUpdatePrompt.kind === "download" ? <>
                {desktopUpdatePrompt.mandatory ? null : <Button onClick={() => respondToDesktopUpdatePrompt(desktopUpdatePrompt, "skip")}>跳过此版本</Button>}
                {desktopUpdatePrompt.mandatory ? null : <Button onClick={() => respondToDesktopUpdatePrompt(desktopUpdatePrompt, "defer")}>稍后</Button>}
                <Button type="primary" onClick={() => respondToDesktopUpdatePrompt(desktopUpdatePrompt, "accept")}>{desktopUpdatePrompt.mandatory ? "下载并安装更新" : "下载更新"}</Button>
              </> : <>
                {desktopUpdatePrompt.mandatory ? null : <Button onClick={() => respondToDesktopUpdatePrompt(desktopUpdatePrompt, "later")}>稍后，退出时安装</Button>}
                <Button type="primary" onClick={() => respondToDesktopUpdatePrompt(desktopUpdatePrompt, "install")}>{desktopUpdatePrompt.mandatory ? "安装并重启" : "现在安装并重启"}</Button>
              </>}
          </footer>
        </section>
      </Modal> : null}
      {/* DSH overlay 依赖当前应用工作台的右侧栏 Owner；设置与应用中心没有该面板，不挂载不可用的入口。 */}
      {appRoute ? <DshSlotOutlet name="shell.overlay" /> : null}
      {notificationToast ? <aside className={`ai-work-notification-toast ai-work-notification-toast--${notificationToast.kind}`} role={notificationToast.kind === "complete" ? "status" : "alert"} aria-live={notificationToast.kind === "complete" ? "polite" : "assertive"}>
        <div className="ai-work-notification-toast__main">
          <button className="ai-work-notification-toast__open" type="button" onClick={() => openNotification(notificationToast)} aria-label={`${notificationToast.title}，点击打开${notificationToast.applicationName}会话`}>
            <span className="ai-work-notification-toast__icon"><WorkbenchIcon name={notificationToast.kind === "complete" ? "spark" : "close"} size={17} /></span>
            <span className="ai-work-notification-toast__copy"><strong>{notificationToast.title}</strong><span>{notificationToast.applicationName} · {notificationToast.body}</span><small>点击打开对应会话</small></span>
          </button>
          <button className="ai-work-notification-toast__close" type="button" onClick={() => setNotificationToast(null)} aria-label="关闭会话提醒"><WorkbenchIcon name="close" size={14} /></button>
        </div>
      </aside> : null}
      <SetupReminder user={user} settings={settings} isSettingsPage={isSettingsPage} onSettingsChange={setSettings} onOpenSettings={openSettings} />
      <PasskeySetupPrompt user={user} isSettingsPage={isSettingsPage} onOpenSettings={openSettings} />
      {!isSettingsPage ? <footer className={`workbench-footer${appRoute || isFileManagerPage ? " workbench-footer--module" : ""}`}>
        <span>LFAA 本机与远程主机应用工作台</span>
        <span>当前阶段：基础账户与应用中心</span>
      </footer> : null}
    </div>
    </ConfigProvider>
  );
}
