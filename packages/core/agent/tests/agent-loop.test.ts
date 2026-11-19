// 验证 @lfaa/agent 集成四大能力并完成 Think -> Act(含审批) -> Check 任务闭环。
import assert from "node:assert/strict";
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

test("AgentService 完成 Think -> Act(读写工具+人工审批) -> Check 闭环并持久化轨迹与记忆", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-agent-loop-"));
  const workspaceDir = path.join(tempRoot, "demo-project");
  await fs.mkdir(workspaceDir, { recursive: true });
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

    // 验证四层上下文全量注入（系统规则 + 项目 AGENTS.md + 用户规则 + 长期记忆 + 资料库能力）
    assert.ok(capturedSystemPrompt.includes("系统安全与行为底线"));
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
    assert.deepEqual(actUpdates.filter((step) => step.id === "act-2-tc-write").map((step) => step.status), [
      "preparing", "waiting_approval", "running", "done",
    ]);
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
