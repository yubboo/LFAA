/**
 * 功能：编排画布图片与视频生成。
 * 作用：复用设置中心 imageGeneration 与 videoGeneration 系列配置、凭据 Owner 与 LLM Provider Owner 真实调用生成，成功后再经画布 Owner 原子写入素材与节点生成状态。
 * 关联文件：packages/canvas/canvas（lfaaCanvas 数据 Owner）、packages/llm/llm（Provider 协议）、packages/settings/settings、packages/credentials/credentials、packages/api/canvas-controller、本包 README。
 */
import { randomUUID } from "node:crypto";
import type { Context } from "@deepseek-ai/cordis";
import type { CanvasAssetRead, CanvasNode, CanvasProject, CanvasService } from "lfaa-canvas/src/index.js";
import { CanvasConflictError } from "lfaa-canvas/src/index.js";
import { credentialReference } from "lfaa-credentials/src/index.js";
import type { ApplicationId } from "lfaa-util-values/src/application-id.js";
import { generateProviderImage, type GeneratedImageMimeType, type ImageGenerationProvider, type ProviderReferenceImage } from "lfaa-llm/src/image-generation.js";
import { cancelArkVideoTask, createArkVideoTask, downloadArkVideo, getArkVideoTask, type ArkVideoProviderId, type ArkVideoTaskStatus } from "lfaa-llm/src/video-generation.js";
import { getUserSettings, listAiAccounts, type AiAccountView, type AiRuntimeSettings } from "lfaa-settings/src/service.js";

/** 画布生成节点 data.generation 的受限状态；只覆盖合同声明的字段，额外字段用于诊断与服务商任务恢复。 */
export type CanvasGenerationStatus = "idle" | "running" | "succeeded" | "failed";
export type CanvasGenerationKind = "image" | "video";

export interface CanvasGenerationState {
  kind: CanvasGenerationKind;
  prompt: string;
  status: CanvasGenerationStatus;
  assetId?: string;
  error?: string;
  aspectRatio?: string;
  durationSeconds?: number;
  taskId?: string;
  /** 火山方舟原始任务状态；用于区分排队/运行并在同一状态时不重复写项目。 */
  providerStatus?: string;
  /** 提交视频任务时使用的设置账户与模型，刷新/取消时按它们恢复凭据。 */
  accountId?: string;
  modelId?: string;
  startedAt?: string;
  finishedAt?: string;
}

/** 生成请求与 Provider 输入边界；控制器与测试共用同一份上限，不复制到第二处。 */
export const CANVAS_GENERATION_LIMITS = Object.freeze({
  imagePromptCharacters: 1_000,
  videoPromptCharacters: 5_000,
  referenceImages: 9,
  referenceImageBytes: 3 * 1024 * 1024,
  referenceImageTotalBytes: 27 * 1024 * 1024,
  videoMinimumSeconds: 1,
  videoMaximumSeconds: 15
});

export const CANVAS_IMAGE_ASPECT_RATIOS = Object.freeze(["1:1", "4:3", "3:4", "16:9", "9:16", "2:1"] as const);
export const CANVAS_VIDEO_ASPECT_RATIOS = Object.freeze(["16:9", "9:16", "1:1", "4:3", "3:4"] as const);
export type CanvasImageAspectRatio = typeof CANVAS_IMAGE_ASPECT_RATIOS[number];
export type CanvasVideoAspectRatio = typeof CANVAS_VIDEO_ASPECT_RATIOS[number];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const IMAGE_MIME_TYPES = new Set<string>(["image/png", "image/jpeg", "image/webp"]);

/** 设置中心未配置账户、模型或密钥：控制器映射 400，前端引导到设置中心。 */
export class CanvasGenerationConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanvasGenerationConfigurationError";
  }
}

/** 本轮没有接通的能力（本机模型适配）：控制器显式映射 501，绝不返回演示成功。 */
export class CanvasGenerationUnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanvasGenerationUnsupportedError";
  }
}

/** 项目或生成节点不存在：控制器映射 404。 */
export class CanvasGenerationNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanvasGenerationNotFoundError";
  }
}

export interface CanvasGenerateImageInput {
  expectedUpdatedAt: string;
  nodeId?: string;
  prompt: string;
  aspectRatio?: CanvasImageAspectRatio;
  referenceAssetIds?: string[];
  signal?: AbortSignal;
}

