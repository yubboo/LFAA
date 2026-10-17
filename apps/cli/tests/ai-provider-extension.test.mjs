/** 功能：验证 AI Provider 扩展接入 Settings Owner。作用：检查登记、选项边界、模型发现和卸载清理。 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");
test("插件可向 Settings Owner 登记受校验的 Provider，卸载后目录立即撤销", () => {
  const parent = resolve(cli, "../../dist/.tmp");
  mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, "lfaa-ai-provider-extension-"));
  const source = `
    import assert from 'node:assert/strict';
    const {database,closeDatabase}=await import('lfaa-storage-sqlite/src/database.js');
    const {configuration}=await import('lfaa-storage-domain/src/configuration.js');
    const {sessionRecords}=await import('lfaa-session-persistence-jsonl/src/repository.js');
    const {retireLegacyFileTables}=await import('lfaa-storage-domain/src/migration.js');retireLegacyFileTables();
    const {listAiProviders,registerAiProvider,probeAiProvider,testAiProviderModel}=await import('lfaa-settings/src/service.js');
    const originalFetch=globalThis.fetch;
    try {
      let receivedOptions, fetchCount=0;
      const registration={
        definition:{id:'fixture-provider',name:'测试 Provider',description:'隔离回归用',options:[{id:'region',label:'区域',choices:[{value:'test',label:'测试'}]}],discovery:'api'},
        resolveConnection(options){receivedOptions=options;return {url:'https://provider.example/v1/models',chatUrl:'https://provider.example/v1/chat/completions',keyHeader:'Authorization',keyPrefix:'Bearer ',maxTokensField:'max_tokens'};},
        async testModel(input){assert.equal(input.model.id,'fixture-model');assert.equal(input.signal instanceof AbortSignal,true);return {sample:'已测试 '+input.secret};}
      };
      const dispose=registerAiProvider(registration);
      assert.ok(listAiProviders().some(provider=>provider.id==='fixture-provider'));
      const published=listAiProviders().find(provider=>provider.id==='fixture-provider');published.name='被修改的目录副本';
      assert.equal(listAiProviders().find(provider=>provider.id==='fixture-provider').name,'测试 Provider');
      globalThis.fetch=async (url,init)=>{fetchCount++;assert.equal(String(url),'https://provider.example/v1/models');assert.equal(init.redirect,'error');return new Response(JSON.stringify({data:[{id:'fixture-model',context_window:32768}]}),{status:200});};
      const probe=await probeAiProvider({providerId:'fixture-provider',options:{region:'test'},secret:'fixture-secret'});
      assert.equal(probe.models[0].id,'fixture-model');assert.equal(Object.isFrozen(receivedOptions),true);
      const modelTest=await testAiProviderModel({providerId:'fixture-provider',options:{region:'test'},secret:'fixture-secret',modelId:'fixture-model',reasoningMode:'default'});
      assert.equal(modelTest.modelId,'fixture-model');assert.equal(modelTest.sample,'已测试 [已隐藏]');assert.equal(fetchCount,2,'真实模型探测与模型测试都走 Provider Owner 合同');
      await assert.rejects(probeAiProvider({providerId:'fixture-provider',options:{region:'test',unexpected:'x'},secret:'fixture-secret'}),/设置项无效/u);
      await assert.rejects(probeAiProvider({providerId:'fixture-provider',options:{region:'https://attacker.example'},secret:'fixture-secret'}),/设置项无效/u);
      assert.throws(()=>registerAiProvider(registration),/重复登记/u);
      dispose();dispose();assert.ok(!listAiProviders().some(provider=>provider.id==='fixture-provider'));
      await assert.rejects(probeAiProvider({providerId:'fixture-provider',options:{},secret:'fixture-secret'}),/不在允许列表/u);
      const officialDispose=registerAiProvider({
        definition:{id:'fixture-official',name:'静态模型 Provider',description:'插件持有官方目录',options:[],discovery:'official-list'},
        async discoverModels({signal}){assert.equal(signal instanceof AbortSignal,true);return [{id:'fixture-static-model',name:'静态模型',contextWindow:65536,thinking:null,thinkingSource:null}];},
        async testModel({model}){assert.equal(model.id,'fixture-static-model');return {sample:'静态目录模型真实请求通过'};}
      });
      const officialProbe=await probeAiProvider({providerId:'fixture-official',options:{},secret:'fixture-secret'});
      assert.equal(officialProbe.models[0].contextWindow,65536);
      const officialTest=await testAiProviderModel({providerId:'fixture-official',options:{},secret:'fixture-secret',modelId:'fixture-static-model',reasoningMode:'default'});
      assert.equal(officialTest.sample,'静态目录模型真实请求通过');officialDispose();
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
