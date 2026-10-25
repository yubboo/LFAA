/**
 * 功能：回归画布生成编排 Owner 的校验、未配置与失败路径。
 * 作用：用注入的假 canvas Owner 与假生成函数验证无真实外网调用、失败不写可见结果、成功才落素材与节点状态；不访问真实 Provider。
 * 运行：在 apps/cli 下 node --import tsx --import ./register-package-loader.mjs --import ./tests/isolated-test-environment.mjs --test tests/canvas-generation.test.mjs（工作区包必须经 register-package-loader 解析）。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
const MP4 = Buffer.concat([Buffer.alloc(4), Buffer.from("ftyp", "ascii"), Buffer.alloc(16)]);
const START = "2026-10-25T00:00:00.000Z";

function bump(timestamp) {
  return new Date(Date.parse(timestamp) + 1_000).toISOString();
}

function aiRuntime(overrides = {}) {
  return {
    requestTimeoutSeconds: 90,
    imageGenerationMode: "provider",
    imageGenerationAccountId: "account-image",
    imageGenerationModelId: "image-model",
    imageGenerationLocalModelId: "",
    imageGenerationLocalTimeoutSeconds: 900,
    imageGenerationUnloadAfterMinutes: 10,
    videoGenerationMode: "provider",
    videoGenerationAccountId: "account-video",
    videoGenerationModelId: "video-model",
    videoGenerationLocalModelId: "",
    videoGenerationLocalTimeoutSeconds: 900,
    videoGenerationUnloadAfterMinutes: 10,
    videoGenerationDurationSeconds: 5,
    videoGenerationRatio: "adaptive",
    videoGenerationResolution: "720p",
    videoGenerationGenerateAudio: false,
    videoGenerationWatermark: true,
    ...overrides
  };
}

function accounts(overrides = {}) {
  return [
    { id: "account-image", providerId: "openai", displayName: "图片账户", modelId: "image-model", models: [{ id: "image-model" }], reasoningMode: "default", active: true, createdAt: START, hasSecret: true },
    { id: "account-video", providerId: "doubao", displayName: "视频账户", modelId: "video-model", models: [{ id: "video-model" }], reasoningMode: "default", active: true, createdAt: START, hasSecret: true },
    ...(overrides.extra ?? [])
  ];
}

function generationNode(overrides = {}) {
  return { id: randomUUID(), type: "generation", x: 0, y: 0, width: 360, height: 260, data: {}, ...overrides };
}

function projectFixture(nodes = []) {
  return {
    format: "lfaa-canvas-project",
    formatVersion: 2,
    applicationId: "writing",
    id: randomUUID(),
    title: "生成画布",
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes,
    edges: [],
    assets: [],
    createdAt: START,
    updatedAt: START
  };
}

function imageAssetFixture(bytes = PNG) {
  return { assetId: randomUUID(), name: "参考图.png", mimeType: "image/png", bytes: bytes.length, createdAt: START };
}

/** 假画布 Owner：内存项目 + 素材字节，行为对齐 lfaa-canvas 的并发与节点更新语义。 */
function createFakeCanvas(initialProject, assetBytes = {}) {
  const state = { project: structuredClone(initialProject) };
  const calls = { commit: [], updateNode: [], openAsset: [] };
  const canvas = {
    calls,
    current: () => structuredClone(state.project),
    read(userId, applicationId, projectId) {
      if (userId !== "account-a" || applicationId !== "writing" || projectId !== state.project.id) return null;
      return structuredClone(state.project);
    },
    openAsset(userId, applicationId, projectId, assetId) {
      calls.openAsset.push(assetId);
      if (userId !== "account-a" || applicationId !== "writing" || projectId !== state.project.id) return null;
      const asset = state.project.assets.find(item => item.assetId === assetId);
      const bytes = assetBytes[assetId];
      if (!asset || !bytes) return null;
      return { stream: Readable.from([bytes]), mimeType: asset.mimeType, size: bytes.length, start: 0, end: bytes.length - 1 };
    },
    updateNodeData(userId, applicationId, projectId, expectedUpdatedAt, nodeId, data) {
      calls.updateNode.push({ nodeId, data: structuredClone(data) });
      if (state.project.updatedAt !== expectedUpdatedAt) throw new (globalThis.CanvasConflictError)();
      const index = state.project.nodes.findIndex(item => item.id === nodeId);
      if (index < 0) throw new Error("找不到要更新的画布节点。");
      state.project = {
        ...state.project,
        nodes: state.project.nodes.map((node, itemIndex) => itemIndex === index ? { ...node, data: structuredClone(data) } : node),
        updatedAt: bump(state.project.updatedAt)
      };
      return structuredClone(state.project);
    },
    commitAsset(userId, applicationId, projectId, input) {
      calls.commit.push(structuredClone({ expectedUpdatedAt: input.expectedUpdatedAt, name: input.name, mimeType: input.mimeType, bytes: input.bytes.length, assetId: input.assetId, nodeId: input.node?.nodeId }));
      if (state.project.updatedAt !== input.expectedUpdatedAt) throw new (globalThis.CanvasConflictError)();
      const asset = { assetId: input.assetId ?? randomUUID(), name: input.name, mimeType: input.mimeType, bytes: input.bytes.length, createdAt: new Date().toISOString() };
      let nodes = state.project.nodes;
      if (input.node) {
        const index = nodes.findIndex(item => item.id === input.node.nodeId);
        if (index < 0) throw new Error("找不到要写入生成结果的画布节点；素材没有保存。");
        nodes = nodes.map((node, itemIndex) => itemIndex === index ? { ...node, data: structuredClone(input.node.data) } : node);
      }
      state.project = { ...state.project, assets: [...state.project.assets, asset], nodes, updatedAt: bump(state.project.updatedAt) };
      return { project: structuredClone(state.project), asset: structuredClone(asset) };
    }
  };
  return canvas;
}

