/**
 * 功能：回归 DeepWrite 项目 ZIP 的隔离导入、原生长篇导出和 LFAA 扩展往返。
 * 作用：使用独立 SQLite 验证映射、ZIP 安全边界、失败原子性与当前 Writing Owner。
 * 关联文件：packages/document/writing/src/service.ts、deepwrite-archive.ts、packages/api/writing-controller/src/index.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("DeepWrite ZIP 长篇往返、短篇导入、账户隔离与恶意/损坏 ZIP 原子拒绝", () => {
  const dataDirectory = mkdtempSync(join(tmpdir(), "lfaa-writing-deepwrite-"));
  try {
    execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "--input-type=module", "-e", `
      import assert from 'node:assert/strict';
      import { resolve } from 'node:path';
      import { pathToFileURL } from 'node:url';
      const { configuration } = await import('lfaa-storage-domain/src/configuration.js');
      const { database, closeDatabase } = await import('lfaa-storage-sqlite/src/database.js');
      const { sessionRecords } = await import('lfaa-session-persistence-jsonl/src/repository.js');
      const { retireLegacyFileTables } = await import('lfaa-storage-domain/src/migration.js');
      retireLegacyFileTables();
      database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('zip-owner',8501,'zip-owner','salt','hash','member',0),('zip-other',8502,'zip-other','salt','hash','member',0)").run();
      const writing = await import('lfaa-document-writing/src/service.js');
      const archiveTools = await import('lfaa-document-writing/src/deepwrite-archive.js');
      const ownerWorkspace = writing.createWritingBook('zip-owner', '往返作品');
      const ownerBookId = ownerWorkspace.activeBookId;
      const firstChapterId = ownerWorkspace.activeChapterId;
      assert.ok(ownerBookId && firstChapterId);
      writing.updateWritingBookOutline('zip-owner', ownerBookId, '主角收到一封没有署名的信。');
      writing.updateWritingChapter('zip-owner', firstChapterId, { title: '来信', content: '雨落在窗沿，林岚拆开信封。' });
      const secondVolume = writing.createWritingVolume('zip-owner', ownerBookId, '第二卷');
      const secondVolumeId = secondVolume.volumes.find(volume => volume.title === '第二卷').id;
      const secondWorkspace = writing.createWritingChapter('zip-owner', ownerBookId, '旧钟楼', secondVolumeId);
      writing.updateWritingChapter('zip-owner', secondWorkspace.activeChapterId, { title: '旧钟楼', content: '钟声从空楼深处响起。' });
      writing.updateWritingBookAiRole('zip-owner', ownerBookId, 'continuity-reviewer');
      const skill = writing.createWritingBookSkill('zip-owner', ownerBookId, { title: '人物知情范围', description: '核对线索知情时间。', instructions: '逐章核实角色何时获得每条信息。', enabled: false });
      const catalog = writing.createWritingCatalogEntry('zip-owner', ownerBookId, { kind: 'world-rule', title: '钟楼规则' });
      writing.updateWritingCatalogEntry('zip-owner', catalog.id, { title: '钟楼规则', content: '午夜之后，钟楼不会显示人的影子。' });

      assert.equal(writing.exportWritingBookDeepWriteZip('zip-other', ownerBookId), null);
      const exported = writing.exportWritingBookDeepWriteZip('zip-owner', ownerBookId);
      assert.ok(exported.data.byteLength > 0);
      const files = archiveTools.readDeepWriteZip(exported.data);
      const manifest = JSON.parse(files.get('deepwrite.json'));
      const index = JSON.parse(files.get('long/index.json'));
      const deepwriteRoot = process.env.LFAA_DEEPWRITE_ROOT;
      if (deepwriteRoot) {
        const schemaUrl = relativePath => pathToFileURL(resolve(deepwriteRoot, relativePath)).href;
        const { LongWorkspaceIndexSnapshotSchema } = await import(schemaUrl('packages/contracts/src/long-workspace/index-validation.ts'));
        const { LongProjectManifestSchema } = await import(schemaUrl('packages/contracts/src/long-workspace/book.ts'));
        assert.doesNotThrow(() => LongWorkspaceIndexSnapshotSchema.parse(index));
        assert.doesNotThrow(() => LongProjectManifestSchema.parse(manifest));
      }
      assert.equal(manifest.kind, 'deepwrite.long-book');
      assert.equal(manifest.workspaceIndexFile.path, 'long/index.json');
      assert.equal(index.plot.volumes.length, 2);
      assert.equal(index.plot.chapterCards.length, 2);
      assert.equal(files.get(index.bookLine.path), '主角收到一封没有署名的信。');
      assert.ok(index.chapters.every(chapter => files.has(chapter.body.path)));
      assert.equal(JSON.parse(files.get('lfaa/metadata.json')).aiRoleId, 'continuity-reviewer');

      const beforeImportBooks = database.prepare("SELECT COUNT(*) AS count FROM writing_books WHERE user_id = 'zip-owner'").get().count;
      const roundTrip = writing.importWritingBookDeepWriteZip('zip-owner', exported.data);
      const importedBook = roundTrip.books.find(book => book.id === roundTrip.activeBookId);
      assert.ok(importedBook);
      assert.notEqual(importedBook.id, ownerBookId);
      assert.equal(importedBook.title, '往返作品');
      assert.equal(importedBook.aiRoleId, 'continuity-reviewer');
      assert.equal(roundTrip.activeBookOutline, '主角收到一封没有署名的信。');
      assert.deepEqual(roundTrip.volumes.map(volume => volume.title), ['第一卷', '第二卷']);
      assert.deepEqual(roundTrip.chapters.map(chapter => chapter.title), ['来信', '旧钟楼']);
      assert.deepEqual(roundTrip.catalogEntries.map(entry => entry.title), ['钟楼规则']);
      assert.equal(writing.getWritingBookSkill('zip-owner', roundTrip.activeBookId, writing.listWritingBookSkills('zip-owner', roundTrip.activeBookId)[0].id).enabled, false);
      assert.equal(writing.getWritingBookSkill('zip-other', roundTrip.activeBookId, skill.id), null);
      assert.equal(database.prepare("SELECT COUNT(*) AS count FROM writing_books WHERE user_id = 'zip-owner'").get().count, beforeImportBooks + 1);
      assert.equal(database.prepare("SELECT COUNT(*) AS count FROM writing_chapter_revisions WHERE chapter_id IN (SELECT id FROM writing_chapters WHERE book_id = ?)").get(roundTrip.activeBookId).count, 0);
      assert.equal(database.prepare("SELECT COUNT(*) AS count FROM writing_edit_proposals WHERE book_id = ?").get(roundTrip.activeBookId).count, 0);

      const timestamp = '2026-10-04T00:00:00.000Z';
      const shortManifest = { schemaVersion: 2, revision: 0, kind: 'deepwrite.book', id: 'book_short', title: '短篇导入', bookType: 'short', genre: '悬疑', status: 'editing', linkedMaterialIdsByKind: { character: [], gimmick: [], plot: [], draft: [], other: [] }, linkedSkillIdsByKind: { general: [], plot: [], style: [], other: [] }, documents: [{ id: 'doc_idea', title: '线索资料', path: 'materials/idea.md', createdAt: timestamp, updatedAt: timestamp }], draft: { id: 'draft', title: '章节', sections: [{ id: 'section_one', title: '第一节', wordCountRequirement: '约 500 字', body: { id: 'draft-section:section_one:body', title: '正文', path: 'draft/body.md', createdAt: timestamp, updatedAt: timestamp }, characterState: { id: 'draft-section:section_one:character-state', title: '人物状态', path: 'draft/state.md', createdAt: timestamp, updatedAt: timestamp }, createdAt: timestamp, updatedAt: timestamp }], createdAt: timestamp, updatedAt: timestamp }, createdAt: timestamp, updatedAt: timestamp };
      if (deepwriteRoot) {
        const { BookProjectManifestSchema } = await import(pathToFileURL(resolve(deepwriteRoot, 'packages/contracts/src/catalog/manifests.ts')).href);
        assert.doesNotThrow(() => BookProjectManifestSchema.parse(shortManifest));
      }
      const shortZip = archiveTools.createDeepWriteZip([
        { path: 'deepwrite.json', data: JSON.stringify(shortManifest) },
        { path: 'draft/body.md', data: '短篇的第一节正文。' },
        { path: 'draft/state.md', data: '主角刚刚收到线索。' },
        { path: 'materials/idea.md', data: '真正的线索藏在车票背面。' }
      ]);
      const shortWorkspace = writing.importWritingBookDeepWriteZip('zip-owner', shortZip);
      assert.equal(shortWorkspace.books.find(book => book.id === shortWorkspace.activeBookId).title, '短篇导入');
      assert.equal(shortWorkspace.activeChapter.content, '短篇的第一节正文。');
      const shortMaterials = writing.listWritingCatalogEntries('zip-owner', shortWorkspace.activeBookId, { kind: 'material', offset: 0 });
      assert.ok(shortMaterials.entries.some(entry => entry.title === '线索资料'));
      assert.ok(shortMaterials.entries.some(entry => entry.title === '第一节 · 人物状态'));
      assert.equal(database.prepare("SELECT COUNT(*) AS count FROM writing_chapter_revisions WHERE chapter_id IN (SELECT id FROM writing_chapters WHERE book_id = ?)").get(shortWorkspace.activeBookId).count, 0);

      const booksBeforeInvalid = database.prepare("SELECT COUNT(*) AS count FROM writing_books WHERE user_id = 'zip-owner'").get().count;
      const corrupt = Buffer.from(exported.data);
      const firstNameLength = corrupt.readUInt16LE(26), firstExtraLength = corrupt.readUInt16LE(28);
      corrupt[30 + firstNameLength + firstExtraLength] ^= 0x20;
      assert.throws(() => writing.importWritingBookDeepWriteZip('zip-owner', corrupt), /ZIP|校验|解压/);
      const unsafe = archiveTools.createDeepWriteZip([{ path: 'ab/xx.md', data: '危险路径' }]);
      const unsafeName = Buffer.from('ab/xx.md');
      let nameOffset = 0;
      while ((nameOffset = unsafe.indexOf(unsafeName, nameOffset)) >= 0) { Buffer.from('../xx.md').copy(unsafe, nameOffset); nameOffset += unsafeName.length; }
      assert.throws(() => writing.importWritingBookDeepWriteZip('zip-owner', unsafe), /不安全的项目路径/);
      assert.equal(database.prepare("SELECT COUNT(*) AS count FROM writing_books WHERE user_id = 'zip-owner'").get().count, booksBeforeInvalid);

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
