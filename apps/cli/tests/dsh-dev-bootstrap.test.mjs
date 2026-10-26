/**
 * 功能：验证 Vite 获取 DSH Client 启动图的非阻断策略。
 * 作用：覆盖 Control Plane 启动图不可用时保留 LFAA 页面，以及可用时动态注入启动图。
 * 关联文件：apps/web/src/dsh-dev-bootstrap.ts、apps/web/vite.config.ts。
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { createDshDevBootstrapPlugin } from '../../../apps/web/src/dsh-dev-bootstrap.ts';

test('Vite serves the LFAA shell when the Control Plane graph is temporarily unavailable', async t => {
  let requests = 0;
  const server = createServer((_request, response) => {
    requests += 1;
    response.writeHead(503, { 'content-type': 'application/json' });
    response.end('{"error":"dsh_runtime_not_ready"}');
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(async () => { await new Promise(resolve => server.close(resolve)); });

  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const warnings = [];
  const plugin = createDshDevBootstrapPlugin(`http://127.0.0.1:${address.port}`, () => {
    assert.fail('unavailable DSH injection must not transform or block the LFAA shell');
  }, warning => warnings.push(warning));
  const html = '<!doctype html><html><head></head><body></body></html>';
  const transformed = await plugin.transformIndexHtml.handler(html);

  assert.equal(transformed, html);
  assert.equal(requests, 1, 'the missing optional graph is checked once without a retry loop');
  assert.match(warnings[0], /继续提供 LFAA 页面/u);
  assert.match(warnings[0], /DSH 扩展槽暂不可用/u);
});

test('Vite injects the DSH graph when the Control Plane has it ready', async t => {
  const server = createServer((_request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end('[]');
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(async () => { await new Promise(resolve => server.close(resolve)); });

  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const html = '<!doctype html><html><head></head><body></body></html>';
  const plugin = createDshDevBootstrapPlugin(`http://127.0.0.1:${address.port}`, (source, injections) => {
    assert.deepEqual(injections, []);
    return `${source}<!-- dsh graph injected -->`;
  }, assert.fail);
  const transformed = await plugin.transformIndexHtml.handler(html);

  assert.equal(transformed, `${html}<!-- dsh graph injected -->`);
});
