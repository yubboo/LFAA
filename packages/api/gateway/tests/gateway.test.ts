// 验证 @lfaa/api-gateway 的派发顺序、未命中返回 false 与异常上抛行为。
import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import test from "node:test";
import { createApiGateway, type ApiRoute } from "../src/index";

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
