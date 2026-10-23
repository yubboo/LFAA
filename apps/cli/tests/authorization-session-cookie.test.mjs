/** 功能：验证失效认证请求不会清理后来签发的新会话 Cookie。作用：保护登录响应与旧请求响应乱序时的身份边界。 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const data = mkdtempSync(join(tmpdir(), "lfaa-auth-cookie-race-"));
process.env.LFAA_HOME = data;
process.env.LFAA_DATA_DIR = join(data, "data");
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "";

const { requireAuthentication } = await import("lfaa-authorization/src/middleware.js");
const { closeDatabase } = await import("lfaa-storage-sqlite/src/database.js");

test.after(() => {
  closeDatabase();
  assert.equal(resolve(data), data);
  rmSync(data, { recursive: true, force: true });
});

test("缺失或失效会话返回 401，但不发送会删除当前浏览器 Cookie 的响应头", () => {
  for (const cookie of [undefined, "lfaa_session=stale.invalid.session"]) {
    const request = { headers: cookie ? { cookie } : {} };
    const response = {
      statusCode: 200,
      body: undefined,
      headers: [],
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
      append(name, value) { this.headers.push([name, value]); return this; }
    };
    let nextCalled = false;
    requireAuthentication(request, response, () => { nextCalled = true; });

    assert.equal(response.statusCode, 401);
    assert.ok(["authentication_required", "invalid_session"].includes(response.body.error));
    assert.equal(nextCalled, false);
    assert.deepEqual(response.headers, []);
  }
});
