// 验证画布连线端口、版本固定和快照拒绝规则。
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { CanvasAsset, CanvasBoard, CanvasNode } from "../contract/index";
import { snapshotRun } from "../src/canvas-runner";
import { validateGraph } from "../src/graph";

const asset: CanvasAsset = { id: randomUUID(), kind: "image", name: "A", mime: "image/png" };
const alternate: CanvasAsset = { ...asset, id: randomUUID(), name: "B" };
const source: CanvasNode = { id: randomUUID(), kind: "asset", position: { x: 0, y: 0 }, settings: { assetId: alternate.id } };
const video: CanvasNode = {
  id: randomUUID(), kind: "video", position: { x: 200, y: 0 },
  settings: { mode: "frames", modelId: "doubao-seedance-2.0", profileId: "test", prompt: "慢慢向前" },
};
const edge = { id: randomUUID(), source: source.id, sourcePort: "asset", target: video.id, targetPort: "first", assetId: asset.id };
const board: CanvasBoard = {
  schemaVersion: 1, projectId: "project", canvasId: randomUUID(), title: "Storyboard",
  revision: 1, nodes: [source, video], edges: [edge], viewport: { x: 0, y: 0, zoom: 1 },
};
const { nodes, edges, viewport } = board;

test("图生视频固定原首帧版本，更新源节点不会改写运行快照", () => {
  assert.deepEqual(validateGraph({ nodes, edges, viewport }, [asset, alternate]).edges, [edge]);
  assert.deepEqual(snapshotRun(board, randomUUID(), video.id).inputs, { first: asset.id });
  assert.throws(() => snapshotRun({ ...board, edges: [] }, randomUUID(), video.id), /Connect a first frame/);
});

test("禁止跨画布素材、重复输入和模式外端口", () => {
  assert.throws(() => validateGraph({ nodes, edges, viewport }, [alternate]), /Invalid connection/);
  assert.throws(() => validateGraph({ nodes, edges: [edge, { ...edge, id: randomUUID() }], viewport }, [asset, alternate]), /Invalid connection/);
  const reference = { ...video, settings: { ...video.settings, mode: "reference" } };
  assert.throws(() => validateGraph({ nodes: [source, reference], edges, viewport }, [asset, alternate]), /Invalid connection/);
});

test("拒绝两个生图节点互相引用构成的环", () => {
  const imageA = { ...source, kind: "image", settings: { resultId: asset.id } };
  const imageB = { ...video, kind: "image", settings: { resultId: alternate.id } };
  const cycle = [
    { ...edge, sourcePort: "image", targetPort: "character" },
    { ...edge, id: randomUUID(), source: imageB.id, target: imageA.id, sourcePort: "image", targetPort: "character", assetId: alternate.id },
  ];
  assert.throws(() => validateGraph({ nodes: [imageA, imageB], edges: cycle, viewport }, [asset, alternate]), /Cyclic connection/);
});
