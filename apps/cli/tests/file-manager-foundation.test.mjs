/*
 * 功能：回归节点文件管理的预览、摘要写入、危险类型拦截、回收站/移动和审计迁移。
 * 作用：在隔离 LFAA_DATA_DIR 中验证 Daemon 文件 Owner 与 SQLite 文件任务 Owner 的边界。
 * 关联文件：packages/host/daemon/src/daemon.mjs、packages/fs/fs/src/queue.ts、packages/storage/storage-sqlite/src/database.ts。
 */
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import test, { after } from "node:test";

const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const testOutputRoot = resolve(cli, "../../dist/.tmp");
mkdirSync(testOutputRoot, { recursive: true });
const dataDirectory = mkdtempSync(join(testOutputRoot, "lfaa-file-manager-foundation-"));
process.env.LFAA_DATA_DIR = dataDirectory;
process.env.NODE_ENV = "test";

const [{ performNodeFileOperation }, storage, queue] = await Promise.all([
  import("../../../packages/host/daemon/src/daemon.mjs"),
  import("lfaa-storage-sqlite/src/database.js"),
  import("lfaa-fs/src/queue.js")
]);
const { database, closeDatabase } = storage;
const { createTarArchive } = await import("../../../packages/client/ui-sidebar-files/src/archive.ts");
// The normal DB package reaches v51 through the full storage-owner plugin boot. This isolated test
// starts from the unchanged v15 node_file_tasks shape and advances only its version marker to test v51→v52.
if (Number(database.prepare("PRAGMA user_version").get().user_version) < 51) {
  database.exec("PRAGMA user_version = 51");
  storage.migrateNodeFileManagerFoundationSchema();
}
storage.migrateNodeFileManagerDirectorySizeSchema();

after(async () => {
  (await import("lfaa-storage-domain/src/configuration.js")).configuration.close();
  (await import("lfaa-session-persistence-jsonl/src/repository.js")).sessionRecords.close();
  closeDatabase();
  assert.equal(dirname(resolve(dataDirectory)), testOutputRoot);
  assert.ok(basename(dataDirectory).startsWith("lfaa-file-manager-foundation-"));
  rmSync(dataDirectory, { recursive: true, force: true });
});

