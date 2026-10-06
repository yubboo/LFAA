/** 功能：集中映射工作台路由的外观背景槽。作用：让应用路由使用设置中心中的权威背景项。关联文件：Workbench.tsx、default-settings.ts。 */
import type { UserSettings } from "lfaa-client-connection/src/api.js";

/** 将游戏/工具工作区路由映射到其 Appearance 背景槽；联机应用复用应用中心背景。 */
export function appearanceBackgroundSlotForRoute(route: string): keyof UserSettings["appearance"]["backgrounds"] {
  const routeMatch = route.match(/^\/apps\/(steamcmd|minecraft|connectivity|writing|workspace)\/(?:normal|ai-work)(?:\/.*)?$/);
  return routeMatch && routeMatch[1] !== "workspace" && routeMatch[1] !== "connectivity"
    ? routeMatch[1] as "steamcmd" | "minecraft" | "writing"
    : "appCenter";
}
