// 验证会话标题：启发式清洗、模型输出归一、模型失败回落与 HTTP 接口分支。
import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import test from "node:test";
import {
  createSessionTitleHttpHandler,
  generateConciseSessionTitle,
  generateSessionTitle,
  normalizeGeneratedTitle,
  type SessionTitleLlm,
  type SessionTitleService,
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

test("启发式标题：去客套前缀、去代码块、限长与空输入回落", () => {
  assert.match(generateConciseSessionTitle("你好，请帮我检查一下登录流程是否正常，另外看看刷新令牌"), /登录流程/u);
  assert.doesNotMatch(generateConciseSessionTitle("帮我看看这个 bug"), /帮我看看/u);
  assert.equal(generateConciseSessionTitle("```ts\nconst a = 1;\n```"), "新聊天");
  assert.ok(generateConciseSessionTitle("请用三句话介绍一下 LFAA 项目：它有哪些核心能力").length <= 16);
  assert.ok(generateConciseSessionTitle("Please summarize the whole repository architecture and module layout").length <= 24);
});

test("模型标题归一：去标题前缀、引号与结尾标点，超长截断", () => {
  assert.equal(normalizeGeneratedTitle("标题：修复登录状态"), "修复登录状态");
  assert.equal(normalizeGeneratedTitle('  "会话标题生成"  '), "会话标题生成");
  assert.equal(normalizeGeneratedTitle("登录修复。"), "登录修复");
  assert.equal(normalizeGeneratedTitle("   "), "");
  assert.ok(normalizeGeneratedTitle("x".repeat(80)).length <= 40);
});

test("模型生成：成功归一，异常与空结果回落启发式", async () => {
  const llm: SessionTitleLlm = { complete: async () => ({ content: "标题：登录接口修复。" }) };
  const ok = await generateSessionTitle(llm, { userMessage: "帮我修复登录接口 500 错误", assistantReply: "已修复" });
  assert.deepEqual(ok, { title: "登录接口修复", source: "llm" });

  const failing: SessionTitleLlm = { complete: async () => { throw new Error("no key"); } };
  const fallback = await generateSessionTitle(failing, { userMessage: "帮我修复登录接口 500 错误" });
  assert.equal(fallback.source, "heuristic");
  assert.match(fallback.title, /登录接口/u);

  const empty: SessionTitleLlm = { complete: async () => ({ content: "   " }) };
  assert.equal((await generateSessionTitle(empty, { userMessage: "写一个签到插件" })).source, "heuristic");
});

test("HTTP：POST 生成标题、缺参 400、其他方法 405、非目标路径放行", async () => {
  const service = {
    concise: generateConciseSessionTitle,
    generate: async (input: { userMessage: string }) => ({ title: generateConciseSessionTitle(input.userMessage), source: "heuristic" as const }),
  } as unknown as SessionTitleService;
  const handler = createSessionTitleHttpHandler(service);

  const ok = fakeRes();
  await handler(fakeReq("/api/session-title", "POST", { userMessage: "帮我补测试" }), ok.res);
  assert.equal(ok.captured.status, 200);
  assert.match(ok.captured.body, /"source":"heuristic"/u);

  const missing = fakeRes();
  await handler(fakeReq("/api/session-title", "POST", {}), missing.res);
  assert.equal(missing.captured.status, 400);

  const wrong = fakeRes();
  await handler(fakeReq("/api/session-title", "GET"), wrong.res);
  assert.equal(wrong.captured.status, 405);
  assert.equal(await handler(fakeReq("/api/other", "POST"), fakeRes().res), false);
});