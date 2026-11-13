/**
 * 功能：回归 Agent 从当前项目创建、登记并切换到 LFAA AI Worktree。
 * 作用：隔离运行 SQLite、Session、Permission 合同和真实临时 Git 仓库，不连接外部 Daemon 或 Provider。
 * 关联文件：packages/workspace/workspace/src/git-worktree-operations.ts、packages/core/tools/src/project-tools.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("Agent Worktree 工具只切换当前会话绑定项目，并经唯一 Workspace Owner 创建和登记", () => {
  const data = mkdtempSync(join(tmpdir(), "lfaa-agent-worktree-data-"));
  const home = mkdtempSync(join(tmpdir(), "lfaa-agent-worktree-home-"));
  const sourceRoot = mkdtempSync(join(tmpdir(), "lfaa-agent-worktree-source-"));
  mkdirSync(join(home, "credentials"), { recursive: true });
  try {
    const script = `
      import assert from 'node:assert/strict';
      import { randomUUID } from 'node:crypto';
      import { mkdirSync, writeFileSync } from 'node:fs';
      import { join, resolve } from 'node:path';
      import { execFileSync } from 'node:child_process';
      import { database, closeDatabase } from 'lfaa-storage-sqlite/src/database.js';
      import { configuration } from 'lfaa-storage-domain/src/configuration.js';
      import { sessionRecords } from 'lfaa-session-persistence-jsonl/src/repository.js';
      import * as sessions from 'lfaa-session/src/sessions.js';
      import { retireLegacyFileTables } from 'lfaa-storage-domain/src/migration.js';
      import { saveUserSettings } from 'lfaa-settings/src/service.js';
      import { createWorkspaceProject, getWorkspaceProject, listWorkspaceGitWorktrees } from 'lfaa-workspace-workspace/src/index.js';
      import { createWorkspaceGitWorktreeFromProject, WorkspaceGitWorktreeError } from 'lfaa-workspace-workspace/src/git-worktree-operations.js';
      import { createWorkspaceGitWorktreeTool } from 'lfaa-tools/src/project-tools.js';
      retireLegacyFileTables();
      assert.equal(Number(database.prepare('PRAGMA user_version').get().user_version), 81, '文件存储迁移入口完成当前 schema 升级');
      assert.equal(database.prepare('PRAGMA table_info(workspace_git_worktrees)').all().find(column => column.name === 'node_id').notnull, 0, '本机 Host 项目可不绑定 Daemon');
      const userId = 'agent-worktree-fixture';
      database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES (?,733,?,'salt','hash','admin',0)").run(userId, userId);
      const localNodeId = randomUUID();
      database.prepare("INSERT INTO daemon_nodes(id,display_name,platform,architecture,daemon_version,status,last_seen_at) VALUES (?,?,?,'x64','test','offline','2026-11-13T00:00:00.000Z')").run(localNodeId, 'Fixture local node', process.platform);
      writeFileSync(join(process.env.LFAA_HOME, 'credentials', 'daemon-node-id'), localNodeId, 'utf8');
      const sourceDirectory = process.env.AGENT_WORKTREE_SOURCE;
      mkdirSync(sourceDirectory, { recursive: true });
      execFileSync('git', ['init'], { cwd: sourceDirectory, stdio: 'ignore' });
      execFileSync('git', ['config', 'user.name', 'LFAA fixture'], { cwd: sourceDirectory, stdio: 'ignore' });
      execFileSync('git', ['config', 'user.email', 'fixture@example.invalid'], { cwd: sourceDirectory, stdio: 'ignore' });
      writeFileSync(join(sourceDirectory, 'README.md'), 'source stays intact\\n', 'utf8');
      execFileSync('git', ['add', 'README.md'], { cwd: sourceDirectory, stdio: 'ignore' });
      execFileSync('git', ['commit', '-m', 'fixture'], { cwd: sourceDirectory, stdio: 'ignore' });
      saveUserSettings(userId, 'git', { branchPrefix: 'fixture/' });
      const source = createWorkspaceProject({ userId, appId: 'minecraft', nodeId: localNodeId, path: sourceDirectory, platform: process.platform, title: 'Agent Worktree Fixture' });
      const sourceContext = { id: source.id, appId: 'minecraft', applicationIds: source.applicationIds, nodeId: source.nodeId, path: source.path, title: source.title,
        sources: source.sources.map(item => item.path), sourceDirectories: source.sources.map(item => ({ id: item.id, path: item.path })),
        instructions: source.instructions, memoryMode: source.memoryMode };
      const turn = sessions.createAiTurn(userId, 'minecraft', null, '创建隔离工作区', false, sourceContext);
      const scope = createWorkspaceGitWorktreeTool.approval({}, { userId, applicationId: 'minecraft', workspaceProject: sourceContext });
      const otherScope = createWorkspaceGitWorktreeTool.approval({}, { userId, applicationId: 'minecraft', workspaceProject: { ...sourceContext, id: randomUUID() } });
      assert.notEqual(scope.scopeKey, otherScope.scopeKey, '替我审批按当前项目隔离');
      assert.equal(createWorkspaceGitWorktreeTool.risk({}), 'write');
      assert.throws(() => createWorkspaceGitWorktreeTool.parse({ projectId: source.id }), /不接受参数/u);
      let updatedProject = null;
      const result = await createWorkspaceGitWorktreeTool.execute({}, {
        userId, userRole: 'admin', applicationId: 'minecraft', agentRunId: randomUUID(), sessionId: turn.session.id,
        workspaceProject: sourceContext, signal: new AbortController().signal, onProgress() {}, updateWorkspaceProject(value) { updatedProject = value; }
      });
      assert.equal(result.created, true);
      assert.equal(result.switched, true);
      assert.match(result.branch, /^fixture\\/agent-worktree-fixture-/u);
      assert.equal(updatedProject.id, result.projectId);
      assert.equal(sessions.getAiSession(userId, turn.session.id).projectId, result.projectId, 'Session Owner 保存新的项目归属');
      const worktree = getWorkspaceProject(userId, result.projectId, 'minecraft');
      assert.equal(worktree.gitWorktree.sourceProjectId, source.id);
      assert.equal(worktree.gitWorktree.branch, result.branch);
      assert.deepEqual(createWorkspaceGitWorktreeTool.applicationIds, ['workspace', 'minecraft']);
      const workspaceSource = createWorkspaceProject({ userId, appId: 'workspace', nodeId: null, path: sourceDirectory, platform: process.platform, title: 'Generic Workspace Fixture' });
      const workspaceContext = { id: workspaceSource.id, appId: 'workspace', applicationIds: workspaceSource.applicationIds, nodeId: null, path: workspaceSource.path, title: workspaceSource.title,
        sources: workspaceSource.sources.map(item => item.path), sourceDirectories: workspaceSource.sources.map(item => ({ id: item.id, path: item.path })),
        instructions: workspaceSource.instructions, memoryMode: workspaceSource.memoryMode };
      const workspaceTurn = sessions.createAiTurn(userId, 'workspace', null, '创建隔离工作区', false, workspaceContext);
      const workspaceScope = createWorkspaceGitWorktreeTool.approval({}, { userId, applicationId: 'workspace', workspaceProject: workspaceContext });
      assert.match(workspaceScope.scopeKey, /^workspace:git-worktree:/u, '通用工作区仍使用现有项目范围审批');
      let switchedWorkspaceProject = null;
      const workspaceResult = await createWorkspaceGitWorktreeTool.execute({}, {
        userId, userRole: 'admin', applicationId: 'workspace', agentRunId: randomUUID(), sessionId: workspaceTurn.session.id,
        workspaceProject: workspaceContext, signal: new AbortController().signal, onProgress() {}, updateWorkspaceProject(value) { switchedWorkspaceProject = value; }
      });
      assert.equal(workspaceResult.switched, true);
      assert.equal(switchedWorkspaceProject.nodeId, null, 'Workspace Owner 的项目继续由本机 Host 管理');
      assert.equal(getWorkspaceProject(userId, workspaceResult.projectId, 'workspace').gitWorktree.nodeId, null, '本机 Host Worktree 不伪造 Daemon 身份');
      assert.equal(sessions.getAiSession(userId, workspaceTurn.session.id).projectId, workspaceResult.projectId, '通用工作区 Session Owner 保存新项目归属');
      assert.equal(listWorkspaceGitWorktrees(userId).length, 2);
      assert.equal(resolve(execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: sourceDirectory, encoding: 'utf8' }).trim()), resolve(sourceDirectory));
      assert.equal((await (await import('node:fs/promises')).readFile(join(worktree.path, 'README.md'), 'utf8')).replace(/\\r\\n/gu, '\\n'), 'source stays intact\\n');
      await assert.rejects(
        createWorkspaceGitWorktreeFromProject({ userId, appId: 'minecraft', sourceProjectId: worktree.id, branchPrefix: 'fixture/' }),
        error => error instanceof WorkspaceGitWorktreeError && error.code === 'workspace_git_nested_worktree_unsupported'
      );
      const remoteNodeId = randomUUID();
      database.prepare("INSERT INTO daemon_nodes(id,display_name,platform,architecture,daemon_version,status,last_seen_at) VALUES (?,?,?,'x64','test','offline','2026-11-13T00:00:00.000Z')").run(remoteNodeId, 'Fixture remote node', process.platform);
      const remote = createWorkspaceProject({ userId, appId: 'minecraft', nodeId: remoteNodeId, path: sourceDirectory, platform: process.platform, title: 'Remote project fixture' });
      await assert.rejects(
        createWorkspaceGitWorktreeFromProject({ userId, appId: 'minecraft', sourceProjectId: remote.id, branchPrefix: 'fixture/' }),
        error => error instanceof WorkspaceGitWorktreeError && error.code === 'workspace_git_worktree_node_required'
      );
      const controller = new AbortController();
      controller.abort();
      await assert.rejects(createWorkspaceGitWorktreeFromProject({ userId, appId: 'minecraft', sourceProjectId: source.id, branchPrefix: 'fixture/', signal: controller.signal }), { name: 'AbortError' });
      assert.equal(listWorkspaceGitWorktrees(userId).length, 2, '取消前已中止时不创建或登记工作树');
      sessionRecords.close();
      configuration.close();
      closeDatabase();
    `;
    execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "--input-type=module", "--eval", script], {
      cwd: cli,
      env: { ...process.env, LFAA_DATA_DIR: data, LFAA_HOME: home, LFAA_GIT_DATA_ROOT: data, AGENT_WORKTREE_SOURCE: sourceRoot },
      stdio: "pipe"
    });
  } finally {
    rmSync(data, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
    rmSync(sourceRoot, { recursive: true, force: true });
  }
});
