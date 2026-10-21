/** 功能：验证当前 Session Query 仅返回归属会话的 JSONL 路径元数据。作用：隔离账户/Home/Data，不读取日志正文。 */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { isolateData } from "./isolated-data.mjs";

const isolatedRoot = isolateData(test, "session-storage-info");
process.env.LFAA_HOME = resolve(isolatedRoot, "home");
process.env.LFAA_DATA_DIR = resolve(isolatedRoot, "business-data");

const { database } = await import("lfaa-storage-sqlite/src/database.js");
await import("lfaa-session-persistence-jsonl/src/repository.js");
const { retireLegacyFileTables } = await import("lfaa-storage-domain/src/migration.js");
retireLegacyFileTables();
const { config } = await import("lfaa-launch-environment/src/config.js");
const sessions = await import("lfaa-session/src/sessions.js");
const owner = randomUUID(), other = randomUUID();
for (const [id, uid] of [[owner, 1], [other, 2]]) database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role) VALUES(?, ?, ?, 'fixture', 'fixture', 'admin')").run(id, uid, `fixture-${uid}`);

test("当前会话存储位置只返回账户/App 绑定的 JSONL 路径元数据", async () => {
  const turn = sessions.createAiTurn(owner, "workspace", null, "private body must not be returned");
  const sessionDirectory = resolve(config.homeDirectory, "sessions", createHash("sha256").update(turn.session.id).digest("hex"));
  const expected = {
    sessionId: turn.session.id,
    format: "jsonl",
    rootDirectory: resolve(config.homeDirectory, "sessions"),
    sessionDirectory,
    eventFile: resolve(sessionDirectory, "events.jsonl")
  };
  assert.deepEqual(sessions.getAiSessionStorageLocation(owner, "workspace", turn.session.id), expected);
  assert.equal(sessions.getAiSessionStorageLocation(other, "workspace", turn.session.id), null);
  assert.equal(sessions.getAiSessionStorageLocation(owner, "writing", turn.session.id), null);

  const { sessionQueryTools } = await import("lfaa-tool-session-query");
  const tool = sessionQueryTools.find(item => item.name === "session_storage_info");
  assert.ok(tool);
  assert.deepEqual(tool.parse({}), {});
  assert.throws(() => tool.parse({ sessionId: turn.session.id }), /无效/u, "模型不能指定其他会话");
  assert.equal(tool.risk({}), "read");
  assert.deepEqual(tool.approval({}), { scopeKey: "session-query", scopeSummary: "当前账户/App/项目", summary: "读取会话证据" });

  const context = { userId: owner, applicationId: "workspace", sessionId: turn.session.id, signal: new AbortController().signal };
  assert.deepEqual(await tool.execute({}, context), expected);
  await assert.rejects(tool.execute({}, { ...context, applicationId: "writing" }), /不可用/u);
  assert.doesNotMatch(JSON.stringify(expected), /private body/u);
});
