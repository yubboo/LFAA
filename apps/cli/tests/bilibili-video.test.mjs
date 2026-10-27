/**
 * 功能：回归 Bilibili 视频输入的 URL、抽样图像、尺寸与 ASR 协议边界。
 * 作用：使用纯内存 fixture，不连接 Bilibili、Ark 服务或真实账户。
 * 关联文件：packages/video/bilibili-video、packages/video/tool-bilibili-video。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import {
  mapStoryboardTimestamps,
  parseArkAsrResponse,
  parseBilibiliVideoUrl,
  readJpegDimensions
} from "lfaa-video-bilibili-video/src/index.js";
import { apply as applyVideoTools } from "lfaa-video-tool-bilibili-video/src/index.js";

test("Bilibili URL 只接受公开 BV 页面并验证分 P", () => {
  assert.deepEqual(parseBilibiliVideoUrl("https://www.bilibili.com/video/BV1Jqng6nEfT/?p=2&share_source=test"), {
    bvid: "BV1Jqng6nEfT", page: 2
  });
  for (const url of [
    "http://www.bilibili.com/video/BV1Jqng6nEfT/",
    "https://www.bilibili.com.evil.test/video/BV1Jqng6nEfT/",
    "https://user@www.bilibili.com/video/BV1Jqng6nEfT/",
    "https://www.bilibili.com:443/video/BV1Jqng6nEfT/",
    "https://www.bilibili.com/video/BV1Jqng6nEfT/?p=0",
    "https://b23.tv/BV1Jqng6nEfT"
  ]) assert.throws(() => parseBilibiliVideoUrl(url));
});

test("Storyboard 时间戳和 JPEG 尺寸解析均有界并拒绝损坏输入", () => {
  assert.deepEqual(mapStoryboardTimestamps([0, "2.5", -1, "x", ...Array.from({ length: 205 }, (_, index) => index + 3)]).slice(0, 4), [0, 2.5, 3, 4]);
  assert.equal(mapStoryboardTimestamps(Array.from({ length: 205 }, (_, index) => index)).length, 200);
  const jpegSof = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x01, 0x00, 0x02, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00, 0xff, 0xd9]);
  assert.deepEqual(readJpegDimensions(jpegSof), { width: 2, height: 1 });
  assert.throws(() => readJpegDimensions(Buffer.from("not jpeg")), /JPEG/u);
});

test("Ark ASR 最终响应解析文本，工具投影不把 Storyboard 图片写入持久结果", () => {
  const payload = Buffer.from(JSON.stringify({ result: { text: "你好", utterances: [{ start_time: 0, end_time: 700, text: "你好" }] } }));
  const frame = Buffer.alloc(12 + payload.length);
  frame.set([0x11, 0x93, 0x10, 0x00]);
  frame.writeInt32BE(-1, 4);
  frame.writeUInt32BE(payload.length, 8);
  payload.copy(frame, 12);
  const parsed = parseArkAsrResponse(frame);
  assert.equal(parsed.isLast, true);
  assert.equal(parsed.payload?.result?.text, "你好");
  assert.throws(() => parseArkAsrResponse(Buffer.from([0x11, 0x93, 0x10, 0x00])), /响应帧格式/u);

  const tools = [];
  const fakeContext = {
    lfaaCredentials: { createConsumer: () => ({ describe: () => ({ configured: false }), resolve: () => null }) },
    lfaaSettings: {},
    lfaaBilibiliVideo: { parseUrl: parseBilibiliVideoUrl },
    lfaaTools: { registerTool: (_owner, tool) => tools.push(tool) }
  };
  applyVideoTools(fakeContext);
  const storyboard = tools.find(tool => tool.name === "bilibili_video_storyboard");
  const encodedImage = "AA==";
  const projected = storyboard.projectResult({ sheetIndex: 0, sheetCount: 2, mimeType: "image/jpeg", dataBase64: encodedImage, width: 4800, height: 2700, timestamps: [0, 12] });
  assert.equal(projected.content[1].data, encodedImage);
  assert.equal(projected.persistedResult.imagePersisted, false);
  assert.equal(JSON.stringify(projected.persistedResult).includes(encodedImage), false);
  assert.equal(projected.persistedResult.frameCount, 2);
});

test("Web Bundle 装配真实 Bilibili Agent 工具", async () => {
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  process.env.SERVER_PORT = String(reservation.address().port);
  await new Promise((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
  const { boot } = await import("lfaa-app-boot/src/index.js");
  const context = await boot(["--profile", "web"]);
  try {
    const names = context.lfaaTools.listAiBusinessTools("workspace", "admin", null, "ask", true).map(tool => tool.name);
    assert.ok(names.includes("bilibili_video_info"));
    assert.ok(names.includes("bilibili_video_storyboard"));
    assert.ok(names.includes("bilibili_video_transcribe_audio"));
  } finally {
    await context.fiber.dispose();
  }
});
