/**
 * 功能：呈现 LFAA 应用中心、设置中心、应用占位入口和工作台导航。
 * 作用：使用认证流程预载的账户设置控制主题，并持有共享设置状态供设置页和工作区使用。
 * 关联文件：frontend/src/App.tsx、frontend/src/api.ts、frontend/src/components/AdminUsersPage.tsx、frontend/src/components/SettingsPage.tsx、frontend/src/shared/login-background.ts、frontend/src/shared/scroll-restoration.ts、frontend/src/styles/workbench.css、frontend/src/styles/pages.css、frontend/src/styles/application-workspace.css。
 */
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Alert, Button, Card, ConfigProvider, Tag, Typography, theme as antdTheme } from "antd";
import { ServiceStatus, type ServiceState } from "./ServiceStatus.js";
import { ApplicationWorkspace } from "./ApplicationWorkspace.js";
import { minecraftSceneBackgrounds } from "../assets/minecraftScenes.js";
import { cacheLoginBackground } from "../shared/login-background.js";
import { createScrollRestorationKey, useScrollRestoration } from "../shared/scroll-restoration.js";
import { type AppearanceCodeFont, type AppearanceTextFont, type ApplicationId, type ApplicationMode, type User, type UserPreferences, type UserSettings } from "../api.js";

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

let settingsPageModulePromise: Promise<typeof import("./SettingsPage.js")> | null = null;

