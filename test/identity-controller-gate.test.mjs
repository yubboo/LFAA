import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { NodeIdentityRepository } from "../packages/identity/identity-host-node/src/index.ts";
import { lfaaDevIdentityBridge } from "../packages/api/identity-controller/src/index.ts";

async function startIdentityServer(repository) {
  let middleware = null;
  const plugin = lfaaDevIdentityBridge(repository);
  plugin.configureServer({ middlewares: { use(value) { middleware = value; } } });
  assert.equal(typeof middleware, "function");
  const server = http.createServer((request, response) => {
    void middleware(request, response, () => { response.statusCode = 204; response.end(); });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    base: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

const cookieFrom = (response) => response.headers.get("set-cookie")?.split(";", 1)[0] ?? "";

test("Identity HTTP bridge blocks every protected local Host API before and after authentication", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-identity-http-"));
  const repository = new NodeIdentityRepository(root);
  const server = await startIdentityServer(repository);
  t.after(async () => { await server.close(); await fs.rm(root, { recursive: true, force: true }); });

  let response = await fetch(`${server.base}/__lfaa/dev/agent/run`, { method: "POST" });
  assert.equal(response.status, 428);

  response = await fetch(`${server.base}/__lfaa/dev/identity/initialize`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "very-secure-local-password" }),
  });
  assert.equal(response.status, 200);
  const cookie = cookieFrom(response);
  assert.match(cookie, /^lfaa_auth=/);
  assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly/i);
  assert.match(response.headers.get("set-cookie") ?? "", /SameSite=Strict/i);

  response = await fetch(`${server.base}/__lfaa/dev/agent/run`, { method: "POST" });
  assert.equal(response.status, 401);

  response = await fetch(`${server.base}/__lfaa/dev/agent/run`, { method: "POST", headers: { cookie } });
  assert.equal(response.status, 204);

  response = await fetch(`${server.base}/__lfaa/dev/identity/logout`, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: "{}" });
  assert.equal(response.status, 200);
  response = await fetch(`${server.base}/__lfaa/dev/agent/run`, { method: "POST", headers: { cookie } });
  assert.equal(response.status, 401);
});
