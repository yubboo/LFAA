// 验证 @lfaa/api-gateway 的派发顺序、未命中返回 false、异常上抛与本机接口令牌校验。
import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import test from "node:test";
import { API_TOKEN_HEADER, checkApiAuth, createApiGateway, type ApiRoute } from "../src/index";

/** 构造最小请求/响应替身，只关心被哪个路由命中。 */
function fakeRequest(url: string): IncomingMessage {
  return { url, method: "GET" } as IncomingMessage;
}

function fakeResponse(): ServerResponse {
  return { statusCode: 0, end() {} } as unknown as ServerResponse;
}

function route(id: string, matcher: string): ApiRoute & { hits: number } {
  const entry = {
    id,
    hits: 0,
    async handle(req: IncomingMessage) {
      if (!(req.url ?? "").startsWith(matcher)) return false;
      entry.hits += 1;
      return true;
    },
  };
  return entry;
}

test("按登记顺序派发，只有第一个命中的路由生效", async () => {
  const first = route("plugins-install", "/api/plugins/install");
  const second = route("plugins", "/api/plugins");
  const gateway = createApiGateway([first, second]);

  assert.deepEqual(gateway.list(), ["plugins-install", "plugins"]);
  assert.equal(await gateway.handle(fakeRequest("/api/plugins/install"), fakeResponse()), true);
  assert.equal(first.hits, 1);
  assert.equal(second.hits, 0, "宽泛路由不应抢在具体路由之前");
});

test("未命中任何路由时返回 false，交由宿主继续处理", async () => {
  const gateway = createApiGateway([route("plugins", "/api/plugins")]);
  assert.equal(await gateway.handle(fakeRequest("/api/unknown"), fakeResponse()), false);
});

test("处理器抛错时向调用方抛出，不在网关内吞掉", async () => {
  const gateway = createApiGateway([
    {
      id: "boom",
      async handle() {
        throw new Error("路由内部错误");
      },
    },
  ]);
  await gateway.handle(fakeRequest("/api/x"), fakeResponse()).then(
    () => assert.fail("必须抛出"),
    (error: Error) => assert.match(error.message, /路由内部错误/),
  );
});

const TOKEN = "0123456789abcdef0123456789abcdef";
const OPTIONS = { token: TOKEN };

/** 构造带 url/method/headers 的请求替身，用于鉴权分支测试。 */
function authRequest(
  url: string,
  method = "GET",
  headers: Record<string, string> = {},
): IncomingMessage {
  return { url, method, headers } as unknown as IncomingMessage;
}

test("非 /api 路径不参与鉴权，静态资源与 HMR 不受影响", () => {
  assert.deepEqual(checkApiAuth(authRequest("/src/main.tsx"), OPTIONS), { allowed: true });
  assert.deepEqual(checkApiAuth(authRequest("/@vite/client"), OPTIONS), { allowed: true });
  assert.deepEqual(checkApiAuth(authRequest("/"), OPTIONS), { allowed: true });
});

test("缺少令牌时返回 401，即使请求来自同源", () => {
  const decision = checkApiAuth(authRequest("/api/chat/sessions", "GET", { host: "127.0.0.1:5173" }), OPTIONS);
  assert.equal(decision.allowed, false);
  assert.equal(decision.allowed ? 0 : decision.status, 401);
});

test("令牌错误时返回 401，且不因前缀相同而放行", () => {
  const decision = checkApiAuth(
    authRequest("/api/chat/sessions", "GET", { [API_TOKEN_HEADER]: TOKEN.slice(0, 16) }),
    OPTIONS,
  );
  assert.equal(decision.allowed ? 0 : decision.status, 401);
});

test("请求头携带正确令牌时放行", () => {
  assert.deepEqual(
    checkApiAuth(authRequest("/api/chat/sessions", "POST", { [API_TOKEN_HEADER]: TOKEN }), OPTIONS),
    { allowed: true },
  );
});

test("GET 允许用查询参数携带令牌，供 EventSource 使用；非 GET 不接受查询令牌", () => {
  assert.deepEqual(checkApiAuth(authRequest(`/api/agent/runs/1/events?token=${TOKEN}`), OPTIONS), { allowed: true });
  assert.equal(
    checkApiAuth(authRequest(`/api/chat/sessions?token=${TOKEN}`, "POST"), OPTIONS).allowed,
    false,
  );
});

test("跨源 Origin 即使带正确令牌也返回 403", () => {
  const decision = checkApiAuth(
    authRequest("/api/plugins/install", "POST", {
      host: "127.0.0.1:5173",
      origin: "https://evil.example",
      [API_TOKEN_HEADER]: TOKEN,
    }),
    OPTIONS,
  );
  assert.equal(decision.allowed, false);
  assert.equal(decision.allowed ? 0 : decision.status, 403);
});

test("同源 Origin 带正确令牌时放行", () => {
  assert.deepEqual(
    checkApiAuth(
      authRequest("/api/plugins/install", "POST", {
        host: "127.0.0.1:5173",
        origin: "http://127.0.0.1:5173",
        [API_TOKEN_HEADER]: TOKEN,
      }),
      OPTIONS,
    ),
    { allowed: true },
  );
});

test("Sec-Fetch-Site 为 cross-site 时直接拒绝，不依赖 Origin 头是否存在", () => {
  const decision = checkApiAuth(
    authRequest("/api/plugins/add/stream", "GET", {
      host: "127.0.0.1:5173",
      "sec-fetch-site": "cross-site",
      [API_TOKEN_HEADER]: TOKEN,
    }),
    OPTIONS,
  );
  assert.equal(decision.allowed ? 0 : decision.status, 403);
});

test("OPTIONS 预检本身放行，避免影响后续合法请求", () => {
  assert.deepEqual(checkApiAuth(authRequest("/api/chat/sessions", "OPTIONS"), OPTIONS), { allowed: true });
});
