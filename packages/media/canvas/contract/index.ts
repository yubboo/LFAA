// 无限画布公开契约，供浏览器编辑器和 Host 验证器共用。
export type CanvasNodeKind = "prompt" | "asset" | "previs" | "image" | "video";
export type AssetKind = "image" | "video";
export type Vector = [number, number, number];
export type VideoMode = "text" | "frames" | "reference";

export interface StageObject {
  id: string;
  kind: "actor" | "box" | "sphere";
  position: Vector;
  rotation: number;
  keys: Array<{ time: number; position: Vector }>;
}

export interface StageScene {
  duration: number;
  ratio: "16:9" | "9:16";
  objects: StageObject[];
  camera: Array<{ time: number; position: Vector; target: Vector }>;
}

export interface CanvasNode {
  id: string;
  kind: CanvasNodeKind;
  position: { x: number; y: number };
  settings: {
    prompt?: string;
    profileId?: string;
    modelId?: string;
    ratio?: string;
    duration?: number;
    seed?: number;
    resolution?: string;
    mode?: VideoMode;
    scene?: StageScene;
    assetId?: string;
    imageId?: string;
    videoId?: string;
    resultId?: string;
  };
}

export interface CanvasEdge {
  id: string;
  source: string;
  sourcePort: string;
  target: string;
  targetPort: string;
  assetId?: string;
}

export interface CanvasGraph {
  viewport: { x: number; y: number; zoom: number };
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

export interface CanvasBoard extends CanvasGraph {
  schemaVersion: 1;
  projectId: string;
  canvasId: string;
  title: string;
  revision: number;
}

export interface CanvasAsset {
  id: string;
  kind: AssetKind;
  mime: string;
  name: string;
}

export interface CanvasRun {
  id: string;
  nodeId: string;
  status: "starting" | "running" | "succeeded" | "failed" | "uncertain";
  createdAt: string;
  inputs: Record<string, string>;
  prompt: string;
  settings: CanvasNode["settings"];
  kind: "image" | "video";
  model?: string;
  profileId?: string;
  taskId?: string;
  error?: string;
  assetId?: string;
}

export interface BoardDetail {
  board: CanvasBoard;
  assets: CanvasAsset[];
  runs: CanvasRun[];
}

export type PortKind = AssetKind | "text";

export interface Port {
  id: string;
  kind: PortKind;
}

export const canvasInputs: Record<CanvasNodeKind, Port[]> = {
  prompt: [], asset: [], previs: [],
  image: [{ id: "prompt", kind: "text" }, { id: "character", kind: "image" }, { id: "composition", kind: "image" }],
  video: [{ id: "prompt", kind: "text" }, { id: "first", kind: "image" }, { id: "last", kind: "image" }, { id: "character", kind: "image" }, { id: "motion", kind: "video" }],
};

/** 按节点模式和素材类型决定可见端口。 */
export function inputPorts(node: CanvasNode): Port[] {
  if (node.kind !== "video") return canvasInputs[node.kind];
  const allowed = { text: ["prompt"], frames: ["prompt", "first", "last"], reference: ["prompt", "character", "motion"] };
  return canvasInputs.video.filter((port) => allowed[node.settings.mode ?? "text"].includes(port.id));
}

/** 输出版本是连接时的固定引用，后续重新生成不会改写旧连线。 */
export function outputPorts(node: CanvasNode, assets: readonly CanvasAsset[]): Array<Port & { assetId?: string }> {
  if (node.kind === "prompt") return [{ id: "text", kind: "text" }];
  if (node.kind === "asset") {
    const asset = assets.find((item) => item.id === node.settings.assetId);
    return asset ? [{ id: "asset", kind: asset.kind, assetId: asset.id }] : [];
  }
  if (node.kind === "previs") return [
    { id: "image", kind: "image", ...(node.settings.imageId ? { assetId: node.settings.imageId } : {}) },
    { id: "video", kind: "video", ...(node.settings.videoId ? { assetId: node.settings.videoId } : {}) },
  ];
  return [{ id: node.kind, kind: node.kind, ...(node.settings.resultId ? { assetId: node.settings.resultId } : {}) }];
}
