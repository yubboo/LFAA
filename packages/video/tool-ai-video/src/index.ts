/**
 * 功能：提供 AI 漫剧专属的模型工具。
 * 作用：让现有 Agent Loop 按模型决策读写 AI Video 项目，并调用既有图片/视频生成 Owner。
 * 不负责：模型请求、项目文件、账户鉴权、审批或图像 Provider；这些由 LFAA 现有 Owner 持有。
 * 关联文件：packages/video/ai-video/src/index.ts、packages/core/agent-loop/src/execute-turn.ts。
 */
import type { Context } from "@deepseek-ai/cordis";
import Joi from "joi";
import { makeTool, type AiBusinessTool } from "lfaa-tools/src/business-tools.js";
import type { AiVideoCanvas, AiVideoCanvasLayout, AiVideoCanvasService, AiVideoTimelineClip, AiVideoWhiteModel } from "lfaa-video-ai-video/src/index.js";

const uuid = Joi.string().guid({ version: ["uuidv4"] });
const referenceSchema = Joi.object({
  id: uuid.required(),
  name: Joi.string().trim().min(1).max(80).required(),
  description: Joi.string().max(2_000).allow("").required()
}).unknown(false);
const shotSchema = Joi.object({
  id: uuid.required(),
  title: Joi.string().trim().min(1).max(80).required(),
  description: Joi.string().max(1_000).allow("").required(),
  dialogue: Joi.string().max(2_000).allow("").required(),
  durationSeconds: Joi.number().integer().min(1).max(120).required(),
  x: Joi.number().integer().min(-50_000).max(50_000).required(),
  y: Joi.number().integer().min(-50_000).max(50_000).required(),
  characterIds: Joi.array().max(8).items(uuid).required(),
  locationId: uuid.optional()
}).unknown(false);
const linkSchema = Joi.object({
  id: uuid.required(),
  source: uuid.required(),
  target: uuid.required()
}).unknown(false);
const timelineClipSchema = Joi.object({
  id: uuid.required(), track: Joi.string().valid("video", "audio", "subtitle").required(), assetId: uuid.optional(), text: Joi.string().max(2_000).allow("").optional(),
  startSeconds: Joi.number().min(0).max(300).required(), inPointSeconds: Joi.number().min(0).max(300).required(), durationSeconds: Joi.number().min(0.1).max(300).required()
}).unknown(false);
const whiteModelSchema = Joi.object({
  ratio: Joi.string().valid("16:9", "9:16", "1:1").required(),
  camera: Joi.object({
    x: Joi.number().min(-100).max(100).required(), y: Joi.number().min(-5).max(100).required(), z: Joi.number().min(-100).max(100).required(),
    yaw: Joi.number().min(-360).max(360).required(), pitch: Joi.number().min(-85).max(85).required(), focalLength: Joi.number().min(18).max(120).required()
  }).unknown(false).required(),
  items: Joi.array().max(32).items(Joi.object({
    id: uuid.required(), name: Joi.string().trim().min(1).max(50).required(), kind: Joi.string().valid("actor", "block").required(),
    x: Joi.number().min(-50).max(50).required(), z: Joi.number().min(-50).max(50).required(), width: Joi.number().min(0.2).max(20).required(), depth: Joi.number().min(0.2).max(20).required(), height: Joi.number().min(0.2).max(20).required()
  }).unknown(false)).required()
}).unknown(false);
const canvasLayoutSchema = Joi.object({
  viewport: Joi.object({ x: Joi.number().min(-100_000).max(100_000).required(), y: Joi.number().min(-100_000).max(100_000).required(), zoom: Joi.number().min(0.05).max(8).required() }).unknown(false).required(),
  nodePositions: Joi.object().pattern(/^(?:script|timeline|director|character:[0-9a-f-]{36}|location:[0-9a-f-]{36}|asset:[0-9a-f-]{36})$/iu, Joi.object({ x: Joi.number().min(-50_000).max(50_000).required(), y: Joi.number().min(-50_000).max(50_000).required() }).unknown(false)).max(128).unknown(false).required()
}).unknown(false);

const summaryToolSchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
  required: []
};
const projectIdSchema = {
  type: "object",
  additionalProperties: false,
  properties: { projectId: { type: "string", format: "uuid" } },
  required: ["projectId"]
};
const readProjectJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    projectId: { type: "string", format: "uuid" },
    section: { type: "string", enum: ["summary", "script", "characters", "locations", "shots", "links", "assets", "timeline", "director"] },
    offset: { type: "integer", minimum: 0, maximum: 100_000 },
    limit: { type: "integer", minimum: 1, maximum: 8_000 }
  },
  required: ["projectId", "section"]
};
const createProjectJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: { title: { type: "string", minLength: 1, maxLength: 80 } },
  required: ["title"]
};
const timelineClipJsonSchema = {
  type: "object", additionalProperties: false,
  properties: {
    id: { type: "string", format: "uuid" }, track: { type: "string", enum: ["video", "audio", "subtitle"] },
    assetId: { type: "string", format: "uuid" }, text: { type: "string", maxLength: 2_000 },
    startSeconds: { type: "number", minimum: 0, maximum: 300 }, inPointSeconds: { type: "number", minimum: 0, maximum: 300 }, durationSeconds: { type: "number", minimum: 0.1, maximum: 300 }
  }, required: ["id", "track", "startSeconds", "inPointSeconds", "durationSeconds"]
};
const whiteModelJsonSchema = {
  type: "object", additionalProperties: false,
  properties: {
    ratio: { type: "string", enum: ["16:9", "9:16", "1:1"] },
    camera: { type: "object", additionalProperties: false, properties: {
      x: { type: "number", minimum: -100, maximum: 100 }, y: { type: "number", minimum: -5, maximum: 100 }, z: { type: "number", minimum: -100, maximum: 100 },
      yaw: { type: "number", minimum: -360, maximum: 360 }, pitch: { type: "number", minimum: -85, maximum: 85 }, focalLength: { type: "number", minimum: 18, maximum: 120 }
    }, required: ["x", "y", "z", "yaw", "pitch", "focalLength"] },
    items: { type: "array", maxItems: 32, items: { type: "object", additionalProperties: false, properties: {
      id: { type: "string", format: "uuid" }, name: { type: "string", minLength: 1, maxLength: 50 }, kind: { type: "string", enum: ["actor", "block"] },
      x: { type: "number", minimum: -50, maximum: 50 }, z: { type: "number", minimum: -50, maximum: 50 }, width: { type: "number", minimum: 0.2, maximum: 20 }, depth: { type: "number", minimum: 0.2, maximum: 20 }, height: { type: "number", minimum: 0.2, maximum: 20 }
    }, required: ["id", "name", "kind", "x", "z", "width", "depth", "height"] } }
  }, required: ["ratio", "camera", "items"]
};
const canvasLayoutJsonSchema = {
  type: "object", additionalProperties: false,
  properties: {
    viewport: { type: "object", additionalProperties: false, properties: { x: { type: "number", minimum: -100_000, maximum: 100_000 }, y: { type: "number", minimum: -100_000, maximum: 100_000 }, zoom: { type: "number", minimum: 0.05, maximum: 8 } }, required: ["x", "y", "zoom"] },
    nodePositions: { type: "object", maxProperties: 128, patternProperties: { "^(?:script|timeline|director|character:[0-9a-f-]{36}|location:[0-9a-f-]{36}|asset:[0-9a-f-]{36})$": { type: "object", additionalProperties: false, properties: { x: { type: "number", minimum: -50_000, maximum: 50_000 }, y: { type: "number", minimum: -50_000, maximum: 50_000 } }, required: ["x", "y"] } }, additionalProperties: false }
  }, required: ["viewport", "nodePositions"]
};
const updateProjectJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    projectId: { type: "string", format: "uuid" },
    expectedUpdatedAt: { type: "string", format: "date-time" },
    title: { type: "string", minLength: 1, maxLength: 80 },
    script: { type: "string", maxLength: 100_000 },
    characters: { type: "array", maxItems: 24, items: { type: "object", additionalProperties: false, properties: { id: { type: "string", format: "uuid" }, name: { type: "string", minLength: 1, maxLength: 80 }, description: { type: "string", maxLength: 2_000 } }, required: ["id", "name", "description"] } },
    locations: { type: "array", maxItems: 24, items: { type: "object", additionalProperties: false, properties: { id: { type: "string", format: "uuid" }, name: { type: "string", minLength: 1, maxLength: 80 }, description: { type: "string", maxLength: 2_000 } }, required: ["id", "name", "description"] } },
    shots: { type: "array", maxItems: 64, items: { type: "object", additionalProperties: false, properties: { id: { type: "string", format: "uuid" }, title: { type: "string", minLength: 1, maxLength: 80 }, description: { type: "string", maxLength: 1_000 }, dialogue: { type: "string", maxLength: 2_000 }, durationSeconds: { type: "integer", minimum: 1, maximum: 120 }, x: { type: "integer", minimum: -50_000, maximum: 50_000 }, y: { type: "integer", minimum: -50_000, maximum: 50_000 }, characterIds: { type: "array", maxItems: 8, items: { type: "string", format: "uuid" } }, locationId: { type: "string", format: "uuid" } }, required: ["id", "title", "description", "dialogue", "durationSeconds", "x", "y", "characterIds"] } },
    links: { type: "array", maxItems: 128, items: { type: "object", additionalProperties: false, properties: { id: { type: "string", format: "uuid" }, source: { type: "string", format: "uuid" }, target: { type: "string", format: "uuid" } }, required: ["id", "source", "target"] } },
    timelineClips: { type: "array", maxItems: 256, items: timelineClipJsonSchema },
    whiteModel: whiteModelJsonSchema,
    canvasLayout: canvasLayoutJsonSchema
  },
  required: ["projectId", "expectedUpdatedAt"]
};
const generateImageJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    projectId: { type: "string", format: "uuid" },
    shotId: { type: "string", format: "uuid" },
    expectedUpdatedAt: { type: "string", format: "date-time" }
  },
  required: ["projectId", "shotId", "expectedUpdatedAt"]
};
const shotVideoJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    projectId: { type: "string", format: "uuid" },
    shotId: { type: "string", format: "uuid" },
    expectedUpdatedAt: { type: "string", format: "date-time" }
  },
  required: ["projectId", "shotId", "expectedUpdatedAt"]
};

