// 验证 agent / 绑定 HTTP 接口：列表、创建、改名、删除保护与业务错误转 400。
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import {
  AgentProfileService,
  BUILTIN_AGENT_ID,
  DEFAULT_BINDING_ID,
  createAgentProfileHttpHandler,
} from "../src/index";

type Handler = ReturnType<typeof createAgentProfileHttpHandler>;

async function call(handler: Handler, method: string, url: string, body?: unknown) {
  const req = Object.assign(new EventEmitter(), {
    url,
    method,
    async *[Symbol.asyncIterator]() {
      if (body !== undefined) yield Buffer.from(JSON.stringify(body), "utf8");
    },
  });
  let status = 200;
  let rawBody = "";
  const res = {
    statusCode: 200,
    setHeader: () => undefined,
    end: (chunk?: string | Buffer) => {
      status = res.statusCode;
      rawBody = chunk ? chunk.toString() : "";
    },
  };
  const handled = await handler(req as never, res as never);
  return { handled, status, json: rawBody ? JSON.parse(rawBody) as Record<string, unknown> : {} };
}

async function withHandler(task: (handler: Handler, service: AgentProfileService) => Promise<void>): Promise<void> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-agent-http-"));
  try {
    const service = new AgentProfileService(new Context(), {
      agentsFilePath: path.join(dir, "agents.json"),
      bindingsFilePath: path.join(dir, "bindings.json"),
    });
    await task(createAgentProfileHttpHandler(service), service);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test("非本包路径不接管", async () => {
  await withHandler(async (handler) => {
    const result = await call(handler, "GET", "/api/llm/profiles");
    assert.equal(result.handled, false);
  });
});

test("agent 列表、创建、改名与删除", async () => {
  await withHandler(async (handler) => {
    const list = await call(handler, "GET", "/api/agents");
    assert.equal(list.status, 200);
    assert.equal((list.json.agents as Array<{ id: string }>)[0]?.id, BUILTIN_AGENT_ID);

    const created = await call(handler, "POST", "/api/agents", { name: "审查员", kind: "worker", instructions: "只挑问题" });
    assert.equal(created.status, 201);
    const agent = created.json.agent as { id: string; name: string };

    const renamed = await call(handler, "PATCH", `/api/agents/${agent.id}`, { name: "严格审查员" });
    assert.equal(renamed.status, 200);
    assert.equal((renamed.json.agent as { name: string }).name, "严格审查员");

    const removed = await call(handler, "DELETE", `/api/agents/${agent.id}`);
    assert.equal(removed.status, 200);
    assert.equal(removed.json.removed, true);
  });
});

test("内置 agent 删除被拒绝并返回 400 与可读原因", async () => {
  await withHandler(async (handler) => {
    const result = await call(handler, "DELETE", `/api/agents/${BUILTIN_AGENT_ID}`);
    assert.equal(result.status, 400);
    assert.match(String(result.json.error), /不能删除/u);
  });
});

test("绑定接口：创建路由组、非法目标被拒、默认绑定不可改", async () => {
  await withHandler(async (handler) => {
    const bindings = await call(handler, "GET", "/api/bindings");
    assert.equal(bindings.status, 200);
    assert.equal((bindings.json.bindings as Array<{ id: string }>)[0]?.id, DEFAULT_BINDING_ID);

    const created = await call(handler, "POST", "/api/bindings", {
      name: "Opus 优先",
      strategy: "order",
      targets: [{ profileId: "anthropic", modelId: "opus" }, { profileId: "deepseek" }],
    });
    assert.equal(created.status, 201);

    const invalid = await call(handler, "POST", "/api/bindings", { name: "空", targets: [] });
    assert.equal(invalid.status, 400);
    assert.match(String(invalid.json.error), /至少需要一个目标/u);

    const patched = await call(handler, "PATCH", `/api/bindings/${DEFAULT_BINDING_ID}`, { name: "x" });
    assert.equal(patched.status, 400);
    assert.match(String(patched.json.error), /不能修改/u);
  });
});

test("非法 JSON 请求体返回 400 而不是 500", async () => {
  await withHandler(async (handler) => {
    const req = Object.assign(new EventEmitter(), {
      url: "/api/agents",
      method: "POST",
      async *[Symbol.asyncIterator]() {
        yield Buffer.from("{ 不是 JSON", "utf8");
      },
    });
    let status = 0;
    const res = {
      statusCode: 200,
      setHeader: () => undefined,
      end: () => {
        status = res.statusCode;
      },
    };
    const handled = await handler(req as never, res as never);
    assert.equal(handled, true);
    assert.equal(status, 400);
  });
});