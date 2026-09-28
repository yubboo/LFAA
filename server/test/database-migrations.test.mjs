/*
 * 功能：验证 LFAA SQLite 版本 8 到 11 的兼容迁移。
 * 作用：在临时数据库中检查缺列和已有列两种旧结构均可升级，并保留授权数据及 Minecraft 租约字段。
 * 关联文件：server/src/database.ts、server/package.json。
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const missingScopeSummary = "旧版本未记录目标范围";

function createVersionEightDatabase(dataDirectory, includeScopeSummary) {
  const databaseDirectory = join(dataDirectory, "database");
  const databasePath = join(databaseDirectory, "lfaa.sqlite");
  mkdirSync(databaseDirectory, { recursive: true });

  const database = new DatabaseSync(databasePath);
  const approvalScopeSummary = includeScopeSummary ? ", scope_summary TEXT" : "";
  const grantScopeSummary = includeScopeSummary
    ? ", scope_summary TEXT NOT NULL CHECK (length(scope_summary) BETWEEN 1 AND 240)"
    : "";

  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE users (id TEXT PRIMARY KEY NOT NULL) STRICT;
    CREATE TABLE ai_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      app_id TEXT NOT NULL
    ) STRICT;
    CREATE TABLE ai_messages (id TEXT PRIMARY KEY NOT NULL, status TEXT NOT NULL) STRICT;
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
    INSERT INTO users (id) VALUES ('legacy-user');
    INSERT INTO ai_sessions (id, user_id, app_id) VALUES ('legacy-session', 'legacy-user', 'minecraft');
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
  database.exec(`
    CREATE TABLE ai_messages (id TEXT PRIMARY KEY NOT NULL, status TEXT NOT NULL);
    CREATE TABLE minecraft_tasks (
      id TEXT PRIMARY KEY NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed'))
    );
    INSERT INTO minecraft_tasks (id, status) VALUES ('running-task', 'running'), ('queued-task', 'queued');
    PRAGMA user_version = 10;
  `);
  database.close();
  return databasePath;
}

function runDatabaseStartup(dataDirectory) {
  execFileSync(process.execPath, [
    "--import", "tsx",
    "--input-type=module",
    "-e", "import { closeDatabase } from './src/database.js'; closeDatabase();"
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
        assert.equal(database.prepare("PRAGMA user_version").get().user_version, 12);
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
        assert.equal(restartedDatabase.prepare("PRAGMA user_version").get().user_version, 12);
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
      assert.equal(database.prepare("PRAGMA user_version").get().user_version, 12);
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
      assert.equal(restartedDatabase.prepare("PRAGMA user_version").get().user_version, 12);
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
