/**
 * 功能：把 AI 漫剧 Owner 的单一项目记录映射到系统 Canvas 运行时。
 * 作用：复用共享 Canvas UI 与节点运行时，保存仍回到 AI Video Owner，不创建第二份漫剧项目。
 * 关联文件：CanvasWorkspace.tsx、CanvasProjectTransfer.ts、packages/video/ai-video/src/index.ts。
 */
import {
  aiVideoAssetUrl, cancelAiVideoShotVideo, createAiVideoCanvas, deleteAiVideoCanvas, deleteAiVideoMediaAsset,
  generateAiVideoShotImage, loadAiVideoCanvases, refreshAiVideoShotVideo, saveAiVideoCanvas, startAiVideoShotVideo,
  uploadAiVideoMediaAsset, uploadAiVideoReferenceImage, removeAiVideoReferenceImage,
  type AiVideoCanvas, type AiVideoCanvasInput, type AiVideoMediaAsset, type AiVideoShot,
  type CanvasAsset, type CanvasEdge, type CanvasNode, type CanvasProject, type CanvasProjectSummary
} from "lfaa-client-connection/src/api.js";
import type { CanvasNodeKind } from "./CanvasProjectTransfer.js";

const SCRIPT_NODE_ID = "aivideo-script";
const TIMELINE_NODE_ID = "aivideo-timeline";
const DIRECTOR_NODE_ID = "aivideo-director";

type Position = { x: number; y: number };
type AiVideoProjectNode = CanvasNode & { type: CanvasNodeKind };

function position(canvas: AiVideoCanvas, key: string, fallback: Position): Position {
  return canvas.canvasLayout?.nodePositions?.[key] ?? fallback;
}

function canvasNode(id: string, type: CanvasNodeKind, at: Position, width: number, height: number, data: Record<string, unknown>): AiVideoProjectNode {
  return { id, type, x: at.x, y: at.y, width, height, data };
}

function mediaAsset(asset: AiVideoMediaAsset): CanvasAsset {
  return { assetId: asset.assetId, name: asset.name, mimeType: asset.mimeType, bytes: asset.bytes, createdAt: asset.createdAt };
}

