// 视频任务的请求体组装与响应解析（纯函数），供媒体生成适配器复用；端点解析仍留在 media.ts。
import type { LlmProfile } from "../types";
import type { MediaVideoInput, MediaVideoResult, VideoEndpointStyle } from "./media";

/** 各视频模型支持的最短时长：HappyHorse 官方要求 3–15 秒，其余保留 2 秒下限。 */
function minVideoDuration(model: string): number {
  return /^happyhorse(?:[-_.]|$)/iu.test(model.trim()) ? 3 : 2;
}

/** 组装创建视频任务的请求体。 */
export function buildVideoTaskBody(
  profile: LlmProfile,
  input: MediaVideoInput,
  style: VideoEndpointStyle = "dashscope-video",
): Record<string, unknown> {
  const model = input.modelId?.trim() || profile.model;
  const prompt = input.prompt.trim();
  const duration = Math.max(minVideoDuration(model), Math.min(input.duration ?? 2, 15));
  const negativePrompt = input.negativePrompt?.trim();
  if (style === "ark-video") {
    return {
      model,
      content: [{ type: "text", text: prompt }],
      ...(typeof input.duration === "number" ? { duration: /seedance-(?:2\.[05])/u.test(model) ? Math.max(4, duration) : duration } : {}),
      ...(input.ratio ? { ratio: input.ratio } : {}),
      ...(input.resolution ? { resolution: input.resolution.toLowerCase() } : {}),
      ...(typeof input.watermark === "boolean" ? { watermark: input.watermark } : {}),
      ...(typeof input.seed === "number" ? { seed: Math.floor(input.seed) } : {}),
    };
  }
  const parameters: Record<string, unknown> = {
    resolution: (input.resolution ?? "720P").toUpperCase(),
    ratio: input.ratio ?? "16:9",
    duration,
    prompt_extend: true,
    watermark: input.watermark ?? false,
  };
  if (typeof input.seed === "number") parameters.seed = Math.floor(input.seed);
  return {
    model,
    input: { prompt, ...(negativePrompt ? { negative_prompt: negativePrompt } : {}) },
    parameters,
  };
}

/** 解析创建任务响应中的 taskId 与状态。 */
export function parseVideoTask(payload: unknown, style: VideoEndpointStyle = "dashscope-video"): { taskId: string; status: MediaVideoResult["status"] } {
  const response = (payload ?? {}) as Record<string, unknown>;
  if (style === "ark-video") {
    return { taskId: typeof response.id === "string" ? response.id : "", status: "PENDING" };
  }
  const output = response.output as Record<string, unknown> | undefined;
  const taskId = typeof output?.task_id === "string" ? output.task_id : "";
  const raw = typeof output?.task_status === "string" ? output.task_status.toUpperCase() : "PENDING";
  const status = (["SUCCEEDED", "PENDING", "RUNNING", "FAILED", "CANCELED", "UNKNOWN"].includes(raw) ? raw : "PENDING") as MediaVideoResult["status"];
  return { taskId, status };
}

/** 解析轮询响应中的状态与视频地址。 */
export function parseVideoTaskResult(payload: unknown, style: VideoEndpointStyle = "dashscope-video"): { status: MediaVideoResult["status"]; videoUrl?: string; message?: string } {
  const response = (payload ?? {}) as Record<string, unknown>;
  if (style === "ark-video") {
    const raw = typeof response.status === "string" ? response.status.toLowerCase() : "";
    const statuses: Record<string, MediaVideoResult["status"]> = {
      queued: "PENDING", running: "RUNNING", succeeded: "SUCCEEDED", failed: "FAILED", expired: "FAILED", cancelled: "CANCELED", canceled: "CANCELED",
    };
    const content = response.content as Record<string, unknown> | undefined;
    const error = response.error as Record<string, unknown> | undefined;
    return {
      status: Object.hasOwn(statuses, raw) ? statuses[raw]! : "UNKNOWN",
      ...(typeof content?.video_url === "string" ? { videoUrl: content.video_url } : {}),
      ...(typeof error?.message === "string" ? { message: error.message } : {}),
    };
  }
  const output = response.output as Record<string, unknown> | undefined;
  const raw = typeof output?.task_status === "string" ? output.task_status.toUpperCase() : "UNKNOWN";
  const status = (["SUCCEEDED", "PENDING", "RUNNING", "FAILED", "CANCELED", "UNKNOWN"].includes(raw) ? raw : "UNKNOWN") as MediaVideoResult["status"];
  const direct = typeof output?.video_url === "string" ? output.video_url : undefined;
  const results = Array.isArray(output?.results) ? output.results as Array<Record<string, unknown>> : [];
  const nested = results.find((item) => typeof item.video_url === "string")?.video_url;
  return {
    status,
    ...(direct ? { videoUrl: direct } : nested ? { videoUrl: nested as string } : {}),
    ...(typeof output?.message === "string" ? { message: output.message } : {}),
  };
}