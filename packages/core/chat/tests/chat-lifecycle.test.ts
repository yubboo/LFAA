// 验证 @lfaa/chat Host/Client 双端 Cordis 生命周期、最近会话注入与项目聊天计数统计。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { registerHooks } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { memoryPlugin } from "@lfaa/memory";
import { chatPlugin } from "../src/index";

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) {
      return {
        format: "module",
        shortCircuit: true,
        source: "export default new Proxy({}, { get: (_, k) => String(k) });",
      };
    }
    return nextLoad(url, context);
  },
});

test("Host chatPlugin 管理会话 CRUD 并统计项目非归档聊天数", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-chat-host-"));
  const ctx = new Context();
  const memFiber = ctx.plugin(memoryPlugin, {
    sessionsDir: path.join(tempRoot, "sessions"),
    memoryFilePath: path.join(tempRoot, "memory.json"),
  });
  await memFiber;
  const chatFiber = ctx.plugin(chatPlugin);
  await chatFiber;

  try {
    const s1 = await ctx.chat.createSession({ title: "会话 1", projectId: "proj-a" });
    const s2 = await ctx.chat.createSession({ title: "会话 2", projectId: "proj-a" });
    await ctx.chat.updateSession(s2.id, { archived: true });

    const counts = await ctx.chat.countByProject(false);
    assert.equal(counts["proj-a"], 1);
    assert.equal((await ctx.chat.getSession(s1.id))?.title, "会话 1");

    await ctx.chat.updateSession(s1.id, { unread: true, sectionId: "sec-1" });
    const marked = await ctx.chat.getSession(s1.id);
    assert.equal(marked?.unread, true);
    assert.equal(marked?.sectionId, "sec-1");

    const forked = await ctx.chat.forkSession(s1.id);
    assert.ok(forked && forked.id !== s1.id);
    assert.equal(forked.title, "会话 1 (分支)");
    assert.equal(forked.sectionId, "sec-1");

    assert.equal(await ctx.chat.deleteSession(s1.id), true);
    assert.equal(await ctx.chat.getSession(s1.id), null);

    await chatFiber.dispose();
    assert.equal((ctx as { chat?: unknown }).chat, undefined);
    await memFiber.dispose();
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("Client chatClientPlugin 注册 workspace/配置视图/上下文面板与 chatProvider 并在 dispose 时完全卸载", async () => {
  const { WorkbenchClientService } = await import("@lfaa/ui-layout/client");
  const { chatClientPlugin } = await import("../client/index");
  const ctx = new Context();
  new WorkbenchClientService(ctx);

  const fiber = ctx.plugin(chatClientPlugin);
  await fiber;

  const snap = ctx.workbench.getSnapshot();
  assert.ok(snap.views.some((v) => v.id === "workspace"), "应注册 workspace 聊天视图");
  assert.ok(snap.views.some((v) => v.id === "settings:config"), "应注册 settings:config 模型规则页");
  assert.ok(snap.views.some((v) => v.id === "settings:general"), "应注册 settings:general 常规设置页");
  assert.ok(snap.views.some((v) => v.id === "library"), "应注册 library 资料库视图");
  assert.ok(snap.views.some((v) => v.id === "settings:storage"), "应注册 settings:storage 存储设置页");
  assert.ok(snap.views.some((v) => v.id === "settings:git"), "应注册 settings:git Git 设置页");
  assert.ok(snap.views.some((v) => v.id === "settings:codeReview"), "应注册 settings:codeReview 代码审查设置页");
  assert.ok(snap.views.some((v) => v.id === "codeReview"), "应注册 codeReview 代码审查工作台");
  assert.ok(snap.contextPanels.some((p) => p.id === "agent-capabilities"), "应注册右侧 Agent 能力栏");
  assert.ok(snap.chatProvider !== null, "应注册 chatProvider");

  await fiber.dispose();
  const afterDispose = ctx.workbench.getSnapshot();
  assert.equal(afterDispose.views.some((v) => v.id === "workspace"), false);
  assert.equal(afterDispose.views.some((v) => v.id === "settings:config"), false);
  assert.equal(afterDispose.views.some((v) => v.id === "settings:general"), false);
  assert.equal(afterDispose.views.some((v) => v.id === "library"), false);
  assert.equal(afterDispose.views.some((v) => v.id === "settings:storage"), false);
  assert.equal(afterDispose.views.some((v) => v.id === "settings:git"), false);
  assert.equal(afterDispose.views.some((v) => v.id === "settings:codeReview"), false);
  assert.equal(afterDispose.views.some((v) => v.id === "codeReview"), false);
  assert.equal(afterDispose.contextPanels.some((p) => p.id === "agent-capabilities"), false);
  assert.equal(afterDispose.chatProvider, null);
});

test("filterComposerProjects 按项目名称与路径关键字过滤列表", async () => {
  const { filterComposerProjects } = await import("../client/components/ComposerScopeBar");
  const items = [
    { id: "p1", name: "lfaa", createdAt: 1, rootPath: "E:\\lfaa" },
    { id: "p2", name: "wenwen-agent", createdAt: 2, rootPath: "D:\\work\\wenwen-agent" },
    { id: "p3", name: "白底图", createdAt: 3, rootPath: "D:\\assets\\white-bg" },
  ];

  assert.equal(filterComposerProjects(items, "").length, 3);
  assert.deepEqual(filterComposerProjects(items, "LFAA").map((p) => p.id), ["p1"]);
  assert.deepEqual(filterComposerProjects(items, "white-bg").map((p) => p.id), ["p3"]);
  assert.deepEqual(filterComposerProjects(items, "not-found"), []);
});

test("extractTrailingMentionQuery / filterMentionEntries / buildContextualMessage 正确处理 @ 提及与附件上下文", async () => {
  const {
    buildContextualMessage,
    buildMentionEntries,
    extractTrailingMentionQuery,
    filterMentionEntries,
  } = await import("../client/composer-context");
  const { getChatLocale } = await import("../client/locales");
  const locale = getChatLocale();

  assert.deepEqual(extractTrailingMentionQuery("@", 1), { query: "", startIndex: 0 });
  assert.deepEqual(extractTrailingMentionQuery("帮我检查 @目标", 9), { query: "目标", startIndex: 5 });
  assert.equal(extractTrailingMentionQuery("email@example.com", 17), null);

  const entries = buildMentionEntries({
    locale,
    sessions: [
      {
        id: "s-1",
        title: "超广角图片查看",
        projectId: null,
        sectionId: null,
        pinned: false,
        archived: false,
        messageCount: 3,
        createdAt: 1,
        updatedAt: 2,
      },
    ],
    activeSessionId: null,
  });
  assert.ok(filterMentionEntries(entries, locale.mentionPlanTitle).some((e) => e.id === "add-plan"));
  assert.ok(filterMentionEntries(entries, "超广角").some((e) => e.id === "session-s-1"));

  const msg = buildContextualMessage("开始分析", [
    { id: "m1", kind: "mode", modeId: "plan", label: "计划模式" },
    { id: "f1", kind: "file", label: "demo.ts", detail: "1.0 KB", contentPreview: "const x = 1;" },
  ]);
  assert.ok(msg.includes("计划模式"));
  assert.ok(msg.includes("demo.ts"));
  assert.ok(msg.includes("开始分析"));
});

test("mergeDictationTranscript 正确合并已有草稿与语音识别内容", async () => {
  const { mergeDictationTranscript } = await import("../client/components/ComposerRightActions");
  assert.equal(mergeDictationTranscript("", "  你好世界  "), "你好世界");
  assert.equal(mergeDictationTranscript("帮我检查", "项目结构"), "帮我检查 项目结构");
  assert.equal(mergeDictationTranscript("已有内容 ", "   "), "已有内容 ");
});

test("本地 16kHz WAV 编码、错误映射与 /api/chat/transcribe 离线语音识别", async () => {
  const { downsampleTo16kPcm, encodePcm16ToWav, formatSpeechErrorMessage } = await import("../client/local-speech");
  const { getChatLocale } = await import("../client/locales");
  const { assertValidWavBuffer, createChatHttpHandler } = await import("../src/index");
  const locale = getChatLocale();

  const pcm = downsampleTo16kPcm(new Float32Array([0, 0.5, -0.5, 0.25]), 48_000);
  const wav = encodePcm16ToWav(pcm, 16_000);
  assert.ok(wav.length >= 44 + pcm.length * 2);
  assertValidWavBuffer(Buffer.from(wav));
  assert.throws(() => assertValidWavBuffer(Buffer.from("not-a-wav")));

  assert.equal(formatSpeechErrorMessage(locale, "not-allowed"), locale.speechMicPermissionDenied);
  assert.equal(formatSpeechErrorMessage(locale, "NotFoundError"), locale.speechMicNotFound);
  assert.equal(formatSpeechErrorMessage(locale, "aborted"), "");

  // 验证 /api/chat/transcribe 参数校验及 Windows SAPI 离线识别端到端链路。
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-chat-speech-"));
  const ctx = new Context();
  const memFiber = ctx.plugin(memoryPlugin, {
    sessionsDir: path.join(tempRoot, "sessions"),
    memoryFilePath: path.join(tempRoot, "memory.json"),
  });
  await memFiber;
  const chatFiber = ctx.plugin(chatPlugin);
  await chatFiber;

  try {
    const handler = createChatHttpHandler(ctx.chat);
    const callApi = async (body: unknown) => {
      const { EventEmitter } = await import("node:events");
      const req = Object.assign(new EventEmitter(), {
        url: "/api/chat/transcribe",
        method: "POST",
        async *[Symbol.asyncIterator]() {
          yield Buffer.from(JSON.stringify(body), "utf8");
        },
      });
      let status = 200;
      let rawBody = "";
      const res = {
        statusCode: 200,
        setHeader: () => undefined,
        end: (chunk?: string | Buffer) => {
          status = res.statusCode;
          rawBody = chunk ? chunk.toString() : "";
        },
      };
      const handled = await handler(req as never, res as never);
      return { handled, status, json: JSON.parse(rawBody) as { text?: string; engine?: string; error?: string } };
    };

    const emptyRes = await callApi({});
    assert.equal(emptyRes.handled, true);
    assert.equal(emptyRes.status, 400);

    const invalidWavRes = await callApi({ audioBase64: Buffer.from("invalid").toString("base64") });
    assert.equal(invalidWavRes.status, 400);

    if (process.platform === "win32") {
      const { execFile } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const execFileAsync = promisify(execFile);
      const ttsWav = path.join(tempRoot, "sample.wav");
      const psScript = `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.SetOutputToWaveFile($env:LFAA_TTS_WAV); $s.Speak('打开工作区'); $s.SetOutputToNull(); $s.Dispose()`;
      await execFileAsync(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(psScript, "utf16le").toString("base64")],
        { env: { ...process.env, LFAA_TTS_WAV: ttsWav }, windowsHide: true },
      );
      const wavBuf = await fs.readFile(ttsWav);
      const okRes = await callApi({ audioBase64: wavBuf.toString("base64"), lang: "zh-CN" });
      assert.equal(okRes.status, 200);
      assert.equal(okRes.json.engine, "windows-sapi");
      assert.ok((okRes.json.text ?? "").length > 0, "离线语音识别应返回非空文本");
    }
  } finally {
    await chatFiber.dispose();
    await memFiber.dispose();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("Host 常规设置持久化、项目外聊天默认目录动态解析与 /api/chat/general-settings 接口", async () => {
  const {
    GeneralSettingsStore,
    createChatHttpHandler,
    resolveDefaultOutsideProjectFolder,
    resolveDefaultProjectsFolder,
  } = await import("../src/index");
  const { middleTruncatePath } = await import("../client/general-settings-client");

  assert.equal(middleTruncatePath("C:\\Users\\Administrator\\Documents\\LFAA", 30).includes("..."), true);
  const autoOutside = resolveDefaultOutsideProjectFolder();
  assert.ok(autoOutside.endsWith(path.join(".lfaa", "workspace")), "项目外聊天默认使用专用工作目录");
  const autoProjects = await resolveDefaultProjectsFolder();
  assert.ok(autoProjects.endsWith(`${path.sep}lfaa`), "默认新建项目目录应以 lfaa 结尾且不写死用户名");

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-general-cfg-"));
  const legacy = path.join(tempRoot, "legacy-general.json");
  await fs.writeFile(legacy, JSON.stringify({ schemaVersion: 2, outsideProjectFolder: path.dirname(autoOutside) }));
  assert.equal((await new GeneralSettingsStore(legacy).get()).outsideProjectFolder, autoOutside);
  const store = new GeneralSettingsStore(path.join(tempRoot, "general-settings.json"));
  const initial = await store.get();
  assert.equal(initial.integratedShell, "powershell");
  assert.equal(initial.followUpMode, "queue");
  const updated = await store.update({
    sendShortcut: "ctrl_enter",
    followUpMode: "steer",
    homeSuggestions: false,
    reasoningLevels: ["low", "high"],
  });
  assert.equal(updated.sendShortcut, "ctrl_enter");
  assert.equal(updated.followUpMode, "steer");
  assert.equal(updated.homeSuggestions, false);
  assert.deepEqual(updated.reasoningLevels, ["low", "high"]);

  const ctx = new Context();
  const memFiber = ctx.plugin(memoryPlugin, {
    sessionsDir: path.join(tempRoot, "sessions"),
    memoryFilePath: path.join(tempRoot, "memory.json"),
  });
  await memFiber;
  const chatFiber = ctx.plugin(chatPlugin, {
    generalSettingsFilePath: path.join(tempRoot, "http-general.json"),
    repoRoot: path.resolve(process.cwd()),
  });
  await chatFiber;

  try {
    const handler = createChatHttpHandler(ctx.chat);
    const callRoute = async (method: string, url: string, body?: unknown) => {
      const { EventEmitter } = await import("node:events");
      const req = Object.assign(new EventEmitter(), {
        url,
        method,
        async *[Symbol.asyncIterator]() {
          if (body !== undefined) yield Buffer.from(JSON.stringify(body), "utf8");
        },
      });
      let status = 200;
      let rawBody = "";
      const res = {
        statusCode: 200,
        setHeader: () => undefined,
        end: (chunk?: string | Buffer) => {
          status = res.statusCode;
          rawBody = chunk ? chunk.toString() : "";
        },
      };
      await handler(req as never, res as never);
      return { status, json: JSON.parse(rawBody) as Record<string, unknown> };
    };

    const getRes = await callRoute("GET", "/api/chat/general-settings");
    assert.equal(getRes.status, 200);
    assert.equal((getRes.json.settings as { sendShortcut: string }).sendShortcut, "enter");

    const patchRes = await callRoute("PATCH", "/api/chat/general-settings", {
      sendShortcut: "ctrl_enter",
      confettiEffect: false,
    });
    assert.equal(patchRes.status, 200);
    assert.equal((patchRes.json.settings as { confettiEffect: boolean }).confettiEffect, false);

    const licRes = await callRoute("GET", "/api/chat/licenses");
    assert.equal(licRes.status, 200);
    assert.ok(Array.isArray(licRes.json.packages) && licRes.json.packages.length > 0);
  } finally {
    await chatFiber.dispose();
    await memFiber.dispose();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("Host 内置 Git 服务、编码设置与代码审查引擎完整闭环", async () => {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);
  const { CodingSettingsStore } = await import("../src/coding-settings");
  const { createCodingHttpHandler } = await import("../src/git-http-handler");

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-git-review-"));
  const repoDir = path.join(tempRoot, "demo-repo");
  await fs.mkdir(repoDir, { recursive: true });

  await execFileAsync("git", ["init"], { cwd: repoDir, windowsHide: true });
  await execFileAsync("git", ["config", "user.name", "LFAA Test"], { cwd: repoDir, windowsHide: true });
  await execFileAsync("git", ["config", "user.email", "lfaa@example.com"], { cwd: repoDir, windowsHide: true });
  await fs.writeFile(path.join(repoDir, "README.md"), "# Demo Repo\n", "utf8");
  await execFileAsync("git", ["add", "README.md"], { cwd: repoDir, windowsHide: true });
  await execFileAsync("git", ["commit", "-m", "chore: initial commit"], { cwd: repoDir, windowsHide: true });

  const codingStore = new CodingSettingsStore(path.join(tempRoot, "coding-settings.json"));
  const defaultCfg = await codingStore.get();
  assert.equal(defaultCfg.git.branchPrefix, "lfaa/");
  assert.equal(defaultCfg.git.prMergeMethod, "merge");
  assert.equal(defaultCfg.git.createDraftPr, true);

  const ctx = new Context();
  const memFiber = ctx.plugin(memoryPlugin, {
    sessionsDir: path.join(tempRoot, "sessions"),
    memoryFilePath: path.join(tempRoot, "memory.json"),
  });
  await memFiber;
  const chatFiber = ctx.plugin(chatPlugin, {
    generalSettingsFilePath: path.join(tempRoot, "general.json"),
    codingSettingsFilePath: path.join(tempRoot, "coding-settings.json"),
    reviewHistoryFilePath: path.join(tempRoot, "reviews.json"),
    repoRoot: repoDir,
  });
  await chatFiber;

  try {
    const handler = createCodingHttpHandler(ctx.chat);
    const callRoute = async (method: string, url: string, body?: unknown) => {
      const { EventEmitter } = await import("node:events");
      const req = Object.assign(new EventEmitter(), {
        url,
        method,
        async *[Symbol.asyncIterator]() {
          if (body !== undefined) yield Buffer.from(JSON.stringify(body), "utf8");
        },
      });
      let status = 200;
      let rawBody = "";
      const res = {
        statusCode: 200,
        setHeader: () => undefined,
        end: (chunk?: string | Buffer) => {
          status = res.statusCode;
          rawBody = chunk ? chunk.toString() : "";
        },
      };
      const handled = await handler(req as never, res as never);
      assert.equal(handled, true);
      return { status, json: JSON.parse(rawBody) as Record<string, unknown> };
    };

    const patched = await callRoute("PATCH", "/api/chat/coding-settings", {
      git: {
        branchPrefix: "feat/",
        prMergeMethod: "squash",
        alwaysForcePush: true,
        reviewDisplayMode: "separate",
        commitInstructions: "使用中文简述变更原因",
      },
      codeReview: {
        thoroughReview: true,
        repoOverrides: { "demo-repo": "enabled" },
      },
    });
    assert.equal(patched.status, 200);
    assert.equal((patched.json.settings as { git: { prMergeMethod: string } }).git.prMergeMethod, "squash");

    // 按配置前缀创建分支
    const branchRes = await callRoute("POST", "/api/git/branch", { name: "git-ui", create: true });
    assert.equal(branchRes.status, 200);
    assert.equal((branchRes.json.status as { branch: string }).branch, "feat/git-ui");

    // 写入包含典型审查告警的代码变更并暂存
    await fs.writeFile(
      path.join(repoDir, "sample.ts"),
      "// @ts-ignore\nexport function demo() {\n  console.log('debug');\n}\n",
      "utf8",
    );
    const stageRes = await callRoute("POST", "/api/git/stage", { files: ["sample.ts"] });
    assert.equal(stageRes.status, 200);
    assert.equal((stageRes.json.status as { files: Array<{ staged: boolean }> }).files[0]?.staged, true);

    // 运行代码审查并验证检出告警且写入历史
    const reviewRes = await callRoute("POST", "/api/code-review/run", { scope: "staged" });
    assert.equal(reviewRes.status, 200);
    const report = reviewRes.json.report as { filesReviewed: number; findings: Array<{ title: string }> };
    assert.equal(report.filesReviewed, 1);
    assert.ok(report.findings.some((f) => f.title.includes("TypeScript")));

    // 提交变更并生成 PR 草案
    const draftRes = await callRoute("POST", "/api/git/commit-draft", {});
    assert.ok(((draftRes.json.draft as { message: string }).message).includes("使用中文简述变更原因"));
    const commitRes = await callRoute("POST", "/api/git/commit", { message: "feat: add sample" });
    assert.equal(commitRes.status, 200);
    assert.ok(Boolean(commitRes.json.commitHash));

    const prRes = await callRoute("POST", "/api/git/pr-draft", {});
    assert.ok(((prRes.json.draft as { pushCommand: string }).pushCommand).includes("--force-with-lease"));
  } finally {
    await chatFiber.dispose();
    await memFiber.dispose();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("MODEL_PROVIDER_CATALOG 与 findProfileForProvider 正确匹配提供商卡片", async () => {
  const { findProfileForProvider, MODEL_PROVIDER_CATALOG } = await import("../client/provider-catalog");
  const deepseekCard = MODEL_PROVIDER_CATALOG.find((p) => p.id === "deepseek");
  const qwenCard = MODEL_PROVIDER_CATALOG.find((p) => p.id === "qwen");
  assert.ok(deepseekCard);
  assert.ok(qwenCard);

  const matchedDs = findProfileForProvider(
    [
      {
        id: "ds-1",
        name: "DeepSeek Chat",
        kind: "deepseek",
        baseUrl: "https://api.deepseek.com/v1",
        model: "deepseek-chat",
        hasApiKey: true,
        apiKeyMasked: "sk-a****1234",
        configured: true,
        availableModels: [],
        updatedAt: 1,
      },
      {
        id: "qwen-custom",
        providerId: "qwen",
        name: "通义千问",
        kind: "openai-compatible",
        baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        model: "qwen-max",
        hasApiKey: true,
        apiKeyMasked: "sk-q****5678",
        configured: true,
        availableModels: [],
        updatedAt: 2,
      },
    ],
    qwenCard,
  );
  assert.equal(matchedDs?.id, "qwen-custom");
});
