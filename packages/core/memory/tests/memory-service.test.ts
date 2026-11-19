// 验证 @lfaa/memory 短期会话持久化、项目聊天计数（不含归档）、窗口裁剪及长期记忆召回。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import {
  buildRunSummaryEntry,
  getCurrentUserHomeDir,
  getDefaultDataRoot,
  memoryPlugin,
  normalizeCustomDataPath,
  rollSessionSummary,
} from "../src/index";

test("Host memoryPlugin 持久化会话消息、裁剪上下文并召回相关长期记忆", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-memory-test-"));
  const ctx = new Context();
  const fiber = ctx.plugin(memoryPlugin, {
    sessionsDir: path.join(tempRoot, "sessions"),
    memoryFilePath: path.join(tempRoot, "memory.json"),
  });
  await fiber;

  try {
    const s1 = await ctx.memory.createSession({ projectId: "proj-1" });
    await ctx.memory.appendMessage(s1.id, {
      id: "m1",
      role: "user",
      content: "帮我检查 src/index.ts 中的服务导出",
      createdAt: Date.now(),
    });
    await ctx.memory.appendMessage(s1.id, {
      id: "m2",
      role: "assistant",
      content: "已核查完毕，导出结构完整。",
      createdAt: Date.now(),
    });

    const s2 = await ctx.memory.createSession({ projectId: "proj-1" });
    await ctx.memory.updateSession(s2.id, { archived: true });

    const countsActive = await ctx.memory.countSessionsByProject(false);
    const countsWithArchived = await ctx.memory.countSessionsByProject(true);
    assert.equal(countsActive["proj-1"], 1);
    assert.equal(countsWithArchived["proj-1"], 2);

    const loaded = await ctx.memory.getSession(s1.id);
    // 0.0.4 起会话标题采用“简洁标题”约定：去掉“帮我检查”等客套前缀并截断，旧断言未同步。
    assert.equal(loaded?.title, "src/index.ts 中的服");
    assert.equal(loaded?.messages.length, 2);

    await ctx.memory.addMemory({
      scope: "project",
      projectId: "proj-1",
      content: "该项目严格要求 pnpm workspace 与中文文件头注释。",
      tags: ["规范", "pnpm"],
    });
    await ctx.memory.addMemory({
      scope: "global",
      content: "用户偏好简洁响应。",
    });

    const recalled = await ctx.memory.recallRelevantMemories({
      query: "检查 pnpm 注释规范",
      projectId: "proj-1",
    });
    assert.ok(recalled[0]?.content.includes("pnpm"));

    const windowCtx = await ctx.memory.buildContextMessages(s1.id, { maxRecentMessages: 1 });
    assert.equal(windowCtx.recentMessages.length, 1);
    assert.ok(windowCtx.summaryNote?.includes("1 条历史消息"));

    // 正在流式输出的空 assistant 占位消息不得进入上下文窗口
    await ctx.memory.appendMessage(s1.id, {
      id: "m3-user",
      role: "user",
      content: "继续回复",
      createdAt: Date.now(),
    });
    await ctx.memory.appendMessage(s1.id, {
      id: "m4-placeholder",
      role: "assistant",
      content: "",
      status: "streaming",
      createdAt: Date.now(),
    });
    const cleanCtx = await ctx.memory.buildContextMessages(s1.id, { maxRecentMessages: 10 });
    assert.equal(cleanCtx.recentMessages.some((m) => m.id === "m4-placeholder"), false);
    assert.equal(cleanCtx.recentMessages[cleanCtx.recentMessages.length - 1]?.id, "m3-user");

    await fiber.dispose();
    assert.equal((ctx as { memory?: unknown }).memory, undefined);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("MemoryService 管理资产库产物、自定义路径规范化与无损迁移", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-storage-mig-"));
  const defaultRoot = path.join(tempRoot, "default-home", "data");
  const customBase = path.join(tempRoot, "custom-vault");
  const expectedCustomData = path.join(customBase, "data");
  assert.equal(normalizeCustomDataPath(customBase), expectedCustomData);
  assert.equal(normalizeCustomDataPath(expectedCustomData), expectedCustomData);

  const ctx = new Context();
  await ctx.plugin(memoryPlugin, {
    dataRoot: defaultRoot,
    storageConfigFilePath: path.join(tempRoot, "storage-config.json"),
    recommendedProjectDataRoot: path.join(tempRoot, "project-repo", "data"),
    legacyHomeDir: path.join(tempRoot, "unused-legacy"),
  });

  try {
    await ctx.memory.addMemory({ scope: "global", content: "测试记忆条目" });
    const session = await ctx.memory.createSession({ title: "资产迁移会话" });
    const artifact = await ctx.memory.saveLibraryAsset({
      category: "artifact",
      title: "架构分析报告",
      fileName: "report.md",
      content: "# LFAA 报告\n全部正常",
      tags: ["报告"],
      sourceSessionId: session.id,
    });
    const asset = await ctx.memory.saveLibraryAsset({
      category: "asset",
      title: "参考配置",
      fileName: "config.json",
      content: "{\"ok\":true}",
    });

    const statsBefore = await ctx.memory.getStorageStats();
    assert.equal(statsBefore.memoryCount, 1);
    assert.equal(statsBefore.sessionCount, 1);
    assert.equal(statsBefore.artifactCount, 1);
    assert.equal(statsBefore.assetCount, 1);

    const migRes = await ctx.memory.migrateStorage({
      targetPath: customBase,
      mode: "custom",
    });
    assert.equal(migRes.verified, true);
    assert.equal(migRes.toRoot, expectedCustomData);
    assert.ok(migRes.copiedFiles >= 3);

    // 验证迁移后读取内容无损且继续从新位置读写
    const readBack = await ctx.memory.readLibraryAsset(artifact.id);
    assert.equal(readBack?.content, "# LFAA 报告\n全部正常");
    assert.equal((await ctx.memory.listLongTermMemories()).length, 1);
    assert.equal((await ctx.memory.listLibraryAssets()).length, 2);

    const deleted = await ctx.memory.removeLibraryAsset(asset.id);
    assert.equal(deleted, true);
    assert.equal((await ctx.memory.listLibraryAssets()).length, 1);

    // 验证动态用户主目录检测不写死用户名
    assert.equal(getDefaultDataRoot(), path.join(getCurrentUserHomeDir(), ".lfaa", "data"));

    // 验证项目推荐目录迁移会在目标根目录实际生成 data 及资料库子目录，而历史会话固定留在用户 .lfaa/sessions 不随项目迁移
    const dynamicProjectRoot = path.join(tempRoot, "moved-project-folder");
    const projectState = await ctx.memory.getStorageState(dynamicProjectRoot);
    assert.equal(projectState.recommendedProjectDataRoot, path.join(dynamicProjectRoot, "data"));
    assert.equal(projectState.sessionsRoot, path.join(tempRoot, "unused-legacy", "sessions"));
    const projMig = await ctx.memory.migrateStorage({
      targetPath: projectState.recommendedProjectDataRoot,
      mode: "project",
      projectRoot: dynamicProjectRoot,
    });
    assert.equal(projMig.toRoot, path.join(dynamicProjectRoot, "data"));
    const dataDirStat = await fs.stat(path.join(dynamicProjectRoot, "data"));
    assert.equal(dataDirStat.isDirectory(), true);
    const outputsDirStat = await fs.stat(path.join(dynamicProjectRoot, "data", "agent-outputs"));
    assert.equal(outputsDirStat.isDirectory(), true);
    const assetsDirStat = await fs.stat(path.join(dynamicProjectRoot, "data", "user-assets"));
    assert.equal(assetsDirStat.isDirectory(), true);
    assert.equal(
      await fs.stat(path.join(dynamicProjectRoot, "data", "chat-sessions")).then(() => true).catch(() => false),
      false,
    );
    assert.equal(
      await fs.stat(path.join(tempRoot, "unused-legacy", "sessions", `${session.id}.json`)).then((s) => s.isFile()).catch(() => false),
      true,
    );
    const upgradedReadBack = await ctx.memory.readLibraryAsset(artifact.id);
    assert.equal(upgradedReadBack?.content, "# LFAA 报告\n全部正常");
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("StorageManager 自动无损升级旧版目录命名并将误入 data/ 的会话归位至 .lfaa/sessions", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-upgrade-vault-"));
  const oldRoot = path.join(tempRoot, "legacy-data");
  await fs.mkdir(path.join(oldRoot, "artifacts", "2026-11-18"), { recursive: true });
  await fs.mkdir(path.join(oldRoot, "assets"), { recursive: true });
  await fs.mkdir(path.join(oldRoot, "chat-sessions"), { recursive: true });
  await fs.writeFile(path.join(oldRoot, "chat-sessions", "s-1.json"), "{\"id\":\"s-1\"}", "utf8");
  await fs.writeFile(path.join(oldRoot, "artifacts", "2026-11-18", "out.md"), "# 旧产物", "utf8");
  await fs.writeFile(path.join(oldRoot, "memory.json"), JSON.stringify([{
    id: "m1",
    scope: "global",
    projectId: null,
    content: "旧记忆",
    tags: [],
    createdAt: 1,
    updatedAt: 1,
  }]), "utf8");
  await fs.writeFile(path.join(oldRoot, "library-index.json"), JSON.stringify([{
    id: "a1",
    category: "artifact",
    title: "旧产物标题",
    fileName: "out.md",
    relativePath: "artifacts/2026-11-18/out.md",
    mimeType: "text/markdown",
    sizeBytes: 7,
    tags: [],
    projectId: null,
    createdAt: 1,
    updatedAt: 1,
  }]), "utf8");

  const ctx = new Context();
  await ctx.plugin(memoryPlugin, {
    dataRoot: oldRoot,
    storageConfigFilePath: path.join(tempRoot, "storage-config.json"),
    recommendedProjectDataRoot: path.join(tempRoot, "proj", "data"),
    legacyHomeDir: path.join(tempRoot, "home-lfaa"),
  });

  try {
    const memories = await ctx.memory.listLongTermMemories();
    assert.equal(memories.length, 1);
    assert.equal(memories[0]?.content, "旧记忆");

    const readOut = await ctx.memory.readLibraryAsset("a1");
    assert.equal(readOut?.content, "# 旧产物");
    assert.equal(readOut?.item.relativePath, "agent-outputs/2026-11-18/out.md");

    // 确认误放入 data/chat-sessions 的会话已归位至 .lfaa/sessions 且 data/ 下不再残留 chat-sessions
    assert.equal(
      await fs.stat(path.join(tempRoot, "home-lfaa", "sessions", "s-1.json")).then((s) => s.isFile()).catch(() => false),
      true,
    );
    assert.equal(
      await fs.stat(path.join(oldRoot, "chat-sessions")).then(() => true).catch(() => false),
      false,
    );
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("上下文摘要携带历史工具轨迹，滚动摘要保留最近运行结论", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-memory-digest-"));
  const ctx = new Context();
  const fiber = ctx.plugin(memoryPlugin, {
    sessionsDir: path.join(tempRoot, "sessions"),
    memoryFilePath: path.join(tempRoot, "memory.json"),
  });
  await fiber;

  try {
    const session = await ctx.memory.createSession({ title: "轨迹摘要" });
    const steps = [
      {
        id: "act-1", iteration: 1, phase: "act" as const, status: "done" as const,
        title: "行动：write_file", toolName: "write_file",
        fileChange: {
          path: "src/app.ts", operation: "edited" as const, firstLine: 1,
          before: "", after: "", truncated: false,
        },
        timestamp: Date.now(),
      },
      {
        id: "act-2", iteration: 1, phase: "act" as const, status: "done" as const,
        title: "行动：run_command", toolName: "run_command",
        commandTrace: { command: "pnpm build", exitCode: 0 },
        timestamp: Date.now(),
      },
    ];
    await ctx.memory.appendMessage(session.id, { id: "u1", role: "user", content: "改一下 app.ts", createdAt: Date.now() });
    await ctx.memory.appendMessage(session.id, {
      id: "a1", role: "assistant", content: "已改好并构建通过。", steps, status: "done", createdAt: Date.now(),
    });
    await ctx.memory.appendMessage(session.id, { id: "u2", role: "user", content: "再补一个测试", createdAt: Date.now() });
    await ctx.memory.appendMessage(session.id, {
      id: "a2", role: "assistant", content: "测试已补。", status: "done", createdAt: Date.now(),
    });

    const windowCtx = await ctx.memory.buildContextMessages(session.id, { maxRecentMessages: 1 });
    assert.equal(windowCtx.recentMessages.length, 1);
    assert.match(windowCtx.summaryNote ?? "", /前序工具轨迹/u);
    assert.match(windowCtx.summaryNote ?? "", /src\/app\.ts/u);
    assert.match(windowCtx.summaryNote ?? "", /pnpm build`→0/u);

    const entry = buildRunSummaryEntry({
      userMessage: "改一下 app.ts",
      content: "已改好并构建通过。",
      digest: "已改动 1 个文件（src/app.ts）",
    });
    const rolled = rollSessionSummary("第一轮：初始化", entry);
    assert.match(rolled, /第一轮：初始化/u);
    assert.match(rolled, /本轮：改一下 app\.ts/u);
    const capped = rollSessionSummary("旧".repeat(400), entry, 100);
    assert.ok(capped.startsWith("…"));
    assert.ok(capped.length <= 101);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("启动时结算遗留的流式消息并清理写入中断的临时文件", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-memory-reconcile-"));
  const sessionsDir = path.join(tempRoot, "sessions");
  const ctx = new Context();
  await ctx.plugin(memoryPlugin, {
    sessionsDir,
    memoryFilePath: path.join(tempRoot, "memory.json"),
  });

  try {
    const session = await ctx.memory.createSession({ title: "中断恢复" });
    await ctx.memory.appendMessage(session.id, { id: "u1", role: "user", content: "跑一个长任务", createdAt: Date.now() });
    await ctx.memory.appendMessage(session.id, {
      id: "a1",
      role: "assistant",
      content: "已经完成一半",
      status: "streaming",
      steps: [{
        id: "act-1", iteration: 1, phase: "act", status: "running",
        title: "行动：调用 run_command", timestamp: Date.now(),
      }],
      createdAt: Date.now(),
    });
    await fs.writeFile(path.join(sessionsDir, "a1.abandoned.tmp"), "{}", "utf8");

    const result = await ctx.memory.reconcileInterruptedRuns();
    assert.equal(result.messages, 1);
    assert.equal(result.tmpRemoved, 1);

    const saved = await ctx.memory.getSession(session.id);
    const message = saved?.messages.find((item) => item.id === "a1");
    assert.equal(message?.status, "aborted");
    assert.equal(message?.content, "已经完成一半");
    assert.equal(message?.steps?.find((step) => step.id === "act-1")?.status, "error");
    assert.ok(message?.steps?.some((step) => step.title.includes("应用退出时中断")));
    assert.equal(
      await fs.stat(path.join(sessionsDir, "a1.abandoned.tmp")).then(() => true).catch(() => false),
      false,
    );
    // 再次结算不应重复改写
    const again = await ctx.memory.reconcileInterruptedRuns();
    assert.equal(again.messages, 0);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});
