/**
 * 功能：声明 LFAA 当前可切换的应用 ID。
 * 作用：为设置、权限、Agent、API 和能力路由提供唯一共享清单。
 * 关联文件：settings/settings/src/preferences/service.ts、core/tools、core/agent。
 */
export const APPLICATION_IDS = ["steamcmd", "minecraft", "connectivity", "writing", "workspace"] as const;
export type ApplicationId = typeof APPLICATION_IDS[number];