export interface CanvasGenerateVideoInput {
  expectedUpdatedAt: string;
  nodeId?: string;
  prompt: string;
  durationSeconds?: number;
  aspectRatio?: CanvasVideoAspectRatio;
  referenceAssetIds?: string[];
  signal?: AbortSignal;
}

export interface CanvasGeneratedAssetSummary {
  assetId: string;
  name: string;
  mimeType: string;
  bytes: number;
}

export interface CanvasImageGenerationResult {
  project: CanvasProject;
  asset: CanvasGeneratedAssetSummary;
}

export interface CanvasVideoGenerationResult {
  project: CanvasProject;
}

export interface CanvasGenerationService {
  /** 同步生图；成功后把图片原子写入项目素材，并在指定生成节点写入 succeeded 状态。 */
  generateImage(userId: string, applicationId: ApplicationId, projectId: string, input: CanvasGenerateImageInput): Promise<CanvasImageGenerationResult | null>;
  /** 提交火山方舟视频任务；先把节点置 running，拿到服务商任务 ID 后写入 data.generation。 */
  startVideo(userId: string, applicationId: ApplicationId, projectId: string, input: CanvasGenerateVideoInput): Promise<CanvasVideoGenerationResult | null>;
  /** 刷新视频任务；只有服务商返回成功并下载到真实成片才落素材并置 succeeded。 */
  refreshVideo(userId: string, applicationId: ApplicationId, projectId: string, nodeId: string, signal?: AbortSignal): Promise<CanvasProject | null>;
  /** 取消仍在排队的视频任务；成功后节点置 failed 并记录真实原因，不登记成片。 */
  cancelVideo(userId: string, applicationId: ApplicationId, projectId: string, nodeId: string, signal?: AbortSignal): Promise<CanvasProject | null>;
}

/** 生成编排依赖；apply 注入真实 Owner，回归可注入假的生成函数而不访问外部网络。 */
export interface CanvasGenerationDependencies {
  canvas: CanvasService;
  readSettings(userId: string): AiRuntimeSettings;
  listAccounts(userId: string): AiAccountView[];
  resolveCredential(userId: string, accountId: string): string | null;
  generateImage: typeof generateProviderImage;
  createVideoTask: typeof createArkVideoTask;
  getVideoTask: typeof getArkVideoTask;
  cancelVideoTask: typeof cancelArkVideoTask;
  downloadVideo: typeof downloadArkVideo;
}

function failConfiguration(message: string): never {
  throw new CanvasGenerationConfigurationError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizedUuid(value: unknown, label: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) return failConfiguration(label + "必须是有效的 UUID。");
  return value.toLowerCase();
}

function nowIso(): string {
  return new Date().toISOString();
}

function generatedAssetName(kind: CanvasGenerationKind, extension: string): string {
  // 生成素材名称只用于展示与识别；assetId 才是唯一引用，重名不会覆盖现有文件。
  const stamp = nowIso().replace(/[:.]/gu, "-").slice(0, 19);
  return (kind === "image" ? "画布生成图片-" : "画布生成视频-") + stamp + "." + extension;
}

function imageExtension(mimeType: GeneratedImageMimeType): "png" | "jpg" | "webp" {
  return mimeType === "image/png" ? "png" : mimeType === "image/jpeg" ? "jpg" : "webp";
}

/** 图片提示词校验；Provider 协议上限为 1000 字符。 */
export function normalizeImagePrompt(value: unknown): string {
  if (typeof value !== "string") return failConfiguration("图片生成提示词必须是文本。");
  const prompt = value.trim();
  if (!prompt) return failConfiguration("请先填写图片生成提示词。");
  if (prompt.length > CANVAS_GENERATION_LIMITS.imagePromptCharacters) {
    return failConfiguration("图片生成提示词不能超过 " + CANVAS_GENERATION_LIMITS.imagePromptCharacters + " 个字符。");
  }
  return prompt;
}

/** 视频提示词校验；火山方舟内容生成上限为 5000 字符。 */
export function normalizeVideoPrompt(value: unknown): string {
  if (typeof value !== "string") return failConfiguration("视频生成提示词必须是文本。");
  const prompt = value.trim();
  if (!prompt) return failConfiguration("请先填写视频生成提示词。");
  if (prompt.length > CANVAS_GENERATION_LIMITS.videoPromptCharacters) {
    return failConfiguration("视频生成提示词不能超过 " + CANVAS_GENERATION_LIMITS.videoPromptCharacters + " 个字符。");
  }
  return prompt;
}

