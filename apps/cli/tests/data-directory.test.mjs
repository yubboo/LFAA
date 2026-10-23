/** 功能：回归首次数据根与显式配置优先级。作用：只计算路径，不接触真实用户数据；关联文件：home-paths/resolve-data-directory、CLI、Desktop。 */
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { lstatSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveDataDirectory, resolveHomeDirectory } from 'lfaa-home-paths/src/resolve-data-directory.mjs';
import { ensureDataDirectories, resolveDataPaths } from 'lfaa-home-paths/src/data-layout.mjs';
const projectRoot='H:\\LFAA1', userProfile='C:\\Users\\yu';
const temporaryRoot = mkdtempSync(join(tmpdir(), 'lfaa-data-layout-test-'));
after(() => { assert.ok(temporaryRoot.startsWith(tmpdir())); rmSync(temporaryRoot, { recursive: true, force: true }); });
test('未配置系统根时固定盘与移动盘都使用用户 .lfaa Home',()=>{
  for(const driveType of ['Fixed','Removable','Unknown'])assert.equal(resolveDataDirectory(projectRoot,'',{platform:'win32',driveType,userProfile}),'C:\\Users\\yu\\.lfaa\\data');
});
test('项目 data 只在显式选择推荐位置后使用',()=>{
  assert.equal(resolveDataDirectory(projectRoot,'data',{platform:'win32',userProfile}),'H:\\LFAA1\\data');
  assert.equal(resolveDataDirectory(projectRoot,'.\\data',{platform:'win32',userProfile}),'H:\\LFAA1\\data');
});
test('自定义绝对与相对总根保持原意',()=>{
  assert.equal(resolveDataDirectory(projectRoot,'E:\\自定义\\data',{platform:'win32',userProfile}),'E:\\自定义\\data');
  assert.equal(resolveDataDirectory(projectRoot,'shared-data',{platform:'win32',userProfile}),'H:\\LFAA1\\shared-data');
});
test('未配置且系统账户主目录无效时拒绝猜测根目录',()=>{
  assert.throws(()=>resolveDataDirectory(projectRoot,'',{platform:'win32',userProfile:''}),/主目录无效/u);
});
test('LFAA_HOME 同时作为系统数据根与插件安装根',()=>{
  assert.equal(resolveHomeDirectory(projectRoot,'',{platform:'win32',userProfile}), 'C:\\Users\\yu\\.lfaa');
  assert.equal(resolveHomeDirectory(projectRoot,'E:\\LFAA-Home',{platform:'win32',userProfile}), 'E:\\LFAA-Home');
  assert.equal(resolveDataDirectory(projectRoot,'',{platform:'win32',userProfile,lfaaHome:'E:\\LFAA-Home'}), 'E:\\LFAA-Home\\data');
  assert.throws(()=>resolveHomeDirectory(projectRoot,'relative-home',{platform:'win32',userProfile}),/绝对路径/u);
});
test('非 Windows 未配置时也使用当前账户 Home；显式位置继续优先',()=>{
  assert.equal(resolveDataDirectory('/workspace/LFAA','',{platform:'linux',userProfile:'/home/tester'}),'/home/tester/.lfaa/data');
  assert.equal(resolveDataDirectory('/workspace/LFAA','data',{platform:'linux',userProfile:'/home/tester'}),'/workspace/LFAA/data');
});
test('空白或新选中的数据根会补齐全部顶层目录，不生成账户或业务文件', () => {
  const dataRoot = join(temporaryRoot, 'custom-data');
  const paths = ensureDataDirectories(dataRoot);
  assert.equal(Object.hasOwn(paths, 'plugins'), false, '插件属于 LFAA_HOME/Profile，不是系统 data 分类');
  assert.equal(readdirSync(dataRoot).includes('plugins'), false, '系统数据初始化不会创建旧插件目录');
  for (const [name, directory] of Object.entries(paths)) {
    if (name === 'root') continue;
    const info = lstatSync(directory);
    assert.ok(info.isDirectory() && !info.isSymbolicLink(), `${name} 应为真实目录`);
  }
  assert.deepEqual(readdirSync(paths.users), []);
  assert.deepEqual(readdirSync(paths.games), []);
  ensureDataDirectories(dataRoot);
  assert.equal(resolveDataPaths(dataRoot).root, paths.root);
});
