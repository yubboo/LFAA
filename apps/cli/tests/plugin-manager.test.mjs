/**
 * 功能：回归通用插件来源检查、快照安装、隔离状态和安全 ZIP 解包。
 * 作用：在临时 Profile 与合成 GitHub 响应中验证来源固定、失败关闭、移除及路径穿越拒绝。
 * 关联文件：packages/boot/plugin-manager/src/index.ts、github-source.ts、zip-archive.ts。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync, gzipSync, gunzipSync } from 'node:zlib';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const data = mkdtempSync(join(tmpdir(), 'lfaa-plugin-manager-'));
process.env.LFAA_DATA_DIR = data;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = '';
const { PluginManager } = await import('lfaa-plugin-manager/src/index.js');
const { config } = await import('lfaa-launch-environment/src/config.js');
config.dataDirectory = data;
config.pluginInstallDirectory = join(data, 'profiles');
const { readGithubZip } = await import('lfaa-plugin-manager/src/zip-archive.js');
const { readNpmTarGzip } = await import('lfaa-plugin-manager/src/npm-archive.js');
const originalFetch = globalThis.fetch;
const sourceRef = 'release-1';
const commit = 'a'.repeat(40);
const packageJson = JSON.stringify({
  name: 'dsh-plugin-sample', version: '1.2.3', license: 'MIT', main: 'lib/index.js',
  exports: { './client': { default: './lib/client.js' } }, engines: { dsh: '>=0.1.5-rc.1' },
  dsh: { bundle: { patch: './cordis.patch.yml' }, client: { inject: ['@deepseek-ai/dsh-client-runtime'], platform: 'web', immediately: true } },
  peerDependencies: { '@deepseek-ai/dsh-client-runtime': '>=0.1.0-rc.6', '@deepseek-ai/dsh-host-webserver': '>=0.1.0-rc.6' },
  dependencies: {}, scripts: { prepare: 'node scripts/prepare.mjs' }
});
const archive = makeZip({ 'package.json': packageJson, 'cordis.patch.yml': '# fixture', 'lib/index.js': 'export function apply() {}', 'lib/client.js': 'export function apply() {}' });
const publishedPackageJson = JSON.stringify({
  name: 'dsh-plugin-published', version: '3.0.0', license: 'MIT',
  repository: { type: 'git', url: 'git+https://github.com/acme/published.git' },
  main: 'lib/index.js', exports: { './client': { default: './lib/client.js' } },
  dsh: { bundle: { patch: './cordis.patch.yml' }, client: { platform: 'web' } },
  scripts: { prepare: 'process.exitCode = 99' }
});
const publishedTarball = makeNpmTarball({
  'package.json': publishedPackageJson,
  'cordis.patch.yml': '# published fixture',
  'lib/index.js': 'export function apply() {}',
  'lib/client.js': 'export function apply() {}'
});
const publishedIntegrity = `sha512-${createHash('sha512').update(publishedTarball).digest('base64')}`;
const publishedZip = makeZip({ 'package.json': publishedPackageJson, 'cordis.patch.yml': '# published fixture' });
const unpublishedPackageJson = JSON.stringify({
  ...JSON.parse(publishedPackageJson),
  name: 'dsh-plugin-unpublished',
  repository: { type: 'git', url: 'git+https://github.com/acme/unpublished.git' }
});
const unpublishedZip = makeZip({ 'package.json': unpublishedPackageJson, 'cordis.patch.yml': '# GitHub-only DSH bundle' });
let publishedGitHead = commit;
let publishedIntegrityValue = publishedIntegrity;
let publishedTarballValue = publishedTarball;
let publicRegistryRequests = [];
let failMirrorConnection = false;
const genericArchive = makeZip({
  'package.json': JSON.stringify({ name: 'lfaa-plugin-generic-sample', version: '2.0.0', license: 'MIT', lfaa: { plugin: { apiVersion: 1, id: 'generic-sample', name: '通用示例', entry: 'main.mjs', capabilities: [] } } }),
  'main.mjs': "process.stdout.write(JSON.stringify({ type: 'lfaa.plugin.ready', protocolVersion: 1, pluginId: process.env.LFAA_PLUGIN_ID }) + '\\n');",
  'README.md': 'fixture'
});
const registrySourcePackageName = 'lfaa-plugin-registry-source';
const registrySourceManifest = JSON.stringify({
  name: registrySourcePackageName, version: '1.0.0', description: 'NPM 来源样例', license: 'MIT',
  lfaa: { plugin: { apiVersion: 1, id: 'npm-source-sample', name: 'NPM 来源样例', entry: 'main.mjs', capabilities: [] } },
  scripts: { prepare: 'throw new Error("must not execute")' }
});
const registrySourceTarball = makeNpmTarball({ 'package.json': registrySourceManifest, 'main.mjs': 'export {};' });
const registrySourceIntegrity = `sha512-${createHash('sha512').update(registrySourceTarball).digest('base64')}`;
const customRegistryUrl = 'https://registry.example.test/custom/';
const customRegistryPackageName = 'lfaa-plugin-custom-registry-source';
const customRegistryManifest = JSON.stringify({ name: customRegistryPackageName, version: '2.1.0', license: 'MIT', lfaa: { plugin: { apiVersion: 1, id: 'custom-registry-sample', name: '自定义源样例', entry: 'main.mjs', capabilities: [] } } });
const customRegistryTarball = makeNpmTarball({ 'package.json': customRegistryManifest, 'main.mjs': 'export {};' });
const customRegistryIntegrity = `sha512-${createHash('sha512').update(customRegistryTarball).digest('base64')}`;
const unsupportedArchive = makeZip({ 'package.json': JSON.stringify({ name: 'ordinary-package', version: '1.0.0', license: 'MIT' }) });
const wallpaperRepository = 'https://github.com/elysia395/dsh-wallpaper-engine';
let wallpaperVersion = '1.2.0';
let wallpaperCommit = 'c'.repeat(40);
let wallpaperClientSource = wallpaperClientFixture();
let wallpaperArchive = makeWallpaperArchive(wallpaperVersion);

globalThis.fetch = async input => {
  const url = String(input);
  if (url.startsWith('https://registry.npmjs.org/') || url.startsWith('https://registry.npmmirror.com/')) publicRegistryRequests.push(url);
  if (failMirrorConnection && url === `https://registry.npmmirror.com/${registrySourcePackageName}/1.0.0`) {
    failMirrorConnection = false;
    throw new TypeError('fetch failed');
  }
  if (url === `https://registry.npmjs.org/${registrySourcePackageName}/1.0.0`) return Response.json({
    name: registrySourcePackageName, version: '1.0.0', dist: {
      tarball: `https://registry.npmjs.org/${registrySourcePackageName}/-/${registrySourcePackageName}-1.0.0.tgz`, integrity: registrySourceIntegrity
    }
  });
  if (url === `https://registry.npmjs.org/${registrySourcePackageName}/-/${registrySourcePackageName}-1.0.0.tgz`) return new Response(registrySourceTarball, { headers: { 'content-type': 'application/octet-stream' } });
  if (url === `${customRegistryUrl}${customRegistryPackageName}/2.1.0`) return Response.json({
    name: customRegistryPackageName, version: '2.1.0', dist: {
      tarball: `${customRegistryUrl}${customRegistryPackageName}/-/${customRegistryPackageName}-2.1.0.tgz`, integrity: customRegistryIntegrity
    }
  });
  if (url === `${customRegistryUrl}${customRegistryPackageName}/-/${customRegistryPackageName}-2.1.0.tgz`) return new Response(customRegistryTarball, { headers: { 'content-type': 'application/octet-stream' } });
  if (url === 'https://api.github.com/repos/elysia395/dsh-wallpaper-engine') return Response.json({ full_name: 'elysia395/dsh-wallpaper-engine', description: 'Wallpaper Engine', stargazers_count: 20, default_branch: 'main', license: { spdx_id: 'MIT' } });
  if (url === `https://api.github.com/repos/elysia395/dsh-wallpaper-engine/commits/${sourceRef}`) return Response.json({ sha: wallpaperCommit });
  if (url === `https://api.github.com/repos/elysia395/dsh-wallpaper-engine/commits/${wallpaperCommit}`) return Response.json({ sha: wallpaperCommit });
  if (url === `https://codeload.github.com/elysia395/dsh-wallpaper-engine/zip/${wallpaperCommit}`) return new Response(wallpaperArchive, { headers: { 'content-type': 'application/zip' } });
  if (url === 'https://api.github.com/repos/acme/demo' || url === 'https://api.github.com/repos/acme/generic' || url === 'https://api.github.com/repos/acme/published') return Response.json({ full_name: url.split('/').at(-1) === 'generic' ? 'acme/generic' : url.split('/').at(-1) === 'published' ? 'acme/published' : 'acme/demo', description: 'Fixture', stargazers_count: 3, default_branch: 'main', license: { spdx_id: 'MIT' } });
  if (url === `https://api.github.com/repos/acme/demo/commits/${sourceRef}`) return Response.json({ sha: commit });
  if (url === `https://api.github.com/repos/acme/demo/commits/${commit}`) return Response.json({ sha: commit });
  if (url === `https://codeload.github.com/acme/demo/zip/${commit}`) return new Response(archive, { headers: { 'content-type': 'application/zip' } });
  if (url === `https://api.github.com/repos/acme/generic/commits/${sourceRef}`) return Response.json({ sha: commit });
  if (url === `https://codeload.github.com/acme/generic/zip/${commit}`) return new Response(genericArchive, { headers: { 'content-type': 'application/zip' } });
  if (url === `https://api.github.com/repos/acme/published/commits/${sourceRef}`) return Response.json({ sha: commit });
  if (url === `https://codeload.github.com/acme/published/zip/${commit}`) return new Response(publishedZip, { headers: { 'content-type': 'application/zip' } });
  if (url === 'https://registry.npmjs.org/dsh-plugin-published/3.0.0') return Response.json({
    name: 'dsh-plugin-published', version: '3.0.0', gitHead: publishedGitHead,
    repository: { type: 'git', url: 'git+https://github.com/acme/published.git' },
    dist: { tarball: 'https://registry.npmjs.org/dsh-plugin-published/-/dsh-plugin-published-3.0.0.tgz', integrity: publishedIntegrityValue }
  });
  if (url === 'https://registry.npmjs.org/dsh-plugin-published/-/dsh-plugin-published-3.0.0.tgz') return new Response(publishedTarballValue, { headers: { 'content-type': 'application/octet-stream' } });
  if (url === 'https://registry.npmjs.org/dsh-plugin-unpublished/3.0.0') return Response.json({ error: 'Not found' }, { status: 404 });
  if (url === 'https://api.github.com/repos/acme/unpublished') return Response.json({ full_name: 'acme/unpublished', description: 'GitHub-only DSH bundle', stargazers_count: 0, default_branch: 'main', license: { spdx_id: 'MIT' } });
  if (url === `https://api.github.com/repos/acme/unpublished/commits/${sourceRef}`) return Response.json({ sha: commit });
  if (url === `https://codeload.github.com/acme/unpublished/zip/${commit}`) return new Response(unpublishedZip, { headers: { 'content-type': 'application/zip' } });
  if (url === `https://registry.npmmirror.com/${registrySourcePackageName}/1.0.0`) return Response.json({ error: 'Not found' }, { status: 404 });
  if (url === `https://registry.npmmirror.com/${registrySourcePackageName}`) return Response.json({ versions: { '0.9.0': {} } });
  if (url === `https://registry.npmjs.org/${registrySourcePackageName}`) return Response.json({ versions: { '1.0.0': {} } });
  if (url === `${customRegistryUrl}private-miss/1.0.0`) return Response.json({ error: 'Not found' }, { status: 404 });
  if (url === 'https://api.github.com/repos/acme/unsupported') return Response.json({ full_name: 'acme/unsupported', description: 'Fixture', stargazers_count: 0, default_branch: 'main', license: { spdx_id: 'MIT' } });
  if (url === `https://api.github.com/repos/acme/unsupported/commits/${sourceRef}`) return Response.json({ sha: commit });
  if (url === `https://codeload.github.com/acme/unsupported/zip/${commit}`) return new Response(unsupportedArchive, { headers: { 'content-type': 'application/zip' } });
  if (url.includes('/search/repositories?')) return Response.json({ items: [{ full_name: 'acme/demo', html_url: 'https://github.com/acme/demo', default_branch: 'main', description: 'Fixture', stargazers_count: 3, updated_at: '2026-10-01T00:00:00Z', license: { spdx_id: 'MIT' } }] });
  throw new Error(`未登记测试来源 ${url}`);
};

test.after(async () => {
  globalThis.fetch = originalFetch;
  const { closeDatabase } = await import('lfaa-storage-sqlite/src/database.js');
  closeDatabase();
  rmSync(data, { recursive: true, force: true });
});

test('仓库插件安装固定到提交并保留真实的不兼容状态', async () => {
  const defaultManager = new PluginManager('default-profile');
  assert.equal(defaultManager.installationDirectory, resolve(config.pluginInstallDirectory, 'default-profile'), '默认路径必须来自 LFAA_HOME/Profile 设置，不从 LFAA_DATA_DIR 推导');
  const manager = new PluginManager('web', join(data, 'profiles'));
  assert.equal(manager.installationDirectory, resolve(data, 'profiles', 'web'));
  const candidates = await manager.search('wallpaper');
  assert.equal(candidates[0].fullName, 'acme/demo');
  assert.equal(candidates[0].requiresInspection, true);
  assert.equal('installable' in candidates[0], false);

  const inspected = await manager.inspect('https://github.com/acme/demo', sourceRef);
  assert.equal(inspected.resolvedCommit, commit);
  assert.equal(inspected.compatibility, 'dsh-v1');
  assert.equal(inspected.canEnable, false);
  assert.match(inspected.archiveSha256, /^[a-f0-9]{64}$/u);
  assert.deepEqual(inspected.requirements, {
    dshVersion: '>=0.1.5-rc.1', hostEntry: 'lib/index.js', bundlePatch: 'cordis.patch.yml',
    clientEntry: 'lib/client.js', clientPlatform: 'web', clientInject: ['@deepseek-ai/dsh-client-runtime'],
    peerDependencies: { '@deepseek-ai/dsh-client-runtime': '>=0.1.0-rc.6', '@deepseek-ai/dsh-host-webserver': '>=0.1.0-rc.6' },
    packageDependencies: [], declaredScripts: ['prepare']
  }, '来源检查会向模型与管理员展示静态入口和依赖要求，但不执行包脚本');
  assert.match(inspected.runtimeReason, /LFAA 原生适配器/u);

  const installed = await manager.install('https://github.com/acme/demo', sourceRef, 'admin-fixture');
  assert.equal(installed.id, 'acme-demo');
  assert.equal(installed.state, 'incompatible');
  assert.deepEqual(installed.applicationIds, ['workspace']);
  assert.equal(installed.source.commit, commit);
  assert.equal(installed.source.archiveSha256, createHash('sha256').update(archive).digest('hex'));
  assert.equal(readFileSync(resolve(data, 'profiles/web/acme-demo/cordis.patch.yml'), 'utf8'), '# fixture');
  assert.deepEqual(manager.list().map(item => item.id), ['acme-demo']);
  await assert.rejects(manager.setEnabled('acme-demo', true), error => error.code === 'plugin_runtime_unsupported');
  assert.equal(manager.get('acme-demo').state, 'incompatible');
  assert.deepEqual(new PluginManager('desktop', join(data, 'profiles')).list(), []);

  await manager.install('https://github.com/acme/demo', sourceRef, 'admin-fixture');
  assert.equal(manager.list().length, 1);
  await manager.remove('acme-demo');
  assert.equal(manager.get('acme-demo'), null);
});

test('复制的 DSH 示例 Bundle 通过静态来源检查后仍被隔离且不能启用', async () => {
  const manager = new PluginManager('dsh-example', join(data, 'profiles'));
  const source = fileURLToPath(new URL('./fixtures/dsh-bundle-example', import.meta.url));
  const inspected = await manager.inspect(source);

  assert.equal(inspected.compatibility, 'dsh-v1');
  assert.deepEqual(inspected.requirements.bundlePatch, ['cordis.patch.yml', 'cordis.extra.patch.yml']);
  assert.equal(inspected.requirements.hostEntry, 'index.js');
  assert.equal(inspected.canEnable, false);
  assert.match(inspected.runtimeReason, /没有匹配.*LFAA 原生适配器/u);

  const installed = await manager.install(source, undefined, 'dsh-fixture-admin');
  assert.equal(installed.id, 'local--fixture-bundle');
  assert.equal(installed.state, 'incompatible');
  assert.deepEqual(installed.capabilities, ['dsh.bundle']);
  assert.equal(readFileSync(resolve(data, 'profiles/dsh-example/local--fixture-bundle/cordis.extra.patch.yml'), 'utf8'), '# second ordered fixture patch\n');
  await assert.rejects(manager.setEnabled(installed.id, true), error => error.code === 'plugin_runtime_unsupported');
  assert.equal(manager.get(installed.id).state, 'incompatible');
  await manager.remove(installed.id);
  assert.equal(manager.get(installed.id), null);
});

test('Wallpaper Engine 只允许停用后经重新检查替换同一官方插件，并保留运行数据', async () => {
  const manager = new PluginManager('wallpaper-update', join(data, 'profiles'));
  let active = false;
  manager.registerRuntimeAdapter({
    supports: plugin => plugin.id === 'elysia395-dsh-wallpaper-engine' && plugin.name === 'dsh-plugin-wallpaper-engine'
      && plugin.compatibility === 'dsh-v1' && plugin.version.startsWith('1.')
      && plugin.source.repository.toLowerCase() === wallpaperRepository,
    inspectSnapshot: (_plugin, files) => files.find(file => file.path === 'lib/client.js')?.contents.toString('utf8').includes('RopeDock')
      ? { supported: true, reason: null }
      : { supported: false, reason: 'Wallpaper Engine Client 的 RopeDock 兼容锚点缺失。' },
    enable: async () => { active = true; },
    disable: async () => { active = false; },
    isActive: () => active
  });

  const original = await manager.inspect(wallpaperRepository, sourceRef);
  assert.equal(original.id, 'elysia395-dsh-wallpaper-engine', 'the repository-derived plugin ID stays stable while the DSH package name remains the runtime identity');
  assert.equal(original.canEnable, true);
  const installed = await manager.install(wallpaperRepository, sourceRef, 'wallpaper-admin');
  assert.equal(installed.version, '1.2.0');
  assert.equal(installed.source.commit, wallpaperCommit);
  await manager.setEnabled(installed.id, true);

  const originalCommit = wallpaperCommit;
  wallpaperVersion = '1.4.0';
  wallpaperCommit = 'd'.repeat(40);
  wallpaperClientSource = 'export function apply(ctx) {}';
  wallpaperArchive = makeWallpaperArchive(wallpaperVersion);
  const incompatibleInspection = await manager.inspect(wallpaperRepository, sourceRef);
  assert.equal(incompatibleInspection.canEnable, false, 'inspect runs the same source-anchor check before installation');
  await assert.rejects(manager.install(wallpaperRepository, sourceRef, 'wallpaper-admin'), error => error.code === 'plugin_revision_incompatible' && /RopeDock/u.test(error.message));
  assert.equal(manager.get(installed.id).source.commit, originalCommit, 'an incompatible revision leaves the installed source unchanged');

  wallpaperVersion = '1.3.0';
  wallpaperCommit = 'b'.repeat(40);
  wallpaperClientSource = wallpaperClientFixture();
  wallpaperArchive = makeWallpaperArchive(wallpaperVersion);
  const nextInspection = await manager.inspect(wallpaperRepository, sourceRef);
  assert.equal(nextInspection.resolvedCommit, wallpaperCommit);
  assert.equal(nextInspection.canEnable, true);
  await assert.rejects(manager.install(wallpaperRepository, sourceRef, 'wallpaper-admin'), error => error.code === 'plugin_disable_required');
  assert.equal(manager.get(installed.id).source.commit, originalCommit, 'an enabled plugin is never replaced in place');
  await manager.setEnabled(installed.id, false);

  const runtimeData = resolve(data, 'profiles/wallpaper-update/runtime-data/dsh-plugin-wallpaper-engine');
  const userFile = resolve(runtimeData, 'settings.json');
  mkdirSync(runtimeData, { recursive: true });
  writeFileSync(userFile, '{"playlist":"preserved"}');

  const updated = await manager.install(wallpaperRepository, sourceRef, 'wallpaper-admin');
  assert.equal(updated.version, '1.3.0');
  assert.equal(updated.source.commit, wallpaperCommit);
  assert.equal(updated.state, 'installed', 'updates remain disabled until explicitly enabled');
  assert.equal(JSON.parse(readFileSync(resolve(data, 'profiles/wallpaper-update/elysia395-dsh-wallpaper-engine/package.json'), 'utf8')).version, '1.3.0');
  assert.equal(readFileSync(userFile, 'utf8'), '{"playlist":"preserved"}', 'Profile runtime data is outside the replaceable source directory');
});

test('对话安装自动启用兼容插件、更新后保持停用，启用失败时保留真实安装状态', async () => {
  const previousVersion = wallpaperVersion;
  const previousCommit = wallpaperCommit;
  const previousArchive = wallpaperArchive;
  let active = false;
  let failEnable = false;
  const manager = new PluginManager('capability-lifecycle', join(data, 'profiles'));
  manager.registerRuntimeAdapter({
    supports: plugin => plugin.id === 'elysia395-dsh-wallpaper-engine' && plugin.name === 'dsh-plugin-wallpaper-engine'
      && plugin.compatibility === 'dsh-v1' && plugin.source.repository.toLowerCase() === wallpaperRepository,
    inspectSnapshot: (_plugin, files) => files.find(file => file.path === 'lib/client.js')?.contents.toString('utf8').includes('RopeDock')
      ? { supported: true, reason: null }
      : { supported: false, reason: 'Wallpaper Engine Client 的 RopeDock 兼容锚点缺失。' },
    enable: async () => { if (failEnable) throw new Error('C:\\private\\runtime\\failure'); active = true; },
    disable: async () => { active = false; },
    isActive: () => active
  });

  try {
    wallpaperVersion = '1.2.0';
    wallpaperCommit = 'c'.repeat(40);
    wallpaperArchive = makeWallpaperArchive(wallpaperVersion);
    const fresh = await manager.installForCapability(wallpaperRepository, sourceRef, 'wallpaper-admin');
    assert.equal(fresh.plugin.state, 'enabled');
    assert.equal(fresh.activationRequired, false);
    assert.equal(active, true, 'the Plugin Owner waits for the real Runtime activation before returning');

    active = false; // Simulate process exit without changing the persisted enabled flag.
    let restoredActive = false;
    const restartedManager = new PluginManager('capability-lifecycle', join(data, 'profiles'));
    restartedManager.registerRuntimeAdapter({
      supports: plugin => plugin.id === 'elysia395-dsh-wallpaper-engine' && plugin.name === 'dsh-plugin-wallpaper-engine'
        && plugin.compatibility === 'dsh-v1' && plugin.source.repository.toLowerCase() === wallpaperRepository,
      inspectSnapshot: (_plugin, files) => files.find(file => file.path === 'lib/client.js')?.contents.toString('utf8').includes('RopeDock')
        ? { supported: true, reason: null }
        : { supported: false, reason: 'Wallpaper Engine Client 的 RopeDock 兼容锚点缺失。' },
      enable: async () => { restoredActive = true; },
      disable: async () => { restoredActive = false; },
      isActive: () => restoredActive
    });
    assert.deepEqual(await restartedManager.restoreEnabledPlugins(), [], 'startup restores the persisted enabled plugin through the current Runtime adapter');
    assert.equal(restoredActive, true);
    assert.equal(restartedManager.get(fresh.plugin.id).state, 'enabled');
    await restartedManager.setEnabled(fresh.plugin.id, false);

    wallpaperVersion = '1.3.0';
    wallpaperCommit = 'd'.repeat(40);
    wallpaperArchive = makeWallpaperArchive(wallpaperVersion);
    const updated = await manager.installForCapability(wallpaperRepository, sourceRef, 'wallpaper-admin');
    assert.equal(updated.plugin.state, 'installed');
    assert.equal(updated.activationRequired, false, 'a new revision follows the existing disabled-after-update contract');
    assert.equal(active, false);

    const failing = new PluginManager('capability-activation-failure', join(data, 'profiles'));
    failEnable = true;
    failing.registerRuntimeAdapter({
      supports: plugin => plugin.id === 'elysia395-dsh-wallpaper-engine' && plugin.compatibility === 'dsh-v1',
      inspectSnapshot: () => ({ supported: true, reason: null }),
      enable: async () => { throw new Error('C:\\private\\runtime\\failure'); },
      disable: async () => undefined,
      isActive: () => false
    });
    const failed = await failing.installForCapability(wallpaperRepository, sourceRef, 'wallpaper-admin');
    assert.equal(failed.plugin.state, 'installed', 'a failed Runtime activation keeps the verified source entry');
    assert.equal(failed.activationRequired, true);
    assert.match(failed.activationError, /Runtime 启动失败/u);
    assert.doesNotMatch(failed.activationError, /private\\runtime/u, 'raw paths from a failed external Runtime are not exposed');
  } finally {
    wallpaperVersion = previousVersion;
    wallpaperCommit = previousCommit;
    wallpaperArchive = previousArchive;
  }
});

test('GitHub 源码缺少发布构建文件时，仅复用 gitHead 完全匹配且通过 SRI 校验的官方 NPM tarball', async () => {
  const manager = new PluginManager('published', join(data, 'profiles'));
  const inspected = await manager.inspect('https://github.com/acme/published', sourceRef);
  assert.equal(inspected.resolvedCommit, commit);
  assert.equal(inspected.requirements.hostEntry, 'lib/index.js');
  assert.equal(inspected.requirements.clientEntry, 'lib/client.js');
  assert.equal(inspected.archiveSha256, createHash('sha256').update(publishedTarball).digest('hex'));
  const installed = await manager.install('https://github.com/acme/published', sourceRef, 'admin-fixture');
  assert.equal(installed.source.commit, commit);
  assert.equal(readFileSync(resolve(data, 'profiles/published/acme-published/lib/client.js'), 'utf8'), 'export function apply() {}');
  assert.equal(readFileSync(resolve(data, 'profiles/published/acme-published/package.json'), 'utf8'), publishedPackageJson);
  assert.equal(installed.state, 'incompatible', 'verified package files do not imply a loaded runtime');
});

test('GitHub-only DSH bundle 在官方 NPM 返回 404 时仍可检查并隔离安装原始源码快照', async () => {
  const manager = new PluginManager('github-only', join(data, 'profiles'));
  const inspected = await manager.inspect('https://github.com/acme/unpublished', sourceRef);
  assert.equal(inspected.resolvedCommit, commit);
  assert.equal(inspected.compatibility, 'dsh-v1');
  assert.equal(inspected.requirements.bundlePatch, 'cordis.patch.yml');
  assert.equal(inspected.requirements.hostEntry, null);
  assert.equal(inspected.requirements.clientEntry, null);
  assert.equal(inspected.canEnable, false);
  assert.match(inspected.runtimeReason, /没有匹配其固定来源和版本的 LFAA 原生适配器/u);
  const installed = await manager.install('https://github.com/acme/unpublished', sourceRef, 'admin-fixture');
  assert.equal(installed.source.commit, commit);
  assert.equal(installed.source.archiveSha256, inspected.archiveSha256);
  assert.equal(installed.state, 'incompatible');
  assert.equal(readFileSync(resolve(data, 'profiles/github-only/acme-unpublished/package.json'), 'utf8'), unpublishedPackageJson);
  assert.equal(readFileSync(resolve(data, 'profiles/github-only/acme-unpublished/cordis.patch.yml'), 'utf8'), '# GitHub-only DSH bundle');
  assert.equal(publicRegistryRequests.filter(url => url === 'https://registry.npmjs.org/dsh-plugin-unpublished/3.0.0').length, 2, 'inspection and installation check only the declared package and never substitute another package');
});

test('公开 NPM registry 404 回退后检查与安装固定到同一实际 registry', async () => {
  const manager = new PluginManager('registry-fallback', join(data, 'profiles'));
  publicRegistryRequests = [];
  const inspected = await manager.inspect(`${registrySourcePackageName}@1.0.0`, undefined, 'workspace', 'https://registry.npmmirror.com/');
  assert.equal(inspected.registryUrl, 'https://registry.npmjs.org/');
  assert.deepEqual(publicRegistryRequests.slice(0, 2), [
    `https://registry.npmmirror.com/${registrySourcePackageName}/1.0.0`,
    `https://registry.npmjs.org/${registrySourcePackageName}/1.0.0`
  ]);
  const installed = await manager.install(`${registrySourcePackageName}@1.0.0`, inspected.requestedRef, 'admin-fixture', 'workspace', {
    npmRegistry: inspected.registryUrl,
    expectedResolvedRef: inspected.resolvedCommit,
    expectedSource: { kind: 'npm', location: inspected.sourceLocation }
  });
  assert.equal(installed.source.archiveSha256, createHash('sha256').update(registrySourceTarball).digest('hex'));
  assert.equal(publicRegistryRequests.at(-1), `https://registry.npmjs.org/${registrySourcePackageName}/-/${registrySourcePackageName}-1.0.0.tgz`);
});

test('公开 NPM registry 无匹配版本或网络不可达时按 DSH 顺序回退', async () => {
  const manager = new PluginManager('registry-range-fallback', join(data, 'profiles'));
  publicRegistryRequests = [];
  const ranged = await manager.inspect(`${registrySourcePackageName}@^1.0.0`, undefined, 'workspace', 'https://registry.npmmirror.com/');
  assert.equal(ranged.registryUrl, 'https://registry.npmjs.org/');
  assert.deepEqual(publicRegistryRequests.slice(0, 2), [
    `https://registry.npmmirror.com/${registrySourcePackageName}`,
    `https://registry.npmjs.org/${registrySourcePackageName}`
  ]);

  publicRegistryRequests = [];
  failMirrorConnection = true;
  const networkFallback = await manager.inspect(`${registrySourcePackageName}@1.0.0`, undefined, 'workspace', 'https://registry.npmmirror.com/');
  assert.equal(networkFallback.registryUrl, 'https://registry.npmjs.org/');
  assert.deepEqual(publicRegistryRequests.slice(0, 2), [
    `https://registry.npmmirror.com/${registrySourcePackageName}/1.0.0`,
    `https://registry.npmjs.org/${registrySourcePackageName}/1.0.0`
  ]);
});

test('NPM 发布产物的 gitHead 或 SHA-512 SRI 不匹配时拒绝补齐', async () => {
  const manager = new PluginManager('published-mismatch', join(data, 'profiles'));
  publishedGitHead = 'b'.repeat(40);
  await assert.rejects(manager.inspect('https://github.com/acme/published', sourceRef), /gitHead/u);
  publishedGitHead = commit;
  publishedIntegrityValue = 'sha512-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';
  await assert.rejects(manager.inspect('https://github.com/acme/published', sourceRef), /SHA-512/u);
  publishedIntegrityValue = publishedIntegrity;
  const changedManifest = { ...JSON.parse(publishedPackageJson), description: 'not from the inspected commit' };
  publishedTarballValue = makeNpmTarball({
    'package.json': JSON.stringify(changedManifest),
    'cordis.patch.yml': '# published fixture',
    'lib/index.js': 'export function apply() {}',
    'lib/client.js': 'export function apply() {}'
  });
  publishedIntegrityValue = `sha512-${createHash('sha512').update(publishedTarballValue).digest('base64')}`;
  await assert.rejects(manager.inspect('https://github.com/acme/published', sourceRef), /package\.json/u);
  publishedTarballValue = publishedTarball;
  publishedIntegrityValue = publishedIntegrity;
  assert.deepEqual(manager.list(), []);
});

test('同一管理器识别非 DSH 的 LFAA 插件合同，并在重启后清除过期启用记录', async () => {
  const manager = new PluginManager('generic', join(data, 'profiles'));
  const inspected = await manager.inspect('https://github.com/acme/generic', sourceRef);
  assert.equal(inspected.id, 'generic-sample');
  assert.equal(inspected.compatibility, 'lfaa-v1');
  assert.equal(inspected.runtimeEntry, 'main.mjs');
  assert.equal(inspected.canEnable, false);

  const adapter = { supports: plugin => plugin.compatibility === 'lfaa-v1', enable: async () => {}, disable: async () => {} };
  manager.registerRuntimeAdapter(adapter);
  await manager.install('https://github.com/acme/generic', sourceRef, 'admin-fixture');
  await manager.setEnabled('generic-sample', true);
  assert.equal(manager.get('generic-sample').state, 'enabled');
  assert.equal((await manager.install('https://github.com/acme/generic', sourceRef, 'admin-fixture')).state, 'enabled', '重复安装返回当前真实运行状态');

  const inventoryPath = resolve(data, 'profiles/generic/inventory.json');
  const legacyInventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));
  legacyInventory.version = 1;
  delete legacyInventory.plugins[0].runtimeEntry;
  delete legacyInventory.plugins[0].applicationIds;
  writeFileSync(inventoryPath, JSON.stringify(legacyInventory), 'utf8');
  const restartedManager = new PluginManager('generic', join(data, 'profiles'));
  restartedManager.registerRuntimeAdapter(adapter);
  assert.equal(restartedManager.get('generic-sample').state, 'installed');
  assert.equal((await restartedManager.setEnabled('generic-sample', false)).state, 'installed');
  const migratedInventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));
  assert.equal(migratedInventory.version, 4);
  assert.equal(migratedInventory.plugins[0].source.kind, 'github');
  assert.deepEqual(migratedInventory.plugins[0].applicationIds, ['steamcmd', 'minecraft', 'connectivity', 'writing', 'workspace', 'aivideo']);
  assert.equal(migratedInventory.plugins[0].runtimeEntry, null);
  assert.equal(migratedInventory.plugins[0].state, 'installed');
  await restartedManager.remove('generic-sample');
});

test('ZIP 解包拒绝路径穿越、符号链接和 CRC 被改写的数据', () => {
  assert.throws(() => readGithubZip(makeZip({ '../escape.txt': 'bad' })), /路径穿越|路径/u);
  assert.throws(() => readGithubZip(makeZip({ 'linked.txt': { contents: 'target', mode: 0o120777 } })), /链接或特殊文件/u);
  const valid = makeZip({ 'asset.txt': 'fixture' });
  const corrupted = Buffer.from(valid);
  corrupted[30 + Buffer.byteLength('repo-main/asset.txt')] ^= 0x01;
  assert.throws(() => readGithubZip(corrupted), /安全解压|校验失败/u);
});

test('NPM TAR 解包拒绝路径穿越与符号链接', () => {
  assert.throws(() => readNpmTarGzip(makeNpmTarball({ '../escape.txt': 'bad' })), /路径穿越|路径/u);
  assert.throws(() => readNpmTarGzip(makeNpmTarball({ 'linked.txt': { contents: '', type: '2' } })), /链接或特殊文件/u);
});

test('三类插件来源固定版本；NPM 校验摘要，本机目录与 tarball 固定 Host 内容', async () => {
  const manager = new PluginManager('install-sources', join(data, 'profiles'));
  const npmInspection = await manager.inspect(`${registrySourcePackageName}@1.0.0`);
  assert.equal(npmInspection.sourceType, 'npm');
  assert.equal(npmInspection.sourceLocation, `npm:${registrySourcePackageName}`);
  assert.match(npmInspection.resolvedRef, /^npm:lfaa-plugin-registry-source@1\.0\.0:[a-f0-9]{64}$/u);
  assert.deepEqual(npmInspection.requirements.declaredScripts, ['prepare']);
  const npmInstall = await manager.installForCapability(`${registrySourcePackageName}@1.0.0`, npmInspection.requestedRef, 'source-admin', 'workspace', npmInspection.resolvedRef, { kind: 'npm', location: npmInspection.sourceLocation });
  assert.equal(npmInstall.plugin.source.kind, 'npm');
  assert.equal(npmInstall.plugin.source.archiveSha256, createHash('sha256').update(registrySourceTarball).digest('hex'));
  assert.equal(npmInstall.plugin.state, 'incompatible', 'install scripts are reported but never executed and no adapter is invented');

  const localDirectory = resolve(data, 'source-fixtures', 'local-directory');
  mkdirSync(localDirectory, { recursive: true });
  const localManifest = JSON.stringify({ name: 'lfaa-plugin-local-directory', version: '1.0.0', lfaa: { plugin: { apiVersion: 1, id: 'local-directory-sample', name: '本机目录样例', entry: 'main.mjs', capabilities: [] } } });
  writeFileSync(join(localDirectory, 'package.json'), localManifest);
  writeFileSync(join(localDirectory, 'main.mjs'), 'export {};');
  mkdirSync(join(localDirectory, '.git'), { recursive: true });
  writeFileSync(join(localDirectory, '.git', 'config'), 'private git metadata is never plugin content');
  mkdirSync(join(localDirectory, 'node_modules'), { recursive: true });
  writeFileSync(join(localDirectory, 'node_modules', 'old-dependency.js'), 'not a package source');
  const localInspection = await manager.inspect(localDirectory);
  assert.equal(localInspection.sourceType, 'local');
  assert.equal(localInspection.sourceLocation, localDirectory);
  assert.equal((await manager.inspect('file:' + localDirectory)).resolvedRef, localInspection.resolvedRef, 'DSH file: path syntax resolves the same source');
  assert.equal((await manager.inspect(pathToFileURL(localDirectory).href)).resolvedRef, localInspection.resolvedRef, 'file: URL resolves the same Host source');
  assert.equal((await manager.inspect('link:' + localDirectory)).resolvedRef, localInspection.resolvedRef, 'DSH link: path syntax resolves the same source');
  assert.match(localInspection.resolvedRef, /^local:[a-f0-9]{64}$/u);
  writeFileSync(join(localDirectory, 'main.mjs'), 'export const changed = true;');
  await assert.rejects(manager.installForCapability(localDirectory, undefined, 'source-admin', 'workspace', localInspection.resolvedRef, { kind: 'local', location: localInspection.sourceLocation }), error => error.code === 'plugin_source_changed');
  assert.equal(manager.get('local-directory-sample'), null, 'changed Host contents do not create an inventory record');
  writeFileSync(join(localDirectory, 'main.mjs'), 'export {};');
  const localInstall = await manager.installForCapability(localDirectory, undefined, 'source-admin', 'workspace', localInspection.resolvedRef, { kind: 'local', location: localInspection.sourceLocation });
  assert.equal(localInstall.plugin.source.kind, 'local');
  assert.equal(localInstall.plugin.state, 'incompatible');

  const localArchivePath = resolve(data, 'source-fixtures', 'local-archive.tgz');
  const localArchiveManifest = JSON.stringify({ name: 'lfaa-plugin-local-archive', version: '1.0.0', lfaa: { plugin: { apiVersion: 1, id: 'local-archive-sample', name: '本机归档样例', entry: 'main.mjs', capabilities: [] } } });
  const localTarball = makeNpmTarball({ 'package.json': localArchiveManifest, 'main.mjs': 'export {};' });
  writeFileSync(localArchivePath, localTarball);
  const archiveInspection = await manager.inspect(localArchivePath);
  assert.equal(archiveInspection.sourceType, 'local');
  const archiveInstall = await manager.install(localArchivePath, undefined, 'source-admin');
  assert.equal(archiveInstall.source.kind, 'local');
  assert.equal(archiveInstall.source.archiveSha256, createHash('sha256').update(localTarball).digest('hex'));
});

test('自定义 HTTPS registry 在检查与安装时保持同源并校验 SHA-512，回传真实安装阶段', async () => {
  const manager = new PluginManager('web', join(data, 'profiles'));
  const inspected = await manager.inspect(customRegistryPackageName, '2.1.0', 'workspace', customRegistryUrl);
  assert.equal(inspected.sourceType, 'npm');
  assert.equal(inspected.registryUrl, customRegistryUrl);
  assert.equal(inspected.repository.url, `${customRegistryUrl}${customRegistryPackageName}`);
  const progress = [];
  const installed = await manager.install(`npm:${customRegistryPackageName}`, inspected.version, 'custom-registry-admin', 'workspace', {
    npmRegistry: inspected.registryUrl,
    expectedResolvedRef: inspected.resolvedCommit,
    expectedSource: { kind: 'npm', location: inspected.sourceLocation },
    onProgress: event => progress.push(event)
  });
  assert.equal(installed.source.kind, 'npm');
  assert.equal(installed.state, 'incompatible', 'an unadapted plugin remains installed but isolated');
  assert.deepEqual(progress.map(item => item.stage), ['resolving', 'source-verified', 'compatibility-checked', 'writing-files', 'committing-inventory', 'committing-inventory', 'installed']);
  assert.equal(progress.find(item => item.stage === 'source-verified').fileCount, 2);
  publicRegistryRequests = [];
  await assert.rejects(manager.inspect('private-miss', '1.0.0', 'workspace', customRegistryUrl), /HTTP 404/u);
  assert.deepEqual(publicRegistryRequests, [], 'a private or custom registry miss is never sent to a public registry');
});

test('安装器拒绝缺少 LFAA/DSH 合同的普通仓库', async () => {
  const manager = new PluginManager('unsupported', join(data, 'profiles'));
  await assert.rejects(manager.install('https://github.com/acme/unsupported', sourceRef, 'admin-fixture'), error => error.code === 'plugin_contract_unsupported');
  assert.deepEqual(manager.list(), []);
});

test('插件适配器按目标 App 隔离；旧记录迁移为原有全 App 范围', async () => {
  const manager = new PluginManager('app-scope', join(data, 'profiles'));
  const inspected = await manager.inspect('https://github.com/acme/generic', sourceRef, 'minecraft');
  assert.deepEqual(inspected.applicationIds, ['minecraft']);
  const installed = await manager.install('https://github.com/acme/generic', sourceRef, 'admin-fixture', 'minecraft');
  assert.deepEqual(installed.applicationIds, ['minecraft']);
  await assert.rejects(manager.remove('generic-sample', 'workspace'), error => error.code === 'plugin_target_mismatch');
  assert.deepEqual(manager.list().map(item => item.applicationIds), [['minecraft']]);
});

test('通用能力安装工具跨应用装配，未接入类型明确报告', async () => {
  const { Context } = await import('@deepseek-ai/cordis');
  const { registerAiBusinessTool, listRegisteredAiTools } = await import('lfaa-tools/src/registry.js');
  const { listAiBusinessTools } = await import('lfaa-tools/src/business-tools.js');
  const { apply: applyCapabilityInstalls } = await import('lfaa-capability-installs/src/index.js');
  const { apply: applyPluginManager } = await import('lfaa-plugin-manager/src/index.js');
  const context = new Context();
  context.provide('profileContext', { name: 'web' });
  const loaderEntries = new Map();
  const loaderCalls = [];
  let nextLoaderId = 0;
  let failLoaderStart = false;
  const activeFiber = { state: 2, await: async () => activeFiber };
  context.provide('loader', {
    async create(options) { loaderCalls.push(options); if (failLoaderStart) throw new Error('C:\\private\\runtime\\failure'); const id = `wallpaper-fixture-${++nextLoaderId}`; loaderEntries.set(id, { fiber: activeFiber }); return id; },
    resolve(id) { return loaderEntries.get(id); },
    remove(id) { loaderEntries.delete(id); }
  });
  context.provide('webServer', { registerHandlerAdapter: () => () => undefined });
  context.provide('lfaaTools', { registerTool: registerAiBusinessTool });
  applyCapabilityInstalls(context);
  let restartContext;
  let contextDisposed = false;
  await applyPluginManager(context);
  const expected = ['capability_catalog', 'capability_search', 'capability_inspect', 'capability_install', 'capability_list', 'capability_set_enabled', 'capability_remove'];
  try {
    assert.deepEqual(listRegisteredAiTools().filter(tool => tool.coreManaged).map(tool => tool.name), expected);
    for (const application of ['workspace', 'steamcmd', 'minecraft', 'writing']) {
      const names = listAiBusinessTools(application, 'admin', null, 'ask', false).map(tool => tool.name);
      assert.ok(expected.every(name => names.includes(name)), `管理员 ${application} AI Work 缺少通用能力安装工具`);
      const userNames = listAiBusinessTools(application, 'user', null, 'full_access', false).map(tool => tool.name);
      assert.ok(expected.every(name => userNames.includes(name)), `普通用户 ${application} AI Work 无法查看通用能力安装工具`);
    }
    assert.equal(context.lfaaCapabilityInstalls.catalog().find(item => item.kind === 'plugin')?.available, true);
    assert.deepEqual(context.lfaaCapabilityInstalls.catalog().find(item => item.kind === 'plugin')?.targetSchema, { type: 'object', properties: {}, additionalProperties: false }, '每个 Owner 明确声明额外目标合同');
    assert.equal(context.lfaaCapabilityInstalls.catalog().find(item => item.kind === 'skill')?.available, false);
    await assert.rejects(context.lfaaCapabilityInstalls.search('skill', 'creative writing', 'writing'), /尚未接入真实领域 Owner/u);
    const inspectTool = listRegisteredAiTools().find(tool => tool.name === 'capability_inspect');
    const installTool = listRegisteredAiTools().find(tool => tool.name === 'capability_install');
    const listTool = listRegisteredAiTools().find(tool => tool.name === 'capability_list');
    const setEnabledTool = listRegisteredAiTools().find(tool => tool.name === 'capability_set_enabled');
    const adminContext = { userId: 'admin-fixture', userRole: 'admin', applicationId: 'workspace', signal: new AbortController().signal, onProgress() {} };
    await assert.rejects(inspectTool.execute({ kind: 'plugin', source: 'https://github.com/acme/demo', targetApplicationId: 'minecraft', target: { instanceId: 'must-not-be-ignored' } }, adminContext), error => error.code === 'plugin_target_invalid');
    const inspected = await inspectTool.execute({ kind: 'plugin', source: 'https://github.com/acme/demo', ref: sourceRef, targetApplicationId: 'writing' }, adminContext);
    assert.equal(inspected.resolvedRef, commit, '凭证固定为 Owner 检查得到的 commit');
    assert.equal(inspected.details.plugin.resolvedCommit, commit);
    assert.deepEqual(inspected.details.plugin.requirements.peerDependencies, {
      '@deepseek-ai/dsh-client-runtime': '>=0.1.0-rc.6', '@deepseek-ai/dsh-host-webserver': '>=0.1.0-rc.6'
    });
    assert.match(inspected.summary, /当前不可运行/u, '安装审批会说明当前 Profile 没有适用 Runtime');
    const installApproval = installTool.approval({ kind: 'plugin', inspectionId: inspected.inspectionId, targetApplicationId: 'writing' }, { userId: 'admin-fixture', applicationId: 'writing' });
    assert.match(installApproval.scopeKey, /plugin:writing/u, '审批/记忆范围绑定目标 App');
    assert.match(installApproval.summary, /新安装的兼容插件会尝试自动启用/u, '确认摘要如实说明插件安装的自动启用动作');
    await assert.rejects(installTool.execute({ kind: 'plugin', inspectionId: inspected.inspectionId, targetApplicationId: 'writing' }, { ...adminContext, userId: 'other-admin' }), /不属于当前用户/u);
    await assert.rejects(installTool.execute({ kind: 'plugin', inspectionId: inspected.inspectionId, targetApplicationId: 'minecraft' }, adminContext), /目标 App/u);
    const installResult = await installTool.execute({ kind: 'plugin', inspectionId: inspected.inspectionId, targetApplicationId: 'writing' }, adminContext);
    assert.equal(installResult.outcome, 'verified_incompatible', '安装结果与运行兼容性分别核验');
    assert.equal(installResult.resolvedRef, commit, '核验结果仍绑定被检查的固定 commit');
    assert.equal(installResult.verification.details.commit, commit, '回读 Profile 清单确认实际固定版本');
    assert.deepEqual(installResult.verification.details.applicationIds, ['writing']);
    assert.equal(installResult.verification.details.state, 'incompatible');
    assert.match(installResult.verification.summary, /当前运行适配不兼容/u, 'Owner 回读不会把 DSH 插件报告为可用');
    const incompatibleList = await listTool.execute({ kind: 'plugin', targetApplicationId: 'writing' }, { ...adminContext, applicationId: 'writing' });
    const incompatibleRecord = incompatibleList.capabilities.find(plugin => plugin.id === 'acme-demo');
    assert.equal(incompatibleRecord.state, 'incompatible');
    assert.equal(incompatibleRecord.canEnable, false, '模型从真实 Owner 清单确认不兼容来源不可启用');
    await assert.rejects(installTool.execute({ kind: 'plugin', inspectionId: inspected.inspectionId, targetApplicationId: 'writing' }, adminContext), /不存在、已过期/u, '已消费凭证不能重放');

    const wallpaperInspection = await inspectTool.execute({ kind: 'plugin', source: wallpaperRepository, ref: sourceRef, targetApplicationId: 'workspace' }, adminContext);
    assert.equal(wallpaperInspection.details.plugin.canEnable, true, `the same Profile Runtime validates the upstream Host/Client contract: ${wallpaperInspection.details.plugin.runtimeReason}`);
    const wallpaperInstall = await installTool.execute({ kind: 'plugin', inspectionId: wallpaperInspection.inspectionId, targetApplicationId: 'workspace' }, adminContext);
    assert.equal(wallpaperInstall.outcome, 'verified_ready', 'the conversational install completes Runtime activation before claiming readiness');
    assert.equal(wallpaperInstall.verification.details.state, 'enabled');
    assert.equal(loaderCalls.length, 1, 'the real DSH Host Runtime was mounted in the Profile Loader');
    assert.deepEqual(loaderCalls[0].inject, ['webServer']);
    assert.equal(context.lfaaPluginManager.get('elysia395-dsh-wallpaper-engine').state, 'enabled');

    const wallpaperId = 'elysia395-dsh-wallpaper-engine';
    await setEnabledTool.execute({ kind: 'plugin', id: wallpaperId, enabled: false, targetApplicationId: 'workspace' }, adminContext);
    failLoaderStart = true;
    const failedInspection = await inspectTool.execute({ kind: 'plugin', source: wallpaperRepository, ref: sourceRef, targetApplicationId: 'workspace' }, adminContext);
    const failedInstall = await installTool.execute({ kind: 'plugin', inspectionId: failedInspection.inspectionId, targetApplicationId: 'workspace' }, adminContext);
    assert.equal(failedInstall.outcome, 'verified_installed', 'a compatible package is not reported ready when its Runtime refuses activation');
    assert.equal(failedInstall.verification.details.state, 'installed');
    assert.equal(failedInstall.verification.details.activationRequired, true);
    assert.match(failedInstall.nextAction, /capability_set_enabled/u, 'the model receives a concrete lifecycle recovery action');
    assert.doesNotMatch(failedInstall.verification.details.activationError, /private\\runtime/u);
    const failedList = await listTool.execute({ kind: 'plugin', targetApplicationId: 'workspace' }, adminContext);
    const failedRecord = failedList.capabilities.find(plugin => plugin.id === wallpaperId);
    assert.equal(failedRecord.source.repository, wallpaperRepository);
    assert.equal(failedRecord.source.commit, wallpaperCommit);
    assert.equal(failedRecord.state, 'installed');
    assert.equal(failedRecord.canEnable, true, 'Plugin Owner exposes the current adapter decision to the model');
    failLoaderStart = false;
    const recovered = await setEnabledTool.execute({ kind: 'plugin', id: wallpaperId, enabled: true, targetApplicationId: 'workspace' }, adminContext);
    assert.equal(recovered.plugin.state, 'enabled', 'the reported lifecycle action can recover without reinstalling');
    const recoveredList = await listTool.execute({ kind: 'plugin', targetApplicationId: 'workspace' }, adminContext);
    const recoveredRecord = recoveredList.capabilities.find(plugin => plugin.id === wallpaperId);
    assert.equal(recoveredRecord.state, 'enabled');
    assert.equal(recoveredRecord.canEnable, true);
    await assert.rejects(installTool.execute({ kind: 'plugin', inspectionId: '00000000-0000-4000-8000-000000000000' }, { ...adminContext, userRole: 'user' }), error => error.code === 'plugin_admin_required');

    await context.fiber.dispose();
    contextDisposed = true;
    const restartedLoaderEntries = new Map();
    const restartedLoaderCalls = [];
    restartContext = new Context();
    restartContext.provide('profileContext', { name: 'web' });
    restartContext.provide('lfaaCapabilityInstalls', { register() {} });
    restartContext.provide('loader', {
      async create(options) { restartedLoaderCalls.push(options); const id = 'wallpaper-restarted-fixture'; restartedLoaderEntries.set(id, { fiber: activeFiber }); return id; },
      resolve(id) { return restartedLoaderEntries.get(id); },
      remove(id) { restartedLoaderEntries.delete(id); }
    });
    restartContext.provide('webServer', { registerHandlerAdapter: () => () => undefined });
    await applyPluginManager(restartContext);
    assert.equal(restartedLoaderCalls.length, 1, 'a new Control Plane restores the persisted enabled plugin from its Profile inventory');
    assert.equal(restartContext.lfaaPluginManager.get(wallpaperId).state, 'enabled');
  } finally {
    if (restartContext) await restartContext.fiber.dispose();
    if (!contextDisposed) await context.fiber.dispose();
  }
});

function makeWallpaperArchive(version) {
  const manifest = {
    name: 'dsh-plugin-wallpaper-engine', version, type: 'module', license: 'MIT', main: 'lib/index.js',
    exports: { './client': { default: './lib/client.js' } },
    dsh: { bundle: { patch: './cordis.patch.yml' }, client: { inject: ['@deepseek-ai/dsh-client-runtime'], platform: 'web' } }
  };
  return makeZip({
    'package.json': JSON.stringify(manifest),
    'cordis.patch.yml': 'name: wallpaper-engine\n',
    'lib/index.js': [
      'const BASE = "/wallpaper-engine";',
      'let adapterFenceSeen = false;',
      'let adapterShellSeen = false;',
      'function mediaOriginNeeded() {',
      '  return adapterFenceSeen || adapterShellSeen;',
      '}',
      'function ensureSceneMediaOrigin() {',
      '  return ensureMediaOrigin().then((mediaOrigin) => (mediaOrigin ? mediaOrigin.base : ""));',
      '}',
      'function handleSceneFiles(req, res, mount) {',
      '  const token = "token";',
      '  const abs = mediaMap.get(token);',
      '  const subpath = "scene.pkg";',
      '  const root = dirname(abs);',
      '  const target = resolve(root, subpath);',
      '  if (target === root || !target.startsWith(root + sep)) return;',
      '  linked = lstatSync(target).isSymbolicLink();',
      '  realTarget = realpathSync.native(target);',
      '  realRoot = realpathSync.native(root);',
      '  if (realTarget && realTarget !== realRoot && !realTarget.startsWith(realRoot + sep)) return;',
      '  serveFile(target, req, res, method === \'HEAD\', { revalidate: true, payloadToken: token });',
      '}',
      'function handleSceneAudio(req, res) {',
      '  res.statusCode = 404;',
      "  res.end(JSON.stringify({ error: 'no-scene-audio' }));",
      '}',
      'function ensureMediaOrigin() {',
      '  return new Promise((done) => {',
      '    const server = createServer((req, res) => {',
      '      const pathname = new URL(req.url || "/", "http://x").pathname;',
      "      if (pathname === '/diag' || pathname === `${BASE}/diag`) { mediaDiagHandler(req, res); return; }",
      '      if (!pathname.startsWith(`${BASE}/scene-files/`)) return;',
      "      handleSceneFiles(req, res, 'media');",
      '    });',
      "    server.on('error', unavailable);",
      "    server.listen(0, '127.0.0.1', () => {",
      '      const port = server.address().port;',
      '      mediaOrigin = { server, port, base: `http://127.0.0.1:${port}` };',
      '      done(mediaOrigin);',
      '    });',
      '  });',
      '}',
      'function mediaOriginInfo() {',
      '  return ensureMediaOrigin().then((mediaOrigin) => ({ base: mediaOrigin.base, port: mediaOrigin.port }));',
      '}',
      'export const inject = ["webServer"];',
      'export function apply() {',
      '  const disposers = [];',
      '  let mediaOrigin;',
      '  disposers.push(() => { try { mediaOrigin?.server?.close(); } catch { /* ignore */ } });',
      '}',
      'export default { inject, apply };'
    ].join('\n'),
    'lib/client.js': wallpaperClientSource,
    'lib/http-body.js': 'export const body = true;',
    'lib/settings-schema.js': 'export const schema = true;',
    'lib/routes/scene-serve.js': [
      'export function registerSceneServeRoutes(webServer, c) {',
      '  const { WEBWALLGL_DIR, sep, serveFile } = c;',
      '  const BASE = "/wallpaper-engine";',
      '  return webServer.register({',
      '    kind: "prefix",',
      '    path: `${BASE}/scene-live`,',
      '    handler: (req, res) => {',
      '      const method = (req.method || "GET").toUpperCase();',
      '      const rest = new URL(req.url || "/", "http://x").pathname;',
      '      const abs = resolve(WEBWALLGL_DIR, rest);',
      '      if (abs === WEBWALLGL_DIR || !abs.startsWith(WEBWALLGL_DIR + sep)) {',
      '        res.statusCode = 403;',
      '        res.end("forbidden");',
      '        return;',
      '      }',
      "      res.setHeader('Cache-Control', rest === 'index.html' || rest === 'default-wallpaper/index.html'",
      "        ? 'no-store'",
      "        : 'public, max-age=31536000, immutable');",
      "      serveFile(abs, req, res, method === 'HEAD');",
      '    }',
      '  });',
      '}'
    ].join('\n'),
    'lib/routes/scene-frame.js': [
      'export function registerSceneFrameRoutes(webServer) {',
      '  const handler = (req, res) => {',
      '    if (!frame) {',
      '      res.statusCode = 404;',
      "      res.setHeader('Content-Type', 'application/json; charset=utf-8');",
      "      res.end(JSON.stringify({ error: 'no-frame' }));",
      '      return;',
      '    }',
      '    if (!frame) {',
      "      res.statusCode = variant === 4 ? 422 : 404;",
      "      res.setHeader('Content-Type', 'application/json; charset=utf-8');",
      "      res.end(JSON.stringify({ error: variant === 4 ? 'no-custom-frame' : 'no-frame' }));",
      '      return;',
      '    }',
      '  };',
      '}'
    ].join('\n')
  });
}

