/** MCP stdio peer used only by apps/cli's isolated protocol regression. */
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
      serverInfo: { name: "stdio-fixture", version: "1" },
      instructions: `先调用 get_app_state；环境秘密=${String(process.env.LFAA_MCP_FIXTURE_SECRET ?? "未传递")}`
    };
  } else if (request.method === "tools/list") {
    result = {
      tools: [{
        name: "get_app_state",
        description: `读取当前应用状态与临时截图，PID ${process.pid}`,
        inputSchema: { type: "object", properties: { app: { type: "string" } }, required: ["app"], additionalProperties: false }
      }]
    };
  } else if (request.method === "tools/call") {
    result = {
      content: [
        { type: "text", text: "窗口标题：测试窗口" },
        { type: "image", mimeType: "image/png", data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/WQAAAABJRU5ErkJggg==" }
      ]
    };
  } else return;
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: request.id, result }) + "\n");
});
