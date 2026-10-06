/**
 * 功能：回归 Writing AI 编辑提案的预览、冲突保护和显式应用边界。
 * 作用：在独立临时 SQLite 数据库中验证提案不会提前改作品，并只通过用户决策应用。
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

test("写作修改必须先审阅；隔离、冲突、修订历史和 full_access 都保留显式应用边界", () => {
  const dataDirectory = mkdtempSync(join(tmpdir(), "lfaa-writing-proposals-"));
  try {
    execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "--input-type=module", "-e", `
      import assert from 'node:assert/strict';
      const { configuration } = await import('lfaa-storage-domain/src/configuration.js');
      const { database, closeDatabase } = await import('lfaa-storage-sqlite/src/database.js');
      const { sessionRecords } = await import('lfaa-session-persistence-jsonl/src/repository.js');
      const { retireLegacyFileTables } = await import('lfaa-storage-domain/src/migration.js');
      retireLegacyFileTables();
      database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('proposal-owner',8201,'proposal-owner','salt','hash','member',0),('proposal-other',8202,'proposal-other','salt','hash','member',0)").run();
      const writing = await import('lfaa-document-writing/src/service.js');
      const { listAiBusinessTools } = await import('lfaa-tools/src/business-tools.js');
      const workspace = writing.createWritingBook('proposal-owner', '提案作品');
      const bookId = workspace.activeBookId;
      assert.ok(bookId);
      const chapterWorkspace = writing.createWritingChapter('proposal-owner', bookId, '第一章');
      const chapterId = chapterWorkspace.activeChapterId;
      assert.ok(chapterId);
      database.prepare("UPDATE writing_books SET outline_content = ? WHERE id = ?").run('原始大纲', bookId);
      database.prepare("UPDATE writing_chapters SET content = ? WHERE id = ?").run('原始正文', chapterId);

      const beforeOutlineProposal = writing.createWritingEditProposal('proposal-owner', bookId, 'outline', bookId, { operation: 'append', content: '新增大纲段落' });
      assert.ok(beforeOutlineProposal);
      assert.equal(database.prepare("SELECT outline_content FROM writing_books WHERE id = ?").get(bookId).outline_content, '原始大纲');
      assert.equal(database.prepare("SELECT COUNT(*) AS count FROM writing_book_outline_revisions WHERE book_id = ?").get(bookId).count, 0);
      assert.equal(writing.getWritingEditProposal('proposal-other', beforeOutlineProposal.id), null);
      const review = writing.getWritingEditProposal('proposal-owner', beforeOutlineProposal.id);
      assert.equal(review.status, 'pending');
      assert.equal(review.baseContent, '原始大纲');
      assert.equal(review.proposedContent, '原始大纲\\n\\n新增大纲段落');
      assert.equal(writing.resolveWritingEditProposal('proposal-other', beforeOutlineProposal.id, 'apply'), null);
      assert.equal(writing.resolveWritingEditProposal('proposal-owner', beforeOutlineProposal.id, 'reject').status, 'rejected');
      assert.equal(database.prepare("SELECT outline_content FROM writing_books WHERE id = ?").get(bookId).outline_content, '原始大纲');
      assert.equal(database.prepare("SELECT COUNT(*) AS count FROM writing_book_outline_revisions WHERE book_id = ?").get(bookId).count, 0);

      const staleProposal = writing.createWritingEditProposal('proposal-owner', bookId, 'outline', bookId, { operation: 'append', content: 'AI 段落' });
      database.prepare("UPDATE writing_books SET outline_content = ? WHERE id = ?").run('用户并发保存的新大纲', bookId);
      assert.equal(writing.getWritingEditProposal('proposal-owner', staleProposal.id).status, 'stale');
      assert.equal(writing.resolveWritingEditProposal('proposal-owner', staleProposal.id, 'apply').status, 'stale');
      assert.equal(database.prepare("SELECT outline_content FROM writing_books WHERE id = ?").get(bookId).outline_content, '用户并发保存的新大纲');
      assert.equal(database.prepare("SELECT COUNT(*) AS count FROM writing_book_outline_revisions WHERE book_id = ?").get(bookId).count, 0);

      const appliedProposal = writing.createWritingEditProposal('proposal-owner', bookId, 'outline', bookId, { operation: 'replace', content: '确认后的新大纲' });
      assert.equal(writing.resolveWritingEditProposal('proposal-owner', appliedProposal.id, 'apply').status, 'applied');
      assert.equal(database.prepare("SELECT outline_content FROM writing_books WHERE id = ?").get(bookId).outline_content, '确认后的新大纲');
      assert.equal(database.prepare("SELECT content FROM writing_book_outline_revisions WHERE book_id = ? ORDER BY rowid DESC LIMIT 1").get(bookId).content, '用户并发保存的新大纲');
      assert.equal(writing.listWritingBookOutlineRevisions('proposal-owner', bookId).length, 1);
      assert.equal(writing.resolveWritingEditProposal('proposal-owner', appliedProposal.id, 'apply').status, 'applied');
      assert.equal(database.prepare("SELECT COUNT(*) AS count FROM writing_book_outline_revisions WHERE book_id = ?").get(bookId).count, 1);

      const expiredProposal = writing.createWritingEditProposal('proposal-owner', bookId, 'outline', bookId, { operation: 'append', content: '过期内容' });
      database.prepare("UPDATE writing_edit_proposals SET expires_at = ? WHERE id = ?").run('2000-01-01T00:00:00.000Z', expiredProposal.id);
      assert.equal(writing.getWritingEditProposal('proposal-owner', expiredProposal.id).status, 'expired');
      assert.equal(writing.resolveWritingEditProposal('proposal-owner', expiredProposal.id, 'apply').status, 'expired');
      assert.equal(database.prepare("SELECT outline_content FROM writing_books WHERE id = ?").get(bookId).outline_content, '确认后的新大纲');

      const oldChapterProposal = writing.createWritingEditProposal('proposal-owner', bookId, 'chapter', chapterId, { operation: 'append', content: '旧提案' });
      const latestChapterProposal = writing.createWritingEditProposal('proposal-owner', bookId, 'chapter', chapterId, { operation: 'append', content: '新提案' });
      assert.equal(writing.getWritingEditProposal('proposal-owner', oldChapterProposal.id).status, 'superseded');
      assert.equal(database.prepare("SELECT content FROM writing_chapters WHERE id = ?").get(chapterId).content, '原始正文');
      assert.equal(writing.resolveWritingEditProposal('proposal-owner', latestChapterProposal.id, 'reject').status, 'rejected');
      assert.equal(database.prepare("SELECT content FROM writing_chapters WHERE id = ?").get(chapterId).content, '原始正文');
      assert.equal(writing.listWritingChapterRevisions('proposal-owner', chapterId).length, 0);

      const context = { userId: 'proposal-owner', userRole: 'member', signal: new AbortController().signal, onProgress() {} };
      const tools = listAiBusinessTools('writing', 'member', { bookId, chapterId }, 'full_access');
      const editTool = tools.find(tool => tool.name === 'writing_propose_book_outline_edit');
      assert.ok(editTool);
      assert.equal(editTool.risk({}), 'read');
      assert.equal(tools.some(tool => tool.name.includes('apply') || tool.name.includes('resolve')), false);
      const toolResult = await editTool.execute(editTool.parse({ bookId, operation: 'append', content: '只生成提案' }), context);
      assert.equal(toolResult.reviewRequired, true);
      assert.equal(database.prepare("SELECT outline_content FROM writing_books WHERE id = ?").get(bookId).outline_content, '确认后的新大纲');
      assert.equal(database.prepare("SELECT COUNT(*) AS count FROM writing_book_outline_revisions WHERE book_id = ?").get(bookId).count, 1);
      assert.equal(writing.getWritingEditProposal('proposal-owner', toolResult.proposalId).status, 'pending');

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
