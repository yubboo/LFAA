/** 功能：呈现现有工作台。作用：消费已保存设置并组合能力包界面。关联文件：client/connection、ui-settings、ui-theme、ui-commands。 */
import { loadClientModule } from "lfaa-client-modules/src/client/index.js";
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Alert, Button, Card, ConfigProvider, Tag, Typography, theme as antdTheme } from "antd";
import { ServiceStatus, type ServiceState } from "lfaa-client-ui-primitives/src/ServiceStatus.js";
import { SetupReminder } from "lfaa-client-ui-settings-general/src/SetupReminder.js";
import { PasskeySetupPrompt } from "lfaa-client-ui-settings-account/src/PasskeySetupPrompt.js";
import { minecraftSceneBackgrounds } from "lfaa-client-ui-minecraft/src/assets/minecraftScenes.js";
import { cacheLoginBackground } from "lfaa-client-ui-theme/src/login-background.js";
import { aiWorkSessionOpenEventName, type AiWorkNotification, type AiWorkNotificationInput, type AiWorkSessionTarget } from "lfaa-client-resources/src/notification-runtime.js";
import { createScrollRestorationKey, useScrollRestoration } from "lfaa-client-store/src/scroll-restoration.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { userRoleLabel, type ApplicationId, type ApplicationMode, type User, type UserPreferences, type UserSettings } from "lfaa-client-connection/src/api.js";
import { shortcutMatches } from "lfaa-client-ui-commands/src/shortcuts.js";
import { appearanceTextFontStacks, appearanceCodeFontStacks } from "lfaa-client-ui-theme/src/fonts.js";



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
  onOpen: (mode: ApplicationMode) => void;
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

// 后台预热失败不打断工作台；真实打开设置页时仍会进入 Suspense 加载流程。
function preloadSettingsPageModule(): void {
  void loadSettingsPageModule().catch(() => undefined);
}

const SettingsPage = lazy(() => loadSettingsPageModule().then((module) => ({ default: module.SettingsPage })));
const FileManagerPage = lazy(() => loadFileManagerPageModule().then((module) => ({ default: module.FileManagerPage })));
const ApplicationWorkspace = lazy(() => loadClientModule<typeof import("lfaa-client-ui-workspace/src/ApplicationWorkspace.js")>("lfaa-client-ui-workspace/src/ApplicationWorkspace.js").then((module) => ({ default: module.ApplicationWorkspace })));

function readActiveAiSession(userId: string, app: ApplicationId): string | null {
  try {
    return window.localStorage.getItem(createScrollRestorationKey(userId, "active-ai-session", app)) || null;
  } catch {
    return null;
  }
}

function persistActiveAiSession(userId: string, app: ApplicationId, sessionId: string | null): void {
  const key = createScrollRestorationKey(userId, "active-ai-session", app);
  try {
    if (sessionId) window.localStorage.setItem(key, sessionId);
    else window.localStorage.removeItem(key);
  } catch {
    // 会话标识只是恢复界面所需的偏好；存储不可用时仍可手动选择会话。
  }
}

const backgroundFiles: Record<string, string> = {
  "service-room": "/backgrounds/service-room.jpg",
  "steamcmd-world": "/backgrounds/steamcmd-world.jpg",
  "minecraft-world": "/backgrounds/minecraft-world.jpg",
  "writing-desk": "/backgrounds/writing-desk.jpg",
  ...Object.fromEntries(minecraftSceneBackgrounds.map(({ id, file }) => [id, file]))
};

function backgroundFileForRoute(route: string, currentSettings: UserSettings): string | null {
  const routeMatch = route.match(/^\/apps\/(steamcmd|minecraft|writing|workspace)\/(?:normal|ai-work)(?:\/.*)?$/);
  const backgroundSlot = routeMatch && routeMatch[1] !== "workspace" ? routeMatch[1] as "steamcmd" | "minecraft" | "writing" : "appCenter";
  const selectedBackground = currentSettings.appearance.backgrounds[backgroundSlot];
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
    id: "writing",
    title: "写作空间",
    initials: "W",
    description: "为作品、章节和资料整理提供独立的应用入口。",
    color: "plum"
  }
];