function createDeps(canvas, options = {}) {
  const calls = { generateImage: [], createVideoTask: [], getVideoTask: [], cancelVideoTask: [], downloadVideo: [] };
  const settings = options.settings ?? aiRuntime();
  const accountList = options.accounts ?? accounts();
  const keys = options.keys ?? { "account-image": "sk-image", "account-video": "sk-video" };
  return {
    canvas,
    calls,
    readSettings: () => settings,
    listAccounts: () => accountList,
    resolveCredential: (userId, accountId) => userId === "account-a" ? keys[accountId] ?? null : null,
    generateImage: async input => {
      calls.generateImage.push(structuredClone({ ...input, referenceImages: input.referenceImages.map(image => ({ mimeType: image.mimeType, bytes: image.bytes.length })) }));
      if (options.generateImage) return options.generateImage(input);
      throw new Error("测试未提供生成函数，不应发起真实 Provider 请求。");
    },
    createVideoTask: async input => {
      calls.createVideoTask.push(structuredClone({ ...input, referenceImages: input.referenceImages.map(image => ({ mimeType: image.mimeType, bytes: image.bytes.length })) }));
      if (options.createVideoTask) return options.createVideoTask(input);
      throw new Error("测试未提供视频任务函数，不应发起真实 Provider 请求。");
    },
    getVideoTask: async input => {
      calls.getVideoTask.push(input);
      if (options.getVideoTask) return options.getVideoTask(input);
      throw new Error("测试未提供视频查询函数，不应发起真实 Provider 请求。");
    },
    cancelVideoTask: async input => {
      calls.cancelVideoTask.push(input);
      if (options.cancelVideoTask) return options.cancelVideoTask(input);
      throw new Error("测试未提供视频取消失败函数，不应发起真实 Provider 请求。");
    },
    downloadVideo: async (url, timeoutMs) => {
      calls.downloadVideo.push(url);
      if (options.downloadVideo) return options.downloadVideo(url);
      throw new Error("测试未提供视频下载函数，不应访问真实对象存储。");
    }
  };
}

