/** 功能：验证 Typert Remote 的 Web Profile Host/Client 闭环。作用：覆盖真实登录、账户隔离边界、插件装配和连接层调用。关联文件：packages/api/gateway、api/account-controller、client/connection、typert。 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const data = mkdtempSync(join(tmpdir(), 'lfaa-typert-gateway-'));
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

test('账户 Remote 经真实 Host 登录认证并由 Client Connection 调用', async () => {
  context = await boot(['web']);
  const base = `http://127.0.0.1:${port}`;

  const unauthorized = await fetch(`${base}/api/typert/auth/me`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ input: {} })
  });
  assert.equal(unauthorized.status, 401);
  assert.equal((await unauthorized.json()).error, 'authentication_required');

  const setup = await fetch(`${base}/api/auth/setup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'p0-admin', password: 'LFAA-Test!2026' })
  });
  assert.equal(setup.status, 201);
  const setupBody = await setup.json();
  const cookie = setup.headers.get('set-cookie')?.split(';', 1)[0];
  assert.ok(cookie);

  const remote = await fetch(`${base}/api/typert/auth/me`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ input: {} })
  });
  assert.equal(remote.status, 200);
  const remoteBody = await remote.json();
  assert.equal(remoteBody.result.user.id, setupBody.user.id);
  assert.equal(remoteBody.result.user.username, setupBody.user.username);

  const previousRoute = await fetch(`${base}/api/auth/me`, { headers: { cookie } });
  assert.equal(previousRoute.status, 404, '账户读取只保留一个 Host 路由 Owner');

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input, init = {}) => {
    const headers = new Headers(init.headers);
    headers.set('cookie', cookie);
    return originalFetch(new URL(String(input), base), { ...init, headers });
  };
  try {
    const { loadCurrentUser } = await import('lfaa-client-connection/src/api.js');
    assert.deepEqual(await loadCurrentUser(), remoteBody.result);

    const authenticatedFetch = globalThis.fetch;
    const requests = [];
    globalThis.fetch = (input, init = {}) => {
      const path = new URL(String(input), base).pathname;
      requests.push(path);
      if (path === '/api/typert/auth/me') {
        return Promise.resolve(new Response(JSON.stringify({ error: 'not_found', message: '找不到请求的接口。' }), {
          status: 404, headers: { 'content-type': 'application/json' },
        }));
      }
      if (path === '/api/auth/me') {
        return Promise.resolve(new Response(JSON.stringify(remoteBody.result), {
          status: 200, headers: { 'content-type': 'application/json' },
        }));
      }
      return authenticatedFetch(input, init);
    };
    try {
      assert.deepEqual(await loadCurrentUser(), remoteBody.result, '升级中的旧 Host 可继续恢复同一认证账户');
      assert.deepEqual(requests, ['/api/typert/auth/me', '/api/auth/me'], '仅明确的 Remote 路由缺失会触发兼容读取');
    } finally {
      globalThis.fetch = authenticatedFetch;
    }

    const unauthorizedRequests = [];
    globalThis.fetch = (input) => {
      const path = new URL(String(input), base).pathname;
      unauthorizedRequests.push(path);
      return Promise.resolve(new Response(JSON.stringify({ error: 'authentication_required', message: '请先登录。' }), {
        status: 401, headers: { 'content-type': 'application/json' },
      }));
    };
    try {
      await assert.rejects(loadCurrentUser(), (error) => error?.status === 401 && error?.code === 'authentication_required');
      assert.deepEqual(unauthorizedRequests, ['/api/typert/auth/me'], '认证失败不能回退到旧路由');
    } finally {
      globalThis.fetch = authenticatedFetch;
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
