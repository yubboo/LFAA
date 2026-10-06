/**
 * 功能：核验 Cordis 可选插件停用和手动重载失败时的状态恢复。
 * 作用：在隔离 Web Profile 中制造一次性卸载/启动故障，检查生命周期状态和后续修复。
 * 关联文件：packages/boot/app-boot/src/plugin-runtime.ts、packages/boot/app-boot/src/index.ts。
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const data = mkdtempSync(join(tmpdir(), "lfaa-plugin-failure-data-"));
const patchRoot = mkdtempSync(join(tmpdir(), "lfaa-plugin-failure-patch-"));
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
globalThis.__lfaaPluginFailureFixture = { events: [], failStarts: 0 };

const fixturePath = join(patchRoot, "plugin.mjs");
writeFileSync(fixturePath, `
export function apply(ctx, config) {
  const fixture = globalThis.__lfaaPluginFailureFixture;
  fixture.events.push("start:" + config.fixtureId);
  ctx.effect(() => () => fixture.events.push("dispose:" + config.fixtureId));
  if (fixture.failStarts > 0) {
    fixture.failStarts -= 1;
    throw new Error("一次性插件启动失败夹具");
  }
}
export default { apply };
`, "utf8");
const patchPath = join(patchRoot, "cordis.patch.yml");
writeFileSync(patchPath, [
  "- insert:",
  "    - id: p0-lifecycle-failure-fixture",
  `      name: '${pathToFileURL(fixturePath).href}'`,
  "      config:",
  "        fixtureId: lifecycle",
  ""
].join("\n"), "utf8");

const { boot } = await import("lfaa-app-boot/src/index.js");
const context = await boot(["web", "--patch", patchPath]);
const plugin = () => context.lfaaPluginRuntime.list().find(item => item.id === "p0-lifecycle-failure-fixture");

test.after(async () => {
  delete globalThis.__lfaaPluginFailureFixture;
  await context.fiber.dispose();
  try {
    const { closeDatabase } = await import("lfaa-storage-sqlite/src/database.js");
    closeDatabase();
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ERR_INVALID_STATE")) throw error;
  }
  rmSync(data, { recursive: true, force: true });
  rmSync(patchRoot, { recursive: true, force: true });
});

test("Loader 停用更新失败时管理器回滚到原状态且不保存用户偏好", async () => {
  assert.equal(plugin()?.enabled, true);
  const loader = context.loader;
  const update = loader.update.bind(loader);
  let failNextDisable = true;
  loader.update = async (runtimeId, patch) => {
    if (failNextDisable && patch.disabled === true) {
      failNextDisable = false;
      throw new Error("一次性 Loader 停用更新失败夹具");
    }
    return update(runtimeId, patch);
  };
  try {
    await assert.rejects(context.lfaaPluginRuntime.setEnabled("p0-lifecycle-failure-fixture", false));
  } finally {
    loader.update = update;
  }

  const afterFailure = plugin();
  assert.ok(afterFailure);
  assert.equal(afterFailure.enabled, true, "停用失败后必须恢复原活动状态");
  assert.equal(afterFailure.disabled, false);
  assert.equal(afterFailure.canToggle, true);
  assert.deepEqual(globalThis.__lfaaPluginFailureFixture.events, ["start:lifecycle"], "失败更新不能提前卸载或重启插件");

  await context.lfaaPluginRuntime.setEnabled("p0-lifecycle-failure-fixture", false);
  assert.equal(plugin()?.disabled, true);
  await context.lfaaPluginRuntime.setEnabled("p0-lifecycle-failure-fixture", true);
});

test("手动重载的新实例启动失败时可见失败态并可通过停用再启用恢复", async () => {
  await context.lfaaPluginRuntime.setEnabled("p0-lifecycle-failure-fixture", true);
  globalThis.__lfaaPluginFailureFixture.failStarts = 1;
  await assert.rejects(context.lfaaPluginRuntime.reload("p0-lifecycle-failure-fixture"));

  const afterFailure = plugin();
  assert.ok(afterFailure);
  assert.equal(afterFailure.state, "FAILED");
  assert.equal(afterFailure.disabled, false, "手动重载失败不能静默保存为用户停用偏好");
  assert.equal(afterFailure.canToggle, true, "管理员仍可执行显式停用/启用恢复");

  await context.lfaaPluginRuntime.setEnabled("p0-lifecycle-failure-fixture", false);
  assert.equal(plugin()?.disabled, true);
  await context.lfaaPluginRuntime.setEnabled("p0-lifecycle-failure-fixture", true);
  assert.equal(plugin()?.enabled, true);
});