function parse(schema: Joi.ObjectSchema, value: unknown): Record<string, unknown> {
  const result = schema.validate(value, { abortEarly: false, convert: false, stripUnknown: false });
  if (result.error || typeof result.value !== "object" || result.value === null || Array.isArray(result.value)) {
    throw new Error(result.error?.details.map(detail => detail.message).join("；") ?? "AI 漫剧工具参数必须是 JSON 对象。");
  }
  return result.value as Record<string, unknown>;
}

function projectSummary(project: AiVideoCanvas): Record<string, unknown> {
  return {
    id: project.id,
    title: project.title,
    updatedAt: project.updatedAt,
    createdAt: project.createdAt,
    scriptCharacters: project.script.length,
    characterCount: project.characters.length,
    locationCount: project.locations.length,
    shotCount: project.shots.length,
    linkCount: project.links.length,
    mediaAssetCount: project.mediaAssets.length,
    timelineClipCount: project.timelineClips.length
  };
}

function findProject(service: AiVideoCanvasService, userId: string, projectId: string): AiVideoCanvas {
  const normalizedProjectId = projectId.toLowerCase();
  const project = service.list(userId).find(item => item.id === normalizedProjectId);
  if (!project) throw new Error("找不到当前账户的 AI 漫剧项目；请先列出项目并使用返回的 ID。");
  return project;
}

function projectListTool(service: AiVideoCanvasService): AiBusinessTool {
  return makeTool({
    id: "aivideo.projects.list",
    name: "aivideo_list_projects",
    coreManaged: true,
    applicationIds: ["aivideo"],
    activityTitle: "读取漫剧项目",
    description: "列出当前账户本机保存的 AI 漫剧项目。只返回项目 ID、标题、更新时间和各部分数量，不返回剧本或素材正文。后续读取、更新或删除必须使用这里返回的项目 ID。",
    schema: summaryToolSchema,
    parse: value => parse(Joi.object({}).unknown(false), value),
    execute: async (_parameters, context) => {
      context.signal.throwIfAborted();
      return { projects: service.list(context.userId).map(projectSummary), storage: "当前账户本机项目文件" };
    }
  });
}

