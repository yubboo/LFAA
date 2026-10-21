/**
 * 功能：回归 Agent 本机 Git 仓库登记、Session 绑定与账户隔离。
 * 作用：使用隔离 SQLite 真实验证 Agent Git Owner，不创建 WorkspaceProject 或 Daemon 节点。
 * 关联文件：packages/workspace/agent-git/src/index.ts、storage-sqlite/database.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("Agent Git repositories are account-scoped and bind independently to Agent Sessions", () => {
  const data = mkdtempSync(join(tmpdir(), "lfaa-agent-git-data-"));
  const home = mkdtempSync(join(tmpdir(), "lfaa-agent-git-home-"));
  const repositoryRoot = mkdtempSync(join(tmpdir(), "lfaa-agent-git-repositories-"));
  const firstPath = join(repositoryRoot, "repo-one");
  const secondPath = join(repositoryRoot, "repo-two");
  mkdirSync(firstPath);
  mkdirSync(secondPath);
  try {
    const script = [
      "import assert from 'node:assert/strict';",
      "import { database, closeDatabase } from 'lfaa-storage-sqlite/src/database.js';",
      "import { configuration } from 'lfaa-storage-domain/src/configuration.js';",
      "import { sessionRecords } from 'lfaa-session-persistence-jsonl/src/repository.js';",
      "import { retireLegacyFileTables } from 'lfaa-storage-domain/src/migration.js';",
      "import * as sessions from 'lfaa-session/src/sessions.js';",
      "import * as agentGit from 'lfaa-workspace-agent-git';",
      "retireLegacyFileTables();",
      "assert.equal(Number(database.prepare('PRAGMA user_version').get().user_version), 60);",
      "const owner = 'fixture-agent-git-owner'; const other = 'fixture-agent-git-other';",
      "for (const [id, uid] of [[owner, 101], [other, 102]]) database.prepare(\"INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES (?,?,?,'salt','hash','admin',0)\").run(id, uid, id);",
      "const root = process.env.AGENT_GIT_FIXTURE_ROOT;",
      "const first = agentGit.registerAgentGitRepository({ userId: owner, path: root + '/repo-one', platform: 'win32' });",
      "const duplicate = agentGit.registerAgentGitRepository({ userId: owner, path: (root + '/repo-one').toUpperCase(), platform: 'win32' });",
      "assert.equal(first.id, duplicate.id, '同账户 Windows 路径不区分大小写并去重');",
      "const second = agentGit.registerAgentGitRepository({ userId: owner, path: root + '/repo-two', platform: 'win32' });",
      "assert.deepEqual(new Set(agentGit.listAgentGitRepositories(owner).map(item => item.id)), new Set([first.id, second.id]));",
      "assert.deepEqual(agentGit.listAgentGitRepositories(other), []);",
      "assert.equal(agentGit.getAgentGitRepository(other, first.id), null);",
      "const sessionA = sessions.createAiTurn(owner, 'workspace', null, 'Agent A').session;",
      "const sessionB = sessions.createAiTurn(owner, 'writing', null, 'Agent B').session;",
      "assert.equal(agentGit.bindAgentGitSessionRepository(owner, sessionA.id, first.id), true);",
      "assert.equal(agentGit.bindAgentGitSessionRepository(owner, sessionB.id, second.id), true);",
      "assert.equal(agentGit.getAgentGitSessionRepository(owner, sessionA.id).id, first.id);",
      "assert.equal(agentGit.getAgentGitSessionRepository(owner, sessionB.id).id, second.id);",
      "assert.equal(agentGit.getAgentGitSessionRepository(other, sessionA.id), null);",
      "assert.equal(agentGit.bindAgentGitSessionRepository(other, sessionA.id, first.id), false, '不能跨账户绑定 Session 或仓库');",
      "assert.equal(agentGit.bindAgentGitSessionRepository(owner, 'missing-session', first.id), false);",
      "assert.equal(database.prepare('SELECT COUNT(*) AS count FROM workspace_projects').get().count, 0, 'Agent Git 不创建或依赖 WorkspaceProject');",
      "assert.equal(database.prepare('SELECT COUNT(*) AS count FROM daemon_nodes').get().count, 0, 'Agent Git 不依赖 Daemon 节点');",
      "assert.equal(agentGit.removeAgentGitRepository(owner, first.id), true);",
      "assert.equal(agentGit.getAgentGitSessionRepository(owner, sessionA.id), null, '移除登记时清理会话绑定');",
      "assert.ok(agentGit.getAgentGitRepository(owner, second.id));",
      "configuration.close(); sessionRecords.close(); closeDatabase();",
      "process.stdout.write('Agent Git 仓库 Owner 回归通过');"
    ].join("\n");
    const output = execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "--input-type=module", "-e", script], {
      cwd: cli,
      env: { ...process.env, NODE_ENV: "test", LFAA_HOME: home, LFAA_DATA_DIR: data, AGENT_GIT_FIXTURE_ROOT: repositoryRoot },
      encoding: "utf8", stdio: "pipe", timeout: 20000
    });
    assert.match(output, /Agent Git 仓库 Owner 回归通过/u);
  } finally {
    for (const path of [data, home, repositoryRoot]) {
      assert.notEqual(resolve(path), resolve(tmpdir()));
      rmSync(path, { recursive: true, force: true });
    }
  }
});
