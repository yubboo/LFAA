// 验证交接 HTTP：按会话列待接手、接手时创建目标、跨项目拒绝、取消。
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import { GoalService } from "@lfaa/goal";
import type { MemoryService } from "@lfaa/memory";
import { HandoffService } from "../src/index";
import { createHandoffHttpHandler } from "../src/http-handler";

async function call(handler: ReturnType<typeof createHandoffHttpHandler>, method: string, url: string, body?: unknown) {
  const req = Object.assign(new EventEmitter(), {
    url,
    method,
    async *[Symbol.asyncIterator]() {
      if (body !== undefined) yield Buffer.from(JSON.stringify(body), "utf8");
    },
  });
  let status = 200;
  let raw = "";
  const res = {
    statusCode: 200,
    setHeader: () => undefined,
    end: (chunk?: string | Buffer) => {
      status = res.statusCode;
      raw = chunk ? chunk.toString() : "";
    },
  };
  const handled = await handler(req as never, res as never);
  return { handled, status, json: JSON.parse(raw || "{}") as Record<string, unknown> };
}

test("列表与接手：接手时创建 goal，重复接手被拒", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-handoff-http-"));
  try {
    const service = new HandoffService(new Context(), { storeFilePath: path.join(dir, "handoffs.json") });
    const goal = new GoalService(new Context(), { storeFilePath: path.join(dir, "goals.json") });
    const memory = {
      getSession: async (id: string) => (id === "s2" ? { id: "s2", projectId: "p1" } : id === "s9" ? { id: "s9", projectId: "p2" } : null),
    } as unknown as MemoryService;
    const handler = createHandoffHttpHandler(service, memory, goal);

    const item = await service.create({
      fromSessionId: "s1",
      projectId: "p1",
      title: "接手循环拆分",
      summary: "A1–A4 已完成",
      nextSteps: ["做 B1"],
      toSessionId: "s2",
    });

    const list = await call(handler, "GET", "/api/handoffs?sessionId=s2&projectId=p1");
    assert.equal(list.status, 200);
    assert.equal((list.json.handoffs as Array<{ id: string }>).length, 1);

    const accepted = await call(handler, "POST", `/api/handoffs/${item.id}/accept`, { sessionId: "s2" });
    assert.equal(accepted.status, 200);
    assert.equal((accepted.json.handoff as { status: string }).status, "accepted");
    const goalItem = accepted.json.goal as { id: string; objective: string; sessionId: string };
    assert.equal(goalItem.sessionId, "s2");
    assert.match(goalItem.objective, /A1–A4 已完成/u);
    assert.match(goalItem.objective, /做 B1/u);

    const again = await call(handler, "POST", `/api/handoffs/${item.id}/accept`, { sessionId: "s2" });
    assert.equal(again.status, 400);

    const other = await service.create({ fromSessionId: "s1", projectId: "p1", title: "定向", summary: "摘要", toSessionId: "s2" });
    const denied = await call(handler, "POST", `/api/handoffs/${other.id}/accept`, { sessionId: "s9" });
    assert.equal(denied.status, 403);

    const broadcast = await service.create({ fromSessionId: "s1", projectId: "p1", title: "广播", summary: "摘要" });
    const cancelled = await call(handler, "POST", `/api/handoffs/${broadcast.id}/cancel`, { sessionId: "s1" });
    assert.equal(cancelled.status, 200);
    assert.equal((cancelled.json.handoff as { status: string }).status, "cancelled");
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});