export function aiVideoCanvasToProject(canvas: AiVideoCanvas): CanvasProject {
  const characters = canvas.characters.map((reference, index) => canvasNode(
    reference.id,
    "aivideo-reference",
    position(canvas, `character:${reference.id}`, { x: -680, y: 80 + index * 300 }),
    340,
    430,
    { reference: { ...reference, kind: "characters" } }
  ));
  const locations = canvas.locations.map((reference, index) => canvasNode(
    reference.id,
    "aivideo-reference",
    position(canvas, `location:${reference.id}`, { x: -680, y: 440 + index * 300 }),
    340,
    430,
    { reference: { ...reference, kind: "locations" } }
  ));
  const shots = canvas.shots.map(shot => canvasNode(shot.id, "shot", { x: shot.x, y: shot.y }, 360, 560, { shot }));
  const assetNodes = canvas.mediaAssets.flatMap(asset => {
    const at = canvas.canvasLayout?.nodePositions?.[`asset:${asset.assetId}`];
    return at ? [canvasNode(asset.assetId, "asset", at, 300, 220, { assetId: asset.assetId, assetName: asset.name })] : [];
  });
  const nodes: CanvasNode[] = [
    canvasNode(SCRIPT_NODE_ID, "script", position(canvas, "script", { x: -180, y: -360 }), 380, 360, { script: { title: "剧本", body: canvas.script, status: "draft" } }),
    ...characters,
    ...locations,
    ...shots,
    ...assetNodes,
    canvasNode(TIMELINE_NODE_ID, "aivideo-timeline", position(canvas, "timeline", { x: 680, y: -360 }), 440, 520, { clips: canvas.timelineClips }),
    canvasNode(DIRECTOR_NODE_ID, "aivideo-director", position(canvas, "director", { x: 680, y: 220 }), 420, 480, { whiteModel: canvas.whiteModel })
  ];
  const assets = canvas.mediaAssets.map(mediaAsset);
  return {
    format: "lfaa-canvas-project",
    formatVersion: 2,
    id: canvas.id,
    title: canvas.title,
    applicationId: "aivideo",
    viewport: canvas.canvasLayout?.viewport ?? { x: 0, y: 0, zoom: 1 },
    nodes,
    edges: canvas.links.map((link): CanvasEdge => ({ id: link.id, source: link.source, target: link.target })),
    assets,
    createdAt: canvas.createdAt,
    updatedAt: canvas.updatedAt
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function aiVideoProjectToInput(project: CanvasProject): AiVideoCanvasInput {
  const nodes = project.nodes as AiVideoProjectNode[];
  const shots: AiVideoShot[] = [];
  const characters: AiVideoCanvas["characters"] = [];
  const locations: AiVideoCanvas["locations"] = [];
  const layout: AiVideoCanvas["canvasLayout"] = { viewport: project.viewport, nodePositions: {} };
  let script = "";
  let timelineClips: AiVideoCanvas["timelineClips"] = [];
  let whiteModel: AiVideoCanvas["whiteModel"] | undefined;
  const shotIds = new Set<string>();

  for (const node of nodes) {
    if (node.type === "shot" && isRecord(node.data.shot)) {
      const shot = node.data.shot as unknown as AiVideoShot;
      shots.push({ ...shot, id: node.id, x: node.x, y: node.y });
      shotIds.add(node.id);
    } else if (node.type === "script") {
      const data = isRecord(node.data.script) ? node.data.script : {};
      script = typeof data.body === "string" ? data.body : "";
      layout.nodePositions.script = { x: node.x, y: node.y };
    } else if (node.type === "aivideo-reference" && isRecord(node.data.reference)) {
      const reference = node.data.reference;
      const id = node.id;
      const item = {
        id,
        name: typeof reference.name === "string" ? reference.name : "未命名档案",
        description: typeof reference.description === "string" ? reference.description : "",
        ...(typeof reference.imageAssetId === "string" ? { imageAssetId: reference.imageAssetId } : {}),
        ...(typeof reference.imageMimeType === "string" ? { imageMimeType: reference.imageMimeType as AiVideoCanvas["characters"][number]["imageMimeType"] } : {})
      };
      if (reference.kind === "characters") {
        characters.push(item);
        layout.nodePositions[`character:${id}`] = { x: node.x, y: node.y };
      } else if (reference.kind === "locations") {
        locations.push(item);
        layout.nodePositions[`location:${id}`] = { x: node.x, y: node.y };
      }
    } else if (node.type === "aivideo-timeline" && Array.isArray(node.data.clips)) {
      timelineClips = node.data.clips as AiVideoCanvas["timelineClips"];
      layout.nodePositions.timeline = { x: node.x, y: node.y };
    } else if (node.type === "aivideo-director" && isRecord(node.data.whiteModel)) {
      whiteModel = node.data.whiteModel as unknown as AiVideoCanvas["whiteModel"];
      layout.nodePositions.director = { x: node.x, y: node.y };
    } else if (node.type === "asset" && typeof node.data.assetId === "string") {
      layout.nodePositions[`asset:${node.data.assetId}`] = { x: node.x, y: node.y };
    }
  }

  const input: AiVideoCanvasInput = {
    title: project.title,
    script,
    characters,
    locations,
    shots,
    links: project.edges.filter(edge => shotIds.has(edge.source) && shotIds.has(edge.target)).map(edge => ({ id: edge.id, source: edge.source, target: edge.target })),
    timelineClips,
    whiteModel: whiteModel ?? { items: [], camera: { x: 0, y: 1.6, z: -8, yaw: 0, pitch: -4, focalLength: 50 }, ratio: "16:9" },
    canvasLayout: layout
  };
  return input;
}

function summary(canvas: AiVideoCanvas): CanvasProjectSummary {
  return {
    id: canvas.id,
    title: canvas.title,
    applicationId: "aivideo",
    nodeCount: canvas.shots.length + canvas.characters.length + canvas.locations.length + 3 + canvas.mediaAssets.filter(asset => Boolean(canvas.canvasLayout?.nodePositions?.[`asset:${asset.assetId}`])).length,
    assetCount: canvas.mediaAssets.length,
    createdAt: canvas.createdAt,
    updatedAt: canvas.updatedAt
  };
}

async function loadCanvas(canvasId: string, signal?: AbortSignal): Promise<AiVideoCanvas> {
  const { canvases } = await loadAiVideoCanvases(signal);
  if (signal?.aborted) throw new DOMException("请求已取消。", "AbortError");
  const canvas = canvases.find(item => item.id === canvasId);
  if (!canvas) throw new Error("找不到当前账户的 AI 漫剧项目。");
  return canvas;
}

export const aiVideoCanvasAdapter = {
  async listProjects(signal?: AbortSignal): Promise<CanvasProjectSummary[]> {
    const { canvases } = await loadAiVideoCanvases(signal);
    return canvases.map(summary);
  },
  async loadProject(projectId: string, signal?: AbortSignal): Promise<CanvasProject> {
    return aiVideoCanvasToProject(await loadCanvas(projectId, signal));
  },
  async createProject(title: string): Promise<CanvasProject> {
    return aiVideoCanvasToProject((await createAiVideoCanvas(title)).canvas);
  },
  async saveProject(project: CanvasProject, expectedUpdatedAt: string): Promise<CanvasProject> {
    const saved = await saveAiVideoCanvas(project.id, expectedUpdatedAt, aiVideoProjectToInput(project));
    return aiVideoCanvasToProject(saved.canvas);
  },
  async deleteProject(projectId: string): Promise<void> {
    await deleteAiVideoCanvas(projectId);
  },
  async uploadAsset(project: CanvasProject, file: File): Promise<CanvasProject> {
    const saved = await uploadAiVideoMediaAsset(project.id, project.updatedAt, file);
    return aiVideoCanvasToProject(saved.canvas);
  },
  async deleteAsset(project: CanvasProject, assetId: string): Promise<CanvasProject> {
    const saved = await deleteAiVideoMediaAsset(project.id, assetId, project.updatedAt);
    return aiVideoCanvasToProject(saved.canvas);
  },
  async uploadReferenceImage(projectId: string, kind: "characters" | "locations", referenceId: string, expectedUpdatedAt: string, dataUrl: string): Promise<CanvasProject> {
    return aiVideoCanvasToProject((await uploadAiVideoReferenceImage(projectId, kind, referenceId, expectedUpdatedAt, dataUrl)).canvas);
  },
  async removeReferenceImage(projectId: string, kind: "characters" | "locations", referenceId: string, expectedUpdatedAt: string): Promise<CanvasProject> {
    return aiVideoCanvasToProject((await removeAiVideoReferenceImage(projectId, kind, referenceId, expectedUpdatedAt)).canvas);
  },
  assetUrl(projectId: string, assetId: string): string {
    return aiVideoAssetUrl(projectId, assetId);
  },
  async generateShotImage(projectId: string, shotId: string, expectedUpdatedAt: string): Promise<CanvasProject> {
    return aiVideoCanvasToProject((await generateAiVideoShotImage(projectId, shotId, expectedUpdatedAt)).canvas);
  },
  async startShotVideo(projectId: string, shotId: string, expectedUpdatedAt: string): Promise<CanvasProject> {
    return aiVideoCanvasToProject((await startAiVideoShotVideo(projectId, shotId, expectedUpdatedAt)).canvas);
  },
  async refreshShotVideo(projectId: string, shotId: string): Promise<CanvasProject> {
    return aiVideoCanvasToProject((await refreshAiVideoShotVideo(projectId, shotId)).canvas);
  },
  async cancelShotVideo(projectId: string, shotId: string): Promise<CanvasProject> {
    return aiVideoCanvasToProject((await cancelAiVideoShotVideo(projectId, shotId)).canvas);
  },
  assetKind(asset: AiVideoMediaAsset): CanvasAsset["mimeType"] {
    return asset.mimeType;
  },
  nodeKinds: ["asset", "script", "shot", "aivideo-reference", "aivideo-timeline", "aivideo-director"] as const satisfies readonly CanvasNodeKind[]
};