function wallpaperClientFixture() {
  return [
    '// 3. Chat-interface rope dock: upstream panel',
    'if (ctx.effect && typeof document !== "undefined" && typeof ReactDOM.createRoot === "function") {',
    '  ctx.effect(() => {',
    '    const root = ReactDOM.createRoot(host);',
    '    root.render(React.createElement(RopeDock, null));',
    '  });',
    '}',
    '// Settings first (host file, port-independent).',
    'function weDrawFrame(canvas) {',
    '  canvas.dataset.weDrawn = "1";',
    '  noteLayerContent(canvas);',
    '}',
    'function layerContentReady(node) {',
    '  if (node.querySelector("canvas.we-media--canvas")) return false;',
    '  return true;',
    '}',
    'function apply(ctx) {',
    '  if (ctx.effect) ctx.effect(() => () => undefined);',
    '}',
    'exports.apply = apply;',
    'exports.inject = inject;',
    'return module.exports;'
  ].join('\n');
}

function makeZip(files) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  for (const [path, value] of Object.entries(files)) {
    const name = Buffer.from(`repo-main/${path}`);
    const entry = typeof value === 'object' && value !== null ? value : { contents: value, mode: 0o100644 };
    const contents = Buffer.from(entry.contents);
    const compressed = deflateRawSync(contents);
    const checksum = crc32(contents);
    const local = Buffer.alloc(30 + name.length + compressed.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(contents.length, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    compressed.copy(local, 30 + name.length);
    localParts.push(local);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(contents.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(((entry.mode ?? 0o100644) << 16) >>> 0, 38);
    central.writeUInt32LE(localOffset, 42);
    name.copy(central, 46);
    centralParts.push(central);
    localOffset += local.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(centralParts.length, 8);
  end.writeUInt16LE(centralParts.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function makeNpmTarball(files, packageRoot = "package") {
  const blocks = [];
  for (const [path, value] of Object.entries(files)) {
    const entry = typeof value === 'object' && value !== null ? value : { contents: value };
    const contents = Buffer.from(entry.contents);
    const header = Buffer.alloc(512);
    Buffer.from(`${packageRoot}/${path}`).copy(header, 0);
    writeOctal(header, 100, 8, 0o100644);
    writeOctal(header, 108, 8, 0);
    writeOctal(header, 116, 8, 0);
    writeOctal(header, 124, 12, contents.length);
    writeOctal(header, 136, 12, 0);
    header.fill(0x20, 148, 156);
    header[156] = (entry.type ?? '0').charCodeAt(0);
    Buffer.from('ustar\0').copy(header, 257);
    Buffer.from('00').copy(header, 263);
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii');
    const padded = Buffer.alloc(Math.ceil(contents.length / 512) * 512);
    contents.copy(padded);
    blocks.push(header, padded);
  }
  return gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024)]));
}

function writeOctal(header, offset, length, value) {
  header.write(value.toString(8).padStart(length - 1, '0') + '\0', offset, length, 'ascii');
}

function crc32(data) {
  let value = 0xffffffff;
  for (const byte of data) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
  }
  return (value ^ 0xffffffff) >>> 0;
}