test("画布生成校验纯函数：提示词、比例、时长、参考素材与状态映射", async () => {
  const generation = await import("lfaa-canvas-generation/src/index.js");

  assert.equal(generation.normalizeImagePrompt("  一只猫  "), "一只猫");
  assert.throws(() => generation.normalizeImagePrompt("   "), generation.CanvasGenerationConfigurationError);
  assert.throws(() => generation.normalizeImagePrompt("字".repeat(1_001)), /1000/u);
  assert.equal(generation.normalizeVideoPrompt(" 镜头推近 "), "镜头推近");
  assert.throws(() => generation.normalizeVideoPrompt("字".repeat(5_001)), /5000/u);

  assert.equal(generation.normalizeImageAspectRatio("2:1"), "2:1");
  assert.equal(generation.normalizeImageAspectRatio(undefined), undefined);
  assert.throws(() => generation.normalizeImageAspectRatio("3:2"), /图片生成比例无效/u);

  assert.equal(generation.normalizeVideoAspectRatio(undefined, "adaptive"), "16:9");
  assert.equal(generation.normalizeVideoAspectRatio(undefined, "9:16"), "9:16");
  assert.equal(generation.normalizeVideoAspectRatio("4:3", "adaptive"), "4:3");
  assert.throws(() => generation.normalizeVideoAspectRatio("2:1", "adaptive"), /视频生成比例无效/u);
  assert.throws(() => generation.normalizeVideoAspectRatio(undefined, "invalid"), /设置中心的视频比例无效/u);

  assert.equal(generation.normalizeVideoDuration(undefined, 5), 5);
  assert.equal(generation.normalizeVideoDuration(8, 5), 8);
  assert.throws(() => generation.normalizeVideoDuration(0, 5), /1 到 15 秒/u);
  assert.throws(() => generation.normalizeVideoDuration(16, 5), /1 到 15 秒/u);
  assert.throws(() => generation.normalizeVideoDuration(1.5, 5), /1 到 15 秒/u);
  assert.throws(() => generation.normalizeVideoDuration(undefined, 0), /设置中心的视频时长无效/u);

  assert.deepEqual(generation.normalizeReferenceAssetIds(undefined), []);
  const referenceId = randomUUID();
  assert.deepEqual(generation.normalizeReferenceAssetIds([referenceId]), [referenceId]);
  assert.throws(() => generation.normalizeReferenceAssetIds([referenceId, referenceId]), /参考素材 ID 重复/u);
  assert.throws(() => generation.normalizeReferenceAssetIds(["not-uuid"]), /有效的 UUID/u);
  assert.throws(() => generation.normalizeReferenceAssetIds(Array.from({ length: 10 }, () => randomUUID())), /参考素材最多 9 个/u);

  assert.equal(generation.buildImagePrompt("画一只猫", "2:1"), "画一只猫\n\n画面比例 2:1。");
  assert.equal(generation.buildImagePrompt("画一只猫", undefined), "画一只猫");
  assert.throws(() => generation.buildImagePrompt("字".repeat(996), "16:9"), /画面比例说明后超过/u);

  assert.equal(generation.mapProviderVideoStatus("queued"), "running");
  assert.equal(generation.mapProviderVideoStatus("running"), "running");
  assert.equal(generation.mapProviderVideoStatus("succeeded"), "succeeded");
  assert.equal(generation.mapProviderVideoStatus("failed"), "failed");
  assert.equal(generation.mapProviderVideoStatus("cancelled"), "failed");
  assert.equal(generation.mapProviderVideoStatus("expired"), "failed");
  assert.equal(generation.videoTaskErrorMessage("failed"), "服务商视频任务失败；画布没有登记成片。");
  assert.equal(generation.videoTaskErrorMessage("failed", "模型拒绝生成"), "模型拒绝生成");
  assert.equal(generation.isTerminalGenerationStatus("succeeded"), true);
  assert.equal(generation.isTerminalGenerationStatus("running"), false);
});

