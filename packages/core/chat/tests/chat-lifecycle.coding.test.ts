// 验证 @lfaa/chat 的内置 Git 服务、代码审查引擎与模型提供商卡片匹配。
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


test("Host 内置 Git 服务、编码设置与代码审查引擎完整闭环", async () => {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);
  const { CodingSettingsStore } = await import("@lfaa/settings");
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
