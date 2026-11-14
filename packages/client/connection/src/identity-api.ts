/**
 * 身份认证、Passkey、账户恢复与账户管理的 Connection DTO/API。
 */
import { startAuthentication, startRegistration, type AuthenticationResponseJSON, type PublicKeyCredentialCreationOptionsJSON, type PublicKeyCredentialRequestOptionsJSON, type RegistrationResponseJSON } from "@simplewebauthn/browser";
import { ApiError, advanceAuthenticationGeneration, request } from "./http-client.js";
import { accountControllerRemoteMethods, type AccountControllerRemoteContract } from "lfaa-api-account-controller/src/client-contract.generated.js";
import { invokeTypertRemote } from "./typert-client.js";


export type UserRole = "super_admin" | "admin" | "member";


export function hasAdminAccess(role: UserRole): boolean {
  return role === "super_admin" || role === "admin";
}


export function userRoleLabel(role: UserRole): string {
  if (role === "super_admin") return "超级管理员";
  return role === "admin" ? "管理员" : "普通账户";
}


export interface User {
  id: string;
  uid: number;
  username: string;
  email: string | null;
  role: UserRole;
  createdAt: string;
}


export interface UserSearchFilters {
  search?: string;
  uid?: number;
  username?: string;
  email?: string;
  role?: UserRole;
  createdFrom?: string;
  createdTo?: string;
}


export interface ManagedUserInput {
  username: string;
  email: string | null;
  role?: Exclude<UserRole, "super_admin">;
}


export interface PasskeyAvailability {
  enabled: boolean;
  available: boolean;
  origin: string | null;
}


export interface PasskeySummary {
  id: string;
  name: string;
  deviceType: "singleDevice" | "multiDevice";
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}


export interface DefaultCredentialReminder {
  usernamePending: boolean;
  passwordPending: boolean;
}


export async function login(username: string, password: string): Promise<{ user: User }> {
  const result = await request<{ user: User }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
  advanceAuthenticationGeneration();
  return result;
}


export function loadPasskeyAvailability(): Promise<PasskeyAvailability> {
  return request("/auth/passkeys/availability");
}


export function loadUserPasskeys(): Promise<{ passkeys: PasskeySummary[] }> {
  return request("/auth/passkeys");
}


export async function loginWithPasskey(): Promise<{ user: User }> {
  const { flowId, options } = await request<{
    flowId: string;
    options: PublicKeyCredentialRequestOptionsJSON;
  }>("/auth/passkeys/authentication/options", { method: "POST", body: "{}" });
  const response: AuthenticationResponseJSON = await startAuthentication({ optionsJSON: options });
  const result = await request<{ user: User }>("/auth/passkeys/authentication/verify", {
    method: "POST",
    body: JSON.stringify({ flowId, response })
  });
  advanceAuthenticationGeneration();
  return result;
}


export async function registerPasskey(currentPassword: string, name: string): Promise<{ passkey: PasskeySummary }> {
  const { flowId, options } = await request<{
    flowId: string;
    options: PublicKeyCredentialCreationOptionsJSON;
  }>("/auth/passkeys/registration/options", {
    method: "POST",
    body: JSON.stringify({ currentPassword })
  });
  const response: RegistrationResponseJSON = await startRegistration({ optionsJSON: options });
  return request("/auth/passkeys/registration/verify", {
    method: "POST",
    body: JSON.stringify({ flowId, name, response })
  });
}


export function removePasskey(credentialId: string, currentPassword: string): Promise<void> {
  return request(`/auth/passkeys/${encodeURIComponent(credentialId)}`, {
    method: "DELETE",
    body: JSON.stringify({ currentPassword })
  });
}


export function recoverPassword(input: { username: string; recoveryKey: string; newPassword: string }): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/recovery", {
    method: "POST",
    body: JSON.stringify(input)
  });
}


export interface TrustedContact { id: string; username: string; role: string; createdAt: string }

export interface TrustedRecoveryRequest { id: string; requesterUsername: string; createdAt: string; expiresAt: string; approvedAt: string | null }

export interface TrustedContactSettings { contacts: TrustedContact[]; trustedBy: TrustedContact[]; recoveryRequests: TrustedRecoveryRequest[] }

export interface TrustedAccountRecoveryStartResult { code: string; expiresAt: string; message: string }

export function loadTrustedContactSettings(): Promise<TrustedContactSettings> { return request("/auth/trusted-contacts"); }