function readProjectTool(service: AiVideoCanvasService): AiBusinessTool {
  return makeTool({
    id: "aivideo.projects.read",
    name: "aivideo_read_project",
    coreManaged: true,
    applicationIds: ["aivideo"],
    activityTitle: "读取漫剧项目内容",
    description: "按需读取项目摘要、剧本片段、角色、场景、镜头、连线、媒体素材、时间线或导演台。读取有分页上限：剧本每次最多 8000 字符，角色/场景/镜头/素材/时间线最多 8 条，连线最多 32 条。素材只返回元数据和项目内 ID，不返回媒体字节。使用返回的 nextOffset 继续读取。",
    schema: readProjectJsonSchema,
    parse: value => parse(Joi.object({
      projectId: Joi.string().guid({ version: ["uuidv4"] }).required(),
      section: Joi.string().valid("summary", "script", "characters", "locations", "shots", "links", "assets", "timeline", "director").required(),
      offset: Joi.number().integer().min(0).max(100_000).default(0),
      limit: Joi.number().integer().min(1).max(8_000).optional()
    }).unknown(false), value),
    execute: async (parameters, context) => {
      context.signal.throwIfAborted();
      const project = findProject(service, context.userId, String(parameters.projectId));
      const section = String(parameters.section);
      if (section === "summary") {
        return {
          project: projectSummary(project),
          characterNames: project.characters.slice(0, 12).map(reference => ({ id: reference.id, name: reference.name })),
          locationNames: project.locations.slice(0, 12).map(reference => ({ id: reference.id, name: reference.name })),
          shotTitles: project.shots.slice(0, 16).map(shot => ({ id: shot.id, title: shot.title })),
          omitted: { characters: Math.max(0, project.characters.length - 12), locations: Math.max(0, project.locations.length - 12), shots: Math.max(0, project.shots.length - 16) }
        };
      }
      if (section === "director") return { project: projectSummary(project), section, whiteModel: project.whiteModel, canvasLayout: project.canvasLayout };
      const offset = Number(parameters.offset ?? 0);
      if (section === "script") {
        const limit = Math.min(Number(parameters.limit ?? 4_000), 8_000);
        const value = project.script.slice(offset, offset + limit);
        const nextOffset = offset + value.length;
        return { project: projectSummary(project), section, offset, totalCharacters: project.script.length, value, nextOffset: nextOffset < project.script.length ? nextOffset : null };
      }
      const collection = section === "characters" ? project.characters
        : section === "locations" ? project.locations
          : section === "shots" ? project.shots
            : section === "links" ? project.links
              : section === "timeline" ? project.timelineClips
                : service.listMediaAssets(context.userId, project.id) ?? [];
      const defaultLimit = section === "links" ? 24 : 6;
      const maximumLimit = section === "links" ? 32 : 8;
      const limit = Math.min(Number(parameters.limit ?? defaultLimit), maximumLimit);
      const items = collection.slice(offset, offset + limit);
      const nextOffset = offset + items.length;
      return { project: projectSummary(project), section, offset, totalItems: collection.length, items, nextOffset: nextOffset < collection.length ? nextOffset : null };
    }
  });
}

function createProjectTool(service: AiVideoCanvasService): AiBusinessTool {
  return makeTool({
    id: "aivideo.projects.create",
    name: "aivideo_create_project",
    coreManaged: true,
    applicationIds: ["aivideo"],
    activityTitle: "新建漫剧项目",
    description: "在当前账户本机项目目录中新建 AI 漫剧项目。创建后使用返回的项目 ID 和更新时间继续写入剧本、角色、场景与分镜。",
    schema: createProjectJsonSchema,
    parse: value => parse(Joi.object({ title: Joi.string().trim().min(1).max(80).required() }).unknown(false), value),
    risk: () => "write",
    approval: () => ({ scopeKey: "aivideo:project:create", scopeSummary: "当前账户 AI 漫剧项目", summary: "在本机创建一个漫剧项目" }),
    execute: async (parameters, context) => {
      context.signal.throwIfAborted();
      const project = service.create(context.userId, parameters.title);
      return { created: true, project: projectSummary(project), nextStep: "可开始写入剧本、角色/场景档案和分镜。" };
    }
  });
}

