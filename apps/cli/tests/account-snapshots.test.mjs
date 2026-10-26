/**
 * 功能：验证账户设置归档的分类映射、预览、恢复与 SQLite 快照索引。
 * 作用：在隔离数据根内检查 Settings/Snapshot Owner 的序列化和账户隔离，不接触真实账户。
 * 关联文件：packages/settings/settings-snapshots/src/index.ts、packages/settings/settings/src/service.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { isolateData } from "./isolated-data.mjs";

isolateData(test, "account-snapshots");
await import("lfaa-session-persistence-jsonl/src/repository.js");
const { database } = await import("lfaa-storage-sqlite/src/database.js");
const { retireLegacyFileTables } = await import("lfaa-storage-domain/src/migration.js");
retireLegacyFileTables();
const settings = await import("lfaa-settings/src/service.js");
const snapshots = await import("lfaa-settings-snapshots/src/index.js");
const { createLocalAttachmentStore } = await import("lfaa-attachment-local/src/index.js");
const attachments = createLocalAttachmentStore({ dataDirectory: () => process.env.LFAA_DATA_DIR });

const accountId = randomUUID();
const otherAccountId = randomUUID();
database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES(?,1,'snapshot-fixture','fixture','fixture','admin',0)").run(accountId);

test("账户资料归档按 Owner 分类与 UserSettings 字段映射预览和恢复", async () => {
  const permissionsMode = settings.getUserSettings(accountId).permissions.mode;
  const initialAiRuntime = settings.getUserSettings(accountId).aiRuntime;
  settings.saveUserSettings(accountId, "ai-runtime", { ...initialAiRuntime, speed: "deep" });

  const exported = await snapshots.exportCurrentAccountArchive(accountId, attachments);
  const envelope = JSON.parse(gunzipSync(exported.archive).toString("utf8"));
  const payload = envelope.payload;
  assert.equal(envelope.version, 2);
  assert.equal(payload.settings.aiRuntime.speed, "deep");

  settings.saveUserSettings(accountId, "ai-runtime", { ...settings.getUserSettings(accountId).aiRuntime, speed: "fast" });
  const preview = await snapshots.previewAccountArchive(accountId, exported.archive);
  assert.ok(preview.changedSettingsCategories.includes("ai-runtime"));

  const restored = await snapshots.restoreAccountArchive(accountId, exported.archive, { settings: true, memories: false, sessions: false }, attachments);
  assert.ok(restored.settings.restored.includes("ai-runtime"));
  assert.equal(settings.getUserSettings(accountId).aiRuntime.speed, "deep");
  assert.equal(settings.getUserSettings(accountId).permissions.mode, permissionsMode, "账户快照不能覆盖权限模式");
});

test("SQLite 快照索引可回读且按账户隔离", () => {
  const created = snapshots.createAccountSnapshot(accountId, "隔离账户快照");
  const listed = snapshots.listAccountSnapshots(accountId);
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.id, created.id);
  assert.equal(snapshots.readAccountSnapshot(accountId, created.id)?.summary.id, created.id);
  assert.deepEqual(snapshots.listAccountSnapshots(otherAccountId), []);
  assert.equal(snapshots.readAccountSnapshot(otherAccountId, created.id), null);
  assert.equal(snapshots.deleteAccountSnapshot(otherAccountId, created.id), false);
});