export function createTrustedContactInvitation(): Promise<{ code: string; expiresAt: string }> {
  return request("/auth/trusted-contacts/invitations", { method: "POST", body: "{}" });
}

export function acceptTrustedContactInvitation(code: string): Promise<{ contact: TrustedContact }> {
  return request("/auth/trusted-contacts/accept", { method: "POST", body: JSON.stringify({ code }) });
}

export function removeTrustedContact(contactId: string): Promise<void> {
  return request(`/auth/trusted-contacts/${encodeURIComponent(contactId)}`, { method: "DELETE" });
}

export function approveTrustedRecoveryRequest(requestId: string): Promise<{ request: TrustedRecoveryRequest }> {
  return request(`/auth/trusted-recovery-requests/${encodeURIComponent(requestId)}/approve`, { method: "POST", body: "{}" });
}

export function startTrustedAccountRecovery(input: { username: string; contactUsername: string }): Promise<TrustedAccountRecoveryStartResult> {
  return request("/auth/trusted-recovery/start", { method: "POST", body: JSON.stringify(input) });
}

export function getTrustedAccountRecoveryStatus(code: string): Promise<{ status: "pending" | "approved" | "invalid" }> {
  return request("/auth/trusted-recovery/status", { method: "POST", body: JSON.stringify({ code }) });
}

export function completeTrustedAccountRecovery(input: { code: string; newPassword: string }): Promise<{ message: string }> {
  return request("/auth/trusted-recovery/complete", { method: "POST", body: JSON.stringify(input) });
}


export function saveRecoveryKey(input: { currentPassword: string; recoveryKey: string }): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/recovery-key", {
    method: "PUT",
    body: JSON.stringify(input)
  });
}


export function changeCurrentPassword(input: { currentPassword: string; newPassword: string }): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/password", {
    method: "PUT",
    body: JSON.stringify(input)
  });
}


export function updateCurrentUserEmail(input: { currentPassword: string; email: string | null }): Promise<{ user: User }> {
  return request<{ user: User }>("/auth/email", {
    method: "PUT",
    body: JSON.stringify(input)
  });
}


export function updateCurrentUserUsername(input: { currentPassword: string; username: string }): Promise<{ user: User }> {
  return request<{ user: User }>("/auth/username", {
    method: "PUT",
    body: JSON.stringify(input)
  });
}


export function logout(): Promise<void> {
  advanceAuthenticationGeneration();
  return request<void>("/auth/logout", { method: "POST" });
}


export function loadUsers(filters: UserSearchFilters = {}): Promise<{ users: User[] }> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const encodedFilters = query.toString();
  const suffix = encodedFilters ? `?${encodedFilters}` : "";
  return request<{ users: User[] }>(`/users${suffix}`);
}


export function createManagedUser(input: ManagedUserInput & { password: string }): Promise<{ user: User }> {
  return request<{ user: User }>("/users", { method: "POST", body: JSON.stringify(input) });
}


export function updateManagedUser(userId: string, input: ManagedUserInput): Promise<{ user: User }> {
  return request<{ user: User }>(`/users/${encodeURIComponent(userId)}`, { method: "PATCH", body: JSON.stringify(input) });
}


export function deleteManagedUser(userId: string): Promise<void> {
  return request<void>(`/users/${encodeURIComponent(userId)}`, { method: "DELETE" });
}


export function transferSuperAdmin(userId: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/users/${encodeURIComponent(userId)}/transfer-super-admin`, { method: "POST" });
}


export function dismissDefaultCredentialReminder(): Promise<void> {
  return request<void>("/auth/default-credential-reminder/dismiss", { method: "POST" });
}


export function loadDefaultCredentialReminder(): Promise<DefaultCredentialReminder> {
  return request<DefaultCredentialReminder>("/auth/default-credential-reminder");
}


export function loadCurrentUser(): Promise<{ user: User }> {
  const endpoint = accountControllerRemoteMethods["auth/me"].endpoint;
  return invokeTypertRemote<AccountControllerRemoteContract, typeof endpoint>(endpoint, {}).catch((error: unknown) => {
    // Host 进程可能仍在运行升级前的构建；只在明确的路由缺失时走其同一认证 Owner 的旧只读入口。
    // 401、网络故障、输入/输出校验失败都原样返回，不降级认证或吞掉新 Host 错误。
    if (error instanceof ApiError && error.status === 404 && error.code === "not_found") {
      return request<{ user: User }>("/auth/me");
    }
    throw error;
  });
}