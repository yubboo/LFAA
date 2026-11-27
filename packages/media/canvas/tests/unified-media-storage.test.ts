// 验证画布资产统一存放在资料库 .lfaa-media/{images,videos} 目录、写入 sidecar 元数据，并支持直接链接资料库素材。
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { CanvasStore } from "../src/canvas-store";

const TINY_PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
const TINY_MP4 = Buffer.from([0, 0, 0, 16, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0]);

test("画布上传的图片与视频统一落盘到资料库对应的 images / videos 目录并生成元数据", async () => {
  const root = await mkdtemp(join(tmpdir(), "lfaa-canvas-unified-"));
  try {
    const mediaRoot = join(root, "data");
    const store = new CanvasStore(join(mediaRoot, "canvas"), mediaRoot);
    const dir = store.boardDir("proj-1", "11111111-1111-4111-8111-111111111111");

    const img = await store.addAsset(dir, "hero.png", "image/png", TINY_PNG, undefined, { prompt: "sunset" });
    const imgLoc = await store.asset(dir, img.id);
    assert.equal(imgLoc.file, join(mediaRoot, ".lfaa-media", "images", `${img.id}.png`));
    assert.ok((await stat(imgLoc.file)).isFile());
    const imgMeta = JSON.parse(await readFile(`${imgLoc.file}.json`, "utf8")) as { kind: string; prompt?: string };
    assert.equal(imgMeta.kind, "image");
    assert.equal(imgMeta.prompt, "sunset");

    const vid = await store.addAsset(dir, "clip.mp4", "video/mp4", TINY_MP4);
    const vidLoc = await store.asset(dir, vid.id);
    assert.equal(vidLoc.file, join(mediaRoot, ".lfaa-media", "videos", `${vid.id}.mp4`));
    assert.ok((await stat(vidLoc.file)).isFile());

    // 直接从资料库路径链接，无需重复拷贝。
    const linked = await store.linkLibraryFile(dir, imgLoc.file, "linked-hero.png");
    const linkedLoc = await store.asset(dir, linked.id);
    assert.equal(linkedLoc.file, imgLoc.file);
    assert.equal(linked.name, "linked-hero.png");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
