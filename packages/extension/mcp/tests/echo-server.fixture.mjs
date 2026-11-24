// 本地 MCP Stdio 夹具，用真实 SDK 协议模拟一个回显工具。
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const server = new Server({ name: "fixture", version: "1.0.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, () => ({
  tools: [{ name: "echo_text", description: "Echo text", inputSchema: { type: "object" } }],
}));
server.setRequestHandler(CallToolRequestSchema, ({ params }) => ({
  content: [{ type: "text", text: String(params.arguments?.text ?? "") }],
}));
await server.connect(new StdioServerTransport());
