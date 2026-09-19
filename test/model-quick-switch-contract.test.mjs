import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workbench = readFileSync(new URL("../packages/app-shell/src/AgentWorkbench.tsx", import.meta.url), "utf8");
const service = readFileSync(new URL("../packages/config-system/src/settings/ai/core/account-service.ts", import.meta.url), "utf8");
const bridge = readFileSync(new URL("../apps/web/dev/bridges/ai/ai-config-bridge.ts", import.meta.url), "utf8");
const runtime = readFileSync(new URL("../packages/agent-runtime/src/core/contracts.ts", import.meta.url), "utf8");

test("composer owns an in-place model and reasoning quick switch", () => {
  assert.match(workbench, /agent-model-control/);
  assert.match(workbench, /agent-model-menu/);
  assert.match(workbench, /agent-reasoning-menu/);
  assert.match(workbench, /onQuickSelectModel/);
  assert.match(workbench, /onQuickUpdateModelSetting/);
  assert.match(workbench, /quickModels\.length === 0/);
  assert.match(workbench, /管理模型/);
});

test("quick switch uses cached catalog instead of re-probing Provider", () => {
  const method = service.match(/async setActiveModel\([\s\S]*?\n  async activateModel/);
  assert.ok(method, "setActiveModel method missing");
  assert.match(method[0], /account\.modelCatalog/);
  assert.doesNotMatch(method[0], /this\.probe\(/);
  assert.match(bridge, /active-model/);
});

test("agent run model binding carries validated runtime settings", () => {
  assert.match(runtime, /readonly settings\?: Readonly<Record<string, string \| number \| boolean>>/);
  assert.match(workbench, /settings: activeAiAccount\?\.modelSettings \?\? \{\}/);
});
