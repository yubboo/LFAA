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
  const data = mkdtempSync(join(tmpdir(), "lfaa-workflow-core-"));
  const databaseDirectory = join(data, "database");
  const databasePath = join(databaseDirectory, "lfaa.sqlite");
  mkdirSync(databaseDirectory, { recursive: true });
  const seeded = new DatabaseSync(databasePath);
  seeded.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE users (id TEXT PRIMARY KEY NOT NULL) STRICT;
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
      "assert.equal(Number(database.prepare('PRAGMA user_version').get().user_version), 47);",
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
      env: { ...process.env, NODE_ENV: "test", LFAA_DATA_DIR: data, JWT_SECRET: "" },
      encoding: "utf8",
      stdio: "pipe",
      timeout: 20_000
    });
  } finally {
    rmSync(data, { recursive: true, force: true });
  }
});
