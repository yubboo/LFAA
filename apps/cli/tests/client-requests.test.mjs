/**
 * 功能：验证前端同一时刻的只读请求合并及写入边界。
 * 作用：用合成响应统计真实 API 函数的 fetch 次数，确保读取无长期缓存、失败可重试、身份切换不复用旧请求。
 * 关联文件：packages/client/connection/src/api.ts。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { loadAiExtensions, loadAiAccounts, loadSettings, saveSettings, login, ApiError } from "../../../packages/client/connection/src/api.ts";
import { DEFAULT_USER_SETTINGS } from "../../../packages/client/ui-settings-general/src/default-settings.ts";

function deferredFetch(t) {
  const calls = [];
  t.mock.method(globalThis, "fetch", (url, options) => {
    const pending = Promise.withResolvers();
    calls.push({ url, options, ...pending });
    return pending.promise;
  });
  return calls;
}
function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

test("多个组件的相同并发读取只发一次请求，各自获得独立数据，完成后再次读取走网络", async (t) => {
  const calls = deferredFetch(t);
  const first = loadAiExtensions();
  const second = loadAiExtensions();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.credentials, "include");
  calls[0].resolve(jsonResponse({ extensions: [{ id: "测试夹具" }], plugins: [], hooks: [] }));
  const [a, b] = await Promise.all([first, second]);
  a.extensions[0].id = "调用者修改";
  assert.equal(b.extensions[0].id, "测试夹具");
  const fresh = loadAiExtensions();
  assert.equal(calls.length, 2);
  calls[1].resolve(jsonResponse({ extensions: [], plugins: [], hooks: [] }));
  await fresh;
});

test("不同路径独立请求，失败后清除共享登记并允许重试", async (t) => {
  const calls = deferredFetch(t);
  const first = loadAiExtensions();
  const accounts = loadAiAccounts();
  assert.equal(calls.length, 2);
  const rejected = assert.rejects(first, (error) => error instanceof ApiError && error.status === 503);
  calls[0].resolve(jsonResponse({ error: "unavailable", message: "测试服务不可用" }, 503));
  calls[1].resolve(jsonResponse({ accounts: [] }));
  await Promise.all([rejected, accounts]);
  const retry = loadAiExtensions();
  assert.equal(calls.length, 3);
  calls[2].resolve(jsonResponse({ extensions: [], plugins: [], hooks: [] }));
  await retry;
});

test("登录写入前后不能加入此前身份的读取，旧请求完成不能删除新的登记", async (t) => {
  const calls = deferredFetch(t);
  const oldRead = loadAiAccounts();
  const signingIn = login("隔离测试用户", "隔离测试密码");
  assert.equal(calls.length, 2);
  const duringLogin = loadAiAccounts();
  assert.equal(calls.length, 3);
  calls[1].resolve(jsonResponse({ user: { id: "隔离用户" } }));
  await signingIn;
  const afterLogin = loadAiAccounts();
  assert.equal(calls.length, 4);
  calls[0].resolve(jsonResponse({ accounts: [{ id: "旧夹具" }] }));
  await oldRead;
  const joined = loadAiAccounts();
  assert.equal(calls.length, 4);
  calls[2].resolve(jsonResponse({ accounts: [] }));
  calls[3].resolve(jsonResponse({ accounts: [{ id: "新夹具" }] }));
  await duringLogin;
  const [fresh, shared] = await Promise.all([afterLogin, joined]);
  assert.equal(fresh.accounts[0].id, "新夹具");
  assert.deepEqual(shared, fresh);
});

test("并发鉴权失败只通知一次会话失效，其他旧查询不再被新调用加入", async (t) => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const browserEvents = new EventTarget();
  Object.defineProperty(globalThis, "window", { configurable: true, value: browserEvents });
  t.after(() => {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else delete globalThis.window;
  });
  let expiredEvents = 0;
  browserEvents.addEventListener("lfaa:session-expired", () => { expiredEvents += 1; });
  const calls = deferredFetch(t);
  const first = loadAiExtensions();
  const second = loadAiExtensions();
  const oldAccounts = loadAiAccounts();
  const rejected = Promise.all([first, second].map((pending) => assert.rejects(pending, (error) => error instanceof ApiError && error.code === "invalid_session")));
  calls[0].resolve(jsonResponse({ error: "invalid_session", message: "测试会话已失效" }, 401));
  await rejected;
  assert.equal(expiredEvents, 1);
  const newAccounts = loadAiAccounts();
  assert.equal(calls.length, 3);
  calls[1].resolve(jsonResponse({ accounts: [] }));
  calls[2].resolve(jsonResponse({ accounts: [] }));
  await Promise.all([oldAccounts, newAccounts]);
});

test("设置读取保留已保存外观，保存后下一次读取重新取得权威设置", async (t) => {
  const calls = deferredFetch(t);
  const settings = structuredClone(DEFAULT_USER_SETTINGS);
  settings.appearance.theme = "dark";
  settings.appearance.overlay = 73;
  settings.appearance.blur = 8;
  const initial = loadSettings();
  calls[0].resolve(jsonResponse({ settings }));
  assert.deepEqual((await initial).settings.appearance, settings.appearance);
  const appearance = { ...settings.appearance, theme: "light" };
  const saving = saveSettings("appearance", appearance);
  assert.equal(calls[1].url, "/api/settings/appearance");
  assert.equal(calls[1].options.method, "PUT");
  assert.deepEqual(JSON.parse(calls[1].options.body), appearance);
  calls[1].resolve(jsonResponse({ settings: { ...settings, appearance } }));
  await saving;
  const refreshed = loadSettings();
  assert.equal(calls.length, 3);
  calls[2].resolve(jsonResponse({ settings: { ...settings, appearance } }));
  assert.deepEqual((await refreshed).settings.appearance, appearance);
});
