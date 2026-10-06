/**
 * 功能：验证通用存储枢纽及 JSON/SQLite 插件后端。
 * 作用：在隔离数据目录中覆盖注册、撤销、版本、读写、删除和失败关闭。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function run(dataDirectory, script) {
  execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "--input-type=module", "-e", script], {
    cwd: cli, env: { ...process.env, NODE_ENV: "test", LFAA_DATA_DIR: dataDirectory, JWT_SECRET: "" }, encoding: "utf8", stdio: "pipe"
  });
}

test("存储枢纽按插件注册/撤销具名后端和数据形式", () => {
  const parent = resolve(cli, "../../dist/.tmp");
  mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, "lfaa-storage-hub-registry-"));
  try {
    run(data, `
      import assert from 'node:assert/strict';
      import { Context } from '@deepseek-ai/cordis';
      const context = new Context();
      const fiber = await context.plugin(await import('lfaa-storage-hub/src/index.js'));
      const hub = context.lfaaStorageHub;
      const backend = { async close() {} };
      const dispose = hub.backend.register('memory', backend);
      assert.deepEqual(hub.backend.names(), ['memory']);
      assert.equal(hub.backend.get('memory'), backend);
      assert.throws(() => hub.backend.register('memory', {}), error => error.code === 'duplicate-backend');
      const form = { value: 1 };
      const unmount = hub.mount('test-form', form);
      assert.equal(hub.form('test-form'), form);
      assert.throws(() => hub.mount('test-form', {}), error => error.code === 'duplicate-mount');
      unmount();
      assert.throws(() => hub.form('test-form'), error => error.code === 'form-not-mounted');
      dispose();
      assert.deepEqual(hub.backend.names(), []);
      assert.throws(() => hub.backend.get('missing'), error => error.code === 'backend-not-found');
      await fiber.dispose();
    `);
  } finally { rmSync(data, { recursive: true, force: true }); }
});

test("JSON 与 SQLite 后端按布局持久化、校验版本并随插件卸载", () => {
  const parent = resolve(cli, "../../dist/.tmp");
  mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, "lfaa-storage-hub-backends-"));
  try {
    run(data, `
      import assert from 'node:assert/strict';
      import { Context } from '@deepseek-ai/cordis';
      const { database } = await import('lfaa-storage-sqlite/src/database.js');
      const context = new Context();
      const hubFiber = await context.plugin(await import('lfaa-storage-hub/src/index.js'));
      const jsonFiber = await context.plugin(await import('lfaa-storage-json/src/index.js'));
      const sqliteFiber = await context.plugin(await import('lfaa-storage-sqlite/src/index.js'));
      const sqlite = context.lfaaStorageHub.backend.get('sqlite').kv;
      await assert.rejects(sqlite.open({ name: 'before_migration', version: 1, tables: ['items'], hasGlobal: false }), error => error.code === 'backend-not-ready');
      const { configuration } = await import('lfaa-storage-domain/src/configuration.js');
      const { sessionRecords } = await import('lfaa-session-persistence-jsonl/src/repository.js');
      const { retireLegacyFileTables } = await import('lfaa-storage-domain/src/migration.js');
      retireLegacyFileTables();
      assert.equal(database.prepare('PRAGMA user_version').get().user_version, 47);
      const hub = context.lfaaStorageHub;
      assert.deepEqual(hub.backend.names(), ['json', 'sqlite']);

      const json = hub.backend.get('json').kv;
      const jsonDescriptor = { name: 'test_document', version: 1, tables: ['items'], hasGlobal: true };
      const jsonUnit = await json.open(jsonDescriptor);
      assert.deepEqual(await jsonUnit.loadAll(), { tables: { items: {} }, global: null });
      await jsonUnit.putRecord('items', '__proto__', { payload: 'json' });
      await jsonUnit.setGlobal({ revision: 2 });
      assert.equal((await jsonUnit.loadAll()).tables.items['__proto__'].payload, 'json');
      await assert.rejects(json.open(jsonDescriptor), /已打开/u);
      await jsonUnit.close();
      const restoredJson = await json.open(jsonDescriptor);
      assert.equal((await restoredJson.loadAll()).global.revision, 2);
      await restoredJson.close();
      await assert.rejects(json.open({ ...jsonDescriptor, version: 2 }), error => error.code === 'version-mismatch');

      const jsonRecordUnit = await json.open({ name: 'test_json_records', version: 1, tables: ['items'], hasGlobal: false, layout: 'per-record' });
      await jsonRecordUnit.putRecord('items', 'Item_A', { payload: 'one record per file' });
      assert.equal((await jsonRecordUnit.loadAll()).tables.items.Item_A.payload, 'one record per file');
      await assert.rejects(jsonRecordUnit.putRecord('items', '../escape', {}), error => error.code === 'malformed-medium');
      const backup = await jsonRecordUnit.backupRecord('items', 'Item_A');
      assert.match(backup, /^backup_[0-9a-f]{32}$/u);
      assert.deepEqual((await jsonRecordUnit.loadAll()).tables.items, {});
      await jsonRecordUnit.close();

      const sqliteDescriptor = { name: 'test_records', version: 1, tables: ['entries'], hasGlobal: false, layout: 'per-record' };
      const sqliteUnit = await sqlite.open(sqliteDescriptor);
      await sqliteUnit.putRecord('entries', 'Entry_A', { payload: 'sqlite' });
      assert.equal((await sqliteUnit.loadAll()).tables.entries.Entry_A.payload, 'sqlite');
      await assert.rejects(sqliteUnit.putRecord('entries', '../escape', {}), error => error.code === 'malformed-medium');
      await sqliteUnit.close();
      const restoredSqlite = await sqlite.open(sqliteDescriptor);
      assert.equal((await restoredSqlite.loadAll()).tables.entries.Entry_A.payload, 'sqlite');
      await restoredSqlite.deleteRecord('entries', 'Entry_A');
      assert.deepEqual((await restoredSqlite.loadAll()).tables.entries, {});
      await restoredSqlite.close();

      await jsonFiber.dispose();
      assert.deepEqual(hub.backend.names(), ['sqlite']);
      configuration.close();
      sessionRecords.close();
      await sqliteFiber.dispose();
      assert.deepEqual(hub.backend.names(), []);
      await hubFiber.dispose();
    `);
  } finally { rmSync(data, { recursive: true, force: true }); }
});