// 懒加载和提前预热共用同一个模块请求；失败时清空缓存，后续进入设置页仍可重试。
function loadSettingsPageModule() {
  if (!settingsPageModulePromise) {
    settingsPageModulePromise = import("./SettingsPage.js").catch((error: unknown) => {
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

const appearanceTextFontStacks: Record<AppearanceTextFont, string> = {
  system: 'Geist, "Segoe UI Variable", "Microsoft YaHei", sans-serif',
  sans: 'Arial, "Microsoft YaHei", sans-serif',
  serif: 'Georgia, "Noto Serif CJK SC", serif'
};
const appearanceCodeFontStacks: Record<AppearanceCodeFont, string> = {
  system: 'Consolas, "Cascadia Code", monospace',
  cascadia: '"Cascadia Code", Consolas, monospace',
  consolas: 'Consolas, "Cascadia Code", monospace',
  jetbrains: '"JetBrains Mono", Consolas, monospace'
};

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || Boolean(target.closest("input, textarea, select, [contenteditable='true']")));
}

function shortcutMatches(event: KeyboardEvent, chord: string): boolean {
  const parts = chord.split("+").map((part) => part.toLocaleLowerCase());
  const key = parts.at(-1) ?? "";
  return event.key.toLocaleLowerCase() === key
    && Boolean(event.ctrlKey || event.metaKey) === parts.includes("ctrl")
    && Boolean(event.altKey) === parts.includes("alt")
    && Boolean(event.shiftKey) === parts.includes("shift");
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
        <span className="development-state">功能接入中</span>
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
  onLogout
}: WorkbenchProps) {
  const appRoute = route.match(/^\/apps\/(steamcmd|minecraft|writing)\/(normal|ai-work)(?:\/(.*))?$/);
  const isLegacyAccountsRoute = route === "/admin/users";
  const isSettingsPage = route === "/settings" || isLegacyAccountsRoute;
  useScrollRestoration(
    isSettingsPage || appRoute ? "" : createScrollRestorationKey(user.id, "workbench-page", route),
    true,
    "window"
  );
  const [settingsReturnRoute, setSettingsReturnRoute] = useState(() =>
    route === "/settings" || route === "/admin/users" ? `/apps/${preferences.selectedApp}/${preferences.selectedMode}` : "/",
  );
  const [settings, setSettings] = useState<UserSettings>(initialSettings);
  // 未发送草稿只在工作台内存按应用保留；活动会话标识作为界面偏好持久化，消息内容仍由服务端读取。
  const [aiWorkUiState, setAiWorkUiState] = useState<Record<ApplicationId, AiWorkUiState>>(() => ({
    steamcmd: { activeSessionId: readActiveAiSession(user.id, "steamcmd") },
    minecraft: { activeSessionId: readActiveAiSession(user.id, "minecraft") },
    writing: { activeSessionId: readActiveAiSession(user.id, "writing") }
  }));
  // 草稿频繁变化时只更新工作台实例内存，不让整棵工作台随每次按键重渲染。
  const aiWorkDrafts = useRef<Record<ApplicationId, string>>({ steamcmd: "", minecraft: "", writing: "" });
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);
  const openSettings = useCallback(() => {
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

  useEffect(() => {
    cacheLoginBackground(initialSettings.appearance.backgrounds.login);
  }, [initialSettings.appearance.backgrounds.login]);

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
  const backgroundSlot = isSettingsPage ? "settings" : appRoute ? appRoute[1] as "steamcmd" | "minecraft" | "writing" : "appCenter";
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
    "--settings-background-image": backgroundFile ? `url("${backgroundFile}")` : "none",
    "--settings-background-overlay": resolvedTheme === "dark" ? `rgba(24, 24, 24, ${settings.appearance.overlay / 100})` : `rgba(244, 247, 252, ${settings.appearance.overlay / 100})`,
    "--settings-glass-blur": `${settings.appearance.blur}px`
  } as CSSProperties;

  let pageContent;
  if (isSettingsPage) {
    pageContent = (
      <Suspense fallback={<div className="loading-page loading-page--compact"><span className="loading-indicator" aria-hidden="true" /></div>}>
        <SettingsPage user={user} serverState={serverState} settings={settings} resolvedTheme={resolvedTheme} initialSection={isLegacyAccountsRoute ? "account" : undefined} onBack={() => onNavigate(settingsReturnRoute)} onSettingsChange={setSettings} />
      </Suspense>
    );
  } else if (appRoute) {
    const app = appRoute[1] as ApplicationId;
    const aiState = aiWorkUiState[app];
    pageContent = (
      <ApplicationWorkspace
        key={`${app}:${appRoute[2]}`}
        userId={user.id}
        app={app}
        mode={appRoute[2] as ApplicationMode}
        section={appRoute[3] || "overview"}
        settings={settings}
        apps={applicationCards}
        username={user.username}
        role={user.role}
        serverState={serverState}
        error={error}
        onBack={() => onNavigate("/")}
        onModeHome={() => onNavigate(`/apps/${app}/${appRoute[2]}`)}
        onNavigate={onNavigate}
        onOpenSettings={openSettings}
        onOpenApplication={onOpenApplication}
        activeAiSessionId={aiState.activeSessionId}
        aiDraft={aiWorkDrafts.current[app]}
        onActiveAiSessionChange={(activeSessionId) => updateAiWorkUiState(app, { activeSessionId })}
        onAiDraftChange={(draft) => { aiWorkDrafts.current[app] = draft; }}
        onLogout={onLogout}
      />
    );
  } else if (route === "/") {
    pageContent = (
      <section className="application-center" aria-labelledby="center-heading">
        <div className="page-intro">
          <Typography.Title id="center-heading" level={1}>欢迎来到 LFAA</Typography.Title>
          <Typography.Paragraph>
            在这里进入游戏服务管理和写作应用。常规模式与 AI Work 入口会随各应用能力逐步接入。
          </Typography.Paragraph>
        </div>

        {error && <Alert className="page-alert" type="error" showIcon message={error} />}

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
    <div className={`workbench-shell${appRoute ? " workbench-shell--module" : ""}${isSettingsPage ? " workbench-shell--settings" : ""}`} data-theme={resolvedTheme} data-background-image={backgroundFile ? "true" : "false"} data-custom-sidebar-color={customSidebarColor ? "true" : "false"} data-reduced-motion={appearanceAdvanced.reducedMotion} data-translucent-sidebar={appearanceAdvanced.translucentSidebar ? "true" : "false"} data-diff-markers={appearanceAdvanced.diffMarkers} data-pointer-cursor={appearanceAdvanced.pointerCursor ? "true" : "false"} style={shellStyle as CSSProperties}>
      {!isSettingsPage ? <header className="topbar">
        <button className="brand-lockup brand-lockup--button" type="button" onClick={() => onNavigate("/")}>
          <span className="brand-mark" aria-hidden="true">L</span>
          <span className="brand-name">LFAA</span>
        </button>
        <nav className="topbar-nav" aria-label="主导航">
          <Button type="text" className={route === "/" ? "nav-button nav-button--active" : "nav-button"} onClick={() => onNavigate("/")}>
            应用中心
          </Button>
          <Button type="text" className={isSettingsPage ? "nav-button nav-button--active" : "nav-button"} onMouseEnter={preloadSettingsPageModule} onFocus={preloadSettingsPageModule} onClick={openSettings} aria-keyshortcuts="Control+, Meta+,">设置中心</Button>
        </nav>
        <div className="topbar-account">
          {settings.general.showServiceStatus ? <ServiceStatus state={serverState} /> : null}
          <span className="account-identity">
            <span className="account-username">{user.username}</span>
            <span className="account-role">{user.role === "admin" ? "管理员" : "普通账户"}</span>
          </span>
          <Button className="logout-button" onClick={onLogout}>退出登录</Button>
        </div>
      </header> : null}

      <main className={`workbench-content${appRoute ? " workbench-content--module" : ""}${isSettingsPage ? " workbench-content--settings" : ""}`}>
        {pageContent}
      </main>
      {!isSettingsPage ? <footer className={`workbench-footer${appRoute ? " workbench-footer--module" : ""}`}>
        <span>LFAA 本机与远程主机应用工作台</span>
        <span>当前阶段：基础账户与应用中心</span>
      </footer> : null}
    </div>
    </ConfigProvider>
  );
}