test('registry dependencies honor zero-major caret ranges instead of choosing an unrelated latest', async () => {
  const { downloadCompatibleRegistryPluginPackage } = await import('lfaa-plugin-manager/src/npm-source.js');
  const previousFetch = globalThis.fetch;
  const name = '@types/range-fixture';
  const version = '0.1.12';
  const tarball = makeNpmTarball({ 'package.json': JSON.stringify({ name, version }), 'index.d.ts': 'export {};' });
  const integrity = 'sha512-' + createHash('sha512').update(tarball).digest('base64');
  const requested = [];
  globalThis.fetch = async input => {
    const url = String(input); requested.push(url);
    if (url.endsWith('/%40types%2Frange-fixture')) return Response.json({ versions: { '0.1.11': {}, '0.1.12': {}, '0.2.0': {}, '0.1.13-beta.1': {} } });
    if (url.endsWith('/0.1.12')) return Response.json({ name, version, dist: { tarball: 'https://registry.npmjs.org/range-fixture.tgz', integrity } });
    if (url.endsWith('/range-fixture.tgz')) return new Response(tarball);
    throw new Error('unexpected request: ' + url);
  };
  try {
    assert.equal((await downloadCompatibleRegistryPluginPackage(name, '^0.1.11')).version, version);
    assert.ok(!requested.some(url => url.endsWith('/latest')));
    await assert.rejects(downloadCompatibleRegistryPluginPackage(name, 'git+https://github.com/untrusted/package'), /版本范围无效/);
  } finally { globalThis.fetch = previousFetch; }
});

