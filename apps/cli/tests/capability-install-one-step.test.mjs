/**
 * 功能：回归“一句话安装 Skill”工具的一次调用闭环。
 * 作用：验证单来源直接安装、多候选只返回候选不安装、缺少来源时解析失败；使用隔离假适配器，不访问网络。
 * 关联文件：packages/boot/capability-installs、bundle/base、apps/cli/tests/capability-skill.test.mjs。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const { Context } = await import("@deepseek-ai/cordis");
const { APPLICATION_IDS } = await import("lfaa-util-values/src/application-id.js");

const context = { userId: randomUUID(), userRole: "admin", applicationId: "workspace", agentRunId: randomUUID(), signal: new AbortController().signal, onProgress() {} };

function createFixtureAdapter() {
  const installed = [];
  return {
    installed,
    kind: "skill",
    applicationIds: [...APPLICATION_IDS],
    targetSchema: {},
    validateTarget() { return {}; },
    revalidateTarget() { return {}; },
    targetSummary() { return "当前账户共享 Skill 库"; },
    async search(query) {
      return { candidates: query === "ambiguous"
        ? [{ fullName: "acme/one" }, { fullName: "acme/two" }]
        : [{ fullName: "acme/demo" }] };
    },
    async inspect(source) { return { resolvedRef: "commit-abc123", details: { name: "demo" } }; },
    async install(source, resolvedRef) { const record = { id: "skill-demo", source, resolvedRef }; installed.push(record); return record; },
    async verifyInstalled(installation) { return { status: "ready", verified: true, summary: "已由 Owner 回读", details: installation }; },
    list() { return installed; }
  };
}

async function build() {
  const ctx = new Context();
  await ctx.plugin(await import("lfaa-tools"));
  const fiber = await ctx.plugin(await import("lfaa-capability-installs"));
  const adapter = createFixtureAdapter();
  ctx.lfaaCapabilityInstalls.register(ctx, adapter);
  const tools = ctx.lfaaTools.listAiBusinessTools("workspace", "admin", null, "full_access", true);
  const tool = tools.find(item => item.name === "capability_install_skill");
  return { ctx, fiber, adapter, tool };
}

test("一句话安装：明确来源时一次完成检查与安装，并回读 Owner 结果", async () => {
  const { fiber, adapter, tool } = await build();
  try {
    assert.ok(tool, "必须登记 capability_install_skill");
    assert.equal(tool.risk({}), "dangerous", "安装必须按危险操作走审批");
    const result = await tool.execute({ source: "https://github.com/acme/demo" }, context);
    assert.equal(result.installed, true);
    assert.equal(result.source, "https://github.com/acme/demo");
    assert.equal(result.inspection.resolvedRef, "commit-abc123");
    assert.equal(result.outcome, "verified_ready", "回读确认 ready 才报告可用");
    assert.equal(adapter.installed.length, 1);
  } finally { await fiber.dispose(); }
});

test("只给关键词时先搜索；多候选只返回候选，不安装", async () => {
  const { fiber, adapter, tool } = await build();
  try {
    const single = await tool.execute({ query: "demo" }, context);
    assert.equal(single.installed, true);
    assert.equal(adapter.installed.length, 1);
    const ambiguous = await tool.execute({ query: "ambiguous" }, context);
    assert.equal(ambiguous.installed, false);
    assert.equal(ambiguous.candidates.length, 2);
    assert.equal(adapter.installed.length, 1, "多候选不得安装任何一项");
  } finally { await fiber.dispose(); }
});

test("既没有来源也没有关键词时解析失败，不触达 Owner", async () => {
  const { fiber, adapter, tool } = await build();
  try {
    assert.throws(() => tool.parse({}), /请提供 Skill 的 GitHub 来源/u);
    assert.equal(adapter.installed.length, 0);
  } finally { await fiber.dispose(); }
});
