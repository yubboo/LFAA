/**
 * 功能：验证 Windows AppContainer 第三方插件运行边界。
 * 作用：实测独立 Node 进程握手、源码只读、无本地网络访问及容器权限清理。
 * 关联文件：native/system/src/main.rs、packages/boot/plugin-manager/src/index.ts。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

test('Windows 插件沙盒只读源码、阻止本地网络并可撤销 ACL', { skip: process.platform !== 'win32', timeout: 30_000 }, async () => {
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  const binary = resolve(repositoryRoot, 'dist/apps/daemon/target/x86_64-pc-windows-msvc/release/lfaa-sandbox-host.exe');
  assert.ok(existsSync(binary), '先构建根 dist 下的 Windows Sandbox Host');
  const dataRoot = mkdtempSync(join(tmpdir(), 'lfaa-plugin-sandbox-'));
  const profile = `smoke-${randomUUID().slice(0, 8)}`;
  const pluginId = 'sandbox-smoke';
  const pluginRoot = join(dataRoot, 'plugins', 'profiles', profile, pluginId);
  mkdirSync(pluginRoot, { recursive: true });

  const loopback = createServer(socket => socket.end('unexpected'));
  await new Promise((resolveListen, reject) => {
    loopback.once('error', reject);
    loopback.listen(0, '127.0.0.1', resolveListen);
  });
  const port = loopback.address().port;
  const entry = `
    import { createInterface } from 'node:readline';
    import { writeFileSync } from 'node:fs';
    import { connect } from 'node:net';
    const denied = await new Promise(resolve => {
      const socket = connect({ host: '127.0.0.1', port: ${port} });
      let complete = false;
      const finish = value => { if (complete) return; complete = true; socket.destroy(); resolve(value); };
      socket.once('connect', () => finish(false));
      socket.once('error', () => finish(true));
      setTimeout(() => finish(true), 2000).unref();
    });
    let sourceWriteDenied = false;
    try { writeFileSync(new URL('./main.mjs', import.meta.url), 'modified'); }
    catch (error) { sourceWriteDenied = error.code === 'EACCES' || error.code === 'EPERM'; }
    process.stdout.write(JSON.stringify({ type: 'lfaa.plugin.ready', protocolVersion: 1, pluginId: process.env.LFAA_PLUGIN_ID, sourceWriteDenied, loopbackDenied: denied, secretEnvironmentAbsent: process.env.JWT_SECRET === undefined }) + '\\n');
    for await (const line of createInterface({ input: process.stdin })) {
      process.stderr.write('plugin.stdin:' + line + '\\n');
      const request = JSON.parse(line);
      if (request.type === 'shutdown') {
        process.stdout.write(JSON.stringify({ type: 'lfaa.plugin.stopped', pluginId: process.env.LFAA_PLUGIN_ID }) + '\\n', () => process.exit(0));
        break;
      }
    }
  `;
  const entryPath = join(pluginRoot, 'main.mjs');
  writeFileSync(entryPath, entry, 'utf8');
  const token = randomUUID();
  let host;
  let cleaned = false;
  let cleanupAttempted = false;
  try {
    host = spawn(binary, [
      '--plugin-run', '--data-root', dataRoot, '--profile', profile, '--plugin-id', pluginId,
      '--entry', 'main.mjs', '--node', process.execPath, '--readiness-token', token
    ], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, cwd: dirname(process.execPath), env: { ...process.env, JWT_SECRET: 'plugin-sandbox-test-secret' } });
    const stdout = lineSource(host.stdout);
    const stderr = lineSource(host.stderr);
    const marker = await stderr.waitFor(line => line.includes(`\u001eLFAA_PLUGIN_SANDBOX_READY:${token}\u001e`), 10_000);
    assert.match(marker, /LFAA_PLUGIN_SANDBOX_READY/u);
    const ready = JSON.parse(await stdout.waitFor(line => line.includes('"type":"lfaa.plugin.ready"'), 10_000));
    assert.equal(ready.pluginId, pluginId);
    assert.equal(ready.protocolVersion, 1);
    assert.equal(ready.sourceWriteDenied, true, '插件不能改写只读安装源码');
    assert.equal(ready.loopbackDenied, true, '插件不能连接本机回环服务');
    assert.equal(ready.secretEnvironmentAbsent, true, '插件进程不继承服务端密钥环境');
    assert.equal(readFileSync(entryPath, 'utf8'), entry, '安装源码内容保持不变');

    host.stdin.write('{"type":"shutdown"}\n');
    assert.match(await stderr.waitFor(line => line.startsWith('plugin.stdin:'), 5_000), /shutdown/u);
    const stopped = JSON.parse(await stdout.waitFor(line => line.includes('"type":"lfaa.plugin.stopped"'), 5_000));
    assert.equal(stopped.pluginId, pluginId);
    const exitCode = await waitForClose(host, 5_000);
    assert.equal(exitCode, 0, '停用协议后插件进程与 Sandbox Host 均正常退出');

    cleanupAttempted = true;
    const cleanup = spawn(binary, [
      '--plugin-forget-profile', '--data-root', dataRoot, '--profile', profile,
      '--plugin-id', pluginId, '--node', process.execPath
    ], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    const cleanupOutput = await collectProcess(cleanup);
    assert.equal(cleanupOutput.code, 0, cleanupOutput.stderr);
    assert.equal(JSON.parse(cleanupOutput.stdout).pluginProfileRemoved, true);
    cleaned = true;
  } finally {
    loopback.close();
    if (host && host.exitCode === null) host.kill();
    if (!cleaned && !cleanupAttempted && existsSync(pluginRoot)) {
      cleanupAttempted = true;
      const cleanup = spawn(binary, [
        '--plugin-forget-profile', '--data-root', dataRoot, '--profile', profile,
        '--plugin-id', pluginId, '--node', process.execPath
      ], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
      await collectProcess(cleanup);
    }
    rmSync(dataRoot, { recursive: true, force: true });
  }
});

test('通用 LFAA v1 插件适配器完成真实启动、停止握手和 Host 权限回收', { skip: process.platform !== 'win32', timeout: 30_000 }, async () => {
  const priorEnvironment = {
    dataDirectory: process.env.LFAA_DATA_DIR,
    nodeEnvironment: process.env.NODE_ENV,
    jwtSecret: process.env.JWT_SECRET
  };
  const dataRoot = mkdtempSync(join(tmpdir(), 'lfaa-plugin-adapter-'));
  const profile = `adapter-${randomUUID().slice(0, 8)}`;
  const pluginId = 'generic-runtime-smoke';
  const pluginRoot = join(dataRoot, 'plugins', 'profiles', profile, pluginId);
  mkdirSync(pluginRoot, { recursive: true });
  const entryPath = join(pluginRoot, 'main.mjs');
  writeFileSync(entryPath, `
    import { createInterface } from 'node:readline';
    process.stdout.write(JSON.stringify({ type: 'lfaa.plugin.ready', protocolVersion: 1, pluginId: process.env.LFAA_PLUGIN_ID }) + '\\n');
    for await (const line of createInterface({ input: process.stdin })) {
      const request = JSON.parse(line);
      if (request.type === 'shutdown') {
        process.stdout.write(JSON.stringify({ type: 'lfaa.plugin.stopped', pluginId: process.env.LFAA_PLUGIN_ID }) + '\\n', () => process.exit(0));
        break;
      }
    }
  `, 'utf8');
  let runtime;
  const record = {
    id: pluginId,
    name: '通用运行时样例',
    version: '1.0.0',
    description: '',
    source: { repository: 'https://github.com/acme/runtime-fixture', requestedRef: 'fixture', commit: 'a'.repeat(40), archiveSha256: 'b'.repeat(64), license: 'MIT' },
    compatibility: 'lfaa-v1',
    runtimeEntry: 'main.mjs',
    capabilities: [],
    state: 'installed',
    reason: null,
    installedAt: new Date().toISOString(),
    installedBy: 'test'
  };
  try {
    process.env.LFAA_DATA_DIR = dataRoot;
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = '';
    const module = await import('lfaa-plugin-manager/src/windows-appcontainer-runtime.js');
    runtime = new module.WindowsAppContainerPluginRuntime();
    assert.equal(runtime.supports(record), true, '构建好的 Windows Host 接受通用无 capability 的 LFAA v1 入口');
    await runtime.enable(record, pluginRoot);
    assert.equal(runtime.isActive(record), true, '只有就绪协议确认后适配器才报告启用');
    await runtime.disable(record, pluginRoot);
    assert.equal(runtime.isActive(record), false, '停用确认、进程退出和 ACL 回收完成后适配器报告停用');
    assert.equal(existsSync(entryPath), true, '清理运行权限不会删除安装源码');
  } finally {
    if (runtime?.isActive(record)) await runtime.disable(record, pluginRoot);
    process.env.LFAA_DATA_DIR = priorEnvironment.dataDirectory;
    process.env.NODE_ENV = priorEnvironment.nodeEnvironment;
    process.env.JWT_SECRET = priorEnvironment.jwtSecret;
    rmSync(dataRoot, { recursive: true, force: true });
  }
});

function lineSource(stream) {
  const reader = createInterface({ input: stream });
  const queued = [];
  const waiters = [];
  const history = [];
  reader.on('line', line => {
    history.push(line);
    const index = waiters.findIndex(waiter => waiter.predicate(line));
    if (index < 0) queued.push(line);
    else {
      const [waiter] = waiters.splice(index, 1);
      clearTimeout(waiter.timer);
      waiter.resolve(line);
    }
  });
  reader.on('close', () => {
    for (const waiter of waiters.splice(0)) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error('Sandbox Host 在等待输出时关闭了管道。已收到：' + (history.join(' | ') || '（空）')));
    }
  });
  return {
    waitFor(predicate, timeoutMs) {
      const index = queued.findIndex(predicate);
      if (index >= 0) return Promise.resolve(queued.splice(index, 1)[0]);
      return new Promise((resolveLine, reject) => {
        const waiter = { predicate, resolve: resolveLine, reject, timer: undefined };
        waiter.timer = setTimeout(() => {
          const position = waiters.indexOf(waiter);
          if (position >= 0) waiters.splice(position, 1);
          reject(new Error(`等待 Sandbox Host 输出超时（${timeoutMs} ms）。已收到：${history.join(' | ') || '（空）'}`));
        }, timeoutMs);
        waiters.push(waiter);
      });
    }
  };
}

function collectProcess(child) {
  return new Promise((resolveProcess, reject) => {
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Sandbox Host 命令超时。stdout=${stdout}; stderr=${stderr}`));
    }, 10_000);
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => { clearTimeout(timer); resolveProcess({ code, stdout, stderr }); });
  });
}

function waitForClose(child, timeoutMs) {
  return new Promise((resolveClose, reject) => {
    const timer = setTimeout(() => reject(new Error(`Sandbox Host 在插件停止确认后仍未退出（${timeoutMs} ms）。`)), timeoutMs);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => { clearTimeout(timer); resolveClose(code); });
  });
}
