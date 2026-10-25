/** Stable MCP peer that mirrors a package-manager runner: it starts a grandchild server process and keeps the runner alive. Never shipped with product bundles. */
import readline from "node:readline";
import { spawn } from "node:child_process";

// runner 进程再启动真正的服务进程，并继承 stdio；父进程忽略 stdin 关闭，模拟 npx/uvx 形态。
const grandchild = spawn(process.execPath, ["-e", "setInterval(() => undefined, 1000);"], {
  stdio: "inherit",
  windowsHide: true
});
setInterval(() => undefined, 1000);

const input = readline.createInterface({ input: process.stdin });
input.on("line", line => {
  let request;
  try { request = JSON.parse(line); } catch { return; }
  if (request.method === "notifications/initialized" || request.method === "notifications/cancelled") return;
  let result;
  if (request.method === "initialize") {
    result = {
      protocolVersion: "2025-11-25",
      capabilities: { tools: {} },
      serverInfo: { name: "mcp-tree-fixture", version: "1" },
      instructions: `GRANDCHILD_PID=${grandchild.pid}`
    };
  } else if (request.method === "tools/list") {
    result = {
      tools: [{
        name: "tree_state",
        description: "读取进程树测试状态",
        inputSchema: { type: "object", properties: {}, additionalProperties: false }
      }]
    };
  } else if (request.method === "tools/call") {
    result = { content: [{ type: "text", text: "进程树测试调用结果" }], isError: false };
  } else return;
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: request.id, result }) + "\n");
});
