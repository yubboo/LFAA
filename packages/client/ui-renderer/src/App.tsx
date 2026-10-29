/**
 * 功能：管理 LFAA 前端认证状态、路由、服务状态和账户设置。
 * 作用：恢复会话时一次读取账户偏好与设置，工作台首次渲染即可采用已保存主题。
 * 关联文件：packages/client/connection/src/api.ts、packages/client/ui-settings-account/src/AuthView.tsx、packages/client/ui-layout/src/Workbench.tsx。
 */
import { loadClientModule, LFAA_AUTH_TRANSITION_SLOT, syncDshClientModulesForAuthentication, useDshSlotEntries, type AuthTransitionPhase } from "lfaa-client-modules/src/client/index.js";
import { resolveSessionBootstrap } from "./session-bootstrap.js";
import { preloadWorkbenchForRoute } from "./workbench-preload.js";
import { clearAppearanceThemeBootstrap } from "lfaa-client-ui-theme/src/appearance-theme-bootstrap.js";
import { MiniCompanionWindow } from "./MiniCompanionWindow.js";
import { APPLICATION_ROUTE_PATTERN, SHARED_WORK_ROUTE, normalizeWorkRoute } from "lfaa-util-values/src/application-id.js";
import { APPLICATION_ENTRY_STATE_KEY as applicationRouteEntryStateKey, readApplicationEntryIdFromHistory } from "./application-entry-state.js";

import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createReadPoller } from "lfaa-client-connection/src/read-poller.js";
import { clearClientSnapshots } from "lfaa-client-store/src/snapshot-cache.js";
import { Alert, Button } from "antd";
import {
  ApiError,
  getErrorMessage,
  loadDefaultCredentialReminder,
  loadCurrentUser,
  loadHealth,
  loadPreferences,
  loadSettings,
  loginWithPasskey,
  login,
  logout,
  recoverPassword,
  startTrustedAccountRecovery,
  getTrustedAccountRecoveryStatus,
  completeTrustedAccountRecovery,
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
const isMiniWindowRoute = new URLSearchParams(window.location.search).get("mini") === "1";

// 直接刷新受保护工作区时先准备代码；账户界面仍要等会话和账户设置验证完成后才会挂载。
if (!isMiniWindowRoute) {
  void preloadWorkbenchForRoute(window.location.pathname, loadWorkbenchModule);
}

const fallbackPreferences: UserPreferences = {
  selectedApp: "steamcmd",
  selectedMode: "normal",
  guidedEntryCompleted: false
};

function serverStateFromHealth(health: ServerHealth | null, checking: boolean): ServiceState {
  if (checking && !health) {
    return "checking";
  }
  return health?.status === "ok" && health.persistence === "ready" ? "online" : "offline";
}

function shouldReduceMotion(setting: UserSettings["appearance"]["advanced"]["reducedMotion"]): boolean {
  if (setting === "on") return true;
  return setting === "system" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void) => { ready: Promise<void>; finished: Promise<void> };
};

