/**
 * 功能：恢复浏览器 Client 的认证会话。
 * 作用：有效会话只验证当前身份；首次设置状态仅在明确未登录时读取。
 * 关联文件：App.tsx、apps/cli/tests/client-session-restore.test.mjs。
 */
export type SessionBootstrapResult<User> =
  | { kind: "authenticated"; user: User }
  | { kind: "anonymous"; requiresSetup: boolean };

/** 避免有效会话刷新时串行等待一个只对未登录用户有用的初始化查询。 */
export async function resolveSessionBootstrap<User>(
  loadCurrentUser: () => Promise<{ user: User }>,
  loadSetupStatus: () => Promise<{ requiresSetup: boolean }>,
  isUnauthorized: (error: unknown) => boolean
): Promise<SessionBootstrapResult<User>> {
  try {
    const session = await loadCurrentUser();
    return { kind: "authenticated", user: session.user };
  } catch (error) {
    if (!isUnauthorized(error)) throw error;
    const setupStatus = await loadSetupStatus();
    return { kind: "anonymous", requiresSetup: setupStatus.requiresSetup };
  }
}
