// 验证 @lfaa/tools 路径沙箱越界拦截、文件读写/搜索工具执行与 Cordis 插件注册注销。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { resolveSafeWorkspacePath, toolsPlugin } from "../src/index";

test("resolveSafeWorkspacePath 严格拦截工作区外目录与路径穿越", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-tools-sandbox-"));
  const workspaceDir = path.join(tempRoot, "project-a");
  const siblingSecret = path.join(tempRoot, "project-a-secret");
  await fs.mkdir(workspaceDir, { recursive: true });
  await fs.mkdir(siblingSecret, { recursive: true });

  try {
    const inside = await resolveSafeWorkspacePath("src/app.ts", [workspaceDir]);
    assert.ok(inside.path.startsWith(workspaceDir));

    await assert.rejects(
      () => resolveSafeWorkspacePath("../project-a-secret/key.txt", [workspaceDir]),
      /路径越界拦截/u,
    );
    await assert.rejects(
      () => resolveSafeWorkspacePath("README.md", []),
      /未绑定授权项目目录/u,
    );

    const unrestricted = await resolveSafeWorkspacePath("../project-a-secret/key.txt", [workspaceDir], {
      allowOutsideWorkspace: true,
    });
    assert.ok(unrestricted.path.startsWith(siblingSecret));
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("Host toolsPlugin 支持内置文件读写检索及自定义工具热插拔", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-tools-exec-"));
  const ctx = new Context();
  const fiber = ctx.plugin(toolsPlugin);
  await fiber;

  try {
    const execCtx = {
      workspaceRoots: [tempRoot],
      sessionId: "s-1",
      runId: "r-1",
      signal: new AbortController().signal,
    };

    const writeRes = await ctx.tools.executeTool(
      "write_file",
      { path: "notes/hello.txt", content: "LFAA Agent Sandbox Check\nLine 2" },
      execCtx,
    );
    assert.equal(writeRes.ok, true);

    const readRes = await ctx.tools.executeTool(
      "read_file",
      { path: "notes/hello.txt", startLine: 1, endLine: 2 },
      execCtx,
    );
    assert.equal(readRes.ok, true);
    assert.ok(readRes.output.includes("LFAA Agent Sandbox Check"));

    const searchRes = await ctx.tools.executeTool(
      "search_files",
      { query: "Sandbox" },
      execCtx,
    );
    assert.equal(searchRes.ok, true);
    assert.ok(searchRes.output.includes("hello.txt:1"));

    const unregister = ctx.tools.registerTool({
      name: "ping_tool",
      title: "Ping",
      description: "测试工具",
      permissionLevel: "read",
      parameters: { type: "object", properties: {} },
      async execute() {
        return { ok: true, output: "pong", summary: "pong" };
      },
    });
    assert.equal((await ctx.tools.executeTool("ping_tool", {}, execCtx)).output, "pong");
    unregister();
    assert.equal(ctx.tools.getTool("ping_tool"), undefined);

    await fiber.dispose();
    assert.equal((ctx as { tools?: unknown }).tools, undefined);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});