function updateProjectTool(service: AiVideoCanvasService): AiBusinessTool {
  const updateSchema = Joi.object({
    projectId: Joi.string().guid({ version: ["uuidv4"] }).required(),
    expectedUpdatedAt: Joi.string().isoDate().required(),
    title: Joi.string().trim().min(1).max(80).optional(),
    script: Joi.string().max(100_000).optional(),
    characters: Joi.array().max(24).items(referenceSchema).optional(),
    locations: Joi.array().max(24).items(referenceSchema).optional(),
    shots: Joi.array().max(64).items(shotSchema).optional(),
    links: Joi.array().max(128).items(linkSchema).optional(),
    timelineClips: Joi.array().max(256).items(timelineClipSchema).optional(),
    whiteModel: whiteModelSchema.optional(),
    canvasLayout: canvasLayoutSchema.optional()
  }).or("title", "script", "characters", "locations", "shots", "links", "timelineClips", "whiteModel", "canvasLayout").unknown(false);
  return makeTool({
    id: "aivideo.projects.update",
    name: "aivideo_update_project",
    coreManaged: true,
    applicationIds: ["aivideo"],
    activityTitle: "保存漫剧创作内容",
    description: "更新当前账户本机项目中明确提供的字段；未提供的字段保持现状。剧本、角色/场景、镜头、连线、时间线、导演台和画布布局都写回聊天与画布共用的 AI Video 项目。数组字段是整组替换，编辑前请先读取对应完整分页。镜头坐标是画布位置，不是时间顺序；执行关系以 links 为准。必须传入最近一次读取或写入返回的 expectedUpdatedAt，避免覆盖并发修改。",
    schema: updateProjectJsonSchema,
    parse: value => parse(updateSchema, value),
    risk: () => "write",
    approval: (parameters) => ({ scopeKey: `aivideo:project:${String(parameters.projectId)}:content`, scopeSummary: "单个 AI 漫剧项目内容", summary: "保存剧本、角色/场景或分镜修改" }),
    execute: async (parameters, context) => {
      context.signal.throwIfAborted();
      const current = findProject(service, context.userId, String(parameters.projectId));
      const changes = { ...current } as AiVideoCanvas & Record<string, unknown>;
      for (const key of ["title", "script", "characters", "locations", "shots", "links", "timelineClips", "whiteModel", "canvasLayout"] as const) {
        if (Object.hasOwn(parameters, key)) changes[key] = parameters[key] as never;
      }
      const updated = service.update(context.userId, current.id, String(parameters.expectedUpdatedAt), {
        title: changes.title,
        script: changes.script,
        characters: changes.characters,
        locations: changes.locations,
        shots: changes.shots,
        links: changes.links,
        timelineClips: changes.timelineClips as AiVideoTimelineClip[] | undefined,
        whiteModel: changes.whiteModel as AiVideoWhiteModel | undefined,
        canvasLayout: changes.canvasLayout as AiVideoCanvasLayout | undefined
      });
      if (!updated) throw new Error("项目在保存前已删除；请重新列出项目后再操作。");
      return {
        saved: true,
        project: projectSummary(updated),
        characterIds: updated.characters.map(reference => ({ id: reference.id, name: reference.name })),
        locationIds: updated.locations.map(reference => ({ id: reference.id, name: reference.name })),
        shotIds: updated.shots.map(shot => ({ id: shot.id, title: shot.title })),
        linkCount: updated.links.length
      };
    }
  });
}

function deleteProjectTool(service: AiVideoCanvasService): AiBusinessTool {
  return makeTool({
    id: "aivideo.projects.delete",
    name: "aivideo_delete_project",
    coreManaged: true,
    applicationIds: ["aivideo"],
    activityTitle: "删除漫剧项目",
    description: "删除当前账户本机的整个 AI 漫剧项目目录及其素材。仅当当前用户目标明确包含删除该项目时调用；删除不可恢复，按 Permission Owner 当前权限模式处理。",
    schema: projectIdSchema,
    parse: value => parse(Joi.object({ projectId: Joi.string().guid({ version: ["uuidv4"] }).required() }).unknown(false), value),
    risk: () => "dangerous",
    approval: parameters => ({ scopeKey: `aivideo:project:${String(parameters.projectId)}:delete`, scopeSummary: "单个 AI 漫剧项目及其素材", summary: "永久删除该漫剧项目与项目图片" }),
    execute: async (parameters, context) => {
      context.signal.throwIfAborted();
      const project = findProject(service, context.userId, String(parameters.projectId));
      const removed = service.remove(context.userId, project.id);
      if (!removed) throw new Error("项目在删除前已不存在；请重新列出项目确认状态。");
      return { deleted: true, projectId: project.id, title: project.title };
    }
  });
}

