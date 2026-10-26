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
const { createLocalAttachmentStore } = await import("lfaa-attachment-local/src/index.js");
const attachments = createLocalAttachmentStore({ dataDirectory: () => process.env.LFAA_DATA_DIR });

const sourceId = randomUUID();
const targetId = randomUUID();
const outsiderId = randomUUID();
for (const [uid, id, username] of [[1, sourceId, "snapshot-source"], [2, targetId, "snapshot-target"], [3, outsiderId, "snapshot-outsider"]]) {
  database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role) VALUES(?,?,?,'fixture','fixture','member')").run(id, uid, username);
}

test("v1 归档继续保留公开会话和记忆，恢复只写选定资料并保留目标权限模式", async () => {
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

  const preview = await snapshots.previewAccountArchive(targetId, source.archive);
  assert.equal(preview.valid, true);
  assert.equal(preview.memoryWillChange, true);
  assert.equal(preview.sessions, 1);
  assert.equal(preview.messages, 2);
  assert.ok(preview.changedSettingsCategories.includes("general"));

  const restored = await snapshots.restoreAccountArchive(targetId, source.archive, { settings: true, memories: true, sessions: true }, attachments);
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

test("重复恢复预览报告会话冲突，损坏归档和越界选择均在写入前拒绝", async () => {
  const snapshot = snapshots.createAccountSnapshot(sourceId, "冲突与校验");
  const source = snapshots.readAccountSnapshot(sourceId, snapshot.id);
  assert.ok(source);
  assert.equal((await snapshots.previewAccountArchive(sourceId, source.archive)).sessionConflicts, 1);
  await assert.rejects(() => snapshots.previewAccountArchive(targetId, Buffer.from("not a gzip archive")), /无法解压/u);
  await assert.rejects(() => snapshots.restoreAccountArchive(targetId, source.archive, { settings: false, memories: false, sessions: false }), /请选择至少一个/u);
  assert.equal(settings.getUserSettings(targetId).permissions.mode, "full_access");
});

test("v2 迁移包往返恢复 Agent 检查点、活动摘要和附件内容", async () => {
  const v2SourceId = randomUUID(), v2TargetId = randomUUID();
  database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role) VALUES(?,4,'snapshot-v2-source','fixture','fixture','member'),(?,5,'snapshot-v2-target','fixture','fixture','member')").run(v2SourceId, v2TargetId);
  const bytes = Buffer.from("换电脑后仍需要读取的会话附件", "utf8");
  const importedBytes = Buffer.from("需要在新电脑重新写入的附件", "utf8");
  const sourceAttachment = await attachments.put({ userId: v2SourceId, name: "context.txt", mediaType: "text/plain", data: bytes });
  const sourceImportedAttachment = await attachments.put({ userId: v2SourceId, name: "steps.txt", mediaType: "text/plain", data: importedBytes });
  const turn = sessions.createAiTurn(v2SourceId, "workspace", null, "请结合附件继续处理", false, null, undefined,
    [sourceAttachment, sourceImportedAttachment].map(({ id, name, mediaType }) => ({ id, name, mediaType })));
  sessions.finishAiAssistantMessage(v2SourceId, turn.session.id, turn.assistantMessage.id, "已读完附件内容。", "complete");
  const timestamp = new Date().toISOString();
  sessions.saveAiAssistantActivity(v2SourceId, turn.session.id, turn.assistantMessage.id, [{
    id: randomUUID(), kind: "tool", title: "读取 C:\\Users\\Administrator\\project\\notes.txt", status: "complete",
    detail: "已读取 D:\\Users\\Administrator\\project\\notes.txt", startedAt: timestamp, completedAt: timestamp, durationMs: 5,
    fileChanges: [{ operation: "read", path: "C:/Users/Administrator/project/notes.txt", projectId: randomUUID() }]
  }]);
  const seed = sessions.prepareAiSessionBranchSeed(v2SourceId, turn.session.id, turn.assistantMessage.id, 10_000);
  assert.ok(seed);
  const sourceBranch = sessions.createAiSessionBranchWithMemory(v2SourceId, seed, "用户正在整理附件中的迁移步骤；下一步要核对新电脑项目。D:\\Users\\Administrator\\project", [
    { providerId: "fixture-provider", modelId: "fixture-model", promptTokens: 10, completionTokens: 5 }
  ]);
  assert.ok(sourceBranch);

  const archive = await snapshots.exportCurrentAccountArchive(v2SourceId, attachments);
  const preview = await snapshots.previewAccountArchive(v2TargetId, archive.archive);
  assert.equal(preview.version, 2);
  assert.equal(preview.attachments, 2);
  assert.equal(preview.contextSessions, 2);
  assert.equal(sessions.listAiSessions(v2TargetId, true, "workspace").length, 0, "预览不写入会话");
  const targetAttachment = await attachments.put({ userId: v2TargetId, name: "already-here.txt", mediaType: "text/plain", data: bytes });
  await assert.rejects(() => snapshots.restoreAccountArchive(v2TargetId, archive.archive, { settings: false, memories: false, sessions: true }), /没有装配附件恢复能力/u);
  const restored = await snapshots.restoreAccountArchive(v2TargetId, archive.archive, { settings: false, memories: false, sessions: true }, attachments);
  assert.deepEqual(restored.attachments, { imported: 1, reused: 1 });
  const imported = sessions.listAiSessions(v2TargetId, true, "workspace");
  assert.equal(imported.length, 2);
  const importedSource = imported.find(session => session.title === turn.session.title);
  const importedBranch = imported.find(session => session.title === sourceBranch.title);
  assert.ok(importedSource && importedBranch);
  const importedMessages = sessions.getAiSessionMessages(v2TargetId, importedSource.id);
  const importedReferences = importedMessages.find(message => message.role === "user")?.attachments;
  assert.ok(importedReferences);
  assert.equal(importedReferences.length, 2);
  assert.notEqual(sourceImportedAttachment.id, importedReferences[1].id);
  assert.deepEqual(importedReferences, [
    { id: targetAttachment.id, name: "context.txt", mediaType: "text/plain" },
    { id: importedReferences[1].id, name: "steps.txt", mediaType: "text/plain" }
  ]);
  assert.deepEqual(Buffer.from((await attachments.get(v2TargetId, targetAttachment.id)).data), bytes);
  assert.deepEqual(Buffer.from((await attachments.get(v2TargetId, importedReferences[1].id)).data), importedBytes);
  const restoredActivity = importedMessages.find(message => message.role === "assistant")?.activity[0];
  assert.ok(restoredActivity);
  assert.equal(restoredActivity.detail.includes("D:\\Users"), false);
  assert.deepEqual(restoredActivity.fileChanges, []);

  sessions.setAiSessionArchived(v2TargetId, importedBranch.id, false);
  const continued = sessions.createAiTurn(v2TargetId, "workspace", importedBranch.id, "继续核对");
  assert.ok(continued.history.some(message => message.content.includes("用户正在整理附件中的迁移步骤")));
  assert.equal(continued.history.some(message => message.content.includes("D:\\Users")), false);
  sessions.finishAiAssistantMessage(v2TargetId, importedBranch.id, continued.assistantMessage.id, "继续答复", "complete");
});
