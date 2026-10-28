/**
 * 功能：向 LFAA Agent 暴露系统级无限画布的真实读写与图片生成工具。
 * 作用：让小鱼、子 Agent 与「画布导演」按模型决策读写当前账户的画布项目；项目数据、并发版本、账户/App 隔离与素材归属全部委派 lfaa-canvas Owner。
 * 不负责：画布数据与素材持久化、图片/视频生成、权限模式与审批；这些分别由 lfaa-canvas、lfaaCanvasGeneration 与 Permission Owner 持有。
 * 关联文件：packages/canvas/canvas/src/index.ts、packages/canvas/canvas-generation/src/index.ts、packages/preset/persona/src/index.ts、packages/preset/domain-experts/src/domain-instructions.ts。
 */
import { randomUUID } from "node:crypto";
import type { Context } from "@deepseek-ai/cordis";
import Joi from "joi";
import {
  makeTool,
  parseWithSchema,
  strictObject,
  type AiBusinessTool,
  type AiBusinessToolContext
} from "lfaa-tools/src/tool-contract.js";
import { APPLICATION_IDS, type ApplicationId } from "lfaa-util-values/src/application-id.js";
import { CANVAS_NODE_KINDS_BY_APPLICATION } from "lfaa-util-values/src/canvas-node-types.js";
import {
  CANVAS_LIMITS,
  CanvasConflictError,
  type CanvasAsset,
  type CanvasEdge,
  type CanvasNode,
  type CanvasProject,
  type CanvasService
} from "lfaa-canvas/src/index.js";
import type { CanvasGenerateImageInput, CanvasGenerationService } from "lfaa-canvas-generation/src/index.js";

/**
 * 合同 5.2：客户端注册的画布节点类型集合。
 * 服务端 Owner 只校验节点类型标识格式与有界 JSON；工具在本集合内收敛模型可创建的节点语义，避免写入未登记的节点类型。
 */
export const CANVAS_TOOL_NODE_TYPES = [
  "text",
  "note",
  "image",
  "video",
  "audio",
  "generation",
  "subject",
  "timeline",
  "director-toolbox",
  "director-desk",
  "script",
  "asset",
  "upload"
] as const;
export type CanvasToolNodeType = (typeof CANVAS_TOOL_NODE_TYPES)[number];

/**
 * 工具创建节点时的默认尺寸；量级与画布 UI 的节点默认值一致，仍受画布 Owner 120–800 的权威范围校验。
 * 已有节点保存后的实际尺寸以项目文件为准，这里不覆盖用户调整。
 */
const DEFAULT_NODE_SIZE: Record<CanvasToolNodeType, { width: number; height: number }> = {
  text: { width: 320, height: 220 },
  note: { width: 280, height: 190 },
  image: { width: 320, height: 260 },
  video: { width: 320, height: 260 },
  audio: { width: 320, height: 180 },
  generation: { width: 340, height: 260 },
  subject: { width: 300, height: 220 },
  timeline: { width: 420, height: 260 },
  "director-toolbox": { width: 300, height: 240 },
  "director-desk": { width: 380, height: 260 },
  script: { width: 360, height: 300 },
  asset: { width: 320, height: 260 },
  upload: { width: 320, height: 200 }
};

/** 画布项目摘要：工具只返回 Owner 的真实计数与并发基线，不复制项目正文。 */
interface ProjectSummary {
  id: string;
  applicationId: ApplicationId;
  title: string;
  nodeCount: number;
  edgeCount: number;
  assetCount: number;
  createdAt: string;
  updatedAt: string;
}

const UUID_V4 = Joi.string().guid({ version: ["uuidv4"] });

const applicationIdSchema = Joi.string().valid(...APPLICATION_IDS).required().messages({
  "any.only": "applicationId 必须来自 APPLICATION_IDS 已登记的 App；画布是系统能力，但仍按 App 作用域隔离数据。"
});
const projectIdSchema = UUID_V4.required().messages({ "string.guid": "projectId 必须是 canvas_list_projects 返回的真实项目 ID。" });
const nodeIdSchema = UUID_V4.required().messages({ "string.guid": "nodeId 必须是 canvas_read_project 返回的真实节点 ID。" });
const edgeIdSchema = UUID_V4.required().messages({ "string.guid": "edgeId 必须是 canvas_connect_nodes 返回的真实连线 ID。" });
const expectedUpdatedAtSchema = Joi.string().isoDate().required().messages({
  "string.isoDate": "expectedUpdatedAt 必须是最近一次读取或写入返回的 updatedAt 时间。"
});
const nodeTypeSchema = Joi.string().valid(...CANVAS_TOOL_NODE_TYPES).required().messages({
  "any.only": "节点 type 必须是合同 5.2 登记的节点类型：" + CANVAS_TOOL_NODE_TYPES.join("、") + "。"
});
const optionalNodeTypeSchema = Joi.string().valid(...CANVAS_TOOL_NODE_TYPES).optional();
const coordinateSchema = Joi.number()
  .integer()
  .min(-CANVAS_LIMITS.coordinate)
  .max(CANVAS_LIMITS.coordinate)
  .required();
const optionalCoordinateSchema = Joi.number()
  .integer()
  .min(-CANVAS_LIMITS.coordinate)
  .max(CANVAS_LIMITS.coordinate)
  .optional();
const nodeSizeSchema = Joi.number()
  .integer()
  .min(CANVAS_LIMITS.nodeMinimumSize)
  .max(CANVAS_LIMITS.nodeMaximumSize)
  .optional();
const offsetSchema = Joi.number().integer().min(0).max(100_000).optional();
const limitSchema = Joi.number().integer().min(1).max(100).optional();
const assetIdSchema = UUID_V4;
const textSchema = Joi.string().max(CANVAS_LIMITS.textCharacters);

/** 生成节点的真实状态由画布生成 Owner 维护；工具只允许新建 idle 节点或原样保留已保存状态。 */
const generationSchema = Joi.object({
  kind: Joi.string().valid("image", "video").required(),
  prompt: Joi.string().trim().min(1).max(CANVAS_LIMITS.textCharacters).required(),
  status: Joi.string().valid("idle", "running", "succeeded", "failed").optional(),
  assetId: assetIdSchema.optional(),
  error: Joi.string().max(2_000).allow("").optional(),
  aspectRatio: Joi.string().max(16).optional(),
  durationSeconds: Joi.number().integer().min(1).max(600).optional(),
  taskId: Joi.string().max(200).optional(),
  startedAt: Joi.string().isoDate().optional(),
  finishedAt: Joi.string().isoDate().optional()
}).unknown(true);

