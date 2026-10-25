/**
 * 功能：回归图片附件规范化——敏感元数据删除、尺寸上限与畸形输入拒绝。
 * 作用：用最小合成 JPEG/PNG 验证存储字节已去掉 Exif/tEXt，超尺寸与截断输入 fail closed。
 * 关联文件：packages/attachment/attachment/src/normalize.ts、attachment-local/src/index.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { deflateSync } from "node:zlib";

const temporaryParent = resolve(dirname(fileURLToPath(import.meta.url)), "../../../dist/.tmp");
const dataDirectory = mkdtempSync(join(temporaryParent, "lfaa-attachment-normalize-"));
// 附件存储导入 settings 时会打开数据库，必须先让迁移链初始化结构。
await import("lfaa-storage-sqlite/src/database.js");
const { createLocalAttachmentStore } = await import("lfaa-attachment-local/src/index.ts");
const store = createLocalAttachmentStore({ dataDirectory: () => dataDirectory });
const userId = randomUUID();

test.after(() => {
  if (dirname(dataDirectory) !== temporaryParent) throw new Error("拒绝清理测试根以外的路径。");
  rmSync(dataDirectory, { recursive: true, force: true });
});

function u16(value) { return [(value >>> 8) & 0xff, value & 0xff]; }
function toBytes(list) { return new Uint8Array(list.flat()); }

function jpegWithExif() {
  const exif = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x41, 0x42]; // "Exif\0\0AB"
  const app1 = [0xff, 0xe1, ...u16(2 + exif.length), ...exif];
  const sof = [0xff, 0xc0, ...u16(11), 0x08, ...u16(16), ...u16(32), 0x01, 0x01, 0x11, 0x00];
  const sos = [0xff, 0xda, ...u16(8), 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00];
  return toBytes([0xff, 0xd8, app1, sof, sos, [0x00, 0x01], [0xff, 0xd9]]);
}

function chunk(type, data) {
  return [...u32(data.length), ...Buffer.from(type, "latin1"), ...data, 0, 0, 0, 0];
}
function pngWithText(width, height, truncated = false) {
  const ihdr = [...u32(width), ...u32(height), 8, 2, 0, 0, 0];
  const text = [...Buffer.from("Title", "latin1")];
  const bytes = toBytes([[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], chunk("IHDR", ihdr), chunk("tEXt", text), chunk("IEND", [])]);
  return truncated ? bytes.subarray(0, bytes.byteLength - 20) : bytes;
}
function u32(value) { return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]; }

test("JPEG 写入时删除 Exif 段，其余结构保留", async () => {
  const record = await store.put({ userId, name: "a.jpg", mediaType: "image/jpeg", data: jpegWithExif() });
  const content = await store.get(userId, record.id);
  const text = Buffer.from(content.data).toString("latin1");
  assert.doesNotMatch(text, /Exif/u);
  assert.equal(content.data[0], 0xff);
  assert.equal(content.data[1], 0xd8);
  assert.equal(content.data[content.data.byteLength - 2], 0xff);
  assert.equal(content.data[content.data.byteLength - 1], 0xd9);
});

test("PNG 写入时删除 tEXt 辅助块", async () => {
  const record = await store.put({ userId, name: "b.png", mediaType: "image/png", data: pngWithText(32, 16) });
  const content = await store.get(userId, record.id);
  const text = Buffer.from(content.data).toString("latin1");
  assert.doesNotMatch(text, /tEXt/u);
  assert.match(text, /IHDR/u);
  assert.match(text, /IEND/u);
});

test("可解码的超大图片会被缩到上限内；远超上限则拒绝", async () => {
  const scaled = await store.put({ userId, name: "c.png", mediaType: "image/png", data: realPng(5000, 20) });
  assert.equal(scaled.mediaType, "image/jpeg", "超边长图片重编码为 jpeg");
  await assert.rejects(store.put({ userId, name: "huge.png", mediaType: "image/png", data: realPng(9000, 10) }), /上限/u);
});

test("截断的图片 fail closed，不落盘", async () => {
  await assert.rejects(store.put({ userId, name: "d.png", mediaType: "image/png", data: pngWithText(10, 10, true) }), /PNG|结构|越界|解码|拒绝/u);
});

/** 生成一张真实可解码的 PNG（zlib + CRC32），用于验证重编码路径。 */
function realPng(width, height) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc32 = (buf) => { let c = 0xffffffff; for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const body = Buffer.concat([Buffer.from(type, "latin1"), data]); const out = Buffer.alloc(12 + data.length); out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(crc32(body), 8 + data.length); return out; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) { raw[y * (width * 3 + 1)] = 0; for (let x = 0; x < width * 3; x += 1) raw[y * (width * 3 + 1) + 1 + x] = (x + y) % 255; }
  return new Uint8Array(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
}

test("超过 2048 边长的图片被重编码为更小的 jpeg，并保留可解码内容", async () => {
  const wide = realPng(3000, 10);
  const record = await store.put({ userId, name: "wide.png", mediaType: "image/png", data: wide });
  assert.equal(record.mediaType, "image/jpeg", "无 alpha 的大图重编码为 jpeg");
  assert.ok(record.bytes > 0, "重编码结果必须有内容");
  const content = await store.get(userId, record.id);
  assert.equal(content.data[0], 0xff, "jpeg SOI");
  assert.equal(content.data[1], 0xd8);
});