test("file manager schema migration expands tasks and retains non-content audit fields", () => {
  const version = Number(database.prepare("PRAGMA user_version").get().user_version);
  assert.equal(version, 53);
  const sql = database.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='node_file_tasks'").get().sql;
  assert.match(sql, /'trash-restore'/u);
  assert.match(sql, /'directory-size'/u);
  assert.ok(database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='node_file_audit'").get());
});

test("preview separates viewing from editing and rejects sensitive path names", async () => {
  mkdirSync(join(dataDirectory, "docs"));
  writeFileSync(join(dataDirectory, "docs", "guide.md"), "# LFAA\n\n**Read only** preview.", "utf8");
  const markdown = await performNodeFileOperation("preview", { path: "docs/guide.md" });
  assert.equal(markdown.previewKind, "text");
  assert.match(markdown.content, /Read only/u);
  const listed = await performNodeFileOperation("list", { path: "docs" });
  assert.equal(listed.entries[0].fileType, "md");

  writeFileSync(join(dataDirectory, "docs", "secret-token.txt"), "private value", "utf8");
  await assert.rejects(performNodeFileOperation("preview", { path: "docs/secret-token.txt" }), /禁止在线预览/u);
  writeFileSync(join(dataDirectory, "docs", "server.properties"), "motd=Test\nrcon.password=long-secret-value", "utf8");
  await assert.rejects(performNodeFileOperation("preview", { path: "docs/server.properties" }), /敏感信息策略/u);
  await assert.rejects(performNodeFileOperation("read", { path: "docs/server.properties" }), /敏感信息策略/u);

  const pdfBytes = Buffer.from("%PDF-1.4\npreview fixture", "ascii");
  writeFileSync(join(dataDirectory, "docs", "guide.pdf"), pdfBytes);
  const pdf = await performNodeFileOperation("preview", { path: "docs/guide.pdf" });
  assert.equal(pdf.previewKind, "pdf");
  assert.equal(Buffer.from(pdf.dataBase64, "base64").toString("ascii"), pdfBytes.toString("ascii"));
});

test("文件列表将无扩展名标记为通用文件，并按需计算嵌套目录大小", async () => {
  mkdirSync(join(dataDirectory, "measured", "nested"), { recursive: true });
  writeFileSync(join(dataDirectory, "measured", "plain"), "abc", "utf8");
  writeFileSync(join(dataDirectory, "measured", "nested", "note.txt"), "12345", "utf8");

  const listed = await performNodeFileOperation("list", { path: "measured" });
  assert.equal(listed.entries.find(entry => entry.name === "plain")?.fileType, "file");
  const measured = await performNodeFileOperation("directory-size", { path: "measured" });
  assert.deepEqual(measured, {
    path: "measured",
    totalSize: 8,
    fileCount: 2,
    directoryCount: 1,
    skippedEntries: 0
  });
  await assert.rejects(performNodeFileOperation("directory-size", { path: "measured/plain" }), /只能计算文件夹/u);
});

test("目录大小超过深度上限时失败，且根目录计算跳过受保护目录", async () => {
  const before = await performNodeFileOperation("directory-size", { path: "" });
  mkdirSync(join(dataDirectory, "credentials"), { recursive: true });
  writeFileSync(join(dataDirectory, "credentials", "protected.fixture"), "secret-fixture", "utf8");
  const after = await performNodeFileOperation("directory-size", { path: "" });
  assert.equal(after.totalSize, before.totalSize);
  assert.equal(after.fileCount, before.fileCount);

  const deepPath = Array.from({ length: 65 }, () => "level").join("/");
  mkdirSync(join(dataDirectory, deepPath), { recursive: true });
  await assert.rejects(performNodeFileOperation("directory-size", { path: "" }), /超过 64 层/u);
});

test("upload checks an allowlisted type and SHA-256 before writing; matching content is idempotent", async () => {
  const bytes = Buffer.from("server config", "utf8");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const payload = { path: "docs", name: "upload.properties", dataBase64: bytes.toString("base64"), sha256 };
  const uploaded = await performNodeFileOperation("upload", payload);
  assert.equal(uploaded.sha256, sha256);
  assert.equal(uploaded.duplicate, false);
  const duplicate = await performNodeFileOperation("upload", payload);
  assert.equal(duplicate.duplicate, true);
  await assert.rejects(performNodeFileOperation("upload", { ...payload, name: "setup.ps1" }), /可执行文件和脚本/u);
  await assert.rejects(performNodeFileOperation("upload", { ...payload, name: "bad.txt", sha256: "0".repeat(64) }), /SHA-256/u);
  assert.throws(() => statSync(join(dataDirectory, "docs", "bad.txt")), { code: "ENOENT" });
});

test("move refuses collisions and descendants; delete can restore or permanently purge", async () => {
  mkdirSync(join(dataDirectory, "from", "child"), { recursive: true });
  mkdirSync(join(dataDirectory, "to"));
  writeFileSync(join(dataDirectory, "from", "note.txt"), "safe", "utf8");
  writeFileSync(join(dataDirectory, "note.txt"), "existing", "utf8");
  await assert.rejects(performNodeFileOperation("move", { path: "from", destinationPath: "from/child" }), /自身内部/u);
  await performNodeFileOperation("move", { path: "from/note.txt", destinationPath: "to" });
  await assert.rejects(performNodeFileOperation("move", { path: "to/note.txt", destinationPath: "" }), /同名/u);

  const removed = await performNodeFileOperation("delete", { path: "to/note.txt" });
  assert.equal(removed.deleted, true);
  assert.equal(statSync(join(dataDirectory, ".lfaa-recycle-bin")).isDirectory(), true);
  let trash = await performNodeFileOperation("trash-list", { path: "" });
  assert.equal(trash.entries.length, 1);
  assert.equal(trash.entries[0].trashId, removed.trashId);
  await performNodeFileOperation("trash-restore", { path: "", name: removed.trashId });
  assert.equal(readFileSync(join(dataDirectory, "to", "note.txt"), "utf8"), "safe");

  const secondRemoval = await performNodeFileOperation("delete", { path: "to/note.txt" });
  await performNodeFileOperation("trash-purge", { path: "", name: secondRemoval.trashId });
  trash = await performNodeFileOperation("trash-list", { path: "" });
  assert.equal(trash.entries.length, 0);
});

test("text writes reject stale SHA-256 and return the updated digest", async () => {
  const path = join(dataDirectory, "docs", "concurrent.txt");
  writeFileSync(path, "version one", "utf8");
  const first = await performNodeFileOperation("read", { path: "docs/concurrent.txt" });
  writeFileSync(path, "external version", "utf8");
  await assert.rejects(performNodeFileOperation("write", { path: "docs/concurrent.txt", content: "my version", expectedSha256: first.sha256 }), /其他操作修改/u);
  const current = await performNodeFileOperation("read", { path: "docs/concurrent.txt" });
  const saved = await performNodeFileOperation("write", { path: "docs/concurrent.txt", content: "my version", expectedSha256: current.sha256 });
  assert.equal(readFileSync(path, "utf8"), "my version");
  assert.equal(saved.sha256, createHash("sha256").update("my version").digest("hex"));
});

test("batch download TAR preserves Unicode and long paths through PAX records", async () => {
  const longPath = `archive/${"长".repeat(36)}.txt`;
  const archive = Buffer.from(await createTarArchive([
    { path: "docs/a.md", bytes: new TextEncoder().encode("A") },
    { path: longPath, bytes: new TextEncoder().encode("B") }
  ]).arrayBuffer());
  const verifyHeader = (offset) => {
    const header = archive.subarray(offset, offset + 512);
    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/su, "");
    const prefix = header.subarray(345, 500).toString("utf8").replace(/\0.*$/su, "");
    const size = Number.parseInt(header.subarray(124, 136).toString("ascii").replaceAll("\0", "").trim(), 8);
    const checksum = Number.parseInt(header.subarray(148, 156).toString("ascii").replaceAll("\0", "").trim(), 8);
    const copy = Buffer.from(header); copy.fill(32, 148, 156);
    assert.equal(copy.reduce((sum, byte) => sum + byte, 0), checksum);
    return { name, prefix, size, type: String.fromCharCode(header[156]) };
  };
  const first = verifyHeader(0);
  assert.equal(`${first.prefix}/${first.name}`, "docs/a.md");
  assert.equal(archive.subarray(512, 513).toString("utf8"), "A");
  const pax = verifyHeader(1024);
  assert.equal(pax.type, "x");
  const record = archive.subarray(1536, 1536 + pax.size).toString("utf8");
  assert.equal(Number.parseInt(record.slice(0, record.indexOf(" ")), 10), Buffer.byteLength(record));
  assert.ok(record.includes(`path=${longPath}`));
  const longFileHeaderOffset = 1536 + Math.ceil(pax.size / 512) * 512;
  assert.equal(verifyHeader(longFileHeaderOffset).name, "file-1");
  assert.throws(() => createTarArchive([{ path: "../outside.txt", bytes: new Uint8Array() }]), /相对文件路径/u);
});