/** 合同 5.2 的节点 data 结构；App 可扩展字段仍允许存在，但已知字段必须类型与长度正确。 */
const nodeDataSchemas: Record<CanvasToolNodeType, Joi.ObjectSchema> = {
  text: Joi.object({ text: textSchema.allow("").optional() }).unknown(true),
  note: Joi.object({ text: textSchema.allow("").optional() }).unknown(true),
  image: Joi.object({ assetId: assetIdSchema.required(), assetName: Joi.string().trim().min(1).max(120).optional() }).unknown(true),
  video: Joi.object({ assetId: assetIdSchema.required(), assetName: Joi.string().trim().min(1).max(120).optional() }).unknown(true),
  audio: Joi.object({ assetId: assetIdSchema.required(), assetName: Joi.string().trim().min(1).max(120).optional() }).unknown(true),
  generation: Joi.object({ generation: generationSchema.required() }).unknown(true),
  subject: Joi.object({
    subject: Joi.object({
      name: Joi.string().trim().min(1).max(80).required(),
      kind: Joi.string().valid("character", "location", "prop").required(),
      description: Joi.string().max(2_000).allow("").required(),
      assetIds: Joi.array().items(assetIdSchema).max(CANVAS_LIMITS.nodeAssetIds).required()
    }).unknown(true).required()
  }).unknown(true),
  timeline: Joi.object({
    timeline: Joi.object({
      clips: Joi.array().max(256).items(Joi.object({
        nodeId: UUID_V4.required(),
        assetId: assetIdSchema.optional(),
        startSeconds: Joi.number().min(0).max(100_000).required(),
        durationSeconds: Joi.number().min(0).max(100_000).required(),
        title: Joi.string().max(120).allow("").required()
      }).unknown(true)).required(),
      durationSeconds: Joi.number().min(0).max(100_000).required()
    }).unknown(true).required()
  }).unknown(true),
  "director-toolbox": Joi.object({
    preset: Joi.object({
      name: Joi.string().trim().min(1).max(80).required(),
      promptSuffix: Joi.string().max(CANVAS_LIMITS.textCharacters).allow("").required(),
      aspectRatio: Joi.string().max(16).optional()
    }).unknown(true).required()
  }).unknown(true),
  "director-desk": Joi.object({
    desk: Joi.object({
      shotNodeIds: Joi.array().items(UUID_V4).max(CANVAS_LIMITS.nodes).required()
    }).unknown(true).required()
  }).unknown(true),
  script: Joi.object({
    script: Joi.object({
      title: Joi.string().trim().min(1).max(120).required(),
      body: Joi.string().max(CANVAS_LIMITS.textCharacters).allow("").required(),
      status: Joi.string().valid("draft", "ready").required()
    }).unknown(true).required()
  }).unknown(true),
  asset: Joi.object({ assetId: assetIdSchema.optional(), assetName: Joi.string().trim().min(1).max(120).optional() }).unknown(true),
  upload: Joi.object({ assetId: assetIdSchema.optional(), assetName: Joi.string().trim().min(1).max(120).optional() }).unknown(true)
};

/** 任意节点类型都适用的素材引用字段（合同 5.1）：assetIds ≤20、references ≤64，与画布 Owner 边界一致。 */
const commonNodeDataSchema = Joi.object({
  text: textSchema,
  assetId: assetIdSchema,
  assetName: Joi.string().trim().min(1).max(120),
  assetIds: Joi.array().items(assetIdSchema).max(CANVAS_LIMITS.nodeAssetIds),
  references: Joi.array().items(Joi.object({ assetId: assetIdSchema.required() }).unknown(true)).max(CANVAS_LIMITS.nodeReferences)
}).unknown(true);

const nodeDataParamSchema = Joi.object().required().messages({ "object.base": "节点 data 必须是 JSON 对象。" });

const toolApplicationIdProperty = { type: "string", enum: [...APPLICATION_IDS] };
const toolProjectIdProperty = { type: "string", format: "uuid" };
const toolNodeIdProperty = { type: "string", format: "uuid" };
const toolEdgeIdProperty = { type: "string", format: "uuid" };
const toolExpectedUpdatedAtProperty = { type: "string", format: "date-time" };
const toolNodeTypeProperty = { type: "string", enum: [...CANVAS_TOOL_NODE_TYPES] };
const toolCoordinateProperty = { type: "integer", minimum: -CANVAS_LIMITS.coordinate, maximum: CANVAS_LIMITS.coordinate };
const toolNodeSizeProperty = { type: "integer", minimum: CANVAS_LIMITS.nodeMinimumSize, maximum: CANVAS_LIMITS.nodeMaximumSize };
const toolOffsetProperty = { type: "integer", minimum: 0, maximum: 100_000 };
const toolLimitProperty = { type: "integer", minimum: 1, maximum: 100 };

