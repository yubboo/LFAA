/**
 * 功能：验证 Web Profile 启动后插件 Core Tools 与管理 API 的真实装配及认证边界。
 * 作用：启动临时控制端，分别以管理员、普通账户和未认证请求检查模型工具可见性与插件清单。
 * 关联文件：bundle/base、bundle/web-app、boot/plugin-manager、api/plugin-controller。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
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
  const token = sessionId => jwt.sign({ sid: sessionId }, config.jwtSecret, { expiresIn: '1h', audience: 'lfaa-web', issuer: 'lfaa-server' });
  const base = `http://127.0.0.1:${port}/api/plugins`;
  const capabilityCatalogUrl = 'http://127.0.0.1:' + port + '/api/capabilities/catalog';

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
    applicationIds: ['steamcmd', 'minecraft', 'writing', 'workspace'],
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
  assert.deepEqual(await admin.json(), { profile: 'web', plugins: [] });
  const directInstall = await fetch(`${base}/install`, { method: 'POST', headers: { cookie: `lfaa_session=${token(adminSession.sessionId)}`, 'content-type': 'application/json' }, body: JSON.stringify({ repositoryUrl: 'https://github.com/example/plugin' }) });
  assert.equal(directInstall.status, 404, 'HTTP management must not bypass the AI tool approval contract');
  const directToggle = await fetch(`${base}/example-plugin`, { method: 'PATCH', headers: { cookie: `lfaa_session=${token(adminSession.sessionId)}`, 'content-type': 'application/json' }, body: JSON.stringify({ enabled: true }) });
  assert.equal(directToggle.status, 404, 'lifecycle writes must go through the AI tool approval contract');
  const directRemove = await fetch(`${base}/example-plugin`, { method: 'DELETE', headers: { cookie: `lfaa_session=${token(adminSession.sessionId)}` } });
  assert.equal(directRemove.status, 404, 'removal must go through the AI tool approval contract');
  const member = await fetch(base, { headers: { cookie: `lfaa_session=${token(memberSession.sessionId)}` } });
  assert.equal(member.status, 403);
});
