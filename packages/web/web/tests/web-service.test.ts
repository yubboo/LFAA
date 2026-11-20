// 验证网页 seam 的实现排序、注销与失败回退语义。
import assert from "node:assert/strict";
import { Context } from "@deepseek-ai/cordis";
import test from "node:test";
import { orderProviders, WebService, type WebProvider } from "../src/index";

function provider(id: string, priority: number, text: string, failing = false): WebProvider {
  return {
    id,
    priority,
    async fetchText({ url }) {
      if (failing) throw new Error(`${id} 不可用`);
      return { url, finalUrl: url, status: 200, contentType: "text/html", text, truncated: false };
    },
  };
}

test("按优先级从高到低排序，缺省为 0", () => {
  const ordered = orderProviders([provider("a", 1, "A"), provider("b", 5, "B"), provider("c", -1, "C")]);
  assert.deepEqual(ordered.map((item) => item.id), ["b", "a", "c"]);
});

test("高优先级失败时回退到下一个实现", async () => {
  const ctx = new Context();
  const web = new WebService(ctx);
  web.registerProvider(provider("broken", 10, "", true));
  web.registerProvider(provider("http", 0, "正文"));
  const result = await web.fetchText({ url: "https://example.com/" });
  assert.equal(result.text, "正文");
});

test("全部实现失败时汇总错误，未注册实现时给出明确提示", async () => {
  const ctx = new Context();
  const web = new WebService(ctx);
  await assert.rejects(() => web.fetchText({ url: "https://example.com/" }), /先挂载 @lfaa\/web-fetch-http/u);
  web.registerProvider(provider("only", 0, "", true));
  await assert.rejects(() => web.fetchText({ url: "https://example.com/" }), /only: only 不可用/u);
});

test("注销后的实现不再参与抓取", async () => {
  const ctx = new Context();
  const web = new WebService(ctx);
  const dispose = web.registerProvider(provider("http", 0, "正文"));
  assert.deepEqual(web.listProviders().map((item) => item.id), ["http"]);
  dispose();
  assert.deepEqual(web.listProviders(), []);
  await assert.rejects(() => web.fetchText({ url: "https://example.com/" }));
});