export function normalizeImageAspectRatio(value: unknown): CanvasImageAspectRatio | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !(CANVAS_IMAGE_ASPECT_RATIOS as readonly string[]).includes(value)) {
    return failConfiguration("图片生成比例无效；只接受 1:1、4:3、3:4、16:9、9:16 或 2:1。");
  }
  return value as CanvasImageAspectRatio;
}

/**
 * 视频比例以请求为准；省略时读取设置中心。
 * 设置中心为“自适应”时，画布没有导演台取景可继承，按 16:9 提交并把实际比例写回节点数据。
 */
export function normalizeVideoAspectRatio(value: unknown, settingsRatio: string): CanvasVideoAspectRatio {
  if (value === undefined || value === "adaptive") {
    if (settingsRatio === "adaptive") return "16:9";
    if ((CANVAS_VIDEO_ASPECT_RATIOS as readonly string[]).includes(settingsRatio)) return settingsRatio as CanvasVideoAspectRatio;
    return failConfiguration("设置中心的视频比例无效；请在设置中心重新选择。");
  }
  if (typeof value !== "string" || !(CANVAS_VIDEO_ASPECT_RATIOS as readonly string[]).includes(value)) {
    return failConfiguration("视频生成比例无效；只接受 16:9、9:16、1:1、4:3 或 3:4。");
  }
  return value as CanvasVideoAspectRatio;
}

export function normalizeVideoDuration(value: unknown, settingsSeconds: number): number {
  if (value === undefined) {
    if (!Number.isInteger(settingsSeconds) || settingsSeconds < CANVAS_GENERATION_LIMITS.videoMinimumSeconds || settingsSeconds > CANVAS_GENERATION_LIMITS.videoMaximumSeconds) {
      return failConfiguration("设置中心的视频时长无效；请在设置中心重新选择 1 到 15 秒。");
    }
    return settingsSeconds;
  }
  const duration = Number(value);
  if (!Number.isInteger(duration) || duration < CANVAS_GENERATION_LIMITS.videoMinimumSeconds || duration > CANVAS_GENERATION_LIMITS.videoMaximumSeconds) {
    return failConfiguration("视频时长必须是 1 到 15 秒的整数。");
  }
  return duration;
}

export function normalizeReferenceAssetIds(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > CANVAS_GENERATION_LIMITS.referenceImages) {
    return failConfiguration("参考素材最多 " + CANVAS_GENERATION_LIMITS.referenceImages + " 个。");
  }
  const ids = value.map(item => normalizedUuid(item, "参考素材 ID"));
  if (new Set(ids).size !== ids.length) return failConfiguration("参考素材 ID 重复。");
  return ids;
}

/** 图片比例通过提示词附加说明传递；LLM Owner 的 Provider 协议没有尺寸参数，不伪造服务商支持。 */
export function buildImagePrompt(prompt: string, aspectRatio: CanvasImageAspectRatio | undefined): string {
  if (!aspectRatio) return prompt;
  const result = prompt + "\n\n画面比例 " + aspectRatio + "。";
  if (result.length > CANVAS_GENERATION_LIMITS.imagePromptCharacters) {
    return failConfiguration("提示词加入画面比例说明后超过 " + CANVAS_GENERATION_LIMITS.imagePromptCharacters + " 个字符；请精简提示词。");
  }
  return result;
}

/** 服务商任务状态映射到画布节点状态；只有 succeeded 可以落素材。 */
export function mapProviderVideoStatus(status: ArkVideoTaskStatus): CanvasGenerationStatus {
  if (status === "succeeded") return "succeeded";
  if (status === "failed" || status === "cancelled" || status === "expired") return "failed";
  return "running";
}

export function videoTaskErrorMessage(status: ArkVideoTaskStatus, providerError?: string): string {
  if (providerError) return providerError.slice(0, 1_000);
  if (status === "cancelled") return "服务商视频任务已取消；画布没有登记成片。";
  if (status === "expired") return "服务商视频任务已过期；请重新发起生成。";
  return "服务商视频任务失败；画布没有登记成片。";
}

export function isTerminalGenerationStatus(status: CanvasGenerationStatus): boolean {
  return status === "succeeded" || status === "failed";
}

