// 验证生图适配纯函数：端点与风格解析、尺寸归一化、请求体组装、响应解析与生图档案选择。
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  buildAudioRequestBody,
  buildEditImageRequestBody,
  buildImageRequestBody,
  buildReferenceImageContent,
  buildVideoTaskBody,
  detectLanguageType,
  parseAudioResponse,
  resolveAudioEndpoint,
  selectAudioProfile,
  normalizeImageSize,
  parseImageResponse,
  parseVideoTask,
  parseVideoTaskResult,
  resolveImageStylePrompt,
  resolveImageEndpoint,
  resolveVideoEndpoint,
  selectImageProfile,
  selectVideoProfile,
} from "../src/media/media";
import type { LlmProfile } from "../src/types";

function profile(overrides: Partial<LlmProfile>): LlmProfile {
  return {
    id: "p1",
    name: "测试档案",
    kind: "openai-compatible",
    baseUrl: "https://example.com/v1",
    apiKey: "key",
    model: "chat-model",
    updatedAt: 0,
    ...overrides,
  };
}

test("端点解析：百炼走原生多模态、方舟 Agent Plan 保留专属路由", () => {
  assert.deepEqual(resolveImageEndpoint("https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1"), {
    url: "https://token-plan.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
    style: "dashscope-multimodal",
  });
  assert.deepEqual(resolveImageEndpoint("https://ark.cn-beijing.volces.com/api/plan/v3"), {
    url: "https://ark.cn-beijing.volces.com/api/plan/v3/images/generations",
    style: "ark",
  });
  assert.deepEqual(resolveImageEndpoint("https://ark.cn-beijing.volces.com/api/plan/messages"), {
    url: "https://ark.cn-beijing.volces.com/api/plan/v3/images/generations",
    style: "ark",
  });
  assert.deepEqual(resolveImageEndpoint("https://ark.cn-beijing.volces.com/api/v3"), {
    url: "https://ark.cn-beijing.volces.com/api/v3/images/generations",
    style: "ark",
  });
  assert.deepEqual(resolveImageEndpoint("https://api.example.com/v1"), {
    url: "https://api.example.com/v1/images/generations",
    style: "compatible",
  });
});

test("尺寸归一化：x/×/* 统一成百炼 * 格式", () => {
  assert.equal(normalizeImageSize("1024x1024"), "1024*1024");
  assert.equal(normalizeImageSize(" 1024×768 "), "1024*768");
  assert.equal(normalizeImageSize("2048"), undefined);
  assert.equal(normalizeImageSize(undefined), undefined);
});

test("请求体组装：百炼原生结构、兼容结构、n 上限保护", () => {
  const dashscope = buildImageRequestBody(profile({ model: "qwen-image-3.0-pro" }), {
    prompt: "  海边日落 ",
    size: "1024x1024",
    n: 9,
    seed: 42.7,
    watermark: false,
    negativePrompt: " 人群 ",
  }, "dashscope-multimodal");
  assert.deepEqual(dashscope, {
    model: "qwen-image-3.0-pro",
    input: { messages: [{ role: "user", content: [{ text: "海边日落" }] }] },
    parameters: { n: 6, prompt_extend: true, size: "1024*1024", seed: 42, watermark: false, negative_prompt: "人群" },
  });
  assert.deepEqual(buildImageRequestBody(profile({ model: "m" }), { prompt: "p" }, "compatible"), { model: "m", prompt: "p", n: 1 });
});

test("万相 2.7 文生图不发送官方不支持的 prompt_extend", () => {
  const body = buildImageRequestBody(profile({ model: "wan2.7-image" }), { prompt: "成年女性时装模特" }, "dashscope-multimodal");
  assert.equal((body.parameters as Record<string, unknown>).prompt_extend, undefined);
});

test("响应解析：百炼 output.choices 图片、OpenAI b64/url 与 images 字段", () => {
  assert.deepEqual(parseImageResponse({
    output: { choices: [{ message: { content: [{ image: "https://x/y.png" }] } }] },
  }), [{ url: "https://x/y.png", mime: "image/png" }]);
  assert.deepEqual(parseImageResponse({ data: [{ b64_json: "AAA" }] }), [{ b64: "AAA", mime: "image/png" }]);
  assert.deepEqual(parseImageResponse({ data: [{ url: "https://x/y.png" }] }), [{ url: "https://x/y.png", mime: "image/png" }]);
  assert.deepEqual(parseImageResponse({ images: [{ b64: "BBB" }] }), [{ b64: "BBB", mime: "image/png" }]);
  assert.deepEqual(parseImageResponse({}), []);
});

