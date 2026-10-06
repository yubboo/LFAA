/**
 * 功能：回归通用项目目录注册、账户/节点隔离和有界搜索。
 * 作用：在临时 LFAA_DATA_DIR 中运行真实 SQLite 迁移与项目 Owner，不连接外部 Daemon。
 * 关联文件：packages/workspace/workspace/src/index.ts、packages/storage/storage-sqlite/src/database.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("项目登记按账户和节点隔离，搜索结果有界且可查找较早项目", () => {
  const parent = resolve(tmpdir());
  const data = mkdtempSync(join(parent, "lfaa-workspace-projects-"));
  const directory = mkdtempSync(join(parent, "lfaa-project-paths-"));
  try {
    const script = [
      "import assert from 'node:assert/strict';",
      "import { randomUUID } from 'node:crypto';",
      "import { join } from 'node:path';",
      "const { database, closeDatabase } = await import('lfaa-storage-sqlite/src/database.js');",
      "const settings = await import('lfaa-settings/src/service.js');",
      "const { configuration } = await import('lfaa-storage-domain/src/configuration.js');",
      "const { sessionRecords } = await import('lfaa-session-persistence-jsonl/src/repository.js');",
      "const { retireLegacyFileTables } = await import('lfaa-storage-domain/src/migration.js');",
      "retireLegacyFileTables();",
      "assert.equal(database.prepare('PRAGMA user_version').get().user_version, 47);",
      "const owner = 'fixture-workspace-owner';",
      "const otherOwner = 'fixture-workspace-other';",
      "const nodeA = randomUUID();",
      "const nodeB = randomUUID();",
      "for (const [id, uid, username] of [[owner, 1, owner], [otherOwner, 2, otherOwner]]) database.prepare(\"INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES (?,?,?,'salt','hash','admin',0)\").run(id, uid, username);",
      "assert.equal(settings.getUserSettings(owner).git.branchPrefix, 'codex/');",
      "settings.saveUserSettings(owner, 'git', { branchPrefix: 'feature/' });",
      "assert.equal(settings.getUserSettings(owner).git.branchPrefix, 'feature/');",
      "assert.equal(settings.getUserSettings(otherOwner).git.branchPrefix, 'codex/');",
      "for (const [id, name] of [[nodeA, 'Fixture A'], [nodeB, 'Fixture B']]) database.prepare(\"INSERT INTO daemon_nodes(id,display_name,platform,architecture,daemon_version,status,last_seen_at) VALUES (?,?, 'linux','x64','test','offline','2026-10-01T00:00:00.000Z')\").run(id, name);",
      "const { createWorkspaceProject, createWorkspaceGitWorktree, listWorkspaceGitWorktrees, listWorkspaceProjects, hasWorkspaceGitWorktrees, getWorkspaceProject, searchWorkspaceProjects, removeWorkspaceProject, claimWorkspaceProjectApplication } = await import('lfaa-workspace-workspace/src/index.js');",
      "const { migrateWorkspaceProjectApplicationSchema } = await import('lfaa-storage-sqlite/src/database.js');",
      "const sessions = await import('lfaa-session/src/sessions.js');",
      "const root = process.env.PROJECT_FIXTURE_ROOT;",
      "const legacyId = randomUUID();",
      "const legacyPath = join(root, 'LegacyProject');",
      "database.prepare('INSERT INTO workspace_projects (id,user_id,node_id,path,path_key,title,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run(legacyId, owner, nodeA, legacyPath, legacyPath, 'LegacyProject', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');",
      "database.exec('DROP INDEX workspace_projects_user_app_node_path_idx; DROP INDEX workspace_projects_user_legacy_node_path_idx; DROP INDEX workspace_projects_user_app_recent_idx; ALTER TABLE workspace_projects DROP COLUMN app_id; CREATE UNIQUE INDEX workspace_projects_user_node_path_idx ON workspace_projects(user_id,node_id,path_key); PRAGMA user_version = 37;');",
      "migrateWorkspaceProjectApplicationSchema();",
      "assert.equal(database.prepare('PRAGMA user_version').get().user_version, 38);",
      "assert.equal(getWorkspaceProject(owner, legacyId).appId, null);",
      "assert.equal(getWorkspaceProject(owner, legacyId).path, legacyPath);",
      "assert.equal(claimWorkspaceProjectApplication(owner, legacyId, 'workspace').appId, 'workspace');",
      "assert.equal(getWorkspaceProject(owner, legacyId, 'minecraft'), null);",
      "const firstPath = join(root, 'ProjectAlpha');",
      "const first = createWorkspaceProject({ userId: owner, appId: 'workspace', nodeId: nodeA, path: firstPath, platform: 'win32' });",
      "const duplicate = createWorkspaceProject({ userId: owner, appId: 'workspace', nodeId: nodeA, path: firstPath.toUpperCase(), platform: 'win32', title: 'duplicate' });",
      "assert.equal(duplicate.id, first.id);",
      "const minecraftProject = createWorkspaceProject({ userId: owner, appId: 'minecraft', nodeId: nodeA, path: firstPath, platform: 'win32' });",
      "assert.notEqual(minecraftProject.id, first.id);",
      "assert.deepEqual(listWorkspaceProjects(owner, 'workspace').map(project => project.id), [first.id, legacyId]);",
      "assert.deepEqual(listWorkspaceProjects(owner, 'minecraft').map(project => project.id), [minecraftProject.id]);",
      "assert.equal(removeWorkspaceProject(owner, minecraftProject.id, 'workspace'), false);",
      "assert.equal(getWorkspaceProject(otherOwner, first.id), null);",
      "const sameFolderInMinecraft = createWorkspaceProject({ userId: owner, appId: 'minecraft', nodeId: nodeA, path: firstPath, platform: 'win32' });",
      "assert.notEqual(sameFolderInMinecraft.id, first.id);",
      "assert.equal(getWorkspaceProject(owner, first.id, 'minecraft'), null);",
      "assert.equal(getWorkspaceProject(owner, sameFolderInMinecraft.id, 'workspace'), null);",
      "const turn = sessions.createAiTurn(owner, 'workspace', null, '项目会话测试');",
      "sessions.finishAiAssistantMessage(owner, turn.session.id, turn.assistantMessage.id, '已完成', 'complete');",
      "const context = { id: first.id, appId: 'workspace', nodeId: first.nodeId, path: first.path, title: first.title };",
      "assert.equal(sessions.setAiSessionProject(owner, turn.session.id, context).projectId, first.id);",
      "assert.equal(sessions.getAiSessionWorkspaceContext(owner, turn.session.id).path, firstPath);",
      "const minecraftTurn = sessions.createAiTurn(owner, 'minecraft', null, '跨应用项目测试');",
      "sessions.finishAiAssistantMessage(owner, minecraftTurn.session.id, minecraftTurn.assistantMessage.id, '已完成', 'complete');",
      "assert.equal(sessions.setAiSessionProject(owner, minecraftTurn.session.id, context), null);",
      "const otherNode = createWorkspaceProject({ userId: owner, appId: 'workspace', nodeId: nodeB, path: firstPath, platform: 'win32' });",
      "assert.notEqual(otherNode.id, first.id);",
      "const gitSource = createWorkspaceProject({ userId: owner, appId: 'workspace', nodeId: nodeA, path: join(root, 'GitSource'), platform: 'linux' });",
      "const managedTree = createWorkspaceGitWorktree({ userId: owner, appId: 'workspace', sourceProjectId: gitSource.id, nodeId: nodeA, path: join(root, 'managed-tree'), worktreeRoot: join(root, 'managed-tree'), worktreeId: randomUUID(), projectRelativePath: '', branch: 'codex/workspace-owner', baseCommit: 'a'.repeat(40), sourceHead: 'b'.repeat(40), platform: 'linux' });",
      "assert.equal(getWorkspaceProject(owner, managedTree.id).gitWorktree.projectId, managedTree.id);",
      "assert.equal(getWorkspaceProject(otherOwner, managedTree.id), null);",
      "assert.equal(hasWorkspaceGitWorktrees(owner, gitSource.id), true);",
      "assert.equal(listWorkspaceGitWorktrees(owner).length, 1);",
      "assert.equal(removeWorkspaceProject(owner, managedTree.id, 'workspace'), true);",
      "assert.equal(hasWorkspaceGitWorktrees(owner, gitSource.id), false);",
      "assert.ok(getWorkspaceProject(owner, gitSource.id));",
      "for (let index = 0; index < 205; index += 1) createWorkspaceProject({ userId: owner, appId: 'workspace', nodeId: nodeA, path: join(root, 'project-' + String(index).padStart(3, '0')), platform: 'linux' });",
      "const recent = searchWorkspaceProjects(owner, 'workspace');",
      "assert.equal(recent.projects.length, 200);",
      "assert.equal(recent.truncated, true);",
      "const older = searchWorkspaceProjects(owner, 'workspace', 'project-204');",
      "assert.equal(older.projects.length, 1);",
      "assert.equal(older.projects[0].title, 'project-204');",
      "assert.equal(older.truncated, false);",
      "assert.equal(removeWorkspaceProject(owner, first.id, 'workspace'), true);",
      "assert.equal(getWorkspaceProject(owner, first.id), null);",
      "assert.equal(sessions.getAiSession(owner, turn.session.id).projectTitle, first.title);",
      "assert.equal(sessions.getAiSessionWorkspaceContext(owner, turn.session.id).path, firstPath);",
      "configuration.close();",
      "sessionRecords.close();",
      "closeDatabase();",
      "process.stdout.write('项目目录登记回归通过');"
    ].join("\n");
    const output = execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "--input-type=module", "-e", script], {
      cwd: cli, env: { ...process.env, NODE_ENV: "test", LFAA_DATA_DIR: data, PROJECT_FIXTURE_ROOT: directory }, encoding: "utf8", stdio: "pipe", timeout: 20000
    });
    assert.match(output, /项目目录登记回归通过/);
  } finally {
    assert.equal(dirname(resolve(data)), parent);
    assert.equal(dirname(resolve(directory)), parent);
    rmSync(data, { recursive: true, force: true });
    rmSync(directory, { recursive: true, force: true });
  }
});
