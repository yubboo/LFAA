// 验证 /api/worktrees 路由：列出、创建、删除与错误映射；服务本身由 worktree-service 测试覆盖。
import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import test from "node:test";
import type { CreateWorktreeInput } from "../contract";
import { createWorktreeHttpHandler } from "../src/http-handler";
import type { WorktreeService } from "../src/worktree-service";

function makeRequest(method: string, url: string, body?: unknown): IncomingMessage {
  const request = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]) as unknown as IncomingMessage;
  request.method = method;
  request.url = url;
  return request;
}

function makeResponse(): { res: ServerResponse; read: () => { status: number; body: string } } {
  let status = 0;
  let body = "";
  const res = {
    set statusCode(value: number) {
      status = value;
    },
    get statusCode() {
      return status;
    },
    setHeader() {},
    end(chunk?: string) {
      body = chunk ?? "";
    },
  } as unknown as ServerResponse;
  return { res, read: () => ({ status, body }) };
}

function makeService(overrides: Partial<Record<keyof WorktreeService, unknown>> = {}): WorktreeService {
  return {
    list: async () => [],
    create: async () => ({ id: "w1" }),
    remove: async () => true,
    inspect: async () => null,
    readFile: async () => null,
    ...overrides,
  } as unknown as WorktreeService;
}

test("列出与创建：参数透传并返回 JSON", async () => {
  const calls: string[] = [];
  let received: CreateWorktreeInput | null = null;
  const handler = createWorktreeHttpHandler(makeService({
    list: async (projectId?: string) => {
      calls.push(`list:${projectId ?? ""}`);
      return [];
    },
    create: async (input: CreateWorktreeInput) => {
      received = input;
      return { id: "w1" } as never;
    },
  }));

  const listed = makeResponse();
  const handledList = await handler(makeRequest("GET", "/api/worktrees?projectId=p1"), listed.res);
  assert.equal(handledList, true);
  assert.deepEqual(calls, ["list:p1"]);
  assert.equal(listed.read().status, 200);
  assert.deepEqual(JSON.parse(listed.read().body), { worktrees: [] });

  const created = makeResponse();
  await handler(makeRequest("POST", "/api/worktrees", { projectId: "p1", branch: "feature/x", from: "HEAD" }), created.res);
  assert.equal(created.read().status, 201);
  assert.deepEqual(received, { projectId: "p1", branch: "feature/x", from: "HEAD" });
});

test("删除支持 force，未知路由交给后续处理器，服务错误映射为 400", async () => {
  let forced: boolean | undefined;
  let removedId = "";
  const handler = createWorktreeHttpHandler(makeService({
    remove: async (id: string, options?: { force?: boolean }) => {
      removedId = id;
      forced = options?.force;
      return true;
    },
    create: async () => {
      throw new Error("分支已存在");
    },
  }));

  const deleted = makeResponse();
  await handler(makeRequest("DELETE", "/api/worktrees/w1?force=1"), deleted.res);
  assert.equal(deleted.read().status, 200);
  assert.equal(removedId, "w1");
  assert.equal(forced, true);

  const failed = makeResponse();
  await handler(makeRequest("POST", "/api/worktrees", { projectId: "p1", branch: "dup" }), failed.res);
  assert.equal(failed.read().status, 400);
  assert.deepEqual(JSON.parse(failed.read().body), { error: "分支已存在" });

  const skipped = makeResponse();
  assert.equal(await handler(makeRequest("GET", "/api/other"), skipped.res), false);

  const missing = makeResponse();
  await handler(makeRequest("GET", "/api/worktrees/w1/inspect"), missing.res);
  assert.equal(missing.read().status, 404);
});