function resolveImageTarget(deps: CanvasGenerationDependencies, userId: string, settings: AiRuntimeSettings): { providerId: ImageGenerationProvider; modelId: string; apiKey: string } {
  if (settings.imageGenerationMode === "local") {
    const localModelId = settings.imageGenerationLocalModelId.trim();
    throw new CanvasGenerationUnsupportedError(localModelId
      ? "画布图片生成本轮未接通本机 MOSS 模型（" + localModelId + "）；请在设置中心把图片生成方式切换为远程服务商，或等待后续版本接入。"
      : "画布图片生成本轮未接通本机 MOSS 模型；请在设置中心把图片生成方式切换为远程服务商，或等待后续版本接入。");
  }
  const accountId = settings.imageGenerationAccountId.trim();
  const modelId = settings.imageGenerationModelId.trim();
  if (!accountId || !modelId) return failConfiguration("请先在设置中心选择图片生成账户和模型，再发起画布生成。");
  const account = deps.listAccounts(userId).find(item => item.id === accountId);
  if (!account) return failConfiguration("设置中心找不到所选图片生成账户；请在设置中心重新选择账户。");
  if (!account.hasSecret) return failConfiguration("所选图片生成账户的密钥已删除；请在设置中心重新保存账户密钥。");
  if (account.providerId !== "openai" && account.providerId !== "doubao" && account.providerId !== "ark-agent-plan") {
    return failConfiguration("画布图片生成只支持 OpenAI、豆包/火山方舟和 Agent Plan 图片账户。");
  }
  const imageModel = account.models.find(item => item.id === modelId);
  if (!imageModel || account.providerId === "ark-agent-plan" && imageModel.taskType !== "image-generation") {
    return failConfiguration("所选图片生成模型不在当前账户保存的模型目录中；请在设置中心重新选择模型。");
  }
  const apiKey = deps.resolveCredential(userId, accountId);
  if (!apiKey) return failConfiguration("设置中心保存的图片生成账户密钥不可用；请重新保存账户密钥。");
  return { providerId: account.providerId, modelId, apiKey };
}

function resolveVideoTarget(deps: CanvasGenerationDependencies, userId: string, settings: AiRuntimeSettings): { accountId: string; modelId: string; apiKey: string; providerId: ArkVideoProviderId } {
  if (settings.videoGenerationMode === "local") {
    const localModelId = settings.videoGenerationLocalModelId.trim();
    throw new CanvasGenerationUnsupportedError(localModelId
      ? "画布视频生成本轮未接通本机模型（" + localModelId + "）；请在设置中心把视频生成方式切换为火山方舟远程服务商，或等待后续版本接入。"
      : "画布视频生成本轮未接通本机模型；请在设置中心把视频生成方式切换为火山方舟远程服务商，或等待后续版本接入。");
  }
  const accountId = settings.videoGenerationAccountId.trim();
  const modelId = settings.videoGenerationModelId.trim();
  if (!accountId || !modelId) return failConfiguration("请先在设置中心选择火山方舟视频生成账户和模型，再发起画布视频生成。");
  const account = deps.listAccounts(userId).find(item => item.id === accountId);
  if (!account?.hasSecret) return failConfiguration("设置中心找不到所选火山方舟视频生成账户，或其密钥已删除；请重新保存账户。");
  if (account.providerId !== "doubao" && account.providerId !== "ark-agent-plan") return failConfiguration("画布视频生成只支持火山方舟（豆包）或 Agent Plan 视频账户。");
  const videoModel = account.models.find(item => item.id === modelId);
  if (!videoModel || account.providerId === "ark-agent-plan" && (videoModel.taskType !== "video-generation"
    || Boolean(videoModel.planTiers?.length && account.options.planTier !== "unknown" && account.options.planTier && !videoModel.planTiers.includes(account.options.planTier as NonNullable<typeof videoModel.planTiers>[number])))) {
    return failConfiguration("所选视频生成模型不在当前账户保存的模型目录中；请在设置中心重新选择模型。");
  }
  const apiKey = deps.resolveCredential(userId, accountId);
  if (!apiKey) return failConfiguration("设置中心保存的火山方舟视频账户密钥不可用；请重新保存账户密钥。");
  return { accountId, modelId, apiKey, providerId: account.providerId };
}

