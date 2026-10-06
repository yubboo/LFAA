/** 功能：提前准备受保护工作台路由所需的前端代码。作用：把可复用的路由判断和模块预热流程与 React 生命周期分开。 */

export interface WorkbenchPreloadModule {
  preloadSettingsPageForRoute: () => Promise<void>;
}

export type WorkbenchModuleLoader = () => Promise<WorkbenchPreloadModule>;

const APP_WORKSPACE_ROUTE = /^\/apps\/(?:steamcmd|minecraft|connectivity|writing|workspace)\/(?:normal|ai-work)(?:\/|$)/u;

export function shouldPreloadWorkbenchForRoute(pathname: string): boolean {
  return pathname === "/settings"
    || pathname === "/admin/users"
    || pathname === "/tasks"
    || pathname === "/files"
    || APP_WORKSPACE_ROUTE.test(pathname);
}

export function shouldPreloadSettingsPageForRoute(pathname: string): boolean {
  return pathname === "/settings" || pathname === "/admin/users";
}

export async function preloadWorkbenchForRoute(
  pathname: string,
  loadModule: WorkbenchModuleLoader,
  authenticated = false
): Promise<void> {
  if (!authenticated && !shouldPreloadWorkbenchForRoute(pathname)) return;

  try {
    const module = await loadModule();
    if (shouldPreloadSettingsPageForRoute(pathname)) {
      await module.preloadSettingsPageForRoute();
    }
  } catch {
    // 预热失败不阻断认证流程；React 懒加载仍可重试并呈现原有回退界面。
  }
}
