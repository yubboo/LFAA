/**
 * 功能：回归真实 HTTP MCP 工具适配器。
 * 作用：用仅限本机测试进程的协议服务器验证握手、分页、SSE、参数拒绝、错误回传、取消和会话关闭。
 * 关联文件：core/tools/mcp-tools.ts；测试服务不进入产品装配或发布目录。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { discoverMcpTools } from "lfaa-tools/src/mcp-tools.js";

test("MCP 按真实协议发现和执行工具，取消不重放", async () => {
  const calls = [], removed = [], cancellations = [];
  let blockedResolve;
  const blocked = new Promise(resolve => { blockedResolve = resolve; });
  const server = createServer(async (request, response) => {
    if (request.method === "DELETE") { removed.push(request.headers["mcp-session-id"]); response.writeHead(204).end(); return; }
    let text = ""; for await (const chunk of request) text += chunk;
    const body = JSON.parse(text); calls.push(body);
    assert.equal(request.headers.accept, "application/json, text/event-stream");
    const json = result => { response.writeHead(200, { "Content-Type": "application/json", ...(body.method === "initialize" ? { "MCP-Session-Id": "fixture-session" } : {}) }); response.end(JSON.stringify({ jsonrpc: "2.0", id: body.id, result })); };
    if (body.method === "initialize") { assert.equal(body.params.protocolVersion, "2025-11-25"); json({ protocolVersion: "2025-11-25", capabilities: { tools: {} }, serverInfo: { name: "fixture", version: "test" } }); return; }
    assert.equal(request.headers["mcp-session-id"], "fixture-session");
    assert.equal(request.headers["mcp-protocol-version"], "2025-11-25");
    if (body.method === "notifications/initialized") { response.writeHead(202).end(); return; }
    if (body.method === "notifications/cancelled") { cancellations.push(body.params.requestId); response.writeHead(202).end(); return; }
    if (body.method === "tools/list") { json(body.params.cursor ? { tools: [] } : { tools: [{ name: "fixture_read", description: "隔离测试文件观察工具", inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"], additionalProperties: false } }], nextCursor: "page-two" }); return; }
    if (body.params.arguments.path === "block") { blockedResolve(); return; }
    if (body.params.arguments.path === "disconnect") { response.destroy(); return; }
    const event = { jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: "真实协议结果" }], isError: body.params.arguments.path === "fail" } };
    response.writeHead(200, { "Content-Type": "text/event-stream" });
    response.write("event: message\r\ndata: "); response.end(JSON.stringify(event) + "\r\n\r\n");
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const url = `http://127.0.0.1:${server.address().port}/mcp`;
  const controller = new AbortController();
  let discovered;
  try {
    discovered = await discoverMcpTools([{ id: "fixture", name: "测试服务", url, enabled: true }], controller.signal, 10);
    assert.deepEqual(discovered.errors, []); assert.equal(discovered.tools.length, 1);
    const tool = discovered.tools[0];
    assert.equal(tool.risk({}), "dangerous");
    assert.throws(() => tool.parse({ path: 1 }), /约束/u);
    const context = { userId: "fixture", userRole: "admin", applicationId: "workspace", signal: controller.signal, onProgress() {} };
    assert.equal((await tool.execute(tool.parse({ path: "valid" }), context)).content[0].text, "真实协议结果");
    assert.equal((await tool.execute({ path: "fail" }, context)).isError, true);
    await assert.rejects(tool.execute({ path: "disconnect" }, context));
    assert.equal(calls.filter(call => call.method === "tools/call" && call.params.arguments.path === "disconnect").length, 1);
    const waiting = tool.execute({ path: "block" }, context); await blocked; controller.abort(); await assert.rejects(waiting);
    assert.ok(cancellations.length >= 2);
    await discovered.close(); assert.equal(removed.length, 1);
    const invalid = await discoverMcpTools([{ id: "bad", name: "无效服务", url: "http://user:secret@127.0.0.1/mcp", enabled: true }], new AbortController().signal, 10);
    assert.equal(invalid.tools.length, 0); assert.equal(invalid.errors.length, 1); await invalid.close();
  } finally { await discovered?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
