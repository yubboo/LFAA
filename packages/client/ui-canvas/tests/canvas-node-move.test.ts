// 无限画布节点移动回归测试：在 Node.js 校验多选落点和无变化的拖动事件。
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CanvasGraph } from "@lfaa/canvas/contract";
import { moveCanvasNodes } from "../client/canvas/canvas-graph-helpers";

const graph: CanvasGraph = {
  viewport: { x: 120, y: 80, zoom: 0.75 },
  nodes: [
    { id: "prompt", kind: "prompt", position: { x: 0, y: 10 }, settings: { prompt: "分镜" } },
    { id: "image", kind: "image", position: { x: 300, y: 10 }, settings: {} },
  ],
  edges: [{ id: "edge", source: "prompt", target: "image", sourcePort: "text", targetPort: "prompt" }],
};

describe("画布节点移动", () => {
  it("一次合并多选节点的落点，保留可供撤销的旧文档", () => {
    const next = moveCanvasNodes(graph, new Map([
      ["prompt", { x: 80, y: 40 }],
      ["image", { x: 380, y: 40 }],
    ]));
    assert.deepEqual(next.nodes.map(({ position }) => position), [{ x: 80, y: 40 }, { x: 380, y: 40 }]);
    assert.deepEqual(graph.nodes.map(({ position }) => position), [{ x: 0, y: 10 }, { x: 300, y: 10 }]);
    assert.equal(next.nodes[0]?.settings, graph.nodes[0]?.settings);
    assert.equal(next.edges, graph.edges);
    assert.equal(next.viewport, graph.viewport);
  });

  it("位置未移动或节点已删除时保留原对象，可跳过撤销记录和保存", () => {
    assert.equal(moveCanvasNodes(graph, new Map([
      ["prompt", { x: 0, y: 10 }],
      ["removed", { x: 20, y: 20 }],
    ])), graph);
  });
});
