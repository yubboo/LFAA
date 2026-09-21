/**
 * #21.26 Workspace 专业术语门禁。
 * Workspace Mode、UI Surface、ViewModel、Renderer、Projection 必须各自表达真实职责，避免语义漂移。
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

const runtimeContracts = read("packages/core/agent-runtime/src/core/contracts.ts");
const runtimeEntry = read("packages/core/agent-runtime/src/index.ts");
const workspaceTypes = read("packages/client/workspace/src/shared/contracts/workspace.types.ts");
const workspaceSession = read("packages/client/workspace/src/shared/logic/useWorkspaceSessionController.ts");
const workspaceReadme = read("packages/client/workspace/README.md");
const uiReadme = read("packages/client/ui/README.md");
const architecture = read("docs/ARCHITECTURE.md");
const infiniteCanvas = read("packages/client/ui/src/features/workbench/InfiniteCanvas.tsx");

test("Chat and Work use Agent Workspace Mode while Manual is a Workbench-only mode", () => {
  assert.match(runtimeContracts, /export type AgentWorkspaceMode = "chat" \| "work"/);
  assert.match(runtimeContracts, /readonly workspaceMode: AgentWorkspaceMode/);
  assert.match(runtimeEntry, /AgentWorkspaceMode/);
  assert.match(workspaceTypes, /AgentWorkspaceMode \| "manual"/);
  assert.doesNotMatch(runtimeContracts, /AgentWorkspaceMode = [^\n]*manual/);
  assert.doesNotMatch(runtimeContracts + runtimeEntry, /AgentSurfaceMode|readonly surface:\s*Agent/);
  assert.match(workspaceSession, /workspaceMode/);
  assert.doesNotMatch(workspaceSession, /\bagentSurface\b|\bsetAgentSurface\b/);
});



test("agent-runtime public entry exports every type consumed by Workspace and Web Host", () => {
  for (const exportedType of [
    "AgentExecutionHints",
    "AgentRuntimeEvent",
    "AgentRuntimeEventListener",
    "AgentWorkspaceMode",
  ]) {
    assert.match(runtimeEntry, new RegExp(`\\b${exportedType}\\b`));
  }
});

test("Chat UI contract is a ViewModel rather than a fake Projection type", () => {
  assert.match(workspaceTypes, /export interface ChatMessageViewModel/);
  assert.doesNotMatch(workspaceTypes + workspaceSession, /ChatProjectionMessage/);
});

test("Workspace mode persistence migrates the v0.0.96 legacy key without keeping it as the new truth", () => {
  assert.match(workspaceSession, /WORKSPACE_MODE_KEY = "lfaa\.workspace\.mode\.v1"/);
  assert.match(workspaceSession, /LEGACY_AGENT_SURFACE_KEY = "lfaa\.agent\.surface\.v1"/);
  assert.match(workspaceSession, /getItem\(WORKSPACE_MODE_KEY\) \?\? window\.localStorage\.getItem\(LEGACY_AGENT_SURFACE_KEY\)/);
  assert.match(workspaceSession, /setItem\(WORKSPACE_MODE_KEY, workspaceMode\)/);
  assert.doesNotMatch(workspaceSession, /setItem\(LEGACY_AGENT_SURFACE_KEY/);
});

test("current architecture reserves Projection for actual derived read models", () => {
  assert.match(architecture, /Workspace Mode/);
  assert.match(architecture, /Surface/);
  assert.match(architecture, /ViewModel/);
  assert.match(architecture, /Renderer/);
  assert.match(architecture, /Projection/);
  assert.match(workspaceReadme, /工作模式|Workspace Mode/);
  assert.match(uiReadme, /Renderer|Interaction/);
  assert.doesNotMatch(workspaceReadme, /产品投影|线性对话投影|工作投影/);
  assert.doesNotMatch(uiReadme, /InfiniteCanvas Projection|Canvas Projection/);
  assert.doesNotMatch(infiniteCanvas, /Canvas 只能做 Projection/);
});