/** 视频任务后续刷新/取消按节点记录里的账户恢复凭据，账户被删除或改类型时明确拒绝。 */
function resolveStoredVideoCredential(deps: CanvasGenerationDependencies, userId: string, accountId: string, modelId: string): { apiKey: string; providerId: ArkVideoProviderId } {
  const account = deps.listAccounts(userId).find(item => item.id === accountId);
  if (!account?.hasSecret) return failConfiguration("该视频任务使用的火山方舟账户或密钥已不可用；请重新保存账户后再刷新。");
  if (account.providerId !== "doubao" && account.providerId !== "ark-agent-plan") return failConfiguration("该视频任务使用的账户已不是火山方舟视频账户；无法恢复任务凭据。");
  const model = account.models.find(item => item.id === modelId);
  if (!model || account.providerId === "ark-agent-plan" && model.taskType !== "video-generation") return failConfiguration("该视频任务模型已不在火山方舟视频能力目录中。");
  const apiKey = deps.resolveCredential(userId, accountId);
  if (!apiKey) return failConfiguration("该视频任务使用的火山方舟密钥不可用；请重新保存账户后再刷新。");
  return { apiKey, providerId: account.providerId };
}

function findGenerationNode(project: CanvasProject, nodeId: unknown): CanvasNode {
  const targetNodeId = normalizedUuid(nodeId, "生成节点 ID");
  const node = project.nodes.find(item => item.id === targetNodeId);
  if (!node) throw new CanvasGenerationNotFoundError("找不到当前画布项目中的生成节点；请刷新画布后重试。");
  if (node.type !== "generation") return failConfiguration("目标节点不是生成节点；画布生成只写入 generation 节点。");
  return node;
}

function activeGeneration(node: CanvasNode): boolean {
  const generation = node.data.generation;
  return isRecord(generation) && generation.status === "running";
}

/** 读取节点里已保存的视频任务状态；字段缺失或类型不符时给出可读原因，不猜测任务。 */
function readVideoGeneration(node: CanvasNode): CanvasGenerationState {
  const raw = node.data.generation;
  if (!isRecord(raw)) return failConfiguration("该节点还没有视频生成任务。");
  if (raw.kind !== "video") return failConfiguration("该节点不是视频生成任务；图片生成是同步返回的，无需刷新。");
  const status = raw.status;
  if (status !== "idle" && status !== "running" && status !== "succeeded" && status !== "failed") {
    return failConfiguration("该节点的生成状态无效，无法刷新；请重新发起生成。");
  }
  if (typeof raw.taskId !== "string" || !raw.taskId.trim()) {
    return failConfiguration("该视频生成任务缺少服务商任务 ID，无法刷新；请重新发起生成。");
  }
  const accountId = typeof raw.accountId === "string" ? raw.accountId : "";
  const modelId = typeof raw.modelId === "string" ? raw.modelId : "";
  if (!accountId || !modelId) return failConfiguration("该视频生成任务缺少账户或模型记录，无法恢复凭据；请重新发起生成。");
  return {
    kind: "video",
    prompt: typeof raw.prompt === "string" ? raw.prompt : "",
    status,
    taskId: raw.taskId,
    accountId,
    modelId,
    ...(typeof raw.assetId === "string" ? { assetId: raw.assetId } : {}),
    ...(typeof raw.error === "string" ? { error: raw.error } : {}),
    ...(typeof raw.aspectRatio === "string" ? { aspectRatio: raw.aspectRatio } : {}),
    ...(typeof raw.durationSeconds === "number" ? { durationSeconds: raw.durationSeconds } : {}),
    ...(typeof raw.providerStatus === "string" ? { providerStatus: raw.providerStatus } : {}),
    ...(typeof raw.startedAt === "string" ? { startedAt: raw.startedAt } : {}),
    ...(typeof raw.finishedAt === "string" ? { finishedAt: raw.finishedAt } : {})
  };
}

async function readBoundedAsset(asset: CanvasAssetRead | null, maximum: number, label: string): Promise<Buffer> {
  if (!asset || asset.rangeNotSatisfiable || !asset.stream) return failConfiguration(label + "文件缺失或无法读取；没有向模型发送不完整素材。");
  const limitText = Math.round(maximum / (1024 * 1024)) + " MiB";
  if (asset.size > maximum) return failConfiguration(label + "超过 " + limitText + " 上限。");
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of asset.stream as AsyncIterable<Buffer>) {
    total += chunk.byteLength;
    if (total > maximum) return failConfiguration(label + "超过 " + limitText + " 上限。");
    chunks.push(Buffer.from(chunk));
  }
  if (!total) return failConfiguration(label + "为空；没有向模型发送空素材。");
  return Buffer.concat(chunks, total);
}

