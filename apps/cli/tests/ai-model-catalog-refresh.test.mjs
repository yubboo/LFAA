/** 功能：回归已保存 AI 账户的模型目录刷新。作用：目录刷新不依赖模型推理，也不改写用户选择。 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("模型目录更新不因当前模型容量错误失败或改写用户选择", () => {
  const parent = resolve(cli, "../../dist/.tmp");
  mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, "lfaa-ai-model-catalog-refresh-"));
  const source = `
    import assert from 'node:assert/strict';
    const {database,closeDatabase}=await import('lfaa-storage-sqlite/src/database.js');
    const {configuration}=await import('lfaa-storage-domain/src/configuration.js');
    const {sessionRecords}=await import('lfaa-session-persistence-jsonl/src/repository.js');
    const {retireLegacyFileTables}=await import('lfaa-storage-domain/src/migration.js');retireLegacyFileTables();
    const {saveAiAccount,refreshAiAccountModelCatalog,testSavedAiAccountModel,listAiAccounts}=await import('lfaa-settings/src/service.js');
    const {modelOptionLabel,modelOptionVersionTag}=await import('lfaa-client-ui-settings-models/src/model-options.js');
    database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('fixture-owner',1,'fixture-owner','test-salt','test-hash','admin',1)").run();
    const originalFetch=globalThis.fetch;
    try {
      let inferenceCalls=0;
      let updatesPageCalls=0;
      let catalog=[{id:'fixture-reasoner',effort:{supported_levels:['low','high'],default_level:'high'}}];
      globalThis.fetch=async (url,init)=>{
        if(String(url)==='https://api.deepseek.com/models'&&init.method==='GET') return Response.json({data:catalog});
        if(String(url)==='https://api-docs.deepseek.com/zh-cn/updates/'&&(!init.method||init.method==='GET')) {updatesPageCalls++;return new Response('<h2>DeepSeek-V4.1-Flash-1017 更新</h2>',{headers:{'Content-Type':'text/html; charset=utf-8'}});}
        if(String(url)==='https://api.deepseek.com/chat/completions'){
          inferenceCalls++;
          return Response.json({error:{message:'Selected model is at capacity. Please try a different model.'}},{status:503});
        }
        throw new Error('Unexpected Provider request');
      };
      const account=await saveAiAccount('fixture-owner',{providerId:'deepseek',secret:'fixture-secret',options:{},displayName:'合成账户',modelId:'fixture-reasoner',reasoningMode:'high'});
      catalog=[
        {id:'fixture-reasoner',effort:{supported_levels:['low','high'],default_level:'high'}},
        {id:'deepseek-flash',name:'DeepSeek-V4.1-Flash'},
        {id:'deepseek-v4-pro',name:'DeepSeek-V4-Pro'}
      ];
      const result=await refreshAiAccountModelCatalog('fixture-owner',account.id);
      assert.deepEqual(result.models.filter(model=>model.id.startsWith('deepseek-')).map(({id,name})=>({id,name})),[
        {id:'deepseek-flash',name:'DeepSeek-V4.1-Flash'},
        {id:'deepseek-v4-pro',name:'DeepSeek-V4-Pro'}
      ],'目录刷新要保留 DeepSeek 官方目录里的最新型号名称');
      assert.equal(modelOptionLabel('deepseek',result.models.find(model=>model.id==='deepseek-flash')),'DeepSeek-V4.1-Flash · deepseek-flash','Flash 名称和调用 ID 必须逐字保留官方目录值');
      assert.equal(updatesPageCalls,1,'须仅从官方更新页补充模型版本标签，并复用短期缓存');
      assert.equal(result.models.find(model=>model.id==='deepseek-flash').versionTag,'1017','官方版本标记必须作为独立元数据保留');
      assert.equal(result.models.find(model=>model.id==='deepseek-flash').id,'deepseek-flash','模型请求 ID 不能被版本标签改写');
      assert.equal(modelOptionVersionTag(result.models.find(model=>model.id==='deepseek-flash')),'1017','版本标记映射须原样输出');
      assert.equal(modelOptionLabel('deepseek',result.models.find(model=>model.id==='deepseek-v4-pro')),'DeepSeek-V4-Pro · deepseek-v4-pro','Pro 名称和调用 ID 必须逐字保留官方目录值');
      assert.equal(inferenceCalls,0,'只刷新目录不能发起真实模型推理');
      const refreshed=listAiAccounts('fixture-owner')[0];
      assert.equal(refreshed.models.find(model=>model.id==='deepseek-flash').versionTag,'1017','持久化的目录读取仍须保留版本标签');
      assert.equal(refreshed.modelId,'fixture-reasoner','必须保留已选模型');
      assert.equal(refreshed.reasoningMode,'high','必须保留已选思考设置');
      await assert.rejects(testSavedAiAccountModel('fixture-owner',account.id),/HTTP 503/u,'真实模型测试仍单独发起当前模型请求并呈现容量故障');
      assert.equal(inferenceCalls,1,'显式测试只能请求当前模型一次');
      catalog=[{id:'deepseek-flash',name:'DeepSeek-V4.1-Flash'},{id:'deepseek-v4-pro',name:'DeepSeek-V4-Pro'}];
      const removed=await refreshAiAccountModelCatalog('fixture-owner',account.id);
      assert.match(removed.message,/不在最新目录中/u);
      const stored=configuration.get('ai_accounts',row=>row.id===account.id);
      assert.equal(stored.model_id,'fixture-reasoner','目录移除旧模型时也不能自动选择第一项');
      assert.equal(stored.reasoning_mode,'high','目录移除旧模型时也不能改写保存的思考设置');
    } finally {globalThis.fetch=originalFetch;sessionRecords.close();configuration.close();closeDatabase();}
  `;
  try {
    execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "--input-type=module", "-e", source], {
      cwd: cli, env: { ...process.env, NODE_ENV: "test", LFAA_DATA_DIR: data, JWT_SECRET: "", LFAA_HARNESS_HOME: "" }, encoding: "utf8", stdio: "pipe", timeout: 30_000
    });
  } finally {
    assert.equal(dirname(data), parent);
    rmSync(data, { recursive: true, force: true });
  }
});