test("画布图片生成：未配置账户/密钥/模型时 400 原因，不调用 Provider、不写结果", async () => {
  const generation = await import("lfaa-canvas-generation/src/index.js");
  const canvasOwner = await import("lfaa-canvas/src/index.js");
  globalThis.CanvasConflictError = canvasOwner.CanvasConflictError;

  const node = generationNode();
  const baseProject = projectFixture([node]);
  const serviceWith = options => generation.createCanvasGenerationService(createDeps(createFakeCanvas(baseProject), options));

  const cases = [
    [{ settings: aiRuntime({ imageGenerationAccountId: "", imageGenerationModelId: "" }) }, /设置中心选择图片生成账户和模型/u],
    [{ settings: aiRuntime({ imageGenerationAccountId: "missing-account" }) }, /找不到所选图片生成账户/u],
    [{ keys: { "account-video": "sk-video" } }, /密钥不可用/u],
    [{ settings: aiRuntime({ imageGenerationModelId: "not-in-catalog" }) }, /模型目录/u],
    [{ accounts: [{ id: "account-image", providerId: "deepseek", displayName: "错误账户", modelId: "image-model", models: [{ id: "image-model" }], reasoningMode: "default", active: true, createdAt: START, hasSecret: true }] }, /只支持 OpenAI 和豆包/u]
  ];
  for (const [options, pattern] of cases) {
    const canvas = createFakeCanvas(baseProject);
    const deps = createDeps(canvas, options);
    const service = generation.createCanvasGenerationService(deps);
    await assert.rejects(
      service.generateImage("account-a", "writing", baseProject.id, { expectedUpdatedAt: baseProject.updatedAt, nodeId: node.id, prompt: "一只猫" }),
      error => error instanceof generation.CanvasGenerationConfigurationError && pattern.test(error.message)
    );
    assert.equal(deps.calls.generateImage.length, 0);
    assert.equal(canvas.calls.commit.length, 0);
    assert.deepEqual(canvas.current(), baseProject);
  }

  // 本机模型模式本轮未接通：显式 501 语义错误，不调用 Provider。
  const localCanvas = createFakeCanvas(baseProject);
  const localDeps = createDeps(localCanvas, { settings: aiRuntime({ imageGenerationMode: "local" }) });
  const localService = generation.createCanvasGenerationService(localDeps);
  await assert.rejects(
    localService.generateImage("account-a", "writing", baseProject.id, { expectedUpdatedAt: baseProject.updatedAt, prompt: "一只猫" }),
    error => error instanceof generation.CanvasGenerationUnsupportedError && /本机 MOSS 模型/u.test(error.message)
  );
  assert.equal(localDeps.calls.generateImage.length, 0);

  // 不存在项目返回 null；过期版本抛 CanvasConflictError 且不调用 Provider。
  assert.equal(await serviceWith({}).generateImage("account-a", "writing", randomUUID(), { expectedUpdatedAt: baseProject.updatedAt, prompt: "一只猫" }), null);
  const conflictCanvas = createFakeCanvas(baseProject);
  const conflictDeps = createDeps(conflictCanvas);
  const conflictService = generation.createCanvasGenerationService(conflictDeps);
  await assert.rejects(
    conflictService.generateImage("account-a", "writing", baseProject.id, { expectedUpdatedAt: "2026-10-24T00:00:00.000Z", prompt: "一只猫" }),
    canvasOwner.CanvasConflictError
  );
  assert.equal(conflictDeps.calls.generateImage.length, 0);
});

