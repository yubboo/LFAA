/**
 * 功能：回归 LFAA Plugin Manager 的 Wallpaper Engine 兼容运行时。
 * 作用：验证官方来源边界、Host 结构改写、LFAA Cordis 生命周期、WebServer 路由及运行副本完整性。
 * 关联文件：packages/boot/plugin-manager/src/dsh-wallpaper-engine-runtime.ts。
 */
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Context } from '@deepseek-ai/cordis';

const packageId = 'dsh-plugin-wallpaper-engine';
const recordId = 'elysia395-dsh-wallpaper-engine';
const commit = '0e9171817530272685f42b66e007a0831e2035c9';
const repository = 'https://github.com/elysia395/dsh-wallpaper-engine';
const root = mkdtempSync(join(tmpdir(), 'lfaa-wallpaper-runtime-'));
const data = join(root, 'data');
const installed = join(root, 'installed', packageId);
const previousLfaaDataDirectory = process.env.LFAA_DATA_DIR;
process.env.LFAA_DATA_DIR = data;
mkdirSync(join(installed, 'lib'), { recursive: true });
writeFileSync(join(installed, 'package.json'), JSON.stringify({
  name: packageId,
  version: '1.2.0',
  type: 'module',
  main: 'lib/index.js',
  exports: { './client': { default: './lib/client.js' } },
  dsh: {
    bundle: { patch: './cordis.patch.yml' },
    client: { inject: ['@deepseek-ai/dsh-client-runtime'], platform: 'web' }
  }
}));
writeFileSync(join(installed, 'cordis.patch.yml'), 'name: wallpaper-engine\n');
writeFileSync(join(installed, 'lib', 'index.js'), [
  'const BASE = "/wallpaper-engine";',
  'export const inject = ["webServer"];',
  'export function apply(ctx) {',
  '  const webServer = ctx.webServer;',
  '  const disposers = [];',
  '  let adapterFenceSeen = false;',
  '  let adapterShellSeen = false;',
  '  function mediaOriginNeeded() {',
  '    return adapterFenceSeen || adapterShellSeen;',
  '  }',
  '  function ensureSceneMediaOrigin() {',
  '    return ensureMediaOrigin().then((mediaOrigin) => (mediaOrigin ? mediaOrigin.base : ""));',
  '  }',
  '  function handleSceneFiles(req, res, mount) {',
  '    const token = "token";',
  '    const abs = mediaMap.get(token);',
  '    const subpath = "scene.pkg";',
  '    const root = dirname(abs);',
  '    const target = resolve(root, subpath);',
  '    if (target === root || !target.startsWith(root + sep)) return;',
  '    linked = lstatSync(target).isSymbolicLink();',
  '    realTarget = realpathSync.native(target);',
  '    realRoot = realpathSync.native(root);',
  '    if (realTarget && realTarget !== realRoot && !realTarget.startsWith(realRoot + sep)) return;',
  "    serveFile(target, req, res, method === 'HEAD', { revalidate: true, payloadToken: token });",
  '  }',
  '  function ensureMediaOrigin() {',
  '    return new Promise((done) => {',
  '      const server = createServer((req, res) => {',
  '        const pathname = new URL(req.url || "/", "http://x").pathname;',
  "        if (pathname === '/diag' || pathname === `${BASE}/diag`) { mediaDiagHandler(req, res); return; }",
  '        if (!pathname.startsWith(`${BASE}/scene-files/`)) return;',
  "        handleSceneFiles(req, res, 'media');",
  '      });',
  "      server.on('error', unavailable);",
  "      server.listen(0, '127.0.0.1', () => {",
  '        const port = server.address().port;',
  '        mediaOrigin = { server, port, base: `http://127.0.0.1:${port}` };',
  '        done(mediaOrigin);',
  '      });',
  '    });',
  '  }',
  '  disposers.push(() => { try { mediaOrigin?.server?.close(); } catch { /* ignore */ } });',
  '  function mediaOriginInfo() {',
  '    return ensureMediaOrigin().then((mediaOrigin) => ({ base: mediaOrigin.base, port: mediaOrigin.port }));',
  '  }',
  '  disposers.push(webServer.register({ kind: "prefix", path: `${BASE}/scene-files`, handler: (req, res) => handleSceneFiles(req, res, "app") }));',
  '  disposers.push(webServer.register({ kind: "exact", path: `${BASE}/inventory`, handler() {} }));',
  '  return () => { globalThis.__lfaaWallpaperHostDisposed = true; disposers.forEach((dispose) => dispose()); };',
  '}',
  'export default { inject, apply };'
].join('\n'));
writeFileSync(join(installed, 'lib', 'client.js'), [
  '\t\t  // 3. Chat-interface rope dock: upstream panel',
  '\t\t  if (ctx.effect && typeof document !== "undefined" && typeof ReactDOM.createRoot === "function") {',
  '\t\t    ctx.effect(() => {',
  '\t\t      const root = ReactDOM.createRoot(host);',
  '\t\t      root.render(React.createElement(RopeDock, null));',
  '\t\t    });',
  '\t\t  }',
  '',
  '\t\t  // Settings first (host file, port-independent).',
  'function apply(ctx) {',
  'exports.apply = apply;',
  'exports.inject = inject;',
  'return module.exports;'
].join('\n'));
writeFileSync(join(installed, 'lib', 'http-body.js'), 'export const body = true;\n');
writeFileSync(join(installed, 'lib', 'settings-schema.js'), 'export const schema = true;\n');
mkdirSync(join(installed, 'lib', 'routes'), { recursive: true });
writeFileSync(join(installed, 'lib', 'routes', 'scene-serve.js'), [
  'export function registerSceneServeRoutes(webServer, c) {',
  '  const { disposers, base: BASE, WEBWALLGL_DIR, traceRequests, serveFile } = c;',
  '  disposers.push(webServer.register({',
  '    kind: "prefix",',
  '    path: `${BASE}/scene-live`,',
  '    handler: (req, res) => {',
  '      traceRequests(res, "scene-live", req.url);',
  '      const method = (req.method || "GET").toUpperCase();',
  '      let rest = new URL(req.url || "/", "http://x").pathname;',
  '      if (!rest || rest.endsWith("/")) rest += "index.html";',
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
  '  }));',
  '}'
].join('\n'));

