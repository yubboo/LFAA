/**
 * 功能：回归前端附件上传的类型/大小校验与请求形状。
 * 作用：用假 fetch 验证只发必要字段、拒绝非白名单与大文件、失败如实报错。
 * 关联文件：packages/client/file-upload/src/index.ts、api/attachment-controller。
 */
import test from "node:test";
import assert from "node:assert/strict";

const { uploadAttachment, bytesToBase64 } = await import("lfaa-client-file-upload");

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function fileOf(bytes, name = "shot.png", type = "image/png") {
  return { name, type, size: bytes.byteLength, async arrayBuffer() { return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); } };
}

test("合法图片上传只发送名称、类型与 base64，并返回附件记录", async () => {
  const calls = [];
  const record = { id: "a1", name: "shot.png", mediaType: "image/png", bytes: 8, sha256: "h", createdAt: "2026-10-25T00:00:00.000Z" };
  const result = await uploadAttachment({
    file: fileOf(png), authorization: "Bearer token",
    fetchImpl: async (url, init) => { calls.push({ url, init }); return { ok: true, status: 201, async json() { return { attachment: record }; } }; }
  });
  assert.equal(result.id, "a1");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/attachments");
  assert.equal(calls[0].init.headers.Authorization, "Bearer token");
  const body = JSON.parse(calls[0].init.body);
  assert.deepEqual(Object.keys(body).sort(), ["dataBase64", "mediaType", "name"]);
  assert.equal(body.dataBase64, bytesToBase64(png));
});

test("非白名单类型与超大文件在前端就被拒绝，不发起请求", async () => {
  let called = false;
  const fetchImpl = async () => { called = true; return { ok: true, status: 201, async json() { return {}; } }; };
  await assert.rejects(uploadAttachment({ file: fileOf(png, "a.zip", "application/zip"), authorization: "t", fetchImpl }), /只支持/u);
  await assert.rejects(uploadAttachment({ file: { name: "big.png", type: "image/png", size: 9 * 1024 * 1024, async arrayBuffer() { return new ArrayBuffer(0); } }, authorization: "t", fetchImpl }), /8 MiB/u);
  assert.equal(called, false);
});

test("服务端拒绝时抛出带状态码的真实错误，不返回假成功", async () => {
  await assert.rejects(uploadAttachment({
    file: fileOf(png), authorization: "t",
    fetchImpl: async () => ({ ok: false, status: 400, async json() { return { error: "invalid_attachment_upload" }; } })
  }), /HTTP 400/u);
});
