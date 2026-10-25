/**
 * 功能：回归历史会话项目目录状态的认证查询。
 * 作用：使用真实 Session/Workspace Owner 与 Project Files Host，验证缺失、解除登记但仍存在和账户隔离。
 * 关联文件：packages/api/workspace-controller/src/index.ts、packages/core/session/src/sessions.ts、packages/host/project-files/src/project-files.mjs。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("会话目录查询区分缺失、仍存在、离线节点与其他账户且只暴露状态", () => {
  const parent = resolve(tmpdir());
  const data = mkdtempSync(join(parent, "lfaa-session-directory-data-"));
  const home = mkdtempSync(join(parent, "lfaa-session-directory-home-"));
  const root = mkdtempSync(join(parent, "lfaa-session-directory-paths-"));
  try {
    const script = [
      "import assert from 'node:assert/strict';",
      "import { randomUUID } from 'node:crypto';",
      "import { mkdirSync, rmSync } from 'node:fs';",
      "import { join } from 'node:path';",
      "import { database, closeDatabase } from 'lfaa-storage-sqlite/src/database.js';",
      "await import('lfaa-settings/src/service.js');",
      "await import('lfaa-storage-domain/src/configuration.js');",
      "await import('lfaa-session-persistence-jsonl/src/repository.js');",
      "const { retireLegacyFileTables } = await import('lfaa-storage-domain/src/migration.js'); retireLegacyFileTables();",
      "const owner = 'fixture-directory-owner';",
      "const otherOwner = 'fixture-directory-other';",
      "for (const [id, uid] of [[owner, 301], [otherOwner, 302]]) database.prepare(\"INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES (?,?,?,'salt','hash','admin',0)\").run(id, uid, id);",
      "const { createWorkspaceProject, removeWorkspaceProject } = await import('lfaa-workspace-workspace/src/index.js');",
      "const sessions = await import('lfaa-session/src/sessions.js');",
      "const root = process.env.SESSION_DIRECTORY_FIXTURE_ROOT;",
      "function addSession(userId, name, nodeId = null) { const path = join(root, name); mkdirSync(path); const project = createWorkspaceProject({ userId, appId: 'workspace', nodeId, path, platform: process.platform, title: name }); const turn = sessions.createAiTurn(userId, 'workspace', null, name); sessions.finishAiAssistantMessage(userId, turn.session.id, turn.assistantMessage.id, '历史记录', 'complete'); sessions.setAiSessionProject(userId, turn.session.id, { id: project.id, appId: 'workspace', nodeId, path, title: name }); return { id: turn.session.id, project, path }; }",
      "const missing = addSession(owner, 'deleted');",
      "const retained = addSession(owner, 'registration-removed');",
      "const foreign = addSession(otherOwner, 'foreign');",
      "const offlineNodeId = randomUUID(); database.prepare(\"INSERT INTO daemon_nodes(id,display_name,platform,architecture,daemon_version,status,last_seen_at) VALUES (?, 'Offline fixture','linux','x64','test','offline','2026-10-01T00:00:00.000Z')\").run(offlineNodeId);",
      "const offline = addSession(owner, 'offline-node', offlineNodeId);",
      "const projectless = sessions.createAiTurn(owner, 'workspace', null, '无目录历史');",
      "sessions.finishAiAssistantMessage(owner, projectless.session.id, projectless.assistantMessage.id, '历史记录', 'complete');",
      "assert.equal(removeWorkspaceProject(owner, retained.project.id, 'workspace'), true);",
      "rmSync(missing.path, { recursive: true, force: true });",
      "const { executeProjectFile } = await import(process.env.PROJECT_FILES_MODULE);",
      "const { registerRoutes } = await import('lfaa-api-workspace-controller/src/index.js');",
      "let handler; const router = { get() {}, post(path, ...handlers) { if (path === '/workspace/sessions/directory-availability') handler = handlers.at(-1); }, patch() {}, delete() {} };",
      "registerRoutes(router, { executeLocalProjectFile: executeProjectFile }, null);",
      "const responseBody = await new Promise((resolve, reject) => { const response = { status(code) { this.statusCode = code; return this; }, json(value) { resolve(value); return this; } }; handler({ auth: { user: { id: owner } }, body: { sessionIds: [missing.id, retained.id, foreign.id, offline.id, projectless.session.id] } }, response, reject); });",
      "assert.deepEqual(responseBody.sessions, { [missing.id]: 'missing', [retained.id]: 'available', [foreign.id]: 'unknown', [offline.id]: 'unknown', [projectless.session.id]: 'unknown' });",
      "assert.equal(JSON.stringify(responseBody).includes(root), false, '状态 API 不泄露绝对路径');",
      "const { configuration } = await import('lfaa-storage-domain/src/configuration.js');",
      "const { sessionRecords } = await import('lfaa-session-persistence-jsonl/src/repository.js');",
      "configuration.close(); sessionRecords.close(); closeDatabase();",
      "process.stdout.write('会话目录状态查询回归通过');"
    ].join("\n");
    const output = execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "--input-type=module", "-e", script], {
      cwd: cli,
      env: { ...process.env, NODE_ENV: "test", LFAA_HOME: home, LFAA_DATA_DIR: data, LFAA_DAEMON_DATA_ROOT: data, SESSION_DIRECTORY_FIXTURE_ROOT: root, PROJECT_FILES_MODULE: pathToFileURL(resolve(cli, "../../packages/host/project-files/src/project-files.mjs")).href },
      encoding: "utf8",
      stdio: "pipe",
      timeout: 20000
    });
    assert.match(output, /会话目录状态查询回归通过/u);
  } finally {
    for (const directory of [data, home, root]) {
      assert.equal(dirname(resolve(directory)), parent);
      rmSync(directory, { recursive: true, force: true });
    }
  }
});