function applicationIdForRoute(path: string): ApplicationId | null {
  if (normalizeWorkRoute(path) === SHARED_WORK_ROUTE) return null;
  const match = path.match(APPLICATION_ROUTE_PATTERN);
  return match ? match[1] as ApplicationId : null;
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
  const targetUrl=new URL(path,window.location.origin);
  const requestedPath=targetUrl.origin===window.location.origin?normalizeWorkRoute(targetUrl.pathname):SHARED_WORK_ROUTE;
  let nextPath = requestedPath;
  const targetApp = applicationIdForRoute(nextPath);

  if (nextPath === SHARED_WORK_ROUTE) {
    delete nextState[applicationRouteEntryStateKey];
  } else if (options.applicationEntryApp) {
    if (targetApp === options.applicationEntryApp) {
      nextState[applicationRouteEntryStateKey] = options.applicationEntryApp;
    } else {
      nextPath = SHARED_WORK_ROUTE;
      delete nextState[applicationRouteEntryStateKey];
    }
  } else if (targetApp && nextState[applicationRouteEntryStateKey] !== targetApp) {
    nextPath = SHARED_WORK_ROUTE;
    delete nextState[applicationRouteEntryStateKey];
  }

  const nextAddress=nextPath===requestedPath&&targetUrl.origin===window.location.origin?`${nextPath}${targetUrl.search}${targetUrl.hash}`:nextPath;
  const shouldReplace = options.replace || nextPath !== requestedPath;
  if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== nextAddress) {
    if (shouldReplace) window.history.replaceState(nextState, "", nextAddress);
    else window.history.pushState(nextState, "", nextAddress);
  } else {
    window.history.replaceState(nextState, "", nextAddress);
  }
  setRoute(nextPath);
  // 滚动位置由各工作区的恢复 Hook 管理，路由切换时不再额外启动全局平滑滚动。
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const authTransitionPlugins = useDshSlotEntries(LFAA_AUTH_TRANSITION_SLOT);
  const [clientModulesReadyUserId, setClientModulesReadyUserId] = useState<string | null>(null);
  useEffect(() => {
    if (isMiniWindowRoute) return;
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
  const [authTransitionPhase, setAuthTransitionPhase] = useState<AuthTransitionPhase>("idle");
  const [authTransitionSceneReady, setAuthTransitionSceneReady] = useState(false);
  const [authTransitionSettling, setAuthTransitionSettling] = useState(false);
  const configuredAuthTransitionPluginId = userSettings?.appearance.advanced.authTransitionPluginId ?? "builtin";
  const authTransitionPluginId = configuredAuthTransitionPluginId === "builtin"
    || authTransitionPlugins.some((entry) => entry.id === configuredAuthTransitionPluginId)
    ? configuredAuthTransitionPluginId
    : "builtin";
  const authTransitionReducedMotion = userSettings
    ? shouldReduceMotion(userSettings.appearance.advanced.reducedMotion)
    : window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const healthRef = useRef<ServerHealth | null>(null);
  const [healthChecking, setHealthChecking] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [credentialReminder, setCredentialReminder] = useState<{ usernamePending: boolean; passwordPending: boolean } | null>(null);
  const [credentialReminderChecking, setCredentialReminderChecking] = useState(false);
  const authRequestInFlightRef = useRef(false);
  const [settingsRetryBusy, setSettingsRetryBusy] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionRestoreError, setSessionRestoreError] = useState<string | null>(null);
  const [sessionRestoreAttempt, setSessionRestoreAttempt] = useState(0);
  const sessionRestoreResolvedRef = useRef(false);
  const [route, setRoute] = useState(window.location.pathname);
  const wasInSettingsRouteRef = useRef(route === "/settings");
  const serverState = serverStateFromHealth(health, healthChecking);

  useEffect(() => {
    const isSettingsRoute = route === "/settings";
    const returnedFromSettings = wasInSettingsRouteRef.current && !isSettingsRoute;
    wasInSettingsRouteRef.current = isSettingsRoute;
    if (returnedFromSettings && user && userSettings) void updateCredentialReminder(userSettings);
  }, [route, user?.id, userSettings]);

  useEffect(() => {
    if (authTransitionPhase !== "preparing" || !user || !userSettings) return;
    if (userSettings.appearance.wallpaperEngine.enabled && clientModulesReadyUserId !== user.id) return;
    if (authTransitionReducedMotion) {
      setAuthTransitionPhase("idle");
      return;
    }
    if (authTransitionPluginId === "builtin") {
      setAuthTransitionSceneReady(true);
      return;
    }
    setAuthTransitionPhase("entering");
  }, [authTransitionPhase, authTransitionPluginId, authTransitionReducedMotion, clientModulesReadyUserId, user, userSettings]);

  const authTransitionActive = Boolean(user) && authTransitionPhase !== "idle";
  const builtinAuthTransitionActive = authTransitionPluginId === "builtin" && authTransitionActive;
  const finishBuiltinAuthTransition = useCallback(() => {
    setAuthTransitionSettling(false);
    setAuthTransitionPhase("idle");
  }, []);

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (authTransitionActive && !authTransitionSettling) {
      root.dataset.lfaaAuthWorkbenchHidden = "true";
    } else delete root.dataset.lfaaAuthWorkbenchHidden;
    if (builtinAuthTransitionActive) root.dataset.lfaaAuthEntryAnimation = "builtin";
    else if (root.dataset.lfaaAuthEntryAnimation === "builtin") delete root.dataset.lfaaAuthEntryAnimation;
    return () => {
      delete root.dataset.lfaaAuthWorkbenchHidden;
      if (root.dataset.lfaaAuthEntryAnimation === "builtin") delete root.dataset.lfaaAuthEntryAnimation;
    };
  }, [authTransitionActive, authTransitionSettling, builtinAuthTransitionActive]);

  const handleWorkbenchAuthWarmupReady = useCallback(() => {
    let firstFrame = 0;
    let secondFrame = 0;
    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        setAuthTransitionPhase((current) => current === "preparing" ? "entering" : current);
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, []);

  useEffect(() => {
    if (authTransitionPhase !== "entering" || !authTransitionSettling || authTransitionPluginId !== "builtin") return;
    const fallbackTimer = window.setTimeout(finishBuiltinAuthTransition, 480);
    return () => window.clearTimeout(fallbackTimer);
  }, [authTransitionPhase, authTransitionPluginId, authTransitionSettling, finishBuiltinAuthTransition]);

  useEffect(() => {
    if (authTransitionPhase !== "entering" || !user || !userSettings || authTransitionSettling) return;
    const root = document.documentElement;
    const animationId = authTransitionPluginId;
    let cancelled = false;
    if (animationId === "builtin") {
      const overlay = document.querySelector<HTMLElement>(".auth-page--transition-overlay");
      const vortex = overlay?.querySelector<HTMLElement>(".auth-page__transition-vortex");
      if (!overlay || !vortex) {
        finishBuiltinAuthTransition();
        return;
      }
      let fallbackTimer: number | undefined;
      const beginSettling = () => {
        if (cancelled) return;
        cancelled = true;
        if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer);
        vortex.removeEventListener("animationend", handleAnimationEnd);
        vortex.removeEventListener("animationcancel", beginSettling);
        setAuthTransitionSettling(true);
      };
      const handleAnimationEnd = (event: AnimationEvent) => {
        if (event.target === vortex && event.animationName === "lfaa-auth-vortex-veil") beginSettling();
      };
      fallbackTimer = window.setTimeout(beginSettling, 520);
      vortex.addEventListener("animationend", handleAnimationEnd);
      vortex.addEventListener("animationcancel", beginSettling);
      return () => {
        cancelled = true;
        window.clearTimeout(fallbackTimer);
        vortex.removeEventListener("animationend", handleAnimationEnd);
        vortex.removeEventListener("animationcancel", beginSettling);
        if (root.dataset.lfaaAuthEntryAnimation === "builtin") delete root.dataset.lfaaAuthEntryAnimation;
        delete root.dataset.lfaaAuthWorkbenchHidden;
      };
    }
    let started = false;
    const frame = window.requestAnimationFrame(() => {
      started = true;
      if (cancelled) return;
      delete root.dataset.lfaaAuthTransitionCaptured;
      root.dataset.lfaaAuthEntryAnimation = animationId;
      const transitionDocument = document as DocumentWithViewTransition;
      if (typeof transitionDocument.startViewTransition !== "function") {
        delete root.dataset.lfaaAuthEntryAnimation;
        delete root.dataset.lfaaAuthTransitionCaptured;
        setAuthTransitionSceneReady(true);
        setAuthTransitionPhase("idle");
        return;
      }
      try {
        const transition = transitionDocument.startViewTransition(() => {
          flushSync(() => setAuthTransitionSceneReady(true));
        });
        const cleanup = () => {
          if (root.dataset.lfaaAuthEntryAnimation === animationId) delete root.dataset.lfaaAuthEntryAnimation;
          delete root.dataset.lfaaAuthTransitionCaptured;
          if (!cancelled) setAuthTransitionPhase("idle");
        };
        void transition.ready.then(() => {
          if (!cancelled) root.dataset.lfaaAuthTransitionCaptured = "true";
        }, () => undefined);
        void transition.finished.then(cleanup, cleanup);
      } catch {
        delete root.dataset.lfaaAuthEntryAnimation;
        delete root.dataset.lfaaAuthTransitionCaptured;
        setAuthTransitionSceneReady(true);
        setAuthTransitionPhase("idle");
      }
    });
    return () => {
      cancelled = true;
      if (!started) window.cancelAnimationFrame(frame);
      if (root.dataset.lfaaAuthEntryAnimation === animationId) delete root.dataset.lfaaAuthEntryAnimation;
      delete root.dataset.lfaaAuthTransitionCaptured;
    };
  }, [authTransitionPhase, authTransitionPluginId, authTransitionSettling, finishBuiltinAuthTransition, user?.id, userSettings]);

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
      const nextPath = normalizeWorkRoute(window.location.pathname);
      if (nextPath !== window.location.pathname) { routeTo(nextPath, setRoute, { replace: true }); return; }
      const targetApp = applicationIdForRoute(nextPath);
      if (targetApp && readApplicationEntryIdFromHistory(window.history.state) !== targetApp) {
        routeTo(SHARED_WORK_ROUTE, setRoute, { replace: true });
        return;
      }
      setRoute(nextPath);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useLayoutEffect(() => {
    if (!user) return;
    const normalized = normalizeWorkRoute(route);
    if (normalized !== route) { routeTo(normalized, setRoute, { replace: true }); return; }
    const targetApp = applicationIdForRoute(route);
    if (targetApp && readApplicationEntryIdFromHistory(window.history.state) !== targetApp) {
      routeTo(SHARED_WORK_ROUTE, setRoute, { replace: true });
    }
  }, [route, user?.id]);

  useEffect(() => {
    const handleSessionExpired = () => {
      // 初次恢复时 /auth/me 的 401 表示尚未登录，不应显示会话过期提示。
      if (!user) {
        return;
      }

      setUser(null);
      setAuthTransitionSceneReady(false);
      setAuthTransitionSettling(false);
      setAuthTransitionPhase("idle");
      setClientModulesReadyUserId(null);
      clearAppearanceThemeBootstrap();
      navigationSequence.current += 1;
      clearClientSnapshots();
      setPreferences(fallbackPreferences);
      setUserSettings(null);
      setAuthNotice(null);
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
          (sessionError) => sessionError instanceof ApiError && sessionError.status === 401
        );
        if (!active) {
          return;
        }

        if (bootstrap.kind === "anonymous") {
          clearAppearanceThemeBootstrap();
          sessionRestoreResolvedRef.current = true;
          setClientModulesReadyUserId(null);
          setUser(null);
          setPreferences(fallbackPreferences);
          setUserSettings(null);
          return;
        }

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
            void updateCredentialReminder(settingsResult.value.settings);
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
    if (authRequestInFlightRef.current) return;
    authRequestInFlightRef.current = true;
    setAuthBusy(true);
    setAuthNotice(null);

    try {
      const result = await login(username, password);
      await finishAuthentication(result.user);
    } catch (authError) {
      setError(getErrorMessage(authError));
    } finally {
      authRequestInFlightRef.current = false;
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
    setError(null);
    sessionRestoreResolvedRef.current = true;
    setSessionRestoreError(null);
    setPreferences(savedResult.value.preferences);
    setAuthTransitionSceneReady(false);
    setClientModulesReadyUserId(null);
    setUser(user);
    if (settingsResult.status === "fulfilled") void updateCredentialReminder(settingsResult.value.settings);
    const returnRoute = window.location.pathname === "/settings" || window.location.pathname === "/admin/users"
      ? window.location.pathname
      : SHARED_WORK_ROUTE;
    routeTo(returnRoute, setRoute);
    if (settingsResult.status === "fulfilled") {
      setAuthTransitionSettling(false);
      setAuthTransitionPhase("preparing");
      setUserSettings(settingsResult.value.settings);
    } else {
      setAuthTransitionSettling(false);
      setAuthTransitionPhase("idle");
      setError(getErrorMessage(settingsResult.reason));
    }
  }

  async function updateCredentialReminder(settings: UserSettings): Promise<void> {
    setCredentialReminderChecking(true);
    if (!settings.general.defaultAdminCredentialReminderEnabled) {
      setCredentialReminder(null);
      setCredentialReminderChecking(false);
      return;
    }
    try {
      const reminder = await loadDefaultCredentialReminder();
      setCredentialReminder(reminder.usernamePending || reminder.passwordPending ? reminder : null);
    } catch {
      setCredentialReminder(null);
    } finally {
      setCredentialReminderChecking(false);
    }
  }

  async function handlePasskeyLogin(): Promise<void> {
    if (authRequestInFlightRef.current) return;
    authRequestInFlightRef.current = true;
    setAuthBusy(true);
    setError(null);
    setAuthNotice(null);
    try {
      const result = await loginWithPasskey();
      await finishAuthentication(result.user);
    } catch (authError) {
      setError(getErrorMessage(authError));
    } finally {
      authRequestInFlightRef.current = false;
      setAuthBusy(false);
    }
  }

  async function handlePasswordRecovery(username: string, recoveryKey: string, newPassword: string): Promise<boolean> {
    if (authRequestInFlightRef.current) return false;
    authRequestInFlightRef.current = true;
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
      authRequestInFlightRef.current = false;
      setAuthBusy(false);
    }
  }

  async function handleTrustedRecoveryStart(username: string, contactUsername: string) {
    if (authRequestInFlightRef.current) return null;
    authRequestInFlightRef.current = true; setAuthBusy(true); setError(null); setAuthNotice(null);
    try { return await startTrustedAccountRecovery({ username, contactUsername }); }
    catch (recoveryError) { setError(getErrorMessage(recoveryError)); return null; }
    finally { authRequestInFlightRef.current = false; setAuthBusy(false); }
  }

  async function handleTrustedRecoveryStatus(code: string): Promise<"pending" | "approved" | "invalid"> {
    try {
      const result = await getTrustedAccountRecoveryStatus(code);
      if (result.status === "invalid") setError("未找到有效的恢复申请。请检查用户名、联系人用户名和恢复码，或重新发起申请。");
      else setError(null);
      return result.status;
    } catch (recoveryError) { setError(getErrorMessage(recoveryError)); return "invalid"; }
  }

  async function handleTrustedRecoveryComplete(code: string, newPassword: string): Promise<boolean> {
    if (authRequestInFlightRef.current) return false;
    authRequestInFlightRef.current = true; setAuthBusy(true); setError(null); setAuthNotice(null);
    try {
      const result = await completeTrustedAccountRecovery({ code, newPassword });
      setAuthNotice(result.message);
      return true;
    } catch (recoveryError) { setError(getErrorMessage(recoveryError)); return false; }
    finally { authRequestInFlightRef.current = false; setAuthBusy(false); }
  }

  const handleOpenApplication = useCallback(async (app: ApplicationId, mode: ApplicationMode) => {
    const owner = currentUserRef.current?.id;
    if (!owner) return;
    if (app === "workspace") {
      navigationSequence.current += 1; setError(null);
      routeTo(SHARED_WORK_ROUTE, setRoute); return;
    }
    if (mode === "ai-work") {
      navigationSequence.current += 1; setError(null);
      routeTo(`/apps/${app}/ai-work`, setRoute, { applicationEntryApp: app }); return;
    }
    const request = ++navigationSequence.current;
    const selectedMode = "normal";
    setError(null);
    const isCurrent = () => request === navigationSequence.current && currentUserRef.current?.id === owner;
    // 导航偏好只有一个写入链；跳过被新选择替代的请求，相同偏好直接进入，旧响应不能拉回旧页面。
    const operation = navigationSave.current.then(async () => {
      if (!isCurrent()) return;
      // 应用入口只保存常规 App；共享工作不覆盖上次选择的应用。
      if (preferencesRef.current.selectedApp !== app || preferencesRef.current.selectedMode !== selectedMode) {
        const result = await savePreferences({ ...preferencesRef.current, selectedApp: app, selectedMode });
        if (currentUserRef.current?.id !== owner) return;
        preferencesRef.current = result.preferences;
        if (!isCurrent()) return;
        setPreferences(result.preferences);
      }
      if (isCurrent()) {
        setPreferences(preferencesRef.current);
        const targetRoute = app === "steamcmd" || app === "minecraft" ? `/games/${app}` : `/apps/${app}/normal`;
        routeTo(targetRoute, setRoute, app === "steamcmd" || app === "minecraft" ? {} : { applicationEntryApp: app });
      }
    }).catch((saveError: unknown) => {
      if (isCurrent()) setError(getErrorMessage(saveError));
    });
    navigationSave.current = operation;
    await operation;
  }, []);

  async function handleLogout(): Promise<void> {
    navigationSequence.current += 1;
    clearClientSnapshots();
    setError(null);
    try {
      await logout();
    } catch (logoutError) {
      if (!(logoutError instanceof ApiError && logoutError.status === 401)) {
        setError(getErrorMessage(logoutError));
      }
    } finally {
      clearAppearanceThemeBootstrap();
      setAuthTransitionSceneReady(false);
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

  if (!user || (authTransitionPhase !== "idle" && !authTransitionSceneReady)) {
    return (
      <Suspense fallback={<main className="loading-page"><span className="loading-indicator" aria-hidden="true" /></main>}>
        <AuthView
          serverState={serverState}
          busy={authBusy || authTransitionPhase !== "idle"}
          error={user ? null : error}
          notice={authTransitionPhase !== "idle" ? "登录成功，正在准备并进入工作台…" : authNotice}
          transitionPhase={authTransitionPhase}
          transitionPluginId={authTransitionPluginId}
          reducedMotion={authTransitionReducedMotion}
          onSubmit={(username, password) => void handleAuth(username, password)}
          onPasskeyLogin={() => void handlePasskeyLogin()}
          onRecover={handlePasswordRecovery}
          onStartTrustedRecovery={handleTrustedRecoveryStart}
          onCheckTrustedRecovery={handleTrustedRecoveryStatus}
          onCompleteTrustedRecovery={handleTrustedRecoveryComplete}
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

  if (isMiniWindowRoute && window.lfaaDesktop?.mini) {
    return <MiniCompanionWindow user={user} settings={userSettings} />;
  }

  if (userSettings.appearance.wallpaperEngine.enabled && clientModulesReadyUserId !== user.id) {
    return <main className="loading-page" aria-busy="true" />;
  }

  return (
    <>
      {authTransitionPhase !== "idle" && authTransitionSceneReady && authTransitionPluginId !== "builtin" ? (
        <Suspense fallback={null}>
          <AuthView
            serverState={serverState}
            busy
            error={null}
            notice={null}
            transitionPhase={authTransitionPhase}
            transitionPluginId={authTransitionPluginId}
            reducedMotion={authTransitionReducedMotion}
            transitionOnly
            onSubmit={() => undefined}
            onPasskeyLogin={() => undefined}
            onRecover={async () => false}
            onStartTrustedRecovery={async () => null}
            onCheckTrustedRecovery={async () => "invalid"}
            onCompleteTrustedRecovery={async () => false}
            onClearMessage={() => undefined}
          />
        </Suspense>
      ) : null}
      <Suspense fallback={<main className="loading-page" aria-busy="true" />}>
        <Workbench
        user={user}
        initialSettings={userSettings}
        preferences={preferences}
        serverState={serverState}
        route={route}
        error={error}
        onNavigate={(path) => {
          if (normalizeWorkRoute(path) === SHARED_WORK_ROUTE) {
            navigationSequence.current += 1;
          }
          routeTo(path, setRoute);
        }}
        onOpenApplication={handleOpenApplication}
        onUserChange={(nextUser) => setUser(nextUser)}
        onLogout={() => void handleLogout()}
        credentialReminder={authTransitionPhase === "idle" ? credentialReminder : null}
        suspendSetupReminder={credentialReminderChecking || authTransitionPhase !== "idle"}
        authTransitionStaging={authTransitionPhase !== "idle"}
        onAuthTransitionWarmupReady={authTransitionPhase === "preparing" && authTransitionSceneReady && authTransitionPluginId === "builtin" ? handleWorkbenchAuthWarmupReady : undefined}
        />
      </Suspense>
      {authTransitionPhase !== "idle" && authTransitionSceneReady && authTransitionPluginId === "builtin" ? (
        <Suspense fallback={null}>
          <AuthView
            serverState={serverState}
            busy
            error={null}
            notice="登录成功，正在进入工作台…"
            transitionPhase={authTransitionPhase}
            transitionPluginId={authTransitionPluginId}
            reducedMotion={authTransitionReducedMotion}
            transitionOverlay
            transitionExiting={authTransitionPhase === "entering"}
            transitionSettling={authTransitionSettling}
            onTransitionSettle={finishBuiltinAuthTransition}
            onSubmit={() => undefined}
            onPasskeyLogin={() => undefined}
            onRecover={async () => false}
            onStartTrustedRecovery={async () => null}
            onCheckTrustedRecovery={async () => "invalid"}
            onCompleteTrustedRecovery={async () => false}
            onClearMessage={() => undefined}
          />
        </Suspense>
      ) : null}
    </>
  );
}
