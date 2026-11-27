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
  createMediaVideoTask,
  detectLanguageType,
  generateConfiguredVideo,
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

test("视频参考素材进入各厂商的真实多模态字段", () => {
  const frame = { role: "first_frame", url: "data:image/png;base64,AA==" } as const;
  const motion = { role: "reference_video", url: "data:video/mp4;base64,AA==" } as const;
  const wan = buildVideoTaskBody(profile({ model: "wan3.0-video" }), { prompt: "Follow Video 1.", visualInputs: [motion] });
  assert.deepEqual(wan.input, { prompt: "Follow Video 1.", media: [{ type: motion.role, url: motion.url }] });
  const ark = buildVideoTaskBody(profile({ model: "doubao-seedance-2.0" }), { prompt: "Continue.", visualInputs: [frame] }, "ark-video");
  assert.deepEqual(ark.content, [{ type: "text", text: "Continue." }, { type: "image_url", role: frame.role, image_url: { url: frame.url } }]);
});

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
  // HappyHorse 官方时长下限是 3 秒：默认 2 秒会被提到 3，显式 2 也一样。
  const happy = buildVideoTaskBody(profile({ model: "happyhorse-1.1-r2v" }), { prompt: "p" });
  assert.equal((happy.parameters as Record<string, unknown>).duration, 3);
  const happyExplicit = buildVideoTaskBody(profile({ model: "happyhorse-1.1-t2v" }), { prompt: "p", duration: 2 });
  assert.equal((happyExplicit.parameters as Record<string, unknown>).duration, 3);
});