const activeFiber = { state: 2, await: async () => activeFiber };
const removedEntries = [];
const loaderCalls = [];
const loader = {
  async create(options) { loaderCalls.push(options); return 'wallpaper-test-entry'; },
  resolve(id) { return id === 'wallpaper-test-entry' ? { fiber: activeFiber } : undefined; },
  remove(id) { removedEntries.push(id); }
};
const registeredRoutes = new Map();
const carrier = {
  registerHandlerAdapter(owner, path, adapter) {
    registeredRoutes.set(path, { owner, adapter });
    return () => registeredRoutes.delete(path);
  }
};
const context = new Context();
context.provide('loader', loader);
context.provide('webServer', carrier);
const previousDataDirectory = process.env.DSH_WE_DATA_DIR;

test.after(async () => {
  await context.fiber.dispose();
  const { configuration } = await import('lfaa-storage-domain/src/configuration.js');
  configuration.close();
  const { closeDatabase } = await import('lfaa-storage-sqlite/src/database.js');
  closeDatabase();
  if (previousLfaaDataDirectory === undefined) delete process.env.LFAA_DATA_DIR;
  else process.env.LFAA_DATA_DIR = previousLfaaDataDirectory;
  if (previousDataDirectory === undefined) delete process.env.DSH_WE_DATA_DIR;
  else process.env.DSH_WE_DATA_DIR = previousDataDirectory;
  rmSync(root, { recursive: true, force: true });
});

