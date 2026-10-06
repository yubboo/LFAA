/**
 * 功能：验证 Profile 启动失败时 Cordis 插件资源整体回滚。
 * 作用：在隔离数据目录和临时监听端口启动真实 Web Profile，确认失败插件及先前成功插件均被清理。
 * 关联文件：packages/boot/app-boot/src/index.ts、packages/boot/app-boot/src/plugin-runtime.ts。
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const data = mkdtempSync(join(tmpdir(), "lfaa-app-boot-rollback-"));
const patchRoot = mkdtempSync(join(tmpdir(), "lfaa-app-boot-patch-"));
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
globalThis.__lfaaP0BootRollbackEvents = [];

const fixturePath = join(patchRoot, "plugin.mjs");
writeFileSync(fixturePath, `
export function apply(ctx, config) {
  globalThis.__lfaaP0BootRollbackEvents.push("start:" + config.fixtureId);
  ctx.effect(() => () => globalThis.__lfaaP0BootRollbackEvents.push("dispose:" + config.fixtureId));
  if (config.fail) throw new Error("P0 启动失败夹具");
}
export default { apply };
`, "utf8");
const entry = pathToFileURL(fixturePath).href;
const patchPath = join(patchRoot, "cordis.patch.yml");
writeFileSync(patchPath, [
  "- insert:",
  "    - id: p0-rollback-ready",
  `      name: '${entry}'`,
  "      config:",
  "        fixtureId: ready",
  "    - id: p0-rollback-failed",
  `      name: '${entry}'`,
  "      config:",
  "        fixtureId: failed",
  "        fail: true",
  ""
].join("\n"), "utf8");
const { boot } = await import("lfaa-app-boot/src/index.js");

test.after(async () => {
  delete globalThis.__lfaaP0BootRollbackEvents;
  const { closeDatabase } = await import("lfaa-storage-sqlite/src/database.js");
  try { closeDatabase(); }
  catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ERR_INVALID_STATE")) throw error;
  }
  rmSync(data, { recursive: true, force: true });
  rmSync(patchRoot, { recursive: true, force: true });
});

test("Profile 启动失败会撤销已启动插件、失败插件和监听资源", async () => {
  await assert.rejects(boot(["web", "--patch", patchPath]), /插件未就绪/u);
  assert.deepEqual(globalThis.__lfaaP0BootRollbackEvents, [
    "start:ready",
    "start:failed",
    "dispose:failed",
    "dispose:ready"
  ]);
  await assert.rejects(fetch(`http://127.0.0.1:${port}/`), error => error.cause?.code === "ECONNREFUSED");
});
