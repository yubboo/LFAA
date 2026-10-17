/** 功能：回归 AI 漫剧分镜画布 Owner。作用：验证账户隔离、持久化、并发版本和有界图数据。 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { isolateData } from "./isolated-data.mjs";

const appIdTables = [
  ["user_preferences", "selected_app"],
  ["ai_sessions", "app_id"],
  ["ai_tool_approvals", "app_id"],
  ["ai_tool_permission_grants", "app_id"],
  ["ai_host_tasks", "app_id"],
  ["knowledge_library_items", "application_id"],
  ["workflow_definitions", "application_id"]
];

function removeAiVideoFromApplicationConstraints(database) {
  database.exec("PRAGMA foreign_keys = OFF; BEGIN IMMEDIATE;");
  try {
    for (const [tableName, columnName] of appIdTables) {
      const table = database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName);
      const indexes = database.prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND sql IS NOT NULL ORDER BY name").all(tableName);
      const pattern = new RegExp(`(${columnName}\\s+IN\\s*\\()([^()]*)\\)`, "u");
      const match = pattern.exec(table.sql);
      assert.ok(match?.[2].includes("'aivideo'"), `${tableName} fixture must start at the current v50 schema`);
      const oldSql = table.sql.replace(pattern, (_full, prefix, values) => `${prefix}${values.split(",").map(value => value.trim()).filter(value => value !== "'aivideo'").join(", ")})`);
      const temporaryName = `${tableName}_test_v49`;
      const temporarySql = oldSql.replace(new RegExp(`^CREATE\\s+TABLE\\s+(?:[\"]${tableName}[\"]|${tableName})(?=\\s|\\()`, "u"), `CREATE TABLE ${temporaryName}`);
      assert.notEqual(temporarySql, oldSql, `test fixture can rebuild ${tableName}`);
      database.exec(temporarySql);
      const columns = database.prepare(`PRAGMA table_info("${tableName}")`).all();
      const names = columns.map(column => `"${column.name.replaceAll("\"", "\"\"")}"`).join(", ");
      database.exec(`INSERT INTO ${temporaryName} (${names}) SELECT ${names} FROM ${tableName};`);
      database.exec(`DROP TABLE ${tableName}; ALTER TABLE ${temporaryName} RENAME TO ${tableName};`);
      for (const index of indexes) database.exec(index.sql);
    }
    database.exec("PRAGMA user_version = 49; COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  } finally {
    database.exec("PRAGMA foreign_keys = ON;");
  }
}

test("分镜画布按账户持久化，并拒绝过期写入和超界关系", async t => {
  isolateData(t, "aivideo-canvas");
  const owner = await import("lfaa-video-ai-video/src/index.js");
  const { resolveUserDataPaths } = await import("lfaa-home-paths/src/data-layout.mjs");
  const created = owner.createAiVideoCanvas("account-a", "第一幕");
  const firstShotId = randomUUID();
  const secondShotId = randomUUID();
  const input = {
    title: "第一幕 · 相遇",
    shots: [
      { id: firstShotId, title: "街角远景", description: "黄昏时分，主角走进旧街。", dialogue: "", durationSeconds: 6, x: -240, y: 80 },
      { id: secondShotId, title: "抬头", description: "主角听到声音后抬头。", dialogue: "谁在那里？", durationSeconds: 4, x: 180, y: 80 }
    ],
    links: [
      { id: randomUUID(), source: firstShotId, target: secondShotId },
      { id: randomUUID(), source: secondShotId, target: firstShotId }
    ]
  };
  const saved = owner.updateAiVideoCanvas("account-a", created.id, created.updatedAt, input);
  assert.equal(saved.title, input.title);
  assert.equal(saved.shots[0].x, -240);
  assert.equal(saved.links.length, 2);
  assert.deepEqual(owner.listAiVideoCanvases("account-b"), []);
  assert.equal(owner.updateAiVideoCanvas("account-b", created.id, created.updatedAt, input), null);
  assert.throws(() => owner.updateAiVideoCanvas("account-a", created.id, created.updatedAt, input), owner.AiVideoCanvasConflictError);

  const directory = resolveUserDataPaths(process.env.LFAA_DATA_DIR, "account-a").projects;
  const storedPath = resolve(directory, "aivideo", created.id, "project.json");
  const stored = JSON.parse(readFileSync(storedPath, "utf8"));
  assert.equal(stored.format, "lfaa-aivideo-project");
  assert.equal(stored.canvas.shots[1].dialogue, "谁在那里？");
  assert.equal(owner.deleteAiVideoCanvas("account-b", created.id), false);
  assert.equal(owner.deleteAiVideoCanvas("account-a", created.id), true);
  assert.equal(existsSync(storedPath), false);
  assert.deepEqual(owner.listAiVideoCanvases("account-a"), []);

  const legacyRoot = resolve(resolveUserDataPaths(process.env.LFAA_DATA_DIR, "legacy-account").projects, "aivideo");
  mkdirSync(legacyRoot, { recursive: true });
  const legacyCanvas = {
    id: randomUUID(), title: "迁移样片", shots: [{ id: randomUUID(), title: "开场", description: "雨夜街道", dialogue: "开始了。", durationSeconds: 5, x: 24, y: -12 }],
    links: [], createdAt: "2026-10-10T00:00:00.000Z", updatedAt: "2026-10-10T00:01:00.000Z"
  };
  const legacyText = `${JSON.stringify({ schemaVersion: 1, canvases: [legacyCanvas] }, null, 2)}\n`;
  const legacyPath = resolve(legacyRoot, "storyboards.json");
  const backupPath = resolve(legacyRoot, "storyboards.v1.migrated.json");
  const migratedProjectPath = resolve(legacyRoot, legacyCanvas.id, "project.json");
  writeFileSync(legacyPath, legacyText, "utf8");
  const migratedLegacyCanvases = owner.listAiVideoCanvases("legacy-account");
  assert.equal(migratedLegacyCanvases.length, 1);
  const migratedLegacyCanvas = migratedLegacyCanvases[0];
  assert.equal(migratedLegacyCanvas.id, legacyCanvas.id);
  assert.equal(migratedLegacyCanvas.title, legacyCanvas.title);
  assert.equal(migratedLegacyCanvas.script, "");
  assert.deepEqual(migratedLegacyCanvas.characters, []);
  assert.deepEqual(migratedLegacyCanvas.locations, []);
  assert.deepEqual(migratedLegacyCanvas.shots[0], { ...legacyCanvas.shots[0], characterIds: [] });
  assert.deepEqual(migratedLegacyCanvas.links, []);
  assert.deepEqual(migratedLegacyCanvas.mediaAssets, []);
  assert.deepEqual(migratedLegacyCanvas.timelineClips, []);
  assert.equal(existsSync(legacyPath), false);
  assert.equal(readFileSync(backupPath, "utf8"), legacyText);
  assert.deepEqual(JSON.parse(readFileSync(migratedProjectPath, "utf8")).canvas, migratedLegacyCanvas);
  assert.deepEqual(owner.listAiVideoCanvases("legacy-account"), migratedLegacyCanvases);

  const conflictCanvas = owner.createAiVideoCanvas("conflict-account", "本地版本");
  const conflictRoot = resolve(resolveUserDataPaths(process.env.LFAA_DATA_DIR, "conflict-account").projects, "aivideo");
  const conflictPath = resolve(conflictRoot, "storyboards.json");
  const divergent = { ...conflictCanvas, title: "旧文件版本" };
  const conflictText = `${JSON.stringify({ schemaVersion: 1, canvases: [divergent] }, null, 2)}\n`;
  writeFileSync(conflictPath, conflictText, "utf8");
  assert.throws(() => owner.listAiVideoCanvases("conflict-account"), /内容冲突/u);
  assert.equal(readFileSync(conflictPath, "utf8"), conflictText);
  assert.equal(JSON.parse(readFileSync(resolve(conflictRoot, conflictCanvas.id, "project.json"), "utf8")).canvas.title, "本地版本");

  const resumeRoot = resolve(resolveUserDataPaths(process.env.LFAA_DATA_DIR, "resume-account").projects, "aivideo");
  mkdirSync(resumeRoot, { recursive: true });
  const resumedCanvas = {
    id: randomUUID(), title: "已迁移部分", shots: [], links: [], createdAt: "2026-10-10T00:00:00.000Z", updatedAt: "2026-10-10T00:02:00.000Z"
  };
  const pendingCanvas = {
    id: randomUUID(), title: "待迁移部分", shots: [], links: [], createdAt: "2026-10-10T00:00:00.000Z", updatedAt: "2026-10-10T00:01:00.000Z"
  };
  mkdirSync(resolve(resumeRoot, resumedCanvas.id), { recursive: true });
  writeFileSync(resolve(resumeRoot, resumedCanvas.id, "project.json"), `${JSON.stringify({ format: "lfaa-aivideo-project", formatVersion: 1, canvas: resumedCanvas }, null, 2)}\n`, "utf8");
  writeFileSync(resolve(resumeRoot, "storyboards.json"), `${JSON.stringify({ schemaVersion: 1, canvases: [resumedCanvas, pendingCanvas] }, null, 2)}\n`, "utf8");
  const resumed = owner.listAiVideoCanvases("resume-account");
  assert.deepEqual(resumed.map(item => item.id), [resumedCanvas.id, pendingCanvas.id]);
  assert.ok(existsSync(resolve(resumeRoot, "storyboards.v1.migrated.json")));

  const corruptRoot = resolve(resolveUserDataPaths(process.env.LFAA_DATA_DIR, "corrupt-account").projects, "aivideo");
  mkdirSync(corruptRoot, { recursive: true });
  writeFileSync(resolve(corruptRoot, "storyboards.json"), "{broken", "utf8");
  assert.throws(() => owner.listAiVideoCanvases("corrupt-account"));
  assert.equal(readFileSync(resolve(corruptRoot, "storyboards.json"), "utf8"), "{broken");

  const linkedProjects = resolveUserDataPaths(process.env.LFAA_DATA_DIR, "linked-account").projects;
  const linkedRoot = resolve(linkedProjects, "aivideo");
  const linkedId = randomUUID();
  const externalProject = resolve(linkedProjects, "aivideo-external-project");
  mkdirSync(linkedRoot, { recursive: true });
  mkdirSync(externalProject, { recursive: true });
  symlinkSync(externalProject, resolve(linkedRoot, linkedId), process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => owner.listAiVideoCanvases("linked-account"), /符号链接|存储类型无效/u);

  const sqlite = await import("lfaa-storage-sqlite/src/database.js");
  const { database } = sqlite;
  // 模拟完成旧文件存储协调后的 v31 基线，再按生产迁移顺序升到当前结构。
  await import("lfaa-session-persistence-jsonl/src/repository.js");
  await import("lfaa-storage-domain/src/configuration.js");
  database.exec("ALTER TABLE ai_sessions ADD COLUMN jsonl_revision TEXT; PRAGMA user_version = 31;");
  for (const migrate of [
    sqlite.migrateWorkspaceSchema,
    sqlite.migrateWritingCatalogSchema,
    sqlite.migrateExecutionControlSchema,
    sqlite.migrateMinecraftCoreSchema,
    sqlite.migrateWorkspaceProjectSchema,
    sqlite.migrateWorkspaceGitSchema,
    sqlite.migrateWorkspaceProjectApplicationSchema,
    sqlite.migrateWritingEditProposalSchema,
    sqlite.migrateStorageHubSchema,
    sqlite.migrateWritingBookProfileSchema,
    sqlite.migrateKnowledgeLibrarySchema,
    sqlite.migrateConversationMemorySchema,
    sqlite.migrateMinecraftWorkflowSchema,
    sqlite.migrateApplicationWorkflowSchema,
    sqlite.migrateWorkflowRunCurrentNodeSchema,
    sqlite.migrateConfigurationStorageSchema,
    sqlite.migratePermissionDecisionModeSchema,
    sqlite.migrateHostTaskTimeoutSchema,
    sqlite.migrateApplicationIdSchema
  ]) migrate();
  const { migrateApplicationIdSchema } = sqlite;
  database.prepare("INSERT INTO users (id, username, password_salt, password_hash, role) VALUES (?, ?, 'salt', 'hash', 'member')").run("migration-owner", "migration-owner");
  database.prepare("INSERT INTO user_preferences (user_id, selected_app, selected_mode) VALUES (?, 'writing', 'normal')").run("migration-owner");
  database.prepare("INSERT INTO ai_sessions (id, user_id, app_id, title) VALUES ('migration-session', 'migration-owner', 'writing', '保留会话')").run();
  database.prepare(`INSERT INTO ai_tool_approvals (id,user_id,session_id,app_id,tool_id,tool_version,risk,summary,scope_summary,action_hash,scope_hash)
    VALUES ('migration-approval','migration-owner','migration-session','writing','fixture.tool','1','write','保留审批','目标范围','${"a".repeat(64)}','${"b".repeat(64)}')`).run();
  database.prepare(`INSERT INTO ai_tool_permission_grants (id,user_id,app_id,tool_id,tool_version,risk,scope_hash,summary,scope_summary)
    VALUES ('migration-grant','migration-owner','writing','fixture.tool','1','write','${"b".repeat(64)}','保留授权','目标范围')`).run();
  database.prepare("INSERT INTO daemon_nodes (id,display_name,platform,architecture,daemon_version,status,last_seen_at) VALUES ('migration-node','节点','linux','x64','test','offline','2026-10-10T00:00:00.000Z')").run();
  database.prepare(`INSERT INTO ai_host_tasks (id,node_id,created_by,app_id,shell,working_directory,command,timeout_seconds,status,message)
    VALUES ('migration-task','migration-node','migration-owner','writing','system','/tmp','fixture',0,'queued','保留任务')`).run();
  database.prepare(`INSERT INTO knowledge_library_items (id,user_id,application_id,kind,title,content_markdown,content_sha256,source_kind)
    VALUES ('migration-knowledge','migration-owner','writing','knowledge','保留资料','正文','${"c".repeat(64)}','manual')`).run();
  database.prepare("INSERT INTO workflow_definitions (id,user_id,application_id,title,definition_json) VALUES ('migration-workflow','migration-owner','writing','保留工作流','{}')").run();
  const beforeCounts = appIdTables.map(([table]) => Number(database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count));
  removeAiVideoFromApplicationConstraints(database);
  migrateApplicationIdSchema();
  assert.equal(Number(database.prepare("PRAGMA user_version").get().user_version), 50);
  assert.deepEqual(database.prepare("PRAGMA foreign_key_check").all(), []);
  assert.deepEqual(appIdTables.map(([table]) => Number(database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count)), beforeCounts);
  assert.equal(database.prepare("SELECT selected_app FROM user_preferences WHERE user_id = 'migration-owner'").get().selected_app, "writing");
  assert.equal(database.prepare("SELECT app_id FROM ai_sessions WHERE id = 'migration-session'").get().app_id, "writing");
  assert.equal(database.prepare("SELECT application_id FROM workflow_definitions WHERE id = 'migration-workflow'").get().application_id, "writing");
  database.prepare("UPDATE user_preferences SET selected_app = 'aivideo' WHERE user_id = 'migration-owner'").run();
  database.prepare("INSERT INTO ai_sessions (id,user_id,app_id,title) VALUES ('aivideo-session','migration-owner','aivideo','漫剧会话')").run();
  database.prepare(`INSERT INTO ai_tool_approvals (id,user_id,session_id,app_id,tool_id,tool_version,risk,summary,scope_summary,action_hash,scope_hash)
    VALUES ('aivideo-approval','migration-owner','aivideo-session','aivideo','fixture.tool','1','write','漫剧审批','目标范围','${"d".repeat(64)}','${"e".repeat(64)}')`).run();
  database.prepare(`INSERT INTO ai_tool_permission_grants (id,user_id,app_id,tool_id,tool_version,risk,scope_hash,summary,scope_summary)
    VALUES ('aivideo-grant','migration-owner','aivideo','fixture.tool','1','write','${"e".repeat(64)}','漫剧授权','目标范围')`).run();
  database.prepare(`INSERT INTO ai_host_tasks (id,node_id,created_by,app_id,shell,working_directory,command,timeout_seconds,status,message)
    VALUES ('aivideo-task','migration-node','migration-owner','aivideo','system','/tmp','fixture',0,'queued','漫剧任务')`).run();
  database.prepare(`INSERT INTO knowledge_library_items (id,user_id,application_id,kind,title,content_markdown,content_sha256,source_kind)
    VALUES ('aivideo-knowledge','migration-owner','aivideo','knowledge','漫剧资料','正文','${"f".repeat(64)}','manual')`).run();
  database.prepare("INSERT INTO workflow_definitions (id,user_id,application_id,title,definition_json) VALUES ('aivideo-workflow','migration-owner','aivideo','漫剧工作流','{}')").run();
  assert.equal(database.prepare("SELECT selected_app FROM user_preferences WHERE user_id = 'migration-owner'").get().selected_app, "aivideo");

  const shots = Array.from({ length: owner.AI_VIDEO_CANVAS_LIMITS.shots + 1 }, () => ({ id: randomUUID(), title: "镜头", description: "", dialogue: "", durationSeconds: 3, x: 0, y: 0 }));
  assert.throws(() => owner.normalizeAiVideoCanvasInput({ title: "超限", shots, links: [] }), /最多保存 64 个镜头/u);
  assert.throws(() => owner.normalizeAiVideoCanvasInput({ title: "越界", shots: [{ ...shots[0], x: 50_001 }], links: [] }), /画布范围/u);
  assert.throws(() => owner.normalizeAiVideoCanvasInput({ title: "无效连线", shots: [shots[0]], links: [{ id: randomUUID(), source: shots[0].id, target: randomUUID() }] }), /两个不同的现有镜头/u);
  assert.throws(() => owner.normalizeAiVideoCanvasInput({ title: "额外字段", shots: [], links: [], runWorkflow: true }), /格式无效/u);
});
