/**
 * 功能：管理 LFAA 前端认证状态、路由、服务状态和账户设置。
 * 作用：恢复会话时一次读取账户偏好与设置，工作台首次渲染即可采用已保存主题。
 * 关联文件：packages/client/connection/src/api.ts、packages/client/ui-settings-account/src/AuthView.tsx、packages/client/ui-layout/src/Workbench.tsx。
 */
import { loadClientModule, syncDshClientModulesForAuthentication } from "lfaa-client-modules/src/client/index.js";
import { resolveSessionBootstrap } from "./session-bootstrap.js";
import { preloadWorkbenchForRoute } from "./workbench-preload.js";
import { clearAppearanceThemeBootstrap } from "lfaa-client-ui-theme/src/appearance-theme-bootstrap.js";

import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createReadPoller } from "lfaa-client-connection/src/read-poller.js";
import { clearClientSnapshots } from "lfaa-client-store/src/snapshot-cache.js";
import { Alert, Button } from "antd";
import {
  ApiError,
  getErrorMessage,
  initializeAdmin,
  loadCurrentUser,
  loadHealth,
  loadPreferences,
  loadSettings,
  loadSetupStatus,
  loginWithPasskey,
  login,
  logout,
  recoverPassword,
  savePreferences,
  sessionExpiredEventName,
  type ApplicationId,
  type ApplicationMode,
  type ServerHealth,
  type User,
  type UserPreferences,
  type UserSettings
} from "lfaa-client-connection/src/api.js";
import { ServiceStatus, type ServiceState } from "lfaa-client-ui-primitives/src/ServiceStatus.js";

let workbenchModulePromise: Promise<typeof import("lfaa-client-ui-layout/src/Workbench.js")> | null = null;

// 会话恢复和延迟渲染共用工作台模块请求；加载失败时清缓存，后续仍可重试。
function loadWorkbenchModule() {
  if (!workbenchModulePromise) {
    workbenchModulePromise = loadClientModule<typeof import("lfaa-client-ui-layout/src/Workbench.js")>("lfaa-client-ui-layout/src/Workbench.js").catch((error: unknown) => {
      workbenchModulePromise = null;
      throw error;
    });
  }
  return workbenchModulePromise;
}

const AuthView = lazy(() => loadClientModule<typeof import("lfaa-client-ui-settings-account/src/AuthView.js")>("lfaa-client-ui-settings-account/src/AuthView.js").then((module) => ({ default: module.AuthView })));
const Workbench = lazy(() => loadWorkbenchModule().then((module) => ({ default: module.Workbench })));

// 直接刷新受保护工作区时先准备代码；账户界面仍要等会话和账户设置验证完成后才会挂载。
void preloadWorkbenchForRoute(window.location.pathname, loadWorkbenchModule);

const fallbackPreferences: UserPreferences = {
  selectedApp: "steamcmd",
  selectedMode: "normal"
};

function serverStateFromHealth(health: ServerHealth | null, checking: boolean): ServiceState {
  if (checking && !health) {
    return "checking";
  }
  return health?.status === "ok" && health.persistence === "ready" ? "online" : "offline";
}

const applicationCenterEntryStateKey = "lfaaApplicationCenterEntry";

function applicationIdForRoute(path: string): ApplicationId | null {
  if (path === "/tasks") return "workspace";
  const match = path.match(/^\/apps\/(steamcmd|minecraft|connectivity|writing|workspace)\/(normal|ai-work)(?:\/|$)/u);
  return match ? match[1] as ApplicationId : null;
}

function applicationIdFromHistoryState(): ApplicationId | null {
  const state: unknown = window.history.state;
  if (!state || typeof state !== "object") return null;
  const app = (state as Record<string, unknown>)[applicationCenterEntryStateKey];
  return app === "steamcmd" || app === "minecraft" || app === "connectivity" || app === "writing" || app === "workspace" ? app : null;
}

