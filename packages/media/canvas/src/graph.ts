// Host 校验画布文档、端口和素材版本，拒绝跨项目引用与循环。
import { inputPorts, outputPorts, type CanvasAsset, type CanvasGraph } from "../contract/index";
import { z } from "zod";

export const uuid = z.uuid();
const number = z.number().min(-100000).max(100000);
const vector = z.tuple([number, number, number]);
const time = z.number().min(0).max(15);
const scene = z.strictObject({
  duration: z.number().min(1).max(15),
  ratio: z.enum(["16:9", "9:16"]),
  objects: z.array(z.strictObject({
    id: uuid, kind: z.enum(["actor", "box", "sphere"]), position: vector, rotation: number,
    keys: z.array(z.strictObject({ time, position: vector })).max(64),
  })).max(24),
  camera: z.array(z.strictObject({ time, position: vector, target: vector })).min(1).max(64),
});

const graph = z.strictObject({
  viewport: z.strictObject({ x: number, y: number, zoom: z.number().min(0.05).max(6) }),
  nodes: z.array(z.strictObject({
    id: uuid, kind: z.enum(["prompt", "asset", "previs", "image", "video"]),
    position: z.strictObject({ x: number, y: number }),
    settings: z.strictObject({
      prompt: z.string().max(12000).optional(),
      profileId: z.string().min(1).max(180).optional(),
      modelId: z.string().min(1).max(180).optional(),
      ratio: z.enum(["1:1", "16:9", "9:16", "4:3", "3:4"]).optional(),
      resolution: z.enum(["480p", "720p", "1080p"]).optional(),
      seed: z.number().int().min(0).max(2147483647).optional(),
      duration: z.number().int().min(2).max(15).optional(),
      mode: z.enum(["text", "frames", "reference"]).optional(),
      scene: scene.optional(),
      assetId: uuid.optional(), imageId: uuid.optional(), videoId: uuid.optional(), resultId: uuid.optional(),
    }),
  })).max(300),
  edges: z.array(z.strictObject({
    id: uuid, source: uuid, target: uuid, sourcePort: z.string(), targetPort: z.string(), assetId: uuid.optional(),
  })).max(900),
});

export class CanvasError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** 画布保存与运行都在宿主重新校验。 */
export function validateGraph(input: unknown, assets: readonly CanvasAsset[]): CanvasGraph {
  const parsed = graph.safeParse(input);
  if (!parsed.success) throw new CanvasError(400, "画布数据格式无效 / Invalid canvas document");
  const value = parsed.data as CanvasGraph;
  const nodes = new Map(value.nodes.map((node) => [node.id, node]));
  if (nodes.size !== value.nodes.length) throw new CanvasError(400, "画布节点重复 / Duplicate node");
  const assetKinds = new Map(assets.map((asset) => [asset.id, asset.kind]));
  for (const node of value.nodes) {
    const { assetId, imageId, videoId, resultId } = node.settings;
    if ((assetId && !assetKinds.has(assetId)) || (imageId && assetKinds.get(imageId) !== "image") ||
      (videoId && assetKinds.get(videoId) !== "video") || (resultId && assetKinds.get(resultId) !== node.kind)) {
      throw new CanvasError(400, "项目画布中找不到指定素材 / Asset unavailable");
    }
  }
  const used = new Set<string>();
  const edgeIds = new Set<string>();
  const neighbors = new Map<string, string[]>();
  for (const edge of value.edges) {
    const source = nodes.get(edge.source);
    const target = nodes.get(edge.target);
    const out = source && outputPorts(source, assets).find((port) => port.id === edge.sourcePort);
    const into = target && inputPorts(target).find((port) => port.id === edge.targetPort);
    const slot = edge.target + ":" + edge.targetPort;
    if (!out || !into || out.kind !== into.kind || edge.source === edge.target || used.has(slot) ||
      edgeIds.has(edge.id) || (out.kind === "text" ? edge.assetId : (!edge.assetId || assetKinds.get(edge.assetId) !== out.kind))) {
      throw new CanvasError(400, "连线端口、素材或输入数量无效 / Invalid connection");
    }
    used.add(slot);
    edgeIds.add(edge.id);
    const targets = neighbors.get(edge.source) ?? [];
    targets.push(edge.target);
    neighbors.set(edge.source, targets);
  }
  const checking = new Set<string>();
  const visited = new Set<string>();
  function visit(id: string): void {
    if (checking.has(id)) throw new CanvasError(400, "不能形成循环连线 / Cyclic connection");
    if (visited.has(id)) return;
    checking.add(id);
    for (const target of neighbors.get(id) ?? []) visit(target);
    checking.delete(id);
    visited.add(id);
  }
  for (const id of nodes.keys()) visit(id);
  return value;
}
