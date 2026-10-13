/**
 * 功能：回归 Writing 作品正文迁移到账户隔离的本机文件。
 * 作用：验证迁移校验、SQLite 正文清空、文件读写、提案保留和缺失文件失败关闭。
 * 关联文件：packages/document/writing/src/local-files.ts、service.ts、storage-sqlite/src/database.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("Writing 旧正文经回读校验迁移到本机文件，提案仍在 SQLite", () => {
  const dataDirectory = mkdtempSync(join(tmpdir(), "lfaa-writing-local-files-"));
  try {
    execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "--input-type=module", "-e", `
      import assert from 'node:assert/strict';
      import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
      import { join } from 'node:path';
      const { configuration } = await import('lfaa-storage-domain/src/configuration.js');
      const { config } = await import('lfaa-launch-environment/src/config.js');
      const { database, closeDatabase } = await import('lfaa-storage-sqlite/src/database.js');
      const { sessionRecords } = await import('lfaa-session-persistence-jsonl/src/repository.js');
      const { retireLegacyFileTables } = await import('lfaa-storage-domain/src/migration.js');
      retireLegacyFileTables();
      database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('local-owner',8401,'local-owner','salt','hash','member',0),('local-other',8402,'local-other','salt','hash','member',0)").run();
      const writing = await import('lfaa-document-writing/src/service.js');
      const local = await import('lfaa-document-writing/src/local-files.js');
      const { resolveUserDataPaths } = await import('lfaa-home-paths/src/data-layout.mjs');
      const workspace = writing.createWritingBook('local-owner', '本地文件作品');
      const bookId = workspace.activeBookId;
      const chapterId = workspace.activeChapterId;
      assert.ok(bookId && chapterId);
      const bookDirectory = join(resolveUserDataPaths(config.dataDirectory, 'local-owner').projects, 'writing', bookId);
      writing.updateWritingBookOutline('local-owner', bookId, '旧大纲正文');
      writing.updateWritingChapter('local-owner', chapterId, { title: '第一章', content: '旧章节正文' });
      const catalog = writing.createWritingCatalogEntry('local-owner', bookId, { kind: 'material', title: '旧资料' });
      writing.updateWritingCatalogEntry('local-owner', catalog.id, { title: '旧资料', content: '旧资料正文' });
      const skill = writing.createWritingBookSkill('local-owner', bookId, { title: '旧 Skill', instructions: '旧 Skill 指令' });
      const outlineRevision = database.prepare('SELECT id FROM writing_book_outline_revisions WHERE book_id = ?').get(bookId);
      const chapterRevision = database.prepare('SELECT id FROM writing_chapter_revisions WHERE chapter_id = ?').get(chapterId);
      assert.ok(outlineRevision && chapterRevision);

      local.removeWritingProjectFiles('local-owner', bookId);
      database.prepare('DELETE FROM writing_local_file_migrations WHERE book_id = ?').run(bookId);
      database.prepare('UPDATE writing_books SET outline_content = ? WHERE id = ?').run('迁移大纲', bookId);
      database.prepare('UPDATE writing_chapters SET content = ? WHERE id = ?').run('迁移章节', chapterId);
      database.prepare('UPDATE writing_catalog_entries SET content = ? WHERE id = ?').run('迁移资料', catalog.id);
      database.prepare('UPDATE writing_book_skills SET instructions = ? WHERE id = ?').run('迁移 Skill', skill.id);
      database.prepare('UPDATE writing_book_outline_revisions SET content = ? WHERE id = ?').run('迁移大纲修订', outlineRevision.id);
      database.prepare('UPDATE writing_chapter_revisions SET content = ? WHERE id = ?').run('迁移章节修订', chapterRevision.id);
      mkdirSync(bookDirectory, { recursive: true });
      writeFileSync(join(bookDirectory, 'project.json'), JSON.stringify({ format: 'wrong-owner' }));
      assert.throws(() => local.migrateWritingContentToLocalFiles(), /清单与当前格式不匹配/);
      assert.equal(database.prepare('SELECT outline_content FROM writing_books WHERE id = ?').get(bookId).outline_content, '迁移大纲');
      assert.equal(database.prepare('SELECT instructions FROM writing_book_skills WHERE id = ?').get(skill.id).instructions, '迁移 Skill');
      rmSync(bookDirectory, { recursive: true, force: true });
      local.migrateWritingContentToLocalFiles();

      assert.equal(JSON.parse(readFileSync(join(bookDirectory, 'project.json'), 'utf8')).bookId, bookId);
      assert.equal(readFileSync(join(bookDirectory, 'outline.md'), 'utf8'), '迁移大纲');
      assert.equal(readFileSync(join(bookDirectory, 'chapters', chapterId + '.md'), 'utf8'), '迁移章节');
      assert.equal(readFileSync(join(bookDirectory, 'catalog', catalog.id + '.md'), 'utf8'), '迁移资料');
      assert.equal(readFileSync(join(bookDirectory, 'skills', skill.id + '.md'), 'utf8'), '迁移 Skill');
      assert.equal(local.readWritingLocalText('local-owner', bookId, { kind: 'outline-revision', id: outlineRevision.id }), '迁移大纲修订');
      assert.equal(local.readWritingLocalText('local-owner', bookId, { kind: 'chapter-revision', chapterId, id: chapterRevision.id }), '迁移章节修订');
      assert.equal(database.prepare('SELECT outline_content FROM writing_books WHERE id = ?').get(bookId).outline_content, '');
      assert.equal(database.prepare('SELECT content FROM writing_chapters WHERE id = ?').get(chapterId).content, '');
      assert.equal(database.prepare('SELECT content FROM writing_catalog_entries WHERE id = ?').get(catalog.id).content, '');
      assert.equal(database.prepare('SELECT instructions FROM writing_book_skills WHERE id = ?').get(skill.id).instructions, 'lfaa-local-file-v1');
      assert.equal(database.prepare('SELECT content FROM writing_chapter_revisions WHERE id = ?').get(chapterRevision.id).content, '');
      assert.equal(database.prepare('SELECT content FROM writing_book_outline_revisions WHERE id = ?').get(outlineRevision.id).content, '');
      assert.equal(database.prepare('SELECT content_count FROM writing_local_file_migrations WHERE book_id = ?').get(bookId).content_count, 6);
      assert.equal(writing.getWritingWorkspace('local-owner').activeBookOutline, '迁移大纲');
      assert.equal(writing.getWritingWorkspace('local-owner').activeChapter.content, '迁移章节');
      assert.equal(writing.getWritingBookSkill('local-owner', bookId, skill.id).instructions, '迁移 Skill');
      assert.equal(writing.listWritingChapterRevisions('local-owner', chapterId)[0].wordCount, 6);

      const proposal = writing.createWritingEditProposal('local-owner', bookId, 'outline', bookId, { operation: 'append', content: '待审提案' });
      assert.equal(database.prepare('SELECT proposed_content FROM writing_edit_proposals WHERE id = ?').get(proposal.id).proposed_content, '迁移大纲\\n\\n待审提案');
      const otherBook = writing.createWritingBook('local-other', '另一账户作品');
      const otherDirectory = join(resolveUserDataPaths(config.dataDirectory, 'local-other').projects, 'writing', otherBook.activeBookId);
      assert.notEqual(otherDirectory, bookDirectory);

      rmSync(join(bookDirectory, 'chapters', chapterId + '.md'));
      assert.throws(() => writing.getWritingWorkspace('local-owner'), /本地作品文件缺失或损坏/);
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
