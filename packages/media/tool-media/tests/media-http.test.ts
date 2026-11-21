// 验证媒体文件接口与素材库接口：允许根校验（含 Windows 大小写）、越界拒绝、删除与 sidecar 清理。
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildMediaFileUrl, createMediaHttpHandler, createMediaLibraryHttpHandler, mediaMetadataPath } from "../src/index";
import { PNG_1X1, fakeReq, fakeRes } from "./media-helpers";

test("媒体文件接口在 Windows 上按大小写不敏感校验允许根（引用图目录大小写不一致）", { skip: process.platform !== "win32" }, async () => {
  const root = await mkdtemp(join(tmpdir(), "lfaa-media-case-"));
  try {
    const imagesDir = join(root, ".lfaa-media", "images");
    await mkdir(imagesDir, { recursive: true });
    const file = join(imagesDir, "a.png");
    await writeFile(file, Buffer.from(PNG_1X1, "base64"));
    // 项目登记的是小写路径、磁盘真实目录是另一套大小写时，仍属于同一目录，不能被判越界。
    const handler = createMediaHttpHandler({ resolveAllowedRoots: async () => [root.toUpperCase()] });
    const ok = fakeRes();
    assert.equal(await handler(fakeReq(buildMediaFileUrl(file)), ok.res), true);
    assert.equal(ok.captured.status, 200);
    assert.equal(ok.captured.headers["content-type"], "image/png");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("媒体文件 URL 编码与 HTTP 处理器：允许根内读取、拒绝越界与缺失文件", async () => {
  const root = await mkdtemp(join(tmpdir(), "lfaa-media-http-"));
  try {
    const imagesDir = join(root, ".lfaa-media", "images");
    await mkdir(imagesDir, { recursive: true });
    const file = join(imagesDir, "a.png");
    await writeFile(file, Buffer.from(PNG_1X1, "base64"));
    const url = buildMediaFileUrl(file);
    assert.match(url, /^\/api\/media\/file\?path=/u);

    const handler = createMediaHttpHandler({ resolveAllowedRoots: async () => [root] });
    const ok = fakeRes();
    assert.equal(await handler(fakeReq(url), ok.res), true);
    assert.equal(ok.captured.status, 200);
    assert.equal(ok.captured.headers["content-type"], "image/png");
    assert.ok(ok.captured.body.length > 0);

    const outside = fakeRes();
    await handler(fakeReq(buildMediaFileUrl(join(tmpdir(), "outside.png"))), outside.res);
    assert.equal(outside.captured.status, 403);

    const missing = fakeRes();
    await handler(fakeReq(buildMediaFileUrl(join(imagesDir, "nope.png"))), missing.res);
    assert.equal(missing.captured.status, 404);

    assert.equal(await handler(fakeReq("/api/media/other"), fakeRes().res), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("媒体文件接口返回 ETag，条件请求命中时用 304 复用缓存", async () => {
  const root = await mkdtemp(join(tmpdir(), "lfaa-media-etag-"));
  try {
    const imagesDir = join(root, ".lfaa-media", "images");
    await mkdir(imagesDir, { recursive: true });
    const file = join(imagesDir, "etag.png");
    await writeFile(file, Buffer.from(PNG_1X1, "base64"));
    const handler = createMediaHttpHandler({ resolveAllowedRoots: async () => [root] });

    const first = fakeRes();
    assert.equal(await handler(fakeReq(buildMediaFileUrl(file)), first.res), true);
    assert.equal(first.captured.status, 200);
    const etag = first.captured.headers["etag"];
    assert.ok(etag);
    assert.match(first.captured.headers["cache-control"] ?? "", /must-revalidate/u);

    const second = fakeRes();
    assert.equal(await handler(fakeReq(buildMediaFileUrl(file), "GET", { "if-none-match": etag }), second.res), true);
    assert.equal(second.captured.status, 304);
    assert.equal(second.captured.body.length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("素材库接口：扫描生成媒体并读取 sidecar 提示词元数据", async () => {
  const root = await mkdtemp(join(tmpdir(), "lfaa-media-lib-"));
  try {
    const imagesDir = join(root, ".lfaa-media", "images");
    await mkdir(imagesDir, { recursive: true });
    const file = join(imagesDir, "a.png");
    await writeFile(file, Buffer.from(PNG_1X1, "base64"));
    await writeFile(mediaMetadataPath(file), JSON.stringify({ kind: "image", prompt: "海边日落", model: "qwen-image-3.0-pro", createdAt: 42 }), "utf8");

    const handler = createMediaLibraryHttpHandler({ resolveAllowedRoots: async () => [root] });
    const { res, captured } = fakeRes();
    assert.equal(await handler(fakeReq("/api/media/library?limit=10"), res), true);
    assert.equal(captured.status, 200);
    const payload = JSON.parse(captured.body.toString("utf8")) as { items: Array<{ name: string; prompt?: string; model?: string; kind: string }> };
    // 素材库接口同时扫描本机 ~/.lfaa/media，测试只断言自己创建的那条，避免被真实环境里的素材影响。
    const item = payload.items.find((entry) => entry.name === "a.png");
    assert.ok(item);
    assert.equal(item.prompt, "海边日落");
    assert.equal(item.model, "qwen-image-3.0-pro");
    assert.equal(item.kind, "image");

    assert.equal(await handler(fakeReq("/api/media/other"), fakeRes().res), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("媒体接口支持删除素材并连带清理 sidecar", async () => {
  const root = await mkdtemp(join(tmpdir(), "lfaa-media-del-"));
  try {
    const imagesDir = join(root, ".lfaa-media", "images");
    await mkdir(imagesDir, { recursive: true });
    const file = join(imagesDir, "del.png");
    await writeFile(file, Buffer.from(PNG_1X1, "base64"));
    await writeFile(mediaMetadataPath(file), "{}", "utf8");
    const handler = createMediaHttpHandler({ resolveAllowedRoots: async () => [root] });

    const { res, captured } = fakeRes();
    assert.equal(await handler(fakeReq(buildMediaFileUrl(file), "DELETE"), res), true);
    assert.equal(captured.status, 200);
    assert.equal((JSON.parse(captured.body.toString("utf8")) as { deleted: boolean }).deleted, true);
    await assert.rejects(readFile(file));
    await assert.rejects(readFile(mediaMetadataPath(file)));

    const outside = fakeRes();
    await handler(fakeReq(buildMediaFileUrl(join(tmpdir(), "outside.png")), "DELETE"), outside.res);
    assert.equal(outside.captured.status, 403);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});