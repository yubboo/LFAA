/**
 * 功能：回归 GitHub 提示词固定检查、账户/App 登记、生命周期和按需加载。
 * 作用：以 Owner 与设置目录夹具证明 Prompt 不进入第三方插件代码 Runtime。
 * 关联文件：packages/boot/capability-prompt/src/index.ts、settings/service.ts、core/tools/business-tools.ts。
 */
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataDirectory = mkdtempSync(join(tmpdir(), "lfaa-capability-prompt-"));
process.env.LFAA_DATA_DIR = dataDirectory;
const { CapabilityInstallRegistry } = await import("lfaa-capability-installs/src/index.js");
const { createPromptAdapter } = await import("lfaa-capability-prompt/src/index.js");
const { createInstalledPromptTools } = await import("lfaa-tools/src/business-tools.js");
const { pluginsSettingsSchema } = await import("lfaa-api-remotes/src/route-contracts.js");
const { configuration } = await import("lfaa-storage-domain/src/configuration.js");
const { closeDatabase } = await import("lfaa-storage-sqlite/src/database.js");
after(() => { configuration.close(); closeDatabase(); rmSync(dataDirectory, { recursive: true, force: true }); });

const repository = "https://github.com/acme/prompts";
const sourcePath = "prompts/code-review.prompt.md";
const commit = "b".repeat(40);
const markdown = "---\nname: Code Review\ndescription: 检查代码变更与验证证据\n---\n按用户目标审查代码，先核对变更和实际验证结果。\n";
const contents = Buffer.from(markdown);
const snapshot = {
  repository: { url: repository, name: "prompts", license: "MIT" },
  requestedRef: "main", commit, archiveSha256: "c".repeat(64),
  files: [
    { path: sourcePath, contents },
    { path: "README.md", contents: Buffer.from("说明文件，不应识别为提示词。") }
  ]
};

function makeUser(enabled = true) { return { plugins: { enabled, mcpServers: [], prompts: [] } }; }
function context(userId = "user-1", applicationId = "workspace") { return { userId, userRole: "member", applicationId, signal: new AbortController().signal, onProgress() {} }; }

function harness(initialUsers = new Map([["user-1", makeUser()], ["user-2", makeUser()]]), currentSnapshot = snapshot) {
  const users = initialUsers;
  const adapter = createPromptAdapter({
    searchRepositories: async query => [{ fullName: "acme/prompts", description: query, license: "MIT" }],
    downloadSnapshot: async () => currentSnapshot,
    getSettings: userId => users.get(userId) ?? makeUser(),
    installPrompt(userId, entry) {
      const user = users.get(userId) ?? makeUser();
      if (user.plugins.prompts.some(prompt => prompt.id === entry.id)) throw new Error("同一提示词来源已在此账户与 App 登记");
      user.plugins.prompts.push(structuredClone(entry)); users.set(userId, user); return entry;
    },
    setPromptEnabled(userId, id, applicationId, enabled) {
      const user = users.get(userId);
      const prompt = user?.plugins.prompts.find(item => item.id === id && item.applicationId === applicationId);
      if (!prompt) throw new Error("找不到提示词");
      prompt.enabled = enabled; return prompt;
    },
    removePrompt(userId, id, applicationId) {
      const user = users.get(userId);
      const index = user?.plugins.prompts.findIndex(item => item.id === id && item.applicationId === applicationId) ?? -1;
      if (!user || index < 0) throw new Error("找不到提示词");
      return user.plugins.prompts.splice(index, 1)[0];
    }
  });
  const registry = new CapabilityInstallRegistry();
  registry.register({ effect(callback) { return callback(); } }, adapter);
  return { registry, users, adapter };
}

test("单个 Markdown 提示词固定归档后登记到账户和单一 App，并经 Owner 回读", async () => {
  const { registry, users } = harness();
  const ctx = context();
  const found = await registry.search("prompt", "代码审查", "workspace", ctx);
  assert.equal(found.candidates[0].requiresInspection, true);
  const inspected = await registry.inspect("prompt", repository, "main", "workspace", {}, ctx);
  assert.equal(inspected.resolvedRef, commit);
  assert.equal(inspected.details.prompt.sourcePath, sourcePath);
  assert.equal(inspected.details.prompt.applicationId, "workspace");
  assert.match(inspected.details.prompt.contentSha256, /^[a-f0-9]{64}$/u);
  assert.match(inspected.details.prompt.untrustedPreview, /按用户目标审查/u);
  assert.match(registry.installApproval("prompt", inspected.inspectionId, "workspace", "user-1").summary, /许可证 MIT/u);

  const installed = await registry.install("prompt", inspected.inspectionId, "workspace", "user-1", ctx);
  assert.equal(installed.outcome, "verified_ready");
  assert.equal(installed.verification.status, "ready");
  const entry = users.get("user-1").plugins.prompts[0];
  assert.equal(entry.applicationId, "workspace");
  assert.equal(entry.enabled, true);
  assert.equal(entry.content, "按用户目标审查代码，先核对变更和实际验证结果。");
  assert.equal(entry.contentSha256, createHash("sha256").update(entry.content).digest("hex"));
  assert.deepEqual(users.get("user-2").plugins.prompts, [], "安装只写入发起账户");
  const listed = await registry.list("prompt", "workspace", {}, ctx);
  assert.equal(listed.length, 1);
  assert.equal(Object.hasOwn(listed[0], "content"), false, "能力清单不回传提示词正文");

  const otherApp = await registry.inspect("prompt", repository, "main", "writing", {}, context("user-1", "writing"));
  const otherInstalled = await registry.install("prompt", otherApp.inspectionId, "writing", "user-1", context("user-1", "writing"));
  assert.equal(otherInstalled.outcome, "verified_ready");
  assert.notEqual(users.get("user-1").plugins.prompts[0].id, users.get("user-1").plugins.prompts[1].id);
  assert.equal((await registry.list("prompt", "workspace", {}, ctx)).length, 1, "不同 App 的条目彼此隔离");

  await registry.setEnabled("prompt", entry.id, false, "workspace", {}, ctx);
  assert.equal((await registry.list("prompt", "workspace", {}, ctx))[0].enabled, false);
  await registry.remove("prompt", entry.id, "workspace", {}, ctx);
  assert.equal((await registry.list("prompt", "workspace", {}, ctx)).length, 0);
  assert.equal(users.get("user-1").plugins.prompts.length, 1, "移除只影响目标 App 的该条记录");
});