test("火山 Agent Plan 拒绝视频模型时给出可执行的换用建议", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    error: { code: "UnsupportedModel", message: "The requested model does not support the agent plan feature." },
  }), { status: 404, headers: { "content-type": "application/json" } })) as typeof fetch;
  try {
    await assert.rejects(
      createMediaVideoTask(profile({
        id: "ark",
        baseUrl: "https://ark.cn-beijing.volces.com/api/plan/v3",
        model: "doubao-seedance-2.0-mini",
        apiKey: "ark-key",
      }), { prompt: "雨窗少女", duration: 5 }),
      /Agent Plan 套餐档位不支持该视频模型.*Large \/ Max.*标准方舟 API Key/u,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("视频接口网络失败时给出可读提示，不把 fetch failed 原样抛给用户", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => { throw new TypeError("fetch failed"); }) as typeof fetch;
  try {
    await assert.rejects(
      createMediaVideoTask(profile({ id: "net", baseUrl: "https://example.com/v1", model: "wan3.0-video" }), { prompt: "雨窗少女", duration: 5 }),
      /无法连接视频接口.*fetch failed/u,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("视频任务响应解析与档案选择", () => {
  assert.deepEqual(parseVideoTask({ output: { task_id: "t1", task_status: "PENDING" } }), { taskId: "t1", status: "PENDING" });
  assert.deepEqual(parseVideoTaskResult({ output: { task_status: "SUCCEEDED", video_url: "https://x/v.mp4" } }), { status: "SUCCEEDED", videoUrl: "https://x/v.mp4" });
  assert.deepEqual(parseVideoTaskResult({ output: { task_status: "FAILED", message: "bad" } }), { status: "FAILED", message: "bad" });
  const videoProfile = profile({ id: "vid", model: "chat", availableModels: [{ id: "wan3.0-video", supportsReasoning: false, reasoningMode: "none", reasoningLevels: [] }] });
  assert.deepEqual(selectVideoProfile([videoProfile], "vid", {}), { profile: videoProfile, modelId: "wan3.0-video" });
  assert.throws(() => selectVideoProfile([profile({ model: "chat" })], "chat", {}), /还没有配置视频生成模型/u);
});

test("媒体档案选择：套餐声明的 modelKind 优先于模型 ID 推断", () => {
  // 千问 Token Plan 的 happyhorse 由套餐目录声明为视频生成模型，选中后必须直接可用于生成。
  const tokenPlan = profile({
    id: "qwen",
    model: "happyhorse-1.1-r2v",
    availableModels: [
      { id: "happyhorse-1.1-r2v", modelKind: "video", supportsReasoning: false, reasoningMode: "none", reasoningLevels: [] },
      { id: "qwen3.7-max", supportsReasoning: false, reasoningMode: "none", reasoningLevels: [] },
    ],
  });
  assert.deepEqual(selectVideoProfile([tokenPlan], "qwen", { profileId: "qwen", modelId: "happyhorse-1.1-r2v" }), {
    profile: tokenPlan,
    modelId: "happyhorse-1.1-r2v",
  });
  // 历史档案没有同步用途时，模型 ID 家族仍能把 happyhorse 认成视频模型。
  const legacy = profile({
    id: "legacy",
    model: "happyhorse-1.1-t2v",
    availableModels: [{ id: "happyhorse-1.1-t2v", supportsReasoning: false, reasoningMode: "none", reasoningLevels: [] }],
  });
  assert.equal(selectVideoProfile([legacy], "legacy", {}).modelId, "happyhorse-1.1-t2v");

  // 目录声明的非对话用途即使 ID 无法推断也应接受；声明为 chat 不能覆盖明确的视频 ID。
  const declared = profile({
    id: "vendor",
    model: "custom-motion-1",
    availableModels: [
      { id: "custom-motion-1", modelKind: "video", supportsReasoning: false, reasoningMode: "none", reasoningLevels: [] },
      { id: "wan3.0-video", modelKind: "chat", supportsReasoning: false, reasoningMode: "none", reasoningLevels: [] },
    ],
  });
  assert.equal(selectVideoProfile([declared], "vendor", { profileId: "vendor", modelId: "custom-motion-1" }).modelId, "custom-motion-1");
  assert.equal(selectVideoProfile([declared], "vendor", { profileId: "vendor", modelId: "wan3.0-video" }).modelId, "wan3.0-video");

  // 生图选择同样采信目录声明。
  const declaredImage = profile({
    id: "img2",
    model: "custom-picture-1",
    availableModels: [{ id: "custom-picture-1", modelKind: "image", supportsReasoning: false, reasoningMode: "none", reasoningLevels: [] }],
  });
  assert.equal(selectImageProfile([declaredImage], "img2", { profileId: "img2", modelId: "custom-picture-1" }).modelId, "custom-picture-1");
});

test("视频选型：纯文字时参考/图生视频改用可用的文字视频模型，优先 Wan 3.0", () => {
  const happy = profile({
    id: "happy",
    model: "happyhorse-1.1-r2v",
    availableModels: [
      { id: "happyhorse-1.1-r2v", modelKind: "video", supportsReasoning: false, reasoningMode: "none", reasoningLevels: [] },
      { id: "happyhorse-1.1-i2v", modelKind: "video", supportsReasoning: false, reasoningMode: "none", reasoningLevels: [] },
      { id: "happyhorse-1.1-t2v", modelKind: "video", supportsReasoning: false, reasoningMode: "none", reasoningLevels: [] },
      { id: "wan3.0-video", modelKind: "video", supportsReasoning: false, reasoningMode: "none", reasoningLevels: [] },
    ],
  });
  // r2v / i2v 需要 input.media；纯文字时优先用实测画质更好的 Wan 3.0。
  assert.equal(selectVideoProfile([happy], "happy", { profileId: "happy", modelId: "happyhorse-1.1-r2v" }).modelId, "wan3.0-video");
  assert.equal(selectVideoProfile([happy], "happy", { profileId: "happy", modelId: "happyhorse-1.1-i2v" }).modelId, "wan3.0-video");
  // t2v 与普通视频模型保持原选择。
  assert.equal(selectVideoProfile([happy], "happy", { profileId: "happy", modelId: "happyhorse-1.1-t2v" }).modelId, "happyhorse-1.1-t2v");
  assert.equal(selectVideoProfile([happy], "happy", { profileId: "happy", modelId: "wan3.0-video" }).modelId, "wan3.0-video");
  // 未显式指定模型、当前档案停在 r2v 时同样回退到 Wan 3.0。
  assert.equal(selectVideoProfile([happy], "happy", { profileId: "happy" }).modelId, "wan3.0-video");

  // 套餐里没有 Wan 3.0 时回到同家族 t2v。
  const happyOnly = profile({
    id: "happy-only",
    model: "happyhorse-1.1-r2v",
    availableModels: [
      { id: "happyhorse-1.1-r2v", modelKind: "video", supportsReasoning: false, reasoningMode: "none", reasoningLevels: [] },
      { id: "happyhorse-1.1-t2v", modelKind: "video", supportsReasoning: false, reasoningMode: "none", reasoningLevels: [] },
    ],
  });
  assert.equal(selectVideoProfile([happyOnly], "happy-only", { profileId: "happy-only", modelId: "happyhorse-1.1-r2v" }).modelId, "happyhorse-1.1-t2v");

  // 没有 t2v 兄弟模型时保留原选择，让厂商返回真实原因而不是静默换模型。
  const onlyR2v = profile({
    id: "only",
    model: "happyhorse-1.1-r2v",
    availableModels: [{ id: "happyhorse-1.1-r2v", modelKind: "video", supportsReasoning: false, reasoningMode: "none", reasoningLevels: [] }],
  });
  assert.equal(selectVideoProfile([onlyR2v], "only", { profileId: "only", modelId: "happyhorse-1.1-r2v" }).modelId, "happyhorse-1.1-r2v");
});

test("视频生成请求以选型结果为准，原 modelId 不会覆盖 t2v 回退", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, unknown> | undefined;
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    requestBody = typeof init?.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : undefined;
    return new Response(JSON.stringify({
      output: { task_id: "t1", task_status: "SUCCEEDED", video_url: "https://example.com/v.mp4" },
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const happy = profile({
      id: "happy",
      model: "happyhorse-1.1-r2v",
      availableModels: [
        { id: "happyhorse-1.1-r2v", modelKind: "video", supportsReasoning: false, reasoningMode: "none", reasoningLevels: [] },
        { id: "happyhorse-1.1-t2v", modelKind: "video", supportsReasoning: false, reasoningMode: "none", reasoningLevels: [] },
      ],
    });
    const result = await generateConfiguredVideo([happy], "happy", {
      prompt: "纯文字视频",
      profileId: "happy",
      modelId: "happyhorse-1.1-r2v",
    });
    assert.equal(requestBody?.model, "happyhorse-1.1-t2v");
    assert.equal(result.model, "happyhorse-1.1-t2v");
    assert.equal(result.status, "SUCCEEDED");
  } finally {
    globalThis.fetch = originalFetch;
  }
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
