// 验证生成素材的数据契约：类型/关键字筛选、徽章与体积文案、文件地址，以及宿主列表接口的读取与失败。
import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchMediaLibrary,
  filterMediaItems,
  formatByteSize,
  mediaKindLabel,
  mediaLibraryFileUrl,
  type MediaLibraryItem,
} from "../client/media/media-library";

const items: MediaLibraryItem[] = [
  {
    path: "C:\\ws\\.lfaa-media\\images\\a.png",
    name: "a.png",
    kind: "image",
    bytes: 2048,
    createdAt: 3,
    prompt: "海边悬崖",
    model: "wan2.7-image",
  },
  { path: "C:\\ws\\.lfaa-media\\videos\\b.mp4", name: "b.mp4", kind: "video", bytes: 5 * 1024 * 1024, createdAt: 2 },
  { path: "C:\\ws\\.lfaa-media\\audio\\c.mp3", name: "c.mp3", kind: "audio", bytes: 900, createdAt: 1, prompt: "晨间播报" },
];

test("filterMediaItems 按类型与文件名/提示词/模型关键字过滤", () => {
  assert.deepEqual(filterMediaItems(items, "all", "").map((item) => item.name), ["a.png", "b.mp4", "c.mp3"]);
  assert.deepEqual(filterMediaItems(items, "video", "").map((item) => item.name), ["b.mp4"]);
  assert.deepEqual(filterMediaItems(items, "all", " 海边 ").map((item) => item.name), ["a.png"]);
  assert.deepEqual(filterMediaItems(items, "all", "WAN2.7").map((item) => item.name), ["a.png"]);
  assert.deepEqual(filterMediaItems(items, "image", "晨间").map((item) => item.name), []);
});

test("mediaKindLabel / formatByteSize / mediaLibraryFileUrl 输出稳定且可本地化", () => {
  assert.equal(mediaKindLabel("image", true), "图片");
  assert.equal(mediaKindLabel("video", false), "Videos");
  assert.equal(formatByteSize(900), "900 B");
  assert.equal(formatByteSize(2048), "2.0 KB");
  assert.equal(formatByteSize(5 * 1024 * 1024), "5.0 MB");
  assert.equal(mediaLibraryFileUrl("C:\\ws\\a.png"), `/api/media/file?path=${encodeURIComponent("C:\\ws\\a.png")}`);
});

test("fetchMediaLibrary 读取宿主列表，接口失败时抛出让界面展示加载错误", async () => {
  const originalFetch = globalThis.fetch;
  try {
    let requested = "";
    let limit = "";
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requested = String(input);
      limit = new URL(String(input), "http://127.0.0.1").searchParams.get("limit") ?? "";
      return new Response(JSON.stringify({ items }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;

    assert.deepEqual((await fetchMediaLibrary(80)).map((item) => item.name), ["a.png", "b.mp4", "c.mp3"]);
    assert.equal(requested, "/api/media/library?limit=80");
    assert.equal(limit, "80");

    globalThis.fetch = (async () => new Response("nope", { status: 500 })) as typeof fetch;
    await assert.rejects(() => fetchMediaLibrary());
  } finally {
    globalThis.fetch = originalFetch;
  }
});