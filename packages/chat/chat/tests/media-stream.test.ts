// 验证媒体生成流式解析：计划句先回调给占位，最终结果与错误事件都能正确处理。
import assert from "node:assert/strict";
import test from "node:test";
import { readMediaStream } from "../client/store/run-media-actions";

function streamOf(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  }), { headers: { "content-type": "application/x-ndjson; charset=utf-8" } });
}

test("流式解析：plan 立即回调，done 返回最终结果", async () => {
  const plans: string[] = [];
  const result = await readMediaStream(
    streamOf(['{"type":"plan","plan":"我会生成雨窗边安静忧郁的少女。"}\n{"type":"done","ok":true}\n']),
    (plan) => plans.push(plan),
  );
  assert.deepEqual(plans, ["我会生成雨窗边安静忧郁的少女。"]);
  assert.deepEqual(result, { ok: true });
});

test("流式解析：跨分片的行能拼回，error 事件抛出可读原因", async () => {
  const plans: string[] = [];
  await assert.rejects(
    readMediaStream(streamOf(['{"type":"plan","plan":"我会生成雨窗', '边的少女。"}\n{"type":"error","error":"套餐额度不足"}\n']), (plan) => plans.push(plan)),
    /套餐额度不足/u,
  );
  assert.deepEqual(plans, ["我会生成雨窗边的少女。"]);
});

test("流式解析：没有 done 事件时明确失败，不伪造成功", async () => {
  await assert.rejects(readMediaStream(streamOf(['{"type":"plan","plan":"我会生成…"}\n']), () => {}), /没有返回结果/u);
});