const listProjectsSchema = strictObject({ applicationId: toolApplicationIdProperty }, ["applicationId"]);
const readProjectSchema = strictObject({
  applicationId: toolApplicationIdProperty,
  projectId: toolProjectIdProperty,
  section: { type: "string", enum: ["project", "nodes", "edges", "assets"] },
  offset: toolOffsetProperty,
  limit: toolLimitProperty
}, ["applicationId", "projectId", "section"]);
const createProjectSchema = strictObject({
  applicationId: toolApplicationIdProperty,
  title: { type: "string", minLength: 1, maxLength: 80 }
}, ["applicationId", "title"]);
const addNodeSchema = strictObject({
  applicationId: toolApplicationIdProperty,
  projectId: toolProjectIdProperty,
  expectedUpdatedAt: toolExpectedUpdatedAtProperty,
  type: toolNodeTypeProperty,
  x: toolCoordinateProperty,
  y: toolCoordinateProperty,
  width: toolNodeSizeProperty,
  height: toolNodeSizeProperty,
  data: { type: "object" }
}, ["applicationId", "projectId", "expectedUpdatedAt", "type", "x", "y", "data"]);
const updateNodeSchema = strictObject({
  applicationId: toolApplicationIdProperty,
  projectId: toolProjectIdProperty,
  expectedUpdatedAt: toolExpectedUpdatedAtProperty,
  nodeId: toolNodeIdProperty,
  type: toolNodeTypeProperty,
  x: toolCoordinateProperty,
  y: toolCoordinateProperty,
  width: toolNodeSizeProperty,
  height: toolNodeSizeProperty,
  data: { type: "object" }
}, ["applicationId", "projectId", "expectedUpdatedAt", "nodeId"]);
const removeNodeSchema = strictObject({
  applicationId: toolApplicationIdProperty,
  projectId: toolProjectIdProperty,
  expectedUpdatedAt: toolExpectedUpdatedAtProperty,
  nodeId: toolNodeIdProperty
}, ["applicationId", "projectId", "expectedUpdatedAt", "nodeId"]);
const connectNodesSchema = strictObject({
  applicationId: toolApplicationIdProperty,
  projectId: toolProjectIdProperty,
  expectedUpdatedAt: toolExpectedUpdatedAtProperty,
  source: toolNodeIdProperty,
  target: toolNodeIdProperty,
  sourceHandle: { type: "string", maxLength: 200 },
  targetHandle: { type: "string", maxLength: 200 }
}, ["applicationId", "projectId", "expectedUpdatedAt", "source", "target"]);
const disconnectNodesSchema = strictObject({
  applicationId: toolApplicationIdProperty,
  projectId: toolProjectIdProperty,
  expectedUpdatedAt: toolExpectedUpdatedAtProperty,
  edgeId: toolEdgeIdProperty
}, ["applicationId", "projectId", "expectedUpdatedAt", "edgeId"]);
const listAssetsSchema = strictObject({
  applicationId: toolApplicationIdProperty,
  projectId: toolProjectIdProperty,
  offset: toolOffsetProperty,
  limit: toolLimitProperty
}, ["applicationId", "projectId"]);
const listImageModelsSchema = strictObject({
  applicationId: toolApplicationIdProperty
}, ["applicationId"]);
const generateImageSchema = strictObject({
  applicationId: toolApplicationIdProperty,
  projectId: toolProjectIdProperty,
  expectedUpdatedAt: toolExpectedUpdatedAtProperty,
  nodeId: toolNodeIdProperty,
  prompt: { type: "string", minLength: 1, maxLength: CANVAS_LIMITS.textCharacters },
  aspectRatio: { type: "string", enum: ["1:1", "4:3", "3:4", "16:9", "9:16", "2:1"] },
  referenceAssetIds: { type: "array", maxItems: CANVAS_LIMITS.assets, items: { type: "string", format: "uuid" } },
  modelTarget: {
    type: "object",
    properties: { accountId: { type: "string", minLength: 1, maxLength: 160 }, modelId: { type: "string", minLength: 1, maxLength: 160 } },
    required: ["accountId", "modelId"],
    additionalProperties: false
  }
}, ["applicationId", "projectId", "expectedUpdatedAt", "prompt"]);

/**
 * 画布生成 Owner 服务名（A 任务新增 packages/canvas/canvas-generation）。
 * 工具通过 ctx.get 读取可选服务：未装配时如实报错，绝不伪造生成结果。
 */
const GENERATION_SERVICE_NAME = "lfaaCanvasGeneration";
const generationUnavailableMessage = "画布生成 Owner（lfaaCanvasGeneration）尚未装配；本次没有发起任何图片生成请求，也没有写入任何成功结果。请先完成画布生成能力装配后重试。"