async function readReferenceImages(
  deps: CanvasGenerationDependencies,
  userId: string,
  applicationId: ApplicationId,
  projectId: string,
  project: CanvasProject,
  referenceAssetIds: string[]
): Promise<ProviderReferenceImage[]> {
  const images: ProviderReferenceImage[] = [];
  let total = 0;
  for (const assetId of referenceAssetIds) {
    const asset = project.assets.find(item => item.assetId === assetId);
    if (!asset) return failConfiguration("参考素材不在当前画布项目中；画布生成只能引用本项目素材。");
    if (!IMAGE_MIME_TYPES.has(asset.mimeType)) return failConfiguration("参考素材「" + asset.name + "」不是图片；参考图只接受 PNG、JPEG 或 WebP。");
    if (asset.bytes > CANVAS_GENERATION_LIMITS.referenceImageBytes) return failConfiguration("参考图片「" + asset.name + "」超过 3 MiB 上限。");
    const bytes = await readBoundedAsset(deps.canvas.openAsset(userId, applicationId, projectId, assetId), CANVAS_GENERATION_LIMITS.referenceImageBytes, "参考图片「" + asset.name + "」");
    total += bytes.byteLength;
    if (total > CANVAS_GENERATION_LIMITS.referenceImageTotalBytes) return failConfiguration("参考图片合计超过 27 MiB 上限。");
    images.push({ bytes, mimeType: asset.mimeType as GeneratedImageMimeType });
  }
  return images;
}

