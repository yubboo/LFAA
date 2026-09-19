import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const root = new URL("../", import.meta.url);
const contracts = readFileSync(new URL("packages/agent-runtime/src/core/contracts.ts", root), "utf8");
const bridgePath = new URL("apps/web/dev/bridges/agent/agent-runtime-bridge.ts", root);
const client = readFileSync(new URL("apps/web/src/host/agent-runtime-client.ts", root), "utf8");
const app = readFileSync(new URL("apps/web/src/App.tsx", root), "utf8");
const workbench = readFileSync(new URL("packages/app-shell/src/AgentWorkbench.tsx", root), "utf8");
const vite = readFileSync(new URL("apps/web/vite.config.ts", root), "utf8");

 test("web development host exposes a real model chat runtime instead of leaving Composer disabled", () => {
  assert.equal(existsSync(bridgePath), true);
  const bridge = readFileSync(bridgePath, "utf8");
  assert.match(bridge, /createWebDevSecretStore/);
  assert.match(bridge, /credentialRef/);
  assert.match(bridge, /\/chat\/completions/);
  assert.match(bridge, /\/responses/);
  assert.match(bridge, /MAX_HISTORY_MESSAGES/);
  assert.match(bridge, /assistant\.completed/);
  assert.doesNotMatch(bridge, /console\.log\([^\n]*(?:credential|secret|Authorization)/i);
  assert.match(vite, /lfaaDevAgentRuntimeBridge\(projectRoot\)/);
  assert.match(app, /agentRuntimeHost=\{webAgentRuntimeHost\}/);
});

test("AgentRuntimeHost projects results through runtime events", () => {
  assert.match(contracts, /AgentRuntimeEvent/);
  assert.match(contracts, /subscribe\(listener: AgentRuntimeEventListener\)/);
  assert.match(client, /lfaa:agent-runtime-event/);
  assert.match(workbench, /agent-chat-timeline/);
  assert.match(workbench, /assistant\.completed/);
  assert.match(workbench, /runtimeConnected=\{Boolean\(props\.agentRuntimeHost\)\}/);
});
