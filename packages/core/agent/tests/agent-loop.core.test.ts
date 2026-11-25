// 验证 @lfaa/agent 的核心闭环、澄清、审批切换与权限模式。
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { llmPlugin, type LlmGenerateInput } from "@lfaa/llm";
import { memoryPlugin } from "@lfaa/memory";
import { rulesPlugin } from "@lfaa/rules";
import { toolsPlugin } from "@lfaa/tools";
import { agentPlugin, evaluateToolApproval, SMART_APPROVAL_THRESHOLD, type AgentRunEvent } from "../src/index";

// 命令审计写入临时文件，避免测试污染用户目录。
process.env.LFAA_COMMAND_AUDIT_LOG = path.join(os.tmpdir(), `lfaa-agent-audit-${process.pid}.jsonl`);


test("需求澄清随消息保存并阻止同一批次的文件修改", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-clarification-"));
  let callCount = 0;
  const ctx = new Context();
  await ctx.plugin(llmPlugin, {
    storeFilePath: path.join(dir, "llm.json"),
    adapter: async (profile, input) => {
      callCount += 1;
      if (callCount > 1) {
        return {
          model: profile.model, provider: profile.kind, content: "好的，按个人介绍处理。", finishReason: "stop",
          usage: { promptTokens: 30, completionTokens: 6, cachedPromptTokens: 0 }, toolCalls: [],
        };
      }
      assert.ok(input.tools?.some((tool) => tool.name === "ask_user"));
      return {
        model: profile.model, provider: profile.kind, content: "", finishReason: "tool_calls",
        usage: { promptTokens: 100, completionTokens: 12, cachedPromptTokens: 0 },
        toolCalls: [
          { id: "write", name: "write_file", argumentsJson: '{"path":"unwanted.txt","content":"should not write"}' },
          { id: "question", name: "ask_user", argumentsJson: '{"question":"页面用于什么？","options":["个人介绍","产品展示"]}' },
        ],
      };
    },
  });
  await ctx.plugin(rulesPlugin, { storeFilePath: path.join(dir, "rules.json") });
  await ctx.plugin(memoryPlugin, { sessionsDir: path.join(dir, "sessions"), memoryFilePath: path.join(dir, "memory.json") });
  await ctx.plugin(toolsPlugin);
  await ctx.plugin(agentPlugin);
  try {
    const session = await ctx.memory.createSession({ projectId: "clarification-test" });
    const started = await ctx.agent.startRun({
      sessionId: session.id, userMessage: "给我做个简单网站", workspaceRoots: [dir], permissionMode: "full",
    });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("等待澄清消息超时")), 5000);
      const off = ctx.agent.subscribeRun(started.runId, (event) => {
        if (event.type === "run_finished") { clearTimeout(timer); off(); resolve(); }
      });
    });
    const saved = (await ctx.memory.getSession(session.id))?.messages.at(-1);
    assert.deepEqual(saved?.clarification, { question: "页面用于什么？", options: ["个人介绍", "产品展示"] });
    assert.equal(saved?.metrics?.contextPromptTokens, 100);
    assert.deepEqual(saved?.metrics?.cacheMeasurement, { promptTokens: 100, cachedTokens: 0 });
    // 澄清问题同时进入会话摘要与待处理列表，侧栏可据此显示「待回答」。
    assert.deepEqual((await ctx.memory.getSession(session.id))?.pendingQuestion, {
      messageId: saved?.id,
      question: "页面用于什么？",
      options: ["个人介绍", "产品展示"],
    });
    assert.deepEqual(await ctx.agent.listAttention(), [{
      sessionId: session.id,
      kind: "question",
      question: "页面用于什么？",
      options: ["个人介绍", "产品展示"],
      messageId: saved?.id,
    }]);
    // 用户回答（新消息）后待回答状态清除。
    const followUp = await ctx.agent.startRun({
      sessionId: session.id, userMessage: "个人介绍", workspaceRoots: [dir], permissionMode: "full",
    });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("等待回答后的运行超时")), 5000);
      const off = ctx.agent.subscribeRun(followUp.runId, (event) => {
        if (event.type === "run_finished") { clearTimeout(timer); off(); resolve(); }
      });
    });
    assert.equal((await ctx.memory.getSession(session.id))?.pendingQuestion, undefined);
    assert.deepEqual(await ctx.agent.listAttention(), []);
    await assert.rejects(fs.access(path.join(dir, "unwanted.txt")), { code: "ENOENT" });
    await assert.rejects(fs.access(path.join(dir, ".git")), { code: "ENOENT" });
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("AgentService 完成 Think -> Act(读写工具+人工审批) -> Check 闭环并持久化轨迹与记忆", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-agent-loop-"));
  const workspaceDir = path.join(tempRoot, "demo-project");
  await fs.mkdir(workspaceDir, { recursive: true });
  execFileSync("git", ["init", "--quiet"], { cwd: tempRoot });
  await fs.writeFile(path.join(workspaceDir, "AGENTS.md"), "项目规则：写入文件前须明确检查内容。", "utf8");
  await fs.writeFile(path.join(workspaceDir, "README.md"), "# Demo Project\nVersion 1", "utf8");

  let callTurn = 0;
  let capturedSystemPrompt = "";

  const ctx = new Context();
  await ctx.plugin(llmPlugin, {
    storeFilePath: path.join(tempRoot, "llm.json"),
    adapter: async (profile, input: LlmGenerateInput) => {
      callTurn += 1;
      if (callTurn === 1) {
        capturedSystemPrompt = input.messages[0]?.content ?? "";
        input.onDelta?.({ type: "reasoning", text: "核对任务阶段。" });
        input.onDelta?.({ type: "text", text: "先检查 README 📝。" });
        input.onDelta?.({ type: "tool_call", toolCallId: "tc-read", toolName: "read_file" });
        input.onDelta?.({ type: "tool_call", toolCallId: "tc-read", toolName: "read_file" });
        input.onDelta?.({ type: "text", text: "确认项目版本。" });
        return {
          model: profile.model,
          provider: profile.kind,
          content: "先检查 README 📝。确认项目版本。",
          reasoningContent: "先读取项目 README 了解当前版本。",
          toolCalls: [
            { id: "tc-read", name: "read_file", argumentsJson: JSON.stringify({ path: "README.md" }) },
          ],
          finishReason: "tool_calls",
        };
      }
      if (callTurn === 2) {
        const lastToolMsg = input.messages.at(-1)?.content ?? "";
        assert.ok(lastToolMsg.includes("Version 1"), "应将第一步读取结果注入第二轮思考上下文");
        input.onDelta?.({ type: "tool_call", toolCallId: "tc-write", toolName: "write_file" });
        input.onActivity?.({ toolCallId: "tc-write", argumentChars: 42, argumentPrefix: '{"path":"REPORT.md","content":"partial' });
        return {
          model: profile.model,
          provider: profile.kind,
          content: "版本已确认，接下来生成报告。",
          reasoningContent: "再写入状态报告文件。",
          toolCalls: [
            {
              id: "tc-write",
              name: "write_file",
              argumentsJson: JSON.stringify({ path: "REPORT.md", content: "# Status\nOK v1" }),
            },
          ],
          finishReason: "tool_calls",
        };
      }
      if (callTurn === 3) {
        input.onDelta?.({ type: "text", text: "报告已写入，检查命令输出。" });
        return {
          model: profile.model,
          provider: profile.kind,
          content: "报告已写入，检查命令输出。",
          toolCalls: [
            { id: "tc-command", name: "run_command", argumentsJson: JSON.stringify({ command: "echo timeline-check && exit 7" }) },
          ],
          finishReason: "tool_calls",
        };
      }
      input.onDelta?.({ type: "text", text: "已读取 README 并创建 REPORT.md。" });
      return {
        model: profile.model,
        provider: profile.kind,
        content: "已读取 README 并创建 REPORT.md。",
        toolCalls: [],
        finishReason: "stop",
      };
    },
  });
  await ctx.plugin(rulesPlugin, { storeFilePath: path.join(tempRoot, "rules.json") });
  await ctx.plugin(memoryPlugin, {
    sessionsDir: path.join(tempRoot, "sessions"),
    memoryFilePath: path.join(tempRoot, "memory.json"),
  });
  await ctx.plugin(toolsPlugin);
  await ctx.plugin(agentPlugin);

  try {
    await ctx.rules.saveUserRules("用户规则：保持输出简明。");
    await ctx.memory.addMemory({
      scope: "project",
      projectId: "proj-demo",
      content: "REPORT.md 用于存放项目检查摘要。",
    });

    const session = await ctx.memory.createSession({ projectId: "proj-demo" });
    const events: AgentRunEvent[] = [];

    const started = await ctx.agent.startRun({
      sessionId: session.id,
      userMessage: "检查 README 并生成 REPORT.md",
      projectId: "ignored-external-project",
      workspaceRoots: [tempRoot],
    }, async (projectId) => {
      assert.equal(projectId, "proj-demo");
      return [workspaceDir];
    });
    await assert.rejects(() => ctx.agent.withIdleSession(session.id, async () => undefined), /仍有任务/u);

    await new Promise<void>((resolveDone, rejectDone) => {
      const timer = setTimeout(() => rejectDone(new Error("Agent 任务超时未结束")), 5000);
      const off = ctx.agent.subscribeRun(started.runId, (evt) => {
        events.push(evt);
        if (evt.type === "approval_required") {
          assert.ok(["write_file", "run_command"].includes(evt.toolName));
          ctx.agent.resolveApproval(started.runId, evt.approvalId, true);
        }
        if (evt.type === "run_finished") {
          clearTimeout(timer);
          off();
          resolveDone();
        }
      });
    });

    // 子项目对话建立自己的基线，父仓库保持未提交状态。
    assert.equal(execFileSync("git", ["show", "HEAD:README.md"], { cwd: workspaceDir, encoding: "utf8" }), "# Demo Project\nVersion 1");
    assert.throws(() => execFileSync("git", ["rev-parse", "--quiet", "--verify", "HEAD"], { cwd: tempRoot }));

    // 验证四层上下文全量注入（系统规则 + 项目 AGENTS.md + 用户规则 + 长期记忆 + 资料库能力）
    assert.ok(capturedSystemPrompt.includes("系统安全与行为底线"));
    assert.ok(capturedSystemPrompt.includes("自主排查与闭环修复"));
    assert.ok(capturedSystemPrompt.includes("自主排查与编辑准则"));
    assert.ok(capturedSystemPrompt.includes("写入文件前须明确检查内容"));
    assert.ok(capturedSystemPrompt.includes(`已授权目录：${workspaceDir}`));
    assert.ok(capturedSystemPrompt.includes("保持输出简明"));
    assert.ok(capturedSystemPrompt.includes("REPORT.md 用于存放项目检查摘要"));
    assert.ok(capturedSystemPrompt.includes("LFAA 资料库/资产库本地目录"));
    assert.ok(capturedSystemPrompt.includes("LFAA 背景图个人目录"));
    assert.ok(ctx.tools.getTool("list_library_assets"));
    assert.ok(ctx.tools.getTool("save_library_artifact"));

    // 验证实际磁盘文件已写入且思考/行动/检查三阶段均被持久化
    const reportBody = await fs.readFile(path.join(workspaceDir, "REPORT.md"), "utf8");
    assert.equal(reportBody, "# Status\nOK v1");

    const updatedSession = await ctx.memory.getSession(session.id);
    const assistantMsg = updatedSession?.messages.find((m) => m.id === started.assistantMessageId);
    assert.equal(assistantMsg?.status, "done");
    assert.equal(assistantMsg?.content, "已读取 README 并创建 REPORT.md。");
    assert.equal(assistantMsg?.progressText, "先检查 README 📝。确认项目版本。\n\n版本已确认，接下来生成报告。\n\n报告已写入，检查命令输出。\n\n");
    assert.equal(typeof assistantMsg?.runDurationMs, "number");
    assert.deepEqual(ctx.agent.getRunStatus(started.runId)?.message, assistantMsg);
    const activities = assistantMsg?.steps?.filter((step) => step.phase === "act") ?? [];
    assert.equal(activities.find((step) => step.toolName === "write_file")?.fileChange?.operation, "created");
    assert.equal(activities.find((step) => step.toolName === "write_file")?.fileChange?.after, "# Status\nOK v1");
    const writtenStep = activities.find((step) => step.toolName === "write_file");
    assert.ok(writtenStep);
    assert.deepEqual(
      await ctx.agent.readFileActivity(session.id, started.assistantMessageId, writtenStep.id, async () => [workspaceDir]),
      { content: "# Status\nOK v1", truncated: false },
    );
    await assert.rejects(() => ctx.agent.readFileActivity(session.id, started.assistantMessageId, writtenStep.id, async () => [tempRoot + "-outside"]));
    assert.equal(await ctx.agent.readFileActivity(session.id, started.assistantMessageId, "missing", async () => [workspaceDir]), null);
    assert.deepEqual(activities.map((step) => assistantMsg?.progressText?.slice(0, step.textOffset).trimEnd()), [
      "先检查 README 📝。确认项目版本。",
      "先检查 README 📝。确认项目版本。\n\n版本已确认，接下来生成报告。",
      "先检查 README 📝。确认项目版本。\n\n版本已确认，接下来生成报告。\n\n报告已写入，检查命令输出。",
    ]);
    assert.deepEqual(activities.at(-1)?.commandTrace, {
      command: "echo timeline-check && exit 7",
      output: "timeline-check",
      exitCode: 7,
    });
    assert.equal(activities.at(-1)?.status, "error");
    const stages = events.flatMap((event) =>
      event.type === "step_update" && event.step.id === "think-1" && event.step.modelStage
        ? [event.step.modelStage]
        : [],
    );
    assert.deepEqual(stages, ["reasoning", "replying"]);
    const actUpdates = events.flatMap((event) => event.type === "step_update" && event.step.phase === "act" ? [event.step] : []);
    assert.deepEqual(actUpdates.filter((step) => step.id === "act-1-tc-read").map((step) => step.status), [
      "preparing", "running", "done",
    ]);
    const writeUpdates = actUpdates.filter((step) => step.id === "act-2-tc-write");
    assert.deepEqual(writeUpdates.map((step) => step.status), [
      "preparing", "preparing", "waiting_approval", "running", "done",
    ]);
    assert.equal(writeUpdates[1]?.toolTarget, "REPORT.md");
    assert.equal(writeUpdates[1]?.argumentChars, 42);
    assert.equal(new Set(writeUpdates.map((step) => step.startedAt)).size, 1);
    assert.ok(actUpdates.filter((step) => step.status === "preparing").every((step) => !step.argsPreview && !step.commandTrace));
    assert.ok(events.findIndex((event) => event.type === "step_update" && event.step.id === "act-1-tc-read" && event.step.status === "preparing")
      < events.findIndex((event) => event.type === "delta" && event.text === "确认项目版本。"));
    assert.ok(assistantMsg?.steps?.some((s) => s.phase === "think"));
    assert.ok(assistantMsg?.steps?.some((s) => s.phase === "act" && s.toolName === "read_file"));
    assert.ok(assistantMsg?.steps?.some((s) => s.phase === "act" && s.toolName === "write_file"));
    assert.ok(assistantMsg?.steps?.some((s) => s.phase === "check" && s.status === "done"));
    assert.ok(events.some((e) => e.type === "approval_required"));
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("运行中切换到完全访问会结算当前审批并继续真实工具执行", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-live-permission-"));
  const ctx = new Context();
  await ctx.plugin(llmPlugin, {
    storeFilePath: path.join(root, "models.json"),
    adapter: async (profile, input) => ({
      model: profile.model, provider: profile.kind,
      ...(!input.messages.some((message) => message.role === "tool")
        ? { content: "", toolCalls: [{ id: "live-mode", name: "write_file", argumentsJson: '{"path":"result.txt","content":"通过"}' }], finishReason: "tool_calls" }
        : { content: "已完成", toolCalls: [], finishReason: "stop" }),
    }),
  });
  await ctx.plugin(rulesPlugin, { storeFilePath: path.join(root, "rules.json") });
  await ctx.plugin(memoryPlugin, { sessionsDir: path.join(root, "sessions"), memoryFilePath: path.join(root, "memory.json") });
  await ctx.plugin(toolsPlugin);
  await ctx.plugin(agentPlugin, { smartTrustFilePath: path.join(root, "trust.json") });
  try {
    const session = await ctx.memory.createSession({});
    const started = await ctx.agent.startRun({ sessionId: session.id, userMessage: "写入测试文件", workspaceRoots: [root], permissionMode: "ask" });
    const events: AgentRunEvent[] = [];
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("运行超时")), 3000);
      const unsubscribe = ctx.agent.subscribeRun(started.runId, (event) => {
        events.push(event);
        if (event.type === "approval_required") assert.equal(ctx.agent.setRunPermissionMode(started.runId, "full"), true);
        if (event.type === "run_finished") {
          clearTimeout(timeout);
          unsubscribe();
          resolve();
        }
      });
    });
    assert.equal(events.filter((event) => event.type === "approval_required").length, 1);
    assert.equal(events.filter((event) => event.type === "approval_resolved").length, 1);
    assert.equal(await fs.readFile(path.join(root, "result.txt"), "utf8"), "通过");
    await assert.rejects(fs.stat(path.join(root, ".git")), { code: "ENOENT" });
    assert.equal(ctx.agent.getRunStatus(started.runId)?.status, "done");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
