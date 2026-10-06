/**
 * 文件：database.ts
 * 功能：打开控制端 SQLite 数据库并依次执行结构迁移。
 * 作用：持久化账户、身份权限、节点、应用任务及按记录存储的结构化配置；会话事件继续由 JSONL 负责。
 * 关联文件：packages/util/launch-environment/src/config.ts、packages/identity/auth/src/service.ts、packages/identity/auth/src/passkeys.ts、packages/settings/settings/src/preferences/service.ts、packages/settings/settings/src/service.ts、packages/fs/fs/src/queue.ts、packages/games/steamcmd/src/service.ts。
 * 修改注意事项：迁移必须按版本递增并保持可重复启动；不得删除用户数据来绕过迁移。
 */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "lfaa-launch-environment/src/config.js";

mkdirSync(dirname(config.databasePath), { recursive: true });

export const database = new DatabaseSync(config.databasePath, { timeout: 5000 });

database.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");

const versionRow = database.prepare("PRAGMA user_version").get() as { user_version: number | bigint };
const currentVersion = Number(versionRow.user_version);

// 版本 8 曾以相同版本号发布过缺少目标范围说明的表结构；只检查固定表名以兼容两种版本 8 数据库。
function hasColumn(tableName: "ai_tool_approvals" | "ai_tool_permission_grants", columnName: "scope_summary"): boolean {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return columns.some((column) => column.name === columnName);
}

// 版本31由文件存储协调器在回读校验完成后提交，SQLite 保留账户、权限和任务。
const latestSupportedDatabaseVersion = 47;
if (currentVersion > latestSupportedDatabaseVersion) {
  throw new Error(`数据库版本 ${currentVersion} 高于当前程序支持的版本 ${latestSupportedDatabaseVersion}（${config.databasePath}）。请使用更新版本的 LFAA；为保护数据，本程序不会自动降级数据库结构。`);
}

