/**
 * 功能：验证 Web Profile 启动后插件 Core Tools 与管理 API 的真实装配及认证边界。
 * 作用：启动临时控制端，分别以管理员、普通账户和未认证请求检查模型工具可见性与插件清单。
 * 关联文件：bundle/base、bundle/web-app、boot/plugin-manager、api/plugin-controller。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const data = mkdtempSync(join(tmpdir(), 'lfaa-plugin-api-'));
process.env.LFAA_DATA_DIR = data;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = '';
process.env.SERVER_HOST = '127.0.0.1';
let context = null;
let closeDatabase = null;

test.after(async () => {
  if (context) await context.fiber.dispose();
  else if (closeDatabase) closeDatabase();
  rmSync(data, { recursive: true, force: true });
});

test('Web Profile 加载通用能力工具并保护适配器目录与插件 API', async () => {
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  process.env.SERVER_PORT = String(port);

  const { boot } = await import('lfaa-app-boot/src/index.js');
  const { config } = await import('lfaa-launch-environment/src/config.js');
  const { database, closeDatabase: close } = await import('lfaa-storage-sqlite/src/database.js');
  const { getUserSettings } = await import('lfaa-settings/src/service.js');
  closeDatabase = close;
  const auth = await import('lfaa-identity-auth/src/service.js');
  const jwt = (await import('jsonwebtoken')).default;
  context = await boot(['web']);

  const tools = context.lfaaTools.listAiBusinessTools('workspace', 'super_admin', null, 'ask', false).map(tool => tool.name);
  assert.ok(['capability_catalog', 'capability_search', 'capability_inspect', 'capability_install', 'capability_list', 'capability_set_enabled', 'capability_remove'].every(name => tools.includes(name)));
  assert.equal(context.lfaaPluginManager.profile, 'web');

  const adminId = randomUUID();
  const memberId = randomUUID();
  database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES(?,1,?,'fixture','fixture','admin',0)").run(adminId, `plugin-admin-${adminId}`);
  database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES(?,2,?,'fixture','fixture','member',0)").run(memberId, `plugin-member-${memberId}`);
  const adminSession = auth.createSession(adminId);
  const memberSession = auth.createSession(memberId);
  assert.equal(getUserSettings(adminId).permissions.mode, 'ask', 'the manual action test runs under request-approval mode');
  const token = sessionId => jwt.sign({ sid: sessionId }, config.jwtSecret, { expiresIn: '1h', audience: 'lfaa-web', issuer: 'lfaa-server' });
  const base = `http://127.0.0.1:${port}/api/plugins`;
  const capabilityCatalogUrl = 'http://127.0.0.1:' + port + '/api/capabilities/catalog';
  let active = false;
  context.lfaaPluginManager.registerRuntimeAdapter({
    supports: plugin => plugin.compatibility === 'dsh-v1' && plugin.source.kind === 'local' && plugin.source.repository === source,
    enable: async () => { active = true; },
    disable: async () => { active = false; },
    isActive: () => active
  });
  const source = join(data, 'manual-lifecycle-source');
  mkdirSync(source, { recursive: true });
  writeFileSync(join(source, 'package.json'), JSON.stringify({
    name: 'dsh-manual-lifecycle',
    version: '1.0.0',
    main: 'lib/index.js',
    dsh: { bundle: { patch: './cordis.patch.yml' }, client: { platform: 'web', inject: ['@deepseek-ai/dsh-client-runtime'] } }
  }));
  mkdirSync(join(source, 'lib'), { recursive: true });
  writeFileSync(join(source, 'cordis.patch.yml'), 'name: manual-lifecycle\n');
  writeFileSync(join(source, 'lib', 'index.js'), 'export {};');
  writeFileSync(join(source, 'lib', 'client.js'), 'export {};');
  const installed = await context.lfaaPluginManager.install(source, undefined, adminId, 'workspace');
  const pluginId = installed.id;

  const anonymous = await fetch(base);
  assert.equal(anonymous.status, 401);
  const anonymousCatalog = await fetch(capabilityCatalogUrl);
  assert.equal(anonymousCatalog.status, 401);
  const memberCatalog = await fetch(capabilityCatalogUrl, { headers: { cookie: `lfaa_session=${token(memberSession.sessionId)}` } });
  assert.equal(memberCatalog.status, 200, 'signed-in users can inspect capability routing without admin access');
  const catalog = (await memberCatalog.json()).capabilities;
  assert.equal(catalog.length, 7);
  assert.deepEqual(catalog.find(item => item.kind === 'plugin'), {
    kind: 'plugin',
    available: true,
    applicationIds: ['steamcmd', 'minecraft', 'connectivity', 'writing', 'workspace', 'aivideo'],
    targetSchema: { type: 'object', properties: {}, additionalProperties: false },
    targetDescription: 'Profile 插件不需要额外的实例或项目目标；安装记录限定到 targetApplicationId。',
    operations: ['search', 'inspect', 'install', 'list', 'enable', 'disable', 'remove'],
    reason: null
  });
  assert.deepEqual(catalog.find(item => item.kind === 'skill'), {
    kind: 'skill',
    available: true,
    applicationIds: ['workspace', 'minecraft'],
    targetSchema: { type: 'object', properties: { sourcePath: { type: 'string', minLength: 1, maxLength: 512 } }, additionalProperties: false },
    targetDescription: '必须使用当前会话选中的真实项目；sourcePath 是 GitHub 仓库内 Skill 目录的相对路径，仓库根目录用 .；多 Skill 仓库需从检查结果中选择后重新检查。',
    operations: ['search', 'inspect', 'install', 'list'],
    reason: null
  });
  assert.ok(['prompt', 'mcp'].every(kind => {
    const item = catalog.find(entry => entry.kind === kind);
    return item?.available === true && item.operations.length > 0;
  }), 'registered Prompt and MCP Owners must appear as available install routes');
  assert.ok(catalog.filter(item => ['tool', 'minecraft-plugin', 'minecraft-mod'].includes(item.kind)).every(item => item.available === false && item.operations.length === 0));
  const admin = await fetch(base, { headers: { cookie: `lfaa_session=${token(adminSession.sessionId)}` } });
  assert.equal(admin.status, 200);
  const adminPlugins = await admin.json();
  assert.equal(adminPlugins.profile, 'web');
  assert.deepEqual(adminPlugins.plugins.map(plugin => [plugin.id, plugin.state]), [[pluginId, 'installed']]);
  const directInstall = await fetch(`${base}/install`, { method: 'POST', headers: { cookie: `lfaa_session=${token(adminSession.sessionId)}`, 'content-type': 'application/json' }, body: JSON.stringify({ repositoryUrl: 'https://github.com/example/plugin' }) });
  assert.equal(directInstall.status, 400, 'manual install requires an inspected fixed revision');
  const lifecycleUrl = `${base}/${pluginId}/lifecycle`;
  const lifecycleHeaders = { cookie: `lfaa_session=${token(adminSession.sessionId)}`, 'content-type': 'application/json' };
  const anonymousToggle = await fetch(lifecycleUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled: true, targetApplicationId: 'workspace', expectedSourceCommit: installed.source.commit }) });
  assert.equal(anonymousToggle.status, 401, 'manual lifecycle requires an authenticated session');
  const memberToggle = await fetch(lifecycleUrl, { method: 'POST', headers: { cookie: `lfaa_session=${token(memberSession.sessionId)}`, 'content-type': 'application/json' }, body: JSON.stringify({ enabled: true, targetApplicationId: 'workspace', expectedSourceCommit: installed.source.commit }) });
  assert.equal(memberToggle.status, 403, 'manual lifecycle still requires an authenticated admin');
  const started = await fetch(lifecycleUrl, { method: 'POST', headers: lifecycleHeaders, body: JSON.stringify({ enabled: true, targetApplicationId: 'workspace', expectedSourceCommit: installed.source.commit }) });
  assert.equal(started.status, 200, `the manual button can invoke the Profile Plugin Manager without an AI Work turn: ${JSON.stringify(await started.clone().json())}`);
  assert.equal((await started.json()).plugin.state, 'enabled');
  assert.equal(active, true, 'the Runtime adapter is actually started');
  const staleAction = await fetch(lifecycleUrl, { method: 'POST', headers: lifecycleHeaders, body: JSON.stringify({ enabled: false, targetApplicationId: 'workspace', expectedSourceCommit: 'stale-revision' }) });
  assert.equal(staleAction.status, 409, 'a stale UI snapshot cannot change a different plugin revision');
  assert.equal(active, true, 'stale revisions do not reach the Runtime');
  const stopped = await fetch(lifecycleUrl, { method: 'POST', headers: lifecycleHeaders, body: JSON.stringify({ enabled: false, targetApplicationId: 'workspace', expectedSourceCommit: installed.source.commit }) });
  assert.equal(stopped.status, 200);
  assert.equal((await stopped.json()).plugin.state, 'installed');
  assert.equal(active, false, 'the Runtime adapter has stopped before the route reports success');
  const invalidAction = await fetch(lifecycleUrl, { method: 'POST', headers: lifecycleHeaders, body: JSON.stringify({ enabled: true, targetApplicationId: 'unknown', expectedSourceCommit: installed.source.commit }) });
  assert.equal(invalidAction.status, 400, 'the target App is validated by the API');
  const wrongApp = await fetch(lifecycleUrl, { method: 'POST', headers: lifecycleHeaders, body: JSON.stringify({ enabled: true, targetApplicationId: 'minecraft', expectedSourceCommit: installed.source.commit }) });
  assert.equal(wrongApp.status, 409, 'a plugin cannot be started through an App it is not registered to');
  const unknownLifecycle = await fetch(`${base}/unknown-plugin/lifecycle`, { method: 'POST', headers: lifecycleHeaders, body: JSON.stringify({ enabled: true, targetApplicationId: 'workspace', expectedSourceCommit: installed.source.commit }) });
  assert.equal(unknownLifecycle.status, 404);
  const directRemove = await fetch(`${base}/example-plugin`, { method: 'DELETE', headers: { cookie: `lfaa_session=${token(adminSession.sessionId)}` } });
  assert.equal(directRemove.status, 404, 'removal must go through the AI tool approval contract');
  const removeUrl = `${base}/${pluginId}/remove`;
  const removal = { targetApplicationId: 'workspace', expectedSourceCommit: installed.source.commit };
  assert.equal((await fetch(removeUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(removal) })).status, 401);
  assert.equal((await fetch(removeUrl, { method: 'POST', headers: { ...lifecycleHeaders, cookie: `lfaa_session=${token(memberSession.sessionId)}` }, body: JSON.stringify(removal) })).status, 403);
  assert.equal((await fetch(removeUrl, { method: 'POST', headers: lifecycleHeaders, body: JSON.stringify({ ...removal, expectedSourceCommit: 'stale' }) })).status, 409);
  assert.ok(context.lfaaPluginManager.get(pluginId), 'stale removal leaves source and inventory intact');
  assert.equal((await fetch(removeUrl, { method: 'POST', headers: lifecycleHeaders, body: JSON.stringify(removal) })).status, 200);
  assert.equal(context.lfaaPluginManager.get(pluginId), null);
  const inspected = await context.lfaaPluginManager.inspect(source);
  const installBody = { repositoryUrl: source, ref: 'local', expectedResolvedRef: inspected.resolvedCommit };
  assert.equal((await fetch(`${base}/install`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(installBody) })).status, 401);
  const manualInstall = await fetch(`${base}/install`, { method: 'POST', headers: lifecycleHeaders, body: JSON.stringify(installBody) });
  assert.equal(manualInstall.status, 200);
  assert.equal((await manualInstall.json()).plugin.state, 'enabled', 'explicit click installs and starts via the same Owner even in ask mode');
  assert.equal(active, true);
  assert.equal((await fetch(removeUrl, { method: 'POST', headers: lifecycleHeaders, body: JSON.stringify(removal) })).status, 200);
  assert.equal(active, false, 'removal awaits actual Runtime stop');
  const member = await fetch(base, { headers: { cookie: `lfaa_session=${token(memberSession.sessionId)}` } });
  assert.equal(member.status, 403);
});
