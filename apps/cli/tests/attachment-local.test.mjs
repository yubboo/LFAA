/**
 * 功能：回归本机附件存储的账户隔离、边界与摘要一致性。
 * 作用：用隔离临时根验证写入/读取/清单、超限拒绝、类型不一致拒绝、非法 ID 与跨账户读取拒绝。
 * 关联文件：packages/attachment/attachment、attachment-local、lfaa-home-paths。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const temporaryParent = resolve(dirname(fileURLToPath(import.meta.url)), "../../../dist/.tmp");
const dataDirectory = mkdtempSync(join(temporaryParent, "lfaa-attachment-"));

// 附件存储导入 settings 时会打开数据库，必须先让迁移链初始化结构。
await import("lfaa-storage-sqlite/src/database.js");
const { createLocalAttachmentStore } = await import("lfaa-attachment-local/src/index.ts");
const { ATTACHMENT_MAX_BYTES, attachmentDataUrl, normalizeAttachmentName, sniffImageMediaType } = await import("lfaa-attachment");

const store = createLocalAttachmentStore({ dataDirectory: () => dataDirectory });
const ownerId = randomUUID();
const otherId = randomUUID();
// 只要求魔数正确；嗅探不依赖扩展名或完整图片结构。
// 规范化会解析真实结构：这里构造最小合法 PNG（IHDR + IDAT + IEND，无敏感辅助块）。
const u32 = (value) => [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
const chunk = (type, data) => [...u32(data.length), ...Buffer.from(type, "latin1"), ...data, 0, 0, 0, 0];
const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...chunk("IHDR", [...u32(1), ...u32(1), 8, 2, 0, 0, 0]), ...chunk("IDAT", []), ...chunk("IEND", [])]);

test.after(() => {
  if (dirname(dataDirectory) !== temporaryParent) throw new Error("拒绝清理测试根以外的路径。");
  rmSync(dataDirectory, { recursive: true, force: true });
});

test("写入后可按账户读取，摘要与字节一致", async () => {
  const record = await store.put({ userId: ownerId, name: "shot.png", mediaType: "image/png", data: pngBytes });
  assert.match(record.sha256, /^[a-f0-9]{64}$/u);
  assert.equal(record.bytes, pngBytes.byteLength);
  const content = await store.get(ownerId, record.id);
  assert.deepEqual(new Uint8Array(content.data), pngBytes);
  assert.equal(attachmentDataUrl(record, content.data).startsWith("data:image/png;base64,"), true);
  assert.equal((await store.list(ownerId)).length, 1);
});

test("跨账户读取与非法 ID 被拒绝", async () => {
  const record = await store.put({ userId: ownerId, name: "note.txt", mediaType: "text/plain", data: new TextEncoder().encode("hello") });
  await assert.rejects(store.get(otherId, record.id));
  await assert.rejects(store.get(ownerId, "../escape"), /附件 ID 无效/u);
});

test("超限、空内容与类型不一致一律拒绝，且不产生记录", async () => {
  await assert.rejects(store.put({ userId: ownerId, name: "big.png", mediaType: "image/png", data: new Uint8Array(ATTACHMENT_MAX_BYTES + 1) }), /上限/u);
  await assert.rejects(store.put({ userId: ownerId, name: "empty.txt", mediaType: "text/plain", data: new Uint8Array(0) }), /为空/u);
  await assert.rejects(store.put({ userId: ownerId, name: "fake.png", mediaType: "image/png", data: new TextEncoder().encode("not an image") }), /不一致/u);
  const listed = await store.list(ownerId);
  assert.equal(listed.filter(item => item.name === "big.png" || item.name === "empty.txt" || item.name === "fake.png").length, 0);
});

test("名称与魔数嗅探是唯一判定来源", () => {
  assert.throws(() => normalizeAttachmentName("../etc/passwd"), /不含路径分隔/u);
  assert.equal(sniffImageMediaType(pngBytes), "image/png");
  assert.equal(sniffImageMediaType(new TextEncoder().encode("plain")), undefined);
});
