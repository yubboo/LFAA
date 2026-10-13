/**
 * 功能：声明 LFAA 当前可切换的应用 ID。
 * 作用：为设置、权限、Agent、API 和能力路由提供唯一共享清单。
 * 关联文件：settings/settings/src/preferences/service.ts、core/tools、core/agent。
 */
export const APPLICATION_IDS = ["steamcmd", "minecraft", "connectivity", "writing", "workspace", "aivideo"] as const;
export type ApplicationId = typeof APPLICATION_IDS[number];

/** 项目目录仅接入这两个 App；范围是能力合同，不等同于所有可切换应用。 */
export const WORKSPACE_PROJECT_APPLICATION_IDS = ["workspace", "minecraft"] as const satisfies readonly ApplicationId[];
export type WorkspaceProjectApplicationId = typeof WORKSPACE_PROJECT_APPLICATION_IDS[number];

/** 路由枚举从应用权威清单生成，新增 App 无需在工作台手写正则分支。 */
export const APPLICATION_ROUTE_PATTERN = new RegExp(`^/apps/(${APPLICATION_IDS.join("|")})/(normal|ai-work)(?:/(.*))?$`, "u");