test('npmmirror tarball may redirect only to its trusted CDN and still verifies SRI', async () => {
  const { downloadRegistryPluginPackage } = await import('lfaa-plugin-manager/src/npm-source.js');
  const previousFetch = globalThis.fetch;
  const name = 'lfaa-plugin-mirror-redirect-fixture';
  const version = '1.0.0';
  const registry = 'https://registry.npmmirror.com/';
  const tarballUrl = `${registry}${name}/-/${name}-${version}.tgz`;
  const tarball = makeNpmTarball({ 'package.json': JSON.stringify({ name, version }) });
  const integrity = 'sha512-' + createHash('sha512').update(tarball).digest('base64');
  const requested = [];
  let redirectTarget = 'https://cdn.npmmirror.com/packages/fixture.tgz';
  globalThis.fetch = async input => {
    const url = String(input); requested.push(url);
    if (url === `${registry}${name}/${version}`) return Response.json({ name, version, dist: { tarball: tarballUrl, integrity } });
    if (url === tarballUrl) return new Response(null, { status: 302, headers: { location: redirectTarget } });
    if (url === 'https://cdn.npmmirror.com/packages/fixture.tgz') return new Response(tarball);
    if (url === 'https://evil.example/packages/fixture.tgz') throw new Error('untrusted redirect must not be requested');
    throw new Error('unexpected request: ' + url);
  };
  try {
    const result = await downloadRegistryPluginPackage(name, version, registry);
    assert.equal(result.archiveSha256, createHash('sha256').update(tarball).digest('hex'));
    assert.ok(requested.includes('https://cdn.npmmirror.com/packages/fixture.tgz'));

    requested.length = 0;
    redirectTarget = 'https://evil.example/packages/fixture.tgz';
    await assert.rejects(downloadRegistryPluginPackage(name, version, registry), /重定向超出可信来源/u);
    assert.deepEqual(requested, [`${registry}${name}/${version}`, tarballUrl], 'a cross-origin redirect is rejected before requesting its target');
  } finally { globalThis.fetch = previousFetch; }
});


test('legacy DefinitelyTyped roots remain single-root archives with path and link checks', () => {
  const legacy = makeNpmTarball({ 'package.json': '{"name":"@types/legacy-fixture","version":"0.1.0"}' }, 'legacy-fixture');
  assert.deepEqual(readNpmTarGzip(legacy, 'legacy-fixture').map(file => file.path), ['package.json']);
  assert.throws(() => readNpmTarGzip(legacy), /根目录/);
  const mixed = gzipSync(Buffer.concat([gunzipSync(legacy).subarray(0, -1024), gunzipSync(makeNpmTarball({ 'unexpected.js': 'fixture' }))]));
  assert.throws(() => readNpmTarGzip(mixed, 'legacy-fixture'), /根目录/);
  assert.throws(() => readNpmTarGzip(makeNpmTarball({ '../escape.js': 'fixture' }, 'legacy-fixture'), 'legacy-fixture'), /路径穿越/);
  assert.throws(() => readNpmTarGzip(makeNpmTarball({ 'link': { contents: 'fixture', type: '2' } }, 'legacy-fixture'), 'legacy-fixture'), /链接或特殊文件/);
});
