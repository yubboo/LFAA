/** 功能：验证必需服务可按 Profile 补丁替换实现。作用：检查替换装配和必需插件停用保护。 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const data = mkdtempSync(join(tmpdir(), "lfaa-required-plugin-replacement-data-"));
const root = mkdtempSync(join(tmpdir(), "lfaa-required-plugin-replacement-"));
const reservation = createServer();
reservation.listen(0, "127.0.0.1");
await new Promise((resolve, reject) => { reservation.once("listening", resolve); reservation.once("error", reject); });
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
process.env.LFAA_DATA_DIR = data;
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "";
process.env.SERVER_HOST = "127.0.0.1";
process.env.SERVER_PORT = String(port);
process.env.LFAA_SERVE_FRONTEND = "false";

const implementation = join(root, "replacement.mjs");
writeFileSync(implementation, `export function apply(ctx){ctx.provide("lfaaCompaction",{fixture:"replacement",createBasicCompactionEngine(){throw new Error("fixture engine");}})}\n`, "utf8");
const patch = join(root, "replace.yml");
writeFileSync(patch, `- id: compaction-basic\n  name: ${JSON.stringify(pathToFileURL(implementation).href)}\n`, "utf8");
const disablePatch = join(root, "disable.yml");
writeFileSync(disablePatch, "- id: compaction-basic\n  disabled: true\n", "utf8");
const { boot } = await import("lfaa-app-boot/src/index.js");

test.after(async () => {
  const { closeDatabase } = await import("lfaa-storage-sqlite/src/database.js");
  try { closeDatabase(); } catch (error) { if (!(error instanceof Error && "code" in error && error.code === "ERR_INVALID_STATE")) throw error; }
  rmSync(data, { recursive: true, force: true });
  rmSync(root, { recursive: true, force: true });
});

test("必需扩展服务可由同一装配 ID 替换，且必需服务仍不可停用", async () => {
  const context = await boot(["web", "--patch", patch]);
  try { assert.equal(context.get("lfaaCompaction")?.fixture, "replacement"); }
  finally { await context.fiber.dispose(); }
  await assert.rejects(boot(["web", "--patch", disablePatch]), /必需插件不能被停用：compaction-basic/u);
});
