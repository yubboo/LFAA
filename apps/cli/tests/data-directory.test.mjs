/** 功能：回归首次数据根与显式配置优先级。作用：只计算路径，不接触真实用户数据；关联文件：home-paths/resolve-data-directory、CLI、Desktop。 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveDataDirectory } from 'lfaa-home-paths/src/resolve-data-directory.mjs';
const projectRoot='H:\\LFAA1', userProfile='C:\\Users\\yu';
test('未配置时固定盘与移动盘都使用用户 .lfaa 内的 data',()=>{
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
test('非 Windows 未配置时也使用当前账户目录；显式位置继续优先',()=>{
  assert.equal(resolveDataDirectory('/workspace/LFAA','',{platform:'linux',userProfile:'/home/tester'}),'/home/tester/.lfaa/data');
  assert.equal(resolveDataDirectory('/workspace/LFAA','data',{platform:'linux',userProfile:'/home/tester'}),'/workspace/LFAA/data');
});