function generateImageTool(service: AiVideoCanvasService): AiBusinessTool {
  return makeTool({
    id: "aivideo.shots.generate-image",
    name: "aivideo_generate_shot_image",
    coreManaged: true,
    applicationIds: ["aivideo"],
    activityTitle: "生成镜头图片",
    description: "使用设置中心当前选择的 OpenAI 或豆包/火山方舟图片模型，为指定镜头生成一张图片，并保存到当前账户本机项目素材。该操作可能产生服务商费用/用量，使用 Permission Owner 当前权限模式和服务端配置；需要项目/镜头 ID 和最新 expectedUpdatedAt。",
    schema: generateImageJsonSchema,
    parse: value => parse(Joi.object({
      projectId: Joi.string().guid({ version: ["uuidv4"] }).required(),
      shotId: Joi.string().guid({ version: ["uuidv4"] }).required(),
      expectedUpdatedAt: Joi.string().isoDate().required()
    }).unknown(false), value),
    risk: () => "dangerous",
    approval: parameters => ({ scopeKey: `aivideo:provider-image:${String(parameters.projectId)}:${String(parameters.shotId)}`, scopeSummary: "单个镜头的一次图片生成", summary: "调用设置中心选中的图片模型生成一张镜头图片（服务商可能计费）" }),
    execute: async (parameters, context) => {
      context.signal.throwIfAborted();
      const project = findProject(service, context.userId, String(parameters.projectId));
      const shot = project.shots.find(item => item.id === String(parameters.shotId).toLowerCase());
      if (!shot) throw new Error("找不到该项目中的镜头；没有发送图片请求。");
      context.onProgress(`正在使用已选图片模型生成「${shot.title}」`);
      const updated = await service.generateShotImage(context.userId, project.id, shot.id, String(parameters.expectedUpdatedAt), context.signal);
      context.signal.throwIfAborted();
      if (!updated) throw new Error("项目在图片生成前已删除；没有登记素材。");
      const savedShot = updated.shots.find(item => item.id === shot.id);
      if (!savedShot?.imageAssetId || !savedShot.imageMimeType) throw new Error("图片服务未返回可保存的素材；项目没有登记生成结果。");
      context.onProgress(`「${shot.title}」图片已保存到本机项目素材`);
      return { generated: true, project: projectSummary(updated), shot: { id: savedShot.id, title: savedShot.title, imageAssetId: savedShot.imageAssetId, imageMimeType: savedShot.imageMimeType } };
    }
  });
}

function generateVideoTool(service: AiVideoCanvasService): AiBusinessTool {
  return makeTool({
    id: "aivideo.shots.generate-video",
    name: "aivideo_generate_shot_video",
    coreManaged: true,
    applicationIds: ["aivideo"],
    activityTitle: "生成镜头视频",
    description: "使用设置中心选择的火山方舟视频账户与模型，为一个镜头创建真实异步视频任务，并把任务状态保存到本机项目。模型调用和生成可能产生费用，使用 Permission Owner 当前权限模式和服务端配置；需要最近的项目更新时间。",
    schema: shotVideoJsonSchema,
    parse: value => parse(Joi.object({ projectId: uuid.required(), shotId: uuid.required(), expectedUpdatedAt: Joi.string().isoDate().required() }).unknown(false), value),
    risk: () => "dangerous",
    approval: parameters => ({ scopeKey: `aivideo:provider-video:${String(parameters.projectId)}:${String(parameters.shotId)}`, scopeSummary: "单个镜头的一次视频生成", summary: "调用设置中心选中的火山方舟模型生成镜头视频（服务商可能计费）" }),
    execute: async (parameters, context) => {
      context.signal.throwIfAborted();
      const project = findProject(service, context.userId, String(parameters.projectId));
      const shot = project.shots.find(item => item.id === String(parameters.shotId).toLowerCase());
      if (!shot) throw new Error("找不到该项目中的镜头；没有创建视频任务。");
      context.onProgress(`正在向所选火山方舟模型提交「${shot.title}」视频任务`);
      const updated = await service.startShotVideo(context.userId, project.id, shot.id, String(parameters.expectedUpdatedAt), context.signal);
      context.signal.throwIfAborted();
      if (!updated) throw new Error("项目在创建视频任务前已删除；没有登记任务。");
      const savedShot = updated.shots.find(item => item.id === shot.id);
      if (!savedShot?.videoTask) throw new Error("服务没有返回可核对的视频任务状态；没有显示生成成功。");
      context.onProgress(`「${shot.title}」视频任务状态：${savedShot.videoTask.status}`);
      return { submitted: true, project: projectSummary(updated), shot: { id: savedShot.id, title: savedShot.title, task: savedShot.videoTask, videoAssetId: savedShot.videoAssetId } };
    }
  });
}

