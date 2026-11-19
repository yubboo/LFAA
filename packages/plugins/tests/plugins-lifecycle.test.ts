// @lfaa/plugins 装卸闭环回归测试：验证安装、启用、工具与技能贡献、停用撤销、二创及卸载。
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { skillsPlugin } from "@lfaa/skills";
import { toolsPlugin } from "@lfaa/tools";
import { pluginsPlugin } from "../src/index";

test("文本计数插件走完安装、启用、工具执行、技能注入、停用、二创与卸载", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "lfaa-plugins-test-"));
  const profilesBaseDir = join(root, "profiles");
  const personalDir = join(root, "skills");
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const ctx = new Context();
  const toolsFiber = ctx.plugin(toolsPlugin, { includeBuiltins: false });
  const skillsFiber = ctx.plugin(skillsPlugin, { personalDir });
  await Promise.all([toolsFiber, skillsFiber]);

  const pluginsFiber = ctx.plugin(pluginsPlugin, { profile: "web", profilesBaseDir });
  await pluginsFiber;
  ctx.plugins.setSkillRegistrar((id, list) => ctx.skills.registerPluginSkills(id, list));

  t.after(async () => {
    await pluginsFiber.dispose();
    await skillsFiber.dispose();
    await toolsFiber.dispose();
  });

  // 1. 安装但未启用时，不注册工具与技能
  const installed = await ctx.plugins.installPlugin({ catalogId: "text-counter" });
  assert.equal(installed.status, "disabled");
  assert.equal(ctx.tools.getTool("count_text_stats"), undefined);

  // 2. 启用后工具与技能生效
  const running = await ctx.plugins.enablePlugin("text-counter");
  assert.equal(running.status, "running");
  const tool = ctx.tools.getTool("count_text_stats");
  assert.ok(tool);
  const execRes = await ctx.tools.executeTool("count_text_stats", { text: "Hello 世界" }, {
    sessionId: "s1",
    runId: "r1",
    workspaceRoots: [],
    signal: new AbortController().signal,
  });
  assert.equal(execRes.ok, true);
  assert.match(execRes.summary, /中文 2/);

  const pluginSkills = await ctx.skills.listSkills();
  assert.ok(pluginSkills.some((s) => s.source === "plugin" && s.pluginId === "text-counter"));

  // 3. 停用后工具与技能即时撤销
  const disabled = await ctx.plugins.disablePlugin("text-counter");
  assert.equal(disabled.status, "disabled");
  assert.equal(ctx.tools.getTool("count_text_stats"), undefined);
  const afterDisableSkills = await ctx.skills.listSkills();
  assert.equal(afterDisableSkills.some((s) => s.pluginId === "text-counter"), false);

  // 4. 二创与卸载
  const forked = await ctx.plugins.forkPlugin("text-counter");
  assert.equal(forked.originPluginId, "text-counter");
  assert.equal(await ctx.plugins.uninstallPlugin("text-counter"), true);
  const state = await ctx.plugins.listState();
  assert.equal(state.installed.some((p) => p.id === "text-counter"), false);
  const webRoot = join(profilesBaseDir, "web");
  for (const required of [
    "package.json",
    "pnpm-workspace.yaml",
    "cordis.yml",
    "cordis.patch.yml",
    "pnpm-lock.yaml",
    "node_modules",
    join(".plugin-manager", "installed.json"),
  ]) {
    assert.ok(existsSync(join(webRoot, required)), `缺少 DSH Profile 文件/目录：${required}`);
  }
  const cordisYml = await readFile(join(webRoot, "cordis.yml"), "utf8");
  assert.match(cordisYml, /plugins:/);
});
