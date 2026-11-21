// 验证自定义提示音接口：上传、列表、读取文件与删除，并拒绝非音频与超大内容。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createNotificationSoundsHttpHandler } from "../src/index";

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

test("自定义提示音可上传、列出、读取并删除", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-notification-sounds-"));
  try {
    const handler = createNotificationSoundsHttpHandler({ soundsDir: dir });
    const audio = Buffer.from("RIFF0000WAVEfmt ", "ascii");

    const upload = fakeResponse();
    const uploaded = await handler(fakeRequest("POST", "/api/notification-sounds", {
      name: "我的提示音",
      mime: "audio/wav",
      dataBase64: audio.toString("base64"),
    }), upload.res);
    assert.equal(uploaded, true);
    assert.equal(upload.status(), 201);
    const meta = JSON.parse(upload.body().toString("utf8")).sound as { id: string; name: string; size: number };
    assert.equal(meta.name, "我的提示音");
    assert.equal(meta.size, audio.length);

    const list = fakeResponse();
    await handler(fakeRequest("GET", "/api/notification-sounds"), list.res);
    assert.equal(list.status(), 200);
    assert.equal(JSON.parse(list.body().toString("utf8")).sounds.length, 1);

    const file = fakeResponse();
    await handler(fakeRequest("GET", `/api/notification-sounds/${meta.id}/file`), file.res);
    assert.equal(file.status(), 200);
    assert.equal(file.headers["content-type"], "audio/wav");
    assert.deepEqual(file.body(), audio);

    const removed = fakeResponse();
    await handler(fakeRequest("DELETE", `/api/notification-sounds/${meta.id}`), removed.res);
    assert.equal(removed.status(), 200);

    const after = fakeResponse();
    await handler(fakeRequest("GET", "/api/notification-sounds"), after.res);
    assert.equal(JSON.parse(after.body().toString("utf8")).sounds.length, 0);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test("自定义提示音拒绝非音频 MIME", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-notification-sounds-bad-"));
  try {
    const handler = createNotificationSoundsHttpHandler({ soundsDir: dir });
    const response = fakeResponse();
    await handler(fakeRequest("POST", "/api/notification-sounds", {
      name: "文本",
      mime: "text/plain",
      dataBase64: Buffer.from("hello").toString("base64"),
    }), response.res);
    assert.equal(response.status(), 415);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});