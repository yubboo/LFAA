/**
 * 功能：管理 LFAA 用户的 WebAuthn 通行密钥与认证挑战。
 * 作用：生成并验证短时一次性挑战，只保存凭据公钥和验证所需元数据，再把成功身份交回现有认证会话流程。
 * 关联文件：packages/util/launch-environment/src/config.ts、packages/storage/storage-sqlite/src/database.ts、packages/identity/auth/src/service.ts、packages/api/gateway/src/index.ts。
 */
import { randomUUID } from "node:crypto";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON
} from "@simplewebauthn/server";
import { ApiError } from "lfaa-util-values/src/http-error.js";
import { config } from "lfaa-launch-environment/src/config.js";
import { database } from "lfaa-storage-sqlite/src/database.js";
import type { AssignableUserRole, PublicUser } from "./service.js";

const challengeLifetimeMilliseconds = 5 * 60 * 1000;

interface PasskeyRow {
  credential_id: string;
  user_id: string;
  user_handle: string;
  public_key: string;
  counter: number | bigint;
  transports_json: string;
  device_type: "singleDevice" | "multiDevice";
  backed_up: number | bigint;
  name: string;
  created_at: string;
  last_used_at: string | null;
}

interface ChallengeRow {
  id: string;
  user_id: string | null;
  purpose: "registration" | "authentication";
  challenge: string;
}

interface UserRow {
  id: string;
  uid: number;
  username: string;
  email: string | null;
  role: AssignableUserRole;
  is_super_admin: number;
  created_at: string;
}

export interface PasskeySummary {
  id: string;
  name: string;
  deviceType: "singleDevice" | "multiDevice";
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface PasskeyRegistrationOptions {
  flowId: string;
  options: PublicKeyCredentialCreationOptionsJSON;
}

export interface PasskeyAuthenticationOptions {
  flowId: string;
  options: PublicKeyCredentialRequestOptionsJSON;
}

function requireRelyingParty(): { rpId: string; origin: string } {
  if (!config.webauthn.enabled || !config.webauthn.rpId || !config.webauthn.origin) {
    throw new ApiError(503, "passkey_unavailable", "通行密钥尚未在此部署环境配置；请使用密码登录。");
  }

  return { rpId: config.webauthn.rpId, origin: config.webauthn.origin };
}

function readTransports(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : [];
  } catch {
    return [];
  }
}

function toSummary(row: PasskeyRow): PasskeySummary {
  return {
    id: row.credential_id,
    name: row.name,
    deviceType: row.device_type,
    backedUp: Number(row.backed_up) === 1,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at
  };
}

function saveChallenge(purpose: ChallengeRow["purpose"], userId: string | null, challenge: string): string {
  const flowId = randomUUID();
  const expiresAt = Date.now() + challengeLifetimeMilliseconds;

  database.prepare("DELETE FROM webauthn_challenges WHERE expires_at <= ?").run(Date.now());
  database.prepare(`
    INSERT INTO webauthn_challenges (id, user_id, purpose, challenge, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(flowId, userId, purpose, challenge, expiresAt);

  return flowId;
}

function consumeChallenge(flowId: string, purpose: ChallengeRow["purpose"], userId: string | null): ChallengeRow | null {
  database.exec("BEGIN IMMEDIATE;");
  try {
    const row = database.prepare(`
      SELECT id, user_id, purpose, challenge
      FROM webauthn_challenges
      WHERE id = ? AND purpose = ? AND user_id IS ? AND expires_at > ?
    `).get(flowId, purpose, userId, Date.now()) as ChallengeRow | undefined;

    // 验证前先原子消费挑战，使超时、失败和重放均不能再次使用同一流程编号。
    database.prepare("DELETE FROM webauthn_challenges WHERE id = ?").run(flowId);
    database.exec("COMMIT;");
    return row ?? null;
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

export function isPasskeyEnabled(): boolean {
  return config.webauthn.enabled;
}

export function getPasskeyAvailability(): { enabled: boolean; available: boolean; origin: string | null } {
  if (!config.webauthn.enabled) return { enabled: false, available: false, origin: null };
  const row = database.prepare("SELECT 1 AS available FROM webauthn_credentials LIMIT 1").get() as { available: number } | undefined;
  return { enabled: true, available: Boolean(row), origin: config.webauthn.origin };
}

export function listUserPasskeys(userId: string): PasskeySummary[] {
  const rows = database.prepare(`
    SELECT credential_id, user_id, user_handle, public_key, counter, transports_json,
           device_type, backed_up, name, created_at, last_used_at
    FROM webauthn_credentials
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(userId) as unknown as PasskeyRow[];

  return rows.map(toSummary);
}

export async function createPasskeyRegistrationOptions(userId: string): Promise<PasskeyRegistrationOptions> {
  const { rpId } = requireRelyingParty();
  const user = database.prepare("SELECT id, username FROM users WHERE id = ?").get(userId) as { id: string; username: string } | undefined;
  if (!user) throw new ApiError(401, "authentication_required", "登录状态无效，请重新登录。");

  const existing = database.prepare(`
    SELECT credential_id, transports_json
    FROM webauthn_credentials
    WHERE user_id = ?
  `).all(userId) as Array<{ credential_id: string; transports_json: string }>;

  const options = await generateRegistrationOptions({
    rpName: "LFAA",
    rpID: rpId,
    userID: new TextEncoder().encode(user.id),
    userName: user.username,
    userDisplayName: user.username,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required"
    },
    excludeCredentials: existing.map((credential) => ({
      id: credential.credential_id,
      transports: readTransports(credential.transports_json)
    }))
  });

  return {
    flowId: saveChallenge("registration", userId, options.challenge),
    options
  };
}

