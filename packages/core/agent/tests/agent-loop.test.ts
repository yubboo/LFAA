// 验证 @lfaa/agent 集成四大能力并完成 Think -> Act(含审批) -> Check 任务闭环。
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
  const ctx = new Context();
  await ctx.plugin(llmPlugin, {
    storeFilePath: path.join(dir, "llm.json"),
    adapter: async (profile, input) => {
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

test("三种权限模式严格区分 ask / smart(3次自动放行+高危兜底) / full", async () => {
  // 1. evaluateToolApproval 纯策略验证
  assert.equal(
    evaluateToolApproval({
      mode: "ask",
      permissionLevel: "write",
      toolName: "write_file",
      args: { path: "a.txt", content: "1" },
      approvedCount: 99,
    }).requiresApproval,
    true,
  );

  // smart 模式：0/1/2 次均询问，达到 3 次自动放行；但高危命令即使 >=3 次仍强制询问
  assert.equal(
    evaluateToolApproval({
      mode: "smart",
      permissionLevel: "write",
      toolName: "write_file",
      args: { path: "a.txt", content: "1" },
      approvedCount: SMART_APPROVAL_THRESHOLD - 1,
    }).requiresApproval,
    true,
  );
  const autoSmart = evaluateToolApproval({
    mode: "smart",
    permissionLevel: "write",
    toolName: "write_file",
    args: { path: "a.txt", content: "1" },
    approvedCount: SMART_APPROVAL_THRESHOLD,
  });
  assert.equal(autoSmart.requiresApproval, false);
  assert.equal(autoSmart.autoApproved, true);

  const highRiskSmart = evaluateToolApproval({
    mode: "smart",
    permissionLevel: "exec",
    toolName: "run_command",
    args: { command: "rm -rf /tmp/demo" },
    approvedCount: 10,
  });
  assert.equal(highRiskSmart.requiresApproval, true);
  assert.equal(highRiskSmart.highRisk, true);

  // full 模式：全部自动放行
  assert.equal(
    evaluateToolApproval({
      mode: "full",
      permissionLevel: "exec",
      toolName: "run_command",
      args: { command: "rm -rf /tmp/demo" },
      approvedCount: 0,
    }).autoApproved,
    true,
  );

  // 2. 端到端 smart 3 次批准 -> 第 4 次自动执行，以及 full 免审写工作区外文件
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-perm-modes-"));
  const workspaceDir = path.join(tempRoot, "ws");
  const outsideFile = path.join(tempRoot, "outside.txt");
  await fs.mkdir(workspaceDir, { recursive: true });

  let stepIdx = 0;
  const ctx = new Context();
  await ctx.plugin(llmPlugin, {
    storeFilePath: path.join(tempRoot, "llm.json"),
    adapter: async (profile) => {
      stepIdx += 1;
      if (stepIdx <= 4) {
        return {
          model: profile.model,
          provider: profile.kind,
          content: "",
          toolCalls: [
            {
              id: `w-${stepIdx}`,
              name: "write_file",
              argumentsJson: JSON.stringify({ path: `f-${stepIdx}.txt`, content: `v${stepIdx}` }),
            },
          ],
          finishReason: "tool_calls",
        };
      }
      if (stepIdx === 6) {
        return {
          model: profile.model,
          provider: profile.kind,
          content: "",
          toolCalls: [
            {
              id: "w-outside",
              name: "write_file",
              argumentsJson: JSON.stringify({ path: outsideFile, content: "full-access-ok" }),
            },
          ],
          finishReason: "tool_calls",
        };
      }
      return { model: profile.model, provider: profile.kind, content: "ok", toolCalls: [], finishReason: "stop" };
    },
  });
  await ctx.plugin(rulesPlugin, { storeFilePath: path.join(tempRoot, "rules.json") });
  await ctx.plugin(memoryPlugin, {
    sessionsDir: path.join(tempRoot, "sessions"),
    memoryFilePath: path.join(tempRoot, "memory.json"),
  });
  await ctx.plugin(toolsPlugin);
  await ctx.plugin(agentPlugin, { smartTrustFilePath: path.join(tempRoot, "smart-trust.json") });

  try {
    const session = await ctx.memory.createSession({ projectId: "proj-perm" });

    // smart 模式下前 3 次弹窗审批，第 4 次自动放行
    let smartPromptCount = 0;
    const runSmart = await ctx.agent.startRun({
      sessionId: session.id,
      userMessage: "连续写 4 个文件",
      projectId: "proj-perm",
      workspaceRoots: [workspaceDir],
      permissionMode: "smart",
    });
    await new Promise<void>((resolveDone, rejectDone) => {
      const timer = setTimeout(() => rejectDone(new Error("smart run 超时")), 5000);
      const off = ctx.agent.subscribeRun(runSmart.runId, (evt) => {
        if (evt.type === "approval_required") {
          smartPromptCount += 1;
          ctx.agent.resolveApproval(runSmart.runId, evt.approvalId, true);
        }
        if (evt.type === "run_finished") {
          clearTimeout(timer);
          off();
          resolveDone();
        }
      });
    });
    assert.equal(smartPromptCount, 3, "smart 模式前 3 次需人工确认，第 4 次应自动放行");
    assert.equal(await fs.readFile(path.join(workspaceDir, "f-4.txt"), "utf8"), "v4");

    // full 模式下不弹审批且允许写入工作区外路径
    let fullPromptCount = 0;
    const runFull = await ctx.agent.startRun({
      sessionId: session.id,
      userMessage: "写外部文件",
      projectId: "proj-perm",
      workspaceRoots: [workspaceDir],
      permissionMode: "full",
    });
    await new Promise<void>((resolveDone, rejectDone) => {
      const timer = setTimeout(() => rejectDone(new Error("full run 超时")), 5000);
      const off = ctx.agent.subscribeRun(runFull.runId, (evt) => {
        if (evt.type === "approval_required") fullPromptCount += 1;
        if (evt.type === "run_finished") {
          clearTimeout(timer);
          off();
          resolveDone();
        }
      });
    });
    assert.equal(fullPromptCount, 0, "full 模式不应请求人工确认");
    assert.equal(await fs.readFile(outsideFile, "utf8"), "full-access-ok");
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("流式断线重连序号补发、完整句边界裁剪、指数退避与四项指标可观测性", async () => {
  const {
    computeReconnectBackoffMs,
    maskRunId,
    splitAtCleanSentenceBoundary,
  } = await import("../src/index");

  const split = splitAtCleanSentenceBoundary("今天天气真好。我们去散步吧，但是");
  assert.equal(split.cleanPrefix, "今天天气真好。");
  assert.equal(split.incompleteTail, "我们去散步吧，但是");

  assert.equal(maskRunId("1234567890abcdef"), "1234***cdef");
  const d1 = computeReconnectBackoffMs(1, 500, 12000);
  const d4 = computeReconnectBackoffMs(4, 500, 12000);
  assert.ok(d1 >= 500 && d1 <= 720);
  assert.ok(d4 >= 4000 && d4 <= 4220);

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-stream-resume-"));
  const ctx = new Context();
  ctx.plugin(memoryPlugin, {
    sessionsDir: path.join(tempRoot, "sessions"),
    memoryFilePath: path.join(tempRoot, "memory.json"),
  });
  ctx.plugin(rulesPlugin, { storeFilePath: path.join(tempRoot, "rules.json") });
  ctx.plugin(toolsPlugin);
  ctx.plugin(llmPlugin, {
    storeFilePath: path.join(tempRoot, "llm.json"),
    adapter: async (_profile, input) => {
      for (const ch of ["第1段。", "第2段。", "第3段。"]) {
        input.onDelta?.({ type: "text", text: ch });
        await new Promise((r) => setTimeout(r, 10));
      }
      return {
        model: "mock",
        provider: "openai-compatible",
        content: "第1段。第2段。第3段。",
        toolCalls: [],
        finishReason: "stop",
      };
    },
  });
  await ctx.plugin(agentPlugin, { smartTrustFilePath: path.join(tempRoot, "trust.json") });

  try {
    const session = await ctx.memory.createSession({ title: "流式续传测试" });
    const started = await ctx.agent.startRun({
      sessionId: session.id,
      userMessage: "分段输出",
    });

    await new Promise<void>((resolveDone) => {
      const off = ctx.agent.subscribeRun(started.runId, (evt) => {
        if (evt.type === "run_finished") {
          off();
          resolveDone();
        }
      });
    });

    const replayed = ctx.agent.getReplayChunks(started.runId, 1);
    assert.deepEqual(
      replayed.map((c) => [c.seq, c.text]),
      [[2, "第2段。"], [3, "第3段。"]],
    );
    ctx.agent.recordReconnect(started.runId, 1, replayed);
    ctx.agent.recordClientFps(59.4);

    const metrics = ctx.agent.getStreamMetrics();
    assert.equal(metrics.activeStreams, 0);
    assert.equal(metrics.totalRuns, 1);
    assert.equal(metrics.totalReconnects, 1);
    assert.equal(metrics.replayedChunks, 2);
    assert.equal(metrics.reconnectRate, 1);
    assert.equal(metrics.lastClientFps, 59.4);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("默认 maxSteps 支持超过 10 轮的多步工程任务，达到上限收口也会保留推理进展", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-maxsteps-"));
  const ctx = new Context();
  let turn = 0;

  await ctx.plugin(llmPlugin, {
    storeFilePath: path.join(tempRoot, "llm.json"),
    adapter: async (profile, input) => {
      turn += 1;
      if (turn <= 12 && (input.tools?.length ?? 0) > 0) {
        return {
          model: profile.model,
          provider: profile.kind,
          content: "",
          toolCalls: [{ id: `ls-${turn}`, name: "list_dir", argumentsJson: "{}" }],
          finishReason: "tool_calls",
        };
      }
      input.onDelta?.({ type: "reasoning", text: "汇总所有轮次结果。" });
      input.onActivity?.();
      input.onDelta?.({ type: "text", text: "12 轮步骤已完成。" });
      return {
        model: profile.model,
        provider: profile.kind,
        content: "12 轮步骤已完成。",
        reasoningContent: "汇总所有轮次结果。",
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
  await ctx.plugin(agentPlugin, { smartTrustFilePath: path.join(tempRoot, "trust.json") });

  try {
    const session = await ctx.memory.createSession({ title: "多轮默认上限测试" });
    const started = await ctx.agent.startRun({
      sessionId: session.id,
      userMessage: "连续检查 12 次",
      workspaceRoots: [tempRoot],
    });
    await new Promise<void>((resolveDone, rejectDone) => {
      const timer = setTimeout(() => rejectDone(new Error("多轮任务超时")), 5000);
      const off = ctx.agent.subscribeRun(started.runId, (evt) => {
        if (evt.type === "run_finished") {
          clearTimeout(timer);
          off();
          resolveDone();
        }
      });
    });

    const msg = (await ctx.memory.getSession(session.id))?.messages.find((m) => m.id === started.assistantMessageId);
    assert.equal(msg?.status, "done");
    assert.equal(msg?.content, "12 轮步骤已完成。");
    assert.equal(msg?.steps?.filter((s) => s.phase === "act").length, 12);

    // 显式 maxSteps=1 时触发收口分支，验证 reasoning 与回复均正确保留。
    turn = 0;
    const capped = await ctx.agent.startRun({
      sessionId: session.id,
      userMessage: "触发上限",
      workspaceRoots: [tempRoot],
      maxSteps: 1,
    });
    await new Promise<void>((resolveDone, rejectDone) => {
      const timer = setTimeout(() => rejectDone(new Error("收口任务超时")), 5000);
      const off = ctx.agent.subscribeRun(capped.runId, (evt) => {
        if (evt.type === "run_finished") {
          clearTimeout(timer);
          off();
          resolveDone();
        }
      });
    });
    const cappedMsg = (await ctx.memory.getSession(session.id))?.messages.find((m) => m.id === capped.assistantMessageId);
    assert.equal(cappedMsg?.status, "done");
    assert.equal(cappedMsg?.content, "12 轮步骤已完成。");
    assert.ok(cappedMsg?.reasoning?.includes("汇总所有轮次结果"));
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("软预算用尽后按上一轮真实工具进展自动延长，并写入滚动会话摘要", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-budget-"));
  const ctx = new Context();
  let turn = 0;

  await ctx.plugin(llmPlugin, {
    storeFilePath: path.join(tempRoot, "llm.json"),
    adapter: async (profile, input) => {
      turn += 1;
      if (turn <= 3 && (input.tools?.length ?? 0) > 0) {
        return {
          model: profile.model,
          provider: profile.kind,
          content: "",
          toolCalls: [{ id: `ls-${turn}`, name: "list_dir", argumentsJson: "{}" }],
          finishReason: "tool_calls",
        };
      }
      input.onDelta?.({ type: "text", text: "延长预算后完成。" });
      return { model: profile.model, provider: profile.kind, content: "延长预算后完成。", toolCalls: [], finishReason: "stop" };
    },
  });
  await ctx.plugin(rulesPlugin, { storeFilePath: path.join(tempRoot, "rules.json") });
  await ctx.plugin(memoryPlugin, {
    sessionsDir: path.join(tempRoot, "sessions"),
    memoryFilePath: path.join(tempRoot, "memory.json"),
  });
  await ctx.plugin(toolsPlugin);
  await ctx.plugin(agentPlugin, { smartTrustFilePath: path.join(tempRoot, "trust.json") });

  try {
    const session = await ctx.memory.createSession({ title: "预算延长" });
    const started = await ctx.agent.startRun({
      sessionId: session.id,
      userMessage: "连续检查三次",
      workspaceRoots: [tempRoot],
      maxSteps: 2,
      autoExtendSteps: 2,
    });
    await new Promise<void>((resolveDone, rejectDone) => {
      const timer = setTimeout(() => rejectDone(new Error("预算延长任务超时")), 5000);
      const off = ctx.agent.subscribeRun(started.runId, (evt) => {
        if (evt.type === "run_finished") {
          clearTimeout(timer);
          off();
          resolveDone();
        }
      });
    });

    const saved = await ctx.memory.getSession(session.id);
    const message = saved?.messages.find((m) => m.id === started.assistantMessageId);
    assert.equal(message?.content, "延长预算后完成。");
    assert.equal(message?.steps?.filter((s) => s.phase === "act").length, 3);
    assert.ok(message?.steps?.some((s) => s.title.includes("自动延长 2 步")));

    // 运行结束写入滚动摘要：包含本轮目标与真实工具轨迹
    assert.match(saved?.contextSummary ?? "", /本轮：连续检查三次/u);
    assert.match(saved?.contextSummary ?? "", /list_dir×3/u);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("模型上下文超限时强制压缩并重试一次，而不是直接失败", async () => {  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-overflow-"));
  const ctx = new Context();
  let turn = 0;

  await ctx.plugin(llmPlugin, {
    storeFilePath: path.join(tempRoot, "llm.json"),
    adapter: async (profile) => {
      turn += 1;
      if (turn === 1) {
        throw new Error("This model's maximum context length is 65536 tokens");
      }
      return {
        model: profile.model,
        provider: profile.kind,
        content: "压缩后完成。",
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
  await ctx.plugin(agentPlugin, { smartTrustFilePath: path.join(tempRoot, "trust.json") });

  try {
    const session = await ctx.memory.createSession({ title: "上下文压缩" });
    const started = await ctx.agent.startRun({
      sessionId: session.id,
      userMessage: "执行一个长任务",
      workspaceRoots: [tempRoot],
    });
    await new Promise<void>((resolveDone, rejectDone) => {
      const timer = setTimeout(() => rejectDone(new Error("上下文压缩任务超时")), 5000);
      const off = ctx.agent.subscribeRun(started.runId, (evt) => {
        if (evt.type === "run_finished") {
          clearTimeout(timer);
          off();
          resolveDone();
        }
      });
    });

    const message = (await ctx.memory.getSession(session.id))?.messages
      .find((item) => item.id === started.assistantMessageId);
    assert.equal(message?.content, "压缩后完成。");
    assert.ok(message?.steps?.some((step) => step.title.includes("上下文超限")));
    assert.equal(turn, 2);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("明确偏好自动沉淀并在下次运行召回，模型用量随消息持久化", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-memory-loop-"));
  const ctx = new Context();
  let turn = 0;
  let secondSystemPrompt = "";

  await ctx.plugin(llmPlugin, {
    storeFilePath: path.join(tempRoot, "llm.json"),
    adapter: async (profile, input) => {
      turn += 1;
      if (turn === 1) {
        return {
          model: profile.model,
          provider: profile.kind,
          content: "好的，已记录。",
          toolCalls: [],
          finishReason: "stop",
          usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
        };
      }
      secondSystemPrompt = input.messages[0]?.content ?? "";
      return {
        model: profile.model,
        provider: profile.kind,
        content: "构建步骤说明。",
        toolCalls: [],
        finishReason: "stop",
        usage: { promptTokens: 50, completionTokens: 10, totalTokens: 60 },
      };
    },
  });
  await ctx.plugin(rulesPlugin, { storeFilePath: path.join(tempRoot, "rules.json") });
  await ctx.plugin(memoryPlugin, {
    sessionsDir: path.join(tempRoot, "sessions"),
    memoryFilePath: path.join(tempRoot, "memory.json"),
  });
  await ctx.plugin(toolsPlugin);
  await ctx.plugin(agentPlugin, { smartTrustFilePath: path.join(tempRoot, "trust.json") });

  const waitRun = (runId: string) => new Promise<void>((resolveDone, rejectDone) => {
    const timer = setTimeout(() => rejectDone(new Error("记忆闭环任务超时")), 5000);
    const off = ctx.agent.subscribeRun(runId, (evt) => {
      if (evt.type === "run_finished") {
        clearTimeout(timer);
        off();
        resolveDone();
      }
    });
  });

  try {
    const session = await ctx.memory.createSession({ projectId: "proj-mem", title: "记忆闭环" });
    const first = await ctx.agent.startRun({
      sessionId: session.id,
      userMessage: "记住：本项目统一使用 pnpm。",
      projectId: "proj-mem",
      workspaceRoots: [tempRoot],
    });
    await waitRun(first.runId);

    const saved = await ctx.memory.getSession(session.id);
    const message = saved?.messages.find((item) => item.id === first.assistantMessageId);
    assert.deepEqual(message?.tokenUsage, { promptTokens: 100, completionTokens: 20, totalTokens: 120 });
    assert.ok(message?.steps?.some((step) => step.title.includes("自动沉淀长期记忆")));
    const memories = await ctx.memory.listLongTermMemories({ projectId: "proj-mem" });
    assert.ok(memories.some((item) => item.content.includes("pnpm")));

    const second = await ctx.agent.startRun({
      sessionId: session.id,
      userMessage: "继续说明构建步骤",
      projectId: "proj-mem",
      workspaceRoots: [tempRoot],
    });
    await waitRun(second.runId);
    assert.match(secondSystemPrompt, /项目记忆/u);
    assert.match(secondSystemPrompt, /pnpm/u);
    const secondMessage = (await ctx.memory.getSession(session.id))?.messages
      .find((item) => item.id === second.assistantMessageId);
    assert.deepEqual(secondMessage?.tokenUsage, { promptTokens: 50, completionTokens: 10, totalTokens: 60 });
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("同轮连续只读工具并行执行，结果按调用顺序回填", async () => {  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-parallel-"));
  const ctx = new Context();
  let active = 0;
  let maxActive = 0;
  let turn = 0;
  let toolOrder: Array<string | undefined> = [];

  await ctx.plugin(llmPlugin, {
    storeFilePath: path.join(tempRoot, "llm.json"),
    adapter: async (profile, input) => {
      turn += 1;
      if (turn === 1) {
        return {
          model: profile.model,
          provider: profile.kind,
          content: "",
          toolCalls: [
            { id: "read-a", name: "slow_read", argumentsJson: "{}" },
            { id: "read-b", name: "slow_read", argumentsJson: "{}" },
          ],
          finishReason: "tool_calls",
        };
      }
      toolOrder = input.messages.filter((item) => item.role === "tool").map((item) => item.toolCallId);
      return {
        model: profile.model,
        provider: profile.kind,
        content: "并行完成。",
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
  ctx.tools.registerTool({
    name: "slow_read",
    title: "慢速只读工具",
    description: "测试同轮并行执行",
    permissionLevel: "read",
    parameters: { type: "object", properties: {} },
    execute: async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 60));
      active -= 1;
      return { ok: true, output: "ok", summary: "ok" };
    },
  });
  await ctx.plugin(agentPlugin, { smartTrustFilePath: path.join(tempRoot, "trust.json") });

  try {
    const session = await ctx.memory.createSession({ title: "并行只读" });
    const started = await ctx.agent.startRun({
      sessionId: session.id,
      userMessage: "并行读取两个文件",
      workspaceRoots: [tempRoot],
    });
    await new Promise<void>((resolveDone, rejectDone) => {
      const timer = setTimeout(() => rejectDone(new Error("并行任务超时")), 5000);
      const off = ctx.agent.subscribeRun(started.runId, (evt) => {
        if (evt.type === "run_finished") {
          clearTimeout(timer);
          off();
          resolveDone();
        }
      });
    });

    assert.ok(maxActive >= 2, `只读工具应并行执行，实际最大并发 ${maxActive}`);
    assert.deepEqual(toolOrder, ["read-a", "read-b"]);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("修改代码后未验证即结束会触发完成前自检并补验证", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-verify-gate-"));
  const ctx = new Context();
  let turn = 0;
  let nudgeSeen = false;

  await ctx.plugin(llmPlugin, {
    storeFilePath: path.join(tempRoot, "llm.json"),
    adapter: async (profile, input) => {
      turn += 1;
      const lastUser = [...input.messages].reverse().find((message) => message.role === "user")?.content ?? "";
      if (turn === 1) {
        return {
          model: profile.model,
          provider: profile.kind,
          content: "先写入文件。",
          toolCalls: [{
            id: "write-1",
            name: "write_file",
            argumentsJson: JSON.stringify({ path: "src/app.ts", content: "export const value = 1;\n" }),
          }],
          finishReason: "tool_calls",
        };
      }
      if (turn === 2) {
        return { model: profile.model, provider: profile.kind, content: "已完成修改。", toolCalls: [], finishReason: "stop" };
      }
      if (turn === 3) {
        nudgeSeen = lastUser.includes("完成前请先验证");
        return {
          model: profile.model,
          provider: profile.kind,
          content: "",
          toolCalls: [{
            id: "verify-1",
            name: "run_command",
            argumentsJson: JSON.stringify({ command: "tsc --noEmit" }),
          }],
          finishReason: "tool_calls",
        };
      }
      return { model: profile.model, provider: profile.kind, content: "已补做验证。", toolCalls: [], finishReason: "stop" };
    },
  });
  await ctx.plugin(rulesPlugin, { storeFilePath: path.join(tempRoot, "rules.json") });
  await ctx.plugin(memoryPlugin, {
    sessionsDir: path.join(tempRoot, "sessions"),
    memoryFilePath: path.join(tempRoot, "memory.json"),
  });
  await ctx.plugin(toolsPlugin);
  await ctx.plugin(agentPlugin, { smartTrustFilePath: path.join(tempRoot, "trust.json") });

  try {
    const session = await ctx.memory.createSession({ title: "完成前自检" });
    const started = await ctx.agent.startRun({
      sessionId: session.id,
      userMessage: "新增 src/app.ts",
      workspaceRoots: [tempRoot],
      autoApproveTools: true,
    });
    await new Promise<void>((resolveDone, rejectDone) => {
      const timer = setTimeout(() => rejectDone(new Error("自检任务超时")), 8000);
      const off = ctx.agent.subscribeRun(started.runId, (evt) => {
        if (evt.type === "run_finished") {
          clearTimeout(timer);
          off();
          resolveDone();
        }
      });
    });

    const message = (await ctx.memory.getSession(session.id))?.messages
      .find((item) => item.id === started.assistantMessageId);
    assert.equal(message?.content, "已补做验证。");
    assert.ok(message?.steps?.some((step) => step.title.includes("完成前自检")));
    assert.equal(nudgeSeen, true);
    assert.equal(turn, 4);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("只改文档不会触发完成前自检", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-verify-doc-"));
  const ctx = new Context();
  let turn = 0;

  await ctx.plugin(llmPlugin, {
    storeFilePath: path.join(tempRoot, "llm.json"),
    adapter: async (profile) => {
      turn += 1;
      if (turn === 1) {
        return {
          model: profile.model,
          provider: profile.kind,
          content: "",
          toolCalls: [{
            id: "write-doc",
            name: "write_file",
            argumentsJson: JSON.stringify({ path: "README.md", content: "# 说明\n" }),
          }],
          finishReason: "tool_calls",
        };
      }
      return { model: profile.model, provider: profile.kind, content: "文档已更新。", toolCalls: [], finishReason: "stop" };
    },
  });
  await ctx.plugin(rulesPlugin, { storeFilePath: path.join(tempRoot, "rules.json") });
  await ctx.plugin(memoryPlugin, {
    sessionsDir: path.join(tempRoot, "sessions"),
    memoryFilePath: path.join(tempRoot, "memory.json"),
  });
  await ctx.plugin(toolsPlugin);
  await ctx.plugin(agentPlugin, { smartTrustFilePath: path.join(tempRoot, "trust.json") });

  try {
    const session = await ctx.memory.createSession({ title: "文档修改" });
    const started = await ctx.agent.startRun({
      sessionId: session.id,
      userMessage: "更新 README",
      workspaceRoots: [tempRoot],
      autoApproveTools: true,
    });
    await new Promise<void>((resolveDone, rejectDone) => {
      const timer = setTimeout(() => rejectDone(new Error("文档任务超时")), 5000);
      const off = ctx.agent.subscribeRun(started.runId, (evt) => {
        if (evt.type === "run_finished") {
          clearTimeout(timer);
          off();
          resolveDone();
        }
      });
    });

    const message = (await ctx.memory.getSession(session.id))?.messages
      .find((item) => item.id === started.assistantMessageId);
    assert.equal(message?.content, "文档已更新。");
    assert.equal(message?.steps?.some((step) => step.title.includes("完成前自检")), false);
    assert.equal(turn, 2);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("运行持久化模型/工具耗时与上下文构成", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-run-metrics-"));
  const ctx = new Context();
  let turn = 0;
  await ctx.plugin(llmPlugin, {
    storeFilePath: path.join(tempRoot, "llm.json"),
    adapter: async (profile, input) => {
      turn += 1;
      if (turn === 1) {
        return {
          model: profile.model,
          provider: profile.kind,
          content: "",
          toolCalls: [{ id: "ls-1", name: "list_dir", argumentsJson: "{}" }],
          finishReason: "tool_calls",
        };
      }
      input.onDelta?.({ type: "text", text: "完成。" });
      return {
        model: profile.model,
        provider: profile.kind,
        content: "完成。",
        toolCalls: [],
        finishReason: "stop",
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      };
    },
  });
  await ctx.plugin(rulesPlugin, { storeFilePath: path.join(tempRoot, "rules.json") });
  await ctx.plugin(memoryPlugin, {
    sessionsDir: path.join(tempRoot, "sessions"),
    memoryFilePath: path.join(tempRoot, "memory.json"),
  });
  await ctx.plugin(toolsPlugin);
  await ctx.plugin(agentPlugin, { smartTrustFilePath: path.join(tempRoot, "trust.json") });

  try {
    await ctx.llm.saveProfile({
      name: "Priced Model",
      kind: "openai-compatible",
      baseUrl: "https://example.test/v1",
      model: "fixture",
      apiKey: "test-key",
      inputPricePerMillion: 2,
      outputPricePerMillion: 8,
    });
    const session = await ctx.memory.createSession({ title: "运行指标" });
    const started = await ctx.agent.startRun({
      sessionId: session.id,
      userMessage: "列出目录",
      workspaceRoots: [tempRoot],
    });
    let usageEvents = 0;
    await new Promise<void>((resolveDone, rejectDone) => {
      const timer = setTimeout(() => rejectDone(new Error("指标任务超时")), 5000);
      const off = ctx.agent.subscribeRun(started.runId, (evt) => {
        if (evt.type === "run_usage") usageEvents += 1;
        if (evt.type === "run_finished") {
          clearTimeout(timer);
          off();
          resolveDone();
        }
      });
    });
    assert.ok(usageEvents >= 1, "运行中应推送累计用量，统计栏才能实时变化");

    const message = (await ctx.memory.getSession(session.id))?.messages
      .find((item) => item.id === started.assistantMessageId);
    const metrics = message?.metrics;
    assert.ok(metrics, "应持久化运行指标");
    assert.ok(metrics.llmMs >= 0);
    assert.ok(metrics.toolMs >= 0);
    assert.ok(metrics.ttftSteps >= 1);
    assert.ok(metrics.context.systemTokens > 0);
    assert.ok(metrics.context.toolsTokens > 0);
    assert.ok(metrics.context.messageTokens > 0);
    assert.ok(message?.cost, "应持久化人民币成本");
    assert.equal(message?.cost?.currency, "CNY");
    assert.ok((message?.cost?.amount ?? 0) > 0);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("重复工具调用会插入建议性提醒且不阻断执行", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-repeat-guard-"));
  const ctx = new Context();
  let turn = 0;

  await ctx.plugin(llmPlugin, {
    storeFilePath: path.join(tempRoot, "llm.json"),
    adapter: async (profile) => {
      turn += 1;
      if (turn <= 6) {
        return {
          model: profile.model,
          provider: profile.kind,
          content: "",
          toolCalls: [{ id: `ls-${turn}`, name: "list_dir", argumentsJson: "{}" }],
          finishReason: "tool_calls",
        };
      }
      return {
        model: profile.model,
        provider: profile.kind,
        content: "已结束。",
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
  await ctx.plugin(agentPlugin, { smartTrustFilePath: path.join(tempRoot, "trust.json") });

  try {
    const session = await ctx.memory.createSession({ title: "重复调用提醒" });
    const started = await ctx.agent.startRun({
      sessionId: session.id,
      userMessage: "反复列出目录",
      workspaceRoots: [tempRoot],
      maxSteps: 6,
      autoExtendSteps: 0,
    });
    await new Promise<void>((resolveDone, rejectDone) => {
      const timer = setTimeout(() => rejectDone(new Error("重复调用任务超时")), 15000);
      const off = ctx.agent.subscribeRun(started.runId, (evt) => {
        if (evt.type === "run_finished") {
          clearTimeout(timer);
          off();
          resolveDone();
        }
      });
    });

    const message = (await ctx.memory.getSession(session.id))?.messages
      .find((item) => item.id === started.assistantMessageId);
    const reminders = (message?.steps ?? []).filter((step) => step.title.includes("检测到重复工具调用"));
    assert.ok(reminders.length >= 2, "应在连续 3 次与 5 次时各提醒一次");
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

test("重复调用阈值可由运行参数覆盖", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-repeat-threshold-"));
  const ctx = new Context();
  let turn = 0;

  await ctx.plugin(llmPlugin, {
    storeFilePath: path.join(tempRoot, "llm.json"),
    adapter: async (profile) => {
      turn += 1;
      if (turn <= 2) {
        return {
          model: profile.model,
          provider: profile.kind,
          content: "",
          toolCalls: [{ id: `ls-${turn}`, name: "list_dir", argumentsJson: "{}" }],
          finishReason: "tool_calls",
        };
      }
      return { model: profile.model, provider: profile.kind, content: "已结束。", toolCalls: [], finishReason: "stop" };
    },
  });
  await ctx.plugin(rulesPlugin, { storeFilePath: path.join(tempRoot, "rules.json") });
  await ctx.plugin(memoryPlugin, {
    sessionsDir: path.join(tempRoot, "sessions"),
    memoryFilePath: path.join(tempRoot, "memory.json"),
  });
  await ctx.plugin(toolsPlugin);
  await ctx.plugin(agentPlugin, { smartTrustFilePath: path.join(tempRoot, "trust.json") });

  try {
    const session = await ctx.memory.createSession({ title: "阈值覆盖" });
    const started = await ctx.agent.startRun({
      sessionId: session.id,
      userMessage: "重复两次",
      workspaceRoots: [tempRoot],
      maxSteps: 2,
      autoExtendSteps: 0,
      repeatToolThresholds: [2],
    });
    await new Promise<void>((resolveDone, rejectDone) => {
      const timer = setTimeout(() => rejectDone(new Error("阈值任务超时")), 15000);
      const off = ctx.agent.subscribeRun(started.runId, (evt) => {
        if (evt.type === "run_finished") {
          clearTimeout(timer);
          off();
          resolveDone();
        }
      });
    });
    const message = (await ctx.memory.getSession(session.id))?.messages
      .find((item) => item.id === started.assistantMessageId);
    const reminders = (message?.steps ?? []).filter((step) => step.title.includes("检测到重复工具调用"));
    assert.equal(reminders.length, 1);
    assert.ok(reminders[0]?.title.includes("连续 2 次"));
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});
