/**
 * 功能：回归画布 Agent 工具包的注册合同、参数校验与真实画布 Owner 读写。
 * 作用：在隔离 Home/DataDir 中用真实 Cordis Context + lfaaTools + lfaa-canvas 执行十个工具，覆盖注册名、参数拒绝、真实 CRUD、409、跨 App 隔离、素材引用与未装配生成能力，不访问网络。
 * 关联文件：packages/canvas/tool-canvas/src/index.ts、packages/canvas/canvas/src/index.ts、packages/core/tools/src/registry.ts、packages/preset/domain-experts/src/index.ts、apps/cli/tests/isolated-data.mjs。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { isolateData } from "./isolated-data.mjs";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
const MP3 = Buffer.concat([Buffer.from("ID3\x04\x00\x00\x00\x00\x00\x00", "latin1"), Buffer.alloc(64)]);

const TOOL_NAMES = [
  "canvas_list_projects",
  "canvas_read_project",
  "canvas_create_project",
  "canvas_add_node",
  "canvas_update_node",
  "canvas_remove_node",
  "canvas_connect_nodes",
  "canvas_disconnect_nodes",
  "canvas_list_assets",
  "canvas_list_image_models",
  "canvas_generate_image"
];
const TOOL_IDS = [
  "canvas.projects.list",
  "canvas.projects.read",
  "canvas.projects.create",
  "canvas.nodes.add",
  "canvas.nodes.update",
  "canvas.nodes.remove",
  "canvas.nodes.connect",
  "canvas.nodes.disconnect",
  "canvas.assets.list",
  "canvas.generation.image-models",
  "canvas.generation.image"
];

test("画布工具按合同注册、拒绝非法参数，并真实读写画布 Owner", async t => {
  isolateData(t, "canvas-tools");
  const { Context } = await import("@deepseek-ai/cordis");
  const toolsPlugin = await import("lfaa-tools");
  const canvasPlugin = await import("lfaa-canvas");
  const canvasToolPlugin = await import("lfaa-canvas-tool-canvas");
  const { listRegisteredAiTools } = await import("lfaa-tools/src/registry.js");
  const { APPLICATION_IDS } = await import("lfaa-util-values/src/application-id.js");
  const owner = await import("lfaa-canvas/src/index.js");

  const context = new Context();
  const fibers = [];
  try {
    fibers.push(await context.plugin(toolsPlugin));
    fibers.push(await context.plugin(canvasPlugin));
    fibers.push(await context.plugin(canvasToolPlugin));

    const registered = listRegisteredAiTools();
    const names = registered.map(tool => tool.name);
    const ids = registered.map(tool => tool.id);
    assert.deepEqual([...names].sort(), [...TOOL_NAMES].sort(), "必须且只能登记合同中的十个画布工具名");
    assert.deepEqual([...ids].sort(), [...TOOL_IDS].sort(), "工具 ID 必须稳定且唯一");
    for (const tool of registered) {
      assert.equal(tool.coreManaged, true, tool.name + " 必须是核心管理工具");
      assert.deepEqual([...tool.applicationIds].sort(), APPLICATION_IDS.filter(applicationId => applicationId !== "aivideo").sort(), tool.name + " 必须只声明通用 Canvas Owner 支持的 App");
      assert.equal(typeof tool.parse, "function");
      assert.equal(typeof tool.execute, "function");
    }
    const find = name => {
      const tool = listRegisteredAiTools().find(item => item.name === name);
      assert.ok(tool, "缺少真实登记的工具：" + name);
      return tool;
    };

    const userId = "canvas-tool-account";
    const toolContext = {
      userId,
      userRole: "member",
      applicationId: "workspace",
      agentRunId: "canvas-tool-run",
      signal: new AbortController().signal,
      onProgress() {}
    };
    const call = async (name, args) => {
      const tool = find(name);
      return tool.execute(tool.parse(args), toolContext);
    };
    const rejects = async (name, args, pattern) => {
      const tool = find(name);
      await assert.rejects(async () => tool.execute(tool.parse(args), toolContext), pattern);
    };

    // 参数校验：非法 App、未知 section/节点类型、超长文本、缺失并发基线与非法比例都必须拒绝。
    assert.throws(() => find("canvas_list_projects").parse({ applicationId: "canvas" }), /applicationId/);
    assert.throws(() => find("canvas_list_projects").parse({ applicationId: "aivideo" }), /applicationId/, "漫剧项目必须走 AI Video Owner，不能通过通用 Canvas 创建第二份数据");
    assert.throws(() => find("canvas_read_project").parse({ applicationId: "workspace", projectId: randomUUID(), section: "summary" }), /section/);
    assert.throws(() => find("canvas_add_node").parse({
      applicationId: "workspace", projectId: randomUUID(), expectedUpdatedAt: new Date().toISOString(),
      type: "widget", x: 0, y: 0, data: {}
    }), /节点 type/);
    assert.throws(() => find("canvas_add_node").parse({
      applicationId: "workspace", projectId: randomUUID(), expectedUpdatedAt: new Date().toISOString(),
      type: "text", x: 0, y: 0, data: { text: "a".repeat(20_001) }
    }), /text/);
    assert.throws(() => find("canvas_update_node").parse({
      applicationId: "workspace", projectId: randomUUID(), nodeId: randomUUID()
    }), /expectedUpdatedAt/);
    assert.throws(() => find("canvas_generate_image").parse({
      applicationId: "workspace", projectId: randomUUID(), expectedUpdatedAt: new Date().toISOString(),
      prompt: "夜景", aspectRatio: "3:2"
    }), /aspectRatio/);
    assert.equal(find("canvas_add_node").risk({}), "write");
    assert.equal(find("canvas_generate_image").risk({}), "dangerous");

    // 真实 Owner：空列表 → 新建项目。
    assert.deepEqual(await call("canvas_list_projects", { applicationId: "workspace" }), { applicationId: "workspace", total: 0, projects: [] });
    const created = await call("canvas_create_project", { applicationId: "workspace", title: "Agent 画布" });
    assert.equal(created.created, true);
    assert.equal(created.project.applicationId, "workspace");
    const projectId = created.project.id;
    const createUpdatedAt = created.project.updatedAt;
    const createApproval = find("canvas_create_project").approval({ applicationId: "workspace", title: "Agent 画布" }, toolContext);
    assert.match(createApproval.scopeKey, /canvas:workspace:project:create/);

    // 真实添加两个节点并连接；写操作返回真实最新 updatedAt。
    const textNode = await call("canvas_add_node", {
      applicationId: "workspace", projectId, expectedUpdatedAt: createUpdatedAt,
      type: "text", x: 40, y: 60, data: { text: "夜里的街角" }
    });
    assert.equal(textNode.added, true);
    assert.equal(textNode.node.type, "text");
    assert.equal(textNode.node.data.text, "夜里的街角");
    assert.equal(textNode.project.nodeCount, 1);
    const stored = owner.readCanvasProject(userId, "workspace", projectId);
    assert.equal(stored.nodes[0].data.text, "夜里的街角", "工具结果必须来自画布 Owner 真实落盘的数据");

    // 过期 expectedUpdatedAt 返回真实 409，且不得写入。
    await rejects("canvas_add_node", {
      applicationId: "workspace", projectId, expectedUpdatedAt: createUpdatedAt,
      type: "note", x: 0, y: 0, data: { text: "旧版本" }
    }, /409/);
    assert.equal(owner.readCanvasProject(userId, "workspace", projectId).nodes.length, 1, "409 后不得写入任何节点");

    const noteNode = await call("canvas_add_node", {
      applicationId: "workspace", projectId, expectedUpdatedAt: textNode.updatedAt,
      type: "note", x: 420, y: 60, data: { text: "备注" }
    });
    const connected = await call("canvas_connect_nodes", {
      applicationId: "workspace", projectId, expectedUpdatedAt: noteNode.updatedAt,
      source: textNode.node.id, target: noteNode.node.id
    });
    assert.equal(connected.project.edgeCount, 1);
    assert.match(find("canvas_connect_nodes").approval({ applicationId: "workspace", projectId }, toolContext).scopeKey, /canvas:workspace:project:/);

    // 分页读取：节点按 limit 有界返回，project section 返回真实计数与视口。
    const firstPage = await call("canvas_read_project", { applicationId: "workspace", projectId, section: "nodes", limit: 1 });
    assert.equal(firstPage.totalItems, 2);
    assert.equal(firstPage.items.length, 1);
    assert.equal(firstPage.nextOffset, 1);
    const secondPage = await call("canvas_read_project", { applicationId: "workspace", projectId, section: "nodes", offset: 1, limit: 1 });
    assert.equal(secondPage.items.length, 1);
    assert.equal(secondPage.nextOffset, null);
    const projectSection = await call("canvas_read_project", { applicationId: "workspace", projectId, section: "project" });
    assert.equal(projectSection.project.nodeCount, 2);
    assert.equal(projectSection.project.edgeCount, 1);
    assert.deepEqual(projectSection.viewport, { x: 0, y: 0, zoom: 1 });
    const edgeSection = await call("canvas_read_project", { applicationId: "workspace", projectId, section: "edges", limit: 10 });
    assert.equal(edgeSection.totalItems, 1);

    // 更新节点：移动并改文本，返回真实最新版本。
    const moved = await call("canvas_update_node", {
      applicationId: "workspace", projectId, expectedUpdatedAt: connected.updatedAt,
      nodeId: textNode.node.id, x: 120, y: 140, data: { text: "夜里更新的街角" }
    });
    assert.equal(moved.node.x, 120);
    assert.equal(moved.node.data.text, "夜里更新的街角");
    assert.equal(owner.readCanvasProject(userId, "workspace", projectId).nodes.find(node => node.id === textNode.node.id).x, 120);

    // 真实素材：工具不传二进制，素材由 Owner 上传后经 canvas_list_assets 读取；节点引用必须属于本项目。
    const uploaded = owner.uploadCanvasAsset(userId, "workspace", projectId, moved.updatedAt, "夜景.png", "image/png", PNG);
    const assetId = uploaded.assets[0].assetId;
    const assetsPage = await call("canvas_list_assets", { applicationId: "workspace", projectId });
    assert.equal(assetsPage.totalItems, 1);
    assert.equal(assetsPage.items[0].assetId, assetId);
    assert.equal(assetsPage.items[0].referencedByNodeCount, 0);
    assert.equal(assetsPage.usage.assetCount, 1);
    const imageNode = await call("canvas_add_node", {
      applicationId: "workspace", projectId, expectedUpdatedAt: uploaded.updatedAt,
      type: "image", x: 40, y: 340, data: { assetId }
    });
    assert.equal(imageNode.node.data.assetName, "夜景.png", "媒体节点名称必须取 Owner 保存的真实素材名");
    assert.equal((await call("canvas_list_assets", { applicationId: "workspace", projectId })).items[0].referencedByNodeCount, 1);
    await rejects("canvas_add_node", {
      applicationId: "workspace", projectId, expectedUpdatedAt: imageNode.updatedAt,
      type: "note", x: 0, y: 0, data: { references: [{ assetId: randomUUID() }] }
    }, /不在当前画布项目/);
    await rejects("canvas_add_node", {
      applicationId: "workspace", projectId, expectedUpdatedAt: imageNode.updatedAt,
      type: "video", x: 0, y: 0, data: { assetId }
    }, /只能引用 video\//);
    const audioUploaded = owner.uploadCanvasAsset(userId, "workspace", projectId, imageNode.updatedAt, "旁白.mp3", "audio/mpeg", MP3);
    const audioNode = await call("canvas_add_node", {
      applicationId: "workspace", projectId, expectedUpdatedAt: audioUploaded.updatedAt,
      type: "audio", x: 420, y: 340, data: { assetId: audioUploaded.assets[1].assetId }
    });
    assert.equal(audioNode.node.type, "audio");

    // 删除节点同步移除连线；断开连线只删除真实存在的连线。
    const removed = await call("canvas_remove_node", {
      applicationId: "workspace", projectId, expectedUpdatedAt: audioNode.updatedAt, nodeId: noteNode.node.id
    });
    assert.equal(removed.removed, true);
    assert.equal(removed.removedEdgeCount, 1);
    assert.equal(removed.project.edgeCount, 0);
    const reconnected = await call("canvas_connect_nodes", {
      applicationId: "workspace", projectId, expectedUpdatedAt: removed.updatedAt,
      source: textNode.node.id, target: imageNode.node.id
    });
    const disconnected = await call("canvas_disconnect_nodes", {
      applicationId: "workspace", projectId, expectedUpdatedAt: reconnected.updatedAt, edgeId: reconnected.edge.id
    });
    assert.equal(disconnected.disconnected, true);
    assert.equal(disconnected.project.edgeCount, 0);

    // 跨 App 与跨账户隔离：同一项目在 other App / 其他账户下视为不存在，不串数据。
    await rejects("canvas_read_project", { applicationId: "writing", projectId, section: "project" }, /只能操作当前 App 的项目/);
    await rejects("canvas_list_projects", { applicationId: "writing" }, /只能操作当前 App 的项目/);
    const beforeGenerate = owner.readCanvasProject(userId, "workspace", projectId);
    await rejects("canvas_generate_image", {
      applicationId: "workspace", projectId, expectedUpdatedAt: disconnected.updatedAt,
      prompt: "夜里的街角，电影感"
    }, /尚未装配/);
    assert.equal(owner.readCanvasProject(userId, "workspace", projectId).updatedAt, beforeGenerate.updatedAt, "生成能力未装配时不得写入任何成功结果");

    // 装配生成 Owner 后：工具原样传递参数、透传真实结果，失败原因原样暴露且不重试。
    const generationCalls = [];
    let generationBehavior = "success";
    const fakeGeneration = {
      async generateImage(callUserId, callApplicationId, callProjectId, input) {
        generationCalls.push({ userId: callUserId, applicationId: callApplicationId, projectId: callProjectId, input });
        if (generationBehavior === "throw") throw new Error("设置中心没有可用的图片生成账户；未发起 Provider 请求。");
        const current = owner.readCanvasProject(callUserId, callApplicationId, callProjectId);
        const asset = { assetId: randomUUID(), name: "生成图.png", mimeType: "image/png", bytes: PNG.length, createdAt: new Date().toISOString() };
        return { project: { ...current, assets: [...current.assets, asset], updatedAt: new Date().toISOString() }, asset };
      }
    };
    context.provide("lfaaCanvasGeneration", fakeGeneration);
    const generated = await call("canvas_generate_image", {
      applicationId: "workspace", projectId, expectedUpdatedAt: beforeGenerate.updatedAt,
      prompt: "夜里的街角，电影感", aspectRatio: "16:9", referenceAssetIds: [assetId]
    });
    assert.equal(generated.generated, true);
    assert.equal(generated.asset.name, "生成图.png");
    assert.equal(generationCalls.length, 1);
    assert.equal(generationCalls[0].userId, userId);
    assert.equal(generationCalls[0].applicationId, "workspace");
    assert.equal(generationCalls[0].projectId, projectId);
    assert.equal(generationCalls[0].input.expectedUpdatedAt, beforeGenerate.updatedAt);
    assert.equal(generationCalls[0].input.prompt, "夜里的街角，电影感");
    assert.equal(generationCalls[0].input.aspectRatio, "16:9");
    assert.deepEqual(generationCalls[0].input.referenceAssetIds, [assetId]);
    assert.equal(generationCalls[0].input.nodeId, undefined);
    await rejects("canvas_generate_image", {
      applicationId: "workspace", projectId, expectedUpdatedAt: beforeGenerate.updatedAt,
      nodeId: textNode.node.id, prompt: "写进文本节点"
    }, /generation 节点/);
    assert.equal(generationCalls.length, 1, "nodeId 类型不合法时不得调用生成 Owner");
    generationBehavior = "throw";
    await rejects("canvas_generate_image", {
      applicationId: "workspace", projectId, expectedUpdatedAt: beforeGenerate.updatedAt,
      prompt: "再试一次"
    }, /没有可用的图片生成账户/);
    assert.equal(generationCalls.length, 2, "失败时只调用一次生成 Owner，不重试");
    assert.equal(owner.readCanvasProject(userId, "workspace", projectId).updatedAt, beforeGenerate.updatedAt, "生成失败不得写入成功结果");

    // 列表与结果来自真实 Owner：标题、计数、更新时间一致。
    const projects = await call("canvas_list_projects", { applicationId: "workspace" });
    assert.equal(projects.total, 1);
    assert.equal(projects.projects[0].id, projectId);
    assert.equal(projects.projects[0].nodeCount, 3);
    assert.equal(projects.projects[0].updatedAt, owner.readCanvasProject(userId, "workspace", projectId).updatedAt);
  } finally {
    for (const fiber of fibers.reverse()) await fiber.dispose();
  }
  assert.equal(listRegisteredAiTools().some(tool => tool.name.startsWith("canvas_")), false, "插件卸载后不得残留画布工具");
});

test("画布导演专家按真实 aiExtensions 目录登记并按需加载正文", async () => {
  const { Context } = await import("@deepseek-ai/cordis");
  const { AiExtensionRegistry } = await import("lfaa-agent");
  const context = new Context();
  new AiExtensionRegistry(context);
  const fiber = await context.plugin(await import("lfaa-domain-experts"));
  try {
    const experts = context.aiExtensions.list("expert");
    const entry = experts.find(item => item.id === "expert.canvas-director");
    assert.ok(entry, "必须登记画布导演专家");
    assert.equal(entry.name, "画布导演");
    assert.equal(entry.kind, "expert");
    assert.equal(entry.instructions, undefined, "专家目录不得预载正文");
    assert.equal(entry.loadInstructions, undefined, "注册表列表不暴露正文加载器");
    const loaded = await context.aiExtensions.loadInstructions("expert.canvas-director", "workspace");
    assert.match(loaded.instructions, /canvas_read_project/, "专家方法必须指向真实读取工具");
    assert.match(loaded.instructions, /canvas_add_node/);
    assert.match(loaded.instructions, /canvas_generate_image/, "专家方法必须指向真实生成工具");
    assert.match(loaded.instructions, /expectedUpdatedAt/, "专家方法必须要求并发基线");
    assert.doesNotMatch(loaded.instructions, /canvas_delete_project/, "未登记的项目删除工具不得出现在专家方法中");
    const aiVideoExpert = experts.find(item => item.id === "expert.aivideo-director");
    assert.ok(aiVideoExpert, "必须登记漫剧领域员工");
    assert.deepEqual(aiVideoExpert.applicationIds, ["aivideo"], "漫剧员工只在漫剧 App 的 Agent Runtime 中可用");
    const aiVideoInstructions = await context.aiExtensions.loadInstructions("expert.aivideo-director", "aivideo");
    assert.match(aiVideoInstructions.instructions, /aivideo_update_project/);
    assert.match(aiVideoInstructions.instructions, /不要调用通用 canvas_\*/);
    await assert.rejects(() => context.aiExtensions.loadInstructions("expert.aivideo-director", "workspace"), /不在当前上下文范围/);
  } finally {
    await fiber.dispose();
  }
  assert.equal(context.aiExtensions.list("expert").length, 0, "插件卸载后专家目录必须撤销");
});

