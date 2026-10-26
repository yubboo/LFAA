import test from "node:test";
import assert from "node:assert/strict";

const { Router } = await import("express");
const { registerRoutes } = await import("lfaa-api-settings-controller/src/index.js");
const credentialPath = "/settings/ai/external-agents/anthropic-credential";

function findHandler(router, method, path) {
  const route = router.stack.map(layer => layer.route).find(candidate => candidate?.path === path && candidate.methods[method]);
  assert.ok(route, `${method.toUpperCase()} ${path} route is registered`);
  return route.stack[1].handle;
}

function invoke(handler, request) {
  return new Promise((resolve, reject) => {
    const response = {
      statusCode: 200,
      body: undefined,
      json(value) { this.body = value; resolve(this); return this; },
      status(statusCode) { this.statusCode = statusCode; return this; },
      end() { resolve(this); return this; }
    };
    try {
      const result = handler(request, response, error => reject(error));
      if (result && typeof result.then === "function") result.catch(reject);
    } catch (error) {
      reject(error);
    }
  });
}

test("Anthropic 凭据 API 按当前账户读取状态、验证保存并删除且不返回 Key", async () => {
  const statusByUser = new Map();
  const calls = [];
  const owner = {
    getCredentialStatus(userId) { return statusByUser.get(userId) ?? { configured: false }; },
    async verifyAndSaveCredential(userId, secret) {
      calls.push({ userId, secret });
      const status = { configured: true, updatedAt: "2026-10-27T00:00:00.000Z" };
      statusByUser.set(userId, status);
      return status;
    },
    deleteCredential(userId) { return statusByUser.delete(userId); }
  };
  const router = Router();
  registerRoutes(router, {}, null, {}, owner);
  const getCredential = findHandler(router, "get", credentialPath);
  const putCredential = findHandler(router, "put", credentialPath);
  const deleteCredential = findHandler(router, "delete", credentialPath);
  const userA = { auth: { user: { id: "account-a", role: "member" } } };
  const userB = { auth: { user: { id: "account-b", role: "member" } } };
  const secret = "sk-ant-secret-fixture";

  assert.deepEqual((await invoke(getCredential, userA)).body, { credential: { configured: false } });
  const saved = await invoke(putCredential, { ...userA, body: { secret } });
  assert.deepEqual(calls, [{ userId: "account-a", secret }]);
  assert.deepEqual(saved.body, { credential: { configured: true, updatedAt: "2026-10-27T00:00:00.000Z" } });
  assert.equal(JSON.stringify(saved.body).includes(secret), false);
  assert.deepEqual((await invoke(getCredential, userB)).body, { credential: { configured: false } });
  assert.deepEqual((await invoke(getCredential, userA)).body, { credential: { configured: true, updatedAt: "2026-10-27T00:00:00.000Z" } });
  assert.equal((await invoke(deleteCredential, userA)).statusCode, 204);
  assert.deepEqual((await invoke(getCredential, userA)).body, { credential: { configured: false } });
});
