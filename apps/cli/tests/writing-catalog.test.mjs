/**
 * 功能：回归作品资料目录的有界分页、账户作品隔离和 AI 只读上下文。
 * 作用：在独立临时 SQLite 数据库中验证 Service 与 Core Tools 共用真实写作 Owner。
 * 关联文件：packages/document/writing/src/service.ts、packages/core/tools/src/business-tools.ts、packages/api/writing-controller/src/index.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("作品资料列表有界分页、按当前账户作品读取且 AI 上下文只读并截断", () => {
  const dataDirectory = mkdtempSync(join(tmpdir(), "lfaa-writing-catalog-"));
  try {
    execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "--input-type=module", "-e", `
      import assert from 'node:assert/strict';
      const { configuration } = await import('lfaa-storage-domain/src/configuration.js');
      const { database, closeDatabase } = await import('lfaa-storage-sqlite/src/database.js');
      const { sessionRecords } = await import('lfaa-session-persistence-jsonl/src/repository.js');
      const { retireLegacyFileTables } = await import('lfaa-storage-domain/src/migration.js');
      retireLegacyFileTables();
      database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('catalog-owner',8101,'catalog-owner','salt','hash','member',0),('catalog-other',8102,'catalog-other','salt','hash','member',0)").run();
      const writing = await import('lfaa-document-writing/src/service.js');
      const { listAiBusinessTools } = await import('lfaa-tools/src/business-tools.js');
      const ownerWorkspace = writing.createWritingBook('catalog-owner', '资料作品');
      const otherWorkspace = writing.createWritingBook('catalog-other', '其他作品');
      const ownerBookId = ownerWorkspace.activeBookId;
      const otherBookId = otherWorkspace.activeBookId;
      const createdEntries = [];
      for (let index = 0; index < 45; index += 1) {
        const entry = writing.createWritingCatalogEntry('catalog-owner', ownerBookId, { kind: index % 2 ? 'world-rule' : 'character-major', title: index === 0 ? '主角资料' : '资料 ' + index });
        if (index === 0) writing.updateWritingCatalogEntry('catalog-owner', entry.id, { title: entry.title, content: '汉'.repeat(12005) });
        else writing.updateWritingCatalogEntry('catalog-owner', entry.id, { title: entry.title, content: '内容 ' + index });
        createdEntries.push(entry);
      }
      const firstPage = writing.listWritingCatalogEntries('catalog-owner', ownerBookId, { offset: 0 });
      assert.equal(firstPage.entries.length, 40);
      assert.equal(firstPage.total, 45);
      assert.equal('content' in firstPage.entries[0], false);
      assert.equal('wordCount' in firstPage.entries[0], false);
      assert.equal(writing.listWritingCatalogEntries('catalog-other', ownerBookId, { offset: 0 }), null);
      const secondPage = writing.listWritingCatalogEntries('catalog-owner', ownerBookId, { kind: 'world-rule', offset: 0, search: '资料 1' });
      assert.ok(secondPage.entries.length > 0 && secondPage.entries.length <= 40);
      assert.ok(secondPage.entries.every(entry => entry.kind === 'world-rule' && entry.title.includes('资料 1')));
      const excerpt = writing.getWritingCatalogEntryForBook('catalog-owner', ownerBookId, createdEntries[0].id);
      assert.equal(excerpt.content.length, 12000);
      assert.equal(excerpt.characterCount, 12005);
      assert.equal(excerpt.contentTruncated, true);
      assert.equal(writing.getWritingCatalogEntryForBook('catalog-owner', ownerBookId, createdEntries[44].id).contentTruncated, false);
      assert.equal(writing.getWritingCatalogEntryForBook('catalog-owner', ownerBookId, createdEntries[44].id).id, createdEntries[44].id);
      assert.equal(writing.getWritingCatalogEntryForBook('catalog-owner', ownerBookId, writing.createWritingCatalogEntry('catalog-other', otherBookId, { kind: 'world-rule', title: '外部作品' }).id), null);
      const projectedWorkspace = writing.getWritingWorkspace('catalog-owner');
      assert.equal(projectedWorkspace.catalogEntries.length, 40);
      assert.equal(projectedWorkspace.catalogEntriesHasMore, true);
      assert.equal('content' in projectedWorkspace.catalogEntries[0], false);
      const context = { userId: 'catalog-owner', userRole: 'member', applicationId: 'writing', signal: new AbortController().signal, onProgress() {} };
      const tools = listAiBusinessTools('writing', 'member', { bookId: ownerBookId, chapterId: null });
      const listTool = tools.find(tool => tool.name === 'writing_list_catalog_entries');
      const readTool = tools.find(tool => tool.name === 'writing_read_catalog_entry');
      assert.ok(listTool && readTool);
      assert.equal(listTool.risk({}), 'read');
      const aiList = await listTool.execute(listTool.parse({ titleSearch: '主角' }), context);
      assert.equal(aiList.readOnly, true);
      assert.equal(aiList.trust, 'untrusted');
      assert.ok(aiList.entries.length <= 40);
      const aiExcerpt = await readTool.execute(readTool.parse({ entryId: createdEntries[0].id }), context);
      assert.equal(aiExcerpt.content.length, 12000);
      assert.equal(aiExcerpt.contentTruncated, true);
      assert.equal(aiExcerpt.trust, 'untrusted');
      await assert.rejects(() => readTool.execute(readTool.parse({ entryId: createdEntries[0].id }), { ...context, userId: 'catalog-other' }), /找不到本轮当前作品/u);
      await assert.rejects(() => readTool.execute(readTool.parse({ entryId: writing.createWritingCatalogEntry('catalog-other', otherBookId, { kind: 'world-rule', title: '跨作品条目' }).id }), context), /找不到本轮当前作品/u);
      assert.equal(listAiBusinessTools('writing', 'member', null).some(tool => tool.name === 'writing_list_catalog_entries'), false);
      assert.equal(listAiBusinessTools('minecraft', 'member', { bookId: ownerBookId, chapterId: null }).some(tool => tool.name.startsWith('writing_')), false);
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
