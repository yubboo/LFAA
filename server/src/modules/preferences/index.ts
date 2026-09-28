/**
 * 功能：集中导出应用偏好业务服务。
 * 作用：为 API 路由提供用户所选应用和模式的读取、保存入口。
 * 关联文件：server/src/modules/preferences/service.ts、server/src/api/routes.ts。
 */
export { getUserPreferences, saveUserPreferences } from "./service.js";
export type { ApplicationId, ApplicationMode, UserPreferences } from "./service.js";
