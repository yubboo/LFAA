/** 功能：回归 Minecraft 默认核心选项 API。作用：确认认证后只读本地核心登记名，不等待外部目录。 */
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

test("Minecraft 默认核心名称要求认证且不请求远端版本目录", { timeout: 30_000 }, async () => {
  const temporaryParent = resolve(dirname(fileURLToPath(import.meta.url)), "../../../dist/.tmp");
  mkdirSync(temporaryParent, { recursive: true });
  const data = mkdtempSync(join(temporaryParent, "lfaa-minecraft-core-names-"));
  process.env.LFAA_DATA_DIR = data;
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "";
  process.env.LFAA_HARNESS_HOME = "";
  process.env.LFAA_LOCAL_MODE = "true";
  process.env.SERVER_HOST = "127.0.0.1";
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  process.env.SERVER_PORT = String(reservation.address().port);
  await new Promise(resolveClose => reservation.close(resolveClose));

  const { boot } = await import("lfaa-app-boot/src/index.js");
  const { minecraftCoreNames } = await import("lfaa-games-minecraft/src/core-sources.js");
  const context = await boot(["--profile", "web"]);
  const base = `http://127.0.0.1:${process.env.SERVER_PORT}/api`;
  try {
    assert.equal((await fetch(`${base}/minecraft/core-names`)).status, 401);
    const setup = await fetch(`${base}/auth/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "minecraft-core-names-admin", password: "Minecraft-core-names-test-93!" })
    });
    assert.equal(setup.status, 201);
    const headers = { Cookie: setup.headers.get("set-cookie").split(";")[0] };

    const originalFetch = globalThis.fetch;
    let externalRequests = 0;
    globalThis.fetch = (input, init) => {
      const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
      if (url.origin === base) return originalFetch(input, init);
      if (url.protocol === "https:") externalRequests += 1;
      return originalFetch(input, init);
    };
    let response;
    try {
      response = await fetch(`${base}/minecraft/core-names`, { headers });
    } finally {
      globalThis.fetch = originalFetch;
    }
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).cores, minecraftCoreNames);
    assert.equal(externalRequests, 0, "默认核心选项不能等待 Minecraft 上游版本目录");
  } finally {
    await context.fiber.dispose();
    if (dirname(data) !== temporaryParent) throw new Error("拒绝清理测试根以外的路径。");
    rmSync(data, { recursive: true, force: true });
  }
});
