/**
 * 功能：回归图片附件到模型内容块的构造规则。
 * 作用：验证图片块形状、类型复核失败即拒绝、文本附件不进入多模态，以及标签回退。
 * 关联文件：packages/llm/llm/src/attachment-message.ts、packages/attachment/attachment。
 */
import test from "node:test";
import assert from "node:assert/strict";

const { buildAttachmentImageMessage } = await import("lfaa-llm/src/attachment-message.js");

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

test("图片附件构造成 user 内容块，包含 text 与 image_url", () => {
  const message = buildAttachmentImageMessage({ record: { id: "a1", name: "shot.png", mediaType: "image/png" }, data: png });
  assert.equal(message.role, "user");
  assert.ok(Array.isArray(message.content));
  const parts = message.content;
  assert.equal(parts[0].type, "text");
  assert.equal(parts[1].type, "image_url");
  assert.match(parts[1].image_url.url, /^data:image\/png;base64,/u);
  assert.equal(parts[1].image_url.detail, "auto");
});

test("自定义标签优先，缺省回退到附件名", () => {
  const custom = buildAttachmentImageMessage({ record: { id: "a1", name: "shot.png", mediaType: "image/png" }, data: png, label: "  用户上传的截图  " });
  assert.equal(custom.content[0].text, "用户上传的截图");
  const fallback = buildAttachmentImageMessage({ record: { id: "a1", name: "", mediaType: "image/png" }, data: png });
  assert.equal(fallback.content[0].text, "附件图片：a1");
});

test("类型不一致或非图片附件被拒绝，不把不确定字节发给 Provider", () => {
  assert.throws(() => buildAttachmentImageMessage({ record: { id: "a1", name: "x.png", mediaType: "image/png" }, data: new TextEncoder().encode("plain") }), /不一致/u);
  assert.throws(() => buildAttachmentImageMessage({ record: { id: "a1", name: "note.txt", mediaType: "text/plain" }, data: new TextEncoder().encode("hi") }), /不是受支持的图片类型/u);
});
