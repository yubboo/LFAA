// 验证个人背景图接口：上传、列表、读图、删除；直接放进目录的文件也会被发现；非图片与超大内容被拒绝。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createBackgroundsHttpHandler } from "../src/index";

function fakeRequest(method: string, url: string, body?: Record<string, unknown>): IncomingMessage {
  const payload = body ? Buffer.from(JSON.stringify(body)) : Buffer.alloc(0);
  return {
    method,
    url,
    async *[Symbol.asyncIterator]() {
      if (payload.length > 0) yield payload;
    },
  } as unknown as IncomingMessage;
}

function fakeResponse(): { res: ServerResponse; status: () => number; headers: Record<string, string>; body: () => Buffer } {
  let statusCode = 200;
  let body: Uint8Array = new Uint8Array();
  const headers: Record<string, string> = {};
  const res = {
    get statusCode() { return statusCode; },
    set statusCode(value: number) { statusCode = value; },
    setHeader(name: string, value: string) { headers[name.toLowerCase()] = value; },
    end(chunk?: string | Buffer) {
      body = typeof chunk === "string" ? new Uint8Array(Buffer.from(chunk, "utf8")) : new Uint8Array(chunk ?? []);
    },
  } as unknown as ServerResponse;
  return { res, status: () => statusCode, headers, body: () => Buffer.from(body) };
}

test("个人背景图可上传、列出、读取并删除", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-backgrounds-"));
  try {
    const handler = createBackgroundsHttpHandler({ backgroundsDir: dir });
    const image = Buffer.from("RIFF0000WEBP", "ascii");

    const upload = fakeResponse();
    const uploaded = await handler(fakeRequest("POST", "/api/backgrounds", {
      name: "我的海岸",
      mime: "image/webp",
      dataBase64: image.toString("base64"),
    }), upload.res);
    assert.equal(uploaded, true);
    assert.equal(upload.status(), 201);
    const meta = JSON.parse(upload.body().toString("utf8")).background as { id: string; name: string; size: number };
    assert.equal(meta.name, "我的海岸");
    assert.equal(meta.size, image.length);

    const list = fakeResponse();
    await handler(fakeRequest("GET", "/api/backgrounds"), list.res);
    assert.equal(list.status(), 200);
    const listed = JSON.parse(list.body().toString("utf8")).backgrounds as Array<{ id: string; name: string }>;
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.name, "我的海岸");

    const file = fakeResponse();
    await handler(fakeRequest("GET", `/api/backgrounds/${meta.id}/file`), file.res);
    assert.equal(file.status(), 200);
    assert.equal(file.headers["content-type"], "image/webp");
    assert.deepEqual(file.body(), image);

    const removed = fakeResponse();
    await handler(fakeRequest("DELETE", `/api/backgrounds/${meta.id}`), removed.res);
    assert.equal(removed.status(), 200);

    const after = fakeResponse();
    await handler(fakeRequest("GET", "/api/backgrounds"), after.res);
    assert.equal(JSON.parse(after.body().toString("utf8")).backgrounds.length, 0);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("直接放进目录的图片会被自动发现", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-backgrounds-drop-"));
  try {
    await fs.writeFile(path.join(dir, "my-wallpaper.png"), Buffer.from("PNG001", "ascii"));
    const handler = createBackgroundsHttpHandler({ backgroundsDir: dir });

    const list = fakeResponse();
    await handler(fakeRequest("GET", "/api/backgrounds"), list.res);
    const listed = JSON.parse(list.body().toString("utf8")).backgrounds as Array<{ id: string; name: string; mime: string }>;
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.id, "my-wallpaper");
    assert.equal(listed[0]?.name, "my-wallpaper");
    assert.equal(listed[0]?.mime, "image/png");

    const file = fakeResponse();
    await handler(fakeRequest("GET", "/api/backgrounds/my-wallpaper/file"), file.res);
    assert.equal(file.status(), 200);
    assert.equal(file.headers["content-type"], "image/png");
    assert.deepEqual(file.body(), Buffer.from("PNG001", "ascii"));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("拒绝非图片、超大图片与非法 ID", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-backgrounds-bad-"));
  try {
    const handler = createBackgroundsHttpHandler({ backgroundsDir: dir });

    const wrongMime = fakeResponse();
    await handler(fakeRequest("POST", "/api/backgrounds", {
      name: "文本",
      mime: "text/plain",
      dataBase64: Buffer.from("hello").toString("base64"),
    }), wrongMime.res);
    assert.equal(wrongMime.status(), 415);

    const tooLarge = fakeResponse();
    await handler(fakeRequest("POST", "/api/backgrounds", {
      name: "超大图",
      mime: "image/png",
      dataBase64: Buffer.alloc(12 * 1024 * 1024 + 1).toString("base64"),
    }), tooLarge.res);
    assert.equal(tooLarge.status(), 413);

    const traversal = fakeResponse();
    await handler(fakeRequest("DELETE", "/api/backgrounds/..%2F..%2Fetc%2Fpasswd"), traversal.res);
    assert.equal(traversal.status(), 400);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});