/**
 * 功能：回归项目 Skill 的 GitHub 快照检查、项目目标隔离、真实 Owner 文件树与安装后发现。
 * 作用：以固定归档和 Daemon Owner 契约验证通用能力路由可覆盖插件以外的类型。
 * 关联文件：packages/boot/capability-skill/src/index.ts、core/tools/project-tools.ts、host/project-files/project-files.mjs。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { isolateData } from './isolated-data.mjs';

isolateData(test, 'capability-skill');

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

function makeContext(selectedProject = project, signal = new AbortController().signal) {
  return { userId: 'user-1', userRole: 'admin', applicationId: 'workspace', signal, onProgress() {}, workspaceProject: selectedProject };
}

test('单个 GitHub Skill 固定归档后写入当前项目并通过 Owner 发现核验', async () => {
  const calls = [];
  const adapter = createProjectSkillAdapter({
    downloadSnapshot: async () => snapshot,
    searchRepositories: async () => [],
    runProjectFile: async input => {
      calls.push(input);
      if (input.operation === 'create_tree') return { taskId: 'task-1', result: { created: true, files: input.files.map(file => ({ path: file.path, sha256: createHash('sha256').update(file.content).digest('hex') })) } };
      return { taskId: 'task-2', result: { skills: [{ name: 'reviewer', path: '.agents\\skills\\reviewer\\SKILL.md' }] } };
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
  assert.deepEqual(installed.verification.details, {
    skill: 'reviewer', path: '.agents/skills/reviewer/SKILL.md', project: '样例项目', state: 'installed-and-discovered', fileCount: 2,
    scriptFiles: [], declaredNodeMajor: null, packageManifest: 'absent', dependencies: [], devDependencies: [], packageScriptNames: [], riskSignals: [], scriptsExecuted: false,
    dependenciesInstalled: false, externalRuntimeVerified: false
  });
  assert.equal(calls[0].path, '.agents/skills/reviewer');
  assert.deepEqual(calls[0].files.map(file => file.path), ['references/checklist.md', 'SKILL.md']);
  assert.equal(calls[1].operation, 'discover_skills');
  assert.equal((await registry.list('skill', 'workspace', {}, context)).length, 1);
  assert.equal(calls[2].operation, 'discover_skills', '通用安装核验复用 Owner 清单读取合同');
});

test('Skill 下载期间取消 Run 后不写项目文件 Owner，且安装凭证不可重放', async () => {
  let releaseInstallSnapshot;
  const pendingSnapshot = new Promise(resolve => { releaseInstallSnapshot = resolve; });
  const downloadSignals = [];
  let downloads = 0;
  const ownerWrites = [];
  const adapter = createProjectSkillAdapter({
    downloadSnapshot: async (_source, _ref, signal) => {
      downloadSignals.push(signal);
      return ++downloads === 1 ? snapshot : pendingSnapshot;
    },
    runProjectFile: async input => {
      ownerWrites.push(input);
      return input.operation === 'create_tree'
        ? { result: { created: true, files: [] } }
        : { result: { skills: [{ name: 'reviewer', path: '.agents/skills/reviewer/SKILL.md' }] } };
    }
  });
  const registry = new CapabilityInstallRegistry();
  registry.register({ effect(callback) { return callback(); } }, adapter);
  const controller = new AbortController();
  const context = makeContext(project, controller.signal);
  const inspected = await registry.inspect('skill', 'https://github.com/acme/skills', 'main', 'workspace', {}, context);
  const installing = registry.install('skill', inspected.inspectionId, 'workspace', 'user-1', context);
  assert.equal(downloadSignals.length, 2, '安装必须开始固定快照下载');
  controller.abort(new DOMException('Run cancelled', 'AbortError'));
  releaseInstallSnapshot(snapshot);
  await assert.rejects(installing, error => error?.name === 'AbortError');
  assert.deepEqual(ownerWrites, [], '取消后项目文件 Owner 不得写入');
  await assert.rejects(registry.install('skill', inspected.inspectionId, 'workspace', 'user-1', makeContext()), /检查凭证不存在/u);
  assert.equal(downloadSignals[1], controller.signal, '安装下载必须沿用当前 Run 的 AbortSignal');
});

test('Skill 检查静态盘点脚本与依赖并明确不会执行或安装它们', async () => {
  const runtimeSnapshot = {
    ...snapshot,
    files: [
      ...selectedFiles,
      { path: 'skills/reviewer/scripts/check.mjs', contents: Buffer.from('throw new Error("must not execute during install");') },
      { path: 'skills/reviewer/package.json', contents: Buffer.from(JSON.stringify({ dependencies: { playwright: '^1.0.0' }, devDependencies: { typescript: '^5.0.0' }, scripts: { check: 'node scripts/check.mjs' } })) }
    ]
  };
  const calls = [];
  const adapter = createProjectSkillAdapter({
    downloadSnapshot: async () => runtimeSnapshot,
    runProjectFile: async input => {
      calls.push(input);
      return input.operation === 'create_tree'
        ? { result: { created: true, files: input.files.map(file => ({ path: file.path })) } }
        : { result: { skills: [{ name: 'reviewer', path: '.agents/skills/reviewer/SKILL.md' }] } };
    }
  });
  const registry = new CapabilityInstallRegistry();
  registry.register({ effect(callback) { return callback(); } }, adapter);
  const context = makeContext();
  const reviewed = await registry.inspect('skill', 'https://github.com/acme/skills', 'main', 'workspace', {}, context);
  assert.deepEqual(reviewed.details.skill.runtimeAudit, {
    scriptFiles: ['scripts/check.mjs'], declaredNodeMajor: null, packageManifest: 'valid', dependencies: ['playwright'], devDependencies: ['typescript'], packageScriptNames: ['check'], riskSignals: []
  });
  const approval = registry.installApproval('skill', reviewed.inspectionId, 'workspace', 'user-1');
  assert.match(approval.summary, /含 1 个脚本文件，安装只复制文本，不执行/u);
  assert.match(approval.summary, /静态读取 2 个依赖项，未安装/u);
  const installed = await registry.install('skill', reviewed.inspectionId, 'workspace', 'user-1', context);
  assert.equal(installed.verification.status, 'ready', 'ready 只表示 SKILL.md 已被真实项目 Owner 发现');
  assert.deepEqual(installed.verification.details.scriptFiles, ['scripts/check.mjs']);
  assert.deepEqual(installed.verification.details.dependencies, ['playwright']);
  assert.equal(installed.verification.details.scriptsExecuted, false);
  assert.equal(installed.verification.details.dependenciesInstalled, false);
  assert.equal(installed.verification.details.externalRuntimeVerified, false);
  assert.deepEqual(calls[0].files.map(file => file.path), ['package.json', 'references/checklist.md', 'scripts/check.mjs', 'SKILL.md']);
});

test('Skill 检查标出 Web Access 类运行风险，安装审批只呈现静态线索', async () => {
  const webAccessSnapshot = {
    ...snapshot,
    repository: { url: 'https://github.com/eze-is/web-access', name: 'web-access', license: 'MIT' },
    files: [
      { path: 'SKILL.md', contents: Buffer.from('---\nname: web-access\ndescription: 浏览器联网 Skill\n---\nRequires Node.js 22+ and browser remote debugging via CDP and DevToolsActivePort.') },
      { path: 'scripts/check-deps.mjs', contents: Buffer.from('spawn(process.execPath, args, { detached: true }); child.unref(); process.env.USERPROFILE;') },
      { path: 'scripts/cdp-proxy.mjs', contents: Buffer.from('POST /eval uses Runtime.evaluate. POST /setFiles uses DOM.setFileInputFiles.') }
    ]
  };
  const adapter = createProjectSkillAdapter({
    downloadSnapshot: async () => webAccessSnapshot,
    runProjectFile: async input => input.operation === 'create_tree'
      ? { result: { created: true, files: input.files.map(file => ({ path: file.path })) } }
      : { result: { skills: [{ name: 'web-access', path: '.agents/skills/web-access/SKILL.md' }] } }
  });
  const registry = new CapabilityInstallRegistry();
  registry.register({ effect(callback) { return callback(); } }, adapter);
  const context = makeContext({ ...project, nodeId: null });
  const inspected = await registry.inspect('skill', webAccessSnapshot.repository.url, 'main', 'workspace', {}, context);
  const expected = ['background-process', 'browser-remote-debugging', 'arbitrary-page-script', 'local-file-access', 'user-profile-persistence'];
  assert.deepEqual(inspected.details.skill.runtimeAudit.riskSignals, expected);
  assert.equal(inspected.details.skill.runtimeAudit.declaredNodeMajor, 22);
  assert.match(inspected.summary, /静态线索（未执行，需核验）/u);
  assert.match(inspected.summary, /来源声明最低 Node.js 22\+/u);
  assert.match(inspected.summary, /后台进程生命周期/u);
  assert.match(inspected.summary, /任意页面脚本执行接口/u);
  const approval = registry.installApproval('skill', inspected.inspectionId, 'workspace', 'user-1');
  assert.match(approval.summary, /静态线索（未执行，需核验）/u);
  assert.match(approval.summary, /浏览器远程调试\/CDP/u);
  const installed = await registry.install('skill', inspected.inspectionId, 'workspace', 'user-1', context);
  assert.deepEqual(installed.verification.details.riskSignals, expected);
  assert.equal(installed.verification.details.declaredNodeMajor, 22);
  assert.equal(installed.verification.details.scriptsExecuted, false);
  assert.equal(installed.verification.details.externalRuntimeVerified, false);
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
  assert.deepEqual(writes[0].files.map(file => file.path), ['references/checklist.md', 'SKILL.md'], '仓库根目录 Skill 必须保留其附属目录');
  assert.equal(writes[1].operation, 'discover_skills');
});

test('本机默认工作区的 Skill 目标保持无节点身份', async () => {
  const calls = [];
  const localProject = { ...project, nodeId: null };
  const adapter = createProjectSkillAdapter({
    downloadSnapshot: async () => snapshot,
    runProjectFile: async input => {
      calls.push(input);
      return input.operation === 'create_tree'
        ? { result: { created: true, files: [] } }
        : { result: { skills: [{ name: 'reviewer', path: '.agents/skills/reviewer/SKILL.md' }] } };
    }
  });
  const context = makeContext(localProject);
  const target = adapter.validateTarget({}, 'workspace', context);
  assert.equal(target.nodeId, null);
  const plan = await adapter.inspect('https://github.com/acme/skills', 'main', 'workspace', target);
  const installedTarget = adapter.validateTarget(plan.resolvedTarget, 'workspace', context);
  const installed = await adapter.install('https://github.com/acme/skills', plan.resolvedRef, 'workspace', 'user-1', installedTarget, plan.details, context);
  const verification = await adapter.verifyInstalled(installed, 'https://github.com/acme/skills', plan.resolvedRef, 'workspace', installedTarget, plan.details, context);
  assert.equal(installed.project, '样例项目');
  assert.equal(verification.status, 'ready');
  assert.equal(calls[0].operation, 'create_tree');
  assert.equal(calls[1].operation, 'discover_skills');
  assert.equal(context.workspaceProject.nodeId, null);
});
