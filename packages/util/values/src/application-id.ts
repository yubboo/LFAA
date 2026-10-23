/**
 * 功能：声明 LFAA 当前可切换的应用 ID。
 * 作用：为设置、权限、Agent、API 和能力路由提供唯一共享清单。
 * 关联文件：settings/settings/src/preferences/service.ts、core/tools、core/agent。
 */
export const APPLICATION_IDS = ["steamcmd", "minecraft", "connectivity", "writing", "workspace", "aivideo"] as const;
export type ApplicationId = typeof APPLICATION_IDS[number];

/** 工作台“应用”菜单的真实入口 ID；与 App ID 区分，保留游戏库这一聚合入口。 */
export const APPLICATION_NAVIGATION_IDS = ["games", "steamcmd", "minecraft", "connectivity", "writing", "aivideo"] as const;
export type ApplicationNavigationId = typeof APPLICATION_NAVIGATION_IDS[number];

/** 项目目录仅接入这两个 App；范围是能力合同，不等同于所有可切换应用。 */
export const WORKSPACE_PROJECT_APPLICATION_IDS = ["workspace", "minecraft"] as const satisfies readonly ApplicationId[];
export type WorkspaceProjectApplicationId = typeof WORKSPACE_PROJECT_APPLICATION_IDS[number];

/** 路由枚举从应用权威清单生成，新增 App 无需在工作台手写正则分支。 */
export const APPLICATION_ROUTE_PATTERN = new RegExp(`^/apps/(${APPLICATION_IDS.join("|")})/(normal|ai-work)(?:/(.*))?$`, "u");

/** 所有 App 共用工作入口；根首页、旧工作地址及旧 App 工作地址统一归一到这里。 */
export const SHARED_WORK_ROUTE = "/work";
export function normalizeWorkRoute(path: string): string {
  if (path === "/" || path === "/tasks" || path.match(APPLICATION_ROUTE_PATTERN)?.[2] === "ai-work") return SHARED_WORK_ROUTE;
  const appRoute = path.match(APPLICATION_ROUTE_PATTERN);
  if (appRoute?.[2] === "normal" && (appRoute[1] === "steamcmd" || appRoute[1] === "minecraft")) {
    const section = appRoute[3] ? `/${appRoute[3]}` : "";
    return `/games/${appRoute[1]}${section}`;
  }
  return path;
}
