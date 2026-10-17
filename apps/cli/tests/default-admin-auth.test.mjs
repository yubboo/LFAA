/** 功能：验收首次运行默认管理员的种入、登录和凭据变更。作用：确认公开注册已移除，默认账户只创建一次且不会覆盖已有数据。 */
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("空库首次登录种入一次默认超级管理员，安全提醒和用户凭据变更沿用认证 Owner", { timeout: 30000 }, async (t) => {
  const data = mkdtempSync(join(tmpdir(), "lfaa-default-admin-"));
  process.env.LFAA_DATA_DIR = data;
  process.env.LFAA_HOME = `${data}-home`;
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "";
  process.env.LOG_LEVEL = "error";
  process.env.SERVER_HOST = "127.0.0.1";
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  process.env.SERVER_PORT = String(reservation.address().port);
  await new Promise((resolveClose) => reservation.close(resolveClose));

  const { boot } = await import("lfaa-app-boot/src/index.js");
  const context = await boot(["web"]);
  const base = `http://127.0.0.1:${process.env.SERVER_PORT}/api`;
  t.after(async () => {
    await context.fiber.dispose();
    assert.equal(resolve(data), data);
    rmSync(data, { recursive: true, force: true });
    rmSync(process.env.LFAA_HOME, { recursive: true, force: true });
  });

  const { database } = await import("lfaa-storage-sqlite/src/database.js");
  assert.equal(database.prepare("SELECT count(*) AS count FROM users").get().count, 0);
  assert.equal((await fetch(`${base}/auth/setup-status`)).status, 404);
  assert.equal((await fetch(`${base}/auth/setup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "public-registration", password: "Not-Allowed-93!" }) })).status, 404);

  const failedFirstLogin = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "wrong-password" })
  });
  assert.equal(failedFirstLogin.status, 401);

  const seeded = database.prepare("SELECT id, username, role, is_super_admin, password_hash, default_username_pending, default_password_pending FROM users").get();
  assert.equal(seeded.username, "admin");
  assert.equal(seeded.role, "admin");
  assert.equal(seeded.is_super_admin, 1);
  assert.notEqual(seeded.password_hash, "123456");
  assert.equal(seeded.default_username_pending, 1);
  assert.equal(seeded.default_password_pending, 1);
  assert.equal(database.prepare("SELECT count(*) AS count FROM users").get().count, 1);

  const login = async (username, password) => fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const firstLogin = await login("admin", "123456");
  assert.equal(firstLogin.status, 200);
  const { user } = await firstLogin.json();
  assert.equal(user.role, "super_admin");
  assert.equal(user.id, seeded.id);
  const headers = { "Content-Type": "application/json", Cookie: firstLogin.headers.get("set-cookie").split(";")[0] };

  const secondLogin = await login("admin", "123456");
  assert.equal(secondLogin.status, 200);
  assert.equal(database.prepare("SELECT count(*) AS count FROM users").get().count, 1);
  const reminder = await fetch(`${base}/auth/default-credential-reminder`, { headers });
  assert.equal(reminder.status, 200);
  assert.deepEqual(await reminder.json(), { usernamePending: true, passwordPending: true });

  const invalidRename = await fetch(`${base}/auth/username`, { method: "PUT", headers, body: JSON.stringify({ currentPassword: "wrong-password", username: "admin-renamed" }) });
  assert.equal(invalidRename.status, 401);
  const renamed = await fetch(`${base}/auth/username`, { method: "PUT", headers, body: JSON.stringify({ currentPassword: "123456", username: "admin-renamed" }) });
  assert.equal(renamed.status, 200);
  assert.equal((await renamed.json()).user.username, "admin-renamed");
  assert.deepEqual({ ...database.prepare("SELECT default_username_pending, default_password_pending FROM users WHERE id=?").get(user.id) }, { default_username_pending: 0, default_password_pending: 1 });
  assert.equal((await login("admin", "123456")).status, 401);
  assert.equal((await login("admin-renamed", "123456")).status, 200);

  const invalidPasswordChange = await fetch(`${base}/auth/password`, { method: "PUT", headers, body: JSON.stringify({ currentPassword: "wrong-password", newPassword: "LFAA-Strong-Admin!2026" }) });
  assert.equal(invalidPasswordChange.status, 401);
  const passwordChange = await fetch(`${base}/auth/password`, { method: "PUT", headers, body: JSON.stringify({ currentPassword: "123456", newPassword: "LFAA-Strong-Admin!2026" }) });
  assert.equal(passwordChange.status, 200);
  assert.deepEqual({ ...database.prepare("SELECT default_username_pending, default_password_pending FROM users WHERE id=?").get(user.id) }, { default_username_pending: 0, default_password_pending: 0 });
  assert.equal((await login("admin-renamed", "123456")).status, 401);
  assert.equal((await login("admin-renamed", "LFAA-Strong-Admin!2026")).status, 200);

  const dismissed = await fetch(`${base}/auth/default-credential-reminder/dismiss`, { method: "POST", headers });
  assert.equal(dismissed.status, 204);
  assert.deepEqual(await (await fetch(`${base}/auth/default-credential-reminder`, { headers })).json(), { usernamePending: false, passwordPending: false });
});
