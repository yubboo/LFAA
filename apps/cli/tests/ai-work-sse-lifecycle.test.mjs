/**
 * 功能：回归验证 AI Work SSE 在 POST JSON 请求体读取完成后仍保持可写。
 * 作用：隔离运行 Express JSON 解析器与公共 SSE 助手，防止助手回复只能在刷新后读回。
 * 关联文件：packages/api/gateway/src/sse.ts、packages/api/session-controller/src/index.ts。
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const cliDirectory = resolve(fileURLToPath(new URL("..", import.meta.url)));

test("读取完 POST JSON 后延迟到达的 Agent SSE delta 仍返回给当前响应", () => {
  const isolatedDataDirectory = mkdtempSync(join(tmpdir(), "lfaa-sse-lifecycle-"));
  try {
    const script = `
      import express from 'express';
      import { createServer } from 'node:http';
      import { once } from 'node:events';
      const { openSseStream } = await import('lfaa-api-gateway/src/sse.js');
      const app = express();
      app.use(express.json());
      let listenersCleaned = false;
      app.post('/stream', (request, response) => {
        const requestAbortedListeners = request.listenerCount('aborted');
        const responseCloseListeners = response.listenerCount('close');
        const stream = openSseStream(request, response, { heartbeatMs: 0 });
        setTimeout(() => {
          if (!stream.closed && !response.destroyed && !response.writableEnded) {
            response.write('event: delta\\ndata: {"text":"你好"}\\n\\n');
            response.write('event: done\\ndata: {"status":"completed"}\\n\\n');
            stream.close();
            listenersCleaned = request.listenerCount('aborted') === requestAbortedListeners
              && response.listenerCount('close') === responseCloseListeners;
            response.end();
          }
        }, 40);
      });
      const server = createServer(app);
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      let status = 0;
      let body = '';
      let failure = null;
      try {
        const response = await fetch('http://127.0.0.1:' + server.address().port + '/stream', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ content: '你好' }),
          signal: AbortSignal.timeout(800)
        });
        status = response.status;
        body = await response.text();
      } catch (error) {
        failure = error instanceof Error ? error.name : 'unknown';
      }
      await new Promise(resolve => server.close(resolve));
      console.log(JSON.stringify({ status, body, failure, listenersCleaned }));
    `;
    const output = execFileSync(process.execPath, [
      "--import", "tsx",
      "--import", "./register-package-loader.mjs",
      "--input-type=module", "-e", script
    ], {
      cwd: cliDirectory,
      encoding: "utf8",
      timeout: 10_000,
      env: { ...process.env, LFAA_DATA_DIR: isolatedDataDirectory }
    });
    const result = JSON.parse(output.trim().split(/\r?\n/u).at(-1));
    assert.equal(result.status, 200);
    assert.equal(result.failure, null);
    assert.equal(result.listenersCleaned, true);
    assert.match(result.body, /event: delta\ndata: \{"text":"你好"\}/u);
    assert.match(result.body, /event: done\ndata: \{"status":"completed"\}/u);
  } finally {
    rmSync(isolatedDataDirectory, { recursive: true, force: true });
  }
});