if (currentVersion < 1) {
  database.exec("BEGIN IMMEDIATE;");

  try {
    database.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY NOT NULL,
        username TEXT NOT NULL COLLATE NOCASE UNIQUE,
        password_salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;

      CREATE TABLE sessions (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;

      CREATE INDEX sessions_expiration_idx ON sessions(expires_at);

      CREATE TABLE user_preferences (
        user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        selected_app TEXT NOT NULL CHECK (selected_app IN ('steamcmd', 'minecraft', 'writing')),
        selected_mode TEXT NOT NULL CHECK (selected_mode IN ('normal', 'ai-work')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;

      PRAGMA user_version = 1;
    `);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

if (currentVersion < 2) {
  database.exec("BEGIN IMMEDIATE;");

  try {
    database.exec(`
      CREATE TABLE user_settings (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category TEXT NOT NULL CHECK (category IN ('general', 'appearance', 'shortcuts')),
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        PRIMARY KEY (user_id, category)
      ) STRICT;

      CREATE TABLE ai_accounts (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        options_json TEXT NOT NULL,
        model_id TEXT NOT NULL,
        models_json TEXT NOT NULL,
        secret_ciphertext TEXT NOT NULL,
        secret_iv TEXT NOT NULL,
        secret_tag TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE (user_id, display_name)
      ) STRICT;

      CREATE TABLE appearance_backgrounds (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
        image_data BLOB NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        PRIMARY KEY (user_id, id)
      ) STRICT;

      CREATE INDEX ai_accounts_user_idx ON ai_accounts(user_id, created_at);
      CREATE UNIQUE INDEX ai_accounts_one_active_idx ON ai_accounts(user_id) WHERE is_active = 1;
      PRAGMA user_version = 2;
    `);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

if (currentVersion < 3) {
  database.exec("BEGIN IMMEDIATE;");

  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS appearance_backgrounds (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
        image_data BLOB NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        PRIMARY KEY (user_id, id)
      ) STRICT;

      PRAGMA user_version = 3;
    `);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

if (currentVersion < 4) {
  database.exec("BEGIN IMMEDIATE;");

  try {
    database.exec(`
      ALTER TABLE users ADD COLUMN recovery_key_salt TEXT;
      ALTER TABLE users ADD COLUMN recovery_key_hash TEXT;
      PRAGMA user_version = 4;
    `);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

if (currentVersion < 5) {
  database.exec("BEGIN IMMEDIATE;");

  try {
    database.exec(`
      ALTER TABLE user_settings RENAME TO user_settings_v4;
      CREATE TABLE user_settings (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category TEXT NOT NULL CHECK (category IN ('general', 'appearance', 'shortcuts', 'ai-runtime', 'permissions', 'plugins')),
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        PRIMARY KEY (user_id, category)
      ) STRICT;

      CREATE TABLE ai_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        app_id TEXT NOT NULL CHECK (app_id IN ('steamcmd', 'minecraft', 'writing')),
        title TEXT NOT NULL,
        archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;

      CREATE TABLE ai_messages (
        id TEXT PRIMARY KEY NOT NULL,
        session_id TEXT NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'complete' CHECK (status IN ('complete', 'streaming', 'interrupted', 'error')),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;

      CREATE TABLE ai_usage (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_id TEXT NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
        message_id TEXT NOT NULL REFERENCES ai_messages(id) ON DELETE CASCADE,
        provider_id TEXT NOT NULL,
        model_id TEXT NOT NULL,
        prompt_tokens INTEGER,
        completion_tokens INTEGER,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;

      CREATE INDEX ai_sessions_user_recent_idx ON ai_sessions(user_id, archived, updated_at DESC);
      CREATE INDEX ai_messages_session_idx ON ai_messages(session_id, created_at);
      CREATE INDEX ai_usage_user_recent_idx ON ai_usage(user_id, created_at DESC);
    `);

    const rows = database.prepare("SELECT user_id, category, value_json, updated_at FROM user_settings_v4").all() as Array<{ user_id: string; category: string; value_json: string; updated_at: string }>;
    const insert = database.prepare("INSERT INTO user_settings (user_id, category, value_json, updated_at) VALUES (?, ?, ?, ?)");
    for (const row of rows) {
      let value: Record<string, unknown>;
      try {
        const parsed: unknown = JSON.parse(row.value_json);
        value = typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
      } catch {
        value = {};
      }

      if (row.category !== "general") {
        if (["appearance", "shortcuts"].includes(row.category)) insert.run(row.user_id, row.category, JSON.stringify(value), row.updated_at);
        continue;
      }

      const general = { ...value };
      const aiRuntime = {
        ...(typeof value.speed === "string" ? { speed: value.speed } : {}),
        ...(typeof value.promptSuggestions === "boolean" ? { promptSuggestions: value.promptSuggestions } : {}),
        ...(typeof value.showContextUsage === "boolean" ? { showContextUsage: value.showContextUsage } : {})
      };
      const permissions = typeof value.defaultPermission === "string" ? { defaultPermission: value.defaultPermission } : null;
      const plugins = typeof value.pluginsEnabled === "boolean" ? { enabled: value.pluginsEnabled } : null;
      delete general.speed;
      delete general.promptSuggestions;
      delete general.showContextUsage;
      delete general.defaultPermission;
      delete general.pluginsEnabled;
      insert.run(row.user_id, "general", JSON.stringify(general), row.updated_at);
      if (Object.keys(aiRuntime).length) insert.run(row.user_id, "ai-runtime", JSON.stringify(aiRuntime), row.updated_at);
      if (permissions) insert.run(row.user_id, "permissions", JSON.stringify(permissions), row.updated_at);
      if (plugins) insert.run(row.user_id, "plugins", JSON.stringify(plugins), row.updated_at);
    }

    database.exec(`DROP TABLE user_settings_v4; PRAGMA user_version = 5;`);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

// 仅旧数据升级阶段修复 SQLite 消息；文件会话的中断恢复由 JSONL 仓库负责。
if (currentVersion < 31) database.prepare("UPDATE ai_messages SET status = 'interrupted' WHERE status = 'streaming'").run();

if (currentVersion < 6) {
  database.exec("BEGIN IMMEDIATE;");

  try {
    database.exec(`
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
        decided_by TEXT REFERENCES users(id) ON DELETE SET NULL
      ) STRICT;

      CREATE INDEX ai_tool_approvals_user_status_idx ON ai_tool_approvals(user_id, status, requested_at DESC);
      PRAGMA user_version = 6;
    `);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

if (currentVersion < 7) {
  database.exec("BEGIN IMMEDIATE;");

  try {
    database.exec(`
      ALTER TABLE ai_tool_approvals ADD COLUMN expires_at TEXT;
      UPDATE ai_tool_approvals SET expires_at = strftime('%Y-%m-%dT%H:%M:%fZ', requested_at, '+5 minutes') WHERE expires_at IS NULL;
      CREATE INDEX ai_tool_approvals_expiration_idx ON ai_tool_approvals(status, expires_at);
      PRAGMA user_version = 7;
    `);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

if (currentVersion < 8) {
  database.exec("BEGIN IMMEDIATE;");

  try {
    database.exec(`
      ALTER TABLE ai_tool_approvals ADD COLUMN tool_version TEXT;
      ALTER TABLE ai_tool_approvals ADD COLUMN scope_hash TEXT;
      ALTER TABLE ai_tool_approvals ADD COLUMN scope_summary TEXT;
      UPDATE ai_tool_approvals SET status = 'expired' WHERE status IN ('pending', 'approved');

      CREATE TABLE ai_tool_permission_grants (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        app_id TEXT NOT NULL CHECK (app_id IN ('steamcmd', 'minecraft', 'writing')),
        tool_id TEXT NOT NULL CHECK (length(tool_id) BETWEEN 1 AND 120),
        tool_version TEXT NOT NULL CHECK (length(tool_version) BETWEEN 1 AND 80),
        risk TEXT NOT NULL CHECK (risk IN ('write', 'dangerous')),
        scope_hash TEXT NOT NULL CHECK (length(scope_hash) = 64),
        summary TEXT NOT NULL CHECK (length(summary) BETWEEN 1 AND 500),
        scope_summary TEXT NOT NULL CHECK (length(scope_summary) BETWEEN 1 AND 240),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE (user_id, app_id, tool_id, tool_version, risk, scope_hash)
      ) STRICT;

      CREATE INDEX ai_tool_permission_grants_user_idx ON ai_tool_permission_grants(user_id, created_at DESC);
      PRAGMA user_version = 8;
    `);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

if (currentVersion < 9) {
  database.exec("BEGIN IMMEDIATE;");

  try {
    // 旧审批与授权记录没有可信目标说明时，明确标记信息缺失，不从操作摘要推断授权范围。
    if (!hasColumn("ai_tool_approvals", "scope_summary")) {
      database.exec("ALTER TABLE ai_tool_approvals ADD COLUMN scope_summary TEXT;");
    }
    database.exec("UPDATE ai_tool_approvals SET scope_summary = '旧版本未记录目标范围' WHERE scope_summary IS NULL OR TRIM(scope_summary) = '';");

    const grantHasScopeSummary = hasColumn("ai_tool_permission_grants", "scope_summary");
    const grantScopeSummary = grantHasScopeSummary
      ? "COALESCE(NULLIF(TRIM(scope_summary), ''), '旧版本未记录目标范围')"
      : "'旧版本未记录目标范围'";

    database.exec(`
      CREATE TABLE ai_tool_permission_grants_v9 (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        app_id TEXT NOT NULL CHECK (app_id IN ('steamcmd', 'minecraft', 'writing')),
        tool_id TEXT NOT NULL CHECK (length(tool_id) BETWEEN 1 AND 120),
        tool_version TEXT NOT NULL CHECK (length(tool_version) BETWEEN 1 AND 80),
        risk TEXT NOT NULL CHECK (risk IN ('write', 'dangerous')),
        scope_hash TEXT NOT NULL CHECK (length(scope_hash) = 64),
        summary TEXT NOT NULL CHECK (length(summary) BETWEEN 1 AND 500),
        scope_summary TEXT NOT NULL CHECK (length(scope_summary) BETWEEN 1 AND 240),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE (user_id, app_id, tool_id, tool_version, risk, scope_hash)
      ) STRICT;

      INSERT INTO ai_tool_permission_grants_v9 (id, user_id, app_id, tool_id, tool_version, risk, scope_hash, summary, scope_summary, created_at)
      SELECT id, user_id, app_id, tool_id, tool_version, risk, scope_hash, summary, ${grantScopeSummary}, created_at
      FROM ai_tool_permission_grants;

      DROP TABLE ai_tool_permission_grants;
      ALTER TABLE ai_tool_permission_grants_v9 RENAME TO ai_tool_permission_grants;
      CREATE INDEX ai_tool_permission_grants_user_idx ON ai_tool_permission_grants(user_id, created_at DESC);
      PRAGMA user_version = 9;
    `);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

if (currentVersion < 10) {
  database.exec("BEGIN IMMEDIATE;");

  try {
    database.exec(`
      CREATE TABLE daemon_nodes (
        id TEXT PRIMARY KEY NOT NULL,
        display_name TEXT NOT NULL,
        platform TEXT NOT NULL,
        architecture TEXT NOT NULL,
        daemon_version TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('online', 'offline')),
        capabilities_json TEXT NOT NULL DEFAULT '[]',
        java_runtimes_json TEXT NOT NULL DEFAULT '[]',
        last_seen_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;

      CREATE TABLE minecraft_instances (
        id TEXT PRIMARY KEY NOT NULL,
        node_id TEXT NOT NULL REFERENCES daemon_nodes(id) ON DELETE RESTRICT,
        created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 48),
        release_id TEXT NOT NULL,
        java_major INTEGER NOT NULL CHECK (java_major BETWEEN 8 AND 40),
        memory_mb INTEGER NOT NULL CHECK (memory_mb BETWEEN 1024 AND 32768),
        state TEXT NOT NULL CHECK (state IN ('installing', 'stopped', 'starting', 'running', 'stopping', 'error', 'unknown')),
        eula_accepted_at TEXT NOT NULL,
        server_properties_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE (node_id, name)
      ) STRICT;

      CREATE INDEX minecraft_instances_node_idx ON minecraft_instances(node_id, updated_at DESC);

      CREATE TABLE minecraft_tasks (
        id TEXT PRIMARY KEY NOT NULL,
        node_id TEXT NOT NULL REFERENCES daemon_nodes(id) ON DELETE RESTRICT,
        instance_id TEXT REFERENCES minecraft_instances(id) ON DELETE SET NULL,
        created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        kind TEXT NOT NULL CHECK (kind IN ('install', 'start', 'stop', 'properties', 'backup', 'java-install')),
        status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
        progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
        message TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        result_json TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        started_at TEXT,
        finished_at TEXT
      ) STRICT;

      CREATE INDEX minecraft_tasks_node_queue_idx ON minecraft_tasks(node_id, status, created_at);
      CREATE INDEX minecraft_tasks_recent_idx ON minecraft_tasks(created_at DESC);

      CREATE TABLE minecraft_task_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        instance_id TEXT NOT NULL REFERENCES minecraft_instances(id) ON DELETE CASCADE,
        task_id TEXT REFERENCES minecraft_tasks(id) ON DELETE SET NULL,
        stream TEXT NOT NULL CHECK (stream IN ('stdout', 'stderr', 'system')),
        line TEXT NOT NULL CHECK (length(line) <= 4096),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;

      CREATE INDEX minecraft_task_logs_recent_idx ON minecraft_task_logs(instance_id, id DESC);
      PRAGMA user_version = 10;
    `);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

if (currentVersion < 11) {
  database.exec("BEGIN IMMEDIATE;");

  try {
    database.exec(`
      ALTER TABLE minecraft_tasks ADD COLUMN lease_expires_at TEXT;
      CREATE INDEX minecraft_tasks_lease_idx ON minecraft_tasks(status, lease_expires_at);
      UPDATE minecraft_tasks
      SET lease_expires_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+30 seconds')
      WHERE status = 'running';
      PRAGMA user_version = 11;
    `);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

if (currentVersion < 12) {
  database.exec("BEGIN IMMEDIATE;");

  try {
    database.exec(`
      ALTER TABLE minecraft_instances ADD COLUMN sandbox_status TEXT NOT NULL DEFAULT 'unprepared'
        CHECK (sandbox_status IN ('unsupported', 'unprepared', 'prepared', 'running', 'unknown'));
      UPDATE minecraft_instances SET sandbox_status = 'unknown'
        WHERE state IN ('starting', 'running', 'stopping');
      PRAGMA user_version = 12;
    `);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

if (currentVersion < 13) {
  database.exec("BEGIN IMMEDIATE;");

  try {
    database.exec(`
      UPDATE minecraft_instances AS instance
      SET state = 'error', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE instance.state = 'stopped'
        AND EXISTS (
          SELECT 1 FROM minecraft_tasks AS failed_start
          WHERE failed_start.instance_id = instance.id
            AND failed_start.kind = 'start'
            AND failed_start.status = 'failed'
            AND NOT EXISTS (
              SELECT 1 FROM minecraft_tasks AS newer_action
              WHERE newer_action.instance_id = instance.id
                AND newer_action.kind IN ('install', 'start', 'stop')
                AND (newer_action.created_at > failed_start.created_at
                  OR (newer_action.created_at = failed_start.created_at AND newer_action.rowid > failed_start.rowid))
            )
        );
      PRAGMA user_version = 13;
    `);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

if (currentVersion < 14) {
  database.exec("BEGIN IMMEDIATE;");

  try {
    database.exec(`
      CREATE TABLE minecraft_deployments (
        id TEXT PRIMARY KEY NOT NULL,
        node_id TEXT NOT NULL REFERENCES daemon_nodes(id) ON DELETE RESTRICT,
        created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 48),
        server_type TEXT NOT NULL CHECK (server_type IN ('vanilla')),
        release_id TEXT NOT NULL,
        java_major INTEGER NOT NULL CHECK (java_major BETWEEN 8 AND 40),
        state TEXT NOT NULL CHECK (state IN ('queued', 'downloading', 'ready', 'failed', 'registering', 'registered')),
        instance_id TEXT REFERENCES minecraft_instances(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE (node_id, name)
      ) STRICT;

      ALTER TABLE minecraft_tasks ADD COLUMN deployment_id TEXT REFERENCES minecraft_deployments(id) ON DELETE SET NULL;
      CREATE INDEX minecraft_deployments_node_idx ON minecraft_deployments(node_id, updated_at DESC);
      CREATE INDEX minecraft_tasks_deployment_idx ON minecraft_tasks(deployment_id, created_at DESC);
      PRAGMA user_version = 14;
    `);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

if (currentVersion < 15) {
  database.exec("BEGIN IMMEDIATE;");

  try {
    database.exec(`
      CREATE TABLE node_file_tasks (
        id TEXT PRIMARY KEY NOT NULL,
        node_id TEXT NOT NULL REFERENCES daemon_nodes(id) ON DELETE RESTRICT,
        created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        operation TEXT NOT NULL CHECK (operation IN ('list', 'search', 'read', 'write', 'create-file', 'create-folder', 'rename', 'delete', 'upload', 'download')),
        status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
        progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
        message TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        result_json TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        started_at TEXT,
        finished_at TEXT,
        lease_expires_at TEXT
      ) STRICT;

      CREATE INDEX node_file_tasks_node_queue_idx ON node_file_tasks(node_id, status, created_at);
      CREATE INDEX node_file_tasks_user_recent_idx ON node_file_tasks(created_by, created_at DESC);
      CREATE INDEX node_file_tasks_lease_idx ON node_file_tasks(status, lease_expires_at);
      PRAGMA user_version = 15;
    `);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

if (currentVersion < 16) {
  database.exec("BEGIN IMMEDIATE;");

  try {
    database.exec(`
      ALTER TABLE daemon_nodes ADD COLUMN data_root TEXT NOT NULL DEFAULT '';

      CREATE TABLE steamcmd_node_settings (
        node_id TEXT PRIMARY KEY NOT NULL REFERENCES daemon_nodes(id) ON DELETE CASCADE,
        install_mode TEXT NOT NULL CHECK (install_mode IN ('online', 'manual')),
        steamcmd_directory TEXT NOT NULL,
        game_directory TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;

      CREATE TABLE steamcmd_tasks (
        id TEXT PRIMARY KEY NOT NULL,
        node_id TEXT NOT NULL REFERENCES daemon_nodes(id) ON DELETE RESTRICT,
        created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        kind TEXT NOT NULL CHECK (kind IN ('install', 'verify')),
        status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
        progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
        message TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        result_json TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        started_at TEXT,
        finished_at TEXT,
        lease_expires_at TEXT
      ) STRICT;

      CREATE INDEX steamcmd_tasks_node_queue_idx ON steamcmd_tasks(node_id, status, created_at);
      CREATE INDEX steamcmd_tasks_user_recent_idx ON steamcmd_tasks(created_by, created_at DESC);
      CREATE INDEX steamcmd_tasks_lease_idx ON steamcmd_tasks(status, lease_expires_at);
      PRAGMA user_version = 16;
    `);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

if (currentVersion < 17) {
  database.exec("BEGIN IMMEDIATE;");

  try {
    database.exec(`
      ALTER TABLE ai_accounts ADD COLUMN reasoning_mode TEXT NOT NULL DEFAULT 'default';
      PRAGMA user_version = 17;
    `);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

if (currentVersion < 18) {
  database.exec("BEGIN IMMEDIATE;");

  try {
    database.exec(`
      CREATE TABLE steamcmd_settings_defaults (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        install_mode TEXT NOT NULL CHECK (install_mode IN ('online', 'manual')),
        steamcmd_directory TEXT NOT NULL,
        game_directory TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;
      PRAGMA user_version = 18;
    `);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

if (currentVersion < 19) {
  database.exec("BEGIN IMMEDIATE;");

  try {
    const daemonNodeColumns = database.prepare("PRAGMA table_info(daemon_nodes)").all() as Array<{ name: string }>;
    if (!daemonNodeColumns.some((column) => column.name === "data_root")) {
      database.exec("ALTER TABLE daemon_nodes ADD COLUMN data_root TEXT NOT NULL DEFAULT '';");
    }
    database.exec("PRAGMA user_version = 19;");
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

// 部署和实例分别记下创建时的节点相对目录；升级只补列，不移动既有文件。
if (currentVersion < 20) {
  database.exec("BEGIN IMMEDIATE;");

  try {
    database.exec(`
      ALTER TABLE minecraft_instances ADD COLUMN storage_directory TEXT NOT NULL DEFAULT 'games/minecraft';
      ALTER TABLE minecraft_deployments ADD COLUMN storage_directory TEXT NOT NULL DEFAULT 'games/minecraft';

      CREATE TABLE minecraft_storage_settings_defaults (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        instance_directory TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;

      CREATE TABLE minecraft_storage_node_settings (
        node_id TEXT PRIMARY KEY NOT NULL REFERENCES daemon_nodes(id) ON DELETE CASCADE,
        instance_directory TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;
      PRAGMA user_version = 20;
    `);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

if (currentVersion < 21) {
  database.exec("BEGIN IMMEDIATE;");

  try {
    database.exec(`
      ALTER TABLE minecraft_instances ADD COLUMN java_runtime_id TEXT;
      PRAGMA user_version = 21;
    `);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

// 版本 23 把 SteamCMD 安装配置与游戏文件目录拆开保存；复制旧值后再移除混合表，不移动节点文件。
if (currentVersion < 23) {
  database.exec("BEGIN IMMEDIATE;");

  try {
    database.exec(`
      CREATE TABLE steamcmd_configuration_defaults (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        install_mode TEXT NOT NULL CHECK (install_mode IN ('online', 'manual')),
        steamcmd_directory TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;

      CREATE TABLE steamcmd_configuration_node_settings (
        node_id TEXT PRIMARY KEY NOT NULL REFERENCES daemon_nodes(id) ON DELETE CASCADE,
        install_mode TEXT NOT NULL CHECK (install_mode IN ('online', 'manual')),
        steamcmd_directory TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;

      CREATE TABLE steamcmd_storage_defaults (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        game_directory TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;

      CREATE TABLE steamcmd_storage_node_settings (
        node_id TEXT PRIMARY KEY NOT NULL REFERENCES daemon_nodes(id) ON DELETE CASCADE,
        game_directory TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;

      INSERT INTO steamcmd_configuration_defaults (id, install_mode, steamcmd_directory, updated_at)
        SELECT id, install_mode, steamcmd_directory, updated_at FROM steamcmd_settings_defaults;
      INSERT INTO steamcmd_configuration_node_settings (node_id, install_mode, steamcmd_directory, updated_at)
        SELECT node_id, install_mode, steamcmd_directory, updated_at FROM steamcmd_node_settings;
      INSERT INTO steamcmd_storage_defaults (id, game_directory, updated_at)
        SELECT id, game_directory, updated_at FROM steamcmd_settings_defaults;
      INSERT INTO steamcmd_storage_node_settings (node_id, game_directory, updated_at)
        SELECT node_id, game_directory, updated_at FROM steamcmd_node_settings;

      DROP TABLE steamcmd_settings_defaults;
      DROP TABLE steamcmd_node_settings;
      PRAGMA user_version = 23;
    `);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

// 版本 24 为账户添加通行密钥凭据和短期 WebAuthn 挑战，保留已有会话与账户数据。
if (currentVersion < 24) {
  database.exec("BEGIN IMMEDIATE;");

  try {
    database.exec(`
      CREATE TABLE webauthn_credentials (
        credential_id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        user_handle TEXT NOT NULL,
        public_key TEXT NOT NULL,
        counter INTEGER NOT NULL CHECK (counter >= 0),
        transports_json TEXT NOT NULL DEFAULT '[]',
        device_type TEXT NOT NULL CHECK (device_type IN ('singleDevice', 'multiDevice')),
        backed_up INTEGER NOT NULL CHECK (backed_up IN (0, 1)),
        name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 48),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        last_used_at TEXT
      ) STRICT;

      CREATE INDEX webauthn_credentials_user_idx ON webauthn_credentials(user_id, created_at DESC);

      CREATE TABLE webauthn_challenges (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        purpose TEXT NOT NULL CHECK (purpose IN ('registration', 'authentication')),
        challenge TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;

      CREATE INDEX webauthn_challenges_expiration_idx ON webauthn_challenges(expires_at);
      CREATE INDEX webauthn_challenges_user_idx ON webauthn_challenges(user_id, purpose, expires_at);
      PRAGMA user_version = 24;
    `);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

// 版本 25 为账户增加可复用数字 UID、邮箱和超级管理员标记；既有最早管理员成为 UID 1 的超级管理员。
if (currentVersion < 25) {
  database.exec("BEGIN IMMEDIATE;");

  try {
    database.exec(`
      ALTER TABLE users ADD COLUMN uid INTEGER;
      ALTER TABLE users ADD COLUMN email TEXT COLLATE NOCASE;
      ALTER TABLE users ADD COLUMN is_super_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_super_admin IN (0, 1));

      WITH numbered_users AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS account_uid
        FROM users
      )
      UPDATE users
      SET uid = (SELECT account_uid FROM numbered_users WHERE numbered_users.id = users.id);

      UPDATE users
      SET role = 'admin', is_super_admin = 1
      WHERE id = (SELECT id FROM users ORDER BY created_at ASC, id ASC LIMIT 1);

      CREATE UNIQUE INDEX users_uid_idx ON users(uid);
      CREATE UNIQUE INDEX users_email_idx ON users(email) WHERE email IS NOT NULL;
      CREATE UNIQUE INDEX users_single_super_admin_idx ON users(is_super_admin) WHERE is_super_admin = 1;
      PRAGMA user_version = 25;
    `);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

// 版本 26 为 AI 助手消息增加可追溯的运行活动；既有消息默认没有活动记录。
if (currentVersion < 26) {
  database.exec("BEGIN IMMEDIATE;");

  try {
    database.exec(`
      ALTER TABLE ai_messages ADD COLUMN activity_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(activity_json));
      PRAGMA user_version = 26;
    `);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

// 版本 27 接入账户隔离的写作作品、章节、修订历史与最近编辑位置；不触碰现有 AI 会话数据。
if (currentVersion < 27) {
  database.exec("BEGIN IMMEDIATE;");

  try {
    database.exec(`
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

      PRAGMA user_version = 27;
    `);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

// 版本 28 为写作作品增加卷分组，并将既有章节无损归入各自作品的“第一卷”。
if (currentVersion < 28) {
  database.exec("BEGIN IMMEDIATE;");

  try {
    database.exec(`
      CREATE TABLE writing_volumes (
        id TEXT PRIMARY KEY NOT NULL,
        book_id TEXT NOT NULL REFERENCES writing_books(id) ON DELETE CASCADE,
        title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
        sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE(book_id, sort_order)
      ) STRICT;

      CREATE INDEX writing_volumes_book_order_idx ON writing_volumes(book_id, sort_order);

      ALTER TABLE writing_chapters ADD COLUMN volume_id TEXT REFERENCES writing_volumes(id) ON DELETE CASCADE;

      WITH generated_volume_ids AS (
        SELECT id AS book_id, lower(hex(randomblob(16))) AS raw_id FROM writing_books
      )
      INSERT INTO writing_volumes (id, book_id, title, sort_order)
      SELECT
        substr(raw_id, 1, 8) || '-' || substr(raw_id, 9, 4) || '-4' || substr(raw_id, 14, 3) || '-a' || substr(raw_id, 18, 3) || '-' || substr(raw_id, 21, 12),
        book_id,
        '第一卷',
        0
      FROM generated_volume_ids;

      UPDATE writing_chapters
      SET volume_id = (
        SELECT writing_volumes.id FROM writing_volumes
        WHERE writing_volumes.book_id = writing_chapters.book_id AND writing_volumes.sort_order = 0
      );

      CREATE INDEX writing_chapters_volume_order_idx ON writing_chapters(book_id, volume_id, sort_order);
      PRAGMA user_version = 28;
    `);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

// 版本 29 为每部写作作品增加独立大纲正文与账户隔离的修订快照。
if (currentVersion < 29) {
  database.exec("BEGIN IMMEDIATE;");

  try {
    database.exec(`
      ALTER TABLE writing_books ADD COLUMN outline_content TEXT NOT NULL DEFAULT '';

      CREATE TABLE writing_book_outline_revisions (
        id TEXT PRIMARY KEY NOT NULL,
        book_id TEXT NOT NULL REFERENCES writing_books(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;

      CREATE INDEX writing_book_outline_revisions_recent_idx ON writing_book_outline_revisions(book_id, created_at DESC);
      PRAGMA user_version = 29;
    `);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

// 版本 30 为 AI Work 增加经 Daemon 执行的主机命令任务队列。
if (currentVersion < 30) {
  database.exec("BEGIN IMMEDIATE;");

  try {
    database.exec(`
      CREATE TABLE ai_host_tasks (
        id TEXT PRIMARY KEY NOT NULL,
        node_id TEXT NOT NULL REFERENCES daemon_nodes(id) ON DELETE CASCADE,
        created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        app_id TEXT NOT NULL CHECK (app_id IN ('steamcmd', 'minecraft', 'writing')),
        shell TEXT NOT NULL CHECK (shell IN ('system', 'powershell', 'cmd', 'bash', 'zsh')),
        working_directory TEXT NOT NULL,
        command TEXT NOT NULL,
        timeout_seconds INTEGER NOT NULL DEFAULT 0 CHECK (timeout_seconds BETWEEN 0 AND 1800),
        status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
        message TEXT NOT NULL,
        result_json TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        started_at TEXT,
        finished_at TEXT,
        lease_expires_at TEXT
      ) STRICT;

      CREATE INDEX ai_host_tasks_node_queue_idx ON ai_host_tasks(node_id, status, created_at);
      CREATE INDEX ai_host_tasks_retention_idx ON ai_host_tasks(status, finished_at);
      PRAGMA user_version = 30;
    `);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

export function closeDatabase(): void {
  database.close();
}

/** 版本 32 扩展通用任务上下文；按 SQLite 重建合同保留全部列、索引和既有记录。 */
export function migrateWorkspaceSchema(): void {
  const version = Number(database.prepare("PRAGMA user_version").get()!.user_version);
  if (version < 31 || version >= 32) return;
  // 关闭外键仅用于事务化结构迁移，提交前 foreign_key_check 必须通过，产品授权不受影响。
  database.exec("PRAGMA foreign_keys = OFF; BEGIN IMMEDIATE;");
  try {
    for (const table of ["ai_sessions", "ai_tool_approvals", "ai_tool_permission_grants", "ai_host_tasks"]) {
      const row = database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
      if (typeof row?.sql !== "string") throw new Error(`缺少迁移表：${table}`);
      const replacement = `${table}_v32`;
      const indexes = database.prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND sql IS NOT NULL").all(table);
      const schema = row.sql.replace(new RegExp(`^CREATE TABLE\\s+"?${table}"?`, "u"), `CREATE TABLE ${replacement}`).replace("'steamcmd', 'minecraft', 'writing'", "'steamcmd', 'minecraft', 'writing', 'workspace'").replace("'system', 'powershell', 'cmd', 'bash', 'zsh'", "'system', 'powershell', 'cmd', 'bash', 'zsh', 'project-files'");
      if (schema === row.sql || !schema.includes("'workspace'")) throw new Error(`表约束不符合迁移合同：${table}`);
      database.exec(schema);
      database.exec(`INSERT INTO ${replacement} SELECT * FROM ${table}; DROP TABLE ${table}; ALTER TABLE ${replacement} RENAME TO ${table};`);
      for (const index of indexes) database.exec(String(index.sql));
    }
    if (database.prepare("PRAGMA foreign_key_check").all().length) throw new Error("通用工作区迁移后外键校验失败。");
    database.exec("PRAGMA user_version = 32; COMMIT;");
  } catch (error) { database.exec("ROLLBACK;"); throw error; }
  finally { database.exec("PRAGMA foreign_keys = ON;"); }
}

/** 版本 33 为作品增加账户隔离的设定、人物、剧情和素材条目。 */
export function migrateWritingCatalogSchema(): void {
  const version = Number(database.prepare("PRAGMA user_version").get()!.user_version);
  if (version < 32 || version >= 33) return;
  database.exec("BEGIN IMMEDIATE;");
  try {
    database.exec(`
      CREATE TABLE writing_catalog_entries (
        id TEXT PRIMARY KEY NOT NULL,
        book_id TEXT NOT NULL REFERENCES writing_books(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
        content TEXT NOT NULL DEFAULT '' CHECK (length(content) <= 1500000),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;
      CREATE INDEX writing_catalog_entries_book_kind_idx ON writing_catalog_entries(book_id, kind, updated_at DESC);
      PRAGMA user_version = 33;
    `);
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

// 已完成文件存储迁移的账户可立即升级；旧版本须先由协调器完成版本 31 再调用。
migrateWorkspaceSchema();
migrateWritingCatalogSchema();

/** 版本 34 保存取消/增量输出事实，增加实例重启与控制台动作；旧任务及日志完整保留。 */
export function migrateExecutionControlSchema(): void {
  const version = Number(database.prepare("PRAGMA user_version").get()!.user_version);
  if (version < 33 || version >= 34) return;
  database.exec("PRAGMA foreign_keys = OFF; BEGIN IMMEDIATE;");
  try {
    const row = database.prepare("SELECT sql FROM sqlite_master WHERE name = 'minecraft_tasks' AND type = 'table'").get();
    if (typeof row?.sql !== "string") throw new Error("缺少 Minecraft 任务表，拒绝执行迁移。");
    const indexes = database.prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'minecraft_tasks' AND sql IS NOT NULL").all();
    const schema = row.sql.replace(/^CREATE TABLE\s+"?minecraft_tasks"?/u, "CREATE TABLE minecraft_tasks_v34")
      .replace("'install', 'start', 'stop', 'properties', 'backup', 'java-install'", "'install', 'start', 'stop', 'properties', 'backup', 'java-install', 'restart', 'console'");
    if (!schema.includes("'console'")) throw new Error("Minecraft 任务约束与版本 34 不匹配。");
    database.exec(schema);
    database.exec("INSERT INTO minecraft_tasks_v34 SELECT * FROM minecraft_tasks; DROP TABLE minecraft_tasks; ALTER TABLE minecraft_tasks_v34 RENAME TO minecraft_tasks;");
    for (const index of indexes) database.exec(String(index.sql));
    database.exec(`
      ALTER TABLE ai_host_tasks ADD COLUMN cancel_requested INTEGER NOT NULL DEFAULT 0 CHECK (cancel_requested IN (0, 1));
      ALTER TABLE ai_host_tasks ADD COLUMN output_sequence INTEGER NOT NULL DEFAULT 0;
      CREATE TABLE daemon_credentials (
        node_id TEXT PRIMARY KEY NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        revoked INTEGER NOT NULL DEFAULT 0 CHECK (revoked IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;
    `);
    if (database.prepare("PRAGMA foreign_key_check").all().length) throw new Error("执行控制迁移外键校验失败。");
    database.exec("PRAGMA user_version = 34; COMMIT;");
  } catch (error) { database.exec("ROLLBACK;"); throw error; }
  finally { database.exec("PRAGMA foreign_keys = ON;"); }
}
migrateExecutionControlSchema();

/** 版本 35 扩展多核心持久元数据；旧 Vanilla、部署、任务外键和索引原样保留。 */
export function migrateMinecraftCoreSchema(): void {
  const version = Number(database.prepare("PRAGMA user_version").get()!.user_version);
  if (version < 34 || version >= 35) return;
  database.exec("PRAGMA foreign_keys = OFF; BEGIN IMMEDIATE;");
  try {
    const row = database.prepare("SELECT sql FROM sqlite_master WHERE name = 'minecraft_deployments' AND type = 'table'").get();
    if (typeof row?.sql !== "string") throw new Error("缺少 Minecraft 部署表，拒绝迁移。");
    const indexes = database.prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'minecraft_deployments' AND sql IS NOT NULL").all();
    const schema = row.sql.replace(/^CREATE TABLE\s+"?minecraft_deployments"?/u, "CREATE TABLE minecraft_deployments_v35")
      .replace("CHECK (server_type IN ('vanilla'))", "CHECK (length(server_type) BETWEEN 1 AND 32)");
    if (schema === row.sql || schema.includes("server_type IN ('vanilla')")) throw new Error("核心表结构与迁移合同不符。");
    database.exec(schema);
    database.exec("INSERT INTO minecraft_deployments_v35 SELECT * FROM minecraft_deployments; DROP TABLE minecraft_deployments; ALTER TABLE minecraft_deployments_v35 RENAME TO minecraft_deployments;");
    for (const index of indexes) database.exec(String(index.sql));
    database.exec(`
      ALTER TABLE minecraft_deployments ADD COLUMN core_build TEXT NOT NULL DEFAULT '';
      ALTER TABLE minecraft_deployments ADD COLUMN artifact_json TEXT;
      ALTER TABLE minecraft_deployments ADD COLUMN automatic INTEGER NOT NULL DEFAULT 0 CHECK (automatic IN (0, 1));
      ALTER TABLE minecraft_instances ADD COLUMN core_type TEXT NOT NULL DEFAULT 'Vanilla';
      ALTER TABLE minecraft_instances ADD COLUMN core_build TEXT NOT NULL DEFAULT '';
      ALTER TABLE minecraft_instances ADD COLUMN execution_mode TEXT NOT NULL DEFAULT 'appcontainer' CHECK (execution_mode IN ('appcontainer', 'native'));
    `);
    if (database.prepare("PRAGMA foreign_key_check").all().length) throw new Error("多核心迁移外键核查失败。");
    database.exec("PRAGMA user_version = 35; COMMIT;");
  } catch (error) { database.exec("ROLLBACK;"); throw error; }
  finally { database.exec("PRAGMA foreign_keys = ON;"); }
}
migrateMinecraftCoreSchema();

/** 版本 36 为账户保存通用项目目录登记；移除登记不会级联删除节点文件或会话日志。 */
export function migrateWorkspaceProjectSchema(): void {
  const version = Number(database.prepare("PRAGMA user_version").get()!.user_version);
  if (version < 35 || version >= 36) return;
  database.exec("BEGIN IMMEDIATE;");
  try {
    database.exec(`
      CREATE TABLE workspace_projects (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        node_id TEXT NOT NULL REFERENCES daemon_nodes(id) ON DELETE RESTRICT,
        path TEXT NOT NULL,
        path_key TEXT NOT NULL,
        title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;
      CREATE UNIQUE INDEX workspace_projects_user_node_path_idx
        ON workspace_projects(user_id, node_id, path_key);
      CREATE INDEX workspace_projects_user_recent_idx
        ON workspace_projects(user_id, updated_at DESC, id);
      PRAGMA user_version = 36;
      COMMIT;
    `);
  } catch (error) { database.exec("ROLLBACK;"); throw error; }
}
migrateWorkspaceProjectSchema();

/** 版本 37 为账户隔离的 Git Worktree 保存可恢复基线和 Daemon 归属。 */
export function migrateWorkspaceGitSchema(): void {
  const version = Number(database.prepare("PRAGMA user_version").get()!.user_version);
  if (version < 36 || version >= 37) return;
  database.exec("BEGIN IMMEDIATE;");
  try {
    database.exec(`
      CREATE TABLE workspace_git_worktrees (
        project_id TEXT PRIMARY KEY NOT NULL REFERENCES workspace_projects(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        source_project_id TEXT NOT NULL REFERENCES workspace_projects(id) ON DELETE RESTRICT,
        node_id TEXT NOT NULL REFERENCES daemon_nodes(id) ON DELETE RESTRICT,
        worktree_id TEXT NOT NULL CHECK (length(worktree_id) = 36),
        worktree_root TEXT NOT NULL,
        project_relative_path TEXT NOT NULL DEFAULT '',
        branch TEXT NOT NULL CHECK (length(branch) BETWEEN 1 AND 255),
        base_commit TEXT NOT NULL CHECK (length(base_commit) BETWEEN 40 AND 64),
        source_head TEXT NOT NULL CHECK (length(source_head) BETWEEN 40 AND 64),
        created_at TEXT NOT NULL
      ) STRICT;
      CREATE UNIQUE INDEX workspace_git_worktrees_node_id_idx ON workspace_git_worktrees(node_id, worktree_id);
      CREATE UNIQUE INDEX workspace_git_worktrees_node_path_idx ON workspace_git_worktrees(node_id, worktree_root);
      CREATE INDEX workspace_git_worktrees_source_idx ON workspace_git_worktrees(user_id, source_project_id);
      PRAGMA user_version = 37;
      COMMIT;
    `);
  } catch (error) { database.exec("ROLLBACK;"); throw error; }
}
migrateWorkspaceGitSchema();

/** 版本 38 为通用项目目录增加 App 归属；旧目录保持未分配，等用户在对应 App 使用时显式认领。 */
export function migrateWorkspaceProjectApplicationSchema(): void {
  const version = Number(database.prepare("PRAGMA user_version").get()!.user_version);
  if (version < 37 || version >= 38) return;
  database.exec("BEGIN IMMEDIATE;");
  try {
    database.exec(`
      ALTER TABLE workspace_projects ADD COLUMN app_id TEXT CHECK (app_id IN ('workspace', 'minecraft'));
      DROP INDEX workspace_projects_user_node_path_idx;
      CREATE UNIQUE INDEX workspace_projects_user_app_node_path_idx
        ON workspace_projects(user_id, app_id, node_id, path_key) WHERE app_id IS NOT NULL;
      CREATE UNIQUE INDEX workspace_projects_user_legacy_node_path_idx
        ON workspace_projects(user_id, node_id, path_key) WHERE app_id IS NULL;
      CREATE INDEX workspace_projects_user_app_recent_idx
        ON workspace_projects(user_id, app_id, updated_at DESC, id);
      PRAGMA user_version = 38;
      COMMIT;
    `);
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}
migrateWorkspaceProjectApplicationSchema();

/** 版本 39 为 Writing AI 的审阅式修改保存账户/作品绑定提案与原文指纹。 */
export function migrateWritingEditProposalSchema(): void {
  const version = Number(database.prepare("PRAGMA user_version").get()!.user_version);
  if (version < 38 || version >= 39) return;
  database.exec("BEGIN IMMEDIATE;");
  try {
    database.exec(`
      CREATE TABLE writing_edit_proposals (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        book_id TEXT NOT NULL REFERENCES writing_books(id) ON DELETE CASCADE,
        target_type TEXT NOT NULL CHECK (target_type IN ('outline', 'chapter')),
        target_id TEXT NOT NULL,
        operation TEXT NOT NULL CHECK (operation IN ('append', 'prepend', 'insert_before', 'insert_after', 'replace_anchor', 'replace')),
        base_sha256 TEXT NOT NULL CHECK (length(base_sha256) = 64),
        proposed_content TEXT NOT NULL CHECK (length(proposed_content) <= 1500000),
        status TEXT NOT NULL CHECK (status IN ('pending', 'applied', 'rejected', 'stale', 'superseded', 'expired')),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        expires_at TEXT NOT NULL
      ) STRICT;
      CREATE INDEX writing_edit_proposals_user_recent_idx ON writing_edit_proposals(user_id, created_at DESC, id);
      CREATE INDEX writing_edit_proposals_target_pending_idx ON writing_edit_proposals(user_id, target_type, target_id, status, created_at DESC);
      PRAGMA user_version = 39;
      COMMIT;
    `);
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}
migrateWritingEditProposalSchema();

/** 版本 40 为插件化存储 Hub 增加具名单元、KV 记录与全局值表。 */
export function migrateStorageHubSchema(): void {
  const version = Number(database.prepare("PRAGMA user_version").get()!.user_version);
  if (version < 39 || version >= 40) return;
  database.exec("BEGIN IMMEDIATE;");
  try {
    database.exec(`
      CREATE TABLE lfaa_hub_storage_units (
        name TEXT PRIMARY KEY NOT NULL,
        version INTEGER NOT NULL CHECK (version >= 0),
        descriptor_json TEXT NOT NULL
      ) STRICT;
      CREATE TABLE lfaa_hub_storage_records (
        unit_name TEXT NOT NULL REFERENCES lfaa_hub_storage_units(name) ON DELETE CASCADE,
        table_name TEXT NOT NULL,
        record_key TEXT NOT NULL,
        value_json TEXT NOT NULL,
        PRIMARY KEY (unit_name, table_name, record_key)
      ) STRICT;
      CREATE TABLE lfaa_hub_storage_globals (
        unit_name TEXT PRIMARY KEY NOT NULL REFERENCES lfaa_hub_storage_units(name) ON DELETE CASCADE,
        value_json TEXT NOT NULL
      ) STRICT;
      PRAGMA user_version = 40;
      COMMIT;
    `);
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}
migrateStorageHubSchema();

/** 版本 41 为每部作品保存专职角色，并创建账户/作品隔离的写作 Skill 库。 */
export function migrateWritingBookProfileSchema(): void {
  const version = Number(database.prepare("PRAGMA user_version").get()!.user_version);
  if (version < 40 || version >= 41) return;
  database.exec("BEGIN IMMEDIATE;");
  try {
    database.exec(`
      ALTER TABLE writing_books ADD COLUMN ai_role_id TEXT NOT NULL DEFAULT 'writing-companion'
        CHECK (ai_role_id IN ('writing-companion', 'outline-planner', 'chapter-writer', 'precision-editor', 'continuity-reviewer', 'character-consultant'));
      CREATE TABLE writing_book_skills (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        book_id TEXT NOT NULL REFERENCES writing_books(id) ON DELETE CASCADE,
        title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
        description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 300),
        instructions TEXT NOT NULL CHECK (length(instructions) BETWEEN 1 AND 12000),
        enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE (book_id, title COLLATE NOCASE)
      ) STRICT;
      CREATE INDEX writing_book_skills_book_enabled_idx ON writing_book_skills(book_id, enabled, updated_at DESC, id);
      PRAGMA user_version = 41;
      COMMIT;
    `);
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}
migrateWritingBookProfileSchema();

/** 版本 42 为账户隔离的 Markdown AI 资料库及本地项目来源建立持久化。 */
export function migrateKnowledgeLibrarySchema(): void {
  const version = Number(database.prepare("PRAGMA user_version").get()!.user_version);
  if (version < 41 || version >= 42) return;
  database.exec("BEGIN IMMEDIATE;");
  try {
    database.exec(`
      CREATE TABLE knowledge_library_items (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        application_id TEXT NOT NULL CHECK (application_id IN ('all', 'workspace', 'steamcmd', 'minecraft', 'writing')),
        kind TEXT NOT NULL CHECK (kind IN ('knowledge', 'skill', 'prompt', 'expert')),
        title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
        description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 500),
        content_markdown TEXT NOT NULL CHECK (length(content_markdown) BETWEEN 1 AND 65536),
        content_sha256 TEXT NOT NULL CHECK (length(content_sha256) = 64),
        source_kind TEXT NOT NULL CHECK (source_kind IN ('upload', 'conversation', 'manual')),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;
      CREATE INDEX knowledge_library_items_scope_idx ON knowledge_library_items(user_id, application_id, kind, updated_at DESC, id);
      CREATE TABLE knowledge_library_project_sources (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        application_id TEXT NOT NULL CHECK (application_id IN ('workspace', 'minecraft')),
        project_id TEXT NOT NULL REFERENCES workspace_projects(id) ON DELETE CASCADE,
        project_application_id TEXT NOT NULL CHECK (project_application_id IN ('workspace', 'minecraft')),
        relative_path TEXT NOT NULL CHECK (length(relative_path) <= 512),
        title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE (user_id, application_id, project_id, relative_path),
        CHECK (application_id = project_application_id)
      ) STRICT;
      CREATE INDEX knowledge_library_project_sources_scope_idx ON knowledge_library_project_sources(user_id, application_id, created_at DESC, id);
      PRAGMA user_version = 42;
      COMMIT;
    `);
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}
migrateKnowledgeLibrarySchema();

/** 版本 43 为每个账户保存有界的 AI Work 个性化记忆与并发删除版本。 */
export function migrateConversationMemorySchema(): void {
  const version = Number(database.prepare("PRAGMA user_version").get()!.user_version);
  if (version < 42 || version >= 43) return;
  database.exec("BEGIN IMMEDIATE;");
  try {
    database.exec(`
      CREATE TABLE conversation_memories (
        user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        memories_json TEXT NOT NULL DEFAULT '[]' CHECK (length(memories_json) <= 8192),
        revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ) STRICT;
      PRAGMA user_version = 43;
      COMMIT;
    `);
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}
migrateConversationMemorySchema();

/** 版本 44 为每个账户保存可执行的 Minecraft Agent 工作流定义与运行轨迹。 */
export function migrateMinecraftWorkflowSchema(): void {
  const version = Number(database.prepare("PRAGMA user_version").get()!.user_version);
  if (version < 43 || version >= 44) return;
  database.exec("BEGIN IMMEDIATE;");
  try {
    database.exec(`
      CREATE TABLE workflow_definitions (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
        definition_json TEXT NOT NULL CHECK (length(definition_json) <= 65536),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        UNIQUE (user_id, id)
      ) STRICT;
      CREATE INDEX workflow_definitions_user_updated_idx ON workflow_definitions(user_id, updated_at DESC, id);
      CREATE TABLE workflow_runs (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        workflow_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'interrupted')),
        nodes_json TEXT NOT NULL CHECK (length(nodes_json) <= 65536),
        current_agent_run_id TEXT,
        session_id TEXT,
        eula_accepted INTEGER NOT NULL DEFAULT 0 CHECK (eula_accepted IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        FOREIGN KEY (user_id, workflow_id) REFERENCES workflow_definitions(user_id, id) ON DELETE CASCADE
      ) STRICT;
      CREATE INDEX workflow_runs_user_workflow_created_idx ON workflow_runs(user_id, workflow_id, created_at DESC, id);
      PRAGMA user_version = 44;
      COMMIT;
    `);
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}
migrateMinecraftWorkflowSchema();

/** 版本 45 为工作流定义增加 App 作用域，旧工作流保留在 Minecraft App。 */
export function migrateApplicationWorkflowSchema(): void {
  const version = Number(database.prepare("PRAGMA user_version").get()!.user_version);
  if (version < 44 || version >= 45) return;
  database.exec("BEGIN IMMEDIATE;");
  try {
    database.exec(`
      ALTER TABLE workflow_definitions
        ADD COLUMN application_id TEXT NOT NULL DEFAULT 'minecraft'
        CHECK (application_id IN ('steamcmd', 'minecraft', 'writing', 'workspace'));
      CREATE INDEX workflow_definitions_user_app_updated_idx
        ON workflow_definitions(user_id, application_id, updated_at DESC, id);
      PRAGMA user_version = 45;
      COMMIT;
    `);
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}
migrateApplicationWorkflowSchema();

/** 版本 46 为通用工作流运行记录保存当前节点，旧 Agent 字段继续保留以兼容既有记录。 */
export function migrateWorkflowRunCurrentNodeSchema(): void {
  const version = Number(database.prepare("PRAGMA user_version").get()!.user_version);
  if (version < 45 || version >= 46) return;
  database.exec("BEGIN IMMEDIATE;");
  try {
    database.exec(`
      ALTER TABLE workflow_runs ADD COLUMN current_node_id TEXT;
      PRAGMA user_version = 46;
      COMMIT;
    `);
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}
migrateWorkflowRunCurrentNodeSchema();

/** 版本 47 将结构化配置改为 SQLite 按记录事务写入，旧 JSON 由 storage-domain 校验并导入。 */
export function migrateConfigurationStorageSchema(): void {
  const version = Number(database.prepare("PRAGMA user_version").get()!.user_version);
  if (version < 46 || version >= 47) return;
  database.exec("BEGIN IMMEDIATE;");
  try {
    database.exec(`
      CREATE TABLE configuration_records (
        table_name TEXT NOT NULL CHECK (table_name IN (
          'user_settings', 'user_preferences', 'ai_accounts',
          'minecraft_storage_settings_defaults', 'minecraft_storage_node_settings',
          'steamcmd_configuration_defaults', 'steamcmd_configuration_node_settings',
          'steamcmd_storage_defaults', 'steamcmd_storage_node_settings'
        )),
        record_key TEXT NOT NULL,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        node_id TEXT REFERENCES daemon_nodes(id) ON DELETE CASCADE,
        value_json TEXT NOT NULL,
        PRIMARY KEY (table_name, record_key)
      ) STRICT;
      CREATE INDEX configuration_records_user_idx ON configuration_records(table_name, user_id);
      CREATE INDEX configuration_records_node_idx ON configuration_records(table_name, node_id);
      CREATE TABLE configuration_credentials (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider_id TEXT NOT NULL,
        record_id TEXT NOT NULL,
        record_kind TEXT NOT NULL CHECK (record_kind IN ('api-key', 'grant')),
        ciphertext TEXT NOT NULL,
        iv TEXT NOT NULL,
        tag TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, provider_id, record_id)
      ) STRICT;
      CREATE TABLE configuration_storage_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        revision INTEGER NOT NULL CHECK (revision >= 0),
        source_format TEXT NOT NULL CHECK (source_format IN ('legacy-json-v1', 'legacy-sqlite-v0-30')),
        source_sha256 TEXT NOT NULL CHECK (length(source_sha256) = 64),
        migrated_at TEXT NOT NULL
      ) STRICT;
      PRAGMA user_version = 47;
      COMMIT;
    `);
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

// SQLite 46+ 可以先安全创建新 schema；storage-domain 在验证旧来源后再原子导入并启用。
migrateConfigurationStorageSchema();
