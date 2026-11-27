// 验证 @lfaa/chat Host/Client 双端 Cordis 生命周期、最近会话注入与项目聊天计数统计。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { memoryPlugin } from "@lfaa/memory";
import { chatPlugin } from "@lfaa/chat";

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
  assert.ok(snap.contextPanels.some((p) => p.id === "agent-capabilities"), "应注册右侧 Agent 能力栏");
  assert.ok(snap.chatProvider !== null, "应注册 chatProvider");

  await fiber.dispose();
  const afterDispose = ctx.workbench.getSnapshot();
  assert.equal(afterDispose.views.some((v) => v.id === "workspace"), false);
  assert.equal(afterDispose.views.some((v) => v.id === "settings:config"), false);
  assert.equal(afterDispose.views.some((v) => v.id === "settings:general"), false);
  assert.equal(afterDispose.contextPanels.some((p) => p.id === "agent-capabilities"), false);
  assert.equal(afterDispose.chatProvider, null);
});

test("filterComposerProjects 按项目名称与路径关键字过滤列表", async () => {
  const { filterComposerProjects } = await import("../client/composer/ComposerScopeBar");
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
  } = await import("../client/composer/composer-context");
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
  const { mergeDictationTranscript } = await import("../client/composer/ComposerRightActions");
  assert.equal(mergeDictationTranscript("", "  你好世界  "), "你好世界");
  assert.equal(mergeDictationTranscript("帮我检查", "项目结构"), "帮我检查 项目结构");
  assert.equal(mergeDictationTranscript("已有内容 ", "   "), "已有内容 ");
});

test("本地 16kHz WAV 编码、错误映射与 /api/chat/transcribe 离线语音识别", async () => {
  const { downsampleTo16kPcm, encodePcm16ToWav, formatSpeechErrorMessage } = await import("../client/composer/local-speech");
  const { getChatLocale } = await import("../client/locales");
  const { assertValidWavBuffer, createChatHttpHandler } = await import("@lfaa/chat");
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

    // 端点参数校验与引擎标识在所有 Windows 机器上都应成立；非空转写依赖本机装了对应语言的离线识别包（CI 机器通常只有英文包）。
    const silentRes = await callApi({ audioBase64: Buffer.from(wav).toString("base64"), lang: "zh-CN" });
    assert.equal(silentRes.status, 200);
    assert.equal(silentRes.json.engine, "windows-sapi");

    if (process.platform === "win32") {
      const { execFile } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const execFileAsync = promisify(execFile);
      const runPowerShell = async (script: string, env: Record<string, string> = {}): Promise<string> => {
        const { stdout } = await execFileAsync(
          "powershell.exe",
          ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")],
          { env: { ...process.env, ...env }, windowsHide: true },
        );
        return stdout;
      };
      const cultures = (await runPowerShell(
        "Add-Type -AssemblyName System.Speech; [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers() | ForEach-Object { $_.Culture.Name }",
      )).split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
      if (cultures.some((culture) => culture.toLowerCase().startsWith("zh"))) {
        const ttsWav = path.join(tempRoot, "sample.wav");
        const psScript = `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.SetOutputToWaveFile($env:LFAA_TTS_WAV); $s.Speak('打开工作区'); $s.SetOutputToNull(); $s.Dispose()`;
        await runPowerShell(psScript, { LFAA_TTS_WAV: ttsWav });
        const wavBuf = await fs.readFile(ttsWav);
        const okRes = await callApi({ audioBase64: wavBuf.toString("base64"), lang: "zh-CN" });
        assert.equal(okRes.status, 200);
        assert.equal(okRes.json.engine, "windows-sapi");
        assert.ok((okRes.json.text ?? "").length > 0, "离线语音识别应返回非空文本");
      }
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
  } = await import("@lfaa/chat");
  const { middleTruncatePath } = await import("../client/settings/general-settings-client");

  assert.equal(middleTruncatePath("C:\\Users\\Administrator\\Documents\\LFAA", 30).includes("..."), true);
  const autoOutside = await resolveDefaultOutsideProjectFolder();
  assert.ok(autoOutside.endsWith(path.join("lfaa", "default-workspace")), "项目外聊天默认使用文档下的 default-workspace");
  const autoProjects = await resolveDefaultProjectsFolder();
  assert.ok(autoProjects.endsWith(`${path.sep}lfaa`), "默认新建项目目录应以 lfaa 结尾且不写死用户名");

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-general-cfg-"));
  const legacy = path.join(tempRoot, "legacy-general.json");
  // 旧默认值（~/.lfaa/workspace）在 v3 自动迁移到文档下的默认工作区。
  await fs.writeFile(legacy, JSON.stringify({ schemaVersion: 2, outsideProjectFolder: path.join(os.homedir(), ".lfaa", "workspace") }));
  const migrated = await new GeneralSettingsStore(legacy).get();
  assert.equal(migrated.outsideProjectFolder, autoOutside);
  assert.equal(migrated.schemaVersion, 3);
  // 用户显式选过的目录不能被迁移覆盖。
  const customOutside = path.join(tempRoot, "custom-workspace");
  await fs.writeFile(legacy, JSON.stringify({ schemaVersion: 2, outsideProjectFolder: customOutside }));
  assert.equal((await new GeneralSettingsStore(legacy).get()).outsideProjectFolder, customOutside);
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
      repeatToolThresholds: [5, 3, 3, 1, 8],
    });
    assert.equal(patchRes.status, 200);
    assert.equal((patchRes.json.settings as { confettiEffect: boolean }).confettiEffect, false);
    assert.deepEqual(
      (patchRes.json.settings as { repeatToolThresholds: number[] }).repeatToolThresholds,
      [3, 5, 8],
    );

    const licRes = await callRoute("GET", "/api/chat/licenses");
    assert.equal(licRes.status, 200);
    assert.ok(Array.isArray(licRes.json.packages) && licRes.json.packages.length > 0);
  } finally {
    await chatFiber.dispose();
    await memFiber.dispose();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});
