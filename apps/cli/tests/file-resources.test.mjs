/** 功能：回归受管资源、插件生命周期、实例范围和目录性能边界。作用：真实磁盘与数据库只存在于隔离测试目录；关联文件：fs/library、instance-files、managed-files、workspace-files。 */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { storageFileManagerPath } from '../../../packages/client/connection/src/file-manager-location.ts';

const base = resolve(tmpdir()), root = await mkdtemp(join(base, 'lfaa-resources-'));
const data = join(root, 'data'); await mkdir(data);
process.env.LFAA_DATA_DIR = data; process.env.NODE_ENV = 'test';
const { database, closeDatabase } = await import('lfaa-storage-sqlite/src/database.js');
const { configuration } = await import('lfaa-storage-domain/src/configuration.js');
const { retireLegacyFileTables } = await import('lfaa-storage-domain/src/migration.js');
const { sessionRecords } = await import('lfaa-session-persistence-jsonl/src/repository.js');
retireLegacyFileTables();
const { saveUserSettings } = await import('lfaa-settings/src/service.js');
const { getProjectStorageLocations, getProjectStorageDirectoryCandidates, getRuntimeStorageLocations } = await import('lfaa-settings/src/project-storage.js');
const { SystemFileLibrary } = await import('lfaa-fs/src/library.js');
const { createManagedFileService } = await import('lfaa-fs/src/managed-files.mjs');
const { createInstanceFileService } = await import('lfaa-fs/src/instance-files.mjs');
const { gameInstanceFileMount, gameStorageFileMount } = await import('lfaa-api-workspace-files/src/index.js');
const queue = await import('lfaa-fs/src/queue.js');
const actor = { userId: randomUUID(), role: 'super_admin' };
database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES(?,9901,'resources-test','test','test','admin',1)").run(actor.userId);
saveUserSettings(actor.userId, 'permissions', { mode: 'full_access' });
const library = new SystemFileLibrary(data);
after(async () => { configuration.close(); sessionRecords.close(); closeDatabase(); assert.equal(resolve(root).startsWith(base), true); await rm(root, { recursive: true, force: true }); });

test('资源目录只从 data 派生，旧独立位置保留回读；真实 data 不混入来源，缺失目录不自动创建', async () => {
  const external = join(root, 'external-logs');
  await mkdir(external);
  configuration.save('project_storage_locations',{id:1,logs_directory:external,writing_directory:external,runtime_directory:external});
  assert.equal(getProjectStorageLocations().settings.logsDirectory, join(data,'logs'));
  assert.ok(getProjectStorageDirectoryCandidates('writing').includes(external));
  assert.equal(getRuntimeStorageLocations('local',data,process.platform).runtimeDirectory,join(data,'environments'));
  assert.ok(getRuntimeStorageLocations('local',data,process.platform).previousRuntimeDirectories.includes(external));
  await writeFile(join(data,'logs','actual.log'), '真实日志');
  const overview = await library.operate(actor, 'list', { path: '' });
  assert.ok(overview.locations.some(item => item.id === 'logs'));
  assert.equal(overview.entries.some(entry => entry.path.startsWith('local-drives')), false);
  const logs = await library.operate(actor, 'list', { path: '.lfaa-resources/logs' });
  assert.equal(logs.rootDirectory, join(data,'logs'));
  assert.ok(logs.entries.some(entry=>entry.path === '.lfaa-resources/logs/actual.log'));
  assert.equal((await library.operate(actor, 'read', { path: '.lfaa-resources/logs/actual.log' })).content, '真实日志');
  await assert.rejects(library.operate(actor, 'list', { path: '.lfaa-resources/backups' }), /ENOENT/u);
  await library.operate(actor, 'create-file', { path: '.lfaa-resources/logs/new.log' });
  assert.equal(await readFile(join(data,'logs','new.log'), 'utf8'), '');
});

