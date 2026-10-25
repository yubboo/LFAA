/**
 * 功能：回归小鱼核心（人格正文）与系统提示词的组合边界。
 * 作用：验证唯一登记、稳定顺序、名称配置、卸载回退与正文体积上界，不触碰账户、设置或网络。
 * 关联文件：packages/preset/persona、packages/core/system-prompt/src/persona.ts、bundle/base。
 */
import test from "node:test";
import assert from "node:assert/strict";
const { Context } = await import("@deepseek-ai/cordis");
const { composeLfaaSystemPrompt } = await import("lfaa-system-prompt");
const { registerLfaaPersonaCore, getLfaaPersonaCore } = await import("lfaa-system-prompt/src/persona.js");
const persona = await import("lfaa-persona");

const baseInput = { applicationId: "workspace", permissionMode: "full_access", extensions: [], systemPrompt: "AGENT-MARKER", context: "CTX-MARKER" };

test("未装配人格核心时组合结果保持原样：不注入领域正文", () => {
  const text = composeLfaaSystemPrompt(baseInput);
  assert.doesNotMatch(text, /当前真实接通的领域/);
  assert.doesNotMatch(text, /领域工作约定/);
  assert.match(text, /按需/);
});

test("真实插件登记后身份与领域地图排在核心指引之后、领域约定排在 Agent 指引之后", async t => {
  const ctx = new Context();
  const fiber = await ctx.plugin(await import("lfaa-persona"));
  try {
    const text = composeLfaaSystemPrompt(baseInput);
    const prefixAt = text.indexOf("当前真实接通的领域");
    const permissionAt = text.indexOf("当前项目权限模式是");
    const agentAt = text.indexOf("AGENT-MARKER");
    const suffixAt = text.indexOf("领域工作约定");
    const contextAt = text.indexOf("CTX-MARKER");
    assert.ok(prefixAt > 0, "身份与领域地图必须进入系统提示词");
    assert.ok(prefixAt < permissionAt, "身份先于权限模式");
    assert.ok(permissionAt < agentAt, "权限模式先于按需 Agent 指引");
    assert.ok(agentAt < suffixAt, "领域约定排在 Agent 指引之后");
    assert.ok(suffixAt < contextAt, "领域约定排在运行上下文之前");
    // 领域清单必须与当前装配一致：三个领域有工具，联机如实说明尚未接入工具。
    assert.match(text, /minecraft_\*/);
    assert.match(text, /steamcmd_\*/);
    assert.match(text, /writing_\*/);
    assert.match(text, /尚未接入 Agent 工具/);
    assert.doesNotMatch(text, /connectivity_[a-z_]+/u, "未接入的联机工具不得出现在正文");
    const core = persona.buildXiaoyuCore();
    const bytes = Buffer.byteLength(core.prefix + (core.suffix ?? ""), "utf8");
    assert.ok(bytes < 6000, "人格正文必须保持有界，避免挤占每次请求的上下文");
    t.diagnostic("小鱼核心正文 " + bytes + " 字节，版本 " + persona.XIAOYU_CORE_VERSION);
  } finally {
    await fiber.dispose();
  }
  const after = composeLfaaSystemPrompt(baseInput);
  assert.doesNotMatch(after, /当前真实接通的领域/, "卸载后不得残留领域正文");
});

test("名称由部署配置决定，默认小鱼/大肥鱼", () => {
  const defaults = persona.buildXiaoyuCore();
  assert.equal(defaults.displayName, "小鱼");
  assert.match(defaults.prefix, /大肥鱼/);
  const renamed = persona.buildXiaoyuCore({ displayName: "大肥鱼", alias: "小鱼" });
  assert.equal(renamed.displayName, "大肥鱼");
  assert.match(renamed.prefix, /你的身份是「大肥鱼」/);
  assert.match(renamed.prefix, /「小鱼」/);
  assert.equal(renamed.version, defaults.version);
});

test("重复登记与空正文都失败关闭，不静默覆盖或削弱身份", async () => {
  const first = new Context();
  const firstFiber = await first.plugin({ name: "fixture-persona-first", apply(owner) { persona.apply(owner); } });
  const second = new Context();
  await assert.rejects(async () => { await second.plugin({ name: "fixture-persona-second", apply(owner) { persona.apply(owner); } }); }, /已由其他插件登记/);
  await firstFiber.dispose();
  assert.equal(getLfaaPersonaCore(), null, "卸载后不再保留任何身份正文");
  assert.equal(persona.buildXiaoyuCore({ displayName: "  " }).displayName, "小鱼", "空白名称回退到默认名称，不产生未命名身份");
  const blank = new Context();
  const blankFiber = await blank.plugin({ name: "fixture-persona-blank", apply(owner) { registerLfaaPersonaCore(owner, () => ({ displayName: "小鱼", version: "1.0.0", prefix: "   " })); } });
  await assert.rejects(async () => getLfaaPersonaCore(), /缺少身份正文/);
  await blankFiber.dispose();
  assert.equal(getLfaaPersonaCore(), null);
});