function routeTo(
  path: string,
  setRoute: (next: string) => void,
  options: { applicationEntryApp?: ApplicationId; replace?: boolean } = {}
): void {
  const currentState: unknown = window.history.state;
  const nextState: Record<string, unknown> = currentState && typeof currentState === "object" && !Array.isArray(currentState)
    ? { ...(currentState as Record<string, unknown>) }
    : {};
  let nextPath = path;
  const targetApp = applicationIdForRoute(nextPath);

  if (nextPath === "/") {
    delete nextState[applicationCenterEntryStateKey];
  } else if (options.applicationEntryApp) {
    if (targetApp === options.applicationEntryApp) {
      nextState[applicationCenterEntryStateKey] = options.applicationEntryApp;
    } else {
      nextPath = "/";
      delete nextState[applicationCenterEntryStateKey];
    }
  } else if (targetApp && nextState[applicationCenterEntryStateKey] !== targetApp) {
    nextPath = "/";
    delete nextState[applicationCenterEntryStateKey];
  }

  const shouldReplace = options.replace || nextPath !== path;
  if (window.location.pathname !== nextPath) {
    if (shouldReplace) window.history.replaceState(nextState, "", nextPath);
    else window.history.pushState(nextState, "", nextPath);
  } else {
    window.history.replaceState(nextState, "", nextPath);
  }
  setRoute(nextPath);
  // 滚动位置由各工作区的恢复 Hook 管理，路由切换时不再额外启动全局平滑滚动。
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [clientModulesReadyUserId, setClientModulesReadyUserId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void syncDshClientModulesForAuthentication(Boolean(user)).catch((syncError: unknown) => {
      console.error("LFAA DSH Client Runtime 同步失败。", syncError);
    }).finally(() => {
      if (active && user) setClientModulesReadyUserId(user.id);
    });
    return () => { active = false; };
  }, [user?.id]);
  const [preferences, setPreferences] = useState<UserPreferences>(fallbackPreferences);
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;
  const currentUserRef = useRef(user);
  currentUserRef.current = user;
  const navigationSequence = useRef(0);
  const navigationSave = useRef<Promise<void>>(Promise.resolve());
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const healthRef = useRef<ServerHealth | null>(null);
  const [healthChecking, setHealthChecking] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [requiresSetup, setRequiresSetup] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [settingsRetryBusy, setSettingsRetryBusy] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionRestoreError, setSessionRestoreError] = useState<string | null>(null);
  const [sessionRestoreAttempt, setSessionRestoreAttempt] = useState(0);
  const sessionRestoreResolvedRef = useRef(false);
  const [route, setRoute] = useState(window.location.pathname);
  const serverState = serverStateFromHealth(health, healthChecking);

  const refreshHealth = useCallback(async () => {
    if (!healthRef.current) setHealthChecking(true);
    try {
      const nextHealth = await loadHealth();
      healthRef.current = nextHealth;
      setHealth((current) => current?.status === nextHealth.status && current.persistence === nextHealth.persistence ? current : nextHealth);
    } catch {
      healthRef.current = null;
      setHealth(null);
    } finally {
      setHealthChecking(false);
    }
  }, []);

  useEffect(() => {
    const poller = createReadPoller(refreshHealth, 15000);
    return () => poller.stop();
  }, [refreshHealth]);

  useEffect(() => {
    const handlePopState = () => {
      navigationSequence.current += 1;
      setOpening(null);
      const nextPath = window.location.pathname;
      const targetApp = applicationIdForRoute(nextPath);
      if (targetApp && applicationIdFromHistoryState() !== targetApp) {
        routeTo("/", setRoute, { replace: true });
        return;
      }
      setRoute(nextPath);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useLayoutEffect(() => {
    if (!user) return;
    const targetApp = applicationIdForRoute(route);
    if (targetApp && applicationIdFromHistoryState() !== targetApp) {
      routeTo("/", setRoute, { replace: true });
    }
  }, [route, user?.id]);

  useEffect(() => {
    const handleSessionExpired = () => {
      // 初次恢复时 /auth/me 的 401 表示尚未登录，不应显示会话过期提示。
      if (!user) {
        return;
      }

      setUser(null);
      setClientModulesReadyUserId(null);
      clearAppearanceThemeBootstrap();
      navigationSequence.current += 1;
      clearClientSnapshots();
      setPreferences(fallbackPreferences);
      setUserSettings(null);
      setRequiresSetup(false);
      setAuthNotice(null);
      setOpening(null);
      setError("登录已失效，请重新登录。");
      routeTo("/", setRoute);
    };

    window.addEventListener(sessionExpiredEventName, handleSessionExpired);
    return () => window.removeEventListener(sessionExpiredEventName, handleSessionExpired);
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    // 定期复核 HttpOnly 会话，避免用户长时间停留时仍能看到已过期会话的工作台。
    const poller = createReadPoller(loadCurrentUser, 15000);
    return () => poller.stop();
  }, [user]);

  useEffect(() => {
    if (serverState === "checking") {
      return;
    }
    if (serverState === "offline" || sessionRestoreResolvedRef.current) {
      setIsInitializing(false);
      return;
    }

    let active = true;
    setIsInitializing(true);
    setError(null);
    setSessionRestoreError(null);

    async function restoreSession(): Promise<void> {
      try {
        const bootstrap = await resolveSessionBootstrap(
          loadCurrentUser,
          loadSetupStatus,
          (sessionError) => sessionError instanceof ApiError && sessionError.status === 401
        );
        if (!active) {
          return;
        }

        if (bootstrap.kind === "anonymous") {
          clearAppearanceThemeBootstrap();
          setRequiresSetup(bootstrap.requiresSetup);
          sessionRestoreResolvedRef.current = true;
          setClientModulesReadyUserId(null);
          setUser(null);
          setPreferences(fallbackPreferences);
          setUserSettings(null);
          return;
        }

        setRequiresSetup(false);
        const [savedResult, settingsResult] = await Promise.allSettled([
          loadPreferences(),
          loadSettings(),
          preloadWorkbenchForRoute(window.location.pathname, loadWorkbenchModule, true)
        ]);
        if (active) {
          if (savedResult.status === "rejected") throw savedResult.reason;
          sessionRestoreResolvedRef.current = true;
          setPreferences(savedResult.value.preferences);
          setUser(bootstrap.user);
          if (settingsResult.status === "fulfilled") {
            setUserSettings(settingsResult.value.settings);
          } else {
            setError(getErrorMessage(settingsResult.reason));
          }
        }
      } catch (loadError) {
        if (active) {
          setSessionRestoreError(getErrorMessage(loadError));
        }
      } finally {
        if (active) {
          setIsInitializing(false);
        }
      }
    }

    void restoreSession();
    return () => {
      active = false;
    };
  }, [serverState, sessionRestoreAttempt]);

  async function handleAuth(username: string, password: string): Promise<void> {
    setAuthBusy(true);
    setError(null);
    setAuthNotice(null);

    try {
      const result = requiresSetup
        ? await initializeAdmin(username, password)
        : await login(username, password);
      await finishAuthentication(result.user);
    } catch (authError) {
      setError(getErrorMessage(authError));
    } finally {
      setAuthBusy(false);
    }
  }

  async function finishAuthentication(user: User): Promise<void> {
    clearClientSnapshots();
    const [savedResult, settingsResult] = await Promise.allSettled([
      loadPreferences(),
      loadSettings(),
      preloadWorkbenchForRoute(window.location.pathname, loadWorkbenchModule, true)
    ]);
    if (savedResult.status === "rejected") throw savedResult.reason;
    setRequiresSetup(false);
    sessionRestoreResolvedRef.current = true;
    setSessionRestoreError(null);
    setPreferences(savedResult.value.preferences);
    setClientModulesReadyUserId(null);
    setUser(user);
    const returnRoute = window.location.pathname === "/settings" || window.location.pathname === "/admin/users"
      ? window.location.pathname
      : "/";
    routeTo(returnRoute, setRoute);
    if (settingsResult.status === "fulfilled") {
      setUserSettings(settingsResult.value.settings);
    } else {
      setError(getErrorMessage(settingsResult.reason));
    }
  }

  async function handlePasskeyLogin(): Promise<void> {
    setAuthBusy(true);
    setError(null);
    setAuthNotice(null);
    try {
      const result = await loginWithPasskey();
      await finishAuthentication(result.user);
    } catch (authError) {
      setError(getErrorMessage(authError));
    } finally {
      setAuthBusy(false);
    }
  }

  async function handlePasswordRecovery(username: string, recoveryKey: string, newPassword: string): Promise<boolean> {
    setAuthBusy(true);
    setError(null);
    setAuthNotice(null);
    try {
      const result = await recoverPassword({ username, recoveryKey, newPassword });
      setAuthNotice(result.message);
      return true;
    } catch (recoveryError) {
      setError(getErrorMessage(recoveryError));
      return false;
    } finally {
      setAuthBusy(false);
    }
  }

  const handleOpenApplication = useCallback(async (app: ApplicationId, mode: ApplicationMode) => {
    const owner = currentUserRef.current?.id;
    if (!owner) return;
    const currentRouteApp = applicationIdForRoute(window.location.pathname);
    if (window.location.pathname !== "/" && (currentRouteApp !== app || applicationIdFromHistoryState() !== app)) {
      routeTo("/", setRoute);
      return;
    }
    const request = ++navigationSequence.current;
    const selectedMode = app === "workspace" ? "ai-work" : mode;
    setOpening(`${app}:${mode}`);
    setError(null);
    const isCurrent = () => request === navigationSequence.current && currentUserRef.current?.id === owner;
    // 导航偏好只有一个写入链；跳过被新选择替代的请求，相同偏好直接进入，旧响应不能拉回旧页面。
    const operation = navigationSave.current.then(async () => {
      if (!isCurrent()) return;
      // 通用任务不覆盖上次选择的业务 App；其入口仍由应用中心提供独立的路由标记。
      if (app !== "workspace" && (preferencesRef.current.selectedApp !== app || preferencesRef.current.selectedMode !== selectedMode)) {
        const result = await savePreferences({ selectedApp: app, selectedMode });
        if (currentUserRef.current?.id !== owner) return;
        preferencesRef.current = result.preferences;
        if (!isCurrent()) return;
        setPreferences(result.preferences);
      }
      if (isCurrent()) {
        setPreferences(preferencesRef.current);
        routeTo(app === "workspace" ? "/tasks" : `/apps/${app}/${mode}`, setRoute, { applicationEntryApp: app });
      }
    }).catch((saveError: unknown) => {
      if (isCurrent()) setError(getErrorMessage(saveError));
    }).finally(() => {
      if (isCurrent()) setOpening(null);
    });
    navigationSave.current = operation;
    await operation;
  }, []);

  async function handleLogout(): Promise<void> {
    navigationSequence.current += 1;
    clearClientSnapshots();
    setOpening(null);
    setError(null);
    try {
      await logout();
    } catch (logoutError) {
      if (!(logoutError instanceof ApiError && logoutError.status === 401)) {
        setError(getErrorMessage(logoutError));
      }
    } finally {
      clearAppearanceThemeBootstrap();
      setClientModulesReadyUserId(null);
      setUser(null);
      setPreferences(fallbackPreferences);
      setUserSettings(null);
      routeTo("/", setRoute);
    }
  }

  async function retryUserSettings(): Promise<void> {
    setSettingsRetryBusy(true);
    setError(null);
    try {
      const result = await loadSettings();
      setUserSettings(result.settings);
    } catch (settingsError) {
      setError(getErrorMessage(settingsError));
    } finally {
      setSettingsRetryBusy(false);
    }
  }

  function retrySessionRestore(): void {
    setSessionRestoreError(null);
    setIsInitializing(true);
    setSessionRestoreAttempt((attempt) => attempt + 1);
  }

  function retryServiceConnection(): void {
    setIsInitializing(true);
    void refreshHealth();
  }

  if (isInitializing) {
    return <main className="loading-page" aria-busy="true" />;
  }

  if (!user && serverState !== "online") {
    return (
      <main className="loading-page" aria-live="polite">
        <Alert
          type={serverState === "checking" ? "info" : "warning"}
          showIcon
          message={serverState === "checking" ? "正在检查控制端连接" : "控制端暂不可用"}
          description={serverState === "checking" ? "连接恢复后会继续检查登录状态。" : "当前无法验证登录状态。请检查控制端连接与持久化状态后重试。"}
          style={{ maxWidth: 520 }}
        />
        <ServiceStatus state={serverState} />
        {serverState === "offline" ? <Button type="primary" onClick={retryServiceConnection}>重新连接</Button> : null}
      </main>
    );
  }

  if (!user && sessionRestoreError) {
    return (
      <main className="loading-page" aria-live="polite">
        <Alert type="error" showIcon message="暂时无法恢复登录状态" description={sessionRestoreError} style={{ maxWidth: 520 }} />
        <Button type="primary" onClick={retrySessionRestore}>重试恢复</Button>
        <ServiceStatus state={serverState} />
      </main>
    );
  }

  if (!user) {
    return (
      <Suspense fallback={<main className="loading-page"><span className="loading-indicator" aria-hidden="true" /></main>}>
        <AuthView
          mode={requiresSetup ? "setup" : "login"}
          serverState={serverState}
          busy={authBusy}
          error={error}
          notice={authNotice}
          onSubmit={(username, password) => void handleAuth(username, password)}
          onPasskeyLogin={() => void handlePasskeyLogin()}
          onRecover={handlePasswordRecovery}
          onClearMessage={() => { setError(null); setAuthNotice(null); }}
        />
      </Suspense>
    );
  }

  // 认证切换期间不以临时系统主题绘制工作台。
  if (!userSettings) {
    return (
      <main className="loading-page" aria-live="polite">
        {error ? <><p role="alert">{error}</p><button type="button" disabled={settingsRetryBusy} onClick={() => void retryUserSettings()}>{settingsRetryBusy ? "正在重试…" : "重试读取设置"}</button></> : <span className="loading-indicator" aria-hidden="true" />}
      </main>
    );
  }

  if (userSettings.appearance.wallpaperEngine.enabled && clientModulesReadyUserId !== user.id) {
    return <main className="loading-page" aria-busy="true" />;
  }

  return (
    <Suspense fallback={<main className="loading-page" aria-busy="true" />}>
      <Workbench
        user={user}
        initialSettings={userSettings}
        preferences={preferences}
        serverState={serverState}
        route={route}
        error={error}
        opening={opening}
        onNavigate={(path) => {
          if (path === "/") {
            navigationSequence.current += 1;
            setOpening(null);
          }
          routeTo(path, setRoute);
        }}
        onOpenApplication={handleOpenApplication}
        onUserChange={(nextUser) => setUser(nextUser)}
        onLogout={() => void handleLogout()}
      />
    </Suspense>
  );
}
