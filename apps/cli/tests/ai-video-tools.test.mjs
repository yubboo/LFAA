/**
 * 功能：验证 AI 漫剧 Agent 工具只读写 AI Video Owner 的共享项目合同。
 * 作用：覆盖 app-scoped 工具、素材/时间线/导演台/画布布局读取，以及并发版本更新，不连接 Provider。
 * 关联文件：packages/video/tool-ai-video/src/index.ts、packages/video/ai-video/src/index.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const { createAiVideoTools } = await import("lfaa-video-tool-ai-video/src/index.ts");

test("AI 漫剧 Agent 通过同一 Owner 读取和保存画布领域数据", async () => {
  const projectId = randomUUID();
  const assetId = randomUUID();
  const updatedAt = "2026-10-28T08:00:00.000Z";
  const project = {
    id: projectId, title: "漫剧项目", script: "开场", characters: [], locations: [], shots: [], links: [],
    mediaAssets: [{ assetId, name: "街景.png", mimeType: "image/png", bytes: 512, createdAt: updatedAt, origin: "generated" }],
    timelineClips: [], whiteModel: { items: [], camera: { x: 0, y: 1.6, z: -8, yaw: 0, pitch: -4, focalLength: 50 }, ratio: "16:9" },
    canvasLayout: { viewport: { x: 0, y: 0, zoom: 1 }, nodePositions: {} }, createdAt: updatedAt, updatedAt
  };
  let savedInput;
  const service = {
    list: () => [project],
    listMediaAssets: () => [{ ...project.mediaAssets[0], available: true }],
    update: (_userId, _projectId, expected, input) => {
      assert.equal(expected, updatedAt);
      savedInput = input;
      return { ...project, ...input, updatedAt: "2026-10-28T08:01:00.000Z" };
    }
  };
  const tools = createAiVideoTools(service);
  assert.ok(tools.length > 0);
  for (const tool of tools) assert.deepEqual(tool.applicationIds, ["aivideo"]);
  const read = tools.find(tool => tool.name === "aivideo_read_project");
  const update = tools.find(tool => tool.name === "aivideo_update_project");
  const context = { userId: "aivideo-tool-account", signal: new AbortController().signal, onProgress() {} };

  const assets = await read.execute(read.parse({ projectId, section: "assets" }), context);
  assert.equal(assets.items[0].assetId, assetId);
  assert.equal(assets.items[0].available, true);
  const director = await read.execute(read.parse({ projectId, section: "director" }), context);
  assert.deepEqual(director.whiteModel, project.whiteModel);
  assert.deepEqual(director.canvasLayout, project.canvasLayout);

  const timelineClips = [{ id: randomUUID(), track: "subtitle", text: "你好", startSeconds: 0, inPointSeconds: 0, durationSeconds: 3 }];
  const canvasLayout = { viewport: { x: -120, y: 40, zoom: 1.2 }, nodePositions: { [`asset:${assetId}`]: { x: 200, y: 160 } } };
  const result = await update.execute(update.parse({ projectId, expectedUpdatedAt: updatedAt, timelineClips, canvasLayout }), context);
  assert.equal(result.saved, true);
  assert.deepEqual(savedInput.timelineClips, timelineClips);
  assert.deepEqual(savedInput.canvasLayout, canvasLayout);
});
