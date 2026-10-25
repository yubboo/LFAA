/**
 * 功能：验证同一本机两个已认证账户间的受信邀请和双人确认密码恢复。
 * 作用：验证邀请码/恢复码仅以摘要持久化、联系人精确授权、恢复成功后旧会话失效。
 * 关联文件：packages/identity/auth/src/service.ts、packages/storage/storage-sqlite/src/database.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { isolateData } from "./isolated-data.mjs";

isolateData(test, "trusted-account-recovery");
await import("lfaa-session-persistence-jsonl/src/repository.js");
const { database } = await import("lfaa-storage-sqlite/src/database.js");
const { retireLegacyFileTables } = await import("lfaa-storage-domain/src/migration.js");
retireLegacyFileTables();
const auth = await import("lfaa-identity-auth/src/service.js");

const ownerId = randomUUID(), contactId = randomUUID(), outsiderId = randomUUID();
for (const [uid, id, username] of [[1, ownerId, "recovery-owner"], [2, contactId, "recovery-contact"], [3, outsiderId, "recovery-outsider"]]) {
  database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES(?,?,?,'old-salt','old-hash','member',0)").run(id, uid, username);
}

test("邀请双方都要持有：用户确认联系人后，只有该联系人能批准恢复", async () => {
  const invite = auth.createTrustedContactInvitation(ownerId);
  assert.match(invite.code, /^[A-Za-z0-9_-]{32,64}$/u);
  const inviteHash = database.prepare("SELECT code_sha256 FROM account_trusted_contact_invites WHERE owner_user_id=?").get(ownerId).code_sha256;
  assert.notEqual(inviteHash, invite.code);
  assert.equal(auth.acceptTrustedContactInvitation(ownerId, invite.code), null, "不能把自己设为联系人");
  const accepted = auth.acceptTrustedContactInvitation(contactId, invite.code);
  assert.equal(accepted.id, contactId);
  assert.equal(auth.acceptTrustedContactInvitation(outsiderId, invite.code), null, "邀请只能消费一次");
  assert.equal(auth.listTrustedContactSettings(ownerId).contacts[0].id, contactId);
  assert.equal(auth.listTrustedContactSettings(contactId).trustedBy[0].id, ownerId);

  const challenge = auth.startTrustedAccountRecovery("recovery-owner", "recovery-contact");
  assert.equal(await auth.getTrustedAccountRecoveryStatus(challenge.code), "pending");
  const pending = auth.listTrustedContactSettings(contactId).recoveryRequests;
  assert.equal(pending.length, 1);
  assert.equal(pending[0].requesterUsername, "recovery-owner");
  assert.ok(!JSON.stringify(pending).includes(challenge.code));
  assert.equal(auth.approveTrustedAccountRecovery(outsiderId, pending[0].id), null, "未受信账户不能批准");
  const approved = auth.approveTrustedAccountRecovery(contactId, pending[0].id);
  assert.equal(approved.approvedAt !== null, true);
  assert.equal(await auth.getTrustedAccountRecoveryStatus(challenge.code), "approved");
  assert.equal(await auth.completeTrustedAccountRecovery(challenge.code, "Strong-New-Password-2026!"), ownerId);
  assert.equal(await auth.getTrustedAccountRecoveryStatus(challenge.code), null, "恢复码只能消费一次");
  assert.equal(await auth.authenticateUser("recovery-owner", "old-password"), null);
  assert.equal((await auth.authenticateUser("recovery-owner", "Strong-New-Password-2026!")).id, ownerId);
});

test("撤销任一侧的关系会清除双向委托及未完成恢复请求", () => {
  const invite = auth.createTrustedContactInvitation(ownerId);
  assert.ok(auth.acceptTrustedContactInvitation(contactId, invite.code));
  auth.startTrustedAccountRecovery("recovery-owner", "recovery-contact");
  assert.equal(auth.removeTrustedContact(contactId, ownerId), true);
  assert.equal(auth.listTrustedContactSettings(ownerId).contacts.length, 0);
  assert.equal(auth.listTrustedContactSettings(contactId).trustedBy.length, 0);
  assert.equal(auth.listTrustedContactSettings(contactId).recoveryRequests.length, 0);
});
