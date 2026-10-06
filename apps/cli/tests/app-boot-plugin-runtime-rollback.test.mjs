/**
 * 功能：验证可选 Cordis 插件启用失败后的状态回滚与重启恢复。
 * 作用：在隔离 Profile 中启动临时插件，制造运行时失败，并以独立进程确认持久化停用状态。
 * 关联文件：packages/boot/app-boot/src/index.ts、packages/boot/app-boot/src/plugin-runtime.ts。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const data = mkdtempSync(join(tmpdir(), "lfaa-plugin-runtime-rollback-"));
const patchRoot = mkdtempSync(join(tmpdir(), "lfaa-plugin-runtime-patch-"));
const reservation = createServer();
reservation.listen(0, "127.0.0.1");
await new Promise((resolve, reject) => {
  reservation.once("listening", resolve);
  reservation.once("error", reject);
});
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));

process.env.LFAA_DATA_DIR = data;
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "";
process.env.SERVER_HOST = "127.0.0.1";
process.env.SERVER_PORT = String(port);
process.env.LFAA_SERVE_FRONTEND = "false";
globalThis.__lfaaP0PluginEvents = [];
globalThis.__lfaaP0PluginFail = false;

const fixturePath = join(patchRoot, "plugin.mjs");
writeFileSync(fixturePath, `
export function apply(ctx, config) {
  globalThis.__lfaaP0PluginEvents.push("start:" + config.fixtureId);
  ctx.effect(() => () => globalThis.__lfaaP0PluginEvents.push("dispose:" + config.fixtureId));
  if (globalThis.__lfaaP0PluginFail) throw new Error("可选插件启用失败夹具");
}
export default { apply };
`, "utf8");
const entry = pathToFileURL(fixturePath).href;
const patchPath = join(patchRoot, "cordis.patch.yml");
writeFileSync(patchPath, [
  "- insert:",
  "    - id: p0-toggle-rollback",
  `      name: '${entry}'`,
  "      config:",
  "        fixtureId: toggle",
  ""
].join("\n"), "utf8");

const { boot } = await import("lfaa-app-boot/src/index.js");

test.after(async () => {
  delete globalThis.__lfaaP0PluginEvents;
  delete globalThis.__lfaaP0PluginFail;
  try {
    const { closeDatabase } = await import("lfaa-storage-sqlite/src/database.js");
    closeDatabase();
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ERR_INVALID_STATE")) throw error;
  }
  rmSync(data, { recursive: true, force: true });
  rmSync(patchRoot, { recursive: true, force: true });
});

test("可选插件启用失败回滚到停用状态，并在新进程重启后保持停用", async () => {
  const context = await boot(["web", "--patch", patchPath]);
  try {
    const plugin = () => context.lfaaPluginRuntime.list().find(item => item.id === "p0-toggle-rollback");
    assert.equal(plugin()?.enabled, true);
    await context.lfaaPluginRuntime.setEnabled("p0-toggle-rollback", false);
    assert.equal(plugin()?.disabled, true);

    globalThis.__lfaaP0PluginFail = true;
    await assert.rejects(context.lfaaPluginRuntime.setEnabled("p0-toggle-rollback", true), error =>
      error.code === "plugin_start_failed" || error.code === "plugin_runtime_action_failed");
    assert.equal(plugin()?.enabled, false);
    assert.equal(plugin()?.disabled, true, "失败启用回滚到操作前的停用状态");
    assert.deepEqual(globalThis.__lfaaP0PluginEvents, [
      "start:toggle",
      "dispose:toggle",
      "start:toggle",
      "dispose:toggle"
    ]);
  } finally {
    await context.fiber.dispose();
  }

  const child = spawnSync(process.execPath, [
    "--import", "tsx",
    "--import", "./register-package-loader.mjs",
    "--input-type=module",
    "-e",
    `globalThis.__lfaaP0PluginEvents=[];const {boot}=await import("lfaa-app-boot/src/index.js");const context=await boot(["web","--patch",${JSON.stringify(patchPath)}]);const item=context.lfaaPluginRuntime.list().find(plugin=>plugin.id==="p0-toggle-rollback");console.log("P0_RESTART_STATE="+JSON.stringify({enabled:item?.enabled,disabled:item?.disabled,starts:globalThis.__lfaaP0PluginEvents.length}));await context.fiber.dispose();`
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 15_000,
    env: { ...process.env, LFAA_DATA_DIR: data, SERVER_PORT: String(port) }
  });
  assert.equal(child.status, 0, `隔离重启进程失败：${child.stderr || child.stdout}`);
  const stateLine = child.stdout.split(/\r?\n/u).find(line => line.startsWith("P0_RESTART_STATE="));
  assert.ok(stateLine, `重启进程未输出插件状态：${child.stdout}`);
  assert.deepEqual(JSON.parse(stateLine.slice("P0_RESTART_STATE=".length)), {
    enabled: false,
    disabled: true,
    starts: 0
  });
});