function ApplicationCard({ app, title, initials, description, color, selected, selectedMode, defaultMode, opening, onOpen }: ApplicationCardProps) {
  return (
    <Card className={`application-card application-card--${app} application-card--${color}${selected ? " application-card--selected" : ""}`}>
      <div className="application-card__topline">
        <span className={`application-monogram application-monogram--${color}`} aria-hidden="true">{initials}</span>
        {selected && <Tag className="selected-tag">上次打开 · {selectedMode === "normal" ? "常规模式" : "AI Work"}</Tag>}
      </div>
      <div className="application-card__copy">
        <Typography.Title level={3}>{title}</Typography.Title>
        <Typography.Paragraph>{description}</Typography.Paragraph>
        <span className="development-state">{app === "writing" ? "正文编辑已接入" : "功能接入中"}</span>
      </div>
      <div className="application-card__actions">
        <Button
          type={defaultMode === "normal" ? "primary" : "default"}
          loading={opening === `${app}:normal`}
          disabled={opening !== null}
          onClick={() => onOpen("normal")}
        >
          常规模式
        </Button>
        <Button
          className={`ai-work-button${defaultMode === "ai-work" ? " ai-work-button--preferred" : ""}`}
          loading={opening === `${app}:ai-work`}
          disabled={opening !== null}
          onClick={() => onOpen("ai-work")}
        >
          AI Work
        </Button>
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
  const appRoute = route === "/tasks" ? [route, "workspace", "ai-work", "overview"] : route.match(/^\/apps\/(steamcmd|minecraft|writing|workspace)\/(normal|ai-work)(?:\/(.*))?$/);
  const isFileManagerPage = route === "/files";
  const isLegacyAccountsRoute = route === "/admin/users";
  const isSettingsPage = route === "/settings" || isLegacyAccountsRoute;
  // 文件管理是全局页面；保留进入前的路由，让页面上的房子返回来源应用位置。
  const previousRoute = useRef(route);
  const fileManagerReturnRoute = route === "/files"
    ? previousRoute.current !== "/files" ? previousRoute.current : `/apps/${preferences.selectedApp}/${preferences.selectedMode}`
    : route;
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
  const settingsReturnBackgroundRef = useRef<HTMLImageElement | null>(null);
  const [settingsInitialSection, setSettingsInitialSection] = useState<"ai" | "permissions" | "configuration" | "account" | undefined>();
  const [settings, setSettings] = useState<UserSettings>(initialSettings);
  // 未发送草稿只在工作台内存按应用保留；活动会话标识作为界面偏好持久化，消息内容仍由服务端读取。
  const [aiWorkUiState, setAiWorkUiState] = useState<Record<ApplicationId, AiWorkUiState>>(() => ({
    workspace: { activeSessionId: readActiveAiSession(user.id, "workspace") },
    steamcmd: { activeSessionId: readActiveAiSession(user.id, "steamcmd") },
    minecraft: { activeSessionId: readActiveAiSession(user.id, "minecraft") },
    writing: { activeSessionId: readActiveAiSession(user.id, "writing") }
  }));
  const [notifications, setNotifications] = useState<AiWorkNotification[]>([]);
  const [notificationToast, setNotificationToast] = useState<AiWorkNotification | null>(null);
  const notificationSequence = useRef(0);
  // 草稿频繁变化时只更新工作台实例内存，不让整棵工作台随每次按键重渲染。
  const aiWorkDrafts = useRef<Record<ApplicationId, string>>({ workspace: "", steamcmd: "", minecraft: "", writing: "" });
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);
  const openSettings = useCallback((section?: "ai" | "permissions" | "configuration" | "account") => {
    setSettingsInitialSection(section);
    if (route !== "/settings" && route !== "/admin/users") setSettingsReturnRoute(route);
    onNavigate("/settings");
  }, [onNavigate, route]);
  const onOpen = (app: ApplicationId, mode: ApplicationMode) => {
    void onOpenApplication(app, mode);
  };
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
    setNotificationToast(notification);
  }, []);
  const markNotificationsRead = useCallback(() => {
    setNotifications((current) => current.map((notification) => notification.read ? notification : { ...notification, read: true }));
  }, []);
  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setNotificationToast(null);
  }, []);
  const openAiWorkNotification = useCallback((target: AiWorkSessionTarget) => {
    persistActiveAiSession(user.id, target.appId, target.sessionId);
    setAiWorkUiState((current) => ({ ...current, [target.appId]: { ...current[target.appId], activeSessionId: target.sessionId } }));
    setNotifications((current) => current.map((notification) => notification.appId === target.appId && notification.sessionId === target.sessionId ? { ...notification, read: true } : notification));
    setNotificationToast(null);
    void onOpenApplication(target.appId, "ai-work");
  }, [onOpenApplication, user.id]);
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
        ["openSteamcmd", () => onOpenApplication("steamcmd", settings.general.defaultMode).catch(() => undefined)],
        ["openMinecraft", () => onOpenApplication("minecraft", settings.general.defaultMode).catch(() => undefined)],
        ["openWriting", () => onOpenApplication("writing", settings.general.defaultMode).catch(() => undefined)]
      ];
      const match = entries.find(([key]) => settings.shortcuts[key].some((chord) => shortcutMatches(event, chord)));
      if (match) {
        event.preventDefault();
        match[1]();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [onNavigate, onOpenApplication, openSettings, settings]);

  const resolvedTheme = settings.appearance.theme === "system"
    ? (systemDark ? "dark" : "light")
    : settings.appearance.theme;
  const appearanceAdvanced = settings.appearance.advanced;
  const activeAccentColor = appearanceAdvanced.separateModes ? appearanceAdvanced.modeStyles[resolvedTheme].accentColor : settings.appearance.accentColor;
  const customSidebarColor = /^#[\da-f]{6}$/iu.test(settings.appearance.sidebarColor) ? settings.appearance.sidebarColor : null;
  const activeAppearanceFonts = appearanceAdvanced.separateModes ? appearanceAdvanced.modeStyles[resolvedTheme].fonts : appearanceAdvanced.fonts;
  const interfaceFontScale = appearanceAdvanced.interfaceFontSize / 14;
  const contrastDelta = appearanceAdvanced.contrast - 60;
  const backgroundSlot = isSettingsPage ? "settings" : appRoute && appRoute[1] !== "workspace" ? appRoute[1] as "steamcmd" | "minecraft" | "writing" : "appCenter";
  const selectedBackground = settings.appearance.backgrounds[backgroundSlot];
  const backgroundFile = selectedBackground === "none"
    ? null
    : selectedBackground.startsWith("user-")
      ? `/api/settings/backgrounds/${encodeURIComponent(selectedBackground)}`
      : backgroundFiles[selectedBackground] ?? null;
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
    "--settings-background-image": backgroundFile ? `url("${backgroundFile}")` : "none",
    "--settings-background-overlay": resolvedTheme === "dark" ? `rgba(24, 24, 24, ${settings.appearance.overlay / 100})` : `rgba(244, 247, 252, ${settings.appearance.overlay / 100})`,
    "--settings-glass-blur": `${settings.appearance.blur}px`
  } as CSSProperties;

  let pageContent;
  if (isSettingsPage) {
    pageContent = (
      <Suspense fallback={<div className="loading-page loading-page--compact"><span className="loading-indicator" aria-hidden="true" /></div>}>
        <SettingsPage user={user} serverState={serverState} settings={settings} resolvedTheme={resolvedTheme} initialSection={isLegacyAccountsRoute ? "account" : settingsInitialSection} onBack={() => onNavigate(settingsReturnRoute)} onNavigate={onNavigate} onOpenSettings={openSettings} onLogout={onLogout} onUserChange={onUserChange} onSettingsChange={setSettings} />
      </Suspense>
    );
  } else if (isFileManagerPage) {
    pageContent = (
      <Suspense fallback={<div className="loading-page loading-page--compact"><span className="loading-indicator" aria-hidden="true" /></div>}>
        <FileManagerPage user={user} settings={settings} serverState={serverState} returnRoute={fileManagerReturnRoute} onNavigate={onNavigate} onOpenSettings={() => openSettings()} onLogout={onLogout} />
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
          onSettingsChange={setSettings}
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
          aiDraft={aiWorkDrafts.current[app]}
          onActiveAiSessionChange={(activeSessionId) => updateAiWorkUiState(app, { activeSessionId })}
          onAiDraftChange={(draft) => { aiWorkDrafts.current[app] = draft; }}
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
        <div className="page-intro">
          <Typography.Title id="center-heading" level={1}>欢迎来到 LFAA</Typography.Title>
          <Typography.Paragraph>
            通过通用任务工作区完成开发、文件与主机任务，也可以进入各应用处理专业业务。
          </Typography.Paragraph>
        </div>

        {error && <Alert className="page-alert" type="error" showIcon message={error} />}

        <Button type="primary" onClick={() => onNavigate("/tasks")}>开始通用任务</Button>
        <div className="application-grid" aria-label="LFAA 应用">
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
              onOpen={(mode) => onOpen(app.id, mode)}
            />
          ))}
        </div>

        <div className="workspace-note">
          <div>
            <Typography.Text strong>工作台基础已就绪</Typography.Text>
            <Typography.Paragraph>账户、角色、服务健康状态和应用偏好由控制端统一管理。</Typography.Paragraph>
          </div>
          <ServiceStatus state={serverState} />
        </div>
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
    <div className={`workbench-shell${appRoute || isFileManagerPage ? " workbench-shell--module" : ""}${isSettingsPage ? " workbench-shell--settings" : ""}`} data-theme={resolvedTheme} data-background-image={backgroundFile ? "true" : "false"} data-custom-sidebar-color={customSidebarColor ? "true" : "false"} data-reduced-motion={appearanceAdvanced.reducedMotion} data-translucent-sidebar={appearanceAdvanced.translucentSidebar ? "true" : "false"} data-diff-markers={appearanceAdvanced.diffMarkers} data-pointer-cursor={appearanceAdvanced.pointerCursor ? "true" : "false"} style={shellStyle as CSSProperties}>
      {!isSettingsPage ? <header className="topbar">
        <button className="brand-lockup brand-lockup--button" type="button" onClick={() => onNavigate("/")}>
          <span className="brand-mark" aria-hidden="true">L</span>
          <span className="brand-name">LFAA</span>
        </button>
        <nav className="topbar-nav" aria-label="主导航">
          <Button type="text" className={route === "/tasks" ? "nav-button nav-button--active" : "nav-button"} onClick={() => onNavigate("/tasks")}>任务工作区</Button>
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

      <main className={`workbench-content${appRoute || isFileManagerPage ? " workbench-content--module" : ""}${isSettingsPage ? " workbench-content--settings" : ""}`}>
        {pageContent}
      </main>
      {notificationToast ? <aside className={`ai-work-notification-toast ai-work-notification-toast--${notificationToast.kind}`} role={notificationToast.kind === "complete" ? "status" : "alert"} aria-live={notificationToast.kind === "complete" ? "polite" : "assertive"}>
        <button className="ai-work-notification-toast__open" type="button" onClick={() => openNotification(notificationToast)} aria-label={`${notificationToast.title}，点击打开${notificationToast.applicationName}会话`}>
          <span className="ai-work-notification-toast__icon"><WorkbenchIcon name={notificationToast.kind === "complete" ? "spark" : notificationToast.kind === "approval" ? "shield" : "close"} size={17} /></span>
          <span className="ai-work-notification-toast__copy"><strong>{notificationToast.title}</strong><span>{notificationToast.applicationName} · {notificationToast.body}</span><small>点击打开对应会话</small></span>
        </button>
        <button className="ai-work-notification-toast__close" type="button" onClick={() => setNotificationToast(null)} aria-label="关闭会话提醒"><WorkbenchIcon name="close" size={14} /></button>
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