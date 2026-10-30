import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const testRoot = fileURLToPath(new URL("../../../dist/.tmp/", import.meta.url));
mkdirSync(testRoot, { recursive: true });
const testData = mkdtempSync(join(testRoot, "lfaa-claude-sdk-permissions-"));
const repoPath = resolve(testData, "repo");
mkdirSync(repoPath);
test.after(() => rmSync(testData, { recursive: true, force: true }));

const {
  classifyClaudeToolRisk,
  createClaudeCodeDriver,
  createClaudeAgentCredentialOwner,
  createClaudePermissionCallbacks
} = await import("lfaa-subagent-claude-code/src/index.js");
const { SubagentManager } = await import("lfaa-subagent/src/manager.js");

const hookInput = (toolName, toolInput, id = "tool-call-1") => ({
  hook_event_name: "PreToolUse",
  tool_name: toolName,
  tool_input: toolInput,
  tool_use_id: id
});
const inheritedTools = [{ name: "fixture_probe", description: "回归用继承工具", inputSchema: { type: "object", properties: {}, additionalProperties: false } }];
const executeInheritedTool = async () => ({ content: [{ type: "text", text: "fixture observation" }] });

test("Claude SDK 所有 PreToolUse 动作分类并进入 LFAA 授权桥", async () => {
  assert.equal(classifyClaudeToolRisk("Read"), "read");
  assert.equal(classifyClaudeToolRisk("Write"), "write");
  assert.equal(classifyClaudeToolRisk("Bash"), "dangerous");
  assert.equal(classifyClaudeToolRisk("mcp__unknown__update"), "dangerous");

  const requests = [];
  const callbacks = createClaudePermissionCallbacks({
    repositoryId: "repo-1",
    workingDirectory: repoPath,
    taskDescription: "更新模块",
    authorizeAction: async request => { requests.push(request); return true; }
  });
  const signal = new AbortController().signal;
  const input = hookInput("Write", { file_path: join(repoPath, "src", "main.ts"), content: "ok" });
  const decision = await callbacks.preToolUse(input, input.tool_use_id, { signal });
  assert.equal(decision.hookSpecificOutput.permissionDecision, "allow");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].risk, "write");
  assert.match(requests[0].scopeSummary, /src/u);
  assert.equal(requests[0].toolVersion, "claude-agent-sdk/0.3.310");
  assert.equal(requests[0].parameters.repositoryId, "repo-1");
  assert.equal(requests[0].signal, signal);

  const sdkDecision = await callbacks.canUseTool("Write", input.tool_input, { signal });
  assert.equal(sdkDecision.behavior, "allow");
  assert.deepEqual(sdkDecision.updatedInput, input.tool_input);
  const unmatched = await callbacks.canUseTool("Write", { file_path: join(repoPath, "other.ts") }, { signal });
  assert.equal(unmatched.behavior, "deny");
});

test("LFAA 拒绝或取消时 Hook 失败关闭，canUseTool 不能补发授权", async () => {
  const signal = new AbortController().signal;
  const deniedCallbacks = createClaudePermissionCallbacks({
    repositoryId: "repo-1",
    workingDirectory: repoPath,
    taskDescription: "拒绝测试",
    authorizeAction: async () => false
  });
  const deniedInput = hookInput("Bash", { command: "git status" });
  const denied = await deniedCallbacks.preToolUse(deniedInput, deniedInput.tool_use_id, { signal });
  assert.equal(denied.hookSpecificOutput.permissionDecision, "deny");
  assert.equal((await deniedCallbacks.canUseTool("Bash", deniedInput.tool_input, { signal })).behavior, "deny");

  const controller = new AbortController();
  const cancelledCallbacks = createClaudePermissionCallbacks({
    repositoryId: "repo-1",
    workingDirectory: repoPath,
    taskDescription: "取消测试",
    authorizeAction: async request => {
      assert.equal(request.signal.aborted, false);
      controller.abort();
      return true;
    }
  });
  const cancelledInput = hookInput("Read", { file_path: join(repoPath, "README.md") });
  const cancelled = await cancelledCallbacks.preToolUse(cancelledInput, cancelledInput.tool_use_id, { signal: controller.signal });
  assert.equal(cancelled.hookSpecificOutput.permissionDecision, "deny");
});

test("未注入 LFAA Anthropic API Key 凭据时 Agent SDK 不可用，Manager 不会启动本机登录", async () => {
  let queryCalls = 0;
  const manager = new SubagentManager();
  const driver = createClaudeCodeDriver(() => { queryCalls += 1; throw new Error("不能调用 query"); });
  assert.equal(driver.available, false);
  assert.match(driver.unavailableReason, /Anthropic Console API Key/u);
  manager.registerDriver(driver);
  assert.throws(() => manager.start(
    { driver: "claude-code", description: "认证前置", prompt: "fixture", appId: "workspace" },
    { userId: "fixture-user", userRole: "user", signal: new AbortController().signal, onProgress() {} }
  ), /Anthropic Console API Key/u);
  assert.equal(queryCalls, 0);
  manager.close();
});