test('verified official DSH v1 revisions are adapted into isolated LFAA runtimes', async () => {
  const { DshWallpaperEngineRuntime } = await import('lfaa-plugin-manager/src/dsh-wallpaper-engine-runtime.js');
  const runtime = new DshWallpaperEngineRuntime(context, 'web', data);
  const record = {
    id: recordId,
    name: packageId,
    version: '1.2.0',
    compatibility: 'dsh-v1',
    source: { repository, commit, archiveSha256: 'a'.repeat(64) }
  };
  assert.equal(runtime.supports(record), true);
  assert.equal(runtime.supports({ ...record, source: { ...record.source, commit: 'a'.repeat(40) } }), true, 'a second verified commit is accepted without a code pin');
  assert.equal(runtime.supports({ ...record, source: { ...record.source, repository: 'https://github.com/untrusted/dsh-wallpaper-engine' } }), false);
  assert.equal(runtime.supports({ ...record, source: { ...record.source, commit: 'not-a-commit' } }), false);
  const sourceFiles = ['package.json', 'cordis.patch.yml', 'lib/index.js', 'lib/client.js', 'lib/http-body.js', 'lib/settings-schema.js', 'lib/routes/scene-serve.js']
    .map(path => ({ path, contents: readFileSync(join(installed, path)) }));
  assert.deepEqual(runtime.inspectSnapshot(record, sourceFiles), { supported: true, reason: null });
  const unsupportedSceneFunction = sourceFiles.map(file => file.path === 'lib/index.js'
    ? { ...file, contents: Buffer.from(file.contents.toString('utf8').replace(
      '  function ensureSceneMediaOrigin() {\n    return ensureMediaOrigin().then((mediaOrigin) => (mediaOrigin ? mediaOrigin.base : ""));\n  }',
      '  function ensureSceneMediaOrigin() { return ensureMediaOrigin(); }'
    )) }
    : file);
  assert.equal(runtime.inspectSnapshot(record, unsupportedSceneFunction).supported, false, 'an unsupported one-line function fails closed without consuming a neighboring helper');
  const unsafeMediaBinding = sourceFiles.map(file => file.path === 'lib/index.js'
    ? { ...file, contents: Buffer.from(file.contents.toString('utf8').replace("server.listen(0, '127.0.0.1'", "server.listen(0, '0.0.0.0'")) }
    : file);
  assert.equal(runtime.inspectSnapshot(record, unsafeMediaBinding).supported, false, 'a non-loopback media listener fails closed');
  const missingSceneFence = sourceFiles.map(file => file.path === 'lib/index.js'
    ? { ...file, contents: Buffer.from(file.contents.toString('utf8').replace("handleSceneFiles(req, res, 'media');", '')) }
    : file);
  assert.equal(runtime.inspectSnapshot(record, missingSceneFence).supported, false, 'a media listener without the scene-files route fails closed');
  const missingSceneCleanup = sourceFiles.map(file => file.path === 'lib/index.js'
    ? { ...file, contents: Buffer.from(file.contents.toString('utf8').replace('  disposers.push(() => { try { mediaOrigin?.server?.close(); } catch { /* ignore */ } });\n', '')) }
    : file);
  assert.equal(runtime.inspectSnapshot(record, missingSceneCleanup).supported, false, 'a media listener without its Fiber disposer fails closed');
  assert.equal(runtime.inspectSnapshot(record, [...sourceFiles.filter(file => file.path !== 'lib/client.js'), { path: 'lib/client.js', contents: Buffer.from('export function apply() {}') }]).supported, false);
  const missingSceneDocumentPolicy = sourceFiles.map(file => file.path === 'lib/routes/scene-serve.js'
    ? { ...file, contents: Buffer.from(file.contents.toString('utf8').replace('    path: `${BASE}/scene-live`,\n', '')) }
    : file);
  assert.equal(runtime.inspectSnapshot(record, missingSceneDocumentPolicy).supported, false, 'a changed Scene Renderer route fails closed');
  const missingSceneAssetFence = sourceFiles.map(file => file.path === 'lib/routes/scene-serve.js'
    ? { ...file, contents: Buffer.from(file.contents.toString('utf8').replace('      if (abs === WEBWALLGL_DIR || !abs.startsWith(WEBWALLGL_DIR + sep)) {\n', '')) }
    : file);
  assert.equal(runtime.inspectSnapshot(record, missingSceneAssetFence).supported, false, 'a changed Scene Renderer path fence fails closed');

  await runtime.enable(record, installed);
  assert.equal(runtime.isActive(record), true);
  assert.equal(registeredRoutes.has('/wallpaper-engine/settings'), true);
  assert.equal(loaderCalls.length, 1);
  assert.deepEqual(loaderCalls[0].inject, ['webServer']);
  assert.equal(process.env.DSH_WE_DATA_DIR, join(data, 'plugins', 'runtime-data', 'profiles', 'web', packageId));

  const runtimeCopy = join(data, 'plugins', 'runtime-adapters', 'profiles', 'web', packageId, commit, 'adapter-7');
  const adaptedManifest = JSON.parse(readFileSync(join(runtimeCopy, 'package.json'), 'utf8'));
  assert.deepEqual(adaptedManifest.dsh.client.inject, ['slots', 'shortcuts', 'theme']);
  const host = readFileSync(join(runtimeCopy, 'lib', 'index.js'), 'utf8');
  assert.match(host, /function mediaOriginNeeded\(\) \{ return false; \}/u);
  assert.match(host, /function ensureSceneMediaOrigin\(\) \{ return Promise\.resolve\(""\); \}/u, 'Scene must use the existing page origin');
  assert.match(host, /function mediaOriginInfo\(\) \{ return Promise\.resolve\(\{ base: null, port: null \}\); \}/u, 'diagnostics must report that no extra media origin is active');
  assert.match(host, /function ensureMediaOrigin\(\) \{ return Promise\.resolve\(null\); \}/u, 'every caller must be unable to start another listener');
  assert.doesNotMatch(host, /server\.listen\(0, '127\.0\.0\.1'/u, 'the adapted runtime must not contain an active ephemeral listener');
  assert.match(host, /function handleSceneFiles\(req, res, mount\)/u, 'the upstream fenced file handler must remain available');
  assert.match(host, /realpathSync\.native\(target\)/u, 'the media route must preserve the upstream realpath fence');
  assert.match(host, /disposers\.push\(\(\) => \{ try \{ mediaOrigin\?\.server\?\.close\(\)/u, 'Cordis Fiber cleanup must close the media listener');
  assert.match(host, /path: `\$\{BASE\}\/scene-files`, handler: \(req, res\) => handleSceneFiles\(req, res, "app"\)/u, 'the existing same-origin scene route must remain registered');
  assert.match(host, /export default \{ inject, apply: \(ctx, config\) => apply\(ctx, config\) \};/u);
  const sceneServe = readFileSync(join(runtimeCopy, 'lib', 'routes', 'scene-serve.js'), 'utf8');
  assert.match(sceneServe, /if \(rest === 'index\.html'\) res\.setHeader\('X-Frame-Options', 'SAMEORIGIN'\)/u, 'only the same-origin iframe document may be embedded');
  assert.equal((sceneServe.match(/X-Frame-Options/g) ?? []).length, 1, 'static Scene assets and other routes retain the global frame policy');
  assert.ok(sceneServe.indexOf("'SAMEORIGIN'") < sceneServe.indexOf("serveFile(abs, req, res, method === 'HEAD');"), 'the frame policy is set before the document is served');
  const client = readFileSync(join(runtimeCopy, 'lib', 'client.js'), 'utf8');
  assert.doesNotMatch(client, /ReactDOM\.createRoot\(host\)/u);
  assert.match(client, /shell\.overlay/u);
  assert.match(client, /clearWallpaperEngineOverride/u);
  assert.match(client, /exports\.apply = \(ctx, config\) => apply\(ctx, config\);/u);
  const workbenchSource = readFileSync(new URL('../../../packages/client/ui-layout/src/Workbench.tsx', import.meta.url), 'utf8');
  assert.match(workbenchSource, /<DshSlotOutlet name="shell\.overlay" \/>/u, 'the Workbench must render the upstream floating RopeDock slot');
  const workspaceSource = readFileSync(new URL('../../../packages/client/ui-workspace/src/ApplicationWorkspace.tsx', import.meta.url), 'utf8');
  assert.match(workspaceSource, /guide\.icon/u, 'the LFAA context menu must render upstream guide icons');
  assert.match(workspaceSource, /control\.openTab\(tab\.kind\)/u, 'choosing a guide entry must activate and expand its tab');
  assert.equal(existsSync(join(runtimeCopy, 'lfaa-runtime-adapter.json')), true);

  await runtime.disable(record);
  assert.equal(runtime.isActive(record), false);
  assert.deepEqual(removedEntries, ['wallpaper-test-entry']);
  assert.equal(process.env.DSH_WE_DATA_DIR, previousDataDirectory);

  writeFileSync(join(runtimeCopy, 'lib', 'client.js'), `${client}\n// changed after staging\n`);
  await assert.rejects(runtime.enable(record, installed), /Runtime 副本与当前来源\/适配版本不匹配/u);
  assert.equal(loaderCalls.length, 1, 'a modified staged copy must fail before Loader import');

  const nextCommit = 'b'.repeat(40);
  const nextInstalled = join(root, 'installed-next', packageId);
  cpSync(installed, nextInstalled, { recursive: true });
  const nextManifest = JSON.parse(readFileSync(join(nextInstalled, 'package.json'), 'utf8'));
  nextManifest.version = '1.3.0';
  writeFileSync(join(nextInstalled, 'package.json'), JSON.stringify(nextManifest));
  const nextRecord = {
    ...record,
    version: '1.3.0',
    source: { ...record.source, commit: nextCommit, archiveSha256: 'b'.repeat(64) }
  };
  assert.equal(runtime.supports(nextRecord), true, 'same official DSH v1 contract accepts a new verified version and commit');
  await runtime.enable(nextRecord, nextInstalled);
  const nextRuntimeCopy = join(data, 'plugins', 'runtime-adapters', 'profiles', 'web', packageId, nextCommit, 'adapter-7');
  const nextAdaptedManifest = JSON.parse(readFileSync(join(nextRuntimeCopy, 'package.json'), 'utf8'));
  const nextMarker = JSON.parse(readFileSync(join(nextRuntimeCopy, 'lfaa-runtime-adapter.json'), 'utf8'));
  assert.equal(nextAdaptedManifest.version, '1.3.0');
  assert.equal(nextMarker.sourceCommit, nextCommit);
  assert.equal(nextMarker.sourceVersion, '1.3.0');
  assert.equal(existsSync(runtimeCopy), true, 'creating a new revision never overwrites an older runtime snapshot');
  await runtime.disable(nextRecord);

  const mismatchedInstalled = join(root, 'installed-mismatch', packageId);
  cpSync(nextInstalled, mismatchedInstalled, { recursive: true });
  const mismatchedManifest = JSON.parse(readFileSync(join(mismatchedInstalled, 'package.json'), 'utf8'));
  mismatchedManifest.version = '1.4.0';
  writeFileSync(join(mismatchedInstalled, 'package.json'), JSON.stringify(mismatchedManifest));
  await assert.rejects(runtime.enable({ ...nextRecord, source: { ...nextRecord.source, commit: 'c'.repeat(40) } }, mismatchedInstalled), /清单与已核验安装记录/u);
  assert.equal(loaderCalls.length, 2, 'manifest mismatch fails before Loader import');
});

test('LFAA Harness activates the adapted Host through its Cordis Loader and WebServer Carrier', async () => {
  const { DshWallpaperEngineRuntime } = await import('lfaa-plugin-manager/src/dsh-wallpaper-engine-runtime.js');
  const { DshWebServerCarrier } = await import('lfaa-host-webserver/src/dsh-carrier.js');
  const { default: Loader } = await import('@deepseek-ai/cordis-plugin-loader');
  const hostContext = new Context();
  const integrationData = join(root, 'real-loader-data');
  const previousDataDirectory = process.env.DSH_WE_DATA_DIR;
  try {
    globalThis.__lfaaWallpaperHostDisposed = false;
    await hostContext.plugin(Loader, { baseUrl: import.meta.url });
    const carrier = new DshWebServerCarrier(hostContext, '127.0.0.1', 0);
    carrier.provide();
    const runtime = new DshWallpaperEngineRuntime(hostContext, 'web', integrationData);
    const record = {
      id: recordId,
      name: packageId,
      version: '1.2.0',
      compatibility: 'dsh-v1',
      source: { repository, commit, archiveSha256: 'a'.repeat(64) }
    };

    await runtime.enable(record, installed);
    assert.equal(runtime.isActive(record), true);
    const hostEntry = [...hostContext.loader.entries()].find(entry => entry.options.name.includes(`${commit}/adapter-7/lib/index.js`));
    assert.equal(hostEntry?.fiber?.state, 2);
    assert.equal(carrier.exactRoutes.has('/wallpaper-engine/inventory'), true);
    assert.equal(carrier.prefixRoutes.has('/wallpaper-engine/scene-files'), true, 'scene files stay on the authenticated LFAA Host route');

    await runtime.disable(record);
    assert.equal(runtime.isActive(record), false);
    assert.equal(globalThis.__lfaaWallpaperHostDisposed, true, 'Cordis must execute the plugin Host teardown returned from apply');
    assert.equal(carrier.exactRoutes.has('/wallpaper-engine/inventory'), false);
  } finally {
    await hostContext.fiber.dispose();
    if (previousDataDirectory === undefined) delete process.env.DSH_WE_DATA_DIR;
    else process.env.DSH_WE_DATA_DIR = previousDataDirectory;
  }
});

test('LFAA exposes reversible DSH sidebar shortcuts and theme changes through existing owners', async () => {
  const settings = await import('lfaa-settings/src/service.js');
  assert.deepEqual(settings.getUserSettings('wallpaper-shortcut-test').shortcuts.wallpaperSidebarToggle, []);
  const { database } = await import('lfaa-storage-sqlite/src/database.js');
  database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('wallpaper-shortcut-test',901,'wallpaper-shortcut-test','test','test','admin',1)").run();
  settings.saveUserSettings('wallpaper-shortcut-test', 'shortcuts', {
    ...settings.defaultSettings.shortcuts,
    wallpaperSidebarToggle: ['Ctrl+Alt+W']
  });
  assert.deepEqual(settings.getUserSettings('wallpaper-shortcut-test').shortcuts.wallpaperSidebarToggle, ['Ctrl+Alt+W']);

  const { SidebarRightRuntime } = await import('lfaa-client-ui-workspace/src/sidebar-right-runtime.js');
  const sidebar = new SidebarRightRuntime();
  let rightExpanded = false;
  let rightPanelToggles = 0;
  const unbindRightPanel = sidebar.bindExpansion(() => rightExpanded, () => {
    rightPanelToggles += 1;
    rightExpanded = !rightExpanded;
  });
  const wallpaperGuideIcon = () => null;
  const unregisterWallpaperTab = sidebar.tabsApi.register({
    id: 'wallpaper-engine',
    kind: 'wallpaper-library',
    title: () => '壁纸',
    guide: [{ id: 'library', order: 100, title: () => '壁纸引擎', description: () => '本地壁纸库与播放控制', icon: wallpaperGuideIcon }]
  });
  assert.equal(sidebar.snapshot().tabs[0].guide[0].icon, wallpaperGuideIcon);
  sidebar.control.openTab('wallpaper-library');
  assert.equal(sidebar.snapshot().activeId, 'wallpaper-engine');
  assert.equal(rightExpanded, true, 'selecting the upstream guide opens the collapsed context panel');
  sidebar.control.openTab('wallpaper-library');
  assert.equal(rightPanelToggles, 1, 'selecting a guide while already open does not toggle the panel closed');
  unregisterWallpaperTab();
  assert.deepEqual(sidebar.snapshot(), { tabs: [], activeId: null }, 'unload removes the guide tab and active selection');
  unbindRightPanel();

  let toggled = 0;
  const unregister = sidebar.shortcutsApi.register({
    id: 'wallpaper.sidebar.toggle',
    label: () => 'Wallpaper sidebar',
    regions: ['page', 'editable', 'terminal'],
    resolve: () => ({ status: 'handled', run: () => { toggled += 1; } })
  });
  assert.equal(sidebar.runShortcut({ target: null }, 'editable'), true);
  assert.equal(toggled, 1);
  unregister();
  assert.equal(sidebar.runShortcut({ target: null }, 'page'), false);

  const { DshLocaleRuntime } = await import('lfaa-client-ui-workspace/src/dsh-locale-runtime.js');
  const locale = new DshLocaleRuntime();
  const changes = [];
  const offLocaleListener = locale.subscribe(() => changes.push(locale.getSnapshot().active));
  const offZh = locale.register('wallpaper-engine', 'zh', { '欢迎 {name}': '欢迎 {name}' });
  const offEn = locale.register('wallpaper-engine', 'en', { '欢迎 {name}': 'Welcome {name}' });
  locale.setPreference('en-US');
  assert.equal(locale.bind('wallpaper-engine')('欢迎 {name}', { name: 'LFAA' }), 'Welcome LFAA');
  assert.deepEqual(changes, ['en-US']);
  offEn();
  assert.equal(locale.bind('wallpaper-engine')('欢迎 {name}', { name: 'LFAA' }), '欢迎 LFAA');
  offZh();
  offLocaleListener();

  const { bindDshThemeEvents, bindDshThemeOwner, dshThemeCompatibility } = await import('lfaa-client-ui-theme/src/dsh-theme-bridge.js');
  const themeContext = new Context();
  const themeChanges = [];
  const offTheme = themeContext.on('theme/change', (snapshot) => themeChanges.push(snapshot.preference));
  let preference = 'system';
  const values = new Map();
  const root = { dataset: { theme: 'light' }, style: {
    setProperty: (name, value) => values.set(name, value),
    removeProperty: (name) => values.delete(name)
  } };
  const unbindEvents = bindDshThemeEvents(themeContext);
  const unbindOwner = bindDshThemeOwner({
    readPreference: () => preference,
    savePreference: async (next) => { preference = next; },
    getRoot: () => root
  });
  const removeColors = dshThemeCompatibility.overrideTokens('wallpaper-engine', {
    '--dsw-alias-label-primary': { light: '#222222', dark: '#eeeeee' }
  });
  const removeTypography = dshThemeCompatibility.overrideTokens('wallpaper-engine-typography', {
    '--dsw-font-markdown-base-font-size': { light: '20px', dark: '20px' },
    '--dsw-font-markdown-base-font-weight': { light: '600', dark: '600' },
    '--dsw-font-markdown-base-font-family': { light: 'LFAA Test, sans-serif', dark: 'LFAA Test, sans-serif' },
    '--dsw-font-markdown-base': {
      light: 'var(--dsw-font-markdown-base-font-weight) var(--dsw-font-markdown-base-font-size) / var(--dsw-font-markdown-base-line-height) var(--dsw-font-markdown-base-font-family)',
      dark: 'var(--dsw-font-markdown-base-font-weight) var(--dsw-font-markdown-base-font-size) / var(--dsw-font-markdown-base-line-height) var(--dsw-font-markdown-base-font-family)'
    },
    '--dsw-font-markdown-h1-font-family': { light: 'url(javascript:alert(1))', dark: 'url(javascript:alert(1))' }
  });
  assert.equal(values.get('--dsw-alias-label-primary'), '#222222');
  assert.equal(values.get('--dsw-font-markdown-base-font-size'), '20px');
  assert.equal(values.has('--dsw-font-markdown-h1-font-family'), false);
  dshThemeCompatibility.setTheme('dark');
  await Promise.resolve();
  assert.equal(preference, 'dark');
  assert.equal(themeChanges.at(-1), 'dark');
  assert.equal(values.get('--dsw-alias-label-primary'), '#eeeeee');
  assert.equal(values.get('--dsw-font-markdown-base'), 'var(--dsw-font-markdown-base-font-weight) var(--dsw-font-markdown-base-font-size) / var(--dsw-font-markdown-base-line-height) var(--dsw-font-markdown-base-font-family)');
  removeColors();
  removeTypography();
  assert.equal(values.has('--dsw-alias-label-primary'), false);
  assert.equal(values.has('--dsw-font-markdown-base-font-size'), false);
  offTheme();
  unbindOwner();
  unbindEvents();
});

