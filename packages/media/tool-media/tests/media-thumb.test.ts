// 验证宿主缩略图缓存：GET 未生成返回 204、POST 后可按宽度命中、越界拒绝与非法内容校验。
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createMediaThumbHttpHandler, mediaThumbCacheName } from "../src/index";
import { PNG_1X1, fakeBodyReq, fakeReq, fakeRes } from "./media-helpers";

/** 只满足文件头校验的最小 WebP 字节。 */
const WEBP_BYTES = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([36, 0, 0, 0]),
  Buffer.from("WEBPVP8 "),
  Buffer.alloc(24),
]);

async function setup() {
  const root = await mkdtemp(join(tmpdir(), "lfaa-thumb-"));
  const thumbs = join(root, "thumbs");
  const images = join(root, ".lfaa-media", "images");
  await mkdir(images, { recursive: true });
  const file = join(images, "a.png");
  await writeFile(file, Buffer.from(PNG_1X1, "base64"));
  const handler = createMediaThumbHttpHandler({ resolveAllowedRoots: async () => [root], thumbsRoot: thumbs });
  return { root, thumbs, file, handler };
}

test("缩略图未生成时返回 204，POST 后按宽度命中并带 ETag", async () => {
  const { root, thumbs, file, handler } = await setup();
  try {
    const miss = fakeRes();
    assert.equal(await handler(fakeReq(`/api/media/thumb?path=${encodeURIComponent(file)}&w=480`), miss.res), true);
    assert.equal(miss.captured.status, 204);

    const post = fakeRes();
    assert.equal(
      await handler(fakeBodyReq(`/api/media/thumb?path=${encodeURIComponent(file)}&w=480`, JSON.stringify({ data: WEBP_BYTES.toString("base64") })), post.res),
      true,
    );
    assert.equal(post.captured.status, 204);

    const hit = fakeRes();
    assert.equal(await handler(fakeReq(`/api/media/thumb?path=${encodeURIComponent(file)}&w=480`), hit.res), true);
    assert.equal(hit.captured.status, 200);
    assert.equal(hit.captured.headers["content-type"], "image/webp");
    assert.ok(hit.captured.headers["etag"]);
    assert.deepEqual(hit.captured.body, WEBP_BYTES);

    // 不同宽度是不同缓存条目。
    const otherWidth = fakeRes();
    await handler(fakeReq(`/api/media/thumb?path=${encodeURIComponent(file)}&w=960`), otherWidth.res);
    assert.equal(otherWidth.captured.status, 204);

    const info = await stat(file);
    const name = mediaThumbCacheName({ path: file, size: info.size, mtimeMs: info.mtimeMs, width: 480 });
    assert.match(name, /\.webp$/u);
    const stored = await readdir(thumbs);
    assert.ok(stored.includes(name));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("缩略图接口校验允许根、源文件、WebP 内容与请求方法", async () => {
  const { root, file, handler } = await setup();
  try {
    const outside = fakeBodyReq(`/api/media/thumb?path=${encodeURIComponent(join(tmpdir(), "outside.png"))}&w=480`, "{}");
    const denied = fakeRes();
    await handler(outside, denied.res);
    assert.equal(denied.captured.status, 403);

    const missingSource = fakeRes();
    await handler(fakeReq(`/api/media/thumb?path=${encodeURIComponent(join(root, "nope.png"))}&w=480`), missingSource.res);
    assert.equal(missingSource.captured.status, 404);

    const notWebp = fakeRes();
    await handler(fakeBodyReq(`/api/media/thumb?path=${encodeURIComponent(file)}&w=480`, JSON.stringify({ data: Buffer.from("hello").toString("base64") })), notWebp.res);
    assert.equal(notWebp.captured.status, 400);

    const badJson = fakeRes();
    await handler(fakeBodyReq(`/api/media/thumb?path=${encodeURIComponent(file)}&w=480`, "not-json"), badJson.res);
    assert.equal(badJson.captured.status, 400);

    const put = fakeRes();
    await handler(fakeReq(`/api/media/thumb?path=${encodeURIComponent(file)}&w=480`, "PUT"), put.res);
    assert.equal(put.captured.status, 405);

    const other = fakeRes();
    assert.equal(await handler(fakeReq("/api/media/other"), other.res), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});