test("多提示词仓库须选单个文件；固定提交或归档漂移时拒绝登记", async () => {
  const multiple = { ...snapshot, files: [...snapshot.files, { path: "prompts/security.prompt.md", contents: Buffer.from("安全检查。") }] };
  const multipleHarness = harness(new Map([["user-1", makeUser()]]), multiple);
  await assert.rejects(multipleHarness.adapter.inspect(repository, "main", "workspace", {}), /多个 Markdown 提示词候选/u);
  const target = multipleHarness.adapter.validateTarget({ sourcePath }, "workspace", context());
  const plan = await multipleHarness.adapter.inspect(repository, "main", "workspace", target);
  assert.equal(plan.resolvedTarget.sourcePath, sourcePath);

  const changed = { ...snapshot, archiveSha256: "d".repeat(64) };
  const driftHarness = harness(new Map([["user-1", makeUser()]]), changed);
  await assert.rejects(driftHarness.adapter.install(repository, plan.resolvedRef, "workspace", "user-1", target, plan.details, context()), /归档摘要/u);
  assert.deepEqual(driftHarness.users.get("user-1").plugins.prompts, []);
  assert.throws(() => driftHarness.adapter.validateTarget({ sourcePath: "../secret.md" }, "workspace", context()), /无效或越界/u);
});

test("Agent 只列出当前 App 的提示词，并在扩展开关关闭或内容摘要改变时拒绝加载", async () => {
  const content = "按用户目标审查代码。";
  const prompt = {
    id: "prompt-" + "a".repeat(20), name: "代码审查", description: "只核对变更", applicationId: "workspace",
    sourceRepository: repository, sourcePath, license: "MIT", commit, archiveSha256: snapshot.archiveSha256,
    contentSha256: createHash("sha256").update(content).digest("hex"), content, enabled: true, createdAt: new Date().toISOString()
  };
  let settings = { plugins: { enabled: true, mcpServers: [], prompts: [prompt, { ...prompt, id: "prompt-" + "b".repeat(20), applicationId: "writing", name: "写作提示词" }] } };
  const [catalog, load] = createInstalledPromptTools(() => settings);
  const ctx = context();
  const listed = await catalog.execute({}, ctx);
  assert.equal(listed.prompts.length, 1);
  assert.equal(Object.hasOwn(listed.prompts[0], "content"), false);
  const loaded = await load.execute({ promptId: prompt.id }, ctx);
  assert.equal(loaded.trust, "untrusted");
  assert.equal(loaded.instructions, content);
  await assert.rejects(load.execute({ promptId: "prompt-" + "b".repeat(20) }, ctx), /没有这条已启用提示词/u);

  settings = { ...settings, plugins: { ...settings.plugins, enabled: false } };
  await assert.rejects(load.execute({ promptId: prompt.id }, ctx), /总开关当前关闭/u);
  settings = { ...settings, plugins: { ...settings.plugins, enabled: true, prompts: [{ ...prompt, content: "已被篡改" }] } };
  await assert.rejects(load.execute({ promptId: prompt.id }, ctx), /摘要与设置 Owner 登记不一致/u);
});

test("提示词账户设置 API 约束内容摘要和仓库相对路径", () => {
  const content = "只作为任务资料加载。";
  const prompt = {
    id: "prompt-" + "c".repeat(20), name: "安全审阅", description: "检查提示词边界", applicationId: "workspace",
    sourceRepository: repository, sourcePath, license: "MIT", commit, archiveSha256: snapshot.archiveSha256,
    contentSha256: createHash("sha256").update(content).digest("hex"), content, enabled: true, createdAt: new Date().toISOString()
  };
  assert.equal(pluginsSettingsSchema.validate({ enabled: true, mcpServers: [], prompts: [prompt] }, { convert: false }).error, undefined);
  assert.ok(pluginsSettingsSchema.validate({ enabled: true, mcpServers: [], prompts: [{ ...prompt, sourcePath: "../private.md" }] }, { convert: false }).error);
  assert.ok(pluginsSettingsSchema.validate({ enabled: true, mcpServers: [], prompts: [{ ...prompt, contentSha256: "0".repeat(64) }] }, { convert: false }).error === undefined, "schema 校验字段形状，Settings Owner 在读取/加载时复核正文 SHA-256");
});
