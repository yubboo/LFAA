/**
 * 功能：回归通用能力检查凭证、目标绑定与安装审批摘要。
 * 作用：证明目标上下文变化会失效，审批展示真实来源与固定版本，内部目标不泄露给模型。
 * 关联文件：packages/boot/capability-installs/src/index.ts。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { CapabilityInstallRegistry } = await import('lfaa-capability-installs/src/index.js');

function context(path = 'C:\\Projects\\sample', userId = 'user-1') {
  return { userId, userRole: 'admin', applicationId: 'workspace', signal: new AbortController().signal, onProgress() {}, workspaceProject: { nodeId: '00000000-0000-4000-8000-000000000001', path, title: '示例项目' } };
}

test('通用能力检查票据固定来源与目标，审批可读且安装前重新核验上下文', async () => {
  const registry = new CapabilityInstallRegistry();
  const installed = [];
  const adapter = {
    kind: 'skill', applicationIds: ['workspace'], targetSchema: { type: 'object', properties: {}, additionalProperties: false },
    validateTarget(_target, _applicationId, current) { return { projectPath: current.workspaceProject.path }; },
    revalidateTarget(_target, _applicationId, current) { return { projectPath: current.workspaceProject.path }; },
    targetSummary: () => '示例项目', search: async () => ({ candidates: [] }),
    inspect: async source => ({ resolvedRef: 'a'.repeat(40), summary: 'reviewer · 项目审查', details: { source } }),
    install: async (source, ref, app, user, target, details) => { installed.push({ source, ref, app, user, target, details }); return { installed: true }; },
    verifyInstalled: async installation => ({ status: installation.installed ? 'ready' : 'unknown', verified: installation.installed, summary: installation.installed ? 'Owner 清单已回读。' : 'Owner 状态未确认。' }),
    list: async () => []
  };
  const owner = { effect(callback) { const cleanup = callback(); return cleanup; } };
  registry.register(owner, adapter);

  const reviewed = await registry.inspect('skill', 'https://github.com/acme/reviewer', undefined, 'workspace', {}, context());
  assert.equal(reviewed.targetSummary, '示例项目');
  assert.equal(JSON.stringify(reviewed).includes('C:\\Projects'), false, '项目绝对路径保留在服务端票据中');
  const approval = registry.installApproval('skill', reviewed.inspectionId, 'workspace', 'user-1');
  assert.match(approval.summary, /acme\/reviewer/u);
  assert.match(approval.summary, new RegExp('a'.repeat(12)));

  await assert.rejects(registry.install('skill', reviewed.inspectionId, 'workspace', 'user-1', context('C:\\Projects\\other')), /目标 App 或类型专属目标已变化/u);
  assert.equal(installed.length, 0);

  const second = await registry.inspect('skill', 'https://github.com/acme/reviewer', undefined, 'workspace', {}, context());
  const result = await registry.install('skill', second.inspectionId, 'workspace', 'user-1', context());
  assert.equal(result.outcome, 'verified_ready');
  assert.deepEqual(result.verification, { status: 'ready', verified: true, summary: 'Owner 清单已回读。' });
  assert.equal(installed[0].target.projectPath, 'C:\\Projects\\sample');
  await assert.rejects(registry.install('skill', second.inspectionId, 'workspace', 'user-1', context()), /不存在、已过期/u);
});

test('能力检查票据不能跨账户审批或安装，拒绝后原账户仍可完成安装', async () => {
  const registry = new CapabilityInstallRegistry();
  const installed = [];
  const adapter = {
    kind: 'skill', applicationIds: ['workspace'], targetSchema: { type: 'object', properties: {}, additionalProperties: false },
    validateTarget: (_target, _app, current) => ({ projectPath: current.workspaceProject.path }),
    revalidateTarget: (_target, _app, current) => ({ projectPath: current.workspaceProject.path }),
    targetSummary: target => `项目 ${target.projectPath}`,
    search: async () => ({ candidates: [] }),
    inspect: async source => ({ resolvedRef: 'd'.repeat(40), summary: '隔离测试 Skill', details: { source } }),
    install: async (_source, _ref, _app, userId, target) => { installed.push({ userId, target }); return { installed: true }; },
    verifyInstalled: async () => ({ status: 'ready', verified: true, summary: 'Owner 清单已回读。' }),
    list: async () => []
  };
  registry.register({ effect(callback) { return callback(); } }, adapter);

  const inspected = await registry.inspect('skill', 'https://github.com/acme/isolation', undefined, 'workspace', {}, context());
  assert.throws(() => registry.installApproval('skill', inspected.inspectionId, 'workspace', 'user-2'), /不属于当前用户/u);
  await assert.rejects(
    registry.install('skill', inspected.inspectionId, 'workspace', 'user-2', context('C:\\Projects\\user-two', 'user-2')),
    /不属于当前用户/u
  );
  assert.deepEqual(installed, [], '跨账户请求在领域 Owner 写入前被拒绝');

  const approval = registry.installApproval('skill', inspected.inspectionId, 'workspace', 'user-1');
  assert.match(approval.summary, /隔离测试 Skill/u);
  const result = await registry.install('skill', inspected.inspectionId, 'workspace', 'user-1', context());
  assert.equal(result.outcome, 'verified_ready');
  assert.equal(installed.length, 1);
  assert.equal(installed[0].userId, 'user-1');
  assert.equal(installed[0].target.projectPath, 'C:\\Projects\\sample');
});

test('Owner 无法回读时安装明确返回未确认且已消费凭证不能重放', async () => {
  const registry = new CapabilityInstallRegistry();
  let writes = 0;
  const adapter = {
    kind: 'skill', applicationIds: ['workspace'], targetSchema: { type: 'object', properties: {}, additionalProperties: false },
    validateTarget: () => ({ projectPath: 'C:\\Projects\\sample' }), revalidateTarget: () => ({ projectPath: 'C:\\Projects\\sample' }), targetSummary: () => '示例项目',
    search: async () => ({ candidates: [] }), inspect: async () => ({ resolvedRef: 'b'.repeat(40), details: {} }),
    install: async () => { writes += 1; return { written: true }; },
    verifyInstalled: async () => { throw new Error('不暴露 Owner 内部错误'); },
    list: async () => []
  };
  registry.register({ effect(callback) { return callback(); } }, adapter);
  const reviewed = await registry.inspect('skill', 'https://github.com/acme/reviewer', undefined, 'workspace', {}, context());
  const result = await registry.install('skill', reviewed.inspectionId, 'workspace', 'user-1', context());
  assert.equal(result.outcome, 'unverified');
  assert.equal(result.verification.status, 'unknown');
  assert.match(result.nextAction, /不要直接重试安装/u);
  assert.doesNotMatch(JSON.stringify(result), /不暴露 Owner 内部错误/u);
  assert.equal(writes, 1);
  await assert.rejects(registry.install('skill', reviewed.inspectionId, 'workspace', 'user-1', context()), /不存在、已过期/u);
});

test('登记适配器时拒绝缺少 Owner 回读核验的安装实现', () => {
  const registry = new CapabilityInstallRegistry();
  const adapter = {
    kind: 'skill', applicationIds: ['workspace'], targetSchema: { type: 'object', properties: {}, additionalProperties: false },
    validateTarget() { return {}; }, revalidateTarget() { return {}; }, targetSummary() { return '项目'; },
    search: async () => ({}), inspect: async () => ({ resolvedRef: 'c'.repeat(40), details: {} }), install: async () => ({}), list: async () => []
  };
  assert.throws(() => registry.register({ effect(callback) { return callback(); } }, adapter), /Owner 回读核验/u);
});

test('能力生命周期工具协议允许类型 Owner 的实例/项目 target', async () => {
  const { apply } = await import('lfaa-capability-installs/src/index.js');
  const tools = [];
  const owner = { effect(callback) { return callback(); } };
  const context = { ...owner, provide() {}, lfaaTools: { registerTool(_owner, tool) { tools.push(tool); } } };
  apply(context);
  assert.ok(tools.find(tool => tool.name === 'capability_set_enabled').schema.properties.target);
  assert.ok(tools.find(tool => tool.name === 'capability_remove').schema.properties.target);
});

test('明确 GitHub 来源不强制误判能力类型，工具说明引导幂等生命周期', async () => {
  const { apply } = await import('lfaa-capability-installs/src/index.js');
  const tools = [];
  const owner = { effect(callback) { return callback(); } };
  const context = { ...owner, provide() {}, lfaaTools: { registerTool(_owner, tool) { tools.push(tool); } } };
  apply(context);
  const byName = Object.fromEntries(tools.map(tool => [tool.name, tool]));

  assert.ok(!byName.capability_inspect.schema.required.includes('targetApplicationId'), '未指定目标时沿用当前 App');
  assert.match(byName.capability_inspect.description, /只有用户明确要求 LFAA 插件时才用 kind=plugin/u);
  assert.match(byName.capability_inspect.description, /GitHub URL、NPM 包名不能单独决定类型/u);
  assert.match(byName.capability_search.description, /用户明确给出 GitHub HTTPS 插件仓库.*不必先搜索/u);
  assert.match(byName.capability_inspect.description, /NPM 包名\/版本不能用作本机绝对路径/u);
  assert.match(byName.capability_list.description, /同源 installed.*canEnable=true.*capability_set_enabled/u);
  assert.match(byName.capability_set_enabled.description, /启用后再次 capability_list/u);
  assert.match(byName.capability_install.description, /一次性 inspectionId.*同一固定来源/u);
  assert.match(byName.capability_install.description, /已消费凭证或相同参数盲重放/u);
});

test('stdio MCP 来源检查在统一 Permission Owner 中标为危险并将批准范围绑定准确命令', async () => {
  const { apply } = await import('lfaa-capability-installs/src/index.js');
  const tools = [];
  const owner = { effect(callback) { return callback(); } };
  const pluginContext = { ...owner, provide() {}, lfaaTools: { registerTool(_owner, tool) { tools.push(tool); } } };
  apply(pluginContext);
  const inspect = tools.find(tool => tool.name === 'capability_inspect');
  const approvalContext = { userId: 'user-1', applicationId: 'workspace' };
  const stdio = { kind: 'mcp', source: 'stdio://local', target: { transport: 'stdio', command: 'node', args: ['server.mjs'] } };
  const approval = inspect.approval(stdio, approvalContext);

  assert.equal(inspect.risk(stdio), 'dangerous');
  assert.match(approval.summary, /启动并检查.*本机 MCP stdio/u);
  assert.match(approval.scopeSummary, /node.*server\.mjs/u);
  assert.notEqual(approval.scopeKey, inspect.approval({ ...stdio, target: { ...stdio.target, args: ['other.mjs'] } }, approvalContext).scopeKey, '审批记忆范围必须绑定准确命令和 argv');
  assert.notEqual(approval.scopeKey, inspect.approval(stdio, { ...approvalContext, applicationId: 'minecraft' }).scopeKey, '审批范围不得跨 App 复用');
  assert.equal(inspect.risk({ kind: 'mcp', source: 'https://example.test/mcp' }), 'read', 'HTTP initialize/tools/list 保持只读风险');
  assert.match(inspect.description, /远程生产 Host 拒绝启动本机进程/u);
});
