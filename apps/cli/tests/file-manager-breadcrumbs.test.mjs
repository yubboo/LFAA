import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFileManagerBreadcrumbs, getFileManagerBreadcrumbTitle } from '../../../packages/client/ui-sidebar-files/src/file-manager-breadcrumbs.ts';

const locations = [
  { name: '游戏实例', path: '.lfaa-library/game-instances' },
  { name: '游戏存储位置', path: '.lfaa-library/game-storage' },
  { name: '节点资源', path: '.lfaa-library/game-servers' }
];

test('实例文件面包屑显示实际目录名并保留稳定内部路由', () => {
  const instanceId = '45f694c3-fbf3-447c-a848-80c6a5c5724c';
  const path = `.lfaa-library/game-instances/${instanceId}/plugins`;
  const rootDirectory = 'DESKTOP-26FQTU7 · C:\\Users\\yu\\.lfaa\\data\\games\\minecraft\\1.21.1';
  const crumbs = buildFileManagerBreadcrumbs(path, locations, rootDirectory);

  assert.deepEqual(crumbs.map(crumb => crumb.name), ['应用资源', '游戏实例', '1.21.1', 'plugins']);
  assert.equal(crumbs[2].path, `.lfaa-library/game-instances/${instanceId}`);
  assert.equal(getFileManagerBreadcrumbTitle(rootDirectory, path), 'C:\\Users\\yu\\.lfaa\\data\\games\\minecraft\\1.21.1\\plugins');
  assert.ok(!getFileManagerBreadcrumbTitle(rootDirectory, path).includes(instanceId));
});

test('游戏存储面包屑隐藏节点 ID，标题使用物理目录', () => {
  const nodeId = '3fa00133-ff3c-44dd-b065-4f2665aa1ef8';
  const path = `.lfaa-library/game-storage/${nodeId}/minecraft/1.21.1`;
  const rootDirectory = 'DESKTOP-26FQTU7 · C:\\Users\\yu\\.lfaa\\data\\games\\minecraft';
  const crumbs = buildFileManagerBreadcrumbs(path, locations, rootDirectory);

  assert.deepEqual(crumbs.map(crumb => crumb.name), ['应用资源', '游戏存储位置', 'Minecraft 游戏目录', '1.21.1']);
  assert.ok(crumbs.every(crumb => !crumb.name.includes(nodeId)));
  assert.equal(getFileManagerBreadcrumbTitle(rootDirectory, path), 'C:\\Users\\yu\\.lfaa\\data\\games\\minecraft\\1.21.1');
});

test('节点资源面包屑显示节点名，不显示节点 ID', () => {
  const nodeId = '6c70fa92-6ab6-4c03-9cb0-3ea6de67cb34';
  const path = `.lfaa-library/game-servers/${nodeId}/games`;
  const rootDirectory = 'DESKTOP-26FQTU7 · C:\\Users\\yu\\.lfaa\\data';
  const crumbs = buildFileManagerBreadcrumbs(path, locations, rootDirectory);

  assert.deepEqual(crumbs.map(crumb => crumb.name), ['应用资源', '节点资源', 'DESKTOP-26FQTU7', 'games']);
  assert.equal(getFileManagerBreadcrumbTitle(rootDirectory, path), 'C:\\Users\\yu\\.lfaa\\data\\games');
});

test('未取得真实存储路径时不把内部路由当作悬停路径', () => {
  assert.equal(getFileManagerBreadcrumbTitle('', '.lfaa-library/game-instances/45f694c3'), '当前目录');
  assert.equal(getFileManagerBreadcrumbTitle('', ''), 'LFAA 数据');
  const crumbs = buildFileManagerBreadcrumbs('.lfaa-library/game-instances/45f694c3', locations, '');
  assert.equal(crumbs[2].name, '实例目录');
});
