// 验证斜杠命令 seam：注册/注销、内置命令展开、执行异常与 HTTP 分支。
import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import test from "node:test";
import {
  CommandRegistry,
  createCommandsHttpHandler,
  normalizeCommandName,
  registerBuiltinCommands,
  type CommandsService,
} from "../src/index";

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

test("命令名归一：去前导斜杠、非法字符与小写化", () => {
  assert.equal(normalizeCommandName("/Summarize"), "summarize");
  assert.equal(normalizeCommandName("a b/c"), "abc");
  assert.equal(normalizeCommandName(" /x-y "), "x-y");
  assert.equal(normalizeCommandName("!!!"), "");
});

test("注册表：覆盖同名命令、按来源注销与执行", async () => {
  const registry = new CommandRegistry();
  const disposeA = registry.register({
    name: "demo",
    title: "演示 A",
    description: "a",
    kind: "prompt",
    source: "pkg-a",
    execute: async (args) => ({ prompt: `A:${args}` }),
  });
  assert.equal((await registry.run("demo", "x"))?.prompt, "A:x");
  registry.register({
    name: "demo",
    title: "演示 B",
    description: "b",
    kind: "message",
    source: "pkg-b",
    execute: async () => ({ message: "B" }),
  });
  assert.equal(registry.list().length, 1);
  assert.equal(registry.list()[0]?.source, "pkg-b");
  assert.equal((await registry.run("demo"))?.message, "B");

  disposeA();
  assert.equal(registry.list().length, 1, "旧来源的 dispose 不应删除已被覆盖的命令");
  registry.unregisterSource("pkg-b");
  assert.equal(registry.list().length, 0);
  assert.equal(await registry.run("demo"), undefined);
});

test("内置命令：总结与解释都能展开提示词", async () => {
  const registry = new CommandRegistry();
  registerBuiltinCommands(registry);
  const names = registry.list().map((item) => item.name);
  assert.deepEqual(names, ["explain", "summarize"]);
  assert.match((await registry.run("summarize"))?.prompt ?? "", /关键结论/u);
  assert.match((await registry.run("explain", "缓存命中"))?.prompt ?? "", /缓存命中/u);
});

test("HTTP：GET 列表、POST 执行、未知命令 404、缺名 400、其他方法 405", async () => {
  const service = (() => {
    const registry = new CommandRegistry();
    registerBuiltinCommands(registry);
    return { registry, list: () => registry.list() } as unknown as CommandsService;
  })();
  const handler = createCommandsHttpHandler(service);

  const listed = fakeRes();
  await handler(fakeReq("/api/commands", "GET"), listed.res);
  assert.equal(listed.captured.status, 200);
  assert.match(listed.captured.body, /summarize/u);

  const ran = fakeRes();
  await handler(fakeReq("/api/commands/run", "POST", { name: "/summarize" }), ran.res);
  assert.equal(ran.captured.status, 200);
  assert.match(ran.captured.body, /关键结论/u);

  const unknown = fakeRes();
  await handler(fakeReq("/api/commands/run", "POST", { name: "nope" }), unknown.res);
  assert.equal(unknown.captured.status, 404);

  const missing = fakeRes();
  await handler(fakeReq("/api/commands/run", "POST", {}), missing.res);
  assert.equal(missing.captured.status, 400);

  const wrong = fakeRes();
  await handler(fakeReq("/api/commands", "PUT"), wrong.res);
  assert.equal(wrong.captured.status, 405);
  assert.equal(await handler(fakeReq("/api/other", "GET"), fakeRes().res), false);
});