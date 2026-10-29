/**
 * 功能：验证共享 Canvas adapter 映射 AI Video Owner 的节点和布局。
 * 作用：确保聊天与画布继续使用相同项目 ID，节点编辑可无损回到领域项目合同。
 * 关联文件：packages/client/ui-workspace/src/ai-video-canvas-adapter.ts、packages/video/ai-video/src/index.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const { aiVideoCanvasToProject, aiVideoProjectToInput } = await import("lfaa-client-ui-workspace/src/ai-video-canvas-adapter.ts");
const { normalizeAiVideoCanvasInput } = await import("lfaa-video-ai-video/src/index.js");

test("AI 漫剧共享画布按领域节点显示并无损保存回相同 Owner 项目", () => {
  const projectId = randomUUID();
  const referenceId = randomUUID();
  const shotId = randomUUID();
  const assetId = randomUUID();
  const timestamp = "2026-10-28T08:00:00.000Z";
  const canvas = {
    id: projectId, title: "漫剧项目", script: "第一幕", characters: [{ id: referenceId, name: "阿青", description: "短发" }], locations: [],
    shots: [{ id: shotId, title: "夜路", description: "路灯下", dialogue: "你好", durationSeconds: 5, x: 240, y: 60, characterIds: [referenceId] }],
    links: [], mediaAssets: [{ assetId, name: "街灯.png", mimeType: "image/png", bytes: 512, createdAt: timestamp, origin: "generated" }],
    timelineClips: [{ id: randomUUID(), track: "subtitle", text: "你好", startSeconds: 0, inPointSeconds: 0, durationSeconds: 2 }],
    whiteModel: { items: [], camera: { x: 0, y: 1.6, z: -8, yaw: 0, pitch: -4, focalLength: 50 }, ratio: "16:9" },
    canvasLayout: { viewport: { x: -120, y: 20, zoom: 1.2 }, nodePositions: { script: { x: -180, y: -360 }, [`character:${referenceId}`]: { x: -680, y: 80 }, [`asset:${assetId}`]: { x: 500, y: 120 }, timeline: { x: 680, y: -360 }, director: { x: 680, y: 220 } } },
    createdAt: timestamp, updatedAt: timestamp
  };
  const project = aiVideoCanvasToProject(canvas);
  assert.equal(project.id, projectId);
  assert.equal(project.applicationId, "aivideo");
  assert.deepEqual(new Set(project.nodes.map(node => node.type)), new Set(["script", "aivideo-reference", "shot", "asset", "aivideo-timeline", "aivideo-director"]));
  const normalized = normalizeAiVideoCanvasInput(aiVideoProjectToInput(project));
  assert.equal(normalized.title, canvas.title);
  assert.equal(normalized.script, canvas.script);
  assert.equal(normalized.shots[0].id, shotId);
  assert.deepEqual(normalized.timelineClips, canvas.timelineClips);
  assert.deepEqual(normalized.canvasLayout, canvas.canvasLayout);
});
