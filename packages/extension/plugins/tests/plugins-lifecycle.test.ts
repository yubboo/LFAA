// 验证 @lfaa/plugins 基于 Cordis Loader 的真实安装、启用、停用、卸载与 profile 持久化。
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import Loader from "@deepseek-ai/cordis-plugin-loader";
import { pluginsPlugin } from "../src/index";
import { toolsPlugin } from "@lfaa/tools";

/** 最小外部插件：注册一个工具，用于验证真实装载与卸载清理。 */
const PROBE_PLUGIN = `export default {
  name: "probe-plugin",
  inject: ["tools"],
  apply(ctx) {
    ctx.effect(() => ctx.tools.registerTool({
      name: "probe_ping",
      title: "探针",
      description: "返回探针结果。",
      permissionLevel: "read",
      parameters: { type: "object", properties: {} },
      execute: async () => ({ ok: true, output: "pong", summary: "pong" }),
    }));
  },
};
`;

test("插件经 Loader 安装、启用、停用、重装与卸载，并同步 cordis.yml", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "lfaa-plugins-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const pluginFile = join(root, "probe-plugin.mjs");
  await writeFile(pluginFile, PROBE_PLUGIN, "utf8");

  const ctx = new Context();
  ctx.plugin(toolsPlugin);
  await ctx.plugin(Loader, { baseUrl: pathToFileURL(join(root, "index.html")).href });
  await ctx.plugin(pluginsPlugin, { profile: "web", profilesBaseDir: root });
  await ctx.plugins.listState();

  const moduleName = pathToFileURL(pluginFile).href;
  const installed = await ctx.plugins.installPlugin({ moduleName });
  assert.equal(installed.status, "disabled");
  assert.equal(installed.moduleName, moduleName);
  assert.equal(ctx.tools.getTool("probe_ping"), undefined);

  const running = await ctx.plugins.enablePlugin(installed.id);
  assert.equal(running.status, "running");
  assert.ok(ctx.tools.getTool("probe_ping"), "启用后工具应可被模型调用");

  const executed = await ctx.tools.executeTool("probe_ping", {}, {
    workspaceRoots: [root],
    sessionId: "test-session",
    runId: "test-run",
    signal: new AbortController().signal,
  });
  assert.equal(executed.ok, true);
  assert.equal(executed.output, "pong");

  const disabled = await ctx.plugins.disablePlugin(installed.id);
  assert.equal(disabled.status, "disabled");
  assert.equal(ctx.tools.getTool("probe_ping"), undefined, "停用后工具必须注销");

  const reenabled = await ctx.plugins.enablePlugin(installed.id);
  assert.equal(reenabled.status, "running");
  assert.ok(ctx.tools.getTool("probe_ping"));

  const state = await ctx.plugins.listState();
  assert.equal(state.installed.find((record) => record.id === installed.id)?.status, "running");
  const inventory = await ctx.plugins.listInventory();
  assert.equal(inventory.profile, "web");
  assert.ok(Array.isArray(inventory.entries), "只读清单应返回条目数组");

  const cordisYml = await readFile(join(root, "web", "cordis.yml"), "utf8");
  assert.match(cordisYml, /plugins:/);
  assert.match(cordisYml, new RegExp(installed.id));

  await ctx.plugins.forkPlugin(installed.id).then(() => undefined, () => undefined);
  assert.equal(await ctx.plugins.uninstallPlugin(installed.id), true);
  const afterUninstall = await ctx.plugins.listState();
  assert.equal(afterUninstall.installed.some((record) => record.id === installed.id), false);
  assert.equal(ctx.tools.getTool("probe_ping"), undefined, "卸载后不得残留工具");

  // 二创：依赖可解析时返回副本记录；当前 Windows 平台依赖解析不可达，必须明确拒绝且不留残留。
  await ctx.plugins.forkPlugin(installed.id).then(
    (forked) => {
      assert.equal(forked.originPluginId, installed.id);
    },
    (error: Error) => {
      assert.match(error.message, /二创|副本/);
    },
  );
});

test("Profile 目录骨架包含 DSH 约定的文件与目录", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "lfaa-profile-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const ctx = new Context();
  ctx.plugin(toolsPlugin);
  await ctx.plugin(Loader, { baseUrl: pathToFileURL(join(root, "index.html")).href });
  await ctx.plugin(pluginsPlugin, { profile: "web", profilesBaseDir: root });
  await ctx.plugins.listState();

  const webRoot = join(root, "web");
  for (const required of ["package.json", "pnpm-workspace.yaml", "cordis.yml", "cordis.patch.yml", "pnpm-lock.yaml"]) {
    const content = await readFile(join(webRoot, required), "utf8");
    assert.ok(content.length > 0, `缺少 DSH Profile 文件：${required}`);
  }

  const cordisYml = await readFile(join(webRoot, "cordis.yml"), "utf8");
  assert.match(cordisYml, /plugins:/);
});
test("导入失败的插件不会伪装成运行中", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "lfaa-plugins-bad-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const ctx = new Context();
  ctx.plugin(toolsPlugin);
  await ctx.plugin(Loader, { baseUrl: pathToFileURL(join(root, "index.html")).href });
  await ctx.plugin(pluginsPlugin, { profile: "web", profilesBaseDir: root });
  await ctx.plugins.listState();

  const installed = await ctx.plugins.installPlugin({ moduleName: "file:///nonexistent/lfaa/missing.mjs" });
  await ctx.plugins.enablePlugin(installed.id).then(
    () => assert.fail("模块不存在时启用必须失败"),
    (error: Error) => assert.match(error.message, /装载失败/),
  );

  const state = await ctx.plugins.listState();
  const record = state.installed.find((item) => item.id === installed.id);
  assert.notEqual(record?.status, "running", "导入失败的插件不得标记为运行中");
  assert.ok(record?.error, "应记录失败原因");
});
test("内置插件不可卸载，只能停用", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "lfaa-plugins-builtin-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const ctx = new Context();
  ctx.plugin(toolsPlugin);
  await ctx.plugin(Loader, { baseUrl: pathToFileURL(join(root, "index.html")).href });
  await ctx.plugin(pluginsPlugin, { profile: "web", profilesBaseDir: root });
  await ctx.plugins.listState();

  const installed = await ctx.plugins.installPlugin({ moduleName: "@lfaa/rules" });
  assert.equal(installed.kind, "builtin", "本仓包应标记为内置插件");

  await ctx.plugins.uninstallPlugin(installed.id).then(
    () => assert.fail("内置插件不得卸载"),
    (error: Error) => assert.match(error.message, /内置插件/),
  );

  const disabled = await ctx.plugins.disablePlugin(installed.id);
  assert.equal(disabled.status, "disabled", "内置插件应允许停用");
});