test('第三方扩展清单经 data、资源与磁盘替代路径均不能改动，私有运行数据不能读取', async () => {
  await mkdir(join(data,'unregistered-game'));
  await assert.rejects(library.operate(actor,'create-file',{path:'unregistered-game/lfaa-instance.json'}),/元数据/u);
  const plugin = join(data, 'plugins/profiles/web'); await mkdir(plugin, { recursive: true });
  const privateRoot = join(data, 'plugins/runtime-data/profiles/web'); await mkdir(privateRoot, { recursive: true });
  await writeFile(join(plugin, 'installed.json'), '{}'); await writeFile(join(privateRoot, 'private.txt'), '私有内容');
  const resource = '.lfaa-resources/plugins/profiles/web/installed.json';
  const paths = ['plugins/profiles/web/installed.json', resource, storageFileManagerPath(join(plugin, 'installed.json'), join(root, 'different-data'))];
  for (const path of paths) {
    const read = await library.operate(actor, 'read', { path });
    await assert.rejects(library.operate(actor, 'write', { path, content: '破坏清单', expectedSha256: read.sha256 }), /插件.*管理/u);
    await assert.rejects(library.operate(actor, 'delete', { path }), /插件.*管理/u);
  }
  assert.equal(await readFile(join(plugin, 'installed.json'), 'utf8'), '{}');
  const listing = await library.operate(actor, 'list', { path: '.lfaa-resources/plugins' });
  assert.equal(listing.operations.includes('upload'), false);
  assert.equal(listing.entries.some(entry => entry.name === 'runtime-data'), false);
  for (const path of ['plugins/runtime-data/profiles/web/private.txt', '.lfaa-resources/plugins/runtime-data/profiles/web/private.txt', storageFileManagerPath(join(privateRoot, 'private.txt'), join(root, 'different-data'))]) await assert.rejects(library.openDownload(actor, path), /私有/u);
});

test('自定义实例目录按范围读写；根、标记、运行与未确认状态和路径逃逸拒绝', async () => {
  const rootA = join(root, 'custom-games/实例甲'), rootB = join(root, 'custom-games/实例乙');
  await mkdir(rootA, { recursive: true }); await mkdir(rootB, { recursive: true });
  await writeFile(join(rootA, 'server.properties'), 'motd=甲'); await writeFile(join(rootB, 'server.properties'), 'motd=乙');
  let stopped = true;
  const service = createInstanceFileService({ root: rootA, isStopped: () => stopped, recycleNamespace: createHash('sha256').update(actor.userId).digest('hex') });
  const read = await service.operate('read', { path: 'server.properties' });
  await service.operate('write', { path: 'server.properties', content: 'motd=修改', expectedSha256: read.sha256 });
  assert.equal(await readFile(join(rootB, 'server.properties'), 'utf8'), 'motd=乙');
  for (const operation of ['rename', 'delete', 'move']) await assert.rejects(service.operate(operation, { path: '', name: '重命名', destinationPath: '' }), /具体|根目录/u);
  await writeFile(join(rootA, 'lfaa-instance.json'), '{}');
  await assert.rejects(service.operate('delete', { path: 'lfaa-instance.json' }), /元数据/u);
  stopped = false;
  await assert.rejects(service.operate('create-file', { path: 'new.txt' }), /状态未确认/u);
  stopped = true; await writeFile(join(rootA, 'daemon-process.json'), '{"pid":123}');
  await assert.rejects(service.operate('delete', { path: 'server.properties' }), /标记/u);
  await rm(join(rootA, 'daemon-process.json'));
  for (const path of ['../实例乙/server.properties', rootB, 'C:\\outside']) await assert.rejects(service.operate('read', { path }));
  await service.operate('delete', { path: 'server.properties' });
  const trash = await service.operate('trash-list', { path: '' });
  await service.operate('trash-restore', { path: '', name: trash.entries[0].trashId });
  assert.equal(await readFile(join(rootA, 'server.properties'), 'utf8'), 'motd=修改');
});

