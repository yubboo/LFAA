/** 功能：登记 account-controller 的现有接口。作用：保留迁移前的行为并按包维护。关联文件：API Gateway、设置中心或工作台对应入口。 */
import { Router } from "express";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { database } from "lfaa-storage-sqlite/src/database.js";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import { requireAuthentication, requireSuperAdmin, clearSessionCookie } from "lfaa-authorization/src/middleware.js";
import { createRateLimit } from "lfaa-api-remotes/src/rate-limit.js";
import type { AiPluginHost } from "lfaa-app-boot/src/ai-host.js";
import type { MinecraftRealtimePublisher } from "lfaa-api-remotes/src/socket-server.js";
import { authenticateUser, changeUserPassword, createManagedUser, createInitialAdmin, deleteManagedUser, searchUsers, requiresInitialSetup, revokeSession, resetPasswordWithRecoveryKey, setRecoveryKey, transferSuperAdmin, updateManagedUser, updateOwnEmail, verifyUserPassword, type ManagedUserInput, type ManagedUserUpdate, type UserSearchFilters } from "lfaa-identity-auth/src/service.js";
import { completePasskeyAuthentication, completePasskeyRegistration, createPasskeyAuthenticationOptions, createPasskeyRegistrationOptions, deleteUserPasskey, getPasskeyAvailability, listUserPasskeys } from "lfaa-identity-auth/src/passkeys.js";
import { asyncHandler, parseBody, issueSession, assertPasskeyRequestOrigin, accountCredentialsSchema, managedUserCreateSchema, managedUserUpdateSchema, userSearchSchema, loginSchema, passwordRecoverySchema, recoveryKeySchema, passwordChangeSchema, accountEmailSchema, passkeyRegistrationOptionsSchema, passkeyRegistrationVerificationSchema, passkeyAuthenticationVerificationSchema, passkeyRemovalSchema } from "lfaa-api-remotes/src/route-contracts.js";
export function registerRoutes(router: Router, _aiPluginHost: AiPluginHost, realtime: MinecraftRealtimePublisher): void {
const limitSetup = createRateLimit(5, 10 * 60 * 1000);
const limitLogin = createRateLimit(30, 15 * 60 * 1000);
const limitPasswordRecovery = createRateLimit(5, 15 * 60 * 1000);
const limitRecoveryKeyChange = createRateLimit(10, 15 * 60 * 1000);
router.get("/auth/setup-status", (_request, response) => {
    response.json({ requiresSetup: requiresInitialSetup() });
  });

router.get("/auth/passkeys/availability", (_request, response) => {
    response.json(getPasskeyAvailability());
  });

router.post("/auth/setup", limitSetup, asyncHandler(async (request, response) => {
    const body = parseBody<{ username: string; password: string }>(accountCredentialsSchema, request.body);
    const user = await createInitialAdmin(body.username, body.password);
    issueSession(response, user.id);
    response.status(201).json({ user });
  }));

router.post("/auth/login", limitLogin, asyncHandler(async (request, response) => {
    const body = parseBody<{ username: string; password: string }>(loginSchema, request.body);
    const user = await authenticateUser(body.username, body.password);

    if (!user) {
      throw new ApiError(401, "invalid_credentials", "用户名或密码不正确。");
    }

    issueSession(response, user.id);
    response.json({ user });
  }));

router.post("/auth/recovery", limitPasswordRecovery, asyncHandler(async (request, response) => {
    const body = parseBody<{ username: string; recoveryKey: string; newPassword: string }>(passwordRecoverySchema, request.body);
    const recovered = await resetPasswordWithRecoveryKey(body.username, body.recoveryKey, body.newPassword);
    if (!recovered) {
      throw new ApiError(400, "recovery_failed", "用户名或恢复密钥不正确；升级前创建的账户可先登录并在设置中补设恢复密钥。");
    }
    const recoveredUser = database.prepare("SELECT id FROM users WHERE username = ?").get(body.username.trim()) as { id: string } | undefined;
    if (recoveredUser) realtime.disconnectUser(recoveredUser.id);
    response.json({ message: "密码已重置，请使用新密码登录。" });
  }));

router.put("/auth/recovery-key", requireAuthentication, limitRecoveryKeyChange, asyncHandler(async (request, response) => {
    const body = parseBody<{ currentPassword: string; recoveryKey: string }>(recoveryKeySchema, request.body);
    const saved = await setRecoveryKey(request.auth!.user.id, body.currentPassword, body.recoveryKey);
    if (!saved) {
      throw new ApiError(401, "invalid_current_password", "当前登录密码不正确。");
    }
    response.json({ message: "恢复密钥已更新。" });
  }));

router.put("/auth/password", requireAuthentication, limitRecoveryKeyChange, asyncHandler(async (request, response) => {
    const body = parseBody<{ currentPassword: string; newPassword: string }>(passwordChangeSchema, request.body);
    const userId = request.auth!.user.id;
    const revokedSessionIds = await changeUserPassword(userId, request.auth!.sessionId, body.currentPassword, body.newPassword);
    if (!revokedSessionIds) throw new ApiError(401, "invalid_current_password", "当前登录密码不正确，请重新确认。");
    // 只断开被撤销的设备会话，保留当前发起改密的连接。
    for (const sessionId of revokedSessionIds) realtime.disconnectSession(sessionId);
    response.json({ message: "登录密码已更改，其他设备的登录会话已失效。" });
  }));

router.put("/auth/email", requireAuthentication, limitRecoveryKeyChange, asyncHandler(async (request, response) => {
    const body = parseBody<{ currentPassword: string; email: string | null }>(accountEmailSchema, request.body);
    const user = await updateOwnEmail(request.auth!.user.id, body.currentPassword, body.email);
    if (!user) throw new ApiError(401, "invalid_current_password", "当前登录密码不正确，请重新确认。");
    response.json({ user });
  }));

router.get("/auth/me", requireAuthentication, (request, response) => {
    response.json({ user: request.auth?.user });
  });

router.get("/auth/passkeys", requireAuthentication, (request, response) => {
    response.json({ passkeys: listUserPasskeys(request.auth!.user.id) });
  });

router.post("/auth/passkeys/registration/options", requireAuthentication, limitRecoveryKeyChange, asyncHandler(async (request, response) => {
    assertPasskeyRequestOrigin(request);
    const body = parseBody<{ currentPassword: string }>(passkeyRegistrationOptionsSchema, request.body);
    if (!(await verifyUserPassword(request.auth!.user.id, body.currentPassword))) {
      throw new ApiError(401, "invalid_current_password", "当前登录密码不正确。");
    }
    response.json(await createPasskeyRegistrationOptions(request.auth!.user.id));
  }));

router.post("/auth/passkeys/registration/verify", requireAuthentication, limitRecoveryKeyChange, asyncHandler(async (request, response) => {
    assertPasskeyRequestOrigin(request);
    const body = parseBody<{ flowId: string; name: string; response: RegistrationResponseJSON }>(passkeyRegistrationVerificationSchema, request.body);
    const passkey = await completePasskeyRegistration(request.auth!.user.id, body.flowId, body.name, body.response);
    response.status(201).json({ passkey });
  }));

router.post("/auth/passkeys/authentication/options", limitLogin, asyncHandler(async (request, response) => {
    assertPasskeyRequestOrigin(request);
    response.json(await createPasskeyAuthenticationOptions());
  }));

router.post("/auth/passkeys/authentication/verify", limitLogin, asyncHandler(async (request, response) => {
    assertPasskeyRequestOrigin(request);
    const body = parseBody<{ flowId: string; response: AuthenticationResponseJSON }>(passkeyAuthenticationVerificationSchema, request.body);
    const user = await completePasskeyAuthentication(body.flowId, body.response);
    issueSession(response, user.id);
    response.json({ user });
  }));

router.delete("/auth/passkeys/:credentialId", requireAuthentication, limitRecoveryKeyChange, asyncHandler(async (request, response) => {
    assertPasskeyRequestOrigin(request);
    const body = parseBody<{ currentPassword: string }>(passkeyRemovalSchema, request.body);
    const userId = request.auth!.user.id;
    if (!(await verifyUserPassword(userId, body.currentPassword))) {
      throw new ApiError(401, "invalid_current_password", "当前登录密码不正确。");
    }
    if (!deleteUserPasskey(userId, request.params.credentialId)) {
      throw new ApiError(404, "passkey_not_found", "找不到此账户的通行密钥。");
    }
    response.status(204).end();
  }));

router.post("/auth/logout", requireAuthentication, (request, response) => {
    if (request.auth) {
      revokeSession(request.auth.sessionId);
      realtime.disconnectSession(request.auth.sessionId);
    }
    clearSessionCookie(response);
    response.status(204).end();
  });

router.get("/users", requireAuthentication, requireSuperAdmin, (request, response) => {
    const filters = parseBody<UserSearchFilters>(userSearchSchema, request.query);
    response.json({ users: searchUsers(request.auth!.user.id, filters) });
  });

router.post("/users", requireAuthentication, requireSuperAdmin, asyncHandler(async (request, response) => {
    const body = parseBody<ManagedUserInput>(managedUserCreateSchema, request.body);
    const user = await createManagedUser(request.auth!.user.id, body);
    response.status(201).json({ user });
  }));

router.patch("/users/:userId", requireAuthentication, requireSuperAdmin, (request, response) => {
    const body = parseBody<ManagedUserUpdate>(managedUserUpdateSchema, request.body);
    response.json({ user: updateManagedUser(request.auth!.user.id, request.params.userId, body) });
  });

router.delete("/users/:userId", requireAuthentication, requireSuperAdmin, (request, response) => {
    deleteManagedUser(request.auth!.user.id, request.params.userId);
    realtime.disconnectUser(request.params.userId);
    response.status(204).end();
  });

router.post("/users/:userId/transfer-super-admin", requireAuthentication, requireSuperAdmin, (request, response) => {
    transferSuperAdmin(request.auth!.user.id, request.params.userId);
    response.json({ message: "超级管理员权限已转移。" });
  });
}

/** 将本控制器的路由层与当前插件生命周期绑定。 */
import type { Context } from "@deepseek-ai/cordis";
import "lfaa-api-gateway/src/index.js";
export const inject = ["apiGateway"];
export function apply(ctx: Context): void { ctx.apiGateway.register(ctx, "account-controller", registerRoutes); }
