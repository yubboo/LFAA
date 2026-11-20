// 验证消息反馈：入参归一化、持久化 upsert/remove 与 HTTP 接口的成功/失败分支。
import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  createFeedbackHttpHandler,
  FeedbackStore,
  normalizeFeedbackInput,
  normalizeFeedbackRating,
  type FeedbackRecord,
  type FeedbackService,
} from "../src/index";

async function withTempStore(run: (storePath: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "lfaa-feedback-"));
  try {
    await run(join(dir, "feedback.json"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function fakeRes(): { res: ServerResponse; captured: { status: number; body: string } } {
  const captured = { status: 0, body: "" };
  const res = {
    setHeader() {},
    end(chunk?: string | Buffer) {
      if (chunk !== undefined) captured.body += String(chunk);
      return res as unknown as ServerResponse;
    },
  } as unknown as ServerResponse;
  Object.defineProperty(res, "statusCode", {
    get: () => captured.status,
    set: (value: number) => { captured.status = value; },
  });
  return { res, captured };
}

function fakeReq(url: string, method: string, body?: unknown): IncomingMessage {
  const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
  return {
    url,
    method,
    async *[Symbol.asyncIterator]() {
      if (payload) yield payload;
    },
  } as unknown as IncomingMessage;
}

function fakeService(store: FeedbackStore): FeedbackService {
  return {
    list: (sessionId?: string) => store.list(sessionId),
    get: (sessionId: string, messageId: string) => store.get(sessionId, messageId),
    upsert: store.upsert.bind(store),
    remove: store.remove.bind(store),
  } as unknown as FeedbackService;
}

test("rating 与入参校验：非法值、缺字段与超长备注都报错", () => {
  assert.equal(normalizeFeedbackRating("up"), "up");
  assert.equal(normalizeFeedbackRating("down"), "down");
  assert.equal(normalizeFeedbackRating("like"), undefined);
  assert.throws(() => normalizeFeedbackInput({ sessionId: "s", messageId: "m", rating: "like" }), /只支持/u);
  assert.throws(() => normalizeFeedbackInput({ messageId: "m", rating: "up" }), /缺少 sessionId/u);
  assert.throws(() => normalizeFeedbackInput({ sessionId: "s", rating: "up" }), /缺少 messageId/u);
  assert.throws(
    () => normalizeFeedbackInput({ sessionId: "s", messageId: "m", rating: "up", comment: "x".repeat(2_001) }),
    /不能超过/u,
  );
  assert.deepEqual(normalizeFeedbackInput({ sessionId: " s ", messageId: " m ", rating: "down", comment: "  " }), {
    sessionId: "s",
    messageId: "m",
    rating: "down",
  });
});

test("持久化：upsert 去重更新、按会话列出并删除", async () => {
  await withTempStore(async (storePath) => {
    const store = new FeedbackStore(storePath);
    const first = await store.upsert({ sessionId: "s1", messageId: "m1", rating: "up", comment: "有用" });
    assert.equal(first.rating, "up");
    assert.equal(first.comment, "有用");

    const updated = await store.upsert({ sessionId: "s1", messageId: "m1", rating: "down" });
    assert.equal(updated.id, first.id, "同一会话同一消息复用 id");
    assert.equal(updated.createdAt, first.createdAt);
    assert.equal(updated.comment, undefined);
    assert.equal(updated.rating, "down");

    await store.upsert({ sessionId: "s2", messageId: "m2", rating: "up" });
    assert.equal((await store.list()).length, 2);
    assert.equal((await store.list("s1")).length, 1);
    assert.equal((await store.get("s1", "m1"))?.rating, "down");

    assert.equal(await store.remove("s1", "m1"), true);
    assert.equal(await store.remove("s1", "m1"), false);
    assert.equal((await store.list()).length, 1);
  });
});

test("HTTP：POST 写入、GET 过滤、DELETE 撤销与非法请求", async () => {
  await withTempStore(async (storePath) => {
    const store = new FeedbackStore(storePath);
    const handler = createFeedbackHttpHandler(fakeService(store));

    const created = fakeRes();
    await handler(fakeReq("/api/feedback", "POST", { sessionId: "s1", messageId: "m1", rating: "up" }), created.res);
    assert.equal(created.captured.status, 200);
    assert.equal(JSON.parse(created.captured.body).record.rating, "up");

    const listed = fakeRes();
    await handler(fakeReq("/api/feedback?sessionId=s1", "GET"), listed.res);
    assert.equal(JSON.parse(listed.captured.body).feedback.length, 1);

    const invalid = fakeRes();
    await handler(fakeReq("/api/feedback", "POST", { sessionId: "s1", messageId: "m1", rating: "meh" }), invalid.res);
    assert.equal(invalid.captured.status, 400);
    assert.match(invalid.captured.body, /只支持/u);

    const removed = fakeRes();
    await handler(fakeReq("/api/feedback?sessionId=s1&messageId=m1", "DELETE"), removed.res);
    assert.equal(JSON.parse(removed.captured.body).removed, true);

    const missing = fakeRes();
    await handler(fakeReq("/api/feedback", "DELETE"), missing.res);
    assert.equal(missing.captured.status, 400);

    const wrongMethod = fakeRes();
    await handler(fakeReq("/api/feedback", "PUT"), wrongMethod.res);
    assert.equal(wrongMethod.captured.status, 405);

    assert.equal(await handler(fakeReq("/api/other", "GET"), fakeRes().res), false);
  });
});

test("store 记录结构包含时间戳并可按更新排序", async () => {
  await withTempStore(async (storePath) => {
    const store = new FeedbackStore(storePath);
    const a = await store.upsert({ sessionId: "s", messageId: "a", rating: "up" });
    const b = await store.upsert({ sessionId: "s", messageId: "b", rating: "down" });
    const items: FeedbackRecord[] = await store.list("s");
    assert.equal(items[0]?.id, b.id);
    assert.ok(items.every((item) => item.updatedAt >= item.createdAt));
    assert.equal(items.length, 2);
    assert.ok(a.id !== b.id);
  });
});