test("Claude 凭据 Owner 先验证 Console Key，再用加密记录合同保存且不回显秘密", async () => {
  const records = new Map();
  const commits = [];
  const recordKey = (userId, reference) => `${userId}:${reference.providerId}/${reference.id}`;
  const registry = {
    commitRecord(caller, userId, reference, record) {
      commits.push({ caller, userId, reference, record });
      records.set(recordKey(userId, reference), { kind: record.kind, updatedAt: "2026-10-27T00:00:00.000Z" });
    },
    deleteRecord(_caller, userId, reference) { return records.delete(recordKey(userId, reference)); }
  };
  const consumer = {
    describeRecord(userId, reference) { return records.get(recordKey(userId, reference)) ?? null; },
    readRecord() { return null; }
  };
  let request;
  const owner = createClaudeAgentCredentialOwner({}, registry, consumer, async (url, init) => {
    request = { url, init };
    return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { "content-type": "application/json" } });
  });
  const secret = "sk-ant-test-key";

  assert.deepEqual(owner.getCredentialStatus("account-a"), { configured: false });
  const status = await owner.verifyAndSaveCredential("account-a", ` ${secret} `);
  assert.equal(request.url, "https://api.anthropic.com/v1/models?limit=1");
  assert.equal(request.init.headers["x-api-key"], secret);
  assert.equal(request.init.headers["anthropic-version"], "2023-06-01");
  assert.equal(commits.length, 1);
  assert.equal(commits[0].userId, "account-a");
  assert.equal(commits[0].reference.providerId, "lfaa-subagent-claude-code");
  assert.equal(commits[0].reference.id, "anthropic-console-api-key");
  assert.deepEqual(status, { configured: true, updatedAt: "2026-10-27T00:00:00.000Z" });
  assert.equal(JSON.stringify(status).includes(secret), false);
  assert.deepEqual(owner.getCredentialStatus("account-b"), { configured: false });
  assert.equal(owner.deleteCredential("account-a"), true);
  assert.deepEqual(owner.getCredentialStatus("account-a"), { configured: false });

  const rejectedOwner = createClaudeAgentCredentialOwner({}, registry, consumer, async () => new Response("{}", { status: 401 }));
  await assert.rejects(rejectedOwner.verifyAndSaveCredential("account-a", secret), /Anthropic 拒绝/u);
  assert.equal(commits.length, 1, "验证失败不得进入凭据存储");
});

test("Anthropic Models API 验证限制响应大小并拒绝无效响应", async () => {
  const { verifyAnthropicConsoleApiKey } = await import("lfaa-subagent-claude-code/src/index.js");
  await assert.rejects(verifyAnthropicConsoleApiKey("sk-ant-test-key", async () => new Response("x".repeat(1_000_001))), /超过允许大小/u);
  await assert.rejects(verifyAnthropicConsoleApiKey("sk-ant-test-key", async () => new Response("not json")), /响应无效/u);
  await assert.rejects(verifyAnthropicConsoleApiKey("sk-ant-test-key", async () => new Response(JSON.stringify({ data: [] }), { status: 403 })), /拒绝了 API Key/u);
});

