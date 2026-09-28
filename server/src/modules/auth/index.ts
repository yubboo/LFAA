/**
 * 功能：集中导出账户与会话业务服务。
 * 作用：为 API 路由提供稳定的认证服务入口。
 * 关联文件：server/src/modules/auth/service.ts、server/src/api/routes.ts。
 */
export {
  authenticateUser,
  createInitialAdmin,
  createSession,
  findActiveSession,
  listUsers,
  requiresInitialSetup,
  revokeSession,
  resetPasswordWithRecoveryKey,
  setRecoveryKey,
  sessionLifetimeSeconds
} from "./service.js";
export type { PublicUser, UserRole } from "./service.js";