test("生图档案选择：显式 > 当前档案 > 第一个含图像模型的档案；文本生图优先于编辑模型", () => {
  const imageProfile = profile({ id: "img", model: "wan2.7-image", availableModels: [{ id: "wan2.7-image", supportsReasoning: false, reasoningMode: "none", reasoningLevels: [] }] });
  const chatProfile = profile({ id: "chat", model: "qwen3.7-max" });
  const list = [chatProfile, imageProfile];
  assert.deepEqual(selectImageProfile(list, "chat", { profileId: "img" }), { profile: imageProfile, modelId: "wan2.7-image" });
  assert.deepEqual(selectImageProfile(list, "chat", {}), { profile: imageProfile, modelId: "wan2.7-image" });

  const mixed = profile({
    id: "p",
    model: "chat",
    availableModels: [
      { id: "wan2.7-image", supportsReasoning: false, reasoningMode: "none", reasoningLevels: [] },
      { id: "qwen-image-3.0-pro", supportsReasoning: false, reasoningMode: "none", reasoningLevels: [] },
    ],
  });
  assert.equal(selectImageProfile([mixed], "p", {}).modelId, "qwen-image-3.0-pro");

  assert.throws(() => selectImageProfile([chatProfile], "chat", {}), /还没有配置生图模型/u);
  assert.throws(() => selectImageProfile(list, "chat", { profileId: "nope" }), /找不到模型配置/u);
  assert.throws(() => selectImageProfile(list, "chat", { profileId: "chat" }), /不是生图模型/u);
});

test("视频端点与请求体：百炼异步视频接口、方舟任务、时长与分辨率约束", () => {
  assert.deepEqual(resolveVideoEndpoint("https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1"), {
    url: "https://token-plan.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis",
    style: "dashscope-video",
  });
  assert.deepEqual(resolveVideoEndpoint("https://ark.cn-beijing.volces.com/api/plan/v3"), {
    url: "https://ark.cn-beijing.volces.com/api/plan/v3/contents/generations/tasks",
    style: "ark-video",
  });
  assert.deepEqual(resolveVideoEndpoint("https://ark.cn-beijing.volces.com/api/v3"), {
    url: "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks",
    style: "ark-video",
  });
  assert.deepEqual(parseVideoTask({ id: "ark-123" }, "ark-video"), { taskId: "ark-123", status: "PENDING" });
  assert.deepEqual(parseVideoTaskResult({ status: "succeeded", content: { video_url: "https://example.com/video.mp4" } }, "ark-video"), {
    status: "SUCCEEDED", videoUrl: "https://example.com/video.mp4",
  });
  assert.deepEqual(parseVideoTaskResult({ status: "failed", error: { message: "套餐额度不足" } }, "ark-video"), {
    status: "FAILED", message: "套餐额度不足",
  });
  const body = buildVideoTaskBody(profile({ model: "wan3.0-video" }), {
    prompt: " 海边日落 ",
    duration: 99,
    resolution: "1080p",
    ratio: "9:16",
    seed: 7.8,
    watermark: true,
    negativePrompt: " 人群 ",
  });
  assert.deepEqual(body, {
    model: "wan3.0-video",
    input: { prompt: "海边日落", negative_prompt: "人群" },
    parameters: { resolution: "1080P", ratio: "9:16", duration: 15, prompt_extend: true, watermark: true, seed: 7 },
  });
  assert.deepEqual(buildVideoTaskBody(profile({ model: "m" }), { prompt: "p" }, "ark-video"), {
    model: "m",
    content: [{ type: "text", text: "p" }],
  });
});

test("视频任务响应解析与档案选择", () => {
  assert.deepEqual(parseVideoTask({ output: { task_id: "t1", task_status: "PENDING" } }), { taskId: "t1", status: "PENDING" });
  assert.deepEqual(parseVideoTaskResult({ output: { task_status: "SUCCEEDED", video_url: "https://x/v.mp4" } }), { status: "SUCCEEDED", videoUrl: "https://x/v.mp4" });
  assert.deepEqual(parseVideoTaskResult({ output: { task_status: "FAILED", message: "bad" } }), { status: "FAILED", message: "bad" });
  const videoProfile = profile({ id: "vid", model: "chat", availableModels: [{ id: "wan3.0-video", supportsReasoning: false, reasoningMode: "none", reasoningLevels: [] }] });
  assert.deepEqual(selectVideoProfile([videoProfile], "vid", {}), { profile: videoProfile, modelId: "wan3.0-video" });
  assert.throws(() => selectVideoProfile([profile({ model: "chat" })], "chat", {}), /还没有配置视频生成模型/u);
});

