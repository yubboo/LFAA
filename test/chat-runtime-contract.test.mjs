/**
 * 文件：chat-runtime-contract.test.mjs
 * 作用：锁定 Chat / Work 到 Agent Runtime、Provider Runtime 与流式消息映射的跨包契约。
 * 负责：验证 OpenAI-compatible 与 Codex App Server 双 Runtime 路由、Bundle 注入、流式 delta、完成事件与思考增强提示。
 * 不负责：真实网络请求、真实 Codex 登录、UI 像素级视觉验收。
 * 状态归属：纯源码契约测试，无持久状态。
 * 对外接口：`node --test test/chat-runtime-contract.test.mjs`。
 * 关联文件：packages/api/agent-controller、packages/harness/codex-app-server、packages/client/workspace、packages/bundle/web-app。
 * 修改注意事项：新增 Runtime 协议必须证明 Controller 按 Provider connection.protocol 路由，禁止重新用 credentialRef 猜协议。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const contracts = read("packages/core/agent-runtime/src/core/contracts.ts");
const bridgePath = new URL("packages/api/agent-controller/src/agent-runtime-bridge.ts", root);
const llmPath = new URL("packages/llm/openai-compatible/src/index.ts", root);
const codexPath = new URL("packages/harness/codex-app-server/src/codex-app-server.ts", root);
const client = read("packages/client/connection/src/agent-runtime-client.ts");
const app = read("packages/client/web/src/App.tsx");
const workbench = read("packages/client/app-shell/src/AgentWorkbench.tsx");
const chat = read("packages/client/workspace/src/chat/view/ChatWorkspace.tsx");
const session = read("packages/client/workspace/src/shared/logic/useWorkspaceSessionController.ts");
const composer = read("packages/client/app-shell/src/workbench/center/composer/view/ComposerRegion.tsx");
const runtimeController = read("packages/client/app-shell/src/workbench/center/composer/runtime-control/logic/useRuntimeControlController.ts");
const runtimeSurface = [workbench, chat, session, composer, runtimeController].join("\n");
const vite = read("apps/web/vite.config.ts");
const bundleVite = read("packages/bundle/web-app/src/vite.ts");

test("web development host routes each configured Provider to its owned text runtime", () => {
  assert.equal(existsSync(bridgePath), true);
  assert.equal(existsSync(llmPath), true);
  assert.equal(existsSync(codexPath), true);
  const bridge = readFileSync(bridgePath, "utf8");
  const llm = readFileSync(llmPath, "utf8");
  const codex = readFileSync(codexPath, "utf8");

  for (const token of [
    "AiProviderRegistry",
    "resolveConnection",
    'connection.protocol === "codex-app-server"',
    'connection.protocol === "openai-compatible"',
    "codexRuntime.runText",
    "assistant.delta",
    "assistant.completed",
    "callOpenAiCompatibleTextModel",
  ]) assert.match(bridge, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  for (const token of ["/chat/completions", "/responses", "REASONING_BOOST_INSTRUCTION", 'role: "system"'])
    assert.match(llm, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  for (const token of ["thread/start", "turn/start", "item/agentMessage/delta", "turn/completed", "turn/interrupt"])
    assert.match(codex, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

  assert.doesNotMatch(bridge, /console\.log\([^\n]*(?:credential|secret|Authorization)/i);
  assert.doesNotMatch(llm, /console\.log\([^\n]*(?:credential|secret|Authorization)/i);
  assert.match(vite, /@lfaa\/bundle-web-app\/vite/);
  assert.match(bundleVite, /lfaaDevAgentRuntimeBridge\(options\.projectRoot, \{ codexRuntime: codexHost\.textRuntime \}\)/);
  assert.match(app, /agentRuntimeHost=\{webAgentRuntimeHost\}/);
});

test("AgentRuntimeHost maps streaming and completed runtime events into one Chat assistant message", () => {
  assert.match(contracts, /AgentRuntimeEvent/);
  assert.match(contracts, /assistant\.delta/);
  assert.match(contracts, /subscribe\(listener: AgentRuntimeEventListener\)/);
  assert.match(client, /lfaa:agent-runtime-event/);
  assert.match(chat, /styles\.timeline/);
  assert.match(session, /event\.type === "assistant\.delta"/);
  assert.match(session, /event\.type === "assistant\.completed"/);
  assert.match(session, /text: `\$\{next\[index\]!\.text\}\$\{event\.delta\}`/);
  assert.match(session, /runtimeConnected:\s*Boolean\(runtimeHost\)/);
  assert.match(workbench, /runtimeConnected=\{session\.runtimeConnected\}/);
});

test("strong reasoning travels as execution hint without inventing provider field", () => {
  const bridge = readFileSync(bridgePath, "utf8");
  assert.match(contracts, /interface AgentExecutionHints/);
  assert.match(contracts, /executionHints\?: AgentExecutionHints/);
  assert.match(composer, /executionHints/);
  assert.match(runtimeController, /reasoningBoost: boostActive/);
  assert.match(bridge, /executionHints\?\.reasoningBoost|rawHints[\s\S]*reasoningBoost/);
  const llm = readFileSync(llmPath, "utf8");
  assert.match(llm, /REASONING_BOOST_INSTRUCTION/);
  assert.match(llm, /role: "system"/);
  assert.doesNotMatch(llm, /reasoning_effort\s*:\s*options\.request\.executionHints|reasoning\s*:\s*options\.request\.executionHints/);
});

test("Codex subscription runtime never requires LFAA to read or persist ChatGPT OAuth tokens", () => {
  const bridge = readFileSync(bridgePath, "utf8");
  const codex = readFileSync(codexPath, "utf8");
  const codexBranch = bridge.slice(bridge.indexOf('connection.protocol === "codex-app-server"'), bridge.indexOf('connection.protocol === "openai-compatible"'));
  assert.doesNotMatch(codexBranch, /secrets\.get|credentialRef/);
  assert.doesNotMatch(codex, /from "node:fs"|process\.env|readFileSync|readFile\(/);
  assert.match(codex, /approvalPolicy: "never"/);
  assert.match(codex, /sandboxPolicy: \{ type: "readOnly"/);
});
