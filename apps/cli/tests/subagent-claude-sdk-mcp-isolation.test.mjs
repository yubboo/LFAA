import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const testRoot = resolve(fileURLToPath(new URL("../../../dist/.tmp/", import.meta.url)));
mkdirSync(testRoot, { recursive: true });
const testData = mkdtempSync(join(testRoot, "lfaa-claude-sdk-mcp-isolation-"));
test.after(() => {
  const resolvedData = resolve(testData);
  if (dirname(resolvedData) !== testRoot || !basename(resolvedData).startsWith("lfaa-claude-sdk-mcp-isolation-")) throw new Error("拒绝清理隔离根以外的路径。");
  rmSync(resolvedData, { recursive: true, force: true, maxRetries: 8, retryDelay: 100 });
});

const claudePackageEntry = import.meta.resolve("lfaa-subagent-claude-code/src/index.js");
const requireFromClaudePackage = createRequire(claudePackageEntry);
const sdkEntryPath = requireFromClaudePackage.resolve("@anthropic-ai/claude-agent-sdk");
const { query } = await import(pathToFileURL(sdkEntryPath).href);
const { createClaudeCodeDriver, createClaudeLfaaMcpServer, createClaudePermissionCallbacks } = await import("lfaa-subagent-claude-code/src/index.js");
const { ANTHROPIC_MESSAGES_ENDPOINT } = await import("lfaa-llm/src/anthropic-messages.js");

function messageStart(id) {
  return { type: "message_start", message: { id, type: "message", role: "assistant", model: "claude-test-model", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } };
}

function toolUseEvents() {
  return [
    messageStart("msg_tool"),
    { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "toolu_lfaa_probe", name: "mcp__lfaa__confirm_parent", input: {} } },
    { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: JSON.stringify({ marker: "from-model" }) } },
    { type: "content_block_stop", index: 0 },
    { type: "message_delta", delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 1 } },
    { type: "message_stop" }
  ];
}

function finalAnswerEvents() {
  return [
    messageStart("msg_final"),
    { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "LFAA MCP observation received" } },
    { type: "content_block_stop", index: 0 },
    { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 5 } },
    { type: "message_stop" }
  ];
}

function writeSse(response, events) {
  response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
  for (const event of events) response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  response.end();
}

test("Claude SDK 仅暴露父 Agent Loop 的 MCP Schema，并将 action 与 observation 配对", { timeout: 30_000 }, async t => {
  const requests = [];
  const requestRoutes = [];
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    requests.push(body);
    requestRoutes.push({ method: request.method, url: request.url });
    if (requests.length === 1) writeSse(response, toolUseEvents());
    else writeSse(response, finalAnswerEvents());
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const fakeApiKey = "sk-ant-contract-test-only";
  const parentPid = process.pid;
  let observedToolExecution;
  const authorizations = [];
  const callbacks = createClaudePermissionCallbacks({
    repositoryId: "fixture-repository",
    workingDirectory: testData,
    taskDescription: "验证 SDK 进程隔离",
    authorizeAction: async request => { authorizations.push(request); return false; },
    managedToolNames: new Set(["mcp__lfaa__confirm_parent"])
  });
  const mcp = createClaudeLfaaMcpServer({
    tools: [{
      name: "confirm_parent",
      description: "Return an observation from the LFAA Agent Loop.",
      inputSchema: { type: "object", properties: { marker: { type: "string" } }, required: ["marker"], additionalProperties: false }
    }],
    signal: new AbortController().signal,
    executeTool: async ({ toolName, arguments: input }) => {
      assert.equal(toolName, "confirm_parent");
    observedToolExecution = {
      input,
      pid: process.pid,
      hasChildApiKey: process.env.ANTHROPIC_API_KEY === fakeApiKey
    };
      return { content: [{ type: "text", text: "parent observation confirmed" }] };
    }
  });
  let running;

  try {
    running = query({
      prompt: "Call the LFAA MCP probe once, then report its result.",
      options: {
        cwd: testData,
        env: {
          PATH: process.env.PATH ?? "",
          ...(process.env.SYSTEMROOT ? { SYSTEMROOT: process.env.SYSTEMROOT } : {}),
          ...(process.env.TEMP ? { TEMP: process.env.TEMP } : {}),
          ANTHROPIC_API_KEY: fakeApiKey,
          ANTHROPIC_BASE_URL: `http://127.0.0.1:${server.address().port}`,
          CLAUDE_CONFIG_DIR: join(testData, "claude-config"),
          CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1"
        },
        model: "claude-test-model",
        maxTurns: 2,
        tools: [],
        mcpServers: { lfaa: { type: "sdk", name: "lfaa", instance: mcp } },
        settingSources: [],
        strictMcpConfig: true,
        plugins: [],
        skills: [],
        permissionMode: "default",
        hooks: { PreToolUse: [{ hooks: [callbacks.preToolUse] }] },
        canUseTool: callbacks.canUseTool
      }
    });
    let finalResult;
    for await (const message of running) if (message.type === "result") finalResult = message;
    running.close();

    assert.equal(finalResult?.is_error, false, `${finalResult?.result} routes=${JSON.stringify(requestRoutes)}`);
    assert.deepEqual(requestRoutes, [
      { method: "POST", url: "/v1/messages?beta=true" },
      { method: "POST", url: "/v1/messages?beta=true" }
    ], "the relay must allow only the query parameter used by the locked SDK protocol");
    assert.match(finalResult?.result ?? "", /LFAA MCP observation received/u);
    assert.equal(requests.length, 2, "fake API should receive an initial tool request and one continuation");
    const advertisedTools = requests[0].tools?.map(item => item.name) ?? [];
    assert.deepEqual(advertisedTools.filter(name => name !== "DeferredToolPlaceholder"), ["mcp__lfaa__confirm_parent"], "tools: [] must omit executable Claude built-ins while exposing the in-process MCP tool");
    assert.equal(advertisedTools.some(name => ["Bash", "Read", "Write", "Edit"].includes(name)), false, "the SDK must not expose filesystem or shell built-ins");
    const declaredTool = requests[0].tools.find(item => item.name === "mcp__lfaa__confirm_parent");
    assert.deepEqual(declaredTool.input_schema, { type: "object", properties: { marker: { type: "string" } }, required: ["marker"], additionalProperties: false }, "MCP must preserve the parent Agent Loop JSON Schema");
    assert.equal(requests[1].messages.some(message => Array.isArray(message.content) && message.content.some(block => block.type === "tool_result" && block.tool_use_id === "toolu_lfaa_probe" && JSON.stringify(block).includes("parent observation confirmed"))), true, "MCP result must return as the matching tool observation");
    assert.deepEqual(observedToolExecution, { input: { marker: "from-model" }, pid: parentPid, hasChildApiKey: false }, "MCP callback runs in the host process, which never received the child-only fake key");
    assert.equal(authorizations.length, 0, "the MCP hook must not create a second generic approval; dispatch uses the parent tool's Permission Owner");
  } finally {
    try { running?.close(); } catch { /* Query close is best-effort after assertion failure. */ }
    await new Promise(resolve => server.close(resolve)).catch(() => undefined);
  }
});

