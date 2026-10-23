/** 功能：回归 AI 漫剧认证 API。作用：验证未认证拒绝、账户内 CRUD、输入校验和并发冲突。 */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

test("AI 漫剧 API 仅向认证账户开放并持久化画布更新", async () => {
  const temporaryParent = resolve(dirname(fileURLToPath(import.meta.url)), "../../../dist/.tmp");
  mkdirSync(temporaryParent, { recursive: true });
  const data = mkdtempSync(join(temporaryParent, "lfaa-aivideo-api-"));
  const home = mkdtempSync(join(temporaryParent, "lfaa-aivideo-api-home-"));
  process.env.LFAA_HOME = home;
  process.env.LFAA_DATA_DIR = data;
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "";
  process.env.LFAA_HARNESS_HOME = "";
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  process.env.SERVER_PORT = String(reservation.address().port);
  await new Promise(resolve => reservation.close(resolve));
  process.env.LFAA_LOCAL_MODE = "true";
  delete process.env.LFAA_DATA_DIR_CONFIGURED;
  delete process.env.LFAA_DATA_DIR_MANAGED_BY_LAUNCHER;
  delete process.env.LFAA_DATA_DIR_MANAGED_BY_DESKTOP;

  const { boot } = await import("lfaa-app-boot/src/index.js");
  const context = await boot(["--profile", "web"]);
  try {
    const base = `http://127.0.0.1:${process.env.SERVER_PORT}/api`;
    assert.equal((await fetch(`${base}/ai-video/canvases`)).status, 401);
    assert.equal((await fetch(`${base}/local-models`)).status, 401);
    const setup = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "123456" })
    });
    assert.equal(setup.status, 200);
    const cookie = setup.headers.get("set-cookie").split(";")[0];
    const headers = { "Content-Type": "application/json", Cookie: cookie };
    const localModelsResponse = await fetch(`${base}/local-models`, { headers });
    assert.equal(localModelsResponse.status, 200, await localModelsResponse.clone().text());
    assert.deepEqual((await localModelsResponse.json()).models.map(model => model.id), ["moss-image-base", "moss-image-sft", "minimax-h3"]);
    const createdResponse = await fetch(`${base}/ai-video/canvases`, {
      method: "POST", headers, body: JSON.stringify({ title: "第一幕" })
    });
    assert.equal(createdResponse.status, 201, await createdResponse.clone().text());
    const { canvas: created } = await createdResponse.json();

    const firstId = randomUUID();
    const secondId = randomUUID();
    const input = {
      title: "街角相遇",
      shots: [
        { id: firstId, title: "街景", description: "黄昏的旧街。", dialogue: "", durationSeconds: 6, x: -120, y: 48 },
        { id: secondId, title: "抬头", description: "主角听到声音后抬头。", dialogue: "谁在那里？", durationSeconds: 4, x: 240, y: 48 }
      ],
      links: [{ id: randomUUID(), source: firstId, target: secondId }]
    };
    const updatedResponse = await fetch(`${base}/ai-video/canvases/${created.id}`, {
      method: "PUT", headers, body: JSON.stringify({ expectedUpdatedAt: created.updatedAt, canvas: input })
    });
    assert.equal(updatedResponse.status, 200);
    const { canvas: updated } = await updatedResponse.json();
    assert.equal(updated.shots[0].x, -120);
    assert.equal(updated.links.length, 1);

    const staleResponse = await fetch(`${base}/ai-video/canvases/${created.id}`, {
      method: "PUT", headers, body: JSON.stringify({ expectedUpdatedAt: created.updatedAt, canvas: input })
    });
    assert.equal(staleResponse.status, 409);
    const listed = await fetch(`${base}/ai-video/canvases`, { headers });
    assert.equal(listed.status, 200);
    assert.equal((await listed.json()).canvases[0].title, "街角相遇");

    const invalid = await fetch(`${base}/ai-video/canvases/${created.id}`, {
      method: "PUT", headers,
      body: JSON.stringify({ expectedUpdatedAt: updated.updatedAt, canvas: { ...input, unexpected: true } })
    });
    assert.equal(invalid.status, 400);
    assert.equal((await fetch(`${base}/ai-video/canvases/${created.id}`, { method: "DELETE", headers })).status, 204);
    assert.equal(context.get("lfaaAiVideo") !== undefined, true);
  } finally {
    await context.fiber.dispose();
    if (dirname(data) !== temporaryParent || dirname(home) !== temporaryParent) throw new Error("拒绝清理测试根以外的路径。");
    rmSync(data, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});
