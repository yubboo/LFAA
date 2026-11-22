// 验证视频直连：时长解析、指令清理、导演扩写与 NDJSON 计划事件。
import assert from "node:assert/strict";
import test from "node:test";
import { createMediaGenerateHttpHandler } from "../src/index";
import { fakeBodyReq, fakeRes } from "./media-helpers";

test("生视频直连：解析五秒、清理指令并交给视频提示词导演", async () => {
  const appended: Array<{ role: string; content: string }> = [];
  const calls: Array<Record<string, unknown>> = [];
  let enhancement: { prompt: string; duration: number; ratio: string } | undefined;
  const handler = createMediaGenerateHttpHandler({
    executeTool: async (_name, args) => {
      calls.push(args);
      return { ok: true, output: "已用 happyhorse-1.1-t2v 生成视频（耗时 72 秒）。", summary: "1 个视频", metadata: { files: ["v.mp4"] } };
    },
    resolveWorkspaceRoots: async () => ["C:\\ws"],
    getSessionProjectId: async () => "p1",
    appendMessage: async (_id, message) => { appended.push(message); },
    enhanceVideoPrompt: async (prompt, options) => {
      enhancement = { prompt, duration: options.duration, ratio: options.ratio };
      return { plan: "我会生成雨窗边低饱和的忧郁少女。", prompt: "窗边忧郁少女，窗外雨幕与玻璃雨痕，低饱和冷色调，镜头缓慢推近" };
    },
  });
  const raw = "帮我生成一个，忧郁美少女趴在窗户，看看窗外，外面下雨，氛围感的五秒视频";
  const req = fakeBodyReq("/api/media/generate", JSON.stringify({ sessionId: "s1", kind: "video", prompt: raw, modelId: "happyhorse-1.1-r2v", profileId: "qwen" }));
  assert.equal(await handler(req, fakeRes().res), true);

  assert.deepEqual(enhancement, { prompt: "忧郁美少女趴在窗户，看看窗外，外面下雨，氛围感", duration: 5, ratio: "16:9" });
  assert.equal(calls[0]?.prompt, "窗边忧郁少女，窗外雨幕与玻璃雨痕，低饱和冷色调，镜头缓慢推近");
  assert.equal(calls[0]?.duration, 5);
  assert.equal(calls[0]?.ratio, "16:9");
  assert.equal(calls[0]?.resolution, "720P");
  assert.equal(calls[0]?.modelId, "happyhorse-1.1-r2v");
  assert.equal(appended[0]?.content, raw);
  assert.match(appended[1]?.content ?? "", /^我会生成雨窗边低饱和的忧郁少女。\n\n已用 happyhorse-1.1-t2v/u);
});

test("视频扩写失败时使用清理后的描述，不再带指令词与“五秒视频”", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const handler = createMediaGenerateHttpHandler({
    executeTool: async (_name, args) => {
      calls.push(args);
      return { ok: true, output: "已生成视频", summary: "1 个视频" };
    },
    resolveWorkspaceRoots: async () => ["C:\\ws"],
    getSessionProjectId: async () => "p1",
    appendMessage: async () => {},
    enhanceVideoPrompt: async () => null,
  });
  const req = fakeBodyReq("/api/media/generate", JSON.stringify({ sessionId: "s1", kind: "video", prompt: "帮我生成一个，窗外下雨的少女，五秒视频" }));
  await handler(req, fakeRes().res);
  assert.equal(calls[0]?.prompt, "窗外下雨的少女");
  assert.equal(calls[0]?.duration, 5);
});

test("视频直连 NDJSON：先推送计划句，再推送最终结果", async () => {
  const handler = createMediaGenerateHttpHandler({
    executeTool: async () => ({ ok: true, output: "已生成视频", summary: "1 个视频" }),
    resolveWorkspaceRoots: async () => ["C:\\ws"],
    getSessionProjectId: async () => "p1",
    appendMessage: async () => {},
    enhanceVideoPrompt: async () => ({ plan: "我会生成雨窗边安静忧郁的少女。", prompt: "雨窗边少女，窗外雨幕" }),
  });
  const { res, captured } = fakeRes();
  const req = fakeBodyReq("/api/media/generate", JSON.stringify({
    sessionId: "s1",
    kind: "video",
    prompt: "窗外下雨的少女，五秒视频",
    modelId: "happyhorse-1.1-r2v",
  }), "POST", { accept: "application/x-ndjson" });
  await handler(req, res);
  assert.equal(captured.headers["content-type"], "application/x-ndjson; charset=utf-8");
  const events = captured.body.toString("utf8").trim().split("\n").map((line) => JSON.parse(line) as { type: string; plan?: string; ok?: boolean });
  assert.deepEqual(events.map((event) => event.type), ["plan", "done"]);
  assert.equal(events[0]?.plan, "我会生成雨窗边安静忧郁的少女。");
  assert.equal(events[1]?.ok, true);
});