test("Agent SDK 只接收单次 relay token、使用临时配置目录和绑定 cwd", async () => {
  let captured;
  let closeCalls = 0;
  let executableResolverCalls = 0;
  const verifiedExecutablePath = join(repoPath, "verified-claude.exe");
  const fakeQuery = input => {
    captured = input;
    return {
      async *[Symbol.asyncIterator]() {
        yield {
          type: "result", subtype: "success", is_error: false, num_turns: 2, result: "完成",
          modelUsage: {
            "claude-sonnet-4-5": { inputTokens: 4, cacheReadInputTokens: 3, cacheCreationInputTokens: 2, outputTokens: 8, costUSD: 0.001 },
            "claude-haiku-4-5": { inputTokens: 2, cacheReadInputTokens: 0, cacheCreationInputTokens: 1, outputTokens: 3 }
          }
        };
      },
      close() { closeCalls += 1; }
    };
  };
  const driver = createClaudeCodeDriver(fakeQuery, 1000, async userId => {
    assert.equal(userId, "fixture-user");
    return "sk-ant-test-key";
  }, fetch, async ({ signal }) => {
    executableResolverCalls += 1;
    assert.equal(signal.aborted, false);
    return verifiedExecutablePath;
  });
  const result = await driver.run(
    { driver: "claude-code", description: "验证配置", prompt: "fixture", appId: "workspace" },
    {
      userId: "fixture-user",
      userRole: "user",
      signal: new AbortController().signal,
      workingDirectory: repoPath,
      repositoryId: "repo-1",
      maxModelRequests: 3,
      authorizeAction: async () => true,
      tools: inheritedTools,
      executeTool: executeInheritedTool,
      onProgress() {}
    }
  );

  assert.equal(result.stopReason, "completed");
  assert.equal(result.answer, "完成");
  assert.equal(result.modelRequestsUsed, 2);
  assert.deepEqual(result.modelUsage, [
    { providerId: "anthropic", modelId: "claude-sonnet-4-5", promptTokens: 9, completionTokens: 8, cacheReadTokens: 3 },
    { providerId: "anthropic", modelId: "claude-haiku-4-5", promptTokens: 3, completionTokens: 3, cacheReadTokens: 0 }
  ], "Session 记账使用 SDK 分模型实际 token，prompt 包含普通输入与缓存读写；估算费用不透传");
  assert.equal(captured.options.cwd, repoPath);
  assert.equal(executableResolverCalls, 1);
  assert.equal(captured.options.pathToClaudeCodeExecutable, verifiedExecutablePath, "查询必须启动完整性校验后的缓存可执行文件");
  assert.notEqual(captured.options.env.ANTHROPIC_API_KEY, "sk-ant-test-key");
  assert.match(captured.options.env.ANTHROPIC_API_KEY, /^[A-Za-z0-9_-]{40,}$/u);
  assert.match(captured.options.env.ANTHROPIC_BASE_URL, /^http:\/\/127\.0\.0\.1:\d+$/u);
  assert.equal(JSON.stringify(captured.options.env).includes("sk-ant-test-key"), false, "the credential must stay in the Host LLM transport");
  assert.match(captured.options.env.CLAUDE_CONFIG_DIR, /lfaa-claude-sdk-/u);
  assert.equal(captured.options.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC, "1", "SDK telemetry, error reporting, auto-update and feedback traffic must stay disabled");
  assert.equal(existsSync(captured.options.env.CLAUDE_CONFIG_DIR), false);
  assert.equal(captured.options.maxTurns, 3);
  assert.equal(captured.options.systemPrompt.type, "preset");
  assert.match(captured.options.systemPrompt.append, /LFAA Permission Owner/u);
  assert.deepEqual(captured.options.settingSources, []);
  assert.deepEqual(captured.options.plugins, []);
  assert.deepEqual(captured.options.skills, []);
  assert.equal(captured.options.strictMcpConfig, true);
  assert.equal(captured.options.permissionMode, "default");
  assert.equal(captured.options.permissionPrompts, "host");
  assert.deepEqual(captured.options.tools, [], "SDK built-in tools must stay disabled");
  assert.deepEqual(Object.keys(captured.options.mcpServers), ["lfaa"], "the SDK receives only the in-process inherited LFAA MCP server");
  assert.equal(captured.options.hooks.PreToolUse.length, 1);
  assert.equal(captured.options.hooks.PreToolUse[0].matcher, undefined);
  assert.equal(typeof captured.options.canUseTool, "function");
  assert.equal(captured.options.allowedTools, undefined);
  assert.equal(captured.options.allowDangerouslySkipPermissions, undefined);
  assert.equal(closeCalls, 1);
});

test("Claude 可执行文件下载在凭据校验之前不得启动", async () => {
  let executableResolverCalls = 0;
  const driver = createClaudeCodeDriver(
    () => { throw new Error("query must not start"); },
    1000,
    async () => null,
    fetch,
    async () => { executableResolverCalls += 1; return join(repoPath, "verified-claude.exe"); }
  );
  const result = await driver.run(
    { driver: "claude-code", description: "无凭据测试", prompt: "fixture", appId: "workspace" },
    {
      userId: "fixture-user",
      userRole: "user",
      signal: new AbortController().signal,
      workingDirectory: repoPath,
      repositoryId: "repo-1",
      maxModelRequests: 3,
      authorizeAction: async () => true,
      tools: inheritedTools,
      executeTool: executeInheritedTool,
      onProgress() {}
    }
  );
  assert.equal(result.stopReason, "error");
  assert.match(result.diagnostic ?? "", /Anthropic Console API Key/u);
  assert.equal(executableResolverCalls, 0);
});

