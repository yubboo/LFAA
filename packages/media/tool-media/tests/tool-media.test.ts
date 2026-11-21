// 验证媒体工具：generate_image 调用模型服务、落盘文件并返回路径；缺少提示词时给出可读错误。
import assert from "node:assert/strict";
import { Context, Service } from "@deepseek-ai/cordis";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { IncomingMessage, ServerResponse } from "node:http";
import { toolsPlugin, type ToolExecutionContext } from "@lfaa/tools";
import type { MediaAudioInput, MediaAudioResult, MediaImageInput, MediaImageResult, MediaVideoInput, MediaVideoResult } from "@lfaa/llm";
import mediaToolsPlugin, { buildMediaFileUrl, createMediaGenerateHttpHandler, findSessionImagePath, mediaMetadataPath } from "../src/index";
import { isRefinementPrompt } from "../src/media-direct";
import { PNG_1X1, fakeReq, fakeRes } from "./media-helpers";

/** 假模型服务：记录入参并返回一张 1x1 PNG / 一个可下载的视频地址。 */
class FakeLlm extends Service {
  readonly calls: MediaImageInput[] = [];
  readonly videoCalls: MediaVideoInput[] = [];
  constructor(ctx: Context) {
    super(ctx, "llm");
  }
  async generateImage(input: MediaImageInput): Promise<MediaImageResult> {
    this.calls.push(input);
    return {
      model: "wan2.7-image",
      images: [{ b64: PNG_1X1, mime: "image/png" }],
      elapsedMs: 12,
    };
  }
  async generateVideo(input: MediaVideoInput): Promise<MediaVideoResult> {
    this.videoCalls.push(input);
    return { model: "wan3.0-video", taskId: "task-1", status: "SUCCEEDED", videoUrl: "https://example.com/v.mp4", elapsedMs: 5 };
  }
  async getVideoTask(input: { taskId: string }): Promise<MediaVideoResult> {
    return { model: "wan3.0-video", taskId: input.taskId, status: "SUCCEEDED", videoUrl: "https://example.com/v.mp4", elapsedMs: 0 };
  }
  readonly audioCalls: MediaAudioInput[] = [];
  async generateAudio(input: MediaAudioInput): Promise<MediaAudioResult> {
    this.audioCalls.push(input);
    return { model: "qwen-audio-3.0-tts-plus", audioUrl: "https://example.com/a.mp3", mime: "audio/mpeg", characters: input.text.length, elapsedMs: 9 };
  }
}

function execContext(workspaceRoot: string): ToolExecutionContext {
  return { workspaceRoots: [workspaceRoot], sessionId: "s1", runId: "r1", signal: new AbortController().signal };
}

