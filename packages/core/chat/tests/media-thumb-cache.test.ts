// 验证缩略图缓存键随文件变化失效，语音素材不发起任何网络请求。
import assert from "node:assert/strict";
import test from "node:test";
import { buildThumbnailKey, getMediaThumbnail } from "../client/media-thumb-cache";

const base = {
  path: "C:\\ws\\.lfaa-media\\images\\a.png",
  name: "a.png",
  kind: "image" as const,
  bytes: 2048,
  createdAt: 1_762_000_000_000,
};

test("缩略图缓存键包含路径、大小、时间与目标宽度，文件变化后自动失效", () => {
  const key = buildThumbnailKey(base);
  assert.match(key, /a\.png/u);
  assert.equal(key, buildThumbnailKey({ ...base }, 480));
  assert.notEqual(key, buildThumbnailKey({ ...base, bytes: 4096 }));
  assert.notEqual(key, buildThumbnailKey({ ...base, createdAt: 1_762_000_000_001 }));
  assert.notEqual(key, buildThumbnailKey(base, 960));
});

test("语音素材直接返回空缩略图，不请求原文件", async () => {
  const originalFetch = globalThis.fetch;
  let called = 0;
  globalThis.fetch = (async () => {
    called += 1;
    return new Response("unexpected", { status: 200 });
  }) as typeof fetch;
  try {
    assert.equal(await getMediaThumbnail({ ...base, name: "c.mp3", kind: "audio" }), null);
    assert.equal(called, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});