test('游戏实例投影绑定真实节点与绝对存储记录；旧节点、跨实例移动拒绝', async () => {
  const nodeId = randomUUID(), id = randomUUID();
  database.prepare("INSERT INTO daemon_nodes(id,display_name,platform,architecture,daemon_version,status,capabilities_json,last_seen_at) VALUES(?,'真实测试节点','win32','x64','test','online','[\"node-filesystem-v1\"]',?)").run(nodeId, new Date().toISOString());
  database.prepare("INSERT INTO minecraft_instances(id,node_id,created_by,name,release_id,java_major,memory_mb,state,eula_accepted_at,storage_directory) VALUES(?,?,?,'实例甲','fixture',21,2048,'stopped',?,?)").run(id,nodeId,actor.userId,new Date().toISOString(),'E:\\CustomGames');
  const dispose = library.register(gameInstanceFileMount);
  try {
    const list = await library.operate(actor, 'list', { path: '.lfaa-library/game-instances' });
    assert.match(list.entries[0].description, /真实测试节点.*已停止.*E:/u);
    assert.equal(list.entries[0].path, `.lfaa-library/game-instances/${id}`);
    await assert.rejects(library.operate(actor, 'list', { path: list.entries[0].path }), /更新/u);
    database.prepare('UPDATE daemon_nodes SET capabilities_json=? WHERE id=?').run(JSON.stringify(['node-filesystem-v1','node-filesystem-v2','node-filesystem-instance-v1']),nodeId);
    await assert.rejects(library.operate(actor, 'move', { path: list.entries[0].path+'/file.txt', destinationPath: '.lfaa-library/game-instances/other' }), /实例/u);
    // 模拟唯一外部边界的节点回报；派发与数据库仍使用真实 Owner。
    const resultPromise = library.operate(actor, 'list', { path: list.entries[0].path });
    let task;
    for (let count=0; count<20 && !task; count++) { task = queue.claimNextNodeFileTask(nodeId); if (!task) await new Promise(done => setTimeout(done,10)); }
    assert.equal(task.payload.minecraftInstanceId,id); assert.equal(task.payload.path,'');
    assert.equal(task.payload.recycleNamespace, createHash('sha256').update(actor.userId).digest('hex'));
    queue.completeNodeFileTask({ taskId:task.id,nodeId,succeeded:true,message:'真实节点边界夹具',result:{path:'',entries:[{name:'server.properties',path:'server.properties',kind:'file',size:6,modifiedAt:''}]} });
    const result = await resultPromise;
    assert.equal(result.entries[0].path, list.entries[0].path+'/server.properties');
    database.prepare("UPDATE minecraft_instances SET state='unknown' WHERE id=?").run(id);
    await assert.rejects(library.operate(actor,'delete',{path:list.entries[0].path+'/server.properties'}),/状态未确认/u);
  } finally { dispose(); database.prepare('DELETE FROM minecraft_instances WHERE id=?').run(id); }
});

test('大目录读取有界，异步取消后目录句柄已关闭；根目录祖先联接拒绝', async () => {
  const large = join(root,'large'); await mkdir(large);
  for(let offset=0;offset<768;offset+=32) await Promise.all(Array.from({length:32},(_,index)=>writeFile(join(large,`item-${offset+index}.txt`),'x')));
  const service=createManagedFileService({root:large}), started=performance.now();
  const listing=await service.operate('list',{path:''});
  assert.equal(listing.entries.length,500); assert.equal(listing.truncated,true);
  const search=await service.operate('search',{path:'',query:'item-767'}); assert.equal(search.entries.length,1);
  console.log(JSON.stringify({directoryEntries:768,listReturned:500,listAndSearchMilliseconds:Math.round(performance.now()-started)}));
  const controller=new AbortController(); const cancelService=createManagedFileService({root:large,signal:controller.signal});
  const pending=cancelService.operate('list',{path:''}); setImmediate(()=>controller.abort());
  await assert.rejects(pending, /abort/u);
  await rename(large,large+'-renamed');
  const target=join(root,'target'),link=join(root,'link');await mkdir(join(target,'nested'),{recursive:true});
  await symlink(target,link,process.platform==='win32'?'junction':'dir');
  await assert.rejects(createManagedFileService({root:join(link,'nested')}).operate('list',{path:''}),/联接/u);
});

