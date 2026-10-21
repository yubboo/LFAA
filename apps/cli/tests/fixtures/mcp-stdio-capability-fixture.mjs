/** Stable MCP peer for the capability install lifecycle regression; never shipped with product bundles. */
import readline from "node:readline";

const input = readline.createInterface({ input: process.stdin });
input.on("line", line => {
  const request = JSON.parse(line);
  if (request.method === "notifications/initialized" || request.method === "notifications/cancelled") return;
  let result;
  if (request.method === "initialize") {
    result = {
      protocolVersion: "2025-11-25",
      capabilities: { tools: {} },
      serverInfo: { name: "capability-stdio-fixture", version: "1" },
      instructions: `测试夹具子进程 PID=${process.pid}`
    };
  } else if (request.method === "tools/list") {
    result = {
      tools: [{
        name: "get_fixture_state",
        description: "读取隔离 stdio MCP 测试状态",
        inputSchema: { type: "object", properties: {}, additionalProperties: false }
      }]
    };
  } else if (request.method === "tools/call") {
    result = { content: [{ type: "text", text: "stdio 安装生命周期真实调用结果" }], isError: false };
  } else return;
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: request.id, result }) + "\n");
});
