import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const testRoot = fileURLToPath(new URL("../../../dist/.tmp/", import.meta.url));
mkdirSync(testRoot, { recursive: true });
const testData = mkdtempSync(join(testRoot, "lfaa-subagent-external-workspace-"));
const testHome = join(testData, "home");
const testBusinessData = join(testData, "data");
mkdirSync(testHome, { recursive: true });
mkdirSync(testBusinessData, { recursive: true });
process.env.LFAA_HOME = testHome;
process.env.LFAA_DATA_DIR = testBusinessData;
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "";
process.env.LFAA_HARNESS_HOME = "";
process.env.LFAA_LOCAL_MODE = "true";
delete process.env.LFAA_DATA_DIR_CONFIGURED;
delete process.env.LFAA_DATA_DIR_MANAGED_BY_LAUNCHER;
delete process.env.LFAA_DATA_DIR_MANAGED_BY_DESKTOP;
test.after(() => {
  if (dirname(testData) !== testRoot.replace(/[\\/]$/u, "")) throw new Error("拒绝清理隔离根以外路径。");
  database.close();
  rmSync(testData, { recursive: true, force: true });
});

const { resolveExternalSubagentTarget } = await import("lfaa-tool-subagent/src/external-target.js");
const { resolveSubagentWorkingDirectory } = await import("lfaa-subagent/src/working-directory.js");
const { apply: applySubagentTool } = await import("lfaa-tool-subagent/src/index.js");
const settings = await import("lfaa-settings/src/service.js");
const { database } = await import("lfaa-storage-sqlite/src/database.js");
const preflightUserId = "subagent-preflight-owner";
database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role) VALUES(?,?,?,'fixture','fixture','member')").run(preflightUserId, 99001, preflightUserId);
settings.saveUserSettings(preflightUserId, "ai-runtime", {
  ...settings.defaultSettings.aiRuntime,
  executionSandboxMode: "danger-full-access"
});

const repoPath = resolve(testData, "repo");
mkdirSync(repoPath);
const repository = { id: "repo-fixture", path: repoPath, title: "隔离仓库" };
const targetInput = (overrides = {}) => ({
  driver: "claude-code",
  localHostExecution: true,
  permissionBridgeAvailable: true,
  executionSandboxMode: "danger-full-access",
  sessionRepository: repository,
  runRepository: repository,
  ...overrides
});

test("Claude Agent SDK 绑定 Session AgentGit 目标并复用 LFAA Permission Owner", () => {
  assert.deepEqual(resolveExternalSubagentTarget(targetInput()), {
    repositoryId: repository.id,
    title: repository.title,
    workingDirectory: repoPath
  });
  assert.throws(() => resolveExternalSubagentTarget(targetInput({ localHostExecution: false })), /本机 Host/u);
  assert.throws(() => resolveExternalSubagentTarget(targetInput({ permissionBridgeAvailable: false })), /Permission Owner/u);
  assert.throws(() => resolveExternalSubagentTarget(targetInput({ driver: "codex" })), /尚未接入/u);
  assert.throws(() => resolveExternalSubagentTarget(targetInput({ executionSandboxMode: "workspace-write" })), /尚未接入 LFAA 沙箱/u);
  assert.throws(() => resolveExternalSubagentTarget(targetInput({ sessionRepository: null })), /绑定缺失/u);
  assert.throws(() => resolveExternalSubagentTarget(targetInput({ sessionRepository: { ...repository, path: resolve(testData, "other") } })), /绑定缺失/u);
  const relativeRepository = { ...repository, path: "relative/repo" };
  assert.throws(() => resolveExternalSubagentTarget(targetInput({ sessionRepository: relativeRepository, runRepository: relativeRepository })), /目标无效/u);
});

test("工具准备阶段拒绝不可用的 Codex/Claude 外部驱动和缺少 Claude 授权桥的调用", () => {
  const tools = new Map();
  let credentialConfigured = true;
  let registrations = [
    { name: "claude-code", displayName: "Claude Agent SDK", available: true },
    { name: "codex", displayName: "Codex CLI", available: false, unavailableReason: "Codex CLI 尚未接入 LFAA Permission Owner 的逐动作授权桥。" }
  ];
  const ctx = {
    lfaaTools: { registerTool(_context, tool) { tools.set(tool.name, tool); } },
    lfaaSubagents: { listDrivers() { return registrations; } },
    lfaaSessions: {},
    lfaaSubagentClaudeCode: { getCredentialStatus() { return { configured: credentialConfigured }; } }
  };
  applySubagentTool(ctx);
  const delegatedTool = tools.get("lfaa_delegate_subagent");
  assert.ok(delegatedTool);
  const prepareContext = { userId: preflightUserId, userRole: "member", agentGitRepository: repository };
  assert.throws(() => delegatedTool.prepare(
    { driver: "claude-code", description: "缺少授权桥", prompt: "fixture" },
    prepareContext
  ), /Permission Owner/u);
  assert.throws(() => delegatedTool.prepare(
    { driver: "codex", description: "未接入桥", prompt: "fixture" },
    { ...prepareContext, authorizeExternalAgentAction: async () => true }
  ), /尚未接入/u);
  const claudeReadyContext = {
    ...prepareContext,
    authorizeExternalAgentAction: async () => true,
    externalAgentTools: [{ name: "fixture_probe", description: "Fixture", schema: { type: "object", properties: {}, additionalProperties: false } }],
    dispatchExternalAgentTool: async () => ({ content: [{ type: "text", text: "fixture" }] })
  };
  credentialConfigured = false;
  assert.throws(() => delegatedTool.prepare(
    { driver: "claude-code", description: "缺少 API Key", prompt: "fixture" },
    claudeReadyContext
  ), /Anthropic Console API Key/u);
  credentialConfigured = true;
  registrations = [{ name: "claude-code", displayName: "Claude Agent SDK", available: false, unavailableReason: "隔离回归模拟未就绪驱动。" }];
  assert.throws(() => delegatedTool.prepare(
    { driver: "claude-code", description: "凭据未接入", prompt: "fixture" },
    claudeReadyContext
  ), /未就绪驱动/u);
});

test("驱动工作目录必须是现存目录，缺失、相对路径和普通文件均失败关闭", async () => {
  assert.equal(await resolveSubagentWorkingDirectory(repoPath), repoPath);
  await assert.rejects(resolveSubagentWorkingDirectory(undefined), /缺少 AgentGit Owner/u);
  await assert.rejects(resolveSubagentWorkingDirectory("relative/repo"), /缺少 AgentGit Owner/u);
  await assert.rejects(resolveSubagentWorkingDirectory(resolve(testData, "missing")), /不存在或不可访问/u);
  const filePath = resolve(testData, "not-a-directory.txt");
  writeFileSync(filePath, "fixture");
  await assert.rejects(resolveSubagentWorkingDirectory(filePath), /不是目录/u);
});
