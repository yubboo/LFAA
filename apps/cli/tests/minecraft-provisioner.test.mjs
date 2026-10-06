/**
 * 功能：多核心节点执行长期回归。
 * 作用：验证参数、来源摘要、早退/超时与端口冲突；夹具只存在隔离测试目录。
 * 关联文件：host/daemon/minecraft-provisioner.mjs。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { buildMinecraftNativeArguments, minecraftNativeEnvironment, validateCoreArtifactDownload, downloadCoreArtifact, waitForNativeMinecraftReady, isMinecraftCoreReadyLine, assertMinecraftPortAvailable, writeMinecraftOwnedConfiguration, provisionMinecraftCore } from '../../../packages/host/daemon/src/minecraft-provisioner.mjs';

test('多核心启动协议与路径校验', () => {
  const metadata = { memoryMb: 2048, coreType: 'Paper', launch: { kind: 'jar', path: 'server.jar' } };
  assert.deepEqual(buildMinecraftNativeArguments(metadata).slice(-5), ['-Xms1024M', '-Xmx2048M', '-jar', 'server.jar', 'nogui']);
  assert.ok(buildMinecraftNativeArguments({ ...metadata, coreType: 'Nukkit', language: 'zh-CN' }).includes('chs'));
  assert.equal(isMinecraftCoreReadyLine('Nukkit', '启动完成 (3.721s)！输入 help'), true);
  assert.deepEqual(buildMinecraftNativeArguments({ ...metadata, coreType: 'Velocity' }).slice(-2), ['-jar', 'server.jar']);
  assert.ok(buildMinecraftNativeArguments({ ...metadata, launch: { kind: 'argfile', path: 'libraries/forge/win_args.txt' } }).includes('@libraries/forge/win_args.txt'));
  assert.deepEqual(buildMinecraftNativeArguments({ launch: { kind: 'php', path: 'PocketMine-MP.phar' } }), ['PocketMine-MP.phar', '--no-wizard', '--disable-ansi']);
  for (const path of ['../server.jar', 'libraries/../server.jar', 'server.jar\nstop', 'C:server.jar']) assert.throws(() => buildMinecraftNativeArguments({ ...metadata, launch: { kind: 'jar', path } }));
  assert.equal(minecraftNativeEnvironment('fixture', { executable: 'bin/java.exe', root: 'fixture' }).LFAA_DAEMON_TOKEN, undefined);
});
test('PID 存活不能代替核心就绪；早退和超时会失败', async () => {
  const child = new EventEmitter(); child.exitCode = null; child.signalCode = null;
  const record = { serverReady: false };
  const early = waitForNativeMinecraftReady(child, record, 1); child.emit('exit', 1);
  await assert.rejects(early, /就绪前退出/u);
  await assert.rejects(waitForNativeMinecraftReady(child, record, 0.01), /超时/u);
  const ready = waitForNativeMinecraftReady(child, record, 1); record.serverReady = true; record.onReady(); await ready;
  assert.equal(isMinecraftCoreReadyLine('BungeeCord', 'Listening on /0.0.0.0:25565'), true);
  assert.equal(isMinecraftCoreReadyLine('Paper', 'Starting minecraft server'), false);
});
test('真实 TCP 端口冲突拒绝启动', async () => {
  const listener = createServer(); await new Promise(resolve => listener.listen(0, '0.0.0.0', resolve));
  try { await assert.rejects(assertMinecraftPortAvailable(listener.address().port), /无法使用/u); }
  finally { await new Promise(resolve => listener.close(resolve)); }
});
test('来源跳转和摘要不符拒绝工件且不删除既有文件', async () => {
  const parent = resolve(tmpdir()), directory = await mkdtemp(join(parent, 'lfaa-core-download-'));
  const originalFetch = globalThis.fetch;
  const body = Buffer.from('isolated-artifact-fixture'), digest = createHash('sha1').update(body).digest('hex');
  const artifact = { url: 'https://download.fastmirror.net/download/Paper/fixture/fixture', algorithm: 'sha1', digest };
  const file = join(directory, 'server.jar');
  try {
    assert.throws(() => validateCoreArtifactDownload({ ...artifact, url: 'https://127.0.0.1/private' }));
    globalThis.fetch = async () => new Response(null, { status: 302, headers: { location: 'https://127.0.0.1/private' } });
    await assert.rejects(downloadCoreArtifact(artifact, file, 30), /白名单/u);
    globalThis.fetch = async () => new Response(body);
    await assert.rejects(downloadCoreArtifact({ ...artifact, digest: '0'.repeat(40) }, file, 30), /摘要/u);
    let requests = 0, firstSignal;
    globalThis.fetch = async (url, options) => {
      assert.equal(String(url), artifact.url);
      if (++requests === 1) {
        firstSignal = options.signal;
        let chunks = 0;
        return new Response(new ReadableStream({ pull(controller) { if (chunks++ === 0) controller.enqueue(body); else controller.error(new TypeError('terminated')); } }));
      }
      assert.equal(options.signal, firstSignal); assert.equal(options.headers.Connection, 'close');
      return new Response(body);
    };
    await downloadCoreArtifact(artifact, file, 30);
    assert.equal(requests, 2);
    assert.deepEqual(await readFile(file), body);
    globalThis.fetch = async () => new Response(body);
    await writeFile(file, 'existing');
    await assert.rejects(downloadCoreArtifact(artifact, file, 30), /EEXIST/u);
    assert.equal(await readFile(file, 'utf8'), 'existing');
  } finally {
    globalThis.fetch = originalFetch;
    assert.equal(dirname(resolve(directory)), parent); assert.ok(basename(directory).startsWith('lfaa-core-download-'));
    await rm(directory, { recursive: true, force: true });
  }
});

test('恢复仅复用归属相符的工件与配置，已有用户内容保持完整', async () => {
  const parent = resolve(tmpdir()), directory = await mkdtemp(join(parent, 'lfaa-core-resume-'));
  const artifact = { core: 'Paper', version: 'fixture', build: 'fixture', launchKind: 'jar', algorithm: 'sha1', url: 'https://download.fastmirror.net/download/Paper/fixture/fixture', digest: createHash('sha1').update('fixture').digest('hex') };
  const task = { id: 'task-fixture', instanceId: 'instance-fixture', deploymentId: 'deployment-fixture', payload: { artifact, eulaAccepted: true, executionMode: 'native', resume: true } };
  const host = { createDirectory: async () => directory, assertSafeFileTarget: async () => {}, safeFileExists: async path => readFile(path).then(() => true).catch(error => { if (error.code === 'ENOENT') return false; throw error; }), readSafeFile: readFile, isProcessRunning: () => false, start: async () => ({ serverReady: true }) };
  try {
    const config = join(directory, 'eula.txt');
    await writeMinecraftOwnedConfiguration(config, 'eula=true\n');
    await writeMinecraftOwnedConfiguration(config, 'eula=true\n', true);
    await assert.rejects(writeMinecraftOwnedConfiguration(config, 'eula=false\n', true), /拒绝覆盖/u);
    assert.equal(await readFile(config, 'utf8'), 'eula=true\n');
    const ownership = { instanceId: task.instanceId, deploymentId: task.deploymentId, digest: artifact.digest, core: artifact.core, version: artifact.version, build: artifact.build };
    await writeFile(join(directory, 'lfaa-provision.json'), JSON.stringify({ ...ownership, instanceId: 'other' }));
    await assert.rejects(provisionMinecraftCore(task, host), /不属于/u);
    await writeFile(join(directory, 'lfaa-provision.json'), JSON.stringify(ownership));
    await writeFile(join(directory, 'lfaa-instance.json'), JSON.stringify({ instanceId: task.instanceId, deploymentId: task.deploymentId, coreType: artifact.core, coreBuild: artifact.build, executionMode: 'native' }));
    await writeFile(join(directory, 'server.jar'), 'fixture');
    assert.equal((await provisionMinecraftCore(task, host)).serverReady, true);
    await writeFile(join(directory, 'server.jar'), 'user-change');
    await assert.rejects(provisionMinecraftCore(task, host), /摘要改变/u);
    assert.equal(await readFile(join(directory, 'server.jar'), 'utf8'), 'user-change');
  } finally { assert.equal(dirname(resolve(directory)), parent); assert.ok(basename(directory).startsWith('lfaa-core-resume-')); await rm(directory, { recursive: true, force: true }); }
});
