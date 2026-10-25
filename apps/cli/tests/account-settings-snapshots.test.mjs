/**
 * 功能：验证账户资料快照归档、预览、账户隔离和受限恢复。
 * 作用：仅在隔离数据根检查 Settings、Conversation Memory 与 Session Owner 的组合边界。
 * 关联文件：packages/settings/settings-snapshots/src/index.ts、packages/core/session/src/sessions.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { isolateData } from "./isolated-data.mjs";

isolateData(test, "account-settings-snapshots");
await import("lfaa-session-persistence-jsonl/src/repository.js");
const { database } = await import("lfaa-storage-sqlite/src/database.js");
const { retireLegacyFileTables } = await import("lfaa-storage-domain/src/migration.js");
retireLegacyFileTables();
const settings = await import("lfaa-settings/src/service.js");
const memory = await import("lfaa-conversation-memory/src/index.js");
const sessions = await import("lfaa-session/src/sessions.js");
const snapshots = await import("lfaa-settings-snapshots/src/index.ts");

const sourceId = randomUUID();
const targetId = randomUUID();
const outsiderId = randomUUID();
for (const [uid, id, username] of [[1, sourceId, "snapshot-source"], [2, targetId, "snapshot-target"], [3, outsiderId, "snapshot-outsider"]]) {
  database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role) VALUES(?,?,?,'fixture','fixture','member')").run(id, uid, username);
}

test("归档保留公开会话和记忆，恢复只写选定资料并保留目标权限模式", () => {
  const sourceGeneral = settings.getUserSettings(sourceId).general;
  settings.saveUserSettings(sourceId, "general", { ...sourceGeneral, notificationPopupsEnabled: false });
  assert.equal(memory.replaceConversationMemories(sourceId, ["用户明确保存的记忆"], 0), true);
  const turn = sessions.createAiTurn(sourceId, "workspace", null, "归档问题", false);
  sessions.finishAiAssistantMessage(sourceId, turn.session.id, turn.assistantMessage.id, "归档答复", "complete");

  const snapshot = snapshots.createAccountSnapshot(sourceId, "导入回归快照");
  const source = snapshots.readAccountSnapshot(sourceId, snapshot.id);
  assert.ok(source);
  assert.equal(source.summary.manifest.sessions, 1);
  assert.equal(source.summary.manifest.messages, 2);
  assert.equal(snapshots.readAccountSnapshot(outsiderId, snapshot.id), null, "快照 ID 不得越过账户边界");

  const targetGeneral = settings.getUserSettings(targetId).general;
  settings.saveUserSettings(targetId, "general", { ...targetGeneral, notificationPopupsEnabled: true });
  settings.saveUserSettings(targetId, "permissions", { mode: "full_access" });
  const targetMemory = memory.getConversationMemorySnapshot(targetId);
  assert.equal(memory.replaceConversationMemories(targetId, ["目标账户原有记忆"], targetMemory.revision), true);

  const preview = snapshots.previewAccountArchive(targetId, source.archive);
  assert.equal(preview.valid, true);
  assert.equal(preview.memoryWillChange, true);
  assert.equal(preview.sessions, 1);
  assert.equal(preview.messages, 2);
  assert.ok(preview.changedSettingsCategories.includes("general"));

  const restored = snapshots.restoreAccountArchive(targetId, source.archive, { settings: true, memories: true, sessions: true });
  assert.equal(restored.settings.restored.length, 8);
  assert.equal(restored.memories.restored, 1);
  assert.deepEqual({ imported: restored.sessions.imported, skipped: restored.sessions.skipped }, { imported: 1, skipped: 0 });
  assert.equal(settings.getUserSettings(targetId).general.notificationPopupsEnabled, false);
  assert.equal(settings.getUserSettings(targetId).permissions.mode, "full_access", "导入不可改变目标账户的权限模式");
  assert.deepEqual(memory.getConversationMemorySnapshot(targetId).memories, ["用户明确保存的记忆"]);
  const imported = sessions.listAiSessions(targetId, true, "workspace");
  assert.equal(imported.length, 1);
  assert.equal(imported[0].projectId, null);
  assert.deepEqual(sessions.getAiSessionMessages(targetId, imported[0].id).map(message => message.content), ["归档问题", "归档答复"]);
});

test("重复恢复预览报告会话冲突，损坏归档和越界选择均在写入前拒绝", () => {
  const snapshot = snapshots.createAccountSnapshot(sourceId, "冲突与校验");
  const source = snapshots.readAccountSnapshot(sourceId, snapshot.id);
  assert.ok(source);
  assert.equal(snapshots.previewAccountArchive(sourceId, source.archive).sessionConflicts, 1);
  assert.throws(() => snapshots.previewAccountArchive(targetId, Buffer.from("not a gzip archive")), /无法解压/u);
  assert.throws(() => snapshots.restoreAccountArchive(targetId, source.archive, { settings: false, memories: false, sessions: false }), /请选择至少一个/u);
  assert.equal(settings.getUserSettings(targetId).permissions.mode, "full_access");
});
