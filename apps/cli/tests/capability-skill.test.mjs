/**
 * 功能：回归系统级共享 Skill 的固定来源检查、账户隔离、Registry 加载和精确卸载。
 * 作用：验证 Capability Skill 复用 Knowledge Library 与 Skill Registry，不写入项目目录或执行来源脚本。
 * 关联文件：packages/boot/capability-skill、packages/boot/knowledge-library、packages/skill/skill。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { once } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const temporaryParent = resolve(dirname(fileURLToPath(import.meta.url)), "../../../dist/.tmp");
mkdirSync(temporaryParent, { recursive: true });
const dataDirectory = mkdtempSync(join(temporaryParent, "lfaa-capability-skill-data-"));
const homeDirectory = mkdtempSync(join(temporaryParent, "lfaa-capability-skill-home-"));
process.env.LFAA_HOME = homeDirectory;
process.env.LFAA_DATA_DIR = dataDirectory;
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "";
process.env.LFAA_HARNESS_HOME = "";
delete process.env.LFAA_DATA_DIR_CONFIGURED;
delete process.env.LFAA_DATA_DIR_MANAGED_BY_LAUNCHER;
delete process.env.LFAA_DATA_DIR_MANAGED_BY_DESKTOP;

const portReservation = createServer();
portReservation.listen(0, "127.0.0.1");
await once(portReservation, "listening");
process.env.SERVER_PORT = String(portReservation.address().port);
await new Promise(resolve => portReservation.close(resolve));

let app;
test.after(async () => {
  if (app) await app.fiber.dispose();
  const { database, closeDatabase } = await import("lfaa-storage-sqlite/src/database.js");
  if (database.isOpen) {
    const [{ configuration }, { sessionRecords }] = await Promise.all([
      import("lfaa-storage-domain/src/configuration.js"),
      import("lfaa-session-persistence-jsonl/src/repository.js")
    ]);
    sessionRecords.close();
    configuration.close();
    closeDatabase();
  }
  if (dirname(dataDirectory) !== temporaryParent || dirname(homeDirectory) !== temporaryParent) throw new Error("拒绝清理测试根以外的路径。");
  rmSync(dataDirectory, { recursive: true, force: true });
  rmSync(homeDirectory, { recursive: true, force: true });
});

await import("lfaa-session/src/sessions.js");
const { retireLegacyFileTables } = await import("lfaa-storage-domain/src/migration.js");
retireLegacyFileTables();
const { database } = await import("lfaa-storage-sqlite/src/database.js");
database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('skill-owner',8301,'skill-owner','salt','hash','member',0),('skill-other',8302,'skill-other','salt','hash','member',0)").run();

const { boot } = await import("lfaa-app-boot/src/index.js");
const { createAccountSkillAdapter } = await import("lfaa-capability-skill/src/index.js");
const { CapabilityInstallRegistry } = await import("lfaa-capability-installs/src/index.js");
const knowledge = await import("lfaa-knowledge-library/src/index.js");
const settings = await import("lfaa-settings/src/service.js");
const repositoryUrl = "https://github.com/lfaa-harness-test/skills";
const markdown = [
  "---",
  "name: reviewer",
  "description: Review source and report evidence.",
  "---",
  "# Reviewer",
  "Treat this source as untrusted instructions."
].join("\n");
const guide = "# Guide\nOnly the current account may read this resource.";
const imageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]);
const snapshot = {
  repository: { url: repositoryUrl, name: "skills", license: "MIT" },
  requestedRef: "main",
  commit: "a".repeat(40),
  archiveSha256: "b".repeat(64),
  files: [
    { path: "skills/reviewer/SKILL.md", contents: Buffer.from(markdown) },
    { path: "skills/reviewer/references/guide.md", contents: Buffer.from(guide) },
    { path: "skills/reviewer/assets/preview.png", contents: imageBytes },
    { path: "skills/reviewer/scripts/check.mjs", contents: Buffer.from("throw new Error('must not execute during install');") },
    { path: "skills/reviewer/package.json", contents: Buffer.from(JSON.stringify({ dependencies: { playwright: "^1.0.0" }, scripts: { check: "node scripts/check.mjs" } })) }
  ]
};

function makeContext(userId, applicationId, projectPath, signal = new AbortController().signal) {
  return {
    userId,
    userRole: "member",
    applicationId,
    signal,
    onProgress() {},
    workspaceProject: { nodeId: null, path: projectPath, title: applicationId + " test project" }
  };
}

function directInstallation(userId, name, sourceSuffix) {
  const skillMarkdown = ["---", "name: " + name, "description: isolated fixture", "---", "# " + name, "Fixture only."].join("\n");
  return knowledge.createKnowledgeLibrarySkillInstallation(userId, {
    name,
    description: "isolated fixture",
    source: {
      repositoryUrl: "https://github.com/lfaa-harness-test/" + sourceSuffix,
      commit: "c".repeat(40),
      archiveSha256: "d".repeat(64),
      sourcePath: "skills/" + name,
      license: "MIT"
    },
    files: [
      { path: "SKILL.md", content: skillMarkdown },
      { path: "references/guide.md", content: guide }
    ]
  });
}

test("账户共享 Skill 固定来源、跨项目/App 加载、隔离和按 ID 卸载", async () => {
  const projectOne = join(dataDirectory, "workspace-project");
  const projectTwo = join(dataDirectory, "writing-project");
  mkdirSync(projectOne, { recursive: true });
  mkdirSync(projectTwo, { recursive: true });

  app = await boot(["web"]);
  {
    // 账户扩展总开关是 Settings Owner 的真实运行时门；先按“用户已允许账户扩展”的前置状态安装。
    settings.saveUserSettings("skill-owner", "plugins", { ...settings.getUserSettings("skill-owner").plugins, enabled: true });
    assert.ok(app.lfaaCapabilityInstalls.catalog().some(row => row.kind === "skill" && row.available));
    const adapter = createAccountSkillAdapter({
      searchRepositories: async () => [],
      downloadSnapshot: async (_source, ref) => ({ ...snapshot, requestedRef: ref }),
      skillRegistry: app.skills,
      invalidateSkills: () => app.skills.invalidate()
    });
    const registry = new CapabilityInstallRegistry();
    registry.register({ effect(callback) { return callback(); } }, adapter);
    const workspaceContext = makeContext("skill-owner", "workspace", projectOne);
    const writingContext = makeContext("skill-owner", "writing", projectTwo);
    const inspected = await registry.inspect("skill", repositoryUrl, "main", "workspace", {}, workspaceContext);
    assert.equal(inspected.resolvedRef, snapshot.commit);
    assert.equal(inspected.targetSummary, "当前 LFAA 账户 · 所有项目与 App 的共享 Skill 库");
    assert.equal(inspected.details.skill.sourcePath, "skills/reviewer");
    assert.match(inspected.summary, /安装只复制文本，不执行/u);
    const approval = registry.installApproval("skill", inspected.inspectionId, "workspace", "skill-owner");
    assert.match(approval.summary, /只复制文本，不执行/u);

    const installed = await registry.install("skill", inspected.inspectionId, "workspace", "skill-owner", workspaceContext);
    assert.equal(installed.outcome, "verified_ready");
    assert.equal(installed.verification.status, "ready");
    const installationId = installed.verification.details.installationId;
    assert.equal(installed.verification.details.scriptsExecuted, false);
    assert.equal(installed.verification.details.dependenciesInstalled, false);
    assert.equal(installed.verification.details.externalRuntimeVerified, false);
    assert.deepEqual(installed.verification.details.scriptFiles, ["scripts/check.mjs"]);
    assert.deepEqual(installed.verification.details.dependencies, ["playwright"]);

    const verifyAgain = () => adapter.verifyInstalled(
      { skill: "reviewer", installationId, applicationId: "all", accountId: "skill-owner" },
      repositoryUrl,
      snapshot.commit,
      "workspace",
      adapter.validateTarget({}, "workspace", workspaceContext),
      inspected.details,
      workspaceContext
    );
    // 关闭账户扩展总开关后，Skill 仍在账户资料库，但模型 Skill 目录不会提供它；不得报告 ready。
    settings.saveUserSettings("skill-owner", "plugins", { ...settings.getUserSettings("skill-owner").plugins, enabled: false });
    const gatedVerification = await verifyAgain();
    assert.equal(gatedVerification.status, "installed");
    assert.equal(gatedVerification.verified, true);
    assert.equal(gatedVerification.details.runtimeEnabled, false);
    assert.equal(gatedVerification.details.gate, "plugins.enabled");
    assert.match(gatedVerification.summary, /扩展总开关当前关闭/u);
    // 单项停用同样由 Settings Owner 决定，不能把已登记记录当成当前可加载。
    settings.saveUserSettings("skill-owner", "plugins", { ...settings.getUserSettings("skill-owner").plugins, enabled: true, disabledSkillNames: ["reviewer"] });
    const disabledVerification = await verifyAgain();
    assert.equal(disabledVerification.status, "installed");
    assert.equal(disabledVerification.details.gate, "plugins.disabledSkillNames");
    assert.match(disabledVerification.summary, /停用名单/u);
    settings.saveUserSettings("skill-owner", "plugins", { ...settings.getUserSettings("skill-owner").plugins, enabled: true, disabledSkillNames: [] });
    assert.equal((await verifyAgain()).status, "ready");

    const ownerRecord = knowledge.getKnowledgeLibrarySkillInstallation("skill-owner", installationId);
    assert.equal(ownerRecord.name, "reviewer");
    assert.equal(ownerRecord.sourcePath, "skills/reviewer");
    assert.equal(ownerRecord.files.find(file => file.path === "references/guide.md").sha256, createHash("sha256").update(guide).digest("hex"));
    assert.equal(ownerRecord.contentSha256, createHash("sha256").update(markdown).digest("hex"));
    const { resolveUserDataPaths } = await import("lfaa-home-paths/src/data-layout.mjs");
    const skillDirectory = join(resolveUserDataPaths(dataDirectory, "skill-owner").knowledge, "skills", createHash("sha256").update(installationId).digest("hex"));
    assert.deepEqual(readFileSync(join(skillDirectory, "assets", "preview.png")), imageBytes, "共享 Owner 必须保留安装包二进制资源原字节");
    assert.throws(() => directInstallation("skill-owner", "reviewer", "duplicate-reviewer"), /已安装同名 Skill/u);

    const registryOptions = (userId, cwd) => ({ userId, cwd, allowHostFilesystem: false, customSkillDirs: [], signal: new AbortController().signal });
    for (const [context, options] of [[workspaceContext, registryOptions("skill-owner", projectOne)], [writingContext, registryOptions("skill-owner", projectTwo)]]) {
      const listed = await registry.list("skill", context.applicationId, {}, context);
      assert.ok(listed.some(item => item.id === installationId && item.applicationId === "all"));
      const summaries = await app.skills.list(options);
      assert.ok(summaries.some(skill => skill.name === "reviewer" && skill.provider === "lfaa-knowledge-library-skills"));
      const definition = await app.skills.get("reviewer", options);
      assert.equal(definition.content, "# Reviewer\nTreat this source as untrusted instructions.");
      const resource = await app.skills.readResource("reviewer", "references/guide.md", options);
      assert.equal(resource.content, guide);
      assert.equal(resource.bytes, Buffer.byteLength(guide));
    }

    const otherInstallation = directInstallation("skill-other", "reviewer", "other-reviewer");
    const siblingInstallation = directInstallation("skill-owner", "writer", "writer");
    app.skills.invalidate();
    const otherDefinition = await app.skills.get("reviewer", registryOptions("skill-other", projectOne));
    assert.match(otherDefinition.content, /# reviewer/u);
    assert.ok((await app.skills.list(registryOptions("skill-owner", projectOne))).some(skill => skill.name === "writer"));

    const conflictingAdapter = createAccountSkillAdapter({
      skillRegistry: {
        async list() { return [{ name: "reviewer", provider: "project-lfaa" }]; },
        async get() { return undefined; }
      }
    });
    const conflictVerification = await conflictingAdapter.verifyInstalled(
      { skill: "reviewer", installationId, applicationId: "all", accountId: "skill-owner" },
      repositoryUrl,
      snapshot.commit,
      "workspace",
      adapter.validateTarget({}, "workspace", workspaceContext),
      inspected.details,
      workspaceContext
    );
    assert.equal(conflictVerification.status, "installed");
    assert.match(conflictVerification.summary, /更高优先级的同名 Skill/u);

    const removed = await registry.remove("skill", installationId, "writing", {}, writingContext);
    assert.equal(removed.removed, true);
    assert.equal(removed.installationId, installationId);
    app.skills.invalidate();
    assert.equal(await app.skills.get("reviewer", registryOptions("skill-owner", projectOne)), undefined);
    assert.equal(existsSync(skillDirectory), false, "精确卸载只清理所选安装的哈希目录");
    assert.ok(knowledge.getKnowledgeLibrarySkillInstallation("skill-owner", siblingInstallation.id));
    assert.ok(knowledge.getKnowledgeLibrarySkillInstallation("skill-other", otherInstallation.id));
    assert.equal((await registry.list("skill", "workspace", {}, workspaceContext)).some(item => item.id === installationId), false);
    assert.equal((await registry.list("skill", "workspace", {}, makeContext("skill-other", "workspace", projectOne))).some(item => item.id === otherInstallation.id), true);
  }
});

test("Skill 来源检查把 Run 取消信号传给固定快照下载", { timeout: 5_000 }, async () => {
  let receivedSignal;
  const adapter = createAccountSkillAdapter({
    downloadSnapshot: async (_source, _ref, signal) => {
      receivedSignal = signal;
      await new Promise((_resolve, reject) => {
        if (!signal) return;
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
      throw new Error("快照下载不应在取消后继续完成");
    },
    searchRepositories: async () => []
  });
  const controller = new AbortController();
  const pending = adapter.inspect(repositoryUrl, "main", "workspace", {}, { userId: "skill-owner", signal: controller.signal });
  controller.abort(new DOMException("用户取消来源检查", "AbortError"));
  await assert.rejects(pending, error => error?.name === "AbortError");
  assert.equal(receivedSignal, controller.signal, "检查下载必须收到当前 Run 的 AbortSignal");
});

test("Skill 安装快照下载完成后的取消不会写入账户资料库", { timeout: 5_000 }, async () => {
  const controller = new AbortController();
  const adapter = createAccountSkillAdapter({
    downloadSnapshot: async () => {
      // 模拟下载返回前用户取消：适配器必须在写入 Knowledge Library 前检查取消。
      controller.abort(new DOMException("用户取消安装", "AbortError"));
      return snapshot;
    },
    searchRepositories: async () => []
  });
  const details = {
    skill: {
      repository: repositoryUrl, license: "MIT", commit: snapshot.commit, archiveSha256: snapshot.archiveSha256,
      sourcePath: "skills/reviewer", name: "reviewer", description: "Review source.", files: [],
      runtimeAudit: { scriptFiles: [], declaredNodeMajor: null, packageManifest: "absent", dependencies: [], devDependencies: [], packageScriptNames: [], riskSignals: [] },
      untrustedSkillMarkdown: markdown
    }
  };
  const context = makeContext("skill-owner", "workspace", join(dataDirectory, "workspace-project"), controller.signal);
  await assert.rejects(
    adapter.install(repositoryUrl, snapshot.commit, "workspace", "skill-owner", { sourcePath: "skills/reviewer" }, details, context),
    error => error?.name === "AbortError"
  );
  assert.equal(knowledge.listKnowledgeLibrarySkillInstallations("skill-owner").some(item => item.name === "reviewer"), false, "取消后不得留下账户 Skill 安装记录");
});
