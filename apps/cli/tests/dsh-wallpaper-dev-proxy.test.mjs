/**
 * 功能：验证 Web 开发服务器将 DSH 与 Wallpaper Engine 同源请求送达现有 Control Plane。
 * 作用：使用隔离 Vite/HTTP Host 检查模块图、bundle、HMR、壁纸 API、上传、Cookie、Range 与流响应。
 * 关联文件：apps/web/vite.config.ts、packages/host/webserver/src/server.ts。
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer as createHttpServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { createHarnessDevProxy } from '../../../apps/web/src/dev-proxy.ts';

const webRequire = createRequire(new URL('../../../apps/web/package.json', import.meta.url));
const vitePackagePath = webRequire.resolve('vite/package.json');
const { createServer: createViteServer } = await import(pathToFileURL(resolve(dirname(vitePackagePath), 'dist/node/index.js')).href);

test('Vite proxies the complete DSH and Wallpaper Engine same-origin request path', async () => {
  const viteConfig = readFileSync(new URL('../../../apps/web/vite.config.ts', import.meta.url), 'utf8');
  assert.match(viteConfig, /proxy:\s*createHarnessDevProxy\(serverTarget,\s*markBackendAvailable\)/u);
  const received = [];
  const host = createHttpServer((request, response) => {
    const chunks = [];
    request.on('data', chunk => chunks.push(chunk));
    request.on('end', () => {
      const body = Buffer.concat(chunks);
      const row = {
        method: request.method,
        url: request.url,
        cookie: request.headers.cookie ?? null,
        range: request.headers.range ?? null,
        contentType: request.headers['content-type'] ?? null,
        body: body.toString('utf8')
      };
      received.push(row);

      if (request.url === '/plugins/events') {
        response.writeHead(200, { 'content-type': 'text/event-stream' });
        response.write('event: ready\ndata: connected\n\n');
        response.end('event: update\ndata: graph\n\n');
        return;
      }

      response.statusCode = row.range ? 206 : 200;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(row));
    });
  });

  let viteServer;
  try {
    host.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
      host.once('listening', resolve);
      host.once('error', reject);
    });
    viteServer = await createViteServer({
      appType: 'spa',
      configFile: false,
      logLevel: 'silent',
      server: {
        host: '127.0.0.1',
        port: 0,
        strictPort: false,
        proxy: createHarnessDevProxy(`http://127.0.0.1:${host.address().port}`, () => {})
      }
    });
    await viteServer.listen();
    const address = viteServer.httpServer.address();
    const base = `http://127.0.0.1:${address.port}`;
    const cookie = 'lfaa_session=isolated-proxy-contract';

    const injectionResponse = await fetch(`${base}/__dsh/index-injections`, { headers: { cookie } });
    assert.equal(injectionResponse.status, 200);
    const injection = await injectionResponse.json();
    assert.equal(injection.url, '/__dsh/index-injections');
    assert.equal(injection.cookie, cookie);

    const bundleResponse = await fetch(`${base}/plugins/dsh-plugin-wallpaper-engine/client.js?rev=fixture`, { headers: { cookie } });
    assert.equal(bundleResponse.status, 200);
    const bundle = await bundleResponse.json();
    assert.equal(bundle.url, '/plugins/dsh-plugin-wallpaper-engine/client.js?rev=fixture');
    assert.equal(bundle.cookie, cookie);

    const hmrResponse = await fetch(`${base}/plugins/events`, { headers: { cookie } });
    assert.match(hmrResponse.headers.get('content-type'), /text\/event-stream/u);
    assert.match(await hmrResponse.text(), /event: update\ndata: graph/u);
    assert.equal(received.at(-1).url, '/plugins/events');
    assert.equal(received.at(-1).cookie, cookie);

    const settingsBody = JSON.stringify({ id: 'custom-wallpaper', loop: true });
    const settingsResponse = await fetch(`${base}/wallpaper-engine/settings`, {
      method: 'PUT',
      headers: { cookie, 'content-type': 'application/json' },
      body: settingsBody
    });
    const settings = await settingsResponse.json();
    assert.equal(settings.method, 'PUT');
    assert.equal(settings.url, '/wallpaper-engine/settings');
    assert.equal(settings.cookie, cookie);
    assert.equal(settings.body, settingsBody);

    const uploadBody = '--lfaa-test-boundary\r\nContent-Disposition: form-data; name="file"; filename="wallpaper.mp4"\r\n\r\nfixture\r\n--lfaa-test-boundary--\r\n';
    const uploadResponse = await fetch(`${base}/wallpaper-engine/upload`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'multipart/form-data; boundary=lfaa-test-boundary' },
      body: uploadBody
    });
    const upload = await uploadResponse.json();
    assert.equal(upload.method, 'POST');
    assert.equal(upload.url, '/wallpaper-engine/upload');
    assert.equal(upload.contentType, 'multipart/form-data; boundary=lfaa-test-boundary');
    assert.equal(upload.body, uploadBody);

    const mediaResponse = await fetch(`${base}/wallpaper-engine/media/fixture-token?source=scene`, {
      headers: { cookie, range: 'bytes=0-3' }
    });
    assert.equal(mediaResponse.status, 206);
    const media = await mediaResponse.json();
    assert.equal(media.url, '/wallpaper-engine/media/fixture-token?source=scene');
    assert.equal(media.cookie, cookie);
    assert.equal(media.range, 'bytes=0-3');
    assert.equal(received.length, 6);
  } finally {
    if (viteServer) await viteServer.close();
    if (host.listening) await new Promise(resolve => host.close(resolve));
  }
});
