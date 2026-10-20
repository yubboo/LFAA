/**
 * 功能：回归 Agent 会话使用 Workspace Owner 当前登记路径，而不改写历史 Session 快照。
 * 作用：验证路径修复后下一轮工具调用不会继续写入已过期的旧目录。
 * 关联文件：packages/core/agent-loop/src/workspace-context.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("Agent Loop follows the current registered project path without rewriting the session snapshot", () => {
  const data = mkdtempSync(join(tmpdir(), "lfaa-agent-workspace-context-data-"));
  const home = mkdtempSync(join(tmpdir(), "lfaa-agent-workspace-context-home-"));
  const root = mkdtempSync(join(tmpdir(), "lfaa-agent-workspace-context-root-"));
  try {
    const script = [
      "import assert from 'node:assert/strict';",
      "import { randomUUID } from 'node:crypto';",
      "import { database, closeDatabase } from 'lfaa-storage-sqlite/src/database.js';",
      "import { configuration } from 'lfaa-storage-domain/src/configuration.js';",
      "import { sessionRecords } from 'lfaa-session-persistence-jsonl/src/repository.js';",
      "import { retireLegacyFileTables } from 'lfaa-storage-domain/src/migration.js';",
      "import * as sessions from 'lfaa-session/src/sessions.js';",
      "import { createWorkspaceProject, removeWorkspaceProject } from 'lfaa-workspace-workspace/src/index.js';",
      "import { resolveAiSessionWorkspaceContext } from 'lfaa-agent-loop/src/workspace-context.js';",
      "retireLegacyFileTables();",
      "const owner = 'fixture-agent-workspace-context'; const uid = 741; const nodeId = randomUUID();",
      "database.prepare(\"INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES (?,?,?,'salt','hash','admin',0)\").run(owner, uid, owner);",
      "database.prepare(\"INSERT INTO daemon_nodes(id,display_name,platform,architecture,daemon_version,status,last_seen_at) VALUES (?,'local fixture','win32','x64','test','offline','2026-10-20T00:00:00.000Z')\").run(nodeId);",
      "const correct = process.env.AGENT_WORKSPACE_CONTEXT_ROOT + '/correct'; const stale = process.env.AGENT_WORKSPACE_CONTEXT_ROOT + '/stale';",
      "const project = createWorkspaceProject({ userId: owner, appId: 'workspace', nodeId, path: correct, platform: 'win32', title: '默认工作区' });",
      "const session = sessions.createAiTurn(owner, 'workspace', null, '继续工作', false, { id: project.id, appId: 'workspace', nodeId, path: stale, title: '旧快照' }).session;",
      "assert.equal(resolveAiSessionWorkspaceContext(owner, session.id).path, correct);",
      "assert.equal(sessions.getAiSessionWorkspaceContext(owner, session.id).path, stale, '运行时解析不得改写 Session 快照');",
      "assert.equal(removeWorkspaceProject(owner, project.id, 'workspace'), true);",
      "assert.equal(resolveAiSessionWorkspaceContext(owner, session.id).path, stale, '已移除登记仍保留历史快照回退');",
      "configuration.close(); sessionRecords.close(); closeDatabase();"
    ].join("\n");
    const loader = new URL("../register-package-loader.mjs", import.meta.url).href;
    execFileSync(process.execPath, ["--import", "tsx", "--import", loader, "--input-type=module", "-e", script], {
      cwd: cli,
      env: { ...process.env, NODE_ENV: "test", LFAA_HOME: home, LFAA_DATA_DIR: data, AGENT_WORKSPACE_CONTEXT_ROOT: root },
      encoding: "utf8", stdio: "pipe", timeout: 20000
    });
  } finally {
    for (const path of [data, home, root]) {
      assert.notEqual(resolve(path), resolve(tmpdir()));
      rmSync(path, { recursive: true, force: true });
    }
  }
});