export async function completePasskeyRegistration(
  userId: string,
  flowId: string,
  name: string,
  response: RegistrationResponseJSON
): Promise<PasskeySummary> {
  const { rpId, origin } = requireRelyingParty();
  const challenge = consumeChallenge(flowId, "registration", userId);
  if (!challenge) throw new ApiError(401, "invalid_passkey_flow", "通行密钥验证已过期或已使用，请重新开始。");

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpId,
      requireUserPresence: true,
      requireUserVerification: true
    });
  } catch {
    throw new ApiError(400, "invalid_passkey_response", "通行密钥注册未通过验证，请重试。");
  }

  if (!verification.verified || !verification.registrationInfo.userVerified) {
    throw new ApiError(400, "invalid_passkey_response", "通行密钥注册未通过验证，请重试。");
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  const userHandle = Buffer.from(userId, "utf8").toString("base64url");
  try {
    database.prepare(`
      INSERT INTO webauthn_credentials (
        credential_id, user_id, user_handle, public_key, counter, transports_json,
        device_type, backed_up, name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      credential.id,
      userId,
      userHandle,
      Buffer.from(credential.publicKey).toString("base64url"),
      credential.counter,
      JSON.stringify(response.response.transports ?? credential.transports ?? []),
      credentialDeviceType,
      credentialBackedUp ? 1 : 0,
      name.trim()
    );
  } catch (error) {
    if (error instanceof Error && error.message.toLocaleLowerCase().includes("unique")) {
      throw new ApiError(409, "passkey_already_registered", "此通行密钥已关联其他账户或已登记。");
    }
    throw error;
  }

  const saved = database.prepare(`
    SELECT credential_id, user_id, user_handle, public_key, counter, transports_json,
           device_type, backed_up, name, created_at, last_used_at
    FROM webauthn_credentials
    WHERE credential_id = ? AND user_id = ?
  `).get(credential.id, userId) as PasskeyRow | undefined;
  if (!saved) throw new ApiError(500, "passkey_save_failed", "通行密钥保存失败，请重试。");
  return toSummary(saved);
}

export async function createPasskeyAuthenticationOptions(): Promise<PasskeyAuthenticationOptions> {
  const { rpId } = requireRelyingParty();
  const availability = getPasskeyAvailability();
  if (!availability.available) throw new ApiError(404, "passkey_unavailable", "当前没有可用的通行密钥，请使用密码登录。");

  // 不传 allowCredentials 以允许验证器通过 discoverable credential 选择账户，不暴露用户名枚举接口。
  const options = await generateAuthenticationOptions({
    rpID: rpId,
    userVerification: "required"
  });

  return {
    flowId: saveChallenge("authentication", null, options.challenge),
    options
  };
}

export async function completePasskeyAuthentication(
  flowId: string,
  response: AuthenticationResponseJSON
): Promise<PublicUser> {
  const { rpId, origin } = requireRelyingParty();
  const challenge = consumeChallenge(flowId, "authentication", null);
  const failed = () => new ApiError(401, "invalid_passkey", "通行密钥验证失败，请重试或使用密码登录。");
  if (!challenge) throw failed();

  const credential = database.prepare(`
    SELECT webauthn_credentials.credential_id, webauthn_credentials.user_id,
           webauthn_credentials.user_handle, webauthn_credentials.public_key,
           webauthn_credentials.counter, webauthn_credentials.transports_json,
           webauthn_credentials.device_type, webauthn_credentials.backed_up,
           users.id, users.uid, users.username, users.email, users.role, users.is_super_admin, users.created_at
    FROM webauthn_credentials
    INNER JOIN users ON users.id = webauthn_credentials.user_id
    WHERE webauthn_credentials.credential_id = ?
  `).get(response.id) as (PasskeyRow & UserRow) | undefined;
  if (!credential || (response.response.userHandle && response.response.userHandle !== credential.user_handle)) {
    throw failed();
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpId,
      requireUserVerification: true,
      credential: {
        id: credential.credential_id,
        publicKey: Buffer.from(credential.public_key, "base64url"),
        counter: Number(credential.counter),
        transports: readTransports(credential.transports_json)
      }
    });
  } catch {
    throw failed();
  }

  if (!verification.verified || !verification.authenticationInfo.userVerified) throw failed();

  database.prepare(`
    UPDATE webauthn_credentials
    SET counter = ?, device_type = ?, backed_up = ?, last_used_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE credential_id = ? AND user_id = ?
  `).run(
    verification.authenticationInfo.newCounter,
    verification.authenticationInfo.credentialDeviceType,
    verification.authenticationInfo.credentialBackedUp ? 1 : 0,
    credential.credential_id,
    credential.user_id
  );

  return {
    id: credential.id,
    uid: credential.uid,
    username: credential.username,
    email: credential.email,
    role: credential.is_super_admin === 1 ? "super_admin" : credential.role,
    createdAt: credential.created_at
  };
}

export function deleteUserPasskey(userId: string, credentialId: string): boolean {
  const result = database.prepare(`
    DELETE FROM webauthn_credentials
    WHERE credential_id = ? AND user_id = ?
  `).run(credentialId, userId);
  return result.changes > 0;
}
