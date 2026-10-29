/**
 * 功能：声明 LFAA 内部应用作用域 ID。
 * 作用：为设置、权限、Agent、API 和能力路由提供稳定清单；不等同于用户可见的所有工作台入口。
 * 关联文件：settings/settings/src/preferences/service.ts、core/tools、core/agent。
 */
export const APPLICATION_IDS = ["steamcmd", "minecraft", "connectivity", "writing", "workspace", "aivideo"] as const;
export type ApplicationId = typeof APPLICATION_IDS[number];

/** 供项目提供领域背景的正式业务 App；通用 AI Work 入口本身不属于项目关联领域。 */
export const WORKSPACE_PROJECT_CONTEXT_APPLICATION_IDS = APPLICATION_IDS.filter(
  (applicationId): applicationId is Exclude<ApplicationId, "workspace"> => applicationId !== "workspace"
);
export type WorkspaceProjectContextApplicationId = typeof WORKSPACE_PROJECT_CONTEXT_APPLICATION_IDS[number];

/** 应用作用域的领域名称与稳定 ID 共用唯一目录；workspace 保留为通用工作区兼容范围。 */
export const APPLICATION_LABELS: Record<ApplicationId, string> = {
  steamcmd: "Steam 游戏服务器",
  minecraft: "Minecraft 服务端",
  connectivity: "联机管理",
  writing: "写作空间",
  workspace: "通用工作区",
  aivideo: "AI 漫剧"
};

/** 工作台导航入口 ID；包含领域应用聚合入口与系统共享能力入口，不等同于内部 App ID。 */
export const APPLICATION_NAVIGATION_IDS = ["games", "steamcmd", "minecraft", "connectivity", "writing", "aivideo", "canvas"] as const;
export type ApplicationNavigationId = typeof APPLICATION_NAVIGATION_IDS[number];

/** 项目目录仅接入这两个 App；范围是能力合同，不等同于所有可切换应用。 */
export const WORKSPACE_PROJECT_APPLICATION_IDS = ["workspace", "minecraft"] as const satisfies readonly ApplicationId[];
export type WorkspaceProjectApplicationId = typeof WORKSPACE_PROJECT_APPLICATION_IDS[number];

/** 路由枚举从应用权威清单生成，新增 App 无需在工作台手写正则分支。 */
export const APPLICATION_ROUTE_PATTERN = new RegExp(`^/apps/(${APPLICATION_IDS.join("|")})/(normal|ai-work)(?:/(.*))?$`, "u");

/** 系统级无限画布：每个 App 都有自己的画布工作区，可带项目 ID。 */
export const APP_CANVAS_ROUTE_PATTERN = new RegExp(`^/apps/(${APPLICATION_IDS.join("|")})/canvas(?:/([0-9a-fA-F-]{36}))?$`, "u");

/** `/desktop` 旧地址兼容常量；当前认证默认入口为 SHARED_WORK_ROUTE。 */
export const SYSTEM_DESKTOP_ROUTE = "/desktop";

/** 通用 Agent 工作入口；旧任务地址和通用 App AI Work 地址归一到这里，业务 App 的聊天保留 App 作用域。 */
export const SHARED_WORK_ROUTE = "/work";
export function normalizeWorkRoute(path: string): string {
  const appRoute = path.match(APPLICATION_ROUTE_PATTERN);
  if (path === "/" || path === SYSTEM_DESKTOP_ROUTE) return SHARED_WORK_ROUTE;
  if (path === "/tasks" || appRoute?.[1] === "workspace" && appRoute?.[2] === "ai-work") return SHARED_WORK_ROUTE;
  if (appRoute?.[2] === "normal" && (appRoute[1] === "steamcmd" || appRoute[1] === "minecraft")) {
    const section = appRoute[3] ? `/${appRoute[3]}` : "";
    return `/games/${appRoute[1]}${section}`;
  }
  return path;
}
