/**
 * 功能：验证 Web Profile 装配的上游 DSH Bundle/Client Runtime。
 * 作用：从真实 LFAA Host 读取 DSH 启动注入并请求版本化客户端 bundle。
 * 关联文件：web-app Profile、@deepseek-ai/dsh-client-modules、host/webserver。
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const data = mkdtempSync(join(tmpdir(), 'lfaa-dsh-profile-'));
const reservation = createServer();
reservation.listen(0, '127.0.0.1');
await new Promise((resolve, reject) => {
  reservation.once('listening', resolve);
  reservation.once('error', reject);
});
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
process.env.LFAA_DATA_DIR = data;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = '';
process.env.SERVER_HOST = '127.0.0.1';
process.env.SERVER_PORT = String(port);
process.env.LFAA_SERVE_FRONTEND = 'false';

const { boot } = await import('lfaa-app-boot/src/index.js');
let context;

test.after(async () => {
  if (context) await context.fiber.dispose();
  rmSync(data, { recursive: true, force: true });
});

test('Web Profile serves the upstream DSH graph and its declared client bundles', async () => {
  context = await boot(['web']);
  const injectionsResponse = await fetch(`http://127.0.0.1:${port}/__dsh/index-injections`);
  assert.equal(injectionsResponse.status, 200);
  const injections = await injectionsResponse.json();
  const bootRow = injections.find(row => row.kind === 'global' && row.name === '__DSH_BOOT__');
  assert.ok(bootRow, 'the Host publishes the upstream DSH boot graph');
  assert.ok(injections.some(row => row.kind === 'script' && row.text.includes('__ModuleLoader__')));

  const runtimeIds = new Set(bootRow.value.entries.map(row => row.id));
  assert.ok(runtimeIds.has('@deepseek-ai/dsh-client-modules'));
  assert.ok(runtimeIds.has('@deepseek-ai/dsh-client-ui-renderer'));
  assert.ok(runtimeIds.has('@deepseek-ai/dsh-client-hmr'));
  for (const id of ['dsh-client-modules', 'dsh-client-ui-renderer', 'dsh-client-hmr']) {
    const item = context.lfaaPluginRuntime.list().find(plugin => plugin.id === id);
    assert.equal(item?.state, 'ACTIVE', `${id} is active in the existing LFAA Profile Host`);
  }

  const modulesRow = bootRow.value.entries.find(row => row.id === '@deepseek-ai/dsh-client-modules');
  const bundleResponse = await fetch(new URL(modulesRow.url, `http://127.0.0.1:${port}/`));
  assert.equal(bundleResponse.status, 200);
  assert.match(bundleResponse.headers.get('content-type'), /javascript/u);
  assert.ok((await bundleResponse.text()).length > 0);

  const eventsResponse = await fetch(`http://127.0.0.1:${port}/plugins/events`);
  assert.equal(eventsResponse.status, 401, 'the real upstream HMR route is mounted and requires an LFAA session');
  assert.equal((await eventsResponse.json()).error, 'authentication_required');
});
