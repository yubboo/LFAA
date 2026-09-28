/**
 * 文件：database.ts
 * 功能：打开控制端 SQLite 数据库并依次执行结构迁移。
 * 作用：持久化账户密码与恢复密钥哈希、应用偏好、分域设置、AI 账户/会话/授权，以及 Minecraft 节点、实例和任务。
 * 关联文件：server/src/config.ts、server/src/modules/auth/service.ts、server/src/modules/preferences/service.ts、server/src/modules/settings/service.ts。
 * 修改注意事项：迁移必须按版本递增并保持可重复启动；不得删除用户数据来绕过迁移。
 */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config.js";

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

if (currentVersion > 12) {
  throw new Error(`数据库版本 ${currentVersion} 高于当前程序支持的版本 12。`);
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

database.prepare("UPDATE ai_messages SET status = 'interrupted' WHERE status = 'streaming'").run();

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

export function closeDatabase(): void {
  database.close();
}