test("Claude SDK 通过单次 Host relay 使用随机令牌，真实账户 Key 只到固定 Anthropic endpoint", { timeout: 30_000 }, async () => {
  const secret = "sk-ant-host-only-fixture-key";
  const apiRequests = [];
  let sdkEnvironment;
  const queryThroughRelay = input => {
    sdkEnvironment = input.options.env;
    return query(input);
  };
  const fetcher = async (url, init) => {
    apiRequests.push({ url, init });
    const requestBody = JSON.parse(Buffer.from(init.body).toString("utf8"));
    const events = finalAnswerEvents();
    events[0].message.model = requestBody.model;
    const sse = events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join("");
    return new Response(sse, { status: 200, headers: { "content-type": "text/event-stream" } });
  };
  const driver = createClaudeCodeDriver(queryThroughRelay, 15_000, async () => secret, fetcher);
  const result = await driver.run(
    { driver: "claude-code", description: "Host relay contract", prompt: "Return the final answer.", appId: "workspace" },
    {
      userId: "fixture-user",
      userRole: "user",
      signal: new AbortController().signal,
      workingDirectory: testData,
      repositoryId: "fixture-repository",
      maxModelRequests: 1,
      authorizeAction: async () => true,
      tools: [{ name: "fixture_tool", description: "unused", inputSchema: { type: "object", properties: {}, additionalProperties: false } }],
      executeTool: async () => ({ content: [{ type: "text", text: "unused" }] }),
      onProgress() {}
    }
  );

  assert.equal(result.stopReason, "completed", `${result.diagnostic ?? ""} requests=${JSON.stringify(apiRequests.map(request => ({ url: request.url, model: JSON.parse(Buffer.from(request.init.body).toString("utf8")).model })))} `);
  assert.match(result.answer, /LFAA MCP observation received/u);
  assert.equal(apiRequests.length, 1, "the real locked SDK should make one request through its configured base URL");
  assert.equal(apiRequests[0].url, ANTHROPIC_MESSAGES_ENDPOINT);
  assert.equal(apiRequests[0].init.method, "POST");
  assert.equal(apiRequests[0].init.redirect, "error");
  assert.equal(apiRequests[0].init.headers["x-api-key"], secret, "only the Host LLM transport receives the account key");
  const requestBody = JSON.parse(Buffer.from(apiRequests[0].init.body).toString("utf8"));
  assert.equal(requestBody.stream, true);
  assert.equal(sdkEnvironment.ANTHROPIC_BASE_URL.startsWith("http://127.0.0.1:"), true);
  assert.equal(sdkEnvironment.ANTHROPIC_API_KEY === secret, false);
  assert.match(sdkEnvironment.ANTHROPIC_API_KEY, /^[A-Za-z0-9_-]{40,}$/u, "the SDK receives only a fresh relay token");
  assert.equal(JSON.stringify(sdkEnvironment).includes(secret), false);
  assert.equal(sdkEnvironment.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC, "1");
});
