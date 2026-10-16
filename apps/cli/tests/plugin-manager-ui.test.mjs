import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const { buildPluginRemoveGoal, buildPluginInstallGoal } = await import('lfaa-client-ui-plugin-manager/src/plugin-goals.ts');
const pluginPage = readFileSync(fileURLToPath(new URL('../../../packages/client/ui-plugin-manager/src/PluginManagerPage.tsx', import.meta.url)), 'utf8');

test('plugin install goals preserve each source and its explicit target app', () => {
  const github = buildPluginInstallGoal('github', 'https://github.com/acme/widget', 'main');
  const npm = buildPluginInstallGoal('npm', '@acme/widget@1.2.3');
  const local = buildPluginInstallGoal('local', 'H:\\LFAA Host\\plugins\\widget');

  assert.match(github, /GitHub 仓库/u);
  assert.match(github, /"main"/u);
  assert.match(npm, /NPM 包\/版本/u);
  assert.match(npm, /@acme\/widget@1\.2\.3/u);
  assert.match(local, /Host 绝对路径/u);
  assert.match(local, /H:\\\\LFAA Host\\\\plugins\\\\widget/u);
  for (const goal of [github, npm, local]) {
    assert.match(goal, /目标 App 为 workspace/u);
    assert.match(goal, /Permission Owner/u);
  }
});

test('manual install, start, stop and uninstall call the authenticated lifecycle API', () => {
  const plugin = {
    id: 'dsh-plugin-wallpaper-engine',
    name: 'Wallpaper Engine',
    version: '1.0.0',
    description: '',
    source: { kind: 'github', repository: 'https://github.com/acme/wallpaper', requestedRef: 'main', commit: 'a'.repeat(40), archiveSha256: 'b'.repeat(64), license: 'MIT' },
    compatibility: 'dsh-v1',
    runtimeEntry: 'src/index.js',
    capabilities: [],
    applicationIds: ['workspace'],
    state: 'installed',
    reason: null,
    installedAt: '2026-10-16T00:00:00.000Z',
    installedBy: 'admin'
  };

  const remove = buildPluginRemoveGoal(plugin, 'workspace');

  assert.match(pluginPage, /setManagedPluginEnabled\(plugin\.id/u);
  assert.match(pluginPage, /await removeManagedPlugin\(plugin\.id/u);
  assert.match(pluginPage, /await installManagedPlugin\(/u);
  assert.doesNotMatch(pluginPage, /requestAiWorkGoal/u);
  assert.doesNotMatch(pluginPage, /buildPluginActionGoal/u);
  assert.match(remove, /卸载/u);
  assert.match(remove, /dsh-plugin-wallpaper-engine/u);
  assert.match(remove, /目标 App：workspace/u);
  assert.match(remove, /不要安装、更新或移除其他插件/u);
  assert.throws(() => buildPluginRemoveGoal(plugin, 'minecraft'), /没有登记到所选目标 App/u);
});
