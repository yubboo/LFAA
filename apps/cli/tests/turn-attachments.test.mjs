/**
 * 功能：回归"请求携带附件 ID → 模型图片消息"的解析边界。
 * 作用：验证账户隔离、类型不符跳过、附件服务缺失与数量上限，且失败不抛错。
 * 关联文件：packages/llm/llm/src/turn-attachments.ts、attachment-message.ts。
 */
import test from "node:test";
import assert from "node:assert/strict";

const { resolveTurnAttachmentMessages, MAX_TURN_ATTACHMENTS } = await import("lfaa-llm/src/turn-attachments.js");

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ownerId = "user-owner";

function fakeStore() {
  return {
    async get(userId, id) {
      if (userId !== ownerId) throw new Error("附件记录不属于当前账户。");
      if (id === "missing") throw new Error("找不到附件。");
      if (id === "text") return { record: { id, userId, name: "a.txt", mediaType: "text/plain", bytes: 2, sha256: "x", createdAt: "2026-10-25T00:00:00.000Z" }, data: new TextEncoder().encode("hi") };
      return { record: { id, userId, name: "shot.png", mediaType: "image/png", bytes: png.byteLength, sha256: "x", createdAt: "2026-10-25T00:00:00.000Z" }, data: png };
    }
  };
}

test("图片附件解析成一条消息，文本与缺失附件只记录跳过原因", async () => {
  const result = await resolveTurnAttachmentMessages({ store: fakeStore(), userId: ownerId, ids: ["img-1", "text", "missing"] });
  assert.equal(result.messages.length, 1);
  assert.equal(result.messages[0].role, "user");
  assert.equal(result.skipped.length, 2);
  assert.match(result.skipped[0].reason, /不是受支持的图片类型/u);
});

test("其它账户的附件 ID 不会被解析", async () => {
  const result = await resolveTurnAttachmentMessages({ store: fakeStore(), userId: "user-other", ids: ["img-1"] });
  assert.equal(result.messages.length, 0);
  assert.match(result.skipped[0].reason, /不属于当前账户/u);
});

test("没有附件服务时不抛错，数量受上限约束", async () => {
  const none = await resolveTurnAttachmentMessages({ store: undefined, userId: ownerId, ids: ["a"] });
  assert.equal(none.messages.length, 0);
  assert.match(none.skipped[0].reason, /没有挂载附件服务/u);
  const many = await resolveTurnAttachmentMessages({ store: fakeStore(), userId: ownerId, ids: Array.from({ length: 9 }, (_, index) => "img-" + index) });
  assert.equal(many.messages.length, MAX_TURN_ATTACHMENTS);
});

test("单轮附件总字节超限时后续附件被跳过，前面的仍然发送", async () => {
  const big = new Uint8Array(7 * 1024 * 1024);
  big.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const store = {
    async get(userId, id) {
      return { record: { id, userId, name: "big.png", mediaType: "image/png", bytes: big.byteLength, sha256: "x", createdAt: "2026-10-25T00:00:00.000Z" }, data: big };
    }
  };
  const result = await resolveTurnAttachmentMessages({ store, userId: ownerId, ids: ["a", "b", "c"] });
  assert.equal(result.messages.length, 1, "7 MiB + 7 MiB 超过 12 MiB，只保留第一张");
  assert.match(result.skipped[0].reason, /总大小上限/u);
});
