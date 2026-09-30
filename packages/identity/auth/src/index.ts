/**
 * 功能：集中导出账户与会话业务服务。
 * 作用：为 API 路由提供稳定的认证服务入口。
 * 关联文件：packages/identity/auth/src/service.ts、packages/api/gateway/src/index.ts。
 */
export {
  authenticateUser,
  changeUserPassword,
  createManagedUser,
  createInitialAdmin,
  createSession,
  deleteManagedUser,
  findActiveSession,
  searchUsers,
  requiresInitialSetup,
  revokeSession,
  resetPasswordWithRecoveryKey,
  setRecoveryKey,
  transferSuperAdmin,
  updateManagedUser,
  updateOwnEmail,
  verifyUserPassword,
  sessionLifetimeSeconds
} from "./service.js";
export type { AssignableUserRole, ManagedUserInput, ManagedUserUpdate, PublicUser, UserRole, UserSearchFilters } from "./service.js";

import type { Context } from "@deepseek-ai/cordis";
import * as capability from "./service.js";
export const name = "lfaaAuth";
export function apply(ctx: Context): void {
  ctx.provide(name, capability);
}
