import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { NodeIdentityRepository } from "../packages/identity/identity-host-node/src/index.ts";

test("first run creates the only initial super admin and auth session", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-identity-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const repository = new NodeIdentityRepository(root);

  assert.deepEqual(await repository.bootstrapState(), { initialized: false });
  const initialized = await repository.initializeSuperAdmin({ username: "Admin", displayName: "Root User", password: "very-secure-local-password" });
  assert.equal(initialized.user.username, "admin");
  assert.deepEqual(initialized.user.roleIds, ["super_admin"]);
  assert.ok(initialized.token.length >= 32);
  assert.deepEqual(await repository.bootstrapState(), { initialized: true });
  await assert.rejects(() => repository.initializeSuperAdmin({ username: "second", password: "another-secure-password" }), /已完成初始化/);

  const identity = await repository.authenticate(initialized.token);
  assert.equal(identity?.user.id, initialized.user.id);
  assert.ok(identity?.permissions.includes("*"));

  await repository.logout(initialized.token);
  assert.equal(await repository.authenticate(initialized.token), null);
});

test("login, roles and users keep password/token secrets out of public snapshots", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-identity-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const repository = new NodeIdentityRepository(root);
  await repository.initializeSuperAdmin({ username: "admin", password: "very-secure-local-password" });

  await assert.rejects(() => repository.login({ username: "admin", password: "wrong-password-value" }), /用户名或密码错误/);
  const login = await repository.login({ username: "admin", password: "very-secure-local-password" });
  assert.equal(login.user.username, "admin");

  let snapshot = await repository.createRole({ id: "operator", name: "服务器运维", permissions: ["server.*", "agent.run"] });
  assert.ok(snapshot.roles.some((role) => role.id === "operator"));
  snapshot = await repository.createUser({ username: "operator1", password: "operator-secure-password", roleIds: ["operator"] });
  const user = snapshot.users.find((item) => item.username === "operator1");
  assert.deepEqual(user?.roleIds, ["operator"]);
  assert.equal(JSON.stringify(snapshot).includes("passwordHash"), false);
  assert.equal(JSON.stringify(snapshot).includes("passwordSalt"), false);
  assert.equal(JSON.stringify(snapshot).includes(login.token), false);
});

test("First Run root cannot be cloned through role assignment or wildcard custom roles", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-identity-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const repository = new NodeIdentityRepository(root);
  await repository.initializeSuperAdmin({ username: "admin", password: "very-secure-local-password" });
  let snapshot = await repository.createUser({ username: "member1", password: "member-secure-password" });
  const member = snapshot.users.find((item) => item.username === "member1");
  assert.ok(member);
  await assert.rejects(() => repository.updateUser(member.id, { roleIds: ["super_admin"] }), /只属于 First Run 根账户/);
  await assert.rejects(() => repository.createRole({ id: "root_clone", name: "Root Clone", permissions: ["*"] }), /Root 权限/);
});

test("disabling a user invalidates existing AuthSessions and re-enabling does not resurrect them", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lfaa-identity-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const repository = new NodeIdentityRepository(root);
  await repository.initializeSuperAdmin({ username: "admin", password: "very-secure-local-password" });
  let snapshot = await repository.createUser({ username: "member2", password: "member-secure-password" });
  const member = snapshot.users.find((item) => item.username === "member2");
  assert.ok(member);
  const login = await repository.login({ username: "member2", password: "member-secure-password" });
  assert.ok(await repository.authenticate(login.token));
  await repository.updateUser(member.id, { disabled: true });
  assert.equal(await repository.authenticate(login.token), null);
  await repository.updateUser(member.id, { disabled: false });
  assert.equal(await repository.authenticate(login.token), null);
});
