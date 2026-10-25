/**
 * 功能：回归系统级无限画布的项目与素材 Owner。
 * 作用：验证账户隔离、App 作用域隔离、跨 App 拒绝、list 全部、磁盘 JSON、并发版本、边界、素材 MIME/引用/Range 与符号链接拒绝。
 * 运行：在 apps/cli 下 node --import tsx --import ./register-package-loader.mjs --import ./tests/isolated-test-environment.mjs --test tests/canvas-owner.test.mjs（工作区包必须经 register-package-loader 解析）。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { isolateData } from "./isolated-data.mjs";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
const WEBM = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
// 音频文件头夹具：ID3 标签、MPEG 帧同步、RIFF WAVE、OggS。
const MP3_ID3 = Buffer.concat([Buffer.from("ID3", "latin1"), Buffer.from([0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])]);
const MP3_FRAME = Buffer.from([0xff, 0xfb, 0x90, 0x64, 0x00, 0x00, 0x00, 0x00]);
const WAV = Buffer.concat([Buffer.from("RIFF", "latin1"), Buffer.from([0x24, 0x00, 0x00, 0x00]), Buffer.from("WAVE", "latin1"), Buffer.alloc(16)]);
const OGG = Buffer.concat([Buffer.from("OggS", "latin1"), Buffer.alloc(24)]);

function canvasNode(type, x, y, data = {}) {
  return { id: randomUUID(), type, x, y, width: 320, height: 180, data };
}

function canvasInput(title, nodes, edges = [], viewport = { x: 0, y: 0, zoom: 1 }) {
  return { title, viewport, nodes, edges };
}

test("无限画布按账户与 App 隔离、跨 App 拒绝并保持 CRUD/边界/素材规则", async t => {
  isolateData(t, "canvas-owner");
  const owner = await import("lfaa-canvas/src/index.js");
  const { resolveUserDataPaths } = await import("lfaa-home-paths/src/data-layout.mjs");
  const accountProjects = resolveUserDataPaths(process.env.LFAA_DATA_DIR, "account-a").projects;
  const projectPath = (applicationId, projectId) => resolve(accountProjects, "canvas", applicationId, projectId, "project.json");

  // 创建：项目带 applicationId，按 App 分目录。
  const writingProject = owner.createCanvasProject("account-a", "writing", "写作画布");
  const workspaceProject = owner.createCanvasProject("account-a", "workspace", "工作区画布");
  assert.equal(writingProject.format, "lfaa-canvas-project");
  assert.equal(writingProject.formatVersion, 2);
  assert.equal(writingProject.applicationId, "writing");
  assert.equal(workspaceProject.applicationId, "workspace");
  assert.notEqual(writingProject.id, workspaceProject.id);

  // 账户隔离。
  assert.deepEqual(owner.listCanvasProjects("account-b"), []);
  assert.deepEqual(owner.listCanvasProjects("account-b", "writing"), []);
  assert.equal(owner.readCanvasProject("account-b", "writing", writingProject.id), null);

  // 跨 App 拒绝：读/写/删/素材都视为不存在，不串数据。
  assert.equal(owner.readCanvasProject("account-a", "workspace", writingProject.id), null);
  assert.equal(owner.updateCanvasProject("account-a", "workspace", writingProject.id, writingProject.updatedAt, canvasInput("串 App", [])), null);
  assert.equal(owner.deleteCanvasProject("account-a", "workspace", writingProject.id), false);
  assert.equal(owner.openCanvasAsset("account-a", "workspace", writingProject.id, randomUUID()), null);
  assert.equal(owner.readCanvasProject("account-a", "writing", writingProject.id).title, "写作画布");

  // list 全部 App 与单 App。
  const all = owner.listCanvasProjects("account-a");
  assert.equal(all.length, 2);
  assert.deepEqual(new Set(all.map(project => project.applicationId)), new Set(["writing", "workspace"]));
  const onlyWriting = owner.listCanvasProjects("account-a", "writing");
  assert.equal(onlyWriting.length, 1);
  assert.equal(onlyWriting[0].id, writingProject.id);
  assert.equal(onlyWriting[0].applicationId, "writing");
  assert.equal(onlyWriting[0].assetCount, 0);

  // 非法 App / 路径穿越明确拒绝。
  assert.throws(() => owner.createCanvasProject("account-a", "canvas", "非法 App"), /App 无效/u);
  assert.throws(() => owner.listCanvasProjects("account-a", "canvas"), /App 无效/u);
  assert.throws(() => owner.readCanvasProject("account-a", "../writing", writingProject.id), /App 无效/u);
  assert.throws(() => owner.createCanvasProject("account-a", "writing", "字".repeat(81)), /80/u);

  // 磁盘 JSON：路径为 projects/canvas/<appId>/<projectId>/project.json，含 applicationId。
  const stored = JSON.parse(readFileSync(projectPath("writing", writingProject.id), "utf8"));
  assert.equal(stored.format, "lfaa-canvas-project");
  assert.equal(stored.formatVersion, 2);
  assert.equal(stored.applicationId, "writing");
  assert.equal(stored.id, writingProject.id);
  assert.equal(existsSync(projectPath("workspace", workspaceProject.id)), true);
  assert.equal(existsSync(projectPath("workspace", writingProject.id)), false);

  // 旧 v1 的 UUID 目录不读取也不迁移（只忽略，不删除）。
  const legacyId = randomUUID();
  const legacyDirectory = resolve(accountProjects, "canvas", legacyId);
  mkdirSync(legacyDirectory, { recursive: true });
  writeFileSync(resolve(legacyDirectory, "project.json"), JSON.stringify({
    format: "lfaa-canvas-project", formatVersion: 1, id: legacyId, title: "旧画布",
    viewport: { x: 0, y: 0, zoom: 1 }, nodes: [], edges: [], assets: [],
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z"
  }) + "\n", "utf8");
  assert.equal(owner.listCanvasProjects("account-a").length, 2);
  assert.equal(existsSync(resolve(legacyDirectory, "project.json")), true);

  // 更新 + 409 并发版本（按 App 独立）。
  const textNode = canvasNode("text", -120, 64, { text: "夜里的街角" });
  const noteNode = canvasNode("note", 240, 64, { text: "备注" });
  const edge = { id: randomUUID(), source: textNode.id, target: noteNode.id };
  const updated = owner.updateCanvasProject("account-a", "writing", writingProject.id, writingProject.updatedAt, canvasInput("街角", [textNode, noteNode], [edge], { x: 12, y: -8, zoom: 1.25 }));
  assert.equal(updated.title, "街角");
  assert.equal(updated.nodes.length, 2);
  assert.equal(updated.edges.length, 1);
  assert.deepEqual(updated.viewport, { x: 12, y: -8, zoom: 1.25 });
  assert.ok(updated.updatedAt > writingProject.updatedAt);
  assert.throws(
    () => owner.updateCanvasProject("account-a", "writing", writingProject.id, writingProject.updatedAt, canvasInput("旧版本", [])),
    owner.CanvasConflictError
  );

  // 节点 type 放宽为 App 可扩展标识；非法标识仍拒绝。
  const customNode = canvasNode("app.widget.v2", 0, 0, { text: "扩展节点" });
  const workspaceUpdated = owner.updateCanvasProject("account-a", "workspace", workspaceProject.id, workspaceProject.updatedAt, canvasInput("工作区街角", [customNode]));
  assert.equal(workspaceUpdated.applicationId, "workspace");
  assert.equal(workspaceUpdated.nodes[0].type, "app.widget.v2");
  assert.throws(
    () => owner.updateCanvasProject("account-a", "workspace", workspaceProject.id, workspaceUpdated.updatedAt, canvasInput("坏类型", [canvasNode("Bad Type", 0, 0, {})])),
    /节点类型无效/u
  );

  // 项目 JSON 内的 applicationId 不能跨 App 伪造。
  assert.throws(
    () => owner.updateCanvasProject("account-a", "writing", writingProject.id, updated.updatedAt, { ...canvasInput("串 App", []), applicationId: "workspace" }),
    /跨 App/u
  );

  const writingStored = JSON.parse(readFileSync(projectPath("writing", writingProject.id), "utf8"));
  assert.equal(writingStored.applicationId, "writing");
  assert.equal(writingStored.nodes[0].data.text, "夜里的街角");
  assert.equal(writingStored.edges[0].source, textNode.id);
  const writingSummary = owner.listCanvasProjects("account-a", "writing")[0];
  assert.equal(writingSummary.applicationId, "writing");
  assert.equal(writingSummary.title, "街角");
  assert.equal(writingSummary.nodeCount, 2);

  // 边界（沿用 v1）：数量/坐标/宽高/文本/引用/未知字段。
  const tooManyNodes = Array.from({ length: owner.CANVAS_LIMITS.nodes + 1 }, () => canvasNode("note", 0, 0, { text: "n" }));
  assert.throws(() => owner.updateCanvasProject("account-a", "writing", writingProject.id, updated.updatedAt, canvasInput("超限", tooManyNodes)), /最多保存 200 个节点/u);
  const tooManyEdges = Array.from({ length: owner.CANVAS_LIMITS.edges + 1 }, () => ({ id: randomUUID(), source: textNode.id, target: noteNode.id }));
  assert.throws(() => owner.updateCanvasProject("account-a", "writing", writingProject.id, updated.updatedAt, canvasInput("超限", [textNode, noteNode], tooManyEdges)), /最多保存 400 条连线/u);
  assert.throws(
    () => owner.updateCanvasProject("account-a", "writing", writingProject.id, updated.updatedAt, canvasInput("坏连线", [textNode, noteNode], [{ id: randomUUID(), source: textNode.id, target: randomUUID() }])),
    /不同的现有画布节点/u
  );
  assert.throws(
    () => owner.updateCanvasProject("account-a", "writing", writingProject.id, updated.updatedAt, canvasInput("越界", [canvasNode("note", 100_001, 0, { text: "x" })])),
    /超出画布可用范围/u
  );
  assert.throws(
    () => owner.updateCanvasProject("account-a", "writing", writingProject.id, updated.updatedAt, canvasInput("越界", [{ ...canvasNode("note", 0, 0, { text: "x" }), width: 100 }])),
    /120 到 800/u
  );
  assert.throws(
    () => owner.updateCanvasProject("account-a", "writing", writingProject.id, updated.updatedAt, canvasInput("长文本", [canvasNode("text", 0, 0, { text: "a".repeat(owner.CANVAS_LIMITS.textCharacters + 1) })])),
    /20000/u
  );
  assert.throws(
    () => owner.updateCanvasProject("account-a", "writing", writingProject.id, updated.updatedAt, canvasInput("引用缺失", [canvasNode("image", 0, 0, { assetId: randomUUID() })])),
    /引用的素材不存在/u
  );
  assert.throws(
    () => owner.updateCanvasProject("account-a", "writing", writingProject.id, updated.updatedAt, { ...canvasInput("未知字段", []), unexpected: true }),
    /未知字段/u
  );

  // 素材：App 作用域、MIME 文件头、并发版本、Range、引用检查、跨 App 隔离。
  const uploaded = owner.uploadCanvasAsset("account-a", "writing", writingProject.id, updated.updatedAt, "夜景.png", "image/png; charset=binary", PNG);
  assert.equal(uploaded.assets.length, 1);
  assert.equal(uploaded.assets[0].name, "夜景.png");
  assert.equal(uploaded.assets[0].mimeType, "image/png");
  assert.equal(uploaded.applicationId, "writing");
  const assetId = uploaded.assets[0].assetId;
  const assetPath = resolve(accountProjects, "canvas", "writing", writingProject.id, "assets", assetId);
  assert.equal(existsSync(assetPath), true);
  assert.deepEqual(readFileSync(assetPath), PNG);
  assert.equal(JSON.parse(readFileSync(projectPath("writing", writingProject.id), "utf8")).assets[0].assetId, assetId);
  assert.equal(owner.openCanvasAsset("other-account", "writing", writingProject.id, assetId), null);
  assert.equal(owner.openCanvasAsset("account-a", "workspace", writingProject.id, assetId), null);
  assert.throws(() => owner.uploadCanvasAsset("account-a", "writing", writingProject.id, uploaded.updatedAt, "假图.png", "image/png", WEBM), /与声明的图片、视频或音频格式不一致/u);
  assert.throws(() => owner.uploadCanvasAsset("account-a", "writing", writingProject.id, updated.updatedAt, "旧图.png", "image/png", PNG), owner.CanvasConflictError);
  assert.throws(
    () => owner.uploadCanvasAsset("account-a", "writing", writingProject.id, uploaded.updatedAt, "超大.png", "image/png", Buffer.alloc(owner.CANVAS_LIMITS.imageBytes + 1)),
    /16 MiB/u
  );

  const opened = owner.openCanvasAsset("account-a", "writing", writingProject.id, assetId);
  assert.equal(opened.size, PNG.length);
  assert.equal(opened.mimeType, "image/png");
  const whole = [];
  for await (const chunk of opened.stream) whole.push(chunk);
  assert.deepEqual(Buffer.concat(whole), PNG);
  const ranged = owner.openCanvasAsset("account-a", "writing", writingProject.id, assetId, "bytes=2-5");
  assert.equal(ranged.start, 2);
  assert.equal(ranged.end, 5);
  const rangedBytes = [];
  for await (const chunk of ranged.stream) rangedBytes.push(chunk);
  assert.deepEqual(Buffer.concat(rangedBytes), PNG.subarray(2, 6));
  const suffix = owner.openCanvasAsset("account-a", "writing", writingProject.id, assetId, "bytes=-4");
  assert.equal(suffix.start, PNG.length - 4);
  const suffixBytes = [];
  for await (const chunk of suffix.stream) suffixBytes.push(chunk);
  assert.deepEqual(Buffer.concat(suffixBytes), PNG.subarray(PNG.length - 4));
  assert.equal(owner.openCanvasAsset("account-a", "writing", writingProject.id, assetId, "bytes=999-1000").rangeNotSatisfiable, true);

  const imageNode = { id: randomUUID(), type: "image", x: 0, y: 0, width: 300, height: 300, data: { assetId } };
  const referenced = owner.updateCanvasProject("account-a", "writing", writingProject.id, uploaded.updatedAt, canvasInput("素材画布", [imageNode]));
  assert.deepEqual(referenced.nodes[0].data, { assetId });
  assert.throws(() => owner.removeCanvasAsset("account-a", "writing", writingProject.id, assetId, referenced.updatedAt), /仍被画布节点引用/u);
  const unreferenced = owner.updateCanvasProject("account-a", "writing", writingProject.id, referenced.updatedAt, canvasInput("素材画布", []));
  const removedAsset = owner.removeCanvasAsset("account-a", "writing", writingProject.id, assetId, unreferenced.updatedAt);
  assert.deepEqual(removedAsset.assets, []);
  assert.equal(existsSync(assetPath), false);

  // 音频素材：MP3(ID3/帧同步)、RIFF WAVE、OggS 文件头、单文件 32 MiB 上限与伪造 MIME 拒绝。
  const mp3Uploaded = owner.uploadCanvasAsset("account-a", "writing", writingProject.id, removedAsset.updatedAt, "旁白.mp3", "audio/mpeg; charset=binary", MP3_ID3);
  assert.equal(mp3Uploaded.assets[0].mimeType, "audio/mpeg");
  assert.equal(mp3Uploaded.assets[0].bytes, MP3_ID3.length);
  const mp3FrameUploaded = owner.uploadCanvasAsset("account-a", "writing", writingProject.id, mp3Uploaded.updatedAt, "节拍.mp3", "audio/mpeg", MP3_FRAME);
  assert.equal(mp3FrameUploaded.assets.length, 2);
  const wavUploaded = owner.uploadCanvasAsset("account-a", "writing", writingProject.id, mp3FrameUploaded.updatedAt, "配乐.wav", "audio/wav", WAV);
  const oggUploaded = owner.uploadCanvasAsset("account-a", "writing", writingProject.id, wavUploaded.updatedAt, "环境音.ogg", "audio/ogg", OGG);
  assert.equal(oggUploaded.assets.length, 4);
  assert.deepEqual(new Set(oggUploaded.assets.map(item => item.mimeType)), new Set(["audio/mpeg", "audio/wav", "audio/ogg"]));
  assert.throws(
    () => owner.uploadCanvasAsset("account-a", "writing", writingProject.id, oggUploaded.updatedAt, "伪造.mp3", "audio/mpeg", WAV),
    /与声明的图片、视频或音频格式不一致/u
  );
  assert.throws(
    () => owner.uploadCanvasAsset("account-a", "writing", writingProject.id, oggUploaded.updatedAt, "伪造.wav", "audio/wav", OGG),
    /与声明的图片、视频或音频格式不一致/u
  );
  assert.throws(
    () => owner.uploadCanvasAsset("account-a", "writing", writingProject.id, oggUploaded.updatedAt, "伪造.ogg", "audio/ogg", PNG),
    /与声明的图片、视频或音频格式不一致/u
  );
  assert.throws(
    () => owner.uploadCanvasAsset("account-a", "writing", writingProject.id, oggUploaded.updatedAt, "超大.mp3", "audio/mpeg", Buffer.alloc(owner.CANVAS_LIMITS.audioBytes + 1)),
    /32 MiB/u
  );
  assert.throws(
    () => owner.uploadCanvasAsset("account-a", "writing", writingProject.id, oggUploaded.updatedAt, "未知.flac", "audio/flac", OGG),
    /素材类型无效/u
  );

  // 节点 data.assetIds 与 data.references[].assetId 必须引用当前项目内素材。
  const mp3AssetId = oggUploaded.assets[0].assetId;
  const wavAssetId = oggUploaded.assets.find(item => item.mimeType === "audio/wav").assetId;
  const referenceNode = { id: randomUUID(), type: "generation", x: 0, y: 0, width: 320, height: 260, data: { assetIds: [mp3AssetId], references: [{ assetId: wavAssetId, name: "配乐" }] } };
  const withReferences = owner.updateCanvasProject("account-a", "writing", writingProject.id, oggUploaded.updatedAt, canvasInput("引用素材", [referenceNode]));
  assert.deepEqual(withReferences.nodes[0].data.assetIds, [mp3AssetId]);
  assert.equal(withReferences.nodes[0].data.references[0].assetId, wavAssetId);
  assert.equal(withReferences.nodes[0].data.references[0].name, "配乐");
  assert.throws(
    () => owner.updateCanvasProject("account-a", "writing", writingProject.id, withReferences.updatedAt, canvasInput("缺参考", [{ ...referenceNode, data: { references: [{ assetId: randomUUID() }] } }])),
    /引用的素材不存在/u
  );
  assert.throws(
    () => owner.updateCanvasProject("account-a", "writing", writingProject.id, withReferences.updatedAt, canvasInput("缺引用", [{ ...referenceNode, data: { assetIds: [randomUUID()] } }])),
    /引用的素材不存在/u
  );
  assert.throws(
    () => owner.updateCanvasProject("account-a", "writing", writingProject.id, withReferences.updatedAt, canvasInput("非字符串", [{ ...referenceNode, data: { assetIds: [123] } }])),
    /有效的 UUID/u
  );
  assert.throws(
    () => owner.updateCanvasProject("account-a", "writing", writingProject.id, withReferences.updatedAt, canvasInput("超量引用", [{ ...referenceNode, data: { assetIds: Array.from({ length: owner.CANVAS_LIMITS.nodeAssetIds + 1 }, () => mp3AssetId) } }])),
    /最多 20 个/u
  );
  assert.throws(
    () => owner.updateCanvasProject("account-a", "writing", writingProject.id, withReferences.updatedAt, canvasInput("超量参考", [{ ...referenceNode, data: { references: Array.from({ length: owner.CANVAS_LIMITS.nodeReferences + 1 }, () => ({ assetId: mp3AssetId })) } }])),
    /最多 64 条/u
  );
  assert.throws(
    () => owner.updateCanvasProject("account-a", "writing", writingProject.id, withReferences.updatedAt, canvasInput("缺字段参考", [{ ...referenceNode, data: { references: [{}] } }])),
    /有效的 UUID/u
  );
  // 跨项目素材不算当前项目引用；删除素材前统一检查 assetId/assetIds/references。
  const otherProject = owner.createCanvasProject("account-a", "writing", "另一个画布");
  const otherAsset = owner.uploadCanvasAsset("account-a", "writing", otherProject.id, otherProject.updatedAt, "别处.png", "image/png", PNG);
  assert.throws(
    () => owner.updateCanvasProject("account-a", "writing", writingProject.id, withReferences.updatedAt, canvasInput("跨项目", [{ ...referenceNode, data: { assetIds: [otherAsset.assets[0].assetId] } }])),
    /引用的素材不存在/u
  );
  assert.throws(() => owner.removeCanvasAsset("account-a", "writing", writingProject.id, mp3AssetId, withReferences.updatedAt), /仍被画布节点引用/u);
  assert.throws(() => owner.removeCanvasAsset("account-a", "writing", writingProject.id, wavAssetId, withReferences.updatedAt), /仍被画布节点引用/u);
  assert.equal(owner.deleteCanvasProject("account-a", "writing", otherProject.id), true);

  // 服务器内部提交：素材与节点数据一次写入，仍执行 expectedUpdatedAt 并发检查。
  const committed = owner.commitCanvasAsset("account-a", "writing", writingProject.id, {
    expectedUpdatedAt: withReferences.updatedAt,
    name: "生成结果.png",
    mimeType: "image/png",
    bytes: PNG,
    node: { nodeId: referenceNode.id, data: { ...withReferences.nodes[0].data, generation: { kind: "image", prompt: "一次写入", status: "succeeded" } } }
  });
  assert.equal(committed.project.assets.length, oggUploaded.assets.length + 1);
  assert.equal(committed.project.nodes[0].data.generation.status, "succeeded");
  assert.equal(existsSync(resolve(accountProjects, "canvas", "writing", writingProject.id, "assets", committed.asset.assetId)), true);
  assert.throws(
    () => owner.commitCanvasAsset("account-a", "writing", writingProject.id, { expectedUpdatedAt: withReferences.updatedAt, name: "旧版本.png", mimeType: "image/png", bytes: PNG }),
    owner.CanvasConflictError
  );
  const nodeUpdated = owner.updateCanvasNodeData("account-a", "writing", writingProject.id, committed.project.updatedAt, referenceNode.id, {
    ...committed.project.nodes[0].data,
    generation: { kind: "video", prompt: "运行中", status: "running", taskId: "task-c-1" }
  });
  assert.equal(nodeUpdated.nodes[0].data.generation.taskId, "task-c-1");
  assert.throws(
    () => owner.updateCanvasNodeData("account-a", "writing", writingProject.id, nodeUpdated.updatedAt, randomUUID(), {}),
    /找不到要更新的画布节点/u
  );

  // 损坏项目文件保留原样。
  const corrupt = owner.createCanvasProject("corrupt-account", "writing", "损坏项目");
  const corruptPath = resolve(resolveUserDataPaths(process.env.LFAA_DATA_DIR, "corrupt-account").projects, "canvas", "writing", corrupt.id, "project.json");
  writeFileSync(corruptPath, "{broken", "utf8");
  assert.throws(() => owner.readCanvasProject("corrupt-account", "writing", corrupt.id), /有效 JSON|格式无效/u);
  assert.equal(readFileSync(corruptPath, "utf8"), "{broken");

  // 符号链接拒绝：项目目录链接与 App 目录链接。
  const linkedProjects = resolveUserDataPaths(process.env.LFAA_DATA_DIR, "linked-account").projects;
  const linkedAppRoot = resolve(linkedProjects, "canvas", "writing");
  mkdirSync(linkedAppRoot, { recursive: true });
  const externalProject = resolve(linkedProjects, "canvas-external");
  mkdirSync(externalProject, { recursive: true });
  const linkedId = randomUUID();
  symlinkSync(externalProject, resolve(linkedAppRoot, linkedId), process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => owner.listCanvasProjects("linked-account", "writing"), /符号链接|存储路径类型无效/u);
  assert.throws(() => owner.readCanvasProject("linked-account", "writing", linkedId), /符号链接|存储路径类型无效/u);

  const linkedAppProjects = resolveUserDataPaths(process.env.LFAA_DATA_DIR, "linked-app-account").projects;
  mkdirSync(resolve(linkedAppProjects, "canvas"), { recursive: true });
  const externalApp = resolve(linkedAppProjects, "canvas-external-app");
  mkdirSync(externalApp, { recursive: true });
  symlinkSync(externalApp, resolve(linkedAppProjects, "canvas", "writing"), process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => owner.listCanvasProjects("linked-app-account"), /符号链接|存储路径类型无效/u);
  assert.throws(() => owner.listCanvasProjects("linked-app-account", "writing"), /符号链接|存储路径类型无效/u);

  // 删除：跨 App 与跨账户都不能删除他人数据。
  assert.equal(owner.deleteCanvasProject("account-b", "writing", writingProject.id), false);
  assert.equal(owner.deleteCanvasProject("account-a", "workspace", writingProject.id), false);
  assert.equal(owner.deleteCanvasProject("account-a", "writing", writingProject.id), true);
  assert.equal(existsSync(projectPath("writing", writingProject.id)), false);
  assert.equal(owner.listCanvasProjects("account-a").length, 1);
});
