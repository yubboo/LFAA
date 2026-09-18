import test from "node:test";
import assert from "node:assert/strict";
import {
  CONFIG_SCHEMA_VERSION,
  ConfigValidationError,
  createDefaultLfaaConfig,
  parseLfaaConfig,
  validateLfaaConfig,
} from "../src/index.ts";

function expectInvalid(config, messagePattern) {
  assert.throws(
    () => validateLfaaConfig(config),
    (error) => error instanceof ConfigValidationError && messagePattern.test(error.message),
  );
}

test("默认配置通过 Schema v1 校验", () => {
  const config = createDefaultLfaaConfig();
  assert.equal(config.schemaVersion, CONFIG_SCHEMA_VERSION);
  assert.doesNotThrow(() => validateLfaaConfig(config));
  assert.equal(parseLfaaConfig(config), config);
});

test("拒绝错误 Schema Version", () => {
  const config = createDefaultLfaaConfig();
  config.schemaVersion = 999;
  expectInvalid(config, /Schema Version/);
});

test("拒绝 Provider 重复 ID", () => {
  const config = createDefaultLfaaConfig();
  config.providers = [
    { id: "openai", kind: "openai", displayName: "OpenAI A", baseUrl: null, enabled: true },
    { id: "openai", kind: "openai", displayName: "OpenAI B", baseUrl: null, enabled: true },
  ];
  expectInvalid(config, /Provider ID 重复/);
});

test("拒绝悬空 Provider 引用", () => {
  const config = createDefaultLfaaConfig();
  config.models = [
    { id: "model-1", providerId: "missing", accountId: null, model: "gpt", displayName: "GPT", enabled: true },
  ];
  expectInvalid(config, /不存在的 Provider/);
});

test("api-key 账号只保存 credentialRef", () => {
  const config = createDefaultLfaaConfig();
  config.providers = [
    { id: "openai", kind: "openai", displayName: "OpenAI", baseUrl: null, enabled: true },
  ];
  config.accounts = [
    {
      id: "openai-main",
      providerId: "openai",
      displayName: "主账号",
      authType: "api-key",
      credentialRef: "os-credential:openai-main",
      enabled: true,
    },
  ];
  assert.doesNotThrow(() => validateLfaaConfig(config));
});

test("拒绝嵌套 Secret 明文字段", () => {
  const config = createDefaultLfaaConfig();
  config.providers = [
    { id: "openai", kind: "openai", displayName: "OpenAI", baseUrl: null, enabled: true, apiKey: "plaintext" },
  ];
  expectInvalid(config, /Secret 明文字段/);
});

test("remote 模式要求 http/https endpoint", () => {
  const config = createDefaultLfaaConfig();
  config.runtime = { mode: "remote", remoteEndpoint: null };
  expectInvalid(config, /必须提供 endpoint/);

  config.runtime = { mode: "remote", remoteEndpoint: "file:///tmp/lfaa" };
  expectInvalid(config, /http \/ https/);
});

test("Model Account 必须存在且 Provider 一致", () => {
  const config = createDefaultLfaaConfig();
  config.providers = [
    { id: "a", kind: "a", displayName: "A", baseUrl: null, enabled: true },
    { id: "b", kind: "b", displayName: "B", baseUrl: null, enabled: true },
  ];
  config.accounts = [
    { id: "acc-b", providerId: "b", displayName: "B account", authType: "none", credentialRef: null, enabled: true },
  ];
  config.models = [
    { id: "model-a", providerId: "a", accountId: "acc-b", model: "a1", displayName: "A1", enabled: true },
  ];
  expectInvalid(config, /Provider 不一致/);
});
