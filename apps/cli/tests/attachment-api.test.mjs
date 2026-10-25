/**
 * 功能：回归附件上传的解析与边界。
 * 作用：验证白名单类型、base64 形状、空/超大内容与名称规则在进入 Owner 之前就被拒绝。
 * 关联文件：packages/api/attachment-controller、packages/attachment/attachment。
 */
import test from "node:test";
import assert from "node:assert/strict";

const { decodeAttachmentUpload } = await import("lfaa-api-attachment-controller");
const { ATTACHMENT_MAX_BYTES } = await import("lfaa-attachment");

const pngBase64 = Buffer.from(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])).toString("base64");

test("合法上传解码为有界字节", () => {
  const decoded = decodeAttachmentUpload({ name: "shot.png", mediaType: "image/png", dataBase64: pngBase64 });
  assert.equal(decoded.name, "shot.png");
  assert.equal(decoded.mediaType, "image/png");
  assert.equal(decoded.data.byteLength, 8);
});

test("非白名单类型、非法 base64、空与超大内容被拒绝", () => {
  assert.throws(() => decodeAttachmentUpload({ name: "a.bin", mediaType: "application/zip", dataBase64: pngBase64 }), /无效/u);
  assert.throws(() => decodeAttachmentUpload({ name: "a.png", mediaType: "image/png", dataBase64: "!!notbase64!!" }), /无效|base64/u);
  assert.throws(() => decodeAttachmentUpload({ name: "a.txt", mediaType: "text/plain", dataBase64: "" }), /无效/u);
  // 非规范 base64（多余填充）必须拒绝，对齐 DSH admission 的 canonical 校验。
  assert.throws(() => decodeAttachmentUpload({ name: "a.png", mediaType: "image/png", dataBase64: "AB==" }), /规范 base64/u);
  const huge = Buffer.alloc(ATTACHMENT_MAX_BYTES + 3).toString("base64");
  assert.throws(() => decodeAttachmentUpload({ name: "a.txt", mediaType: "text/plain", dataBase64: huge }), /无效|上限|不超过/u);
});

test("名称含路径分隔被拒绝", () => {
  assert.throws(() => decodeAttachmentUpload({ name: "../evil.png", mediaType: "image/png", dataBase64: pngBase64 }), /无效|路径/u);
});
