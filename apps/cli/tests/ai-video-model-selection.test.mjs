/** 功能：回归设置中心的视频模型候选与自动默认选择。作用：确保只选择明确的视频能力或已就绪本机模型，并同步执行所需设置。 */
import test from "node:test";
import assert from "node:assert/strict";

const {
  applyVideoModelChoice,
  buildVideoModelChoices,
  defaultVideoModelChoice,
  findSelectedVideoModelChoice
} = await import("lfaa-client-ui-settings/src/video-model-selection.ts");

const makeAccount = (id, providerId, models, planTier = "unknown", active = false) => ({
  id,
  providerId,
  displayName: id,
  active,
  hasSecret: true,
  options: { planTier },
  models
});

const makeModel = (id, taskType, planTiers) => ({ id, name: id, taskType, planTiers });
const makeLocalModel = (id, ready) => ({ id, name: id, modality: "video", ready });
const emptySettings = {
  videoGenerationMode: "provider",
  videoGenerationAccountId: "",
  videoGenerationModelId: "",
  videoGenerationLocalModelId: ""
};

test("默认候选只取明确标记的视频模型及已就绪的本机视频模型", () => {
  const accounts = [makeAccount("deepseek", "deepseek", [makeModel("deepseek-chat", "chat")]),
    makeAccount("doubao", "doubao", [makeModel("doubao-chat", "chat"), makeModel("doubao-video", "video-generation")])];
  const choices = buildVideoModelChoices(accounts, [makeLocalModel("local-ready", true), makeLocalModel("local-partial", false)]);

  assert.deepEqual(choices.map(choice => choice.modelId), ["doubao-video", "local-ready"]);
  assert.equal(defaultVideoModelChoice(choices, emptySettings)?.modelId, "doubao-video");
});

test("套餐模型按当前档位过滤，已有效的视频选择保持不变", () => {
  const account = makeAccount("plan", "ark-agent-plan", [
    makeModel("video-large", "video-generation", ["large", "max"]),
    makeModel("video-max", "video-generation", ["max"])
  ], "large", true);
  const settings = { ...emptySettings, videoGenerationAccountId: "plan", videoGenerationModelId: "video-large" };
  const choices = buildVideoModelChoices([account], []);

  assert.deepEqual(choices.map(choice => choice.modelId), ["video-large"]);
  assert.equal(findSelectedVideoModelChoice(choices, settings)?.modelId, "video-large");
  assert.equal(defaultVideoModelChoice(choices, settings)?.modelId, "video-large");
});

test("没有可用视频模型时保持未选择，不把普通聊天型号当成视频型号", () => {
  const accounts = [makeAccount("doubao", "doubao", [makeModel("doubao-chat", "chat")])];
  const choices = buildVideoModelChoices(accounts, [makeLocalModel("local-incomplete", false)]);

  assert.deepEqual(choices, []);
  assert.equal(defaultVideoModelChoice(choices, emptySettings), undefined);
});

test("切换远程与本机视频模型会同步执行模式并保留另一模式的已有选择", () => {
  const remoteAccount = makeAccount("doubao", "doubao", [makeModel("seedance", "video-generation")]);
  const choices = buildVideoModelChoices([remoteAccount], [makeLocalModel("minimax-h3", true)]);
  const remote = choices.find(choice => choice.mode === "provider");
  const local = choices.find(choice => choice.mode === "local");
  assert.ok(remote);
  assert.ok(local);

  const withRemote = applyVideoModelChoice(emptySettings, remote);
  assert.equal(withRemote.videoGenerationMode, "provider");
  assert.equal(withRemote.videoGenerationAccountId, "doubao");
  assert.equal(withRemote.videoGenerationModelId, "seedance");

  const withLocal = applyVideoModelChoice(withRemote, local);
  assert.equal(withLocal.videoGenerationMode, "local");
  assert.equal(withLocal.videoGenerationLocalModelId, "minimax-h3");
  assert.equal(withLocal.videoGenerationAccountId, "doubao");
  assert.equal(withLocal.videoGenerationModelId, "seedance");
});

test("未标注的 Doubao 型号可手动选择，但不会成为新默认候选", () => {
  const account = makeAccount("doubao", "doubao", [makeModel("existing-target", undefined)]);
  const existing = { ...emptySettings, videoGenerationAccountId: "doubao", videoGenerationModelId: "existing-target" };

  const existingChoices = buildVideoModelChoices([account], []);
  assert.equal(findSelectedVideoModelChoice(existingChoices, existing)?.capabilityUnverified, true);

  const freshChoices = buildVideoModelChoices([account], []);
  assert.equal(freshChoices[0]?.capabilityUnverified, true);
  assert.equal(defaultVideoModelChoice(freshChoices, emptySettings), undefined);
});
