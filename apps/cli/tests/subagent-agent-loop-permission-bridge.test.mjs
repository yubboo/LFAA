/** 隔离验证外部 Coding Agent 动作回调接入真实 Agent Loop/Permission Owner。 */
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const testRoot = fileURLToPath(new URL("../../../dist/.tmp/", import.meta.url));
mkdirSync(testRoot, { recursive: true });
const testData = mkdtempSync(join(testRoot, "lfaa-agent-loop-permission-bridge-"));
process.env.LFAA_DATA_DIR = join(testData, "data");
process.env.LFAA_HOME = join(testData, "home");
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "";
process.env.LFAA_HARNESS_HOME = "";
process.env.LFAA_LOCAL_MODE = "true";
const reservation = createServer();
reservation.listen(0, "127.0.0.1");
await once(reservation, "listening");
process.env.SERVER_HOST = "127.0.0.1";
process.env.SERVER_PORT = String(reservation.address().port);
await new Promise(resolve => reservation.close(resolve));
test.after(() => {
  if (dirname(testData) !== testRoot.replace(/[\\/]$/u, "")) throw new Error("拒绝清理隔离根以外路径。");
  rmSync(testData, { recursive: true, force: true });
});

test("外部 Agent 每个动作经过真实 Permission Owner，批准才执行、拒绝不执行", { timeout: 60_000 }, async t => {
  const { boot } = await import("lfaa-app-boot/src/index.js");
  const ctx = await boot(["web"]);
  const activeRunIds = [];
  let owner;
  try {
    const { createAiPluginHost } = await import("lfaa-app-boot/src/ai-host.js");
    const settings = await import("lfaa-settings/src/service.js");
    const runs = await import("lfaa-agent-loop/src/runs.js");
    const sessions = await import("lfaa-session/src/sessions.js");
    const { database } = await import("lfaa-storage-sqlite/src/database.js");
    const agentGit = await import("lfaa-workspace-agent-git");
    const permissions = await import("lfaa-permission-presets/src/permissions.js");
    const sse = delta => new Response(`data: ${JSON.stringify({ choices: [{ delta }], usage: { prompt_tokens: 1, completion_tokens: 1 } })}\n\ndata: [DONE]\n\n`, { headers: { "Content-Type": "text/event-stream" } });
    const toolCall = (name, args) => sse({ tool_calls: [{ index: 0, id: randomUUID(), type: "function", function: { name, arguments: JSON.stringify(args) } }] });
    t.mock.method(globalThis, "fetch", async (url, options) => {
      if (new URL(String(url)).pathname.endsWith("/models")) return Response.json({ data: [{ id: "fixture-model", context_window: 32768 }] });
      const body = JSON.parse(options.body);
      const prompt = body.messages.find(message => message.role === "user")?.content ?? "";
      if (String(prompt).startsWith("external-permission-bridge-")) {
        if (body.messages.some(message => message.role === "tool")) return sse({ content: "已收到外部 Agent 的实际授权结果" });
        const decision = String(prompt).endsWith("deny") ? "deny" : "allow";
        return toolCall("lfaa_delegate_subagent", {
          driver: "claude-code", description: `逐动作权限 ${decision}`, prompt: `外部动作 ${decision}`, mode: "foreground"
        });
      }
      return sse({ content: "隔离任务已完成" });
    });
    owner = randomUUID();
    database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role) VALUES(?,?,?,'fixture','fixture','admin')")
      .run(owner, 401, "agent-permission-bridge");
    const account = await settings.saveAiAccount(owner, {
      providerId: "openai", secret: "fixture-invalid-key", options: {}, displayName: "隔离模型", modelId: "fixture-model", reasoningMode: "default"
    });
    settings.activateAiAccount(owner, account.id);
    settings.savePluginCredentialRecord(owner, {
      providerId: "lfaa-subagent-claude-code",
      id: "anthropic-console-api-key"
    }, { kind: "api-key", key: "sk-ant-isolated-test-key" });
    assert.equal(settings.readPluginCredentialRecord(owner, {
      providerId: "lfaa-subagent-claude-code",
      id: "anthropic-console-api-key"
    })?.kind, "api-key", "隔离 API Key 应写入 Settings Owner 的加密凭据记录");
    assert.equal(ctx.lfaaSubagentClaudeCode.getCredentialStatus(owner).configured, true, "隔离账户应通过既有 Settings/Credentials Owner 读回测试密钥状态");
    settings.saveUserSettings(owner, "permissions", { ...settings.defaultSettings.permissions, mode: "ask" });
    settings.saveUserSettings(owner, "general", { ...settings.defaultSettings.general, taskFolder: testData });
    settings.saveUserSettings(owner, "ai-runtime", { ...settings.defaultSettings.aiRuntime, requestRetries: 0, executionSandboxMode: "danger-full-access" });
    const repository = agentGit.registerAgentGitRepository({ userId: owner, path: testData, title: "隔离 AgentGit" });
    let sideEffects = 0;
    ctx.lfaaTools.registerTool(ctx, {
      id: "fixture.external-bridge",
      name: "lfaa_external_permission_bridge_probe",
      coreManaged: true,
      applicationIds: ["workspace"],
      description: "测试用写入工具：只记录已授权的隔离标记。",
      schema: { type: "object", properties: { marker: { type: "string", minLength: 1, maxLength: 80 } }, required: ["marker"], additionalProperties: false },
      parse(value) {
        if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.marker !== "string" || !value.marker || value.marker.length > 80 || Object.keys(value).length !== 1) throw new Error("marker 参数无效。");
        return { marker: value.marker };
      },
      risk: () => "write",
      approval: parameters => ({ scopeKey: `fixture:${parameters.marker}`, scopeSummary: `隔离标记 · ${parameters.marker}`, summary: `写入隔离标记 · ${parameters.marker}` }),
      async execute(parameters) { sideEffects += 1; return { accepted: true, marker: parameters.marker }; }
    });
    const host = createAiPluginHost(ctx);

    // SDK Hook 单测验证 SDK 回调；此 driver 专门验证 Agent Loop 到真实 Permission Owner 的 wiring。
    ctx.lfaaSubagents.close();
    ctx.lfaaSubagents.registerDriver({
      name: "claude-code",
      displayName: "隔离 Claude SDK driver",
      async run(task, driverContext) {
        driverContext.onTextDelta?.("Claude 子 Agent 临时文本片段");
        const selectedTool = driverContext.tools?.find(tool => tool.name === "lfaa_external_permission_bridge_probe");
        assert.ok(selectedTool, "Claude 外部驱动应只收到父 Run 的继承工具合同");
        assert.deepEqual(selectedTool.inputSchema, {
          type: "object",
          properties: { marker: { type: "string", minLength: 1, maxLength: 80 } },
          required: ["marker"],
          additionalProperties: false
        });
        const result = await driverContext.executeTool({
          toolName: selectedTool.name,
          arguments: { marker: task.prompt },
          signal: driverContext.signal
        });
        return {
          runId: "", stopReason: result.isError ? "error" : "completed", answer: result.isError ? "动作已拒绝" : "动作已授权", modelRequestsUsed: 0,
          modelUsage: [
            { providerId: "anthropic", modelId: "claude-fixture", promptTokens: 13, completionTokens: 5, cacheReadTokens: 4 },
            { providerId: "anthropic", modelId: "claude-helper-fixture", promptTokens: 2, completionTokens: 1, cacheReadTokens: 0 }
          ]
        };
      }
    });

    const waitFor = async (read, label) => {
      const deadline = Date.now() + 15_000;
      while (Date.now() < deadline) {
        const value = read();
        if (value) return value;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      throw new Error(`${label}等待超时；审批=${JSON.stringify(permissions.listAiToolApprovals(owner))}；Run=${JSON.stringify(activeRunIds.map(id => runs.getAiRun(owner, id)))}`);
    };
    const runScenario = async decision => {
      const start = runs.startAiRun(owner, "admin", {
        appId: "workspace", sessionId: null, gitRepositoryId: repository.id, content: `external-permission-bridge-${decision}`
      }, host, { allowedToolNames: ["lfaa_delegate_subagent", "lfaa_external_permission_bridge_probe"] });
      activeRunIds.push(start.id);
      const subagentDeltas = [];
      const unsubscribe = runs.subscribeAiRun(owner, start.id, (event, data) => {
        if (event === "subagent-delta") subagentDeltas.push(data);
      });

      try {
        const outer = await waitFor(() => permissions.listAiToolApprovals(owner, "pending").find(item => item.toolId === "subagent.delegate"), "外层委派审批");
        assert.match(outer.summary, /发送给 Anthropic/u);
        assert.equal(permissions.decideAiToolApproval(owner, outer.id, "approved", false)?.status, "approved");
        ctx.lfaaUserApproval.notify(owner, outer.id);

        const action = await waitFor(() => permissions.listAiToolApprovals(owner, "pending").find(item => item.toolId === "fixture.external-bridge"), "Agent Loop 共享 dispatch 工具审批");
        assert.match(action.scopeSummary, /隔离标记/u);
        assert.match(action.summary, /写入隔离标记/u);
        const expectedStatus = decision === "deny" ? "denied" : "approved";
        assert.equal(permissions.decideAiToolApproval(owner, action.id, decision === "deny" ? "denied" : "approved", false)?.status, expectedStatus);
        ctx.lfaaUserApproval.notify(owner, action.id);

        const run = await waitFor(() => {
          const current = runs.getAiRun(owner, start.id);
          return current && current.status !== "streaming" ? current : null;
        }, "Run 完成");
        return { run, subagentDeltas };
      } finally { unsubscribe(); }
    };

    const approved = await runScenario("allow");
    assert.equal(approved.run.status, "complete");
    assert.equal(approved.subagentDeltas.length, 1, "外部子 Agent 文本应通过父 Run 的瞬时事件通道转发");
    assert.equal(approved.subagentDeltas[0].messageId, activeRunIds[0]);
    assert.equal(approved.subagentDeltas[0].delta, "Claude 子 Agent 临时文本片段");
    assert.equal(typeof approved.subagentDeltas[0].activityId, "string");
    const approvedUsage = sessions.getAiSessionTokenUsageSummary(owner, approved.run.sessionId);
    const childUsage = approvedUsage.models.find(model => model.providerId === "anthropic" && model.modelId === "claude-fixture");
    assert.deepEqual({ promptTokens: childUsage?.promptTokens, completionTokens: childUsage?.completionTokens, cacheReadTokens: childUsage?.cacheReadTokens }, {
      promptTokens: 13, completionTokens: 5, cacheReadTokens: 4
    }, "外部子 Agent token 应进入 Session 累计用量");
    assert.ok(approvedUsage.models.some(model => model.providerId === "anthropic" && model.modelId === "claude-helper-fixture" && model.promptTokens === 2), "同一 SDK 汇总中的多模型 token 都应保留");
    const page = await sessions.getAiSessionMessagesPage(owner, approved.run.sessionId, undefined, 50);
    assert.ok(page);
    assert.ok(page.usageSummary.models.some(model => model.providerId === "anthropic" && model.modelId === "claude-fixture"), "Session 分页摘要应保留子 Agent 用量");
    const runMessage = page.messages.find(message => message.id === approved.run.message.id);
    assert.equal(runMessage?.usage?.providerId, "openai", "子 Agent token 不得覆盖父助手消息的单轮 Provider 用量");
    assert.equal(sideEffects, 1, "批准动作才进入真实注册工具执行器");
    const denied = await runScenario("deny");
    assert.equal(denied.run.status, "complete");
    assert.equal(denied.subagentDeltas.length, 1);
    assert.equal(sideEffects, 1, "拒绝动作不得进入真实注册工具执行器");
  } finally {
    const runs = await import("lfaa-agent-loop/src/runs.js");
    if (owner) for (const runId of activeRunIds) runs.cancelAiRun(owner, runId);
    ctx.lfaaSubagents.close();
    await ctx.fiber.dispose();
  }
});