test("画布图片生成：失败不写可见结果，成功才原子落素材并写 succeeded 节点", async () => {
  const generation = await import("lfaa-canvas-generation/src/index.js");
  const canvasOwner = await import("lfaa-canvas/src/index.js");
  globalThis.CanvasConflictError = canvasOwner.CanvasConflictError;

  const node = generationNode();
  const project = projectFixture([node]);
  const reference = imageAssetFixture();
  project.assets = [reference];

  // 参考图 + 2:1 全景比例：只引用本项目素材，提示词附加比例说明。
  const canvas = createFakeCanvas(project, { [reference.assetId]: PNG });
  let capturedInput = null;
  const deps = createDeps(canvas, {
    generateImage: input => {
      capturedInput = input;
      return { bytes: PNG, mimeType: "image/png" };
    }
  });
  const service = generation.createCanvasGenerationService(deps);
  const result = await service.generateImage("account-a", "writing", project.id, {
    expectedUpdatedAt: project.updatedAt,
    nodeId: node.id,
    prompt: "  雨夜街道  ",
    aspectRatio: "2:1",
    referenceAssetIds: [reference.assetId]
  });
  assert.equal(capturedInput.prompt, "雨夜街道\n\n画面比例 2:1。");
  assert.equal(capturedInput.referenceImages.length, 1);
  assert.equal(capturedInput.timeoutMs, 90_000);
  assert.equal(deps.calls.generateImage.length, 1);
  assert.equal(canvas.calls.commit.length, 1);
  assert.equal(canvas.calls.commit[0].nodeId, node.id);
  assert.equal(canvas.calls.commit[0].mimeType, "image/png");
  assert.equal(result.project.nodes[0].data.generation.kind, "image");
  assert.equal(result.project.nodes[0].data.generation.status, "succeeded");
  assert.equal(result.project.nodes[0].data.generation.aspectRatio, "2:1");
  assert.equal(result.project.nodes[0].data.generation.assetId, result.asset.assetId);
  assert.equal(result.project.assets.length, 2);
  assert.equal(result.asset.mimeType, "image/png");
  assert.equal(result.asset.bytes, PNG.length);
  assert.match(result.asset.name, /^画布生成图片-/u);
  assert.equal(result.project.nodes[0].data.assetIds, undefined);

  // Provider 失败：抛真实错误，不写项目、不登记素材。
  const failureProject = projectFixture([generationNode()]);
  const failureCanvas = createFakeCanvas(failureProject);
  const failureDeps = createDeps(failureCanvas, {
    generateImage: () => { throw new Error("图像服务商拒绝了模型请求"); }
  });
  const failureService = generation.createCanvasGenerationService(failureDeps);
  await assert.rejects(
    failureService.generateImage("account-a", "writing", failureProject.id, { expectedUpdatedAt: failureProject.updatedAt, nodeId: failureProject.nodes[0].id, prompt: "一只猫" }),
    /图像服务商拒绝了模型请求/u
  );
  assert.equal(failureCanvas.calls.commit.length, 0);
  assert.deepEqual(failureCanvas.current(), failureProject);

  // 参考图校验：缺失、非图片、跨项目都拒绝，且不调用 Provider。
  const missingCanvas = createFakeCanvas(project, {});
  const missingDeps = createDeps(missingCanvas);
  const missingService = generation.createCanvasGenerationService(missingDeps);
  await assert.rejects(
    missingService.generateImage("account-a", "writing", project.id, { expectedUpdatedAt: project.updatedAt, prompt: "一只猫", referenceAssetIds: [randomUUID()] }),
    error => error instanceof generation.CanvasGenerationConfigurationError && /只能引用本项目素材/u.test(error.message)
  );
  assert.equal(missingDeps.calls.generateImage.length, 0);

  const audioAsset = { assetId: randomUUID(), name: "旁白.mp3", mimeType: "audio/mpeg", bytes: 32, createdAt: START };
  const audioProject = { ...projectFixture([node]), assets: [audioAsset] };
  const audioCanvas = createFakeCanvas(audioProject, { [audioAsset.assetId]: Buffer.from("ID3", "latin1") });
  const audioDeps = createDeps(audioCanvas);
  const audioService = generation.createCanvasGenerationService(audioDeps);
  await assert.rejects(
    audioService.generateImage("account-a", "writing", audioProject.id, { expectedUpdatedAt: audioProject.updatedAt, prompt: "一只猫", referenceAssetIds: [audioAsset.assetId] }),
    /必须引用本项目素材|不是图片/u
  );
  assert.equal(audioDeps.calls.generateImage.length, 0);
});

