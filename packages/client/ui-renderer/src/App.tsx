/**
 * 功能：管理 LFAA 前端认证状态、路由、服务状态和账户设置。
 * 作用：恢复会话时一次读取账户偏好与设置，工作台首次渲染即可采用已保存主题。
 * 关联文件：packages/client/connection/src/api.ts、packages/client/ui-settings-account/src/AuthView.tsx、packages/client/ui-layout/src/Workbench.tsx。
 */
import { loadClientModule } from "lfaa-client-modules/src/client/index.js";

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
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

function preloadWorkbenchModule(): void {
  void loadWorkbenchModule().catch(() => undefined);
}

const AuthView = lazy(() => loadClientModule<typeof import("lfaa-client-ui-settings-account/src/AuthView.js")>("lfaa-client-ui-settings-account/src/AuthView.js").then((module) => ({ default: module.AuthView })));
const Workbench = lazy(() => loadWorkbenchModule().then((module) => ({ default: module.Workbench })));

// 直接刷新应用工作区时，尽早预热共享外壳；登录和设置校验仍完成后才会挂载工作台。
if (/^\/apps\/(?:steamcmd|minecraft|writing)\/(?:normal|ai-work)(?:\/|$)/u.test(window.location.pathname)) {
  preloadWorkbenchModule();
}

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

function routeTo(path: string, setRoute: (next: string) => void): void {
  if (window.location.pathname !== path) {
    window.history.pushState({}, "", path);
  }
  setRoute(path);
  // 滚动位置由各工作区的恢复 Hook 管理，路由切换时不再额外启动全局平滑滚动。
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences>(fallbackPreferences);
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
    void refreshHealth();
    const interval = window.setInterval(() => void refreshHealth(), 15000);
    return () => window.clearInterval(interval);
  }, [refreshHealth]);

  useEffect(() => {
    const handlePopState = () => setRoute(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const handleSessionExpired = () => {
      // 初次恢复时 /auth/me 的 401 表示尚未登录，不应显示会话过期提示。
      if (!user) {
        return;
      }

      setUser(null);
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
    const verifySession = () => {
      void loadCurrentUser().catch(() => undefined);
    };
    const handleWindowFocus = () => verifySession();
    const interval = window.setInterval(verifySession, 15000);
    window.addEventListener("focus", handleWindowFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleWindowFocus);
    };
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
        const setupStatus = await loadSetupStatus();
        if (!active) {
          return;
        }

        setRequiresSetup(setupStatus.requiresSetup);
        if (setupStatus.requiresSetup) {
          sessionRestoreResolvedRef.current = true;
          setUser(null);
          setPreferences(fallbackPreferences);
          setUserSettings(null);
          return;
        }

        try {
          const session = await loadCurrentUser();
          if (!active) {
            return;
          }
          preloadWorkbenchModule();
          const [savedResult, settingsResult] = await Promise.allSettled([loadPreferences(), loadSettings()]);
          if (active) {
            if (savedResult.status === "rejected") throw savedResult.reason;
            sessionRestoreResolvedRef.current = true;
            setPreferences(savedResult.value.preferences);
            setUser(session.user);
            if (settingsResult.status === "fulfilled") {
              setUserSettings(settingsResult.value.settings);
              if (window.location.pathname === "/" && settingsResult.value.settings.general.defaultStandaloneChat) routeTo("/tasks", setRoute);
            } else {
              setError(getErrorMessage(settingsResult.reason));
            }
          }
        } catch (sessionError) {
          if (sessionError instanceof ApiError && sessionError.status === 401) {
            sessionRestoreResolvedRef.current = true;
            setUser(null);
            setUserSettings(null);
            return;
          }
          throw sessionError;
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
    preloadWorkbenchModule();
    const [savedResult, settingsResult] = await Promise.allSettled([loadPreferences(), loadSettings()]);
    if (savedResult.status === "rejected") throw savedResult.reason;
    setRequiresSetup(false);
    sessionRestoreResolvedRef.current = true;
    setSessionRestoreError(null);
    setPreferences(savedResult.value.preferences);
    setUser(user);
    const returnRoute = window.location.pathname === "/settings" || window.location.pathname === "/admin/users"
      ? window.location.pathname
      : settingsResult.status === "fulfilled" && settingsResult.value.settings.general.defaultStandaloneChat ? "/tasks" : "/";
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
    setOpening(`${app}:${mode}`);
    setError(null);

    try {
      const result = await savePreferences({ selectedApp: app, selectedMode: app === "workspace" ? "ai-work" : mode });
      setPreferences(result.preferences);
      routeTo(app === "workspace" ? "/tasks" : `/apps/${app}/${mode}`, setRoute);
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setOpening(null);
    }
  }, []);

  async function handleLogout(): Promise<void> {
    setError(null);
    try {
      await logout();
    } catch (logoutError) {
      if (!(logoutError instanceof ApiError && logoutError.status === 401)) {
        setError(getErrorMessage(logoutError));
      }
    } finally {
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
    return (
      <main className="loading-page" aria-live="polite">
        <span className="loading-indicator" aria-hidden="true" />
        <span>正在恢复 LFAA 工作台…</span>
        {serverState === "checking" ? <ServiceStatus state={serverState} /> : null}
      </main>
    );
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

  return (
    <Suspense fallback={<main className="loading-page" aria-live="polite"><span className="loading-indicator" aria-hidden="true" /><span>正在加载工作台…</span></main>}>
      <Workbench
        user={user}
        initialSettings={userSettings}
        preferences={preferences}
        serverState={serverState}
        route={route}
        error={error}
        opening={opening}
        onNavigate={(path) => routeTo(path, setRoute)}
        onOpenApplication={handleOpenApplication}
        onUserChange={(nextUser) => setUser(nextUser)}
        onLogout={() => void handleLogout()}
      />
    </Suspense>
  );
}
