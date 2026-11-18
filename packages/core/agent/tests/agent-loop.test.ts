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
import { agentPlugin, type AgentRunEvent } from "../src/index";

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
        return {
          model: profile.model,
          provider: profile.kind,
          content: "",
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
        return {
          model: profile.model,
          provider: profile.kind,
          content: "",
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
      projectId: "proj-demo",
      workspaceRoots: [workspaceDir],
    });

    await new Promise<void>((resolveDone, rejectDone) => {
      const timer = setTimeout(() => rejectDone(new Error("Agent 任务超时未结束")), 5000);
      const off = ctx.agent.subscribeRun(started.runId, (evt) => {
        events.push(evt);
        if (evt.type === "approval_required") {
          assert.equal(evt.toolName, "write_file");
          assert.equal(evt.permissionLevel, "write");
          ctx.agent.resolveApproval(started.runId, evt.approvalId, true);
        }
        if (evt.type === "run_finished") {
          clearTimeout(timer);
          off();
          resolveDone();
        }
      });
    });

    // 验证四层上下文全量注入（系统规则 + 项目 AGENTS.md + 用户规则 + 长期记忆）
    assert.ok(capturedSystemPrompt.includes("系统安全与行为底线"));
    assert.ok(capturedSystemPrompt.includes("写入文件前须明确检查内容"));
    assert.ok(capturedSystemPrompt.includes("保持输出简明"));
    assert.ok(capturedSystemPrompt.includes("REPORT.md 用于存放项目检查摘要"));

    // 验证实际磁盘文件已写入且思考/行动/检查三阶段均被持久化
    const reportBody = await fs.readFile(path.join(workspaceDir, "REPORT.md"), "utf8");
    assert.equal(reportBody, "# Status\nOK v1");

    const updatedSession = await ctx.memory.getSession(session.id);
    const assistantMsg = updatedSession?.messages.find((m) => m.id === started.assistantMessageId);
    assert.equal(assistantMsg?.status, "done");
    assert.equal(assistantMsg?.content, "已读取 README 并创建 REPORT.md。");
    assert.ok(assistantMsg?.steps?.some((s) => s.phase === "think"));
    assert.ok(assistantMsg?.steps?.some((s) => s.phase === "act" && s.toolName === "read_file"));
    assert.ok(assistantMsg?.steps?.some((s) => s.phase === "act" && s.toolName === "write_file"));
    assert.ok(assistantMsg?.steps?.some((s) => s.phase === "check" && s.status === "done"));
    assert.ok(events.some((e) => e.type === "approval_required"));
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});