test("语音合成：端点、语言推断、请求体与响应解析", () => {
  assert.deepEqual(resolveAudioEndpoint("https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1"), {
    url: "https://token-plan.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
    style: "dashscope-tts",
  });
  assert.equal(resolveAudioEndpoint("https://ark.cn-beijing.volces.com/api/plan/v3").style, "ark-speech");
  assert.equal(detectLanguageType("你好，世界"), "Chinese");
  assert.equal(detectLanguageType("hello world"), "English");
  assert.deepEqual(buildAudioRequestBody(profile({ model: "qwen-audio-3.0-tts-plus" }), { text: "你好" }), {
    model: "qwen-audio-3.0-tts-plus",
    input: { text: "你好", voice: "Cherry", language_type: "Chinese" },
  });
  assert.deepEqual(parseAudioResponse({
    output: { audio: { url: "https://x/a.mp3", expires_at: 123 } },
    usage: { characters: 4 },
  }), { audioUrl: "https://x/a.mp3", expiresAt: 123, characters: 4 });
});

test("语音档案选择：TTS 优先于 ASR/实时语音", () => {
  const audioProfile = profile({
    id: "tts",
    model: "chat",
    availableModels: [
      { id: "qwen-audio-3.0-asr-flash", supportsReasoning: false, reasoningMode: "none", reasoningLevels: [] },
      { id: "qwen-audio-3.0-tts-plus", supportsReasoning: false, reasoningMode: "none", reasoningLevels: [] },
    ],
  });
  assert.equal(selectAudioProfile([audioProfile], "tts", {}).modelId, "qwen-audio-3.0-tts-plus");
  assert.throws(() => selectAudioProfile([profile({ model: "chat" })], "chat", {}), /还没有配置语音合成模型/u);
});

test("生图风格预设：已知风格展开为提示词后缀，未知风格保持原文", () => {
  assert.match(resolveImageStylePrompt("cinematic"), /电影感/u);
  assert.match(resolveImageStylePrompt(" 3D "), /3D 渲染/u);
  assert.equal(resolveImageStylePrompt("unknown"), "");
  const body = buildImageRequestBody(profile({ model: "m" }), { prompt: "海边", style: "cinematic" });
  assert.match(String(body.prompt), /^海边，风格：/u);
  assert.deepEqual(buildImageRequestBody(profile({ model: "m" }), { prompt: "海边" }), { model: "m", prompt: "海边", n: 1 });
});

test("图生图参考图：URL 透传、本地文件转 data URL、编辑请求体结构", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lfaa-ref-"));
  try {
    const file = join(dir, "ref.png");
    await writeFile(file, Buffer.from("fakepng"));
    const contents = await buildReferenceImageContent(["https://example.com/a.png", file]);
    assert.equal(contents.length, 2);
    assert.deepEqual(contents[0], { image: "https://example.com/a.png" });
    assert.match(contents[1]!.image, /^data:image\/png;base64,/u);

    const body = buildEditImageRequestBody(profile({ model: "wan2.7-image" }), { prompt: "太丑了，苗条一些，要模特身材", style: "watercolor" }, contents);
    const messages = (body.input as { messages: Array<{ content: Array<Record<string, string>> }> }).messages;
    assert.equal(messages[0]!.content.length, 3);
    assert.equal(messages[0]!.content[2]!.text?.includes("风格："), true);
    const editPrompt = messages[0]!.content[2]!.text ?? "";
    assert.match(editPrompt, /【本次修改要求，必须执行】/u);
    assert.match(editPrompt, /太丑了，苗条一些，要模特身材/u);
    assert.ok(editPrompt.indexOf("【本次修改要求") < editPrompt.indexOf("保持原图为同一个主体"));
    assert.match(editPrompt, /保留可辨识的身份特征/u);
    assert.match(editPrompt, /不要替换主体/u);
    assert.match(editPrompt, /身形明显调整为高挑、纤细、匀称的时装模特比例/u);
    assert.match(editPrompt, /明显提升面部与整体造型的精致度和上镜感/u);
    assert.equal((body.parameters as Record<string, unknown>).prompt_extend, undefined);

    const genericBody = buildEditImageRequestBody(profile({ model: "wan2.7-image" }), { prompt: "改成水彩" }, contents);
    const genericPrompt = ((genericBody.input as { messages: Array<{ content: Array<Record<string, string>> }> }).messages[0]!.content[2]!.text ?? "");
    assert.doesNotMatch(genericPrompt, /时装模特比例|精致度和上镜感/u);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("有参考图时档案选择优先编辑模型", () => {
  const mixed = profile({
    id: "p",
    model: "chat",
    availableModels: [
      { id: "qwen-image-3.0-pro", supportsReasoning: false, reasoningMode: "none", reasoningLevels: [] },
      { id: "wan2.7-image", supportsReasoning: false, reasoningMode: "none", reasoningLevels: [] },
    ],
  });
  assert.equal(selectImageProfile([mixed], "p", { referenceImages: ["a.png"] }).modelId, "wan2.7-image");
  assert.equal(selectImageProfile([mixed], "p", {}).modelId, "qwen-image-3.0-pro");
});