test("generate_image 生成图片并保存到工作区，参数完整透传", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lfaa-media-"));
  try {
    const ctx = new Context();
    await ctx.plugin(toolsPlugin, { includeBuiltins: false });
    await ctx.plugin((inner: Context) => { new FakeLlm(inner); });
    await ctx.plugin(mediaToolsPlugin);

    const result = await ctx.tools.executeTool("generate_image", {
      prompt: "海边日落，电影感",
      size: "1024x1024",
      n: 1,
      style: "cinematic",
      referenceImages: ["C:\\data\\ref.png"],
    }, execContext(dir));
    assert.equal(result.ok, true);
    const files = (result.metadata?.files ?? []) as string[];
    assert.equal(files.length, 1);
    const bytes = await readFile(files[0]!);
    assert.ok(bytes.length > 0);
    assert.match(files[0]!, /\.lfaa-media[\\/]images[\\/].+\.png$/u);
    assert.match(result.output, /^图片生成完成了（1:1 · .+ · 耗时 \d+ 秒）。/u);
    // 聊天正文只保留说明与图片，不再把绝对路径或文件名列表写进消息。
    assert.doesNotMatch(result.output, /本地文件：/u);
    assert.doesNotMatch(result.output, /[A-Za-z]:\\/u);
    assert.match(result.output, /!\[[^\]]+\]\(\/api\/media\/file\?path=/u);

    const fake = ctx.get("llm") as unknown as FakeLlm;
    assert.equal(fake.calls.length, 1);
    assert.equal(fake.calls[0]?.prompt, "海边日落，电影感");
    assert.equal(fake.calls[0]?.size, "1024x1024");
    assert.equal(fake.calls[0]?.style, "cinematic");
    assert.deepEqual(fake.calls[0]?.referenceImages, ["C:\\data\\ref.png"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("prompt 指定 9:16 时按该比例请求尺寸并补构图提示，未指定则不强制尺寸", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lfaa-media-ratio-"));
  try {
    const ctx = new Context();
    await ctx.plugin(toolsPlugin, { includeBuiltins: false });
    await ctx.plugin((inner: Context) => { new FakeLlm(inner); });
    await ctx.plugin(mediaToolsPlugin);

    const portrait = await ctx.tools.executeTool("generate_image", {
      prompt: "生成一位美少女肖像，9:16 竖版构图，柔和日光",
      size: "1024x1024",
    }, execContext(dir));
    assert.equal(portrait.ok, true);
    const fake = ctx.get("llm") as unknown as FakeLlm;
    // 用户明确要求 9:16 时，Agent 传入的方形尺寸不能覆盖它。
    assert.equal(fake.calls[0]?.size, "1152x2048");
    assert.match(fake.calls[0]?.prompt ?? "", /【画面比例】必须为 9:16/u);
    assert.match(portrait.output, /^图片生成完成了（9:16 · /u);

    const plain = await ctx.tools.executeTool("generate_image", {
      prompt: "一位清爽自然的美少女肖像",
    }, execContext(dir));
    assert.equal(plain.ok, true);
    assert.equal(fake.calls[1]?.size, "2048x2048");
    assert.doesNotMatch(fake.calls[1]?.prompt ?? "", /【画面比例】/u);
    assert.match(plain.output, /^图片生成完成了（1:1 · /u);

    // 输入栏选定的比例同样生效（页面上的比例选择器走 ratio 参数）。
    const picked = await ctx.tools.executeTool("generate_image", {
      prompt: "城市夜景",
      ratio: "16:9",
    }, execContext(dir));
    assert.equal(picked.ok, true);
    assert.equal(fake.calls[2]?.size, "2048x1152");
    assert.match(fake.calls[2]?.prompt ?? "", /【画面比例】必须为 16:9/u);
    assert.match(picked.output, /^图片生成完成了（16:9 · /u);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("缺少提示词时返回可读错误且不调用模型", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lfaa-media-"));
  try {
    const ctx = new Context();
    await ctx.plugin(toolsPlugin, { includeBuiltins: false });
    await ctx.plugin((inner: Context) => { new FakeLlm(inner); });
    await ctx.plugin(mediaToolsPlugin);
    const result = await ctx.tools.executeTool("generate_image", { prompt: "   " }, execContext(dir));
    assert.equal(result.ok, false);
    assert.match(result.output, /缺少生图提示词/u);
    assert.equal((ctx.get("llm") as unknown as FakeLlm).calls.length, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("generate_video 与 get_video：提交任务、下载视频并落盘到工作区", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "lfaa-media-video-"));
  const fetchMock = t.mock.method(globalThis, "fetch", async () => new Response(Buffer.from("fake-mp4-bytes"), {
    status: 200,
    headers: { "content-type": "video/mp4" },
  }));
  try {
    const ctx = new Context();
    await ctx.plugin(toolsPlugin, { includeBuiltins: false });
    await ctx.plugin((inner: Context) => { new FakeLlm(inner); });
    await ctx.plugin(mediaToolsPlugin);

    const generated = await ctx.tools.executeTool("generate_video", {
      prompt: "海边日落，镜头缓慢推进",
      duration: 2,
      resolution: "720P",
      ratio: "16:9",
    }, execContext(dir));
    assert.equal(generated.ok, true);
    const files = (generated.metadata?.files ?? []) as string[];
    assert.equal(files.length, 1);
    assert.match(files[0]!, /\.lfaa-media[\\/]videos[\\/].+\.mp4$/u);
    assert.ok((await readFile(files[0]!)).length > 0);
    assert.match(generated.output, /^已用 .+ 生成视频（耗时 \d+ 秒）。\n\n!\[[^\]]+\]\(\/api\/media\/file\?path=/u);
    assert.doesNotMatch(generated.output, /本地文件：/u);
    assert.equal((ctx.get("llm") as unknown as FakeLlm).videoCalls.length, 1);

    const queried = await ctx.tools.executeTool("get_video", { taskId: "task-1" }, execContext(dir));
    assert.equal(queried.ok, true);
    assert.match(queried.output, /视频已就绪/u);
    assert.ok(fetchMock.mock.callCount() >= 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("generate_speech：合成语音、下载并落盘到工作区", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "lfaa-media-audio-"));
  t.mock.method(globalThis, "fetch", async () => new Response(Buffer.from("fake-mp3-bytes"), {
    status: 200,
    headers: { "content-type": "audio/mpeg" },
  }));
  try {
    const ctx = new Context();
    await ctx.plugin(toolsPlugin, { includeBuiltins: false });
    await ctx.plugin((inner: Context) => { new FakeLlm(inner); });
    await ctx.plugin(mediaToolsPlugin);
    const result = await ctx.tools.executeTool("generate_speech", {
      text: "你好，这是 LFAA 的语音测试。",
      voice: "Cherry",
    }, execContext(dir));
    assert.equal(result.ok, true);
    const files = (result.metadata?.files ?? []) as string[];
    assert.equal(files.length, 1);
    assert.match(files[0]!, /\.lfaa-media[\\/]audio[\\/].+\.mp3$/u);
    assert.ok((await readFile(files[0]!)).length > 0);
    assert.match(result.output, /生成语音/u);
    assert.equal((ctx.get("llm") as unknown as FakeLlm).audioCalls.length, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("媒体直连接口：选中生图模型时直接生成并写入会话消息", async () => {
  const appended: Array<{ id: string; role: string; content: string }> = [];
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const handler = createMediaGenerateHttpHandler({
    executeTool: async (name, args) => {
      calls.push({ name, args });
      return { ok: true, output: "已生成 1 张图片。\n![生成图片](/api/media/file?path=a.png)", summary: "1 张图片", metadata: { files: ["a.png"] } };
    },
    resolveWorkspaceRoots: async () => ["C:\\ws"],
    getSessionProjectId: async () => "p1",
    appendMessage: async (_id, message) => { appended.push(message); },
  });
  const body = Buffer.from(JSON.stringify({ sessionId: "s1", kind: "image", prompt: "海边日落", style: "cinematic" }));
  const req = {
    url: "/api/media/generate",
    method: "POST",
    async *[Symbol.asyncIterator]() { yield body; },
  } as unknown as IncomingMessage;
  const { res, captured } = fakeRes();
  assert.equal(await handler(req, res), true);
  assert.equal(captured.status, 200);
  const payload = JSON.parse(captured.body.toString("utf8")) as { ok: boolean; files: string[] };
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.files, ["a.png"]);
  assert.equal(appended.length, 2);
  assert.equal(appended[0]?.role, "user");
  assert.equal(appended[1]?.role, "assistant");
  assert.deepEqual(calls[0], { name: "generate_image", args: { prompt: "海边日落", style: "cinematic" } });
});

test("生图直连先扩写提示词：工具用扩写版，用户消息保留原话，助手消息带计划句", async () => {
  const appended: Array<{ role: string; content: string }> = [];
  const calls: Array<Record<string, unknown>> = [];
  let enhancementInput: { ratio: string; style?: string | undefined } | undefined;
  const handler = createMediaGenerateHttpHandler({
    executeTool: async (_name, args) => {
      calls.push(args);
      return { ok: true, output: "图片生成完成了（9:16 · wan2.7-image · 耗时 12 秒）。\n\n![生成图片](/api/media/file?path=a.png)", summary: "1 张图片", metadata: { files: ["a.png"] } };
    },
    resolveWorkspaceRoots: async () => ["C:\\ws"],
    getSessionProjectId: async () => "p1",
    appendMessage: async (_id, message) => { appended.push(message); },
    enhanceImagePrompt: async (prompt, options) => {
      enhancementInput = options;
      return { plan: "我会生成一位清爽自然的美少女肖像。", prompt: `${prompt}；85mm 人像镜头，浅景深，柔和侧光` };
    },
  });
  const body = Buffer.from(JSON.stringify({ sessionId: "s1", kind: "image", prompt: "生成一位美少女肖像，9:16 竖版构图", style: "cinematic", modelId: "wan2.7-image" }));
  const req = { url: "/api/media/generate", method: "POST", async *[Symbol.asyncIterator]() { yield body; } } as unknown as IncomingMessage;
  const { res } = fakeRes();
  assert.equal(await handler(req, res), true);

  assert.match(String(calls[0]?.prompt), /85mm 人像镜头/u);
  assert.equal(calls[0]?.ratio, "9:16");
  assert.equal(calls[0]?.style, "cinematic");
  assert.equal(enhancementInput?.ratio, "9:16");
  assert.equal(enhancementInput?.style, "cinematic");
  assert.equal(appended[0]?.content, "生成一位美少女肖像，9:16 竖版构图");
  assert.match(appended[1]?.content ?? "", /^我会生成一位清爽自然的美少女肖像。\n\n图片生成完成了（9:16/u);
});

test("扩写失败时回退原提示词，不写计划句", async () => {
  const appended: Array<{ role: string; content: string }> = [];
  const calls: Array<Record<string, unknown>> = [];
  const handler = createMediaGenerateHttpHandler({
    executeTool: async (_name, args) => {
      calls.push(args);
      return { ok: true, output: "图片生成完成了（1:1 · wan2.7-image · 耗时 9 秒）。", summary: "1 张图片", metadata: { files: ["a.png"] } };
    },
    resolveWorkspaceRoots: async () => ["C:\\ws"],
    getSessionProjectId: async () => "p1",
    appendMessage: async (_id, message) => { appended.push(message); },
    enhanceImagePrompt: async () => null,
  });
  const body = Buffer.from(JSON.stringify({ sessionId: "s1", kind: "image", prompt: "一只白色咖啡杯" }));
  const req = { url: "/api/media/generate", method: "POST", async *[Symbol.asyncIterator]() { yield body; } } as unknown as IncomingMessage;
  await handler(req, fakeRes().res);
  assert.equal(calls[0]?.prompt, "一只白色咖啡杯");
  assert.equal(calls[0]?.ratio, undefined);
  assert.equal(appended[1]?.content, "图片生成完成了（1:1 · wan2.7-image · 耗时 9 秒）。");
});

test("媒体直连：迭代指令自动带上一张图作参考，普通指令不带；附件图片也作为参考", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const handler = createMediaGenerateHttpHandler({
    executeTool: async (_name, args) => {
      calls.push(args);
      return { ok: true, output: "已生成 1 张图片。\n![生成图片](/api/media/file?path=a.png)", summary: "1 张图片", metadata: { files: ["a.png"] } };
    },
    resolveWorkspaceRoots: async () => ["C:\\ws"],
    getSessionProjectId: async () => "p1",
    appendMessage: async () => {},
    findLastMediaPath: async () => "C:\\ws\\.lfaa-media\\images\\prev.png",
    resolveAttachmentImages: async () => ["data:image/png;base64,AAA"],
  });
  const call = async (payload: Record<string, unknown>) => {
    calls.length = 0;
    const body = Buffer.from(JSON.stringify(payload));
    const req = { url: "/api/media/generate", method: "POST", async *[Symbol.asyncIterator]() { yield body; } } as unknown as IncomingMessage;
    const { res } = fakeRes();
    await handler(req, res);
    return calls[0]!;
  };

  assert.equal(isRefinementPrompt("再亮一点"), true);
  assert.equal(isRefinementPrompt("太丑了，苗条一些，模特"), true);
  assert.equal(isRefinementPrompt("苗条一些，要模特身材"), true);
  assert.equal(isRefinementPrompt("海边日落海报"), false);
  assert.deepEqual(await call({ sessionId: "s1", kind: "image", prompt: "再亮一点" }), {
    prompt: "再亮一点",
    referenceImages: ["C:\\ws\\.lfaa-media\\images\\prev.png"],
  });
  assert.deepEqual(await call({ sessionId: "s1", kind: "image", prompt: "海边日落海报" }), { prompt: "海边日落海报" });
  assert.deepEqual(await call({ sessionId: "s1", kind: "image", prompt: "海边日落海报", ratio: "16:9" }), {
    prompt: "海边日落海报",
    ratio: "16:9",
  });
  assert.deepEqual(await call({ sessionId: "s1", kind: "image", prompt: "参考这张改成水彩", attachmentIds: ["att-1"] }), {
    prompt: "参考这张改成水彩",
    referenceImages: ["data:image/png;base64,AAA"],
    replayAttachmentIds: ["att-1"],
  });
});

test("媒体直连会把用于生图的用户附件保留在用户消息中", async () => {
  const appended: unknown[] = [];
  const calls: Array<Record<string, unknown>> = [];
  const handler = createMediaGenerateHttpHandler({
    executeTool: async (_name, args) => {
      calls.push(args);
      return { ok: true, output: "已生成图片。", summary: "完成" };
    },
    resolveWorkspaceRoots: async () => ["C:\\ws"],
    getSessionProjectId: async () => "p1",
    resolveAttachmentImages: async (_sessionId, ids) => ids.map(() => "data:image/png;base64,AA=="),
    appendMessage: async (_sessionId, message) => { appended.push(message); },
  });
  const body = Buffer.from(JSON.stringify({
    sessionId: "s1",
    kind: "image",
    prompt: "美化一下图片",
    attachmentIds: ["source-image-id"],
  }));
  const req = {
    url: "/api/media/generate",
    method: "POST",
    async *[Symbol.asyncIterator]() { yield body; },
  } as unknown as IncomingMessage;
  const { res, captured } = fakeRes();

  await handler(req, res);

  assert.equal(captured.status, 200);
  assert.deepEqual(calls[0]?.referenceImages, ["data:image/png;base64,AA=="]);
  assert.deepEqual((appended[0] as { attachments?: unknown[] } | undefined)?.attachments, [
    { id: "source-image-id", kind: "image" },
  ]);
});

test("引用会话图片后直连改图：参考文件传入生成工具，并写回用户消息", async () => {
  const sourcePath = "C:\\ws\\.lfaa-media\\images\\source.png";
  const calls: Array<Record<string, unknown>> = [];
  const appended: Array<{ attachments?: unknown[]; references?: unknown[] }> = [];
  const handler = createMediaGenerateHttpHandler({
    resolveImageSource: async (_sessionId, source) => source.messageId === "image-message" && source.path === sourcePath
      ? sourcePath : undefined,
    executeTool: async (_name, args) => {
      calls.push(args);
      return { ok: true, output: "已完成改图。", summary: "改图成功" };
    },
    resolveWorkspaceRoots: async () => ["C:\\ws"],
    getSessionProjectId: async () => "p1",
    appendMessage: async (_id, message) => { appended.push(message); },
  });
  const body = Buffer.from(JSON.stringify({
    sessionId: "s1",
    kind: "image",
    prompt: "太丑了，苗条一些，要模特身材",
    referenceSources: [{ messageId: "image-message", path: sourcePath }],
  }));
  const request = { url: "/api/media/generate", method: "POST", async *[Symbol.asyncIterator]() { yield body; } } as unknown as IncomingMessage;
  const { res, captured } = fakeRes();
  await handler(request, res);
  assert.equal(captured.status, 200);
  assert.deepEqual(calls[0], {
    prompt: "太丑了，苗条一些，要模特身材",
    referenceImages: [sourcePath],
  });
  // 引用图必须留在用户消息里，否则刷新后用户气泡里看不到「当时引用的那张」。
  assert.deepEqual(appended[0]?.references, [{ messageId: "image-message", path: sourcePath }]);
  assert.equal(appended[0]?.attachments, undefined);
});

test("再次生图只能使用当前会话产物，重放原模型和图片附件", async () => {
  const root = await mkdtemp(join(tmpdir(), "lfaa-media-replay-"));
  try {
    const images = join(root, ".lfaa-media", "images");
    await mkdir(images, { recursive: true });
    const file = join(images, "original.png");
    await writeFile(file, Buffer.from(PNG_1X1, "base64"));
    await writeFile(mediaMetadataPath(file), JSON.stringify({
      kind: "image", model: "wan2.7-image", prompt: "海洋", style: "photo", referenceImages: 1,
      replay: { profileId: "token-plan", attachmentIds: ["reference"] },
    }));
    const content = `![海洋](${buildMediaFileUrl(file)})`;
    const calls: Record<string, unknown>[] = [];
    const handler = createMediaGenerateHttpHandler({
      resolveImageSource: async (session, source) => session === "s1" && source.messageId === "m1"
        ? findSessionImagePath(content, [root], source.path) : undefined,
      resolveAttachmentImages: async () => ["data:image/png;base64,AAA"],
      executeTool: async (_name, args) => { calls.push(args); return { ok: true, output: content, summary: "done" }; },
      resolveWorkspaceRoots: async () => [root],
      getSessionProjectId: async () => null,
      appendMessage: async () => {},
    });
    const source = { messageId: "m1", path: file };
    const recipe = fakeRes();
    await handler(fakeReq(`/api/media/recipe?${new URLSearchParams({ sessionId: "s1", ...source })}`), recipe.res);
    assert.deepEqual(JSON.parse(recipe.captured.body.toString()), { canRegenerate: true });
    for (const sessionId of ["other", "s1"]) {
      const body = Buffer.from(JSON.stringify({ sessionId, regenerate: source, prompt: "不应替换原提示词" }));
      const request = { ...fakeReq("/api/media/generate", "POST"), async *[Symbol.asyncIterator]() { yield body; } } as IncomingMessage;
      const { res, captured } = fakeRes();
      await handler(request, res);
      assert.equal(captured.status, sessionId === "s1" ? 200 : 400);
    }
    assert.deepEqual(calls, [{ prompt: "海洋", modelId: "wan2.7-image", profileId: "token-plan", style: "photo",
      referenceImages: ["data:image/png;base64,AAA"], replayAttachmentIds: ["reference"] }]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
