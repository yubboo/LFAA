/**
 * 功能：回归 Provider 模型目录中的思考能力解析与共享选项。
 * 作用：验证目录来源、厂商实际档位、官方默认值及停用值过滤，不访问外部 Provider。
 * 关联文件：packages/settings/settings/src/model-capabilities.ts、packages/client/ui-settings-models/src/model-options.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const capabilities = await import("lfaa-settings/src/model-capabilities.js");
const modelOptions = await import("lfaa-client-ui-settings-models/src/model-options.js");
const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("Provider 目录只提供明确声明的模型力度并保留厂商顺序与默认值", () => {
  const control = capabilities.normalizeProviderModelThinking({
    id: "provider-model",
    effort: { supported_levels: ["low", "ultra", "high", "none", "off", "disabled", "LOW"], default_level: "high" }
  });
  assert.deepEqual(control, { kind: "effort", parameter: "reasoning_effort", values: ["low", "ultra", "high"], defaultValue: "high" });
  assert.equal(capabilities.normalizeProviderModelThinking({ id: "no-capability" }), null);
  assert.equal(capabilities.normalizeProviderModelThinking({ effort: { supported_levels: ["none", "off"] } }), null);
});

test("设置中心和 AI Work 共用目录选项且 Provider 默认不伪装成无思考", () => {
  const model = {
    id: "provider-model",
    name: "Provider Model",
    thinking: { kind: "effort", parameter: "reasoning_effort", values: ["low", "ultra", "high"], defaultValue: "high" },
    thinkingSource: "provider-model-catalog"
  };
  assert.deepEqual(modelOptions.reasoningOptions(model), [
    { value: "default", label: "跟随官方默认 · 高" },
    { value: "low", label: "低" },
    { value: "ultra", label: "ultra" },
    { value: "high", label: "高 · 官方默认" }
  ]);
  assert.equal(modelOptions.defaultReasoningMode(model), "default");
  assert.equal(modelOptions.effectiveReasoningMode(model, "removed-level"), "default");
  assert.deepEqual(modelOptions.reasoningOptions({ ...model, thinkingSource: null }), []);
});

test("AI Work 汇总全部已配置账户的目录并只呈现目录已声明的能力", () => {
  const account = (id, scope, active, modelId, models, planTier = "") => ({
    id, scope, active, modelId, models, providerId: id, displayName: id, options: { planTier }, reasoningMode: "default"
  });
  const catalog = modelOptions.aiModelPickerCatalog([
    account("system-deepseek", "system", true, "shared-model", [
      { id: "shared-model", name: "系统当前模型", thinking: null, thinkingSource: null },
      { id: "system-alt", name: "系统备选", thinking: null, thinkingSource: null },
      { id: "embedding", name: "非聊天模型", taskType: "embedding", thinking: null, thinkingSource: null }
    ]),
    account("user-plan", "user", true, "shared-model", [
      { id: "shared-model", name: "个人当前模型", planTiers: ["pro"], thinking: null, thinkingSource: null },
      { id: "unavailable", name: "不属于当前套餐", planTiers: ["lite"], thinking: null, thinkingSource: null }
    ], "pro")
  ]);
  assert.deepEqual(catalog.map(({ account: item, model }) => `${item.id}:${model.name}`), [
    "user-plan:个人当前模型",
    "system-deepseek:系统当前模型",
    "system-deepseek:系统备选"
  ], "个人账户按 Settings Owner 的优先级展示；账户不同的同 ID 模型不可合并；非聊天和不支持的套餐模型不进入 Agent 选择器");

  const official = {
    id: "official-model",
    name: "官方模型",
    contextWindow: 128_000,
    maxOutputTokens: 8_192,
    taskType: "chat",
    inputModalities: ["text", "image"],
    thinking: { kind: "effort", parameter: "reasoning_effort", values: ["low", "high"], defaultValue: "high" },
    thinkingSource: "provider-model-catalog",
    catalogSource: "https://provider.example/models"
  };
  assert.equal(modelOptions.modelCatalogCapabilitySummary(official), "上下文 128,000 tokens · 官方单次输出上限 8,192 tokens · 模型用途 chat · 输入模态 text、image · 思考参数 reasoning_effort: low / high · 官方默认 high · 目录来源 https://provider.example/models");
  const missing = modelOptions.modelCatalogCapabilitySummary({ id: "plain", name: "plain", thinking: null, thinkingSource: null });
  assert.match(missing, /官方模型目录未提供上下文与输出上限元数据/u);
  assert.match(missing, /思考参数目录未提供可验证能力/u);
  assert.doesNotMatch(missing, /tokens/u, "目录缺失的容量不能按名称猜测或填入默认值");
});

test("旧目录兼容仅限原 DeepSeek 官方档位且会拒绝 none、off 和 disabled", () => {
  const legacy = capabilities.normalizeStoredModelThinking(
    { kind: "effort", parameter: "reasoning_effort", values: ["low", "high", "none"], defaultValue: "high" },
    null,
    true
  );
  assert.deepEqual(legacy, {
    thinking: { kind: "effort", parameter: "reasoning_effort", values: ["low", "high"], defaultValue: "high" },
    thinkingSource: "provider-model-catalog"
  });
  assert.deepEqual(capabilities.normalizeStoredModelThinking(
    { kind: "effort", parameter: "reasoning_effort", values: ["low"] }, null, false
  ), { thinking: null, thinkingSource: null });
  assert.equal(capabilities.normalizeAccountReasoningMode(legacy.thinking, "none"), "default");
  assert.equal(capabilities.isSelectableReasoningMode(legacy.thinking, "off"), false);
  assert.equal(capabilities.isSelectableReasoningMode(legacy.thinking, "default"), true);
});

test("思考开关只保留真实的启用选项", () => {
  const toggle = capabilities.normalizeStoredModelThinking(
    { kind: "toggle", parameter: "thinking", values: ["enabled", "disabled"], defaultValue: "enabled" },
    "provider-model-catalog",
    false
  );
  assert.deepEqual(toggle.thinking, { kind: "toggle", parameter: "thinking", values: ["enabled"], defaultValue: "enabled" });
  assert.equal(capabilities.isSelectableReasoningMode(toggle.thinking, "disabled"), false);
});

test("账户保存、切换模型与 Agent Runtime 使用同一目录能力", () => {
  const parent = resolve(tmpdir());
  const data = mkdtempSync(join(parent, "lfaa-model-thinking-"));
  try {
    const output = execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "--input-type=module", "-e", `
      import assert from 'node:assert/strict';
      const { database, closeDatabase } = await import('lfaa-storage-sqlite/src/database.js');
      database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('thinking-owner',1,'thinking-owner','test-salt','test-hash','admin',1)").run();
      const settings = await import('lfaa-settings/src/service.js');
      const { streamAiCompletion } = await import('lfaa-llm/src/completion.js');
      const { configuration } = await import('lfaa-storage-domain/src/configuration.js');
      let requestBodies = [];
      globalThis.fetch = async (url, options = {}) => {
        if (String(url) === 'https://api.deepseek.com/models') return Response.json({ data: [
          { id: 'reasoning-model', effort: { supported_levels: ['low', 'high', 'max', 'none'], default_level: 'high' } },
          { id: 'overlapping-model', effort: { supported_levels: ['high', 'max'], default_level: 'high' } },
          { id: 'plain-model' }
        ] });
        const body = JSON.parse(options.body);
        requestBodies.push(body);
        if (!body.stream) return Response.json({ choices: [{ message: { content: '连接成功。' } }] });
        return new Response('data: '+JSON.stringify({choices:[{delta:{content:'ok'}}]})+'\\n\\ndata: [DONE]\\n\\n',{headers:{'Content-Type':'text/event-stream'}});
      };
      const account = await settings.saveAiAccount('thinking-owner', { providerId: 'deepseek', secret: 'fixture-key', options: {}, displayName: '回归账户', modelId: 'reasoning-model', reasoningMode: 'default' });
      settings.activateAiAccount('thinking-owner', account.id);
      assert.deepEqual(account.models[0].thinking.values, ['low', 'high', 'max']);
      await assert.rejects(async () => settings.updateAiAccountReasoningMode('thinking-owner', account.id, 'none'), /支持范围/u);
      settings.updateAiAccountReasoningMode('thinking-owner', account.id, 'max');
      const invokeRuntime = async (configuration) => streamAiCompletion({
        account: configuration, applicationId: 'workspace', permissionMode: 'ask', messages: [{ role: 'user', content: 'test' }],
        extensions: [], settings: settings.defaultSettings.aiRuntime, signal: new AbortController().signal, onDelta() {}, onProgress() {}
      });
      await invokeRuntime(settings.resolveActiveAiModelConfiguration('thinking-owner'));
      assert.equal(requestBodies.at(-1).reasoning_effort, 'max');
      settings.updateAiAccountReasoningMode('thinking-owner', account.id, 'default');
      await invokeRuntime(settings.resolveActiveAiModelConfiguration('thinking-owner'));
      assert.equal(Object.hasOwn(requestBodies.at(-1), 'reasoning_effort'), false);
      settings.updateAiAccountReasoningMode('thinking-owner', account.id, 'max');
      const overlapping = await settings.updateAiAccountModel('thinking-owner', account.id, 'overlapping-model');
      assert.equal(overlapping.reasoningMode, 'max', '新模型仍支持当前档位时保留用户选择');
      await invokeRuntime(settings.resolveActiveAiModelConfiguration('thinking-owner'));
      assert.equal(requestBodies.at(-1).reasoning_effort, 'max');
      const switched = await settings.updateAiAccountModel('thinking-owner', account.id, 'plain-model');
      assert.equal(switched.modelId, 'plain-model');
      assert.equal(switched.models.find(model => model.id === 'plain-model').thinking, null);
      assert.equal(Object.hasOwn(requestBodies.at(-1), 'reasoning_effort'), false);
      const unsafe = { ...settings.resolveActiveAiModelConfiguration('thinking-owner'), reasoningMode: 'none', thinking: { kind: 'effort', parameter: 'reasoning_effort', values: ['none', 'high'] } };
      await invokeRuntime(unsafe);
      assert.equal(Object.hasOwn(requestBodies.at(-1), 'reasoning_effort'), false);
      configuration.close();
      closeDatabase();
      process.stdout.write('模型思考参数账户与 Runtime 回归通过');
    `], { cwd: cli, env: { ...process.env, NODE_ENV: "test", LFAA_DATA_DIR: data, JWT_SECRET: "" }, encoding: "utf8", stdio: "pipe", timeout: 20000 });
    assert.match(output, /模型思考参数账户与 Runtime 回归通过/u);
  } finally {
    assert.equal(dirname(resolve(data)), parent);
    rmSync(data, { recursive: true, force: true });
  }
});

test("跨 Provider 选择目录模型时原子保存官方元数据与有效活动账户", () => {
  const parent = resolve(tmpdir());
  const data = mkdtempSync(join(parent, "lfaa-model-picker-selection-"));
  try {
    execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "--input-type=module", "-e", `
      import assert from 'node:assert/strict';
      const { database, closeDatabase } = await import('lfaa-storage-sqlite/src/database.js');
      database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('picker-owner',1,'picker-owner','test-salt','test-hash','admin',1)").run();
      const settings = await import('lfaa-settings/src/service.js');
      const { configuration } = await import('lfaa-storage-domain/src/configuration.js');
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url, options = {}) => {
        const target = String(url);
        if (target === 'https://api.deepseek.com/models') return Response.json({ data: [{ id: 'deep-model', name: 'Deep Model' }] });
        if (target === 'https://api.openai.com/v1/models') return Response.json({ data: [
          { id: 'open-current', name: 'Open Current', task_type: 'chat', input_modalities: ['text'] },
          { id: 'open-next', name: 'Open Next', context_window: 131072, max_completion_tokens: 8192, task_type: 'chat', input_modalities: ['text', 'image'], effort: { supported_levels: ['low', 'high'], default_level: 'high' } }
        ] });
        if (target === 'https://api-docs.deepseek.com/zh-cn/updates/') return new Response('<html></html>');
        if (target === 'https://api.deepseek.com/chat/completions' || target === 'https://api.openai.com/v1/chat/completions') {
          return Response.json({ choices: [{ message: { content: 'fixture response' } }] });
        }
        throw new Error('Unexpected Provider request: ' + target);
      };
      try {
        const deep = await settings.saveAiAccount('picker-owner', { providerId: 'deepseek', secret: 'fixture-key', options: {}, displayName: 'DeepSeek 主账户', modelId: 'deep-model', reasoningMode: 'default' });
        settings.activateAiAccount('picker-owner', deep.id);
        const open = await settings.saveAiAccount('picker-owner', { providerId: 'openai', secret: 'fixture-key', options: {}, displayName: 'OpenAI 账户', modelId: 'open-current', reasoningMode: 'default' });
        assert.deepEqual(settings.listAiAccounts('picker-owner').map(account => account.id).sort(), [deep.id, open.id].sort(), 'Settings Owner 返回全部已配置 Provider 账户');
        assert.equal(open.models.find(model => model.id === 'open-next').contextWindow, 131072, '官方上下文容量必须完整写入账户目录');
        assert.deepEqual(open.models.find(model => model.id === 'open-next').inputModalities, ['text', 'image'], '官方输入模态必须完整写入账户目录');
        const selected = await settings.selectAiAccountModel('picker-owner', open.id, 'open-next');
        assert.equal(selected.modelId, 'open-next');
        assert.equal(selected.active, true);
        assert.equal(selected.models.find(model => model.id === 'open-next').maxOutputTokens, 8192);
        assert.deepEqual(settings.listAiAccounts('picker-owner').filter(account => account.active).map(account => account.id), [open.id], '系统 Provider 切换必须清除当前用户的个人账户覆盖');
        const effective = settings.resolveActiveAiModelDetails('picker-owner');
        assert.equal(effective.providerId, 'openai');
        assert.equal(effective.modelId, 'open-next');
        assert.equal(effective.contextWindow, 131072);
        assert.equal(effective.maxOutputTokens, 8192);
        assert.deepEqual(effective.thinking, { kind: 'effort', parameter: 'reasoning_effort', values: ['low', 'high'], defaultValue: 'high' });
      } finally {
        globalThis.fetch = originalFetch;
        configuration.close();
        closeDatabase();
      }
    `], { cwd: cli, env: { ...process.env, NODE_ENV: "test", LFAA_HOME: data, LFAA_DATA_DIR: data, JWT_SECRET: "", LFAA_HARNESS_HOME: "" }, encoding: "utf8", stdio: "pipe", timeout: 30_000 });
  } finally {
    assert.equal(dirname(resolve(data)), parent);
    rmSync(data, { recursive: true, force: true });
  }
});
