/**
 * 功能：验证 Minecraft 实际属性写回的共享校验与原子文件提交。
 * 作用：在隔离临时目录核对真实文件保留、更新与拒绝边界，不触碰用户实例。
 * 关联文件：packages/util/values/src/minecraft-property-contract.mjs、packages/host/daemon/src/minecraft-properties-file.mjs。
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, lstat, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import test from "node:test";
import { commitMinecraftPropertyFile } from "../../../packages/host/daemon/src/minecraft-properties-file.mjs";
import { validateMinecraftPropertyChanges } from "../../../packages/util/values/src/minecraft-property-contract.mjs";
import { protectTaskSecret, revealTaskSecret } from "../../../packages/settings/settings/src/service.ts";
import { revealMinecraftTaskPropertySecrets, withoutMinecraftTaskPropertySecrets } from "../../../packages/games/minecraft/src/service.ts";

test("仅更新真实快照键、保留其他属性并原子写回文件", async () => {
  const directory = await mkdtemp(join(tmpdir(), "lfaa-minecraft-properties-"));
  const propertyPath = join(directory, "server.properties");
  const temporaryPath = join(directory, ".server-properties-test.tmp");
  const initial = "# keep generated comments\n\nmotd=Old server\nserver-port=25565\nunknown.option=keep-me\nrcon.password=old-secret\nresource-pack=https://example.invalid/pack.zip\n";
  try {
    await writeFile(propertyPath, initial, "utf8");
    const current = new Map(initial.trimEnd().split("\n").map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1)];
    }));
    const changes = validateMinecraftPropertyChanges({ motd: "New server", "rcon.password": "new-secret", "resource-pack": null }, new Set(current.keys()), "1.12.2");
    await commitMinecraftPropertyFile({
      propertyPath,
      temporaryPath,
      properties: current,
      sourceText: initial,
      changes,
      assertSafeTarget: async (target) => {
        const info = await lstat(target);
        assert.equal(info.isSymbolicLink(), false);
        assert.equal(info.isFile(), true);
        assert.equal(info.nlink, 1);
      }
    });
    const saved = await readFile(propertyPath, "utf8");
    assert.match(saved, /^# keep generated comments$/mu);
    assert.match(saved, /^\s*$/mu);
    assert.match(saved, /^motd=New server$/mu);
    assert.match(saved, /^server-port=25565$/mu);
    assert.match(saved, /^unknown\.option=keep-me$/mu);
    assert.match(saved, /^rcon\.password=new-secret$/mu);
    assert.doesNotMatch(saved, /^resource-pack=/mu);
    await assert.rejects(readFile(temporaryPath), { code: "ENOENT" });
    assert.throws(() => validateMinecraftPropertyChanges({ "not-in-file": "x" }, new Set(current.keys()), "1.12.2"), /not-in-file/u);
    assert.throws(() => validateMinecraftPropertyChanges({ motd: "safe\nserver-port=1" }, new Set(current.keys()), "1.12.2"), /motd/u);
    assert.throws(() => validateMinecraftPropertyChanges({ "server-port": "0" }, new Set(current.keys()), "1.12.2"), /server-port/u);
  } finally {
    const root = resolve(tmpdir());
    const target = resolve(directory);
    const pathFromRoot = relative(root, target);
    assert.ok(pathFromRoot && !isAbsolute(pathFromRoot) && pathFromRoot !== ".." && !pathFromRoot.startsWith(`..${sep}`), "只清理当前测试创建在系统临时目录中的夹具");
    await rm(directory, { recursive: true, force: true });
  }
});

test("任务中的敏感属性以本机设置密钥密封并绑定实例和属性名", () => {
  const context = "minecraft-server-property\0fixture-instance\0rcon.password";
  const secret = "isolated-test-secret";
  const sealed = protectTaskSecret(secret, context);
  assert.notEqual(sealed.ciphertext, secret);
  assert.equal(revealTaskSecret(sealed, context), secret);
  assert.throws(() => revealTaskSecret(sealed, `${context}-other-instance`), /加密校验/u);
  const task = { kind: "properties", instanceId: "fixture-instance", payload: { fileProperties: { motd: "Visible", "rcon.password": sealed, "resource-pack": null } } };
  const publicTask = withoutMinecraftTaskPropertySecrets(task);
  assert.deepEqual(publicTask.payload.fileProperties, { motd: "Visible" });
  assert.doesNotMatch(JSON.stringify(publicTask), /isolated-test-secret|ciphertext/u);
  assert.deepEqual(revealMinecraftTaskPropertySecrets(task).payload.fileProperties, { motd: "Visible", "rcon.password": secret, "resource-pack": null });
});