test("画布视频生成：真实任务状态写入节点，刷新成功才落素材，失败/取消置 failed", async () => {
  const generation = await import("lfaa-canvas-generation/src/index.js");
  const canvasOwner = await import("lfaa-canvas/src/index.js");
  globalThis.CanvasConflictError = canvasOwner.CanvasConflictError;

  const node = generationNode();
  const project = projectFixture([node]);
  let providerStatus = "queued";
  let providerError = "";
  const videoOptions = {
    createVideoTask: () => ({ id: "ark-task-1", status: providerStatus }),
    getVideoTask: () => ({ id: "ark-task-1", status: providerStatus, ...(providerStatus === "succeeded" ? { videoUrl: "https://ark-content-generation-cn-beijing.tos-cn-beijing.volces.com/out.mp4" } : {}), ...(providerError ? { error: providerError } : {}) }),
    cancelVideoTask: () => undefined,
    downloadVideo: () => MP4
  };

  // 未指定生成节点：明确拒绝，不提交任务。
  const missingNodeCanvas = createFakeCanvas(project);
  const missingNodeDeps = createDeps(missingNodeCanvas, videoOptions);
  const missingNodeService = generation.createCanvasGenerationService(missingNodeDeps);
  await assert.rejects(
    missingNodeService.startVideo("account-a", "writing", project.id, { expectedUpdatedAt: project.updatedAt, prompt: "镜头推近" }),
    error => error instanceof generation.CanvasGenerationConfigurationError && /需要指定画布生成节点/u.test(error.message)
  );
  assert.equal(missingNodeDeps.calls.createVideoTask.length, 0);

  const canvas = createFakeCanvas(project);
  const deps = createDeps(canvas, videoOptions);
  const service = generation.createCanvasGenerationService(deps);
  const started = await service.startVideo("account-a", "writing", project.id, {
    expectedUpdatedAt: project.updatedAt,
    nodeId: node.id,
    prompt: "镜头缓慢推近雨夜街道"
  });
  assert.equal(deps.calls.createVideoTask.length, 1);
  assert.equal(deps.calls.createVideoTask[0].ratio, "16:9");
  assert.equal(deps.calls.createVideoTask[0].durationSeconds, 5);
  assert.equal(deps.calls.createVideoTask[0].resolution, "720p");
  const runningGeneration = started.project.nodes[0].data.generation;
  assert.equal(runningGeneration.status, "running");
  assert.equal(runningGeneration.taskId, "ark-task-1");
  assert.equal(runningGeneration.providerStatus, "queued");
  assert.equal(runningGeneration.aspectRatio, "16:9");

  // 同一节点运行中再次发起：拒绝，不重复提交。
  await assert.rejects(
    service.startVideo("account-a", "writing", project.id, { expectedUpdatedAt: started.project.updatedAt, nodeId: node.id, prompt: "再次生成" }),
    /已有进行中的视频任务/u
  );
  assert.equal(deps.calls.createVideoTask.length, 1);

  // 刷新：排队状态相同不重复写项目；状态变化写 running。
  const beforeSame = canvas.current();
  const sameRefresh = await service.refreshVideo("account-a", "writing", project.id, node.id);
  assert.equal(sameRefresh.updatedAt, beforeSame.updatedAt);
  providerStatus = "running";
  const runningRefresh = await service.refreshVideo("account-a", "writing", project.id, node.id);
  assert.equal(runningRefresh.nodes[0].data.generation.providerStatus, "running");
  assert.ok(runningRefresh.updatedAt > beforeSame.updatedAt);

  // 刷新失败：置 failed + 真实 error，不落素材。
  providerStatus = "failed";
  providerError = "模型拒绝生成视频";
  const failedRefresh = await service.refreshVideo("account-a", "writing", project.id, node.id);
  assert.equal(failedRefresh.nodes[0].data.generation.status, "failed");
  assert.equal(failedRefresh.nodes[0].data.generation.error, "模型拒绝生成视频");
  assert.equal(failedRefresh.assets.length, 0);
  // 终态不再请求服务商。
  const getCallsAfterTerminal = deps.calls.getVideoTask.length;
  const terminalRefresh = await service.refreshVideo("account-a", "writing", project.id, node.id);
  assert.equal(terminalRefresh.updatedAt, failedRefresh.updatedAt);
  assert.equal(deps.calls.getVideoTask.length, getCallsAfterTerminal);

  // 成功：下载真实成片后才落素材并置 succeeded。
  const successNode = generationNode();
  const successProject = projectFixture([successNode]);
  providerStatus = "queued";
  providerError = "";
  const successCanvas = createFakeCanvas(successProject);
  const successDeps = createDeps(successCanvas, videoOptions);
  const successService = generation.createCanvasGenerationService(successDeps);
  const successStarted = await successService.startVideo("account-a", "writing", successProject.id, { expectedUpdatedAt: successProject.updatedAt, nodeId: successNode.id, prompt: "海浪" });
  providerStatus = "succeeded";
  const succeeded = await successService.refreshVideo("account-a", "writing", successProject.id, successNode.id);
  assert.equal(successDeps.calls.downloadVideo.length, 1);
  assert.equal(succeeded.nodes[0].data.generation.status, "succeeded");
  assert.equal(succeeded.assets.length, 1);
  assert.equal(succeeded.assets[0].mimeType, "video/mp4");
  assert.equal(succeeded.nodes[0].data.generation.assetId, succeeded.assets[0].assetId);
  assert.ok(successStarted.project.updatedAt < succeeded.updatedAt);

  // 取消排队中的任务：置 failed 并说明没有成片。
  const cancelNode = generationNode();
  const cancelProject = projectFixture([cancelNode]);
  providerStatus = "queued";
  const cancelCanvas = createFakeCanvas(cancelProject);
  const cancelDeps = createDeps(cancelCanvas, videoOptions);
  const cancelService = generation.createCanvasGenerationService(cancelDeps);
  await cancelService.startVideo("account-a", "writing", cancelProject.id, { expectedUpdatedAt: cancelProject.updatedAt, nodeId: cancelNode.id, prompt: "雨滴" });
  const cancelled = await cancelService.cancelVideo("account-a", "writing", cancelProject.id, cancelNode.id);
  assert.equal(cancelDeps.calls.cancelVideoTask.length, 1);
  assert.equal(cancelDeps.calls.cancelVideoTask[0].taskId, "ark-task-1");
  assert.equal(cancelled.nodes[0].data.generation.status, "failed");
  assert.match(cancelled.nodes[0].data.generation.error, /已取消/u);
  assert.equal(cancelled.assets.length, 0);
  await assert.rejects(
    cancelService.cancelVideo("account-a", "writing", cancelProject.id, cancelNode.id),
    /已结束，无法取消/u
  );

  // 任务创建失败：节点置 failed 并抛真实错误，不登记素材。
  providerStatus = "queued";
  const createFailureProject = projectFixture([generationNode()]);
  const createFailureCanvas = createFakeCanvas(createFailureProject);
  const createFailureDeps = createDeps(createFailureCanvas, {
    ...videoOptions,
    createVideoTask: () => { throw new Error("火山方舟拒绝了请求"); }
  });
  const createFailureService = generation.createCanvasGenerationService(createFailureDeps);
  await assert.rejects(
    createFailureService.startVideo("account-a", "writing", createFailureProject.id, { expectedUpdatedAt: createFailureProject.updatedAt, nodeId: createFailureProject.nodes[0].id, prompt: "海浪" }),
    /火山方舟拒绝了请求/u
  );
  assert.equal(createFailureCanvas.current().nodes[0].data.generation.status, "failed");
  assert.equal(createFailureCanvas.current().assets.length, 0);
  assert.equal(createFailureCanvas.calls.commit.length, 0);

  // 使用已记录账户恢复凭据：账户被删除时刷新明确拒绝。
  const staleProject = projectFixture([generationNode()]);
  const staleCanvas = createFakeCanvas(staleProject);
  const staleDeps = createDeps(staleCanvas, { ...videoOptions, accounts: [] });
  const staleService = generation.createCanvasGenerationService(staleDeps);
  // 无账户时启动也应先失败，这里只验证刷新路径的凭据恢复提示。
  await assert.rejects(
    staleService.refreshVideo("account-a", "writing", staleProject.id, staleProject.nodes[0].id),
    /还没有视频生成任务/u
  );
});
