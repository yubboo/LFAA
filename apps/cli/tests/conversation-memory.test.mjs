/** 功能：验证 AI Work 个性化记忆迁移、内容限额、账户隔离和删除并发保护。 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join, basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("Conversation Memory Owner 限制记忆内容并让删除胜过并行整理", () => {
  const parent = resolve(cli, "../../dist/.tmp");
  mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, "lfaa-conversation-memory-"));
  try {
    execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "--input-type=module", "-e", `
      import assert from 'node:assert/strict';
      const { database, closeDatabase } = await import('lfaa-storage-sqlite/src/database.js');
      const { configuration } = await import('lfaa-storage-domain/src/configuration.js');
      const { migrateConversationMemorySchema } = await import('lfaa-storage-sqlite/src/database.js');
      const memory = await import('lfaa-conversation-memory/src/index.js');
      database.exec('PRAGMA user_version = 42');
      migrateConversationMemorySchema();
      assert.equal(Number(database.prepare('PRAGMA user_version').get().user_version), 43);
      database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role) VALUES ('memory-owner',9101,'memory-owner','salt','hash','member'),('memory-other',9102,'memory-other','salt','hash','member')").run();
      const settings = await import('lfaa-settings/src/service.js');
      assert.deepEqual(settings.getUserSettings('memory-owner').personalization, { memoryEnabled: false, memoryFromToolChats: false });
      settings.saveUserSettings('memory-owner', 'personalization', { memoryEnabled: true, memoryFromToolChats: true });
      assert.deepEqual(settings.getUserSettings('memory-owner').personalization, { memoryEnabled: true, memoryFromToolChats: true });
      const bounded = memory.normalizeConversationMemories(['用户偏好  简体中文', ' 用户偏好 简体中文 ', 'token: do-not-store', '密码: do-not-store', '13800138000', 'user@example.com', 'x'.repeat(300)]);
      assert.deepEqual(bounded, ['用户偏好 简体中文', 'x'.repeat(memory.CONVERSATION_MEMORY_MAX_ITEM_CHARS)]);
      const filteredSource = memory.redactConversationMemorySource('token=memory-secret email=user@example.com phone=13800138000');
      for (const secret of ['memory-secret', 'user@example.com', '13800138000']) assert.equal(filteredSource.includes(secret), false);
      assert.deepEqual(memory.validateConversationMemoriesInput(['偏好简体中文', '回复简洁']), ['偏好简体中文', '回复简洁']);
      assert.equal(memory.validateConversationMemoriesInput(['password: do-not-save']), null);
      assert.equal(memory.validateConversationMemoriesInput(['sk-proj-abcdefghijklmnop']), null);
      assert.equal(memory.validateConversationMemoriesInput(['重复项', '重复项']), null);
      assert.equal(memory.normalizeConversationMemories(Array.from({ length: 30 }, (_, index) => '记忆 ' + index)).length, memory.CONVERSATION_MEMORY_MAX_ITEMS);
      assert.deepEqual(memory.parseConversationMemoryOutput('{"memories":["用户偏好简洁回复"]}'), ['用户偏好简洁回复']);
      const fence=String.fromCharCode(96).repeat(3);const fencedMemoryOutput=fence+'json\\n{"memories":["保持简体中文"]}\\n'+fence;
      assert.deepEqual(memory.parseConversationMemoryOutput(fencedMemoryOutput), ['保持简体中文']);
      assert.equal(memory.parseConversationMemoryOutput('不是 JSON'), null);
      assert.equal(memory.isConversationMemoryGenerationAllowed({ memoryEnabled: false, memoryFromToolChats: true }, 0), false);
      assert.equal(memory.isConversationMemoryGenerationAllowed({ memoryEnabled: true, memoryFromToolChats: false }, 0), true);
      assert.equal(memory.isConversationMemoryGenerationAllowed({ memoryEnabled: true, memoryFromToolChats: false }, 1), false);
      assert.equal(memory.isConversationMemoryGenerationAllowed({ memoryEnabled: true, memoryFromToolChats: true }, 1), true);
      assert.deepEqual(memory.getConversationMemorySnapshot('memory-owner'), { memories: [], revision: 0 });
      const { config } = await import('lfaa-launch-environment/src/config.js');
      const { JsonStorageBackend } = await import('lfaa-storage-json/src/index.js');
      const { join } = await import('node:path');
      new JsonStorageBackend(join(config.dataDirectory, 'storages')).write('session-migration', { version: 1, sessions: 0, messages: 0, usage: 0, migratedAt: new Date().toISOString() });
      database.exec('ALTER TABLE ai_sessions ADD COLUMN jsonl_revision TEXT');
      const sessions = await import('lfaa-session/src/sessions.js');
      const { sessionRecords } = await import('lfaa-session-persistence-jsonl/src/repository.js');
      const { conversationMemoriesSchema } = await import('lfaa-api-remotes/src/route-contracts.js');
      assert.equal(conversationMemoriesSchema.validate({ revision: 0, memories: ['偏好简体中文'] }).error, undefined);
      assert.ok(conversationMemoriesSchema.validate({ revision: -1, memories: [] }).error);
      assert.ok(conversationMemoriesSchema.validate({ revision: 0, memories: [''] }).error);
      const ownerTurn = sessions.createAiTurn('memory-owner', 'writing', null, '我偏好简体中文');
      const otherTurn = sessions.createAiTurn('memory-other', 'writing', null, '另一个账户的消息');
      const newMemoryBlock = '<conversation-memory>新正文不可保存</conversation-memory>';
      sessions.recordAiSessionRequest('memory-owner', ownerTurn.session.id, ownerTurn.assistantMessage.id, { providerId: 'test-provider', modelId: 'test-model', permissionMode: 'request_approval', settings: {} }, [{ role: 'system', content: newMemoryBlock }]);
      sessions.saveAiModelHistory('memory-owner', ownerTurn.session.id, ownerTurn.assistantMessage.id, [{ role: 'system', content: newMemoryBlock }]);
      assert.equal(JSON.stringify(sessionRecords.allForSession('session_events', ownerTurn.session.id)).includes('新正文不可保存'), false);
      assert.equal(JSON.stringify(sessionRecords.get('ai_messages', ownerTurn.assistantMessage.id)).includes('新正文不可保存'), false);
      const oldMemoryBlock = '<conversation-memory>[\\\"旧账户记忆不可留\\\"]</conversation-memory>';
      for (const turn of [ownerTurn, otherTurn]) {
        sessionRecords.commit(turn.session.id, [{ table: 'ai_messages', key: turn.assistantMessage.id, value: { ...sessionRecords.get('ai_messages', turn.assistantMessage.id), model_history: [{ role: 'system', content: oldMemoryBlock }] } }]);
        const userId = turn === ownerTurn ? 'memory-owner' : 'memory-other';
        sessions.appendAiSessionEvents(userId, turn.session.id, [
          { type: 'request/context', data: { runId: turn.assistantMessage.id, messages: [{ role: 'system', content: oldMemoryBlock }] } },
          { type: 'assistant/attempt', data: { runId: turn.assistantMessage.id, messages: [{ role: 'system', content: oldMemoryBlock }] } }
        ]);
      }
      sessions.redactConversationMemoryContexts('memory-owner');
      const ownerEvents = sessionRecords.allForSession('session_events', ownerTurn.session.id);
      const ownerHistory = sessionRecords.get('ai_messages', ownerTurn.assistantMessage.id);
      assert.equal(JSON.stringify(ownerEvents).includes('旧账户记忆不可留'), false);
      assert.equal(JSON.stringify(ownerHistory).includes('旧账户记忆不可留'), false);
      assert.equal(JSON.stringify(sessionRecords.allForSession('session_events', otherTurn.session.id)).includes('旧账户记忆不可留'), true);
      const ownerLog = join(process.env.LFAA_DATA_DIR, 'sessions', (await import('node:crypto')).createHash('sha256').update(ownerTurn.session.id).digest('hex'), 'events.jsonl');
      assert.equal((await import('node:fs')).readFileSync(ownerLog, 'utf8').includes('旧账户记忆不可留'), false);
      sessions.redactConversationMemoryContexts('memory-owner');
      assert.equal(memory.replaceConversationMemories('memory-owner', ['用户偏好简洁回复'], 0), true);
      assert.equal(memory.replaceConversationMemories('memory-other', ['另一账户的长期偏好'], 0), true);
      assert.equal(memory.replaceConversationMemories('memory-owner', ['旧请求覆盖'], 0), false);
      const currentRevision = memory.getConversationMemorySnapshot('memory-owner').revision;
      assert.equal(memory.replaceConversationMemories('memory-owner', [], currentRevision), true);
      assert.deepEqual(memory.getConversationMemorySnapshot('memory-owner').memories, []);
      const inFlightRevision = memory.getConversationMemorySnapshot('memory-owner').revision;
      memory.clearConversationMemories('memory-owner');
      assert.deepEqual(memory.getConversationMemorySnapshot('memory-owner'), { memories: [], revision: inFlightRevision + 1 });
      assert.equal(memory.replaceConversationMemories('memory-owner', ['删除前已开始的整理'], inFlightRevision), false);
      assert.deepEqual(memory.getConversationMemorySnapshot('memory-other').memories, ['另一账户的长期偏好']);
      database.prepare("DELETE FROM users WHERE id = 'memory-owner'").run();
      assert.deepEqual(memory.getConversationMemorySnapshot('memory-owner'), { memories: [], revision: 0 });
      sessionRecords.close(); configuration.close(); closeDatabase();
    `], { cwd: cli, env: { ...process.env, NODE_ENV: "test", LFAA_DATA_DIR: data, JWT_SECRET: "" }, encoding: "utf8", stdio: "pipe", timeout: 15000 });
  } finally {
    assert.equal(dirname(resolve(data)), parent);
    assert.ok(basename(data).startsWith("lfaa-conversation-memory-"));
    rmSync(data, { recursive: true, force: true });
  }
});
