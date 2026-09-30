/*
 * 功能：验证 LFAA SQLite 旧版本数据库升级到当前结构。
 * 作用：在临时数据库中检查历史迁移路径可重复升级到当前版本，并保留既有业务数据。
 * 关联文件：packages/storage/storage-sqlite/src/database.ts、apps/cli/package.json。
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { createHistoricalSchema } from "./helpers/historical-database.mjs";

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const missingScopeSummary = "旧版本未记录目标范围";

function createVersionEightDatabase(dataDirectory, includeScopeSummary) {
  const databaseDirectory = join(dataDirectory, "database");
  const databasePath = join(databaseDirectory, "lfaa.sqlite");
  mkdirSync(databaseDirectory, { recursive: true });

  const database = new DatabaseSync(databasePath);
  createHistoricalSchema(database, 8);
  database.exec("DROP TABLE ai_tool_permission_grants; DROP TABLE ai_tool_approvals;");
  const approvalScopeSummary = includeScopeSummary ? ", scope_summary TEXT" : "";
  const grantScopeSummary = includeScopeSummary
    ? ", scope_summary TEXT NOT NULL CHECK (length(scope_summary) BETWEEN 1 AND 240)"
    : "";

  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE ai_tool_approvals (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_id TEXT NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
      app_id TEXT NOT NULL CHECK (app_id IN ('steamcmd', 'minecraft', 'writing')),
      tool_id TEXT NOT NULL,
      risk TEXT NOT NULL CHECK (risk IN ('read', 'write', 'dangerous')),
      summary TEXT NOT NULL CHECK (length(summary) BETWEEN 1 AND 500),
      action_hash TEXT NOT NULL CHECK (length(action_hash) = 64),
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'consumed', 'expired')),
      requested_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      decided_at TEXT,
      decided_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      expires_at TEXT,
      tool_version TEXT,
      scope_hash TEXT
      ${approvalScopeSummary}
    ) STRICT;
    CREATE INDEX ai_tool_approvals_user_status_idx ON ai_tool_approvals(user_id, status, requested_at DESC);
    CREATE INDEX ai_tool_approvals_expiration_idx ON ai_tool_approvals(status, expires_at);
    CREATE TABLE ai_tool_permission_grants (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      app_id TEXT NOT NULL CHECK (app_id IN ('steamcmd', 'minecraft', 'writing')),
      tool_id TEXT NOT NULL CHECK (length(tool_id) BETWEEN 1 AND 120),
      tool_version TEXT NOT NULL CHECK (length(tool_version) BETWEEN 1 AND 80),
      risk TEXT NOT NULL CHECK (risk IN ('write', 'dangerous')),
      scope_hash TEXT NOT NULL CHECK (length(scope_hash) = 64),
      summary TEXT NOT NULL CHECK (length(summary) BETWEEN 1 AND 500)
      ${grantScopeSummary},
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      UNIQUE (user_id, app_id, tool_id, tool_version, risk, scope_hash)
    ) STRICT;
    CREATE INDEX ai_tool_permission_grants_user_idx ON ai_tool_permission_grants(user_id, created_at DESC);
    PRAGMA user_version = 8;
    INSERT INTO users (id, username, password_salt, password_hash, role) VALUES ('legacy-user', 'legacy-user', 'test-salt', 'test-hash', 'admin');
    INSERT INTO ai_sessions (id, user_id, app_id, title) VALUES ('legacy-session', 'legacy-user', 'minecraft', '长期迁移夹具');
  `);

  const approvalInsert = includeScopeSummary
    ? database.prepare("INSERT INTO ai_tool_approvals (id, user_id, session_id, app_id, tool_id, tool_version, risk, summary, action_hash, status, scope_hash, scope_summary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)")
    : database.prepare("INSERT INTO ai_tool_approvals (id, user_id, session_id, app_id, tool_id, tool_version, risk, summary, action_hash, status, scope_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  approvalInsert.run("legacy-approval", "legacy-user", "legacy-session", "minecraft", "world.backup", "1", "write", "已有审批记录", "a".repeat(64), "denied", "b".repeat(64));

  if (includeScopeSummary) {
    database.prepare("INSERT INTO ai_tool_permission_grants (id, user_id, app_id, tool_id, tool_version, risk, scope_hash, summary, scope_summary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run("legacy-grant", "legacy-user", "minecraft", "world.backup", "1", "write", "c".repeat(64), "已有记忆授权", "保存的授权范围");
  } else {
    database.prepare("INSERT INTO ai_tool_permission_grants (id, user_id, app_id, tool_id, tool_version, risk, scope_hash, summary) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run("legacy-grant", "legacy-user", "minecraft", "world.backup", "1", "write", "c".repeat(64), "已有记忆授权");
  }

  database.close();
  return databasePath;
}

function createVersionTenDatabase(dataDirectory) {
  const databaseDirectory = join(dataDirectory, "database");
  const databasePath = join(databaseDirectory, "lfaa.sqlite");
  mkdirSync(databaseDirectory, { recursive: true });

  const database = new DatabaseSync(databasePath);
  createHistoricalSchema(database, 10);
  database.exec(`
    INSERT INTO users (id, username, password_salt, password_hash, role) VALUES ('fixture-owner', 'fixture-owner', 'test-salt', 'test-hash', 'admin');
    INSERT INTO daemon_nodes (id, display_name, platform, architecture, daemon_version, status, last_seen_at) VALUES ('fixture-node', '长期测试节点', 'win32', 'x64', 'test', 'offline', '2026-09-20T00:00:00.000Z');
    INSERT INTO minecraft_tasks (id, node_id, created_by, kind, status, message, payload_json) VALUES
      ('running-task', 'fixture-node', 'fixture-owner', 'java-install', 'running', '迁移夹具', '{}'),
      ('queued-task', 'fixture-node', 'fixture-owner', 'java-install', 'queued', '迁移夹具', '{}');
  `);
  database.close();
  return databasePath;
}

function createVersionTwentySevenWritingDatabase(dataDirectory) {
  const databaseDirectory = join(dataDirectory, "database");
  const databasePath = join(databaseDirectory, "lfaa.sqlite");
  mkdirSync(databaseDirectory, { recursive: true });

  const database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE users (id TEXT PRIMARY KEY NOT NULL) STRICT;
    CREATE TABLE ai_messages (id TEXT PRIMARY KEY NOT NULL, status TEXT NOT NULL) STRICT;
    CREATE TABLE writing_books (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ) STRICT;
    CREATE INDEX writing_books_user_recent_idx ON writing_books(user_id, updated_at DESC);
    CREATE TABLE writing_chapters (
      id TEXT PRIMARY KEY NOT NULL,
      book_id TEXT NOT NULL REFERENCES writing_books(id) ON DELETE CASCADE,
      title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
      content TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      UNIQUE(book_id, sort_order)
    ) STRICT;
    CREATE INDEX writing_chapters_book_order_idx ON writing_chapters(book_id, sort_order);
    CREATE TABLE writing_chapter_revisions (
      id TEXT PRIMARY KEY NOT NULL,
      chapter_id TEXT NOT NULL REFERENCES writing_chapters(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ) STRICT;
    CREATE INDEX writing_chapter_revisions_recent_idx ON writing_chapter_revisions(chapter_id, created_at DESC);
    CREATE TABLE writing_workspace_state (
      user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      active_book_id TEXT,
      active_chapter_id TEXT,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ) STRICT;

    INSERT INTO users (id) VALUES ('00000000-0000-4000-8000-000000000001');
    INSERT INTO writing_books (id, user_id, title) VALUES ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '旧作品');
    INSERT INTO writing_chapters (id, book_id, title, content, sort_order) VALUES
      ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', '第一章', '旧章节正文 A', 0),
      ('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002', '第二章', '旧章节正文 B', 1);
    INSERT INTO writing_chapter_revisions (id, chapter_id, title, content) VALUES
      ('00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000003', '第一章旧标题', '旧修订正文');
    INSERT INTO writing_workspace_state (user_id, active_book_id, active_chapter_id) VALUES
      ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000004');
    PRAGMA user_version = 27;
  `);
  database.close();
  return databasePath;
}

function runDatabaseStartup(dataDirectory) {
  execFileSync(process.execPath, [
    "--import", "tsx", "--import", "./register-package-loader.mjs",
    "--input-type=module",
    "-e", "import { closeDatabase } from 'lfaa-storage-sqlite/src/database.js'; closeDatabase();"
  ], {
    cwd: serverRoot,
    env: { ...process.env, LFAA_DATA_DIR: dataDirectory, NODE_ENV: "test", JWT_SECRET: "" },
    stdio: "pipe"
  });
}

for (const includeScopeSummary of [false, true]) {
  test(`版本 8 数据库 ${includeScopeSummary ? "已有" : "缺少"}目标范围列时升级并保留记录`, () => {
    const temporaryParent = resolve(tmpdir());
    const dataDirectory = mkdtempSync(join(temporaryParent, "lfaa-db-v12-"));

    try {
      const databasePath = createVersionEightDatabase(dataDirectory, includeScopeSummary);
      runDatabaseStartup(dataDirectory);

      const database = new DatabaseSync(databasePath, { readOnly: true });
      try {
        assert.equal(database.prepare("PRAGMA user_version").get().user_version, 30);
        assert.equal(database.prepare("SELECT COUNT(*) AS count FROM ai_tool_approvals WHERE id = 'legacy-approval'").get().count, 1);
        assert.equal(database.prepare("SELECT COUNT(*) AS count FROM ai_tool_permission_grants WHERE id = 'legacy-grant'").get().count, 1);
        assert.equal(database.prepare("SELECT scope_summary FROM ai_tool_approvals WHERE id = 'legacy-approval'").get().scope_summary, missingScopeSummary);
        assert.equal(
          database.prepare("SELECT scope_summary FROM ai_tool_permission_grants WHERE id = 'legacy-grant'").get().scope_summary,
          includeScopeSummary ? "保存的授权范围" : missingScopeSummary
        );
        assert.equal(database.prepare("SELECT summary FROM ai_tool_permission_grants WHERE id = 'legacy-grant'").get().summary, "已有记忆授权");
        assert.ok(database.prepare("PRAGMA table_info(minecraft_tasks)").all().some((column) => column.name === "lease_expires_at"));
        assert.deepEqual(database.prepare("PRAGMA foreign_key_check").all(), []);
      } finally {
        database.close();
      }

      runDatabaseStartup(dataDirectory);
      const restartedDatabase = new DatabaseSync(databasePath, { readOnly: true });
      try {
        assert.equal(restartedDatabase.prepare("PRAGMA user_version").get().user_version, 30);
        assert.equal(restartedDatabase.prepare("SELECT COUNT(*) AS count FROM ai_tool_permission_grants").get().count, 1);
      } finally {
        restartedDatabase.close();
      }
    } finally {
      const resolvedDataDirectory = resolve(dataDirectory);
      assert.equal(dirname(resolvedDataDirectory), temporaryParent);
      assert.ok(basename(resolvedDataDirectory).startsWith("lfaa-db-v12-"));
      rmSync(resolvedDataDirectory, { recursive: true, force: true });
    }
  });
}

test("版本 10 迁移保留任务并为运行任务设置宽限租约", () => {
  const dataDirectory = mkdtempSync(join(resolve(tmpdir()), "lfaa-db-v10-"));

  try {
    const databasePath = createVersionTenDatabase(dataDirectory);
    runDatabaseStartup(dataDirectory);

    const database = new DatabaseSync(databasePath, { readOnly: true });
    try {
      assert.equal(database.prepare("PRAGMA user_version").get().user_version, 30);
      const runningTask = database.prepare("SELECT status, lease_expires_at FROM minecraft_tasks WHERE id = 'running-task'").get();
      assert.equal(runningTask.status, "running");
      assert.ok(Date.parse(runningTask.lease_expires_at) > Date.now());
      const queuedTask = database.prepare("SELECT status, lease_expires_at FROM minecraft_tasks WHERE id = 'queued-task'").get();
      assert.equal(queuedTask.status, "queued");
      assert.equal(queuedTask.lease_expires_at, null);
      assert.equal(database.prepare("SELECT COUNT(*) AS count FROM minecraft_tasks").get().count, 2);
    } finally {
      database.close();
    }

    runDatabaseStartup(dataDirectory);
    const restartedDatabase = new DatabaseSync(databasePath, { readOnly: true });
    try {
      assert.equal(restartedDatabase.prepare("PRAGMA user_version").get().user_version, 30);
      assert.equal(restartedDatabase.prepare("SELECT COUNT(*) AS count FROM minecraft_tasks").get().count, 2);
    } finally {
      restartedDatabase.close();
    }
  } finally {
    const resolvedDataDirectory = resolve(dataDirectory);
    assert.equal(dirname(resolvedDataDirectory), resolve(tmpdir()));
    assert.ok(basename(resolvedDataDirectory).startsWith("lfaa-db-v10-"));
    rmSync(resolvedDataDirectory, { recursive: true, force: true });
  }
});

test("版本 22 SteamCMD 混合配置迁移后分别保留默认值和节点覆盖", () => {
  const dataDirectory = mkdtempSync(join(resolve(tmpdir()), "lfaa-db-v22-steamcmd-"));

  try {
    const databaseDirectory = join(dataDirectory, "database");
    const databasePath = join(databaseDirectory, "lfaa.sqlite");
    mkdirSync(databaseDirectory, { recursive: true });
    const database = new DatabaseSync(databasePath);
    createHistoricalSchema(database, 22);
    database.exec(`
      INSERT INTO daemon_nodes (id, display_name, platform, architecture, daemon_version, status, last_seen_at) VALUES ('node-a', '长期测试节点', 'win32', 'x64', 'test', 'offline', '2026-09-20T00:00:00.000Z');
      INSERT INTO steamcmd_settings_defaults VALUES (1, 'online', 'lib/steamcmd', 'games/default', '2026-09-20T00:00:00.000Z');
      INSERT INTO steamcmd_node_settings VALUES ('node-a', 'manual', 'tools/custom-steamcmd', 'games/node-a', '2026-09-21T00:00:00.000Z');
      PRAGMA user_version = 22;
    `);
    database.close();

    runDatabaseStartup(dataDirectory);

    const migratedDatabase = new DatabaseSync(databasePath, { readOnly: true });
    try {
      assert.equal(migratedDatabase.prepare("PRAGMA user_version").get().user_version, 30);
      assert.deepEqual(
        { ...migratedDatabase.prepare("SELECT install_mode, steamcmd_directory FROM steamcmd_configuration_defaults").get() },
        { install_mode: "online", steamcmd_directory: "lib/steamcmd" }
      );
      assert.deepEqual(
        { ...migratedDatabase.prepare("SELECT game_directory FROM steamcmd_storage_defaults").get() },
        { game_directory: "games/default" }
      );
      assert.deepEqual(
        { ...migratedDatabase.prepare("SELECT install_mode, steamcmd_directory FROM steamcmd_configuration_node_settings WHERE node_id = 'node-a'").get() },
        { install_mode: "manual", steamcmd_directory: "tools/custom-steamcmd" }
      );
      assert.deepEqual(
        { ...migratedDatabase.prepare("SELECT game_directory FROM steamcmd_storage_node_settings WHERE node_id = 'node-a'").get() },
        { game_directory: "games/node-a" }
      );
      assert.deepEqual(migratedDatabase.prepare("PRAGMA foreign_key_check").all(), []);
      assert.equal(migratedDatabase.prepare("SELECT name FROM sqlite_master WHERE name = 'steamcmd_settings_defaults'").get(), undefined);
    } finally {
      migratedDatabase.close();
    }
  } finally {
    const resolvedDataDirectory = resolve(dataDirectory);
    assert.equal(dirname(resolvedDataDirectory), resolve(tmpdir()));
    assert.ok(basename(resolvedDataDirectory).startsWith("lfaa-db-v22-steamcmd-"));
    rmSync(resolvedDataDirectory, { recursive: true, force: true });
  }
});

test("版本 27 写作作品迁移后保留内容并归入第一卷，重复启动不重复创建卷", () => {
  const dataDirectory = mkdtempSync(join(resolve(tmpdir()), "lfaa-db-v27-writing-"));

  try {
    const databasePath = createVersionTwentySevenWritingDatabase(dataDirectory);
    runDatabaseStartup(dataDirectory);

    const database = new DatabaseSync(databasePath, { readOnly: true });
    let firstVolumeId;
    try {
      assert.equal(database.prepare("PRAGMA user_version").get().user_version, 30);
      const migratedVolume = database.prepare("SELECT title, sort_order FROM writing_volumes WHERE book_id = '00000000-0000-4000-8000-000000000002'").get();
      assert.equal(migratedVolume.title, "第一卷");
      assert.equal(migratedVolume.sort_order, 0);
      firstVolumeId = database.prepare("SELECT id FROM writing_volumes WHERE book_id = '00000000-0000-4000-8000-000000000002'").get().id;
      assert.match(firstVolumeId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/i);
      assert.deepEqual(
        database.prepare("SELECT id, title, content, sort_order, volume_id FROM writing_chapters ORDER BY sort_order").all().map((row) => ({ ...row })),
        [
          { id: "00000000-0000-4000-8000-000000000003", title: "第一章", content: "旧章节正文 A", sort_order: 0, volume_id: firstVolumeId },
          { id: "00000000-0000-4000-8000-000000000004", title: "第二章", content: "旧章节正文 B", sort_order: 1, volume_id: firstVolumeId }
        ]
      );
      assert.deepEqual(
        { ...database.prepare("SELECT title, content FROM writing_chapter_revisions WHERE chapter_id = '00000000-0000-4000-8000-000000000003'").get() },
        { title: "第一章旧标题", content: "旧修订正文" }
      );
      assert.deepEqual(
        { ...database.prepare("SELECT active_book_id, active_chapter_id FROM writing_workspace_state WHERE user_id = '00000000-0000-4000-8000-000000000001'").get() },
        { active_book_id: "00000000-0000-4000-8000-000000000002", active_chapter_id: "00000000-0000-4000-8000-000000000004" }
      );
      assert.deepEqual(database.prepare("PRAGMA foreign_key_check").all(), []);
    } finally {
      database.close();
    }

    runDatabaseStartup(dataDirectory);
    const restartedDatabase = new DatabaseSync(databasePath);
    try {
      assert.equal(restartedDatabase.prepare("SELECT COUNT(*) AS count FROM writing_volumes WHERE book_id = '00000000-0000-4000-8000-000000000002'").get().count, 1);
      assert.equal(restartedDatabase.prepare("SELECT volume_id FROM writing_chapters WHERE id = '00000000-0000-4000-8000-000000000004'").get().volume_id, firstVolumeId);
      restartedDatabase.exec("PRAGMA foreign_keys = ON");
      assert.doesNotThrow(() => restartedDatabase.prepare("DELETE FROM writing_books WHERE id = '00000000-0000-4000-8000-000000000002'").run());
      assert.equal(restartedDatabase.prepare("SELECT COUNT(*) AS count FROM writing_chapters WHERE book_id = '00000000-0000-4000-8000-000000000002'").get().count, 0);
    } finally {
      restartedDatabase.close();
    }
  } finally {
    const resolvedDataDirectory = resolve(dataDirectory);
    assert.equal(dirname(resolvedDataDirectory), resolve(tmpdir()));
    assert.ok(basename(resolvedDataDirectory).startsWith("lfaa-db-v27-writing-"));
    rmSync(resolvedDataDirectory, { recursive: true, force: true });
  }
});