function projectSummary(project: CanvasProject): ProjectSummary {
  return {
    id: project.id,
    applicationId: project.applicationId,
    title: project.title,
    nodeCount: project.nodes.length,
    edgeCount: project.edges.length,
    assetCount: project.assets.length,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 409 并发冲突：保留 Owner 的真实冲突语义，并给出模型下一步可执行动作。 */
function canvasConflictError(): Error {
  return new Error("画布已被其他操作更新（HTTP 409 冲突）；本次没有写入。请先用 canvas_read_project 重新读取项目与最新 updatedAt，再重试。");
}

function assertExpectedVersion(project: CanvasProject, expectedUpdatedAt: unknown): void {
  if (project.updatedAt !== String(expectedUpdatedAt)) throw canvasConflictError();
}

function assertCurrentApplication(context: AiBusinessToolContext, applicationId: ApplicationId): void {
  if (context.applicationId !== applicationId) throw new Error("画布 Agent 只能操作当前 App 的项目；请在目标 App 中打开画布后再执行。");
}

function requireProject(service: CanvasService, context: AiBusinessToolContext, applicationId: ApplicationId, projectId: string): CanvasProject {
  assertCurrentApplication(context, applicationId);
  const project = service.read(context.userId, applicationId, projectId);
  if (!project) throw new Error("找不到当前账户与 App 作用域下的画布项目；请先用 canvas_list_projects 读取真实项目 ID，不要猜测。");
  return project;
}

/** 统一提交整份项目文档：写入、并发拒绝与删除竞争都由画布 Owner 判定，工具只组装节点/连线。 */
function commitProject(
  service: CanvasService,
  context: AiBusinessToolContext,
  project: CanvasProject,
  expectedUpdatedAt: unknown,
  next: { nodes: CanvasNode[]; edges: CanvasEdge[] }
): CanvasProject {
  try {
    const updated = service.update(context.userId, project.applicationId, project.id, String(expectedUpdatedAt), {
      title: project.title,
      viewport: project.viewport,
      nodes: next.nodes,
      edges: next.edges
    });
    if (!updated) throw new Error("画布项目在写入前已被删除；本次没有保存任何修改。");
    return updated;
  } catch (error) {
    if (error instanceof CanvasConflictError) throw canvasConflictError();
    throw error;
  }
}

/** 收集节点 data 中按合同 5.1 必须引用项目内素材的字段，供写入前校验。 */
function referencedAssetIds(data: Record<string, unknown>): string[] {
  const ids = new Set<string>();
  const collect = (value: unknown) => {
    if (typeof value === "string") ids.add(value);
  };
  collect(data.assetId);
  if (Array.isArray(data.assetIds)) for (const id of data.assetIds) collect(id);
  if (Array.isArray(data.references)) {
    for (const reference of data.references) if (isRecord(reference)) collect(reference.assetId);
  }
  if (isRecord(data.subject) && Array.isArray(data.subject.assetIds)) {
    for (const id of data.subject.assetIds) collect(id);
  }
  if (isRecord(data.timeline) && Array.isArray(data.timeline.clips)) {
    for (const clip of data.timeline.clips) if (isRecord(clip)) collect(clip.assetId);
  }
  if (isRecord(data.generation)) collect(data.generation.assetId);
  return [...ids];
}

const MEDIA_NODE_MIME_PREFIX: Partial<Record<CanvasToolNodeType, string>> = {
  image: "image/",
  video: "video/",
  audio: "audio/"
};

/**
 * 按节点类型校验合同 5.2 的已知字段与长度；允许 App 扩展字段，但总 JSON 仍受 64 KiB 上限。
 * 该函数不读取项目，因此在工具 parse 阶段即可拒绝非法参数，避免非法数据进入执行器。
 */
function validateNodeDataShape(type: string, value: unknown): Record<string, unknown> {
  const schema = (nodeDataSchemas as Record<string, Joi.ObjectSchema>)[type] ?? Joi.object({}).unknown(true);
  const result = schema.validate(value, { abortEarly: false, convert: false, stripUnknown: false });
  if (result.error) {
    throw new Error("画布节点数据无效：" + result.error.details.map(detail => detail.message).join("；"));
  }
  const common = commonNodeDataSchema.validate(value, { abortEarly: false, convert: false, stripUnknown: false });
  if (common.error) {
    throw new Error("画布节点素材引用无效：" + common.error.details.map(detail => detail.message).join("；"));
  }
  const data = result.value as Record<string, unknown>;
  if (JSON.stringify(data).length > CANVAS_LIMITS.nodeDataBytes) {
    throw new Error("画布节点数据超过 " + CANVAS_LIMITS.nodeDataBytes + " 字节上限；请精简文本或拆分节点。");
  }
  return data;
}

/**
 * 在真实项目上下文中规范化节点 data：
 * 1) 复用形状校验；2) 生成节点状态只由生成 Owner 在真实结果后推进；3) 素材引用必须来自当前项目。
 */
function normalizeNodeData(
  type: string,
  value: unknown,
  project: CanvasProject,
  existing: CanvasNode | null
): Record<string, unknown> {
  const data = validateNodeDataShape(type, value);
  if (isRecord(data.generation)) {
    const generation = data.generation as Record<string, unknown>;
    const existingGeneration = existing && isRecord(existing.data.generation) ? existing.data.generation : null;
    const existingStatus = existingGeneration && typeof existingGeneration.status === "string" ? existingGeneration.status : null;
    const status = typeof generation.status === "string" ? generation.status : null;
    if (status !== null && status !== "idle" && status !== existingStatus) {
      throw new Error("画布生成节点的状态只能由画布生成 Owner 在真实生成后写入；工具不能把节点标记为 running/succeeded/failed。需要出图请调用 canvas_generate_image。");
    }
    if (status === null) generation.status = existingStatus ?? "idle";
  }
  const assetIds = new Set(project.assets.map(asset => asset.assetId));
  for (const assetId of referencedAssetIds(data)) {
    if (!assetIds.has(assetId)) {
      throw new Error("节点引用的素材不在当前画布项目中（素材 ID " + assetId + "）；请先用 canvas_list_assets 读取真实素材。");
    }
  }
  const mimePrefix = MEDIA_NODE_MIME_PREFIX[type as CanvasToolNodeType];
  if (mimePrefix && typeof data.assetId === "string") {
    const asset = project.assets.find(item => item.assetId === data.assetId);
    if (!asset) return data;
    if (!asset.mimeType.startsWith(mimePrefix)) {
      throw new Error("节点类型 " + type + " 只能引用 " + mimePrefix + "* 素材；当前素材是 " + asset.mimeType + "。");
    }
    // 素材名以 Owner 保存的真实记录为准，避免模型写入与项目不一致的名称。
    data.assetName = asset.name;
  }
  return data;
}

/** 节点分页：按条数与 JSON 字符预算双上限读取，数据保持原文，不截断字段。 */
function nodePage(project: CanvasProject, offset: number, requestedLimit: number | undefined): Record<string, unknown> {
  const limit = Math.min(requestedLimit ?? 5, 20);
  const budgetCharacters = 48_000;
  const items: CanvasNode[] = [];
  let characters = 0;
  for (let index = offset; index < project.nodes.length && items.length < limit; index += 1) {
    const node = project.nodes[index]!;
    const size = JSON.stringify(node).length;
    if (items.length > 0 && characters + size > budgetCharacters) break;
    items.push(node);
    characters += size;
  }
  const nextOffset = offset + items.length;
  return {
    section: "nodes",
    offset,
    limit,
    totalItems: project.nodes.length,
    pageCharacters: characters,
    items,
    nextOffset: nextOffset < project.nodes.length ? nextOffset : null
  };
}

function edgePage(project: CanvasProject, offset: number, requestedLimit: number | undefined): Record<string, unknown> {
  const limit = Math.min(requestedLimit ?? 50, 100);
  const items = project.edges.slice(offset, offset + limit);
  const nextOffset = offset + items.length;
  return {
    section: "edges",
    offset,
    limit,
    totalItems: project.edges.length,
    items,
    nextOffset: nextOffset < project.edges.length ? nextOffset : null
  };
}

function assetPage(project: CanvasProject, offset: number, requestedLimit: number | undefined): Record<string, unknown> {
  const limit = Math.min(requestedLimit ?? 20, 50);
  const items = project.assets.slice(offset, offset + limit);
  const nextOffset = offset + items.length;
  return {
    section: "assets",
    offset,
    limit,
    totalItems: project.assets.length,
    items,
    nextOffset: nextOffset < project.assets.length ? nextOffset : null
  };
}

function listedAssets(project: CanvasProject, offset: number, requestedLimit: number | undefined): Record<string, unknown> {
  const page = assetPage(project, offset, requestedLimit);
  const counts = new Map<string, number>();
  for (const node of project.nodes) {
    for (const assetId of new Set(referencedAssetIds(node.data))) counts.set(assetId, (counts.get(assetId) ?? 0) + 1);
  }
  const items = (page.items as CanvasAsset[]).map(asset => ({ ...asset, referencedByNodeCount: counts.get(asset.assetId) ?? 0 }));
  return {
    ...page,
    items,
    usage: {
      assetCount: project.assets.length,
      assetBytes: project.assets.reduce((total, asset) => total + asset.bytes, 0),
      limits: { assets: CANVAS_LIMITS.assets, projectAssetBytes: CANVAS_LIMITS.projectAssetBytes }
    }
  };
}

/** 画布生成 Owner 的可选服务读取器；未装配时工具明确失败，不伪造结果。 */
export type CanvasGenerationReader = () => unknown;

function requireGenerationService(readGeneration: CanvasGenerationReader): CanvasGenerationService {
  const generation = readGeneration() as CanvasGenerationService | undefined;
  if (!generation || typeof generation.generateImage !== "function") throw new Error(generationUnavailableMessage);
  return generation;
}

function listProjectsTool(service: CanvasService): AiBusinessTool {
  return makeTool({
    id: "canvas.projects.list",
    name: "canvas_list_projects",
    coreManaged: true,
    applicationIds: [...APPLICATION_IDS],
    activityTitle: "读取画布项目",
    description: "列出当前账户在指定 App 作用域内的真实画布项目摘要（ID、标题、节点/素材数量、更新时间）。画布是所有 App 共用的系统能力；必须显式传 applicationId，后续读写必须使用这里返回的项目 ID 与 updatedAt。",
    schema: listProjectsSchema,
    parse: value => parseWithSchema(Joi.object({ applicationId: applicationIdSchema }).unknown(false), value),
    risk: () => "read",
    execute: async (parameters, context) => {
      context.signal.throwIfAborted();
      const applicationId = parameters.applicationId as ApplicationId;
      assertCurrentApplication(context, applicationId);
      const projects = service.list(context.userId, applicationId).map(summary => ({
        id: summary.id,
        applicationId: summary.applicationId,
        title: summary.title,
        nodeCount: summary.nodeCount,
        assetCount: summary.assetCount,
        createdAt: summary.createdAt,
        updatedAt: summary.updatedAt
      }));
      return { applicationId, total: projects.length, projects };
    }
  });
}

function readProjectTool(service: CanvasService): AiBusinessTool {
  return makeTool({
    id: "canvas.projects.read",
    name: "canvas_read_project",
    coreManaged: true,
    applicationIds: [...APPLICATION_IDS],
    activityTitle: "读取画布项目内容",
    description: "按 section 分页读取真实画布项目：project 返回摘要/视口/计数，nodes 返回节点（默认 5 个、最多 20 个，并按 JSON 字节预算继续分页），edges（默认 50、最多 100），assets（默认 20、最多 50）。使用返回的 nextOffset 继续读取；写操作必须携带本次返回的 updatedAt。",
    schema: readProjectSchema,
    parse: value => parseWithSchema(Joi.object({
      applicationId: applicationIdSchema,
      projectId: projectIdSchema,
      section: Joi.string().valid("project", "nodes", "edges", "assets").required().messages({
        "any.only": "section 只支持 project、nodes、edges、assets。"
      }),
      offset: offsetSchema,
      limit: limitSchema
    }).unknown(false), value),
    risk: () => "read",
    execute: async (parameters, context) => {
      context.signal.throwIfAborted();
      const project = requireProject(service, context, parameters.applicationId as ApplicationId, String(parameters.projectId));
      const section = String(parameters.section);
      const offset = Number(parameters.offset ?? 0);
      const summary = projectSummary(project);
      if (section === "project") {
        return {
          section,
          project: summary,
          viewport: project.viewport,
          format: project.format,
          formatVersion: project.formatVersion,
          nextStep: "按需要读取 nodes/edges/assets，并把当前 updatedAt 作为写操作的 expectedUpdatedAt。"
        };
      }
      if (section === "nodes") return { project: summary, ...nodePage(project, offset, parameters.limit as number | undefined) };
      if (section === "edges") return { project: summary, ...edgePage(project, offset, parameters.limit as number | undefined) };
      return { project: summary, ...assetPage(project, offset, parameters.limit as number | undefined) };
    }
  });
}

function createProjectTool(service: CanvasService): AiBusinessTool {
  return makeTool({
    id: "canvas.projects.create",
    name: "canvas_create_project",
    coreManaged: true,
    applicationIds: [...APPLICATION_IDS],
    activityTitle: "新建画布项目",
    description: "在当前账户指定 App 作用域内新建一个空白真实画布项目。画布是所有 App 共用的系统能力，但项目按账户 + App 隔离；创建后使用返回的项目 ID 与 updatedAt 添加节点。",
    schema: createProjectSchema,
    parse: value => parseWithSchema(Joi.object({ applicationId: applicationIdSchema, title: Joi.string().trim().min(1).max(80).required() }).unknown(false), value),
    risk: () => "write",
    approval: parameters => ({
      scopeKey: "canvas:" + String(parameters.applicationId) + ":project:create",
      scopeSummary: "当前账户 " + String(parameters.applicationId) + " App 的画布项目",
      summary: "新建一个画布项目"
    }),
    execute: async (parameters, context) => {
      context.signal.throwIfAborted();
      assertCurrentApplication(context, parameters.applicationId as ApplicationId);
      const project = service.create(context.userId, parameters.applicationId as ApplicationId, parameters.title);
      return {
        created: true,
        project: projectSummary(project),
        nextStep: "使用返回的 project.id 与 updatedAt 调用 canvas_add_node 添加真实节点。"
      };
    }
  });
}

function addNodeTool(service: CanvasService): AiBusinessTool {
  return makeTool({
    id: "canvas.nodes.add",
    name: "canvas_add_node",
    coreManaged: true,
    applicationIds: [...APPLICATION_IDS],
    activityTitle: "添加画布节点",
    description: "在真实画布项目内添加一个节点并返回保存后的节点与最新 updatedAt。type 必须是合同登记的节点类型；data 按类型校验（文本 ≤20000 字符、节点数据 ≤64 KiB），素材引用必须来自当前项目。写操作必须携带最近读取的 expectedUpdatedAt，冲突会返回真实 409。",
    schema: addNodeSchema,
    parse: value => {
      const parsed = parseWithSchema(Joi.object({
        applicationId: applicationIdSchema,
        projectId: projectIdSchema,
        expectedUpdatedAt: expectedUpdatedAtSchema,
        type: nodeTypeSchema,
        x: coordinateSchema,
        y: coordinateSchema,
        width: nodeSizeSchema,
        height: nodeSizeSchema,
        data: nodeDataParamSchema
      }).unknown(false), value);
      // 依赖 type 的 data 形状校验在 parse 阶段完成；素材存在性仍需读取真实项目后在 execute 校验。
      validateNodeDataShape(String(parsed.type), parsed.data);
      return parsed;
    },
    risk: () => "write",
    approval: parameters => ({
      scopeKey: "canvas:" + String(parameters.applicationId) + ":project:" + String(parameters.projectId) + ":structure",
      scopeSummary: "单个画布项目的节点与连线",
      summary: "在画布项目中添加节点"
    }),
    execute: async (parameters, context) => {
      context.signal.throwIfAborted();
      const applicationId = parameters.applicationId as ApplicationId;
      const project = requireProject(service, context, applicationId, String(parameters.projectId));
      assertExpectedVersion(project, parameters.expectedUpdatedAt);
      if (project.nodes.length >= CANVAS_LIMITS.nodes) throw new Error("每个画布最多保存 " + CANVAS_LIMITS.nodes + " 个节点；请先删除不再使用的节点。");
      const type = String(parameters.type) as CanvasToolNodeType;
      if (!CANVAS_NODE_KINDS_BY_APPLICATION[applicationId].includes(type)) throw new Error("节点类型“" + type + "”未登记给当前 App。");
      const data = normalizeNodeData(type, parameters.data, project, null);
      const defaults = DEFAULT_NODE_SIZE[type];
      const node: CanvasNode = {
        id: randomUUID(),
        type,
        x: Number(parameters.x),
        y: Number(parameters.y),
        width: Number(parameters.width ?? defaults.width),
        height: Number(parameters.height ?? defaults.height),
        data
      };
      const updated = commitProject(service, context, project, parameters.expectedUpdatedAt, { nodes: [...project.nodes, node], edges: project.edges });
      return { added: true, project: projectSummary(updated), node, updatedAt: updated.updatedAt };
    }
  });
}

function updateNodeTool(service: CanvasService): AiBusinessTool {
  return makeTool({
    id: "canvas.nodes.update",
    name: "canvas_update_node",
    coreManaged: true,
    applicationIds: [...APPLICATION_IDS],
    activityTitle: "更新画布节点",
    description: "更新画布项目中指定节点明确提供的字段；未提供的字段保持现状。type/data 按合同节点类型校验，data 是整组替换，编辑前请先读取完整节点。必须携带最近一次读取或写入返回的 expectedUpdatedAt，冲突返回真实 409。",
    schema: updateNodeSchema,
    parse: value => {
      const parsed = parseWithSchema(Joi.object({
        applicationId: applicationIdSchema,
        projectId: projectIdSchema,
        expectedUpdatedAt: expectedUpdatedAtSchema,
        nodeId: nodeIdSchema,
        type: optionalNodeTypeSchema,
        x: optionalCoordinateSchema,
        y: optionalCoordinateSchema,
        width: nodeSizeSchema,
        height: nodeSizeSchema,
        data: Joi.object().optional()
      }).unknown(false), value);
      // 未提供 type 时以项目内真实节点类型为准，只能在 execute 阶段校验 data；
      // 同时提供时在 parse 阶段就拒绝不合法数据。
      if (parsed.type !== undefined && parsed.data !== undefined) validateNodeDataShape(String(parsed.type), parsed.data);
      return parsed;
    },
    risk: () => "write",
    approval: parameters => ({
      scopeKey: "canvas:" + String(parameters.applicationId) + ":project:" + String(parameters.projectId) + ":structure",
      scopeSummary: "单个画布项目的节点与连线",
      summary: "更新画布节点"
    }),
    execute: async (parameters, context) => {
      context.signal.throwIfAborted();
      const project = requireProject(service, context, parameters.applicationId as ApplicationId, String(parameters.projectId));
      assertExpectedVersion(project, parameters.expectedUpdatedAt);
      const index = project.nodes.findIndex(node => node.id === String(parameters.nodeId));
      if (index === -1) throw new Error("找不到该项目中的画布节点；请先用 canvas_read_project 读取真实节点 ID。");
      const current = project.nodes[index]!;
      const type = parameters.type === undefined ? current.type : String(parameters.type);
      if (!CANVAS_NODE_KINDS_BY_APPLICATION[project.applicationId].includes(type)) throw new Error("节点类型“" + type + "”未登记给当前 App。");
      const data = normalizeNodeData(type, parameters.data === undefined ? current.data : parameters.data, project, current);
      const node: CanvasNode = {
        ...current,
        type,
        x: parameters.x === undefined ? current.x : Number(parameters.x),
        y: parameters.y === undefined ? current.y : Number(parameters.y),
        width: parameters.width === undefined ? current.width : Number(parameters.width),
        height: parameters.height === undefined ? current.height : Number(parameters.height),
        data
      };
      const nodes = project.nodes.slice();
      nodes[index] = node;
      const updated = commitProject(service, context, project, parameters.expectedUpdatedAt, { nodes, edges: project.edges });
      return { updated: true, project: projectSummary(updated), node, updatedAt: updated.updatedAt };
    }
  });
}

function removeNodeTool(service: CanvasService): AiBusinessTool {
  return makeTool({
    id: "canvas.nodes.remove",
    name: "canvas_remove_node",
    coreManaged: true,
    applicationIds: [...APPLICATION_IDS],
    activityTitle: "删除画布节点",
    description: "删除画布项目中的指定节点，并同步移除挂在该节点上的连线（否则项目文档会引用不存在的节点）。必须携带最近一次读取返回的 expectedUpdatedAt；返回真实删除结果与剩余连线数量。",
    schema: removeNodeSchema,
    parse: value => parseWithSchema(Joi.object({
      applicationId: applicationIdSchema,
      projectId: projectIdSchema,
      expectedUpdatedAt: expectedUpdatedAtSchema,
      nodeId: nodeIdSchema
    }).unknown(false), value),
    risk: () => "write",
    approval: parameters => ({
      scopeKey: "canvas:" + String(parameters.applicationId) + ":project:" + String(parameters.projectId) + ":nodes:delete",
      scopeSummary: "单个画布项目的节点删除",
      summary: "删除画布节点及其连线"
    }),
    execute: async (parameters, context) => {
      context.signal.throwIfAborted();
      const project = requireProject(service, context, parameters.applicationId as ApplicationId, String(parameters.projectId));
      assertExpectedVersion(project, parameters.expectedUpdatedAt);
      const nodeId = String(parameters.nodeId);
      const node = project.nodes.find(item => item.id === nodeId);
      if (!node) throw new Error("找不到要删除的画布节点；请先用 canvas_read_project 读取真实节点 ID。");
      const nodes = project.nodes.filter(item => item.id !== nodeId);
      const edges = project.edges.filter(edge => edge.source !== nodeId && edge.target !== nodeId);
      const updated = commitProject(service, context, project, parameters.expectedUpdatedAt, { nodes, edges });
      return {
        removed: true,
        project: projectSummary(updated),
        nodeId,
        removedEdgeCount: project.edges.length - edges.length,
        updatedAt: updated.updatedAt
      };
    }
  });
}

function connectNodesTool(service: CanvasService): AiBusinessTool {
  return makeTool({
    id: "canvas.nodes.connect",
    name: "canvas_connect_nodes",
    coreManaged: true,
    applicationIds: [...APPLICATION_IDS],
    activityTitle: "连接画布节点",
    description: "连接当前画布项目中的两个不同节点，返回真实连线 ID 与最新 updatedAt。连线只表示画布关系，不等同于可执行 Workflow；必须携带最近一次读取返回的 expectedUpdatedAt。",
    schema: connectNodesSchema,
    parse: value => parseWithSchema(Joi.object({
      applicationId: applicationIdSchema,
      projectId: projectIdSchema,
      expectedUpdatedAt: expectedUpdatedAtSchema,
      source: nodeIdSchema,
      target: nodeIdSchema,
      sourceHandle: Joi.string().max(200).optional(),
      targetHandle: Joi.string().max(200).optional()
    }).unknown(false), value),
    risk: () => "write",
    approval: parameters => ({
      scopeKey: "canvas:" + String(parameters.applicationId) + ":project:" + String(parameters.projectId) + ":structure",
      scopeSummary: "单个画布项目的节点与连线",
      summary: "连接画布节点"
    }),
    execute: async (parameters, context) => {
      context.signal.throwIfAborted();
      const project = requireProject(service, context, parameters.applicationId as ApplicationId, String(parameters.projectId));
      assertExpectedVersion(project, parameters.expectedUpdatedAt);
      const source = String(parameters.source);
      const target = String(parameters.target);
      if (source === target) throw new Error("连线必须连接两个不同的画布节点。");
      const known = new Set(project.nodes.map(node => node.id));
      if (!known.has(source) || !known.has(target)) throw new Error("连线端点必须是当前项目中真实存在的画布节点。");
      if (project.edges.length >= CANVAS_LIMITS.edges) throw new Error("每个画布最多保存 " + CANVAS_LIMITS.edges + " 条连线；请先断开不再需要的连线。");
      const edge: CanvasEdge = {
        id: randomUUID(),
        source,
        target,
        ...(parameters.sourceHandle === undefined ? {} : { sourceHandle: String(parameters.sourceHandle) }),
        ...(parameters.targetHandle === undefined ? {} : { targetHandle: String(parameters.targetHandle) })
      };
      const updated = commitProject(service, context, project, parameters.expectedUpdatedAt, { nodes: project.nodes, edges: [...project.edges, edge] });
      return { connected: true, project: projectSummary(updated), edge, updatedAt: updated.updatedAt };
    }
  });
}

function disconnectNodesTool(service: CanvasService): AiBusinessTool {
  return makeTool({
    id: "canvas.nodes.disconnect",
    name: "canvas_disconnect_nodes",
    coreManaged: true,
    applicationIds: [...APPLICATION_IDS],
    activityTitle: "断开画布连线",
    description: "断开画布项目中指定的一条连线；只删除真实存在的连线，不猜测端点。必须携带最近一次读取返回的 expectedUpdatedAt，返回更新后的项目摘要。",
    schema: disconnectNodesSchema,
    parse: value => parseWithSchema(Joi.object({
      applicationId: applicationIdSchema,
      projectId: projectIdSchema,
      expectedUpdatedAt: expectedUpdatedAtSchema,
      edgeId: edgeIdSchema
    }).unknown(false), value),
    risk: () => "write",
    approval: parameters => ({
      scopeKey: "canvas:" + String(parameters.applicationId) + ":project:" + String(parameters.projectId) + ":structure",
      scopeSummary: "单个画布项目的节点与连线",
      summary: "断开画布连线"
    }),
    execute: async (parameters, context) => {
      context.signal.throwIfAborted();
      const project = requireProject(service, context, parameters.applicationId as ApplicationId, String(parameters.projectId));
      assertExpectedVersion(project, parameters.expectedUpdatedAt);
      const edgeId = String(parameters.edgeId);
      const edge = project.edges.find(item => item.id === edgeId);
      if (!edge) throw new Error("找不到要断开的画布连线；请先用 canvas_read_project 的 edges 分页读取真实连线 ID。");
      const updated = commitProject(service, context, project, parameters.expectedUpdatedAt, {
        nodes: project.nodes,
        edges: project.edges.filter(item => item.id !== edgeId)
      });
      return { disconnected: true, project: projectSummary(updated), edgeId, updatedAt: updated.updatedAt };
    }
  });
}

function listAssetsTool(service: CanvasService): AiBusinessTool {
  return makeTool({
    id: "canvas.assets.list",
    name: "canvas_list_assets",
    coreManaged: true,
    applicationIds: [...APPLICATION_IDS],
    activityTitle: "读取画布素材",
    description: "分页读取画布项目的真实素材元数据（ID、名称、MIME、字节、创建时间、被节点引用次数）与容量使用。素材二进制不通过该工具传输；节点的 assetId 只能来自这里或 canvas_read_project 返回的真实素材。",
    schema: listAssetsSchema,
    parse: value => parseWithSchema(Joi.object({
      applicationId: applicationIdSchema,
      projectId: projectIdSchema,
      offset: offsetSchema,
      limit: limitSchema
    }).unknown(false), value),
    risk: () => "read",
    execute: async (parameters, context) => {
      context.signal.throwIfAborted();
      const project = requireProject(service, context, parameters.applicationId as ApplicationId, String(parameters.projectId));
      return {
        project: projectSummary(project),
        ...listedAssets(project, Number(parameters.offset ?? 0), parameters.limit as number | undefined)
      };
    }
  });
}

function listImageModelsTool(readGeneration: CanvasGenerationReader): AiBusinessTool {
  return makeTool({
    id: "canvas.generation.image-models",
    name: "canvas_list_image_models",
    coreManaged: true,
    applicationIds: [...APPLICATION_IDS],
    activityTitle: "读取可用图片模型",
    description: "读取当前账户画布可用的图片模型：包含设置中心已选默认图片模型，以及 Agent Plan 官方目录中 taskType=image-generation 且符合所选套餐档位的模型。只返回账户/模型标识和公开目录元数据，不返回密钥，也不修改设置。用户指定模型/套餐，或尚无默认图片模型时先调用本工具；随后可在 canvas_generate_image 的 modelTarget 中选择这里返回的账户和模型。画布使用远程 Provider，漫剧本机引擎设置不会拦截画布请求。",
    schema: listImageModelsSchema,
    parse: value => parseWithSchema(Joi.object({ applicationId: applicationIdSchema }).unknown(false), value),
    risk: () => "read",
    execute: async (parameters, context) => {
      context.signal.throwIfAborted();
      const applicationId = parameters.applicationId as ApplicationId;
      assertCurrentApplication(context, applicationId);
      const generation = requireGenerationService(readGeneration);
      if (typeof generation.listImageModels !== "function") throw new Error("当前画布生成 Owner 未提供图片模型目录；没有读取或修改设置。");
      const options = generation.listImageModels(context.userId);
      return {
        applicationId,
        defaultModel: options.find(option => option.isDefault) ?? null,
        models: options,
        nextStep: options.length
          ? "只从 models 返回的账户/模型中选择；使用 modelTarget 调用 canvas_generate_image 可仅对本次请求生效，不会更改默认设置。"
          : "当前账户没有已选默认图片模型或可用的 Agent Plan 图像模型；请在设置中心 AI 与模型中保存图片账户和选择模型。"
      };
    }
  });
}

function generateImageTool(service: CanvasService, readGeneration: CanvasGenerationReader): AiBusinessTool {
  return makeTool({
    id: "canvas.generation.image",
    name: "canvas_generate_image",
    coreManaged: true,
    applicationIds: [...APPLICATION_IDS],
    activityTitle: "生成画布图片",
    description: "调用画布生成 Owner 为画布项目生成一张真实图片，并把结果登记为项目素材、返回真实 assetId；通常使用设置中心默认图片模型。若用户指定模型，或没有默认图片模型，先调用 canvas_list_image_models，再将返回的账户与模型以 modelTarget 指定，本次选择不更改用户默认设置。Agent Plan 只接受官方目录中的 image-generation 模型和适用套餐档位。画布使用远程 Provider，AI 漫剧的本机引擎选择不会拦截它。2:1 只表示全景比例图像，不是真全景渲染。该操作可能产生服务商费用，必须服从 Permission Owner。账户/模型/密钥缺失或生成失败时返回真实原因，不伪造成功；必须携带最近读取的 expectedUpdatedAt。",
    schema: generateImageSchema,
    parse: value => parseWithSchema(Joi.object({
      applicationId: applicationIdSchema,
      projectId: projectIdSchema,
      expectedUpdatedAt: expectedUpdatedAtSchema,
      nodeId: nodeIdSchema.optional(),
      prompt: Joi.string().trim().min(1).max(CANVAS_LIMITS.textCharacters).required(),
      aspectRatio: Joi.string().valid("1:1", "4:3", "3:4", "16:9", "9:16", "2:1").optional().messages({
        "any.only": "aspectRatio 只支持 1:1、4:3、3:4、16:9、9:16 或 2:1。"
      }),
      referenceAssetIds: Joi.array().max(CANVAS_LIMITS.assets).items(assetIdSchema).optional(),
      modelTarget: Joi.object({
        accountId: Joi.string().trim().min(1).max(160).required(),
        modelId: Joi.string().trim().min(1).max(160).required()
      }).unknown(false).optional()
    }).unknown(false), value),
    risk: () => "dangerous",
    approval: parameters => ({
      scopeKey: "canvas:" + String(parameters.applicationId) + ":project:" + String(parameters.projectId) + ":generate-image",
      scopeSummary: "单个画布项目的一次图片生成",
      summary: "调用设置中心选中的图片模型生成一张画布图片（服务商可能计费）"
    }),
    execute: async (parameters, context) => {
      context.signal.throwIfAborted();
      const applicationId = parameters.applicationId as ApplicationId;
      const project = requireProject(service, context, applicationId, String(parameters.projectId));
      assertExpectedVersion(project, parameters.expectedUpdatedAt);
      if (parameters.nodeId !== undefined) {
        const node = project.nodes.find(item => item.id === String(parameters.nodeId));
        if (!node) throw new Error("找不到要写入生成结果的画布节点；请先用 canvas_read_project 读取真实节点 ID。");
        if (node.type !== "generation") throw new Error("nodeId 必须是画布中的 generation 节点；其他节点类型不接受生成结果。");
      }
      const knownAssets = new Set(project.assets.map(asset => asset.assetId));
      for (const assetId of (parameters.referenceAssetIds ?? []) as string[]) {
        if (!knownAssets.has(assetId)) throw new Error("参考图必须来自当前画布项目的真实素材；没有发起生成请求。");
      }
      const generation = requireGenerationService(readGeneration);
      const input: CanvasGenerateImageInput = {
        expectedUpdatedAt: String(parameters.expectedUpdatedAt),
        prompt: String(parameters.prompt),
        signal: context.signal,
        ...(parameters.nodeId === undefined ? {} : { nodeId: String(parameters.nodeId) }),
        ...(parameters.aspectRatio === undefined ? {} : { aspectRatio: parameters.aspectRatio as NonNullable<CanvasGenerateImageInput["aspectRatio"]> }),
        ...(parameters.referenceAssetIds === undefined ? {} : { referenceAssetIds: parameters.referenceAssetIds as string[] }),
        ...(parameters.modelTarget === undefined ? {} : { modelTarget: parameters.modelTarget as NonNullable<CanvasGenerateImageInput["modelTarget"]> })
      };
      context.onProgress(parameters.modelTarget === undefined ? "正在使用设置中心默认图片模型生成画布图片" : "正在使用模型目录中选定的图片模型生成画布图片");
      const result = await generation.generateImage(context.userId, applicationId, project.id, input);
      context.signal.throwIfAborted();
      if (!result) throw new Error("画布生成 Owner 未返回可保存的图片结果（项目可能已被删除）；本次没有登记任何成功结果。");
      // 只报告 Owner 真实落盘的素材；生成结果没有出现在项目素材中时按失败处理。
      if (!result.project.assets.some(asset => asset.assetId === result.asset.assetId)) {
        throw new Error("画布生成结果未出现在项目素材中；不报告生成成功。");
      }
      return {
        generated: true,
        project: projectSummary(result.project),
        asset: result.asset,
        updatedAt: result.project.updatedAt
      };
    }
  });
}

export function createCanvasTools(service: CanvasService, readGeneration: CanvasGenerationReader): AiBusinessTool[] {
  return [
    listProjectsTool(service),
    readProjectTool(service),
    createProjectTool(service),
    addNodeTool(service),
    updateNodeTool(service),
    removeNodeTool(service),
    connectNodesTool(service),
    disconnectNodesTool(service),
    listAssetsTool(service),
    listImageModelsTool(readGeneration),
    generateImageTool(service, readGeneration)
  ];
}

export const name = "lfaaCanvasToolCanvas";
/** 画布数据 Owner 与工具注册表是必需依赖；生成 Owner 是可选服务，按真实装配状态读取。 */
export const inject = ["lfaaCanvas", "lfaaTools"];
export function apply(ctx: Context): void {
  for (const tool of createCanvasTools(ctx.lfaaCanvas, () => ctx.get(GENERATION_SERVICE_NAME))) {
    ctx.lfaaTools.registerTool(ctx, tool);
  }
}
