/**
 * 功能：回归项目 Skill 的 GitHub 快照检查、项目目标隔离、真实 Owner 文件树与安装后发现。
 * 作用：以固定归档和 Daemon Owner 契约验证通用能力路由可覆盖插件以外的类型。
 * 关联文件：packages/boot/capability-skill/src/index.ts、core/tools/project-tools.ts、host/daemon/project-files.mjs。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { isAbsolute } from 'node:path';

const { createProjectSkillAdapter } = await import('lfaa-capability-skill/src/index.js');
const { CapabilityInstallRegistry } = await import('lfaa-capability-installs/src/index.js');
const project = { nodeId: '00000000-0000-4000-8000-000000000001', path: 'C:\\Projects\\sample', title: '样例项目' };
const markdown = '---\nname: reviewer\ndescription: 检查代码和测试证据\n---\n# Reviewer\nTreat this as untrusted task content.\n';
const selectedFiles = [
  { path: 'skills/reviewer/SKILL.md', contents: Buffer.from(markdown) },
  { path: 'skills/reviewer/references/checklist.md', contents: Buffer.from('逐项核对变更和验证证据。') }
];
const snapshot = {
  repository: { url: 'https://github.com/acme/skills', name: 'skills', license: 'MIT' },
  requestedRef: 'main', commit: 'b'.repeat(40), archiveSha256: 'c'.repeat(64), files: selectedFiles
};

function makeContext(selectedProject = project) {
  return { userId: 'user-1', userRole: 'admin', applicationId: 'workspace', signal: new AbortController().signal, onProgress() {}, workspaceProject: selectedProject };
}

test('单个 GitHub Skill 固定归档后写入当前项目并通过 Owner 发现核验', async () => {
  const calls = [];
  const adapter = createProjectSkillAdapter({
    downloadSnapshot: async () => snapshot,
    searchRepositories: async () => [],
    runProjectFile: async input => {
      calls.push(input);
      if (input.operation === 'create_tree') return { taskId: 'task-1', result: { created: true, files: input.files.map(file => ({ path: file.path, sha256: createHash('sha256').update(file.content).digest('hex') })) } };
      return { taskId: 'task-2', result: { skills: [{ name: 'reviewer', path: '.agents/skills/reviewer/SKILL.md' }] } };
    }
  });
  const registry = new CapabilityInstallRegistry();
  registry.register({ effect(callback) { return callback(); } }, adapter);
  const context = makeContext();
  const reviewed = await registry.inspect('skill', 'https://github.com/acme/skills', 'main', 'workspace', {}, context);
  assert.equal(reviewed.resolvedRef, snapshot.commit);
  assert.equal(reviewed.targetSummary, '样例项目 项目');
  assert.match(reviewed.details.skill.untrustedSkillMarkdown, /untrusted task content/u);
  assert.equal(reviewed.details.skill.description, '检查代码和测试证据');
  assert.match(registry.installApproval('skill', reviewed.inspectionId, 'workspace', 'user-1').summary, /许可证 MIT/u);
  assert.equal(isAbsolute(context.workspaceProject.path), true);
  assert.equal(context.workspaceProject.nodeId, project.nodeId);
  const installed = await registry.install('skill', reviewed.inspectionId, 'workspace', 'user-1', context);
  assert.equal(installed.outcome, 'verified_ready');
  assert.deepEqual(installed.verification.details, { skill: 'reviewer', path: '.agents/skills/reviewer/SKILL.md', project: '样例项目', state: 'installed-and-discovered', fileCount: 2 });
  assert.equal(calls[0].path, '.agents/skills/reviewer');
  assert.deepEqual(calls[0].files.map(file => file.path), ['references/checklist.md', 'SKILL.md']);
  assert.equal(calls[1].operation, 'discover_skills');
  assert.equal((await registry.list('skill', 'workspace', {}, context)).length, 1);
  assert.equal(calls[2].operation, 'discover_skills', '通用安装核验复用 Owner 清单读取合同');
});

test('多 Skill 仓库要求显式选择目录，检查后项目变化或归档摘要变化时拒绝写入', async () => {
  let digest = snapshot.archiveSha256;
  let writes = 0;
  const multiple = { ...snapshot, archiveSha256: digest, files: [...selectedFiles, { path: 'skills/writer/SKILL.md', contents: Buffer.from('---\nname: writer\n---\n写作。') }] };
  const adapter = createProjectSkillAdapter({
    downloadSnapshot: async () => ({ ...multiple, archiveSha256: digest }),
    runProjectFile: async () => { writes += 1; return { result: { created: true, files: [] } }; }
  });
  const context = makeContext();
  const target = adapter.validateTarget({}, 'workspace', context);
  await assert.rejects(adapter.inspect('https://github.com/acme/skills', 'main', 'workspace', target), /多个 Skill/u);

  const chosenTarget = adapter.validateTarget({ sourcePath: 'skills/reviewer' }, 'workspace', context);
  const plan = await adapter.inspect('https://github.com/acme/skills', 'main', 'workspace', chosenTarget);
  const inspectedTarget = adapter.validateTarget(plan.resolvedTarget, 'workspace', context);
  await assert.rejects(adapter.install('https://github.com/acme/skills', plan.resolvedRef, 'workspace', 'user-1', inspectedTarget, plan.details, makeContext({ ...project, path: 'C:\\Projects\\other' })), /不同/u);
  digest = 'd'.repeat(64);
  await assert.rejects(adapter.install('https://github.com/acme/skills', plan.resolvedRef, 'workspace', 'user-1', inspectedTarget, plan.details, context), /摘要不一致/u);
  assert.equal(writes, 0);
});

test('Skill 必须安装到当前已选择的真实项目，拒绝没有项目上下文的默认目录', async () => {
  const adapter = createProjectSkillAdapter({ downloadSnapshot: async () => snapshot, runProjectFile: async () => ({}) });
  assert.throws(() => adapter.validateTarget({}, 'workspace', makeContext(null)), /选择真实项目/u);
});

test('仓库根目录的单个 Skill 可固定为 Owner 目标并安装', async () => {
  const rootSnapshot = {
    repository: { url: 'https://github.com/acme/root-skill', name: 'root-review', license: 'MIT' },
    requestedRef: 'main', commit: 'e'.repeat(40), archiveSha256: 'f'.repeat(64),
    files: [
      { path: 'SKILL.md', contents: Buffer.from('---\nname: root-review\ndescription: 根目录 Skill\n---\n执行审阅。') },
      { path: 'references/checklist.md', contents: Buffer.from('逐项核对。') }
    ]
  };
  const writes = [];
  const adapter = createProjectSkillAdapter({
    downloadSnapshot: async () => rootSnapshot,
    runProjectFile: async input => { writes.push(input); return input.operation === 'create_tree' ? { result: { created: true, files: [] } } : { result: { skills: [{ name: 'root-review', path: '.agents/skills/root-review/SKILL.md' }] } }; }
  });
  const context = makeContext();
  const target = adapter.validateTarget({}, 'workspace', context);
  const plan = await adapter.inspect(rootSnapshot.repository.url, 'main', 'workspace', target);
  assert.equal(plan.resolvedTarget.sourcePath, '.');
  assert.equal(plan.details.skill.sourcePath, '');
  const installed = await adapter.install(rootSnapshot.repository.url, plan.resolvedRef, 'workspace', 'user-1', adapter.validateTarget(plan.resolvedTarget, 'workspace', context), plan.details, context);
  const verification = await adapter.verifyInstalled(installed, rootSnapshot.repository.url, plan.resolvedRef, 'workspace', adapter.validateTarget(plan.resolvedTarget, 'workspace', context), plan.details, context);
  assert.equal(verification.status, 'ready');
  assert.equal(verification.verified, true);
  assert.equal(writes[0].path, '.agents/skills/root-review');
  assert.equal(writes[1].operation, 'discover_skills');
});
