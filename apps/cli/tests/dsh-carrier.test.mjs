/**
 * 功能：回归 LFAA Express 对 DSH Host WebServer 合同的承载行为。
 * 作用：确认复用单一 HTTP Server、公开 bundle 只读边界、认证路由与可撤销登记。
 * 关联文件：packages/host/webserver/src/dsh-carrier.ts。
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import express from 'express';
import { Context } from '@deepseek-ai/cordis';

const data = mkdtempSync(join(tmpdir(), 'lfaa-dsh-carrier-'));
process.env.LFAA_DATA_DIR = data;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = '';

const { DshWebServerCarrier, mountDshWebRoutes } = await import('lfaa-host-webserver/src/dsh-carrier.js');
const { closeDatabase } = await import('lfaa-storage-sqlite/src/database.js');
const app = express();
const context = new Context();
const carrier = new DshWebServerCarrier(context, '127.0.0.1', 0);
carrier.provide();
const server = createServer(app);
carrier.bind(server);
app.use(express.json());
mountDshWebRoutes(carrier, app);
app.use((_request, response) => response.status(404).json({ error: 'not_found' }));
carrier.register({
  kind: 'prefix',
  path: '/plugins',
  handler: (_request, response) => { response.type('application/javascript').send('window.__DSH_BOOT__ = {};'); }
});
carrier.register({
  kind: 'exact',
  path: '/private-extension',
  handler: (_request, response) => { response.json({ private: true }); }
});
carrier.register({
  kind: 'exact',
  path: '/plugins/events',
  handler: (_request, response) => { response.type('text/event-stream').send('data: {}\n\n'); }
});
await new Promise((ready, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', ready);
});
const address = server.address();
assert.ok(address && typeof address !== 'string');
const baseUrl = `http://127.0.0.1:${address.port}`;

test.after(async () => {
  await new Promise(resolve => server.close(resolve));
  await context.fiber.dispose();
  closeDatabase();
  rmSync(data, { recursive: true, force: true });
});

test('DSH bundle route is public for GET/HEAD, while writes and extension routes require an LFAA session', async () => {
  const bundle = await fetch(`${baseUrl}/plugins/example/client.js`);
  assert.equal(bundle.status, 200);
  assert.match(bundle.headers.get('content-type'), /javascript/u);
  assert.match(await bundle.text(), /__DSH_BOOT__/u);

  const bundleWrite = await fetch(`${baseUrl}/plugins/example/client.js`, { method: 'POST' });
  assert.equal(bundleWrite.status, 401);
  assert.equal((await bundleWrite.json()).error, 'authentication_required');

  const privateRoute = await fetch(`${baseUrl}/private-extension`);
  assert.equal(privateRoute.status, 401);
  assert.equal((await privateRoute.json()).error, 'authentication_required');

  const hmrEvents = await fetch(`${baseUrl}/plugins/events`);
  assert.equal(hmrEvents.status, 401, 'the upstream HMR channel stays behind the LFAA session boundary');
  assert.equal((await hmrEvents.json()).error, 'authentication_required');
});

test('route registrations are unique, constrained, and removable', async () => {
  assert.throws(() => carrier.register({ kind: 'prefix', path: '/', handler: () => undefined }), /路径无效/u);
  assert.throws(() => carrier.register({ kind: 'exact', path: '/plugins/example', handler: () => undefined }), /保留/u);
  assert.throws(() => carrier.register({ kind: 'exact', path: '/plugins', handler: () => undefined }), /保留/u);
  assert.throws(() => carrier.register({ kind: 'prefix', path: '/plugins/events', handler: () => undefined }), /认证事件通道/u);
  assert.throws(() => carrier.register({ kind: 'exact', path: '/private-extension', handler: () => undefined }), /重复/u);

  const dispose = carrier.register({ kind: 'exact', path: '/temporary-extension', handler: (_request, response) => response.sendStatus(204) });
  assert.equal((await fetch(`${baseUrl}/temporary-extension`)).status, 401);
  dispose();
  assert.equal((await fetch(`${baseUrl}/temporary-extension`)).status, 404);
  assert.ok(carrier.port > 0);
});

test('DSH bundle injection URLs stay rooted when the entry page is nested', () => {
  const release = context.on('webserver/index-inject', rows => {
    rows.push(
      { kind: 'script-src', placement: 'head', src: 'plugins/??@deepseek-ai/dsh-client-modules/client.js&rev=boot' },
      { kind: 'script-preload', src: 'plugins/??@deepseek-ai/dsh-client-hmr/client.js&rev=app' }
    );
  });

  try {
    const injections = carrier.collectIndexInjections();
    assert.deepEqual(injections, [
      { kind: 'script-src', placement: 'head', src: '/plugins/??@deepseek-ai/dsh-client-modules/client.js&rev=boot' },
      { kind: 'script-preload', src: '/plugins/??@deepseek-ai/dsh-client-hmr/client.js&rev=app' }
    ]);

    const html = carrier.renderIndex('<!doctype html><html><head><base href="/"></head><body></body></html>');
    assert.ok(html.indexOf('<script src="/plugins/??@deepseek-ai/dsh-client-modules/client.js&amp;rev=boot"></script>') < html.indexOf('<base href="/">'));
    assert.ok(html.includes('<link rel="preload" as="script" href="/plugins/??@deepseek-ai/dsh-client-hmr/client.js&amp;rev=app">'));
  } finally {
    release();
  }
});