function refreshVideoTool(service: AiVideoCanvasService): AiBusinessTool {
  return makeTool({
    id: "aivideo.shots.refresh-video",
    name: "aivideo_refresh_shot_video",
    coreManaged: true,
    applicationIds: ["aivideo"],
    activityTitle: "查询镜头视频状态",
    description: "查询已保存的火山方舟异步视频任务；成功结果会安全下载并登记到本机项目 assets。视频 URL 不会暴露给模型或浏览器。需要项目 ID 和镜头 ID。",
    schema: { ...shotVideoJsonSchema, required: ["projectId", "shotId"] },
    parse: value => parse(Joi.object({ projectId: uuid.required(), shotId: uuid.required() }).unknown(false), value),
    risk: () => "write",
    approval: parameters => ({ scopeKey: `aivideo:video-task:${String(parameters.projectId)}:${String(parameters.shotId)}`, scopeSummary: "单个镜头视频任务状态和本机素材", summary: "查询视频生成状态并在完成后保存成片" }),
    execute: async (parameters, context) => {
      context.signal.throwIfAborted();
      const project = findProject(service, context.userId, String(parameters.projectId));
      const shot = project.shots.find(item => item.id === String(parameters.shotId).toLowerCase());
      if (!shot) throw new Error("找不到该项目中的镜头。");
      const updated = await service.refreshShotVideo(context.userId, project.id, shot.id, context.signal);
      context.signal.throwIfAborted();
      if (!updated) throw new Error("项目在查询视频任务前已删除。");
      const savedShot = updated.shots.find(item => item.id === shot.id);
      if (!savedShot?.videoTask) throw new Error("项目没有保存此镜头的视频任务。");
      return { project: projectSummary(updated), shot: { id: savedShot.id, title: savedShot.title, task: savedShot.videoTask, videoAssetId: savedShot.videoAssetId, videoSavedLocally: Boolean(savedShot.videoAssetId) } };
    }
  });
}

function cancelVideoTool(service: AiVideoCanvasService): AiBusinessTool {
  return makeTool({
    id: "aivideo.shots.cancel-video",
    name: "aivideo_cancel_queued_video",
    coreManaged: true,
    applicationIds: ["aivideo"],
    activityTitle: "取消排队中的镜头视频",
    description: "只取消仍在火山方舟队列中的视频任务；服务商运行中的任务不支持通过此操作停止。取消不可撤回，任务状态以真实服务商回执为准。",
    schema: { type: "object", additionalProperties: false, properties: { projectId: { type: "string", format: "uuid" }, shotId: { type: "string", format: "uuid" } }, required: ["projectId", "shotId"] },
    parse: value => parse(Joi.object({ projectId: uuid.required(), shotId: uuid.required() }).unknown(false), value),
    risk: () => "dangerous",
    approval: parameters => ({ scopeKey: `aivideo:video-task:${String(parameters.projectId)}:${String(parameters.shotId)}:cancel`, scopeSummary: "单个排队中的视频任务", summary: "向火山方舟发送取消此排队视频任务的请求" }),
    execute: async (parameters, context) => {
      context.signal.throwIfAborted();
      const project = findProject(service, context.userId, String(parameters.projectId));
      const shot = project.shots.find(item => item.id === String(parameters.shotId).toLowerCase());
      if (!shot) throw new Error("找不到该项目中的镜头。");
      const updated = await service.cancelShotVideo(context.userId, project.id, shot.id, context.signal);
      context.signal.throwIfAborted();
      if (!updated) throw new Error("项目在取消视频任务前已删除。");
      const savedShot = updated.shots.find(item => item.id === shot.id);
      return { cancelled: savedShot?.videoTask?.status === "cancelled", project: projectSummary(updated), shot: { id: shot.id, title: shot.title, task: savedShot?.videoTask } };
    }
  });
}

export function createAiVideoTools(service: AiVideoCanvasService): AiBusinessTool[] {
  return [projectListTool(service), readProjectTool(service), createProjectTool(service), updateProjectTool(service), deleteProjectTool(service), generateImageTool(service), generateVideoTool(service), refreshVideoTool(service), cancelVideoTool(service)];
}

export const name = "lfaaToolAiVideo";
export const inject = ["lfaaAiVideo", "lfaaTools"];
export function apply(ctx: Context): void {
  for (const tool of createAiVideoTools(ctx.lfaaAiVideo)) ctx.lfaaTools.registerTool(ctx, tool);
}