test('资源回收站恢复保留来源，节点回收命名空间由账户派生且覆盖输入', async () => {
  await mkdir(join(data,'cache'),{recursive:true});await writeFile(join(data,'cache/item.txt'),'缓存测试');
  await library.operate(actor,'delete',{path:'.lfaa-resources/cache/item.txt'});
  const trash=await library.operate(actor,'trash-list',{path:'.lfaa-resources/cache'});
  await library.operate(actor,'trash-restore',{path:'',name:trash.entries[0].trashId});
  assert.equal(await readFile(join(data,'cache/item.txt'),'utf8'),'缓存测试');
  const nodeId=database.prepare('SELECT id FROM daemon_nodes LIMIT 1').get().id;
  const task=queue.createNodeFileTask({nodeId,createdBy:actor.userId,operation:'list',payload:{path:'',recycleNamespace:'forged'}});
  assert.equal(task.payload.recycleNamespace,createHash('sha256').update(actor.userId).digest('hex'));
});

test('平台游戏目录按节点保存设置派发，并保留回收站节点/平台范围', async () => {
  const nodeId=database.prepare('SELECT id FROM daemon_nodes LIMIT 1').get().id;
  const { saveMinecraftNodeStorageSettings }=await import('lfaa-games-minecraft/src/service.js');
  saveMinecraftNodeStorageSettings(nodeId,{instanceDirectory:'games/custom-minecraft'});
  // SteamCMD 目录投影读取现有 Owner 默认值，不另存一套路径。
  const dispose=library.register(gameStorageFileMount);
  try {
    const overview=await library.operate(actor,'list',{path:'.lfaa-library/game-storage'});
    assert.match(overview.entries.find(entry=>entry.path.endsWith('/minecraft')).description,/games\/custom-minecraft/u);
    assert.match(overview.entries.find(entry=>entry.path.endsWith('/steamcmd')).description,/games\/steamcmd/u);
    const path=`.lfaa-library/game-storage/${nodeId}/minecraft`;
    await assert.rejects(library.operate(actor,'list',{path}),/更新/u);
    database.prepare('UPDATE daemon_nodes SET capabilities_json=? WHERE id=?').run(JSON.stringify(['node-filesystem-v1','node-filesystem-v2','node-filesystem-game-storage-v1']),nodeId);
    // 清理此前只读夹具任务，避免抢占本次断言；只影响本测试隔离数据库。
    database.prepare("DELETE FROM node_file_tasks WHERE node_id=? AND status='queued'").run(nodeId);
    const trashId=randomUUID();
    const pending=library.operate(actor,'trash-list',{path});
    await new Promise(done=>setImmediate(done));
    const task=queue.claimNextNodeFileTask(nodeId);
    assert.equal(task.payload.gameStorageKind,'minecraft');assert.equal(task.payload.path,'');
    queue.completeNodeFileTask({taskId:task.id,nodeId,succeeded:true,message:'节点边界夹具',result:{path:'',entries:[{name:'deleted.txt',path:'deleted.txt',trashId,kind:'file',size:1,modifiedAt:''}]}});
    const result=await pending;
    assert.equal(result.entries[0].trashId,path+'/'+trashId);
    const restoring=library.operate(actor,'trash-restore',{path:'',name:result.entries[0].trashId});
    await new Promise(done=>setImmediate(done));
    const restoreTask=queue.claimNextNodeFileTask(nodeId);
    assert.equal(restoreTask.payload.gameStorageKind,'minecraft');assert.equal(restoreTask.payload.name,trashId);
    queue.completeNodeFileTask({taskId:restoreTask.id,nodeId,succeeded:true,message:'节点边界夹具',result:{path:'deleted.txt',restored:true}});
    assert.equal((await restoring).path,path+'/deleted.txt');
  }finally{dispose();}
});
test('取消只回收本账户排队中的只读任务，不能伪称写入已撤销',()=>{
  const nodeId=database.prepare('SELECT id FROM daemon_nodes LIMIT 1').get().id;
  const read=queue.createNodeFileTask({nodeId,createdBy:actor.userId,operation:'list',payload:{path:''}});
  assert.equal(queue.cancelQueuedNodeFileReadTask(read.id,'other'),false);
  assert.equal(queue.cancelQueuedNodeFileReadTask(read.id,actor.userId),true);
  assert.deepEqual(queue.getNodeFileTask(read.id).payload,{});
  const write=queue.createNodeFileTask({nodeId,createdBy:actor.userId,operation:'create-file',payload:{path:'test.txt'}});
  assert.equal(queue.cancelQueuedNodeFileReadTask(write.id,actor.userId),false);
  assert.equal(queue.getNodeFileTask(write.id).status,'queued');
});
test('收拢独立根后真实旧作品仍可回读，新作品使用统一 data 根',async()=>{
  const writing=await import('lfaa-document-writing/src/service.js');
  const local=await import('lfaa-document-writing/src/local-files.js');
  const {resolveUserDataPaths}=await import('lfaa-home-paths/src/data-layout.mjs');
  const old=writing.createWritingBook(actor.userId,'存量作品'),bookId=old.activeBookId;
  writing.updateWritingBookOutline(actor.userId,bookId,'存量作品正文');
  const source=local.ensureWritingProjectFiles(actor.userId,bookId);
  const legacy=join(resolveUserDataPaths(join(root,'external-logs'),actor.userId).projects,'writing',bookId);
  await mkdir(dirname(legacy),{recursive:true});await rename(source,legacy);
  assert.equal(local.readWritingLocalText(actor.userId,bookId,{kind:'outline'}),'存量作品正文');
  writing.updateWritingBookOutline(actor.userId,bookId,'原 Owner 保存后正文');
  assert.equal(local.readWritingLocalText(actor.userId,bookId,{kind:'outline'}),'原 Owner 保存后正文');
  const fresh=writing.createWritingBook(actor.userId,'新作品');
  assert.equal(local.ensureWritingProjectFiles(actor.userId,fresh.activeBookId),join(resolveUserDataPaths(data,actor.userId).projects,'writing',fresh.activeBookId));
});
test('认证 API 返回默认/推荐/当前总根，旧分类根写入退役且不改历史配置',async()=>{
  const {default:express}=await import('express');const {default:jwt}=await import('jsonwebtoken');
  const {config}=await import('lfaa-launch-environment/src/config.js');
  const {resolveDataDirectory}=await import('lfaa-home-paths/src/resolve-data-directory.mjs');
  const {createSession,sessionLifetimeSeconds}=await import('lfaa-identity-auth/src/service.js');
  const {registerRoutes}=await import('lfaa-api-settings-controller/src/index.js');
  const {registerRuntimeRoutes}=await import('lfaa-api-job-controller/src/runtime-routes.js');
  const app=express(),router=express.Router();app.use(express.json());registerRoutes(router,{},{});registerRuntimeRoutes(router);app.use('/api',router);
  app.use((error,_req,res,_next)=>res.status(error.statusCode||error.status||500).json({message:error.message}));
  const server=app.listen(0,'127.0.0.1');await new Promise(done=>server.once('listening',done));
  const session=createSession(actor.userId),token=jwt.sign({sid:session.sessionId},config.jwtSecret,{algorithm:'HS256',audience:'lfaa-web',issuer:'lfaa-server',expiresIn:sessionLifetimeSeconds});
  const url=`http://127.0.0.1:${server.address().port}/api`,headers={Cookie:`lfaa_session=${token}`,'Content-Type':'application/json'};
  try {
    assert.equal((await fetch(url+'/data-directory/recommended',{method:'POST'})).status,401);
    const response=await fetch(url+'/data-directory',{headers}),settings=(await response.json()).settings;
    assert.equal(settings.currentDirectory,data);assert.equal(settings.defaultDirectory,resolveDataDirectory(config.repositoryRoot));assert.equal(settings.recommendedDirectory,join(config.repositoryRoot,'data'));assert.equal(settings.selection,'custom');
    assert.equal((await fetch(url+'/data-directory/recommended',{method:'POST',headers})).status,409);
    const previous=JSON.stringify(configuration.get('project_storage_locations',row=>row.id===1));
    for(const endpoint of ['/project-storage-locations','/runtime-environments/storage/local'])assert.equal((await fetch(url+endpoint,{method:'PUT',headers,body:JSON.stringify({runtimeDirectory:'E:/wrong'})})).status,410);
    assert.equal(JSON.stringify(configuration.get('project_storage_locations',row=>row.id===1)),previous);
  }finally{await new Promise(done=>server.close(done));}
});
