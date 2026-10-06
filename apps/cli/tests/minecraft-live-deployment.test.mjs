/**
 * 功能：经明确 EULA 授权后的真实 Windows 自动开服验收。
 * 作用：使用正式认证/API/Daemon 下载、校验、安装、就绪和安全停服；默认跳过，联网验收显式启用。
 * 关联文件：api/minecraft-controller、games/minecraft、host/daemon；测试数据只在独立临时目录并最终清理。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { randomInt } from 'node:crypto';

// 游戏监听端口避开 Windows 动态出站端口范围，防止安装器联网期间占用验收端口。
async function reserveGamePort() {
  for (let attempt = 0; attempt < 50; attempt++) {
    const server = createServer(), port = randomInt(20000, 30000);
    try {
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '0.0.0.0', resolve); });
      await new Promise(resolve => server.close(resolve)); return port;
    } catch (error) { if (error.code !== 'EADDRINUSE') throw error; }
  }
  throw new Error('没有找到空闲的隔离验收端口。');
}

test('真实面板接口 → Daemon → 核心就绪 → 安全停服', { skip: process.env.LFAA_TEST_MINECRAFT_EULA !== 'accepted' || process.platform !== 'win32', timeout: 1800000 }, async () => {
  const parent = resolve(tmpdir()), data = await mkdtemp(join(parent, 'lfaa-minecraft-live-'));
  process.env.LFAA_DATA_DIR = data; process.env.NODE_ENV = 'test'; process.env.JWT_SECRET = ''; process.env.LOG_LEVEL = 'error'; process.env.SERVER_HOST = '127.0.0.1';
  const reservation = createServer(); reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening'); process.env.SERVER_PORT = String(reservation.address().port); await new Promise(resolve => reservation.close(resolve));
  const { boot } = await import('lfaa-app-boot/src/index.js'); const context = await boot(['web']);
  let daemon, exit, logs = '';
  const base = `http://127.0.0.1:${process.env.SERVER_PORT}/api`;
  const until = async (action, timeout = 120000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { const result = await action(); if (result) return result; await new Promise(resolve => setTimeout(resolve, 300)); }
    throw new Error(`验收等待超时：${logs.slice(-2000)}`);
  };
  try {
    const setup = await fetch(`${base}/auth/setup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'isolated-minecraft-test', password: 'Isolated-Minecraft-Fixture-93!' }) });
    assert.equal(setup.status, 201); const headers = { 'Content-Type': 'application/json', Cookie: setup.headers.get('set-cookie').split(';')[0] };
    if (process.env.LFAA_TEST_MINECRAFT_STOP_SECONDS) {
      const settingsResponse = await fetch(`${base}/settings`, { headers }); assert.equal(settingsResponse.status, 200);
      const saved = await settingsResponse.json();
      const updated = await fetch(`${base}/settings/minecraft-runtime`, { method: 'PUT', headers, body: JSON.stringify({ ...saved.settings.minecraftRuntime, minecraftStopTimeoutSeconds: Number(process.env.LFAA_TEST_MINECRAFT_STOP_SECONDS) }) });
      assert.equal(updated.status, 200, await updated.text());
    }
    daemon = spawn(process.execPath, ['--import', 'tsx', '--import', './register-package-loader.mjs', 'src/index.ts', 'daemon'], { cwd: dirname(dirname(fileURLToPath(import.meta.url))), env: process.env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    exit = new Promise((resolve, reject) => { daemon.once('error', reject); daemon.once('exit', resolve); });
    daemon.stdout.on('data', value => { logs += value; }); daemon.stderr.on('data', value => { logs += value; });
    const { listDaemonNodes } = await import('lfaa-host-daemon/src/local-daemon.js');
    const node = await until(() => listDaemonNodes().find(item => item.status === 'online' && item.capabilities.includes('minecraft-multicore-v1')));
    const { listMinecraftCoreBuilds, listMinecraftCores } = await import('lfaa-games-minecraft/src/core-sources.js');
    const catalog = await listMinecraftCores();
    const { getMinecraftTask } = await import('lfaa-jobs/src/minecraft-queue.js');
    const { getMinecraftInstance, getMinecraftInstanceLogs } = await import('lfaa-games-minecraft/src/service.js');
    const requested = (process.env.LFAA_TEST_MINECRAFT_CORES ?? 'Paper').split(',');
    let backendId;
    const waitTask = async taskId => until(() => { const value = getMinecraftTask(taskId); return ['succeeded', 'failed'].includes(value.status) ? value : null; }, 1500000);
    const backendOperation = async (path, method = 'POST', body) => {
      const response = await fetch(`${base}/minecraft/instances/${backendId}/${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
      const result = await response.json(); assert.equal(response.status, 202, JSON.stringify(result));
      const task = await waitTask(result.task.id); assert.equal(task.status, 'succeeded', JSON.stringify(task)); return task;
    };
    // 代理验收使用真实临时后端，经正式面板 API 停服、配置、重启，不跳过校验。
    const needsBackend = requested.some(core => ['BungeeCord', 'Velocity'].includes(core));
    const cores = needsBackend ? ['Paper', ...requested.filter(core => core !== 'Paper')] : requested;
    for (const core of cores) {
      const variants = { Arclight: '1.21.1-forge', CatServer: '1.18.2', Leaves: '1.21.8', Folia: '1.21.8', SpongeNeo: '1.21.8', Velocity: '3.4.0' };
      const preferred = process.env.LFAA_TEST_MINECRAFT_VERSION || variants[core] || (['PocketMine', 'Nukkit', 'BungeeCord'].includes(core) ? 'general' : '1.21.1');
      assert.ok(catalog.cores.find(item => item.name === core)?.versions.includes(preferred), `${core} 当前来源不提供验收版本 ${preferred}`);
      const version = preferred;
      const build = (await listMinecraftCoreBuilds(core, version)).builds[0]?.id; assert.ok(build);
      const serverPort = await reserveGamePort();
      const name = process.env.LFAA_TEST_MINECRAFT_ASCII === '1' ? `acceptance-${core}` : `验收-${core}`;
      const response = await fetch(`${base}/minecraft/provision`, { method: 'POST', headers, body: JSON.stringify({ nodeId: node.id, name, core, version, build, memoryMb: 2048, serverPort, eulaAccepted: true, ...(['BungeeCord', 'Velocity'].includes(core) ? { proxyBackendInstanceId: backendId } : {}) }) });
      const created = await response.json(); assert.equal(response.status, 202, JSON.stringify(created));
      let previous = '';
      const final = await until(() => {
        const task = getMinecraftTask(created.task.id);
        if (task.message !== previous) { previous = task.message; process.stdout.write(`${core}: ${task.message}\n`); }
        return ['succeeded', 'failed'].includes(task.status) ? task : null;
      }, 1500000);
      const startupLog = final.status === 'failed' ? await readFile(join(data, 'games', 'minecraft', name, 'logs', 'latest.log'), 'utf8').catch(() => '') : '';
      if (final.status === 'failed') {
        const { database } = await import('lfaa-storage-sqlite/src/database.js');
        const errors = database.prepare("SELECT stream,line FROM minecraft_task_logs WHERE instance_id=? AND (stream='stderr' OR lower(line) LIKE '%error%' OR lower(line) LIKE '%exception%' OR lower(line) LIKE '%fail%') ORDER BY id").all(created.instance.id);
        process.stderr.write(`${core} 完整错误日志：${JSON.stringify(errors)}\n`);
        const instanceDirectory = join(data, 'games', 'minecraft', name);
        for (const filename of ['logs/debug.log', ...(await readdir(join(instanceDirectory, 'crash-reports')).catch(() => [])).map(file => `crash-reports/${file}`)]) {
          const diagnostic = await readFile(join(instanceDirectory, filename), 'utf8').catch(() => '');
          const lines = diagnostic.split('\n');
          const relevant = lines.flatMap((line, index) => /ERROR|FATAL|Caused by|Exception|Invalid|Failed/u.test(line) ? lines.slice(Math.max(0, index - 1), index + 8) : []);
          if (relevant.length) process.stderr.write(`${core} ${filename}：${relevant.slice(-100).join('\n')}\n`);
        }
      }
      assert.equal(final.status, 'succeeded', `${JSON.stringify(final)}\n${JSON.stringify(getMinecraftInstanceLogs(created.instance.id).slice(-80))}\n${startupLog.slice(-12000)}`);
      assert.equal(final.result.serverReady, true); assert.equal(getMinecraftInstance(created.instance.id).state, 'running');
      const stopResponse = await fetch(`${base}/minecraft/instances/${created.instance.id}/stop`, { method: 'POST', headers });
      const stopped = await stopResponse.json(); assert.equal(stopResponse.status, 202, JSON.stringify(stopped));
      const stopTask = await until(() => { const value = getMinecraftTask(stopped.task.id); return ['succeeded', 'failed'].includes(value.status) ? value : null; });
      assert.equal(stopTask.status, 'succeeded', JSON.stringify(stopTask)); assert.equal(stopTask.result.forced, false, `${JSON.stringify(stopTask)}\n${JSON.stringify(getMinecraftInstanceLogs(created.instance.id).slice(-80))}`); assert.equal(getMinecraftInstance(created.instance.id).state, 'stopped');
      process.stdout.write(`${core}: 实际就绪与安全停服通过。\n`);
      if (needsBackend && core === 'Paper') {
        backendId = created.instance.id;
        await backendOperation('properties', 'PATCH', { properties: { onlineMode: false } });
        const restarted = await backendOperation('start'); assert.equal(restarted.result.serverReady, true);
      }
    }
    if (backendId) { const stopped = await backendOperation('stop'); assert.equal(stopped.result.forced, false); }
  } catch (error) {
    process.stderr.write(`${error.stack}\n${logs.slice(-4000)}\n`);
    throw error;
  } finally {
    if (daemon?.pid && daemon.exitCode === null && daemon.signalCode === null) { daemon.send({ type: 'lfaa-shutdown' }); const timer = setTimeout(() => daemon.kill(), 15000); try { await exit; } finally { clearTimeout(timer); } }
    await context.fiber.dispose();
    assert.equal(dirname(resolve(data)), parent); assert.ok(basename(data).startsWith('lfaa-minecraft-live-')); await rm(data, { recursive: true, force: true });
  }
});