test("completed file tasks add searchable actor/action audit without storing file body", async () => {
  const userId = randomUUID();
  const nodeId = randomUUID();
  database.prepare("INSERT INTO users (id, username, password_salt, password_hash, role, is_super_admin) VALUES (?, ?, 'salt', 'hash', 'admin', 1)").run(userId, `manager-${userId}`);
  database.prepare("INSERT INTO daemon_nodes (id, display_name, platform, architecture, daemon_version, status, capabilities_json, last_seen_at) VALUES (?, 'isolated file test', 'win32', 'x64', 'test', 'online', '[\"node-filesystem-v1\",\"node-filesystem-v2\"]', ?)").run(nodeId, new Date().toISOString());
  const { saveUserSettings } = await import("lfaa-settings/src/service.js");
  saveUserSettings(userId, "permissions", { mode: "full_access" });
  const task = queue.createNodeFileTask({ nodeId, createdBy: userId, operation: "write", payload: { path: "docs/safe.txt", content: "do not retain this text", expectedSha256: "a".repeat(64) } });
  assert.equal(queue.claimNextNodeFileTask(nodeId)?.id, task.id);
  assert.equal(queue.completeNodeFileTask({ taskId: task.id, nodeId, succeeded: false, message: "fixture failure", result: {} }), true);
  const entries = queue.listNodeFileAudit({ query: "safe.txt" });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].username, `manager-${userId}`);
  assert.equal(entries[0].succeeded, false);
  const auditColumns = database.prepare("PRAGMA table_info(node_file_audit)").all().map(column => column.name);
  assert.equal(auditColumns.includes("payload_json"), false);
  assert.equal(auditColumns.includes("content"), false);
});
