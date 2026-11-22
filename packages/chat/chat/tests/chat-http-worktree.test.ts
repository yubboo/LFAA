// 验证聊天会话接口的工作树绑定：只接受 id、由 Host 解析快照，未知 id 明确拒绝，null 表示解绑。
import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import test from "node:test";
import type { CreateSessionInput, UpdateSessionInput } from "@lfaa/memory";
import type { ChatService } from "../src/index";
import { createChatHttpHandler } from "../src/http-handler";

const worktree = {
  id: "wt-1",
  projectId: "p1",
  path: "C:\\work\\demo-worktrees\\wt-1",
  branch: "feature/x",
  repositoryRoot: "C:\\work\\demo",
};

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

test("创建会话接受 worktreeId 并由 Host 解析为快照", async () => {
  let created: CreateSessionInput | null = null;
  const service = {
    createSession: async (input?: CreateSessionInput) => {
      created = input ?? null;
      return { id: "s1" };
    },
  } as unknown as ChatService;
  const handler = createChatHttpHandler(service, {
    resolveWorktree: async (id) => (id === worktree.id ? worktree : null),
  });

  const response = makeResponse();
  await handler(makeRequest("POST", "/api/chat/sessions", {
    projectId: "p1",
    worktreeId: "wt-1",
    // 客户端即使提交路径也不会被采信，服务端只使用解析结果。
    path: "C:\\evil",
  }), response.res);
  assert.equal(response.read().status, 201);
  assert.deepEqual(created, {
    projectId: "p1",
    sectionId: null,
    worktree,
  });

  const rejected = makeResponse();
  await handler(makeRequest("POST", "/api/chat/sessions", { projectId: "p1", worktreeId: "missing" }), rejected.res);
  assert.equal(rejected.read().status, 400);
  assert.match(rejected.read().body, /工作树不存在/u);
});

test("PATCH 支持解绑与换绑，绑定不属于项目的快照会被拒绝", async () => {
  const patches: UpdateSessionInput[] = [];
  const service = {
    updateSession: async (_id: string, patch: UpdateSessionInput) => {
      patches.push(patch);
      return { id: "s1" };
    },
  } as unknown as ChatService;
  const handler = createChatHttpHandler(service, {
    resolveWorktree: async (id) => (id === worktree.id ? worktree : null),
  });

  const unbound = makeResponse();
  await handler(makeRequest("PATCH", "/api/chat/sessions/s1", { worktreeId: null }), unbound.res);
  assert.equal(unbound.read().status, 200);
  assert.deepEqual(patches[0], { worktree: null });

  const rebound = makeResponse();
  await handler(makeRequest("PATCH", "/api/chat/sessions/s1", { worktreeId: "wt-1" }), rebound.res);
  assert.equal(rebound.read().status, 200);
  assert.deepEqual(patches[1], { worktree });

  const foreign = makeResponse();
  await handler(makeRequest("PATCH", "/api/chat/sessions/s1", { worktreeId: "wt-foreign" }), foreign.res);
  assert.equal(foreign.read().status, 400);
  assert.match(foreign.read().body, /工作树不存在或不可用/u);
  assert.equal(patches.length, 2);
});