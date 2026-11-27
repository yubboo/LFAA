// 发起受工作台本机令牌保护的画布读写，媒体预览使用已有 URL 鉴权。
import type { BoardDetail, CanvasAsset, CanvasBoard, CanvasGraph, CanvasRun } from "@lfaa/canvas/contract";

export class CanvasApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function json<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const value = await response.json() as T & { error?: string };
  if (!response.ok) throw new CanvasApiError(response.status, value.error ?? response.statusText);
  return value;
}

function send<T>(url: string, data: unknown, method = "POST"): Promise<T> {
  return json<T>(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
}

export interface CanvasListItem { canvasId: string; title: string }

export function boardsPath(projectId: string): string {
  return "/api/canvas/projects/" + encodeURIComponent(projectId) + "/boards";
}

export const listBoards = (projectId: string, signal: AbortSignal) => json<CanvasListItem[]>(boardsPath(projectId), { signal });
export const createBoard = (projectId: string, title: string) => send<CanvasBoard>(boardsPath(projectId), { title });
export const getBoard = (path: string, signal?: AbortSignal) => json<BoardDetail>(path, signal ? { signal } : undefined);
export const saveBoard = (path: string, revision: number, graph: CanvasGraph) => send<CanvasBoard>(path, { revision, graph }, "PUT");
export const submitNode = (path: string, id: string, nodeId: string, revision: number) => send<CanvasRun>(path + "/runs", { id, nodeId, revision });

export interface CanvasModel {
  profileId: string;
  profileName: string;
  modelId: string;
  kind: "image" | "video";
  referenceVideo: boolean;
}

export async function getModels(signal: AbortSignal): Promise<CanvasModel[]> {
  const { profiles } = await json<{ profiles: Array<{
    id: string; name: string; baseUrl: string; model: string; hasApiKey: boolean;
    availableModels: Array<{ id: string; modelKind?: string }>;
  }> }>("/api/llm/profiles", { signal });
  return profiles.filter((profile) => profile.hasApiKey).flatMap((profile) => profile.availableModels.flatMap((model) => {
    if (model.modelKind !== "image" && model.modelKind !== "video") return [];
    if (model.modelKind === "video" && /-(?:r2v|i2v)$/u.test(model.id)) return [];
    return [{
      profileId: profile.id, profileName: profile.name, modelId: model.id, kind: model.modelKind,
      referenceVideo: profile.baseUrl.includes("volces.com")
        ? /seedance-2\.(?:0|5)/u.test(model.id)
        : /^wan3\.0-video(?:-prime)?$/u.test(model.id),
    } satisfies CanvasModel];
  }));
}

export function assetUrl(path: string, assetId: string): string {
  const token = document.querySelector<HTMLMetaElement>('meta[name="lfaa-api-token"]')?.content;
  return path + "/assets/" + encodeURIComponent(assetId) + (token ? "?token=" + encodeURIComponent(token) : "");
}

/** 图片和录制片段经同一项目画布接口持久化，不保留临时 blob 引用。 */
export async function uploadAsset(path: string, blob: Blob, name: string): Promise<CanvasAsset> {
  if (blob.size > 24 * 1024 * 1024) throw new Error("素材大小超出限制 / Asset exceeds 24 MiB");
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result).split(",")[1];
      if (base64) resolve(base64);
      else reject(new Error("素材为空 / Empty asset"));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  return send(path + "/assets", { name, mime: blob.type.split(";")[0] ?? "", base64: data });
}
