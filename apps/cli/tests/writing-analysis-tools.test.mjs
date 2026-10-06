/**
 * 功能：回归写作长短篇与修订分析工具的归属校验和读取上限。
 * 作用：在临时 SQLite 中验证章节分批、历史正文截断和 Writing App 工具边界。
 * 关联文件：packages/document/writing/src/service.ts、packages/core/tools/src/business-tools.ts、writing-prompt-library.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("章节分析按当前作品读取有界正文，修订分析只读当前章节历史", () => {
  const dataDirectory = mkdtempSync(join(tmpdir(), "lfaa-writing-analysis-"));
  try {
    execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "--input-type=module", "-e", `
      import assert from 'node:assert/strict';
      const { configuration } = await import('lfaa-storage-domain/src/configuration.js');
      const { database, closeDatabase } = await import('lfaa-storage-sqlite/src/database.js');
      const { sessionRecords } = await import('lfaa-session-persistence-jsonl/src/repository.js');
      const { retireLegacyFileTables } = await import('lfaa-storage-domain/src/migration.js');
      retireLegacyFileTables();
      database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('analysis-owner',8401,'analysis-owner','salt','hash','member',0),('analysis-other',8402,'analysis-other','salt','hash','member',0)").run();
      const writing = await import('lfaa-document-writing/src/service.js');
      const { listAiBusinessTools } = await import('lfaa-tools/src/business-tools.js');
      const owner = writing.createWritingBook('analysis-owner', '分析作品');
      const bookId = owner.activeBookId;
      const firstChapterId = owner.activeChapterId;
      const first = writing.getWritingWorkspace('analysis-owner').activeChapter;
      writing.updateWritingChapter('analysis-owner', firstChapterId, { title: first.title, content: '旧'.repeat(13000) });
      writing.updateWritingChapter('analysis-owner', firstChapterId, { title: first.title, content: '新'.repeat(13000) });
      const secondWorkspace = writing.createWritingChapter('analysis-owner', bookId, '第二章');
      const secondChapterId = secondWorkspace.activeChapterId;
      writing.updateWritingChapter('analysis-owner', secondChapterId, { title: '第二章', content: '第二章正文。' });
      const other = writing.createWritingBook('analysis-other', '他人作品');
      assert.equal(writing.listWritingAnalysisChapters('analysis-owner', other.activeBookId, { offset: 0, limit: 40 }), null);
      const page = writing.listWritingAnalysisChapters('analysis-owner', bookId, { offset: 0, limit: 40 });
      assert.equal(page.total, 2);
      assert.equal('body' in page.chapters[0], false);
      const excerpts = writing.getWritingAnalysisChapterExcerpts('analysis-owner', bookId, [firstChapterId, secondChapterId]);
      assert.equal(excerpts.characterCount, 13006);
      assert.equal(excerpts.chapters.reduce((sum, chapter) => sum + chapter.body.length, 0), 12000);
      assert.equal(excerpts.contentTruncated, true);
      assert.equal(writing.getWritingAnalysisChapterExcerpts('analysis-owner', other.activeBookId, [firstChapterId]), null);
      assert.throws(() => writing.getWritingAnalysisChapterExcerpts('analysis-owner', bookId, Array(9).fill(firstChapterId)), /不同章节/);

      const revisions = writing.listWritingChapterRevisionsForAi('analysis-owner', firstChapterId);
      assert.equal(revisions.length, 2);
      assert.equal('content' in revisions[0], false);
      const excerpt = writing.getWritingChapterRevisionForAi('analysis-owner', firstChapterId, revisions[0].id);
      assert.equal(excerpt.content.length, 12000);
      assert.equal(excerpt.contentTruncated, true);
      assert.equal(writing.getWritingChapterRevisionForAi('analysis-other', firstChapterId, revisions[0].id), null);

      const target = { bookId, chapterId: firstChapterId };
      const context = { userId: 'analysis-owner', userRole: 'member', signal: new AbortController().signal, onProgress() {} };
      const tools = listAiBusinessTools('writing', 'member', target);
      const listChapters = tools.find(tool => tool.name === 'writing_list_book_chapters');
      const readChapters = tools.find(tool => tool.name === 'writing_read_book_chapters');
      const listRevisions = tools.find(tool => tool.name === 'writing_list_current_chapter_revisions');
      const readRevision = tools.find(tool => tool.name === 'writing_read_current_chapter_revision');
      assert.ok(listChapters && readChapters && listRevisions && readRevision);
      assert.equal((await listChapters.execute({ offset: 0, limit: 40 }, context)).total, 2);
      assert.equal((await readChapters.execute({ chapterIds: [firstChapterId] }, context)).chapters[0].body.length, 12000);
      assert.equal((await listRevisions.execute({}, context)).revisions.length, 2);
      assert.equal((await readRevision.execute({ revisionId: revisions[0].id }, context)).content.length, 12000);
      assert.equal(listAiBusinessTools('workspace', 'member', target).some(tool => tool.name.includes('book_chapters') || tool.name.includes('chapter_revision')), false);
      assert.equal(listAiBusinessTools('writing', 'member', null).some(tool => tool.name.includes('book_chapters') || tool.name.includes('chapter_revision')), false);
      const { WRITING_PROMPTS } = await import('lfaa-document-writing/src/writing-prompt-library.js');
      for (const id of ['short-manuscript-analysis', 'long-manuscript-analysis', 'revision-analysis', 'style-comparison']) assert.ok(WRITING_PROMPTS.some(prompt => prompt.id === id));

      configuration.close();
      sessionRecords.close();
      closeDatabase();
    `], { cwd: cli, env: { ...process.env, LFAA_DATA_DIR: dataDirectory }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } finally {
    rmSync(dataDirectory, { recursive: true, force: true });
  }
});
