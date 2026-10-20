/**
 * 功能：验证 Agent 的本机项目文件工具不经由本机 Daemon 节点。
 * 作用：绑定本地 WorkspaceProject 时使用 LFAA Host；Agent Git 仓库则复用同一受限本机执行器。
 * 关联文件：packages/core/tools/src/project-tools.ts、packages/host/project-files/src/project-files.mjs。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("本机 Agent 首次写入前初始化 Git 并绑定会话，不创建 Daemon 节点任务", () => {
  const data = mkdtempSync(join(tmpdir(), "lfaa-agent-local-workspace-data-"));
  const home = mkdtempSync(join(tmpdir(), "lfaa-agent-local-workspace-home-"));
  const root = mkdtempSync(join(tmpdir(), "lfaa-agent-local-workspace-root-"));
  mkdirSync(root, { recursive: true });
  try {
    const script = [
      "import assert from 'node:assert/strict';",
      "import { stat } from 'node:fs/promises';",
      "import { database, closeDatabase } from 'lfaa-storage-sqlite/src/database.js';",
      "import { configuration } from 'lfaa-storage-domain/src/configuration.js';",
      "import { sessionRecords } from 'lfaa-session-persistence-jsonl/src/repository.js';",
      "import * as sessions from 'lfaa-session/src/sessions.js';",
      "import * as agentGit from 'lfaa-workspace-agent-git';",
      "import { retireLegacyFileTables } from 'lfaa-storage-domain/src/migration.js';",
      "import { projectFileTool } from 'lfaa-tools/src/project-tools.js';",
      "retireLegacyFileTables();",
      "database.prepare(\"INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('agent-local-workspace',731,'agent-local-workspace','salt','hash','admin',0)\").run();",
      "const root = process.env.AGENT_LOCAL_WORKSPACE_ROOT;",
      "const session = sessions.createAiTurn('agent-local-workspace', 'workspace', null, '创建一个文件').session;",
      "const context = { userId: 'agent-local-workspace', sessionId: session.id, applicationId: 'workspace', workspaceProject: { nodeId: 'local-node-id', path: root, title: '默认工作区' } };",
      "const prepared = projectFileTool.prepare({ operation: 'create', path: 'index.html', content: '<h1>hello</h1>' }, context);",
      "assert.equal(prepared.localExecution, true);",
      "assert.equal(prepared.rootDirectory, root);",
      "assert.equal(projectFileTool.risk({ ...prepared, operation: 'read' }), 'read');",
      "let received = null;",
      "const result = await projectFileTool.execute(prepared, { ...context, executeLocalProjectFile: async input => { received = input; return { created: true, path: input.path }; } });",
      "assert.equal(received.rootDirectory, root);",
      "assert.equal(received.path, 'index.html');",
      "assert.equal(result.result.created, true);",
      "await stat(root + '/.git');",
      "const registered = agentGit.listAgentGitRepositories(context.userId);",
      "assert.equal(registered.length, 1, '真实项目自动加入 Agent Git 摘要');",
      "assert.equal(registered[0].path, root);",
      "assert.equal(agentGit.getAgentGitSessionRepository(context.userId, session.id).id, registered[0].id, '当前 Agent 会话自动绑定项目 Git');",
      "assert.equal(database.prepare('SELECT COUNT(*) AS count FROM ai_host_tasks').get().count, 0, '本机文件操作不派发 Daemon HostTask');",
      "configuration.close(); sessionRecords.close(); closeDatabase();"
    ].join("\n");
    const loader = new URL("../register-package-loader.mjs", import.meta.url).href;
    execFileSync(process.execPath, ["--import", "tsx", "--import", loader, "--input-type=module", "-e", script], {
      cwd: cli,
      env: { ...process.env, NODE_ENV: "test", LFAA_HOME: home, LFAA_DATA_DIR: data, AGENT_LOCAL_WORKSPACE_ROOT: root },
      encoding: "utf8", stdio: "pipe", timeout: 20000
    });
  } finally {
    for (const path of [data, home, root]) {
      assert.notEqual(resolve(path), resolve(tmpdir()));
      rmSync(path, { recursive: true, force: true });
    }
  }
});
