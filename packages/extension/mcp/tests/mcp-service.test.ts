// 验证原生 MCP 通过真实 Stdio/HTTP/SSE 握手、工具生命周期、审批元数据与加密持久化。
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { setTimeout as pause } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { Context } from "@deepseek-ai/cordis";
import { toolsPlugin } from "@lfaa/tools";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import mcpPlugin, { createMcpHttpHandler } from "../src/index";

const echoPath = fileURLToPath(new URL("./echo-server.fixture.mjs", import.meta.url));

async function boot(file: string) {
  const context = new Context();
  await context.plugin(toolsPlugin, { includeBuiltins: false });
  const fiber = context.plugin(mcpPlugin, { file });
  await fiber;
  return { context, fiber, service: context.mcp };
}

async function eventually(check: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (check()) return;
    await pause(35);
  }
  assert.ok(check(), "MCP state did not settle");
}

test("Stdio 测试、启停、项目过滤、审批与重启恢复", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lfaa-mcp-test-"));
  const file = join(dir, "mcp-servers.json");
  const first = await boot(file);
  try {
    const { context, service, fiber } = first;
    await service.import({ mcpServers: {
      echo: { command: process.execPath, args: [echoPath], env: { MCP_FIXTURE_TOKEN: "stdio-fixture-secret" } },
    } });
    assert.equal(service.list()[0]?.status, "disabled");
    assert.equal(await service.test("echo"), 1);
    assert.deepEqual(context.tools.getLlmToolSchemas(), []);
    assert.doesNotMatch(JSON.stringify(service.list()), /stdio-fixture-secret|MCP_FIXTURE_TOKEN|command/u);
    assert.doesNotMatch(await readFile(file, "utf8"), /stdio-fixture-secret|MCP_FIXTURE_TOKEN/u);

    await service.save("echo", { enabled: true, projectId: "project-a" }, false);
    await eventually(() => service.list()[0]?.status === "connected");
    const tool = "mcp__echo__echo_text";
    const modules = new Set(["@lfaa/mcp"]);
    const permitted = context.tools.scope(modules, false, "project-a");
    const denied = context.tools.scope(modules, false, "project-b");
    const run = { workspaceRoots: [], sessionId: "test", runId: "test", signal: new AbortController().signal };
    assert.equal(permitted.getTool(tool)?.permissionLevel, "exec");
    assert.equal(permitted.getTool(tool)?.approval, "always");
    assert.equal(denied.getTool(tool), undefined);
    assert.deepEqual(denied.getLlmToolSchemas(), []);
    assert.equal((await denied.executeTool(tool, { text: "forbidden" }, run)).ok, false);
    assert.equal((await context.tools.executeTool(tool, {}, run)).ok, false);
    const result = await permitted.executeTool(tool, { text: "hello MCP" }, run);
    assert.equal(result.ok, true);
    assert.match(result.output, /hello MCP/u);

    await service.save("echo", { toolTrust: { echo_text: "trusted" } }, false);
    await eventually(() => permitted.getTool(tool)?.approval === "trusted");
    await fiber.dispose();
    assert.equal(context.tools.getTool(tool), undefined);

    const second = await boot(file);
    try {
      await eventually(() => second.service.list()[0]?.status === "connected");
      assert.equal(second.service.list()[0]?.tools[0]?.trust, "trusted");
      await second.service.save("echo", { enabled: false }, false);
      assert.equal(second.context.tools.getTool(tool), undefined);
      await second.service.remove("echo");
      assert.deepEqual(second.service.list(), []);
    } finally {
      await second.fiber.dispose();
    }
  } finally {
    await first.fiber.dispose();
    await rm(dir, { recursive: true, force: true });
  }
});

test("远程 HTTP 和 SSE 接收自定义请求头，设置 API 忽略敏感字段", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lfaa-mcp-http-"));
  const { service, fiber } = await boot(join(dir, "mcp-servers.json"));
  const handler = createMcpHttpHandler(service);
  const httpTransport = new StreamableHTTPServerTransport({ enableJsonResponse: true, sessionIdGenerator: randomUUID });
  let sse: SSEServerTransport | undefined;
  const protocol = () => {
    const server = new Server({ name: "fixture", version: "1.0.0" }, { capabilities: { tools: {} } });
    server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: [
      { name: "count", inputSchema: { type: "object" } },
    ] }));
    return server;
  };
  await protocol().connect(httpTransport);
  const remote = createServer((req, res) => {
    void (async () => {
      const path = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
      if (await handler(req, res)) return;
      if (req.headers.authorization !== "Bearer local-fixture-secret") {
        res.writeHead(401).end();
      } else if (path === "/http") {
        await httpTransport.handleRequest(req, res);
      } else if (path === "/sse") {
        sse = new SSEServerTransport("/messages", res);
        await protocol().connect(sse);
      } else if (path === "/messages" && sse) {
        await sse.handlePostMessage(req, res);
      } else {
        res.writeHead(404).end();
      }
    })().catch(() => res.destroy());
  });
  try {
    await new Promise<void>((resolve) => remote.listen(0, "127.0.0.1", resolve));
    const addr = remote.address();
    assert.ok(addr && typeof addr !== "string");
    const origin = `http://127.0.0.1:${addr.port}`;
    await service.import({ mcpServers: {
      modern: { type: "streamable-http", url: origin + "/http", headers: { Authorization: "Bearer local-fixture-secret" } },
      legacy: { type: "sse", url: origin + "/sse", headers: { Authorization: "Bearer local-fixture-secret" } },
    } });
    assert.equal(await service.test("modern"), 1);
    assert.equal(await service.test("legacy"), 1);
    const response = await fetch(origin + "/api/mcp/servers");
    assert.equal(response.status, 200);
    assert.doesNotMatch(await response.text(), /local-fixture-secret|Authorization|127\.0\.0\.1/u);
  } finally {
    await fiber.dispose();
    await sse?.close();
    await httpTransport.close();
    remote.closeAllConnections();
    if (remote.listening) await new Promise<void>((resolve) => remote.close(() => resolve()));
    await rm(dir, { recursive: true, force: true });
  }
});
