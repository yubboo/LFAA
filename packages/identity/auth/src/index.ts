/**
 * 功能：集中导出账户与会话业务服务。
 * 作用：为 API 路由提供稳定的认证服务入口。
 * 关联文件：packages/identity/auth/src/service.ts、packages/api/gateway/src/index.ts。
 */
export {
  authenticateUser,
  changeUserPassword,
  dismissDefaultCredentialReminder,
  ensureDefaultAdminAccount,
  getDefaultCredentialReminder,
  createManagedUser,
  createSession,
  deleteManagedUser,
  findActiveSession,
  searchUsers,
  revokeSession,
  resetPasswordWithRecoveryKey,
  setRecoveryKey,
  transferSuperAdmin,
  updateManagedUser,
  updateOwnUsername,
  updateOwnEmail,
  verifyUserPassword,
  sessionLifetimeSeconds
} from "./service.js";
export type { AssignableUserRole, DefaultCredentialReminder, ManagedUserInput, ManagedUserUpdate, PublicUser, UserRole, UserSearchFilters } from "./service.js";

import type { Context } from "@deepseek-ai/cordis";
import * as capability from "./service.js";
export const name = "lfaaAuth";
export function apply(ctx: Context): void {
  ctx.provide(name, capability);
}
