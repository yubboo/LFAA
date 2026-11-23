// 验证 @lfaa/tools 路径沙箱越界拦截、文件读写/搜索工具执行与 Cordis 插件注册注销。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { hasToolPolicy, isToolAllowed, resolveSafeWorkspacePath, toolsPlugin } from "../src/index";
import { appendCommandAudit, findProtectedPathInCommand } from "@lfaa/guard";

// 命令审计写入临时文件，避免测试污染用户目录。
process.env.LFAA_COMMAND_AUDIT_LOG = path.join(os.tmpdir(), `lfaa-tools-audit-${process.pid}.jsonl`);

test("resolveSafeWorkspacePath 严格拦截工作区外目录与路径穿越", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-tools-sandbox-"));
  const workspaceDir = path.join(tempRoot, "project-a");
  const siblingSecret = path.join(tempRoot, "project-a-secret");
  await fs.mkdir(workspaceDir, { recursive: true });
  await fs.mkdir(siblingSecret, { recursive: true });

  try {
    // 沙箱按真实路径返回；Windows CI 临时目录可能是 RUNNER~1 短路径，期望值先取 realpath。
    const realWorkspaceDir = await fs.realpath(workspaceDir);
    const inside = await resolveSafeWorkspacePath("src/app.ts", [workspaceDir]);
    assert.ok(inside.path.startsWith(realWorkspaceDir));

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
    assert.ok(unrestricted.path.startsWith(await fs.realpath(siblingSecret)));
    const appHome = path.join(os.homedir(), ".lfaa");
    for (const privateFile of ["llm-config.json", "credentials/test.txt", "sessions/test.json"]) {
      await assert.rejects(
        () => resolveSafeWorkspacePath(path.join(appHome, privateFile), [appHome], { allowOutsideWorkspace: true }),
        /应用私有文件/u,
      );
    }
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
    assert.equal(writeRes.fileChange?.operation, "created");
    assert.equal(writeRes.fileChange?.after, "LFAA Agent Sandbox Check\nLine 2");

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

    const editRes = await ctx.tools.executeTool(
      "edit_file",
      { path: "notes/hello.txt", target: "Line 2", replacement: "New line" },
      execCtx,
    );
    assert.deepEqual(editRes.fileChange, {
      path: "notes/hello.txt", operation: "edited", firstLine: 2,
      resolvedPath: path.join(await fs.realpath(tempRoot), "notes", "hello.txt"),
      before: "Line 2", after: "New line", truncated: false,
    });

    const unregister = ctx.tools.registerTool({
      name: "ping_tool",
      title: "Ping",
      description: "测试工具",
      moduleName: "@lfaa/test-ping",
      permissionLevel: "read",
      parameters: { type: "object", properties: {} },
      async execute() {
        return { ok: true, output: "pong", summary: "pong" };
      },
    });
    assert.equal((await ctx.tools.executeTool("ping_tool", {}, execCtx)).output, "pong");
    const minimal = ctx.tools.scope(new Set(["@lfaa/tools"]), true);
    const standard = ctx.tools.scope(new Set(["@lfaa/tools", "@lfaa/test-ping"]));
    assert.ok(minimal.getLlmToolSchemas().some(({ name }) => name === "read_file"));
    assert.ok(!minimal.getLlmToolSchemas().some(({ name }) => name === "ping_tool" || name === "write_file"));
    assert.equal((await minimal.executeTool("ping_tool", {}, execCtx)).ok, false);
    assert.equal((await minimal.executeTool("write_file", { path: "blocked.txt", content: "blocked" }, execCtx)).ok, false);
    await assert.rejects(fs.access(path.join(tempRoot, "blocked.txt")), { code: "ENOENT" });
    assert.equal((await standard.executeTool("ping_tool", {}, execCtx)).output, "pong");
    unregister();
    assert.equal((await standard.executeTool("ping_tool", {}, execCtx)).ok, false);
    assert.equal(ctx.tools.getTool("ping_tool"), undefined);

    await fiber.dispose();
    assert.equal((ctx as { tools?: unknown }).tools, undefined);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("run_command 超时后交给后台兜底并返回任务 ID", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-tools-timeout-"));
  const ctx = new Context();
  const commands: string[] = [];
  await ctx.plugin(toolsPlugin, {
    executeCommand: async () => ({ ok: false, output: "构建日志尾部", timedOut: true }),
    onCommandTimeout: async (input) => {
      commands.push(`${input.sessionId}:${input.command}`);
      return { taskId: "job-test", title: "构建" };
    },
  });

  try {
    const result = await ctx.tools.executeTool("run_command", { command: "pnpm build" }, {
      workspaceRoots: [tempRoot],
      sessionId: "s-1",
      runId: "r-1",
      signal: new AbortController().signal,
    });
    assert.equal(result.ok, false);
    assert.match(result.output, /已自动转入后台任务/u);
    assert.match(result.output, /job-test/u);
    assert.deepEqual(result.metadata, { backgroundTaskId: "job-test" });
    assert.deepEqual(commands, ["s-1:pnpm build"]);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("glob/grep 覆盖按名检索与正则过滤，edit_file 拒绝多处命中", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-tools-search-"));
  const ctx = new Context();
  await ctx.plugin(toolsPlugin);

  try {
    await fs.mkdir(path.join(tempRoot, "src", "nested"), { recursive: true });
    await fs.writeFile(
      path.join(tempRoot, "src", "app.ts"),
      "export const value = 1;\nexport const value = 2;\n",
      "utf8",
    );
    await fs.writeFile(
      path.join(tempRoot, "src", "nested", "util.ts"),
      "export function helper() { return 42; }\n",
      "utf8",
    );
    await fs.writeFile(path.join(tempRoot, "README.md"), "# Demo\nvalue docs\n", "utf8");

    const execCtx = {
      workspaceRoots: [tempRoot],
      sessionId: "s-1",
      runId: "r-1",
      signal: new AbortController().signal,
    };

    const globRes = await ctx.tools.executeTool("glob", { pattern: "src/**/*.ts" }, execCtx);
    assert.equal(globRes.ok, true);
    assert.ok(globRes.output.includes("src/app.ts"));
    assert.ok(globRes.output.includes("src/nested/util.ts"));
    assert.equal(globRes.output.includes("README.md"), false);

    const grepRes = await ctx.tools.executeTool(
      "grep",
      { query: "export (?:const|function)", include: "*.ts" },
      execCtx,
    );
    assert.equal(grepRes.ok, true);
    assert.equal(grepRes.output.split("\n").length, 3);
    assert.match(grepRes.output, /src\/app\.ts:1:/u);

    const invalidRegex = await ctx.tools.executeTool("grep", { query: "(unclosed" }, execCtx);
    assert.equal(invalidRegex.ok, false);
    assert.match(invalidRegex.output, /正则表达式无效/u);

    const ambiguous = await ctx.tools.executeTool(
      "edit_file",
      { path: "src/app.ts", target: "export const value", replacement: "export const total" },
      execCtx,
    );
    assert.equal(ambiguous.ok, false);
    assert.match(ambiguous.output, /命中 2 处/u);
    assert.match(ambiguous.output, /第 1 行、第 2 行/u);

    const replaceAll = await ctx.tools.executeTool(
      "edit_file",
      { path: "src/app.ts", target: "export const value", replacement: "export const total", replaceAll: true },
      execCtx,
    );
    assert.equal(replaceAll.ok, true);
    const content = await fs.readFile(path.join(tempRoot, "src", "app.ts"), "utf8");
    assert.equal((content.match(/total/gu) ?? []).length, 2);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("命令引用应用私有文件时被拦截，并能识别常见写法", () => {
  assert.equal(findProtectedPathInCommand("type %USERPROFILE%\\.lfaa\\llm-config.json")?.includes("模型配置"), true);
  assert.equal(findProtectedPathInCommand("cat ~/.lfaa/smart-approvals.json")?.includes("审批"), true);
  assert.equal(findProtectedPathInCommand("ls ~/.lfaa/credentials")?.includes("凭据"), true);
  assert.equal(findProtectedPathInCommand("Get-Content $env:USERPROFILE\\.lfaa\\sessions\\a.json")?.includes("会话"), true);
  assert.equal(findProtectedPathInCommand("pnpm build"), undefined);
});

test("run_command 拦截私有文件访问并写入审计日志", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-tools-guard-"));
  const auditPath = path.join(tempRoot, "commands.jsonl");
  const previousAudit = process.env.LFAA_COMMAND_AUDIT_LOG;
  process.env.LFAA_COMMAND_AUDIT_LOG = auditPath;
  const ctx = new Context();
  let executed = 0;
  await ctx.plugin(toolsPlugin, {
    executeCommand: async () => {
      executed += 1;
      return { ok: true, output: "ok" };
    },
  });

  try {
    const execCtx = {
      workspaceRoots: [tempRoot],
      sessionId: "s-guard",
      runId: "r-guard",
      signal: new AbortController().signal,
    };
    const blocked = await ctx.tools.executeTool(
      "run_command",
      { command: "type %USERPROFILE%\\.lfaa\\llm-config.json" },
      execCtx,
    );
    assert.equal(blocked.ok, false);
    assert.match(blocked.output, /已拦截/u);
    assert.equal(executed, 0);

    const allowed = await ctx.tools.executeTool("run_command", { command: "echo hello" }, execCtx);
    assert.equal(allowed.ok, true);
    assert.equal(executed, 1);

    const audit = await fs.readFile(auditPath, "utf8");
    assert.match(audit, /llm-config\.json/u);
    assert.match(audit, /echo hello/u);
    const lines = audit.trim().split("\n").map((line) => JSON.parse(line) as { sessionId: string; ok: boolean });
    assert.equal(lines.length, 2);
    assert.equal(lines[0]?.sessionId, "s-guard");
    assert.equal(lines[0]?.ok, false);
    assert.equal(lines[1]?.ok, true);
  } finally {
    if (previousAudit === undefined) delete process.env.LFAA_COMMAND_AUDIT_LOG;
    else process.env.LFAA_COMMAND_AUDIT_LOG = previousAudit;
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("命令审计超过大小上限时轮转并保留最近记录", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-audit-rotate-"));
  const auditPath = path.join(tempRoot, "commands.jsonl");
  const previousLog = process.env.LFAA_COMMAND_AUDIT_LOG;
  const previousMax = process.env.LFAA_COMMAND_AUDIT_MAX_BYTES;
  process.env.LFAA_COMMAND_AUDIT_LOG = auditPath;
  process.env.LFAA_COMMAND_AUDIT_MAX_BYTES = "128";
  try {
    await fs.writeFile(auditPath, "x".repeat(200), "utf8");
    await appendCommandAudit({
      at: Date.now(), sessionId: "s-rotate", runId: "r-rotate",
      cwd: tempRoot, command: "echo rotated", ok: true,
    });
    const rotated = await fs.readFile(`${auditPath}.1`, "utf8");
    assert.equal(rotated.length, 200);
    const current = await fs.readFile(auditPath, "utf8");
    assert.match(current, /echo rotated/u);
  } finally {
    if (previousLog === undefined) delete process.env.LFAA_COMMAND_AUDIT_LOG;
    else process.env.LFAA_COMMAND_AUDIT_LOG = previousLog;
    if (previousMax === undefined) delete process.env.LFAA_COMMAND_AUDIT_MAX_BYTES;
    else process.env.LFAA_COMMAND_AUDIT_MAX_BYTES = previousMax;
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("工具策略判定：deny 优先、allow 白名单、空策略放行一切", () => {
  assert.equal(isToolAllowed(undefined, "write_file"), true);
  assert.equal(isToolAllowed({}, "write_file"), true);
  assert.equal(isToolAllowed({ deny: ["write_file"] }, "write_file"), false);
  assert.equal(isToolAllowed({ deny: ["write_file"] }, "read_file"), true);
  // allow 非空时只放行名单内，名单外即使没 deny 也不放行。
  assert.equal(isToolAllowed({ allow: ["read_file"] }, "read_file"), true);
  assert.equal(isToolAllowed({ allow: ["read_file"] }, "write_file"), false);
  // 同时出现时 deny 优先，避免「白名单里顺手写了一个该禁的工具」这种误配放行。
  assert.equal(isToolAllowed({ allow: ["write_file"], deny: ["write_file"] }, "write_file"), false);
  assert.equal(hasToolPolicy(undefined), false);
  assert.equal(hasToolPolicy({ allow: [], deny: [] }), false);
  assert.equal(hasToolPolicy({ deny: ["edit_file"] }), true);
});