/**
 * 功能：回归 MCP 端点经通用能力工具进入账户设置并由实际 Runtime 消费。
 * 作用：验证来源摘要固定、目标 App 隔离、扩展开关尊重和 MCP 工具合同变更 fail closed。
 * 关联文件：packages/boot/capability-mcp/src/index.ts、packages/core/tools/src/mcp-tools.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { CapabilityInstallRegistry } from "lfaa-capability-installs/src/index.js";
import { createMcpCapabilityAdapter } from "lfaa-capability-mcp/src/index.js";
import { discoverMcpTools } from "lfaa-tools/src/mcp-tools.js";

function settings(enabled = true) {
  return { plugins: { enabled, mcpServers: [] }, aiRuntime: { requestTimeoutSeconds: 5 } };
}

function makeContext(userId = "user-1", applicationId = "workspace") {
  return { userId, userRole: "member", applicationId, signal: new AbortController().signal, onProgress() {} };
}

test("MCP 来源经真实协议检查后安装到单一 App，并由同一 Runtime 核对工具清单", async () => {
  let remoteTools = [{ name: "read_status", description: "读取当前状态", inputSchema: { type: "object", properties: {}, additionalProperties: false } }];
  const calls = [];
  const server = createServer(async (request, response) => {
    if (request.method === "DELETE") { response.writeHead(204).end(); return; }
    let bodyText = "";
    for await (const chunk of request) bodyText += chunk;
    const body = JSON.parse(bodyText);
    calls.push(body.method);
    const send = result => {
      response.writeHead(200, { "Content-Type": "application/json", ...(body.method === "initialize" ? { "MCP-Session-Id": "fixture-session" } : {}) });
      response.end(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }));
    };
    if (body.method === "initialize") { send({ protocolVersion: "2025-11-25", capabilities: { tools: {} }, serverInfo: { name: "fixture", version: "1" } }); return; }
    if (body.method === "notifications/initialized") { response.writeHead(202).end(); return; }
    if (body.method === "tools/list") { send({ tools: remoteTools }); return; }
    response.writeHead(404).end();
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = "http://127.0.0.1:" + server.address().port + "/mcp";
  const users = new Map([["user-1", settings(true)], ["user-2", settings(true)]]);
  const registry = new CapabilityInstallRegistry();
  registry.register({ effect(callback) { return callback(); } }, createMcpCapabilityAdapter({
    getSettings: userId => users.get(userId) ?? settings(),
    saveSettings(userId, category, value) {
      assert.equal(category, "plugins");
      const current = users.get(userId) ?? settings();
      users.set(userId, { ...current, plugins: structuredClone(value) });
    }
  }));
  const context = makeContext();
  try {
    const search = await registry.search("mcp", url, "workspace", context);
    assert.equal(search.candidates[0].source, url);
    assert.equal(search.candidates[0].requiresInspection, true);
    const inspected = await registry.inspect("mcp", url, undefined, "workspace", { name: "测试服务" }, context);
    assert.match(inspected.resolvedRef, /^tools-sha256:[a-f0-9]{64}$/u);
    assert.equal(inspected.details.mcp.toolCount, 1);
    assert.equal(inspected.details.mcp.remoteImplementationPinned, false);
    assert.equal(calls.includes("tools/call"), false, "来源检查不得执行 MCP 工具");

    const installed = await registry.install("mcp", inspected.inspectionId, "workspace", "user-1", context);
    assert.equal(installed.outcome, "verified_ready");
    assert.equal(installed.verification.details.runtimeEnabled, true);
    const entry = users.get("user-1").plugins.mcpServers[0];
    assert.equal(entry.enabled, true);
    assert.deepEqual(entry.applicationIds, ["workspace"]);
    assert.equal(entry.manifestSha256, inspected.details.mcp.manifestSha256);
    assert.deepEqual(users.get("user-2").plugins.mcpServers, [], "安装只写当前用户的设置");

    const runtime = await discoverMcpTools(users.get("user-1").plugins.mcpServers, "workspace", new AbortController().signal, 5);
    try {
      assert.equal(runtime.errors.length, 0);
      assert.equal(runtime.tools.length, 1);
      assert.equal(runtime.serverStates[0].status, "ready");
      assert.equal(runtime.serverStates[0].manifestSha256, entry.manifestSha256);
    } finally { await runtime.close(); }

    const writingContext = makeContext("user-1", "writing");
    const otherAppInspection = await registry.inspect("mcp", url, undefined, "writing", { name: "测试服务" }, writingContext);
    await assert.rejects(
      registry.install("mcp", otherAppInspection.inspectionId, "writing", "user-1", writingContext),
      /不会覆盖或扩大既有设置/u
    );
    assert.deepEqual(entry.applicationIds, ["workspace"], "重复来源不得扩大到另一个 App");

    remoteTools = [{ name: "read_status", description: "变化后的说明", inputSchema: { type: "object", properties: { detail: { type: "boolean" } }, additionalProperties: false } }];
    const drifted = await discoverMcpTools(users.get("user-1").plugins.mcpServers, "workspace", new AbortController().signal, 5);
    try {
      assert.equal(drifted.tools.length, 0, "远端工具合同变化后不能把工具交给模型");
      assert.equal(drifted.serverStates[0].status, "incompatible");
      assert.match(drifted.errors[0], /SHA-256 不一致/u);
    } finally { await drifted.close(); }

    remoteTools = [{ name: "read_status", description: "读取当前状态", inputSchema: { type: "object", properties: {}, additionalProperties: false } }];
    users.get("user-1").plugins.enabled = false;
    const relabeledInspection = await registry.inspect("mcp", url, inspected.resolvedRef, "workspace", { name: "测试服务" }, context);
    const gated = await registry.install("mcp", relabeledInspection.inspectionId, "workspace", "user-1", context);
    assert.equal(gated.outcome, "verified_installed");
    assert.equal(gated.verification.status, "installed");
    assert.equal(users.get("user-1").plugins.enabled, false, "安装不能替用户打开全局扩展开关");
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
