/**
 * 功能：回归通用工作流 v45 迁移与 App/账户隔离。
 * 作用：使用隔离临时 SQLite 数据验证旧 Minecraft 图保留，且不会泄露到其他 App。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("v44 Minecraft 工作流保留并迁移到账户文件，SQLite 只保留 App 索引", () => {
  const isolated = mkdtempSync(join(tmpdir(), "lfaa-workflow-core-"));
  const home = join(isolated, "home");
  const data = join(isolated, "data");
  const databaseDirectory = join(home, "database");
  const databasePath = join(databaseDirectory, "lfaa.sqlite");
  mkdirSync(databaseDirectory, { recursive: true });
  const seeded = new DatabaseSync(databasePath);
  seeded.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE users (id TEXT PRIMARY KEY NOT NULL) STRICT;
    CREATE TABLE daemon_nodes (id TEXT PRIMARY KEY NOT NULL) STRICT;
    -- v44 已含 v36/v38 的账户项目目录与 App 归属；后续 v60 迁移会重建此表。
    CREATE TABLE workspace_projects (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      node_id TEXT NOT NULL REFERENCES daemon_nodes(id) ON DELETE RESTRICT,
      path TEXT NOT NULL,
      path_key TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      app_id TEXT CHECK (app_id IN ('workspace', 'minecraft'))
    ) STRICT;
    -- v44 的 Minecraft 执行队列表仍由 Minecraft Owner 持有；后续 v55/v56 迁移会扩展它。
    CREATE TABLE minecraft_instances (id TEXT PRIMARY KEY NOT NULL) STRICT;
    CREATE TABLE minecraft_deployments (id TEXT PRIMARY KEY NOT NULL) STRICT;
    CREATE TABLE minecraft_tasks (
      id TEXT PRIMARY KEY NOT NULL,
      node_id TEXT NOT NULL REFERENCES daemon_nodes(id) ON DELETE RESTRICT,
      instance_id TEXT REFERENCES minecraft_instances(id) ON DELETE SET NULL,
      created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      kind TEXT NOT NULL CHECK (kind IN ('install', 'start', 'stop', 'properties', 'backup', 'java-install', 'restart', 'console')),
      status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
      progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
      message TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      result_json TEXT,
      created_at TEXT NOT NULL,
      started_at TEXT,
      finished_at TEXT,
      lease_expires_at TEXT,
      deployment_id TEXT REFERENCES minecraft_deployments(id) ON DELETE SET NULL
    ) STRICT;
    CREATE INDEX minecraft_tasks_node_queue_idx ON minecraft_tasks(node_id, status, created_at);
    CREATE INDEX minecraft_tasks_recent_idx ON minecraft_tasks(created_at DESC);
    CREATE INDEX minecraft_tasks_lease_idx ON minecraft_tasks(status, lease_expires_at);
    CREATE INDEX minecraft_tasks_deployment_idx ON minecraft_tasks(deployment_id, created_at DESC);
    -- v44 已包含写作目录结构；这些空表让后续 v51 文件化迁移运行在真实旧版结构上。
    CREATE TABLE writing_books (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      outline_content TEXT NOT NULL DEFAULT ''
    ) STRICT;
    CREATE TABLE writing_volumes (
      id TEXT PRIMARY KEY NOT NULL,
      book_id TEXT NOT NULL REFERENCES writing_books(id) ON DELETE CASCADE,
      title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
      sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      UNIQUE(book_id, sort_order)
    ) STRICT;
    CREATE TABLE writing_chapters (
      id TEXT PRIMARY KEY NOT NULL,
      book_id TEXT NOT NULL REFERENCES writing_books(id) ON DELETE CASCADE,
      title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
      content TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      volume_id TEXT REFERENCES writing_volumes(id) ON DELETE CASCADE,
      UNIQUE(book_id, sort_order)
    ) STRICT;
    CREATE TABLE writing_chapter_revisions (
      id TEXT PRIMARY KEY NOT NULL,
      chapter_id TEXT NOT NULL REFERENCES writing_chapters(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ) STRICT;
    CREATE TABLE writing_book_outline_revisions (
      id TEXT PRIMARY KEY NOT NULL,
      book_id TEXT NOT NULL REFERENCES writing_books(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ) STRICT;
    -- v44 已包含早期文件任务队列；v52 会按当前合同扩展操作集合。
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
    CREATE TABLE user_preferences (
      user_id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      selected_app TEXT NOT NULL CHECK (selected_app IN ('steamcmd', 'minecraft', 'writing')),
      selected_mode TEXT NOT NULL CHECK (selected_mode IN ('normal', 'ai-work'))
    ) STRICT;
    CREATE TABLE ai_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      app_id TEXT NOT NULL CHECK (app_id IN ('steamcmd', 'minecraft', 'writing', 'workspace')),
      title TEXT NOT NULL
    ) STRICT;
    -- v44 已有节点任务队列；v49 放宽超时约束，v50 扩展 AI 漫剧 App 作用域。
    CREATE TABLE ai_host_tasks (
      id TEXT PRIMARY KEY NOT NULL,
      node_id TEXT NOT NULL REFERENCES daemon_nodes(id) ON DELETE CASCADE,
      created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      app_id TEXT NOT NULL CHECK (app_id IN ('steamcmd', 'minecraft', 'writing', 'workspace')),
      shell TEXT NOT NULL CHECK (shell IN ('system', 'powershell', 'cmd', 'bash', 'zsh', 'project-files')),
      working_directory TEXT NOT NULL,
      command TEXT NOT NULL,
      timeout_seconds INTEGER NOT NULL DEFAULT 60 CHECK (timeout_seconds BETWEEN 1 AND 1800),
      status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
      message TEXT NOT NULL,
      result_json TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      started_at TEXT,
      finished_at TEXT,
      lease_expires_at TEXT,
      cancel_requested INTEGER NOT NULL DEFAULT 0 CHECK (cancel_requested IN (0, 1)),
      output_sequence INTEGER NOT NULL DEFAULT 0
    ) STRICT;
    CREATE INDEX ai_host_tasks_node_queue_idx ON ai_host_tasks(node_id, status, created_at);
    CREATE INDEX ai_host_tasks_retention_idx ON ai_host_tasks(status, finished_at);
    -- v44 已包含审批表；后续权限迁移会为它补充决策模式列和索引。
    CREATE TABLE ai_tool_approvals (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_id TEXT NOT NULL,
      app_id TEXT NOT NULL CHECK (app_id IN ('steamcmd', 'minecraft', 'writing', 'workspace')),
      tool_id TEXT NOT NULL,
      tool_version TEXT NOT NULL,
      risk TEXT NOT NULL,
      summary TEXT NOT NULL,
      scope_summary TEXT NOT NULL,
      action_hash TEXT NOT NULL,
      scope_hash TEXT NOT NULL,
      status TEXT NOT NULL,
      requested_at TEXT NOT NULL,
      expires_at TEXT,
      decided_at TEXT,
      decided_by TEXT REFERENCES users(id) ON DELETE SET NULL
    ) STRICT;
    CREATE TABLE ai_tool_permission_grants (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      app_id TEXT NOT NULL CHECK (app_id IN ('steamcmd', 'minecraft', 'writing', 'workspace')),
      tool_id TEXT NOT NULL,
      tool_version TEXT NOT NULL,
      risk TEXT NOT NULL,
      scope_hash TEXT NOT NULL,
      summary TEXT NOT NULL,
      scope_summary TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    ) STRICT;
    CREATE TABLE knowledge_library_items (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      application_id TEXT NOT NULL CHECK (application_id IN ('all', 'workspace', 'steamcmd', 'minecraft', 'writing')),
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      content_markdown TEXT NOT NULL,
      content_sha256 TEXT NOT NULL,
      source_kind TEXT NOT NULL
    ) STRICT;
    CREATE TABLE workflow_definitions (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
      definition_json TEXT NOT NULL CHECK (length(definition_json) <= 65536),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      UNIQUE (user_id, id)
    ) STRICT;
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
    INSERT INTO users(id) VALUES ('owner'), ('other');
    INSERT INTO workflow_definitions(id,user_id,title,definition_json) VALUES
      ('legacy-minecraft','owner','Legacy', '{"nodes":[{"id":"agent-1","title":"旧 Agent","prompt":"检查状态","toolNames":[],"x":32,"y":64}],"edges":[]}');
    PRAGMA user_version = 44;
  `);
  seeded.close();

  try {
    const script = [
      "import assert from 'node:assert/strict';",
      "const { database } = await import('lfaa-storage-sqlite/src/database.js');",
      "assert.equal(Number(database.prepare('PRAGMA user_version').get().user_version), 79);",
      "assert.ok(database.prepare('PRAGMA table_info(workflow_runs)').all().some(column => column.name === 'current_node_id'));",
      "assert.equal(database.prepare('SELECT application_id FROM workflow_definitions WHERE id = ?').get('legacy-minecraft').application_id, 'minecraft');",
      "const { createWorkflow, getWorkflow, listWorkflows, updateWorkflow } = await import('lfaa-workflow/src/service.js');",
      "const { resolveUserDataPaths } = await import('lfaa-home-paths/src/data-layout.mjs');",
      "const { readdirSync, readFileSync } = await import('node:fs');",
      "const { join } = await import('node:path');",
      "const legacy = listWorkflows('owner','minecraft')[0];",
      "assert.equal(legacy.id, 'legacy-minecraft');",
      "assert.equal(legacy.nodes[0].type, 'minecraft.agent');",
      "assert.equal(legacy.nodes[0].data.prompt, '检查状态');",
      "assert.equal(legacy.nodes[0].x, 32);",
      "const legacyDirectory=resolveUserDataPaths(process.env.LFAA_DATA_DIR,'owner').workflows('minecraft');",
      "const legacyFiles=readdirSync(legacyDirectory); assert.equal(legacyFiles.length,1);",
      "assert.equal(JSON.parse(readFileSync(join(legacyDirectory,legacyFiles[0]),'utf8')).nodes[0].data.prompt,'检查状态');",
      "assert.equal(database.prepare('SELECT definition_json FROM workflow_definitions WHERE id=?').get('legacy-minecraft').definition_json,'{}');",
      "assert.equal(listWorkflows('owner','writing').length, 0);",
      "assert.equal(listWorkflows('other','minecraft').length, 0);",
      "assert.equal(getWorkflow('owner','writing','legacy-minecraft'), null);",
      "assert.equal(getWorkflow('other','minecraft','legacy-minecraft'), null);",
      "const writing = createWorkflow('owner','writing',{title:'Writing Flow',nodes:[],edges:[]});",
      "assert.equal(writing.appId, 'writing');",
      "assert.equal(database.prepare('SELECT definition_json FROM workflow_definitions WHERE id=?').get(writing.id).definition_json,'{}');",
      "const updatedWriting=updateWorkflow('owner','writing',writing.id,{title:'Updated Writing Flow',nodes:[],edges:[]});",
      "assert.equal(updatedWriting.title,'Updated Writing Flow');",
      "assert.equal(JSON.parse(readFileSync(join(resolveUserDataPaths(process.env.LFAA_DATA_DIR,'owner').workflows('writing'),readdirSync(resolveUserDataPaths(process.env.LFAA_DATA_DIR,'owner').workflows('writing'))[0]),'utf8')).title,'Updated Writing Flow');",
      "assert.deepEqual(listWorkflows('owner','minecraft').map(item => item.id), ['legacy-minecraft']);",
      "assert.deepEqual(listWorkflows('owner','writing').map(item => item.id), [writing.id]);",
      "const retired = createWorkflow('owner','minecraft',{title:'Retired Node',nodes:[{id:'retired-node',type:'fixture.retired-node',version:3,title:'Retired',data:{payload:'preserve-me'},x:128,y:256}],edges:[]});",
      "assert.deepEqual({type:retired.nodes[0].type,version:retired.nodes[0].version,data:retired.nodes[0].data,x:retired.nodes[0].x,y:retired.nodes[0].y},{type:'fixture.retired-node',version:3,data:{payload:'preserve-me'},x:128,y:256});",
      "const { Context } = await import('@deepseek-ai/cordis');",
      "const workflowCore = await import('lfaa-workflow/src/index.js');",
      "const { registerWorkflowNodeProvider, registerWorkflowEngine, validateWorkflowRun } = await import('lfaa-workflow/src/registry.js');",
      "const { listWorkflowNodeTypes, listWorkflowEngineTypes } = await import('lfaa-workflow/src/service.js');",
      "const context = new Context();",
      "const coreFiber = await context.plugin(workflowCore);",
      "const provider = {id:'fixture.retired-provider',applicationIds:['minecraft'],nodes:[{type:'fixture.retired-node',version:3,name:'Retired',description:'Test node',applicationIds:['minecraft'],defaultData:{payload:''},inputPorts:[],outputPorts:[{id:'out',valueType:'text'}],normalizeData:value=>value,execute:()=>({outputs:{out:'fixture'}})}]};",
      "const engine = {id:'fixture.engine.replacement',version:1,applicationIds:['minecraft'],name:'Replacement',execute:async()=>{}};",
      "const loadProvider = () => context.plugin({name:'fixture-retired-provider',apply(ctx){registerWorkflowNodeProvider(ctx,provider);registerWorkflowEngine(ctx,engine);}});",
      "let providerFiber = await loadProvider();",
      "try {",
      "  assert.ok((await listWorkflowNodeTypes('minecraft','owner','admin')).some(node=>node.type==='fixture.retired-node'));",
      "  assert.ok(listWorkflowEngineTypes('minecraft').some(item=>item.id==='fixture.engine.replacement'));",
      "  validateWorkflowRun({userId:'owner',userRole:'admin',appId:'minecraft',definition:retired,options:{}});",
      "  await providerFiber.dispose(); providerFiber = null;",
      "  assert.equal((await listWorkflowNodeTypes('minecraft','owner','admin')).some(node=>node.type==='fixture.retired-node'),false);",
      "  assert.equal(listWorkflowEngineTypes('minecraft').some(item=>item.id==='fixture.engine.replacement'),false);",
      "  assert.throws(()=>validateWorkflowRun({userId:'owner',userRole:'admin',appId:'minecraft',definition:retired,options:{}}),/所需的提供方未启用/u);",
      "  const unavailable = getWorkflow('owner','minecraft',retired.id);",
      "  assert.deepEqual({type:unavailable.nodes[0].type,version:unavailable.nodes[0].version,data:unavailable.nodes[0].data,x:unavailable.nodes[0].x,y:unavailable.nodes[0].y},{type:'fixture.retired-node',version:3,data:{payload:'preserve-me'},x:128,y:256});",
      "  providerFiber = await loadProvider();",
      "  validateWorkflowRun({userId:'owner',userRole:'admin',appId:'minecraft',definition:getWorkflow('owner','minecraft',retired.id),options:{}});",
      "} finally { if(providerFiber) await providerFiber.dispose(); await coreFiber.dispose(); await context.fiber.dispose(); }",
      "database.close();"
    ].join("\n");
    execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "--input-type=module", "-e", script], {
      cwd: cli,
      env: { ...process.env, NODE_ENV: "test", LFAA_HOME: home, LFAA_DATA_DIR: data, JWT_SECRET: "" },
      encoding: "utf8",
      stdio: "pipe",
      timeout: 20_000
    });
  } finally {
    rmSync(isolated, { recursive: true, force: true });
  }
});
