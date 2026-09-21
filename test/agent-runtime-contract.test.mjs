/**
 * 文件：agent-runtime-contract.test.mjs
 * 作用：防回归检查 Chat/Work 共用 Runtime、三档权限和官方 Harness Registry。
 * 不负责：替代 Codex / DSH 实机进程验证。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const permissionUrl = pathToFileURL(path.resolve("packages/core/agent-runtime/src/core/permission-profiles.ts")).href;
const harnessUrl = pathToFileURL(path.resolve("packages/core/agent-runtime/src/harness/official-harnesses.ts")).href;

function runTs(script) {
  return execFileSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "--eval", script], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

test("three permission profiles keep approval reviewer sandbox as atomic facts", () => {
  const output = runTs(`
    const p = await import(${JSON.stringify(permissionUrl)});
    process.stdout.write(JSON.stringify({ profiles: p.AGENT_PERMISSION_PROFILES, codex: {
      ask: p.toCodexPermissionSettings("ask"),
      auto: p.toCodexPermissionSettings("approve-for-me"),
      full: p.toCodexPermissionSettings("full-access"),
    }}));
  `);
  const value = JSON.parse(output);
  assert.deepEqual(Object.keys(value.profiles).sort(), ["approve-for-me", "ask", "full-access"]);
  assert.equal(value.profiles.ask.toolApproval, "prompt-every-capability");
  assert.equal(value.profiles["approve-for-me"].reviewer, "model-reviewer");
  assert.equal(value.profiles["full-access"].sandbox, "unrestricted");
  assert.equal(value.profiles.ask.trustCoreMutableByRun, false);
  assert.equal(value.profiles["approve-for-me"].trustCoreMutableByRun, false);
  assert.equal(value.profiles["full-access"].trustCoreMutableByRun, false);
  assert.deepEqual(value.codex.ask, { approvalPolicy: "on-request", approvalsReviewer: "user", sandboxMode: "workspace-write" });
  assert.deepEqual(value.codex.auto, { approvalPolicy: "on-request", approvalsReviewer: "auto_review", sandboxMode: "workspace-write" });
  assert.deepEqual(value.codex.full, { approvalPolicy: "never", approvalsReviewer: "user", sandboxMode: "danger-full-access" });
});

test("official harness registry names only official bridge entry points", () => {
  const output = runTs(`
    const h = await import(${JSON.stringify(harnessUrl)});
    process.stdout.write(JSON.stringify([...h.createHarnessRegistry().values()]));
  `);
  const list = JSON.parse(output);
  assert.equal(list.find((item) => item.id === "openai-codex")?.officialEntry, "codex app-server");
  assert.equal(list.find((item) => item.id === "deepseek-harness")?.bridge, "acp-or-sdk");
});

test("Chat and Work share one AgentRunRequest workspaceMode discriminator while Manual stays outside the Agent core", () => {
  const source = fs.readFileSync("packages/core/agent-runtime/src/core/contracts.ts", "utf8");
  assert.match(source, /export type AgentWorkspaceMode = "chat" \| "work"/);
  assert.match(source, /export interface AgentRunRequest/);
  assert.match(source, /readonly workspaceMode: AgentWorkspaceMode/);
  assert.doesNotMatch(source, /ChatRunRequest|WorkRunRequest/);
  assert.doesNotMatch(source, /AgentWorkspaceMode = [^\n]*manual/);
  assert.match(source, /interveneRun\(runId: string, request: AgentInterventionRequest\)/);
});