test("Claude SDK 只把脱敏后的顶层文本增量发到临时 Run 通道", async () => {
  const secret = "sk-ant-stream-fixture-key";
  let captured;
  const deltas = [];
  const textEvent = (text, parent_tool_use_id = null) => ({
    type: "stream_event",
    parent_tool_use_id,
    event: { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } }
  });
  const fakeQuery = input => {
    captured = input;
    return {
      async *[Symbol.asyncIterator]() {
        yield textEvent("处理中：");
        yield { type: "stream_event", parent_tool_use_id: null, event: { type: "content_block_delta", index: 1, delta: { type: "thinking_delta", thinking: "隐藏推理" } } };
        yield { type: "stream_event", parent_tool_use_id: null, event: { type: "content_block_delta", index: 2, delta: { type: "input_json_delta", partial_json: "秘密参数" } } };
        yield textEvent("凭据 ");
        yield textEvent(secret);
        yield textEvent(" 不回显", "toolu_nested_agent");
        yield textEvent("已脱敏");
        yield { type: "result", subtype: "success", is_error: false, num_turns: 1, result: "最终完成" };
      },
      close() {}
    };
  };
  const driver = createClaudeCodeDriver(fakeQuery, 1000, async () => secret);
  const result = await driver.run(
    { driver: "claude-code", description: "验证外部流式文本", prompt: "fixture", appId: "workspace" },
    {
      userId: "fixture-user",
      userRole: "user",
      signal: new AbortController().signal,
      workingDirectory: repoPath,
      repositoryId: "repo-1",
      maxModelRequests: 2,
      authorizeAction: async () => true,
      tools: inheritedTools,
      executeTool: executeInheritedTool,
      onProgress() {},
      onTextDelta: delta => deltas.push(delta)
    }
  );

  assert.equal(result.stopReason, "completed");
  assert.equal(captured.options.includePartialMessages, true);
  const preview = deltas.join("");
  assert.match(preview, /处理中：凭据 \[Anthropic API Key 已脱敏\]已脱敏/u);
  assert.equal(preview.includes(secret), false);
  assert.equal(preview.includes("隐藏推理"), false);
  assert.equal(preview.includes("秘密参数"), false);
  assert.equal(preview.includes("不回显"), false);
});

test("Claude SDK 不会把当前账户 API Key 回显到最终回答或运行诊断", async () => {
  const secret = "sk-ant-private-fixture-key";
  const context = {
    userId: "fixture-user",
    userRole: "user",
    signal: new AbortController().signal,
    workingDirectory: repoPath,
    repositoryId: "repo-1",
    maxModelRequests: 2,
    authorizeAction: async () => true,
    tools: inheritedTools,
    executeTool: executeInheritedTool,
    onProgress() {}
  };
  const run = async queryResult => {
    const driver = createClaudeCodeDriver(() => ({
      async *[Symbol.asyncIterator]() {
        if (queryResult instanceof Error) throw queryResult;
        yield queryResult;
      },
      close() {}
    }), 1000, async () => secret);
    return driver.run(
      { driver: "claude-code", description: "验证凭据脱敏", prompt: "fixture", appId: "workspace" },
      context
    );
  };

  const answer = await run({ type: "result", subtype: "success", is_error: false, num_turns: 1, result: `已处理 ${secret}` });
  assert.equal(answer.stopReason, "completed");
  assert.equal(answer.answer.includes(secret), false);
  assert.match(answer.answer, /\[Anthropic API Key 已脱敏\]/u);

  const sdkFailure = await run({ type: "result", subtype: "error_during_execution", is_error: true, num_turns: 1, result: `Provider rejected ${secret}` });
  assert.equal(sdkFailure.stopReason, "error");
  assert.equal(sdkFailure.diagnostic.includes(secret), false);

  const transportFailure = await run(new Error(`SDK transport echoed ${secret}`));
  assert.equal(transportFailure.stopReason, "error");
  assert.equal(transportFailure.diagnostic.includes(secret), false);
});

test("父 Run 取消会调用 SDK close 并结束为 aborted", async () => {
  const controller = new AbortController();
  let closeCalls = 0;
  let captured;
  let resumeIterator;
  let markStarted;
  const queryStarted = new Promise(resolvePromise => { markStarted = resolvePromise; });
  const fakeQuery = input => {
    captured = input;
    markStarted();
    return {
    async *[Symbol.asyncIterator]() {
      await new Promise(resolvePromise => { resumeIterator = resolvePromise; });
    },
    close() {
      closeCalls += 1;
      resumeIterator?.();
    }
    };
  };
  const driver = createClaudeCodeDriver(fakeQuery, 10000, async () => "sk-ant-test-key");
  const pending = driver.run(
    { driver: "claude-code", description: "取消测试", prompt: "fixture", appId: "workspace" },
    {
      userId: "fixture-user",
      userRole: "user",
      signal: controller.signal,
      workingDirectory: repoPath,
      repositoryId: "repo-1",
      maxModelRequests: 3,
      authorizeAction: async () => true,
      tools: inheritedTools,
      executeTool: executeInheritedTool,
      onProgress() {}
    }
  );
  await queryStarted;
  controller.abort();
  const result = await pending;
  assert.equal(result.stopReason, "aborted");
  assert.ok(closeCalls >= 1);
  assert.equal(existsSync(captured.options.env.CLAUDE_CONFIG_DIR), false);
});
