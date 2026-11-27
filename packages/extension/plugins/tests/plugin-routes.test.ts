// 验证插件安装流式接口：只接受 POST + JSON，SSE 逐行推送日志并以 done/failed 收尾。
import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import test from "node:test";
import { createPluginsHttpHandler } from "../src/routes/plugin-routes";
import type { PluginsService } from "../src/index";

interface FakeResponse extends ServerResponse {
  captured: { statusCode: number; headers: Record<string, string>; body: string };
}

function fakeResponse(): FakeResponse {
  const captured = { statusCode: 0, headers: {} as Record<string, string>, body: "" };
  const res = {
    captured,
    setHeader(name: string, value: string) {
      captured.headers[name.toLowerCase()] = value;
    },
    write(chunk: string | Buffer) {
      captured.body += String(chunk);
      return true;
    },
    end(chunk?: string | Buffer) {
      if (chunk !== undefined) captured.body += String(chunk);
      return res as unknown as ServerResponse;
    },
  } as unknown as FakeResponse;
  Object.defineProperty(res, "statusCode", {
    get: () => captured.statusCode,
    set: (value: number) => { captured.statusCode = value; },
  });
  return res;
}

function fakeRequest(url: string, method: string, body?: unknown): IncomingMessage {
  const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
  return {
    url,
    method,
    headers: payload ? { "content-type": "application/json", "content-length": String(payload.length) } : {},
    async *[Symbol.asyncIterator]() {
      if (payload) yield payload;
    },
  } as unknown as IncomingMessage;
}

function fakeService(overrides: Partial<Record<"listState" | "addExternal" | "toggleBuiltin" | "listInventory", unknown>> = {}): PluginsService {
  return {
    listState: overrides.listState ?? (async () => ({ profile: "web", installed: [], presets: [], activePreset: "standard" })),
    addExternal: overrides.addExternal ?? (async () => ({ id: "demo" })),
    listInventory: overrides.listInventory ?? (async () => ({ profile: "web", entries: [], presets: [], activePreset: "standard", managementAvailable: true })),
    toggleBuiltin: overrides.toggleBuiltin ?? (async () => ({ profile: "web", entries: [], presets: [], activePreset: "standard", managementAvailable: true })),
  } as unknown as PluginsService;
}

test("POST 内置插件启停返回新清单", async () => {
  const service = fakeService({
    toggleBuiltin: async (moduleName: string, enabled: boolean) => ({ profile: "web", entries: [], presets: [], activePreset: "standard", managementAvailable: true, echoed: `${moduleName}:${enabled}` }),
  });
  const handler = createPluginsHttpHandler(service);
  const res = fakeResponse();
  const handled = await handler(fakeRequest("/api/plugins/inventory/toggle", "POST", { moduleName: "@lfaa/browser", enabled: false }), res);
  assert.equal(handled, true);
  assert.equal(res.captured.statusCode, 200);
  assert.match(res.captured.body, /@lfaa\/browser:false/u);
});

test("内置插件启停缺少 enabled 时返回 400", async () => {
  const handler = createPluginsHttpHandler(fakeService());
  const res = fakeResponse();
  await handler(fakeRequest("/api/plugins/inventory/toggle", "POST", { moduleName: "@lfaa/browser" }), res);
  assert.equal(res.captured.statusCode, 400);
  assert.match(res.captured.body, /enabled/u);
});

test("流式安装只接受 POST，GET 返回 405 并声明 Allow", async () => {
  const handler = createPluginsHttpHandler(fakeService());
  const res = fakeResponse();
  const handled = await handler(fakeRequest("/api/plugins/add/stream?spec=x", "GET"), res);
  assert.equal(handled, true);
  assert.equal(res.captured.statusCode, 405);
  assert.equal(res.captured.headers.allow, "POST");
  assert.match(res.captured.body, /只接受 POST/u);
});

test("POST 流式安装逐行推送日志并以 done 收尾", async () => {
  const service = fakeService({
    addExternal: async (_spec: string, onLine?: (line: string) => void) => {
      onLine?.("pnpm: resolving dependencies");
      return { id: "demo", moduleName: "demo" };
    },
  });
  const handler = createPluginsHttpHandler(service);
  const res = fakeResponse();
  const handled = await handler(fakeRequest("/api/plugins/add/stream", "POST", { spec: "git+https://example.com/demo" }), res);
  assert.equal(handled, true);
  assert.equal(res.captured.statusCode, 200);
  assert.match(res.captured.headers["content-type"] ?? "", /text\/event-stream/u);
  assert.match(res.captured.body, /event: log\ndata: "pnpm: resolving dependencies"/u);
  assert.match(res.captured.body, /event: done\n/u);
  assert.match(res.captured.body, /"id":"demo"/u);
});

test("POST 流式安装失败时以 failed 事件返回原因", async () => {
  const service = fakeService({
    addExternal: async () => { throw new Error("非法安装来源"); },
  });
  const handler = createPluginsHttpHandler(service);
  const res = fakeResponse();
  await handler(fakeRequest("/api/plugins/add/stream", "POST", { spec: "bad" }), res);
  assert.equal(res.captured.statusCode, 200);
  assert.match(res.captured.body, /event: failed\n/u);
  assert.match(res.captured.body, /非法安装来源/u);
});

test("未登记的插件路径返回 404", async () => {
  const handler = createPluginsHttpHandler(fakeService());
  const res = fakeResponse();
  const handled = await handler(fakeRequest("/api/plugins/unknown/route", "GET"), res);
  assert.equal(handled, true);
  assert.equal(res.captured.statusCode, 404);
});
