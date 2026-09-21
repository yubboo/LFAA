import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (file) => fs.readFileSync(file, "utf8");

test("web product mounts Identity Gate before App Hub and Workbench", () => {
  const source = read("packages/client/web/src/App.tsx");
  assert.match(source, /<LfaaIdentityGate host=\{webIdentityHost\}>/);
  assert.match(source, /<LfaaAppHub\b/);
  assert.match(source, /<AgentWorkbench/);
  assert.ok(source.indexOf("<LfaaIdentityGate") < source.indexOf("<AgentWorkbench"));
});

test("identity bridge is registered before protected host controllers", () => {
  const source = read("packages/bundle/web-app/src/vite.ts");
  const pluginsIndex = source.indexOf("plugins: [");
  const identityIndex = source.indexOf("lfaaDevIdentityBridge(),", pluginsIndex);
  const terminalIndex = source.indexOf("createLfaaDevTerminalBridge", pluginsIndex);
  const agentIndex = source.indexOf("lfaaDevAgentRuntimeBridge", pluginsIndex);
  assert.ok(identityIndex >= 0, "identity bridge must be registered");
  assert.ok(identityIndex < terminalIndex, "identity gate must precede terminal bridge");
  assert.ok(identityIndex < agentIndex, "identity gate must precede agent runtime bridge");
});

test("app hub does not fake unfinished App Packs as usable", () => {
  const source = read("packages/client/web/src/App.tsx");
  for (const id of ["lfaa/ai-writing", "lfaa/ai-comic", "lfaa/minecraft", "lfaa/steam-server"]) {
    const block = source.slice(source.indexOf(`id: "${id}"`), source.indexOf(`id: "${id}"`) + 360);
    assert.match(block, /available: false/);
  }
});