function retryOnConflict<T>(operation: () => T | null, attempts = 3): T | null {
  let lastError: unknown;
  for (let index = 0; index < attempts; index += 1) {
    try {
      return operation();
    } catch (error) {
      lastError = error;
      if (!(error instanceof CanvasConflictError)) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("画布写入冲突；请重新加载画布后重试。");
}

export function createCanvasGenerationService(deps: CanvasGenerationDependencies): CanvasGenerationService {
  function persistVideoState(userId: string, applicationId: ApplicationId, projectId: string, nodeId: string, generation: CanvasGenerationState): CanvasProject | null {
    return retryOnConflict(() => {
      const current = deps.canvas.read(userId, applicationId, projectId);
      if (!current) return null;
      const node = current.nodes.find(item => item.id === nodeId);
      if (!node) return null;
      return deps.canvas.updateNodeData(userId, applicationId, projectId, current.updatedAt, nodeId, { ...node.data, generation });
    });
  }

  async function generateImage(userId: string, applicationId: ApplicationId, projectId: string, input: CanvasGenerateImageInput): Promise<CanvasImageGenerationResult | null> {
    input.signal?.throwIfAborted();
    const prompt = normalizeImagePrompt(input.prompt);
    const aspectRatio = normalizeImageAspectRatio(input.aspectRatio);
    const referenceAssetIds = normalizeReferenceAssetIds(input.referenceAssetIds);
    const settings = deps.readSettings(userId);
    const target = resolveImageTarget(deps, userId, settings);
    const project = deps.canvas.read(userId, applicationId, projectId);
    if (!project) return null;
    if (project.updatedAt !== input.expectedUpdatedAt) throw new CanvasConflictError();
    const node = input.nodeId === undefined ? undefined : findGenerationNode(project, input.nodeId);
    const referenceImages = await readReferenceImages(deps, userId, applicationId, projectId, project, referenceAssetIds);
    const startedAt = nowIso();
    const image = await deps.generateImage({
      providerId: target.providerId,
      modelId: target.modelId,
      apiKey: target.apiKey,
      prompt: buildImagePrompt(prompt, aspectRatio),
      referenceImages,
      timeoutMs: settings.requestTimeoutSeconds * 1_000,
      ...(input.signal ? { signal: input.signal } : {})
    });
    input.signal?.throwIfAborted();
    const assetId = randomUUID();
    const generation: CanvasGenerationState = {
      kind: "image",
      prompt,
      status: "succeeded",
      assetId,
      ...(aspectRatio ? { aspectRatio } : {}),
      startedAt,
      finishedAt: nowIso()
    };
    const committed = deps.canvas.commitAsset(userId, applicationId, projectId, {
      expectedUpdatedAt: input.expectedUpdatedAt,
      name: generatedAssetName("image", imageExtension(image.mimeType)),
      mimeType: image.mimeType,
      bytes: image.bytes,
      assetId,
      ...(node ? { node: { nodeId: node.id, data: { ...node.data, generation } } } : {})
    });
    if (!committed) return null;
    return {
      project: committed.project,
      asset: { assetId: committed.asset.assetId, name: committed.asset.name, mimeType: committed.asset.mimeType, bytes: committed.asset.bytes }
    };
  }

  async function startVideo(userId: string, applicationId: ApplicationId, projectId: string, input: CanvasGenerateVideoInput): Promise<CanvasVideoGenerationResult | null> {
    input.signal?.throwIfAborted();
    const prompt = normalizeVideoPrompt(input.prompt);
    const settings = deps.readSettings(userId);
    const target = resolveVideoTarget(deps, userId, settings);
    if (input.nodeId === undefined) return failConfiguration("视频生成需要指定画布生成节点；请在生成节点上发起视频生成。");
    const project = deps.canvas.read(userId, applicationId, projectId);
    if (!project) return null;
    if (project.updatedAt !== input.expectedUpdatedAt) throw new CanvasConflictError();
    const node = findGenerationNode(project, input.nodeId);
    if (activeGeneration(node)) return failConfiguration("该生成节点已有进行中的视频任务；请等待完成或取消后再试。");
    const aspectRatio = normalizeVideoAspectRatio(input.aspectRatio, settings.videoGenerationRatio);
    const durationSeconds = normalizeVideoDuration(input.durationSeconds, settings.videoGenerationDurationSeconds);
    const referenceAssetIds = normalizeReferenceAssetIds(input.referenceAssetIds);
    const referenceImages = await readReferenceImages(deps, userId, applicationId, projectId, project, referenceAssetIds);
    const startedAt = nowIso();
    const reservation: CanvasGenerationState = {
      kind: "video",
      prompt,
      status: "running",
      aspectRatio,
      durationSeconds,
      accountId: target.accountId,
      modelId: target.modelId,
      startedAt
    };
    const reserved = deps.canvas.updateNodeData(userId, applicationId, projectId, input.expectedUpdatedAt, node.id, { ...node.data, generation: reservation });
    if (!reserved) return null;
    let task: Awaited<ReturnType<typeof createArkVideoTask>>;
    try {
      task = await deps.createVideoTask({
        providerId: target.providerId,
        modelId: target.modelId,
        apiKey: target.apiKey,
        prompt,
        referenceImages,
        durationSeconds,
        ratio: aspectRatio,
        resolution: settings.videoGenerationResolution,
        generateAudio: settings.videoGenerationGenerateAudio,
        watermark: settings.videoGenerationWatermark,
        timeoutMs: settings.requestTimeoutSeconds * 1_000,
        ...(input.signal ? { signal: input.signal } : {})
      });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 1_000) : "火山方舟视频任务创建失败。";
      try {
        persistVideoState(userId, applicationId, projectId, node.id, { ...reservation, status: "failed", error: message, finishedAt: nowIso() });
      } catch {
        // 保留原始任务创建错误；任务状态写入失败不应伪装成创建成功。
      }
      throw error;
    }
    const status = mapProviderVideoStatus(task.status);
    const generation: CanvasGenerationState = {
      ...reservation,
      status,
      providerStatus: task.status,
      taskId: task.id,
      ...(task.error ? { error: task.error } : {})
    };
    try {
      const updated = persistVideoState(userId, applicationId, projectId, node.id, generation);
      return { project: updated ?? reserved };
    } catch (error) {
      const message = error instanceof Error ? error.message : "画布状态写入失败。";
      throw new Error("视频任务已提交（服务商任务 ID：" + task.id + "），但画布状态写入失败：" + message + "；请重新加载画布后核对服务商任务记录。");
    }
  }

  async function refreshVideo(userId: string, applicationId: ApplicationId, projectId: string, nodeId: string, signal?: AbortSignal): Promise<CanvasProject | null> {
    signal?.throwIfAborted();
    const targetNodeId = normalizedUuid(nodeId, "生成节点 ID");
    const settings = deps.readSettings(userId);
    const project = deps.canvas.read(userId, applicationId, projectId);
    if (!project) return null;
    const node = project.nodes.find(item => item.id === targetNodeId);
    if (!node) throw new CanvasGenerationNotFoundError("找不到当前画布项目中的生成节点；请刷新画布后重试。");
    const generation = readVideoGeneration(node);
    if (isTerminalGenerationStatus(generation.status)) return project;
    const credential = resolveStoredVideoCredential(deps, userId, generation.accountId!, generation.modelId!);
    const timeoutMs = settings.requestTimeoutSeconds * 1_000;
    const task = await deps.getVideoTask({ providerId: credential.providerId, taskId: generation.taskId!, apiKey: credential.apiKey, timeoutMs, ...(signal ? { signal } : {}) });
    signal?.throwIfAborted();
    if (task.status === "succeeded") {
      if (!task.videoUrl) {
        const failed: CanvasGenerationState = {
          ...generation,
          status: "failed",
          providerStatus: task.status,
          error: "服务商显示视频任务完成，但没有返回视频文件地址；画布没有登记成片。",
          finishedAt: nowIso()
        };
        return persistVideoState(userId, applicationId, projectId, targetNodeId, failed) ?? project;
      }
      const bytes = await deps.downloadVideo(task.videoUrl, timeoutMs, signal);
      signal?.throwIfAborted();
      const assetId = randomUUID();
      const succeeded: CanvasGenerationState = {
        ...generation,
        status: "succeeded",
        providerStatus: task.status,
        assetId,
        finishedAt: nowIso()
      };
      const committed = retryOnConflict(() => {
        const current = deps.canvas.read(userId, applicationId, projectId);
        if (!current) return null;
        const currentNode = current.nodes.find(item => item.id === targetNodeId);
        if (!currentNode) return null;
        return deps.canvas.commitAsset(userId, applicationId, projectId, {
          expectedUpdatedAt: current.updatedAt,
          name: generatedAssetName("video", "mp4"),
          mimeType: "video/mp4",
          bytes,
          assetId,
          node: { nodeId: targetNodeId, data: { ...currentNode.data, generation: succeeded } }
        });
      });
      if (!committed) throw new CanvasGenerationNotFoundError("画布项目或生成节点已被删除；生成视频没有登记。");
      return committed.project;
    }
    const status = mapProviderVideoStatus(task.status);
    if (status === "running") {
      if (generation.providerStatus === task.status) return project;
      const running: CanvasGenerationState = { ...generation, status: "running", providerStatus: task.status };
      return persistVideoState(userId, applicationId, projectId, targetNodeId, running) ?? project;
    }
    const failed: CanvasGenerationState = {
      ...generation,
      status: "failed",
      providerStatus: task.status,
      error: videoTaskErrorMessage(task.status, task.error),
      finishedAt: nowIso()
    };
    return persistVideoState(userId, applicationId, projectId, targetNodeId, failed) ?? project;
  }

  async function cancelVideo(userId: string, applicationId: ApplicationId, projectId: string, nodeId: string, signal?: AbortSignal): Promise<CanvasProject | null> {
    signal?.throwIfAborted();
    const targetNodeId = normalizedUuid(nodeId, "生成节点 ID");
    const settings = deps.readSettings(userId);
    const project = deps.canvas.read(userId, applicationId, projectId);
    if (!project) return null;
    const node = project.nodes.find(item => item.id === targetNodeId);
    if (!node) throw new CanvasGenerationNotFoundError("找不到当前画布项目中的生成节点；请刷新画布后重试。");
    const generation = readVideoGeneration(node);
    if (isTerminalGenerationStatus(generation.status)) return failConfiguration("该视频生成任务已结束，无法取消。");
    const credential = resolveStoredVideoCredential(deps, userId, generation.accountId!, generation.modelId!);
    await deps.cancelVideoTask({
      providerId: credential.providerId,
      taskId: generation.taskId!,
      apiKey: credential.apiKey,
      timeoutMs: settings.requestTimeoutSeconds * 1_000,
      ...(signal ? { signal } : {})
    });
    const cancelled: CanvasGenerationState = {
      ...generation,
      status: "failed",
      error: "视频任务已取消；画布没有登记成片。",
      finishedAt: nowIso()
    };
    return persistVideoState(userId, applicationId, projectId, targetNodeId, cancelled) ?? project;
  }

  return { generateImage, startVideo, refreshVideo, cancelVideo };
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    lfaaCanvasGeneration: CanvasGenerationService;
  }
}

export const name = "lfaaCanvasGeneration";
export const inject = ["lfaaCanvas", "lfaaSettings", "lfaaCredentials"];

export function apply(ctx: Context): void {
  const credentials = ctx.lfaaCredentials.createConsumer(ctx);
  const service = createCanvasGenerationService({
    canvas: ctx.lfaaCanvas,
    readSettings: userId => getUserSettings(userId).aiRuntime,
    listAccounts: userId => listAiAccounts(userId),
    resolveCredential: (userId, accountId) => credentials.resolve(userId, credentialReference("lfaa-settings", accountId)),
    generateImage: generateProviderImage,
    createVideoTask: createArkVideoTask,
    getVideoTask: getArkVideoTask,
    cancelVideoTask: cancelArkVideoTask,
    downloadVideo: downloadArkVideo
  });
  ctx.provide(name, service);
}
