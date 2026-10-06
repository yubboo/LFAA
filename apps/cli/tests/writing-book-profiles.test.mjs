/**
 * 功能：回归作品专职角色与作品 Skills 的隔离、边界和 AI 按需读取。
 * 作用：在独立临时 SQLite 中验证迁移、角色绑定、Skill 限额及当前作品工具范围。
 * 关联文件：packages/document/writing/src/service.ts、packages/core/tools/src/business-tools.ts、packages/storage/storage-sqlite/src/database.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("作品角色与 Skills 只作用于当前账户和当前作品，并由模型按需只读", () => {
  const dataDirectory = mkdtempSync(join(tmpdir(), "lfaa-writing-profiles-"));
  try {
    execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "--input-type=module", "-e", `
      import assert from 'node:assert/strict';
      const { configuration } = await import('lfaa-storage-domain/src/configuration.js');
      const { database, closeDatabase } = await import('lfaa-storage-sqlite/src/database.js');
      const { sessionRecords } = await import('lfaa-session-persistence-jsonl/src/repository.js');
      const { retireLegacyFileTables } = await import('lfaa-storage-domain/src/migration.js');
      retireLegacyFileTables();
        assert.equal(database.prepare('PRAGMA user_version').get().user_version, 47);
      database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('profile-owner',8301,'profile-owner','salt','hash','member',0),('profile-other',8302,'profile-other','salt','hash','member',0)").run();
      const writing = await import('lfaa-document-writing/src/service.js');
      const { listAiBusinessTools } = await import('lfaa-tools/src/business-tools.js');
      const ownerBook = writing.createWritingBook('profile-owner', '角色作品');
      const ownerBookId = ownerBook.activeBookId;
      assert.ok(ownerBookId);
      assert.equal(ownerBook.books[0].aiRoleId, 'writing-companion');
      const otherBook = writing.createWritingBook('profile-owner', '另一本作品');
      const otherBookId = otherBook.activeBookId;
      const foreignBook = writing.createWritingBook('profile-other', '其他账户作品');
      const roleWorkspace = writing.updateWritingBookAiRole('profile-owner', ownerBookId, 'continuity-reviewer');
      assert.equal(roleWorkspace.books.find(book => book.id === ownerBookId).aiRoleId, 'continuity-reviewer');
      writing.setActiveWritingLocation('profile-owner', ownerBookId, null);
      assert.equal(writing.getActiveWritingAiContext('profile-owner').aiRoleId, 'continuity-reviewer');
      assert.throws(() => writing.updateWritingBookAiRole('profile-owner', ownerBookId, 'fake-role'), /有效的写作专职角色/);
      assert.equal(writing.listWritingBookSkills('profile-owner', foreignBook.activeBookId), null);

      const skill = writing.createWritingBookSkill('profile-owner', ownerBookId, { title: '检查人物知情范围', description: '排查人物是否知道某条秘密。', instructions: '逐个核对秘密首次披露时间与人物在场信息。' });
      assert.equal(skill.enabled, true);
      assert.equal(writing.getWritingBookSkill('profile-other', ownerBookId, skill.id), null);
      assert.equal(writing.getWritingBookSkill('profile-owner', otherBookId, skill.id), null);
      assert.deepEqual(writing.listWritingBookSkills('profile-owner', ownerBookId).map(item => item.id), [skill.id]);
      assert.deepEqual(writing.getWritingWorkspace('profile-owner').bookSkills.map(item => item.id), [skill.id]);
      assert.throws(() => writing.createWritingBookSkill('profile-owner', ownerBookId, { title: '超长方法', instructions: 'x'.repeat(12001) }), /超出有效范围/);

      const target = { bookId: ownerBookId, chapterId: null };
      const context = { userId: 'profile-owner', userRole: 'member', signal: new AbortController().signal, onProgress() {} };
      const tools = listAiBusinessTools('writing', 'member', target);
      const listTool = tools.find(tool => tool.name === 'writing_list_book_skills');
      const readTool = tools.find(tool => tool.name === 'writing_read_book_skill');
      assert.ok(listTool && readTool);
      assert.equal(listTool.risk({}), 'read');
      assert.equal(readTool.risk({}), 'read');
      const listed = await listTool.execute({}, context);
      assert.deepEqual(listed.skills.map(item => item.id), [skill.id]);
      const read = await readTool.execute({ skillId: skill.id }, context);
      assert.equal(read.instructions, skill.instructions);
      assert.equal(read.trust, 'untrusted');
      assert.equal((await listAiBusinessTools('workspace', 'member', target)).some(tool => tool.name.includes('book_skill')), false);
      const otherBookTools = listAiBusinessTools('writing', 'member', { bookId: otherBookId, chapterId: null });
      const otherBookList = await otherBookTools.find(tool => tool.name === 'writing_list_book_skills').execute({}, context);
      assert.deepEqual(otherBookList.skills, []);
      await assert.rejects(otherBookTools.find(tool => tool.name === 'writing_read_book_skill').execute({ skillId: skill.id }, context), /当前作品/);

      const disabled = writing.updateWritingBookSkill('profile-owner', ownerBookId, skill.id, { title: skill.title, description: skill.description, instructions: skill.instructions, enabled: false });
      assert.equal(disabled.enabled, false);
      assert.deepEqual((await listTool.execute({}, context)).skills, []);
      await assert.rejects(readTool.execute({ skillId: skill.id }, context), /已启用/);
      const updated = writing.updateWritingBookSkill('profile-owner', ownerBookId, skill.id, { title: '改名', description: '新说明', instructions: '更精确的方法。', enabled: true });
      assert.equal(updated.title, '改名');
      assert.equal(writing.deleteWritingBookSkill('profile-other', ownerBookId, skill.id), false);
      assert.equal(writing.deleteWritingBookSkill('profile-owner', ownerBookId, skill.id), true);
      assert.equal(writing.getWritingBookSkill('profile-owner', ownerBookId, skill.id), null);
      for (let index = 0; index < 40; index += 1) writing.createWritingBookSkill('profile-owner', ownerBookId, { title: '容量项 ' + index, instructions: '专属写作方法。' });
      assert.equal(writing.listWritingBookSkills('profile-owner', ownerBookId).length, 40);
      assert.throws(() => writing.createWritingBookSkill('profile-owner', ownerBookId, { title: '第 41 项', instructions: '超出上限。' }), /最多保存 40 个/);

      configuration.close();
      sessionRecords.close();
      closeDatabase();
    `], {
      cwd: cli,
      env: { ...process.env, LFAA_DATA_DIR: dataDirectory },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
  } finally {
    rmSync(dataDirectory, { recursive: true, force: true });
  }
});
