/** 功能：验证凭据记录与通用授权 Flow。作用：覆盖密文持久化、账户/插件隔离、提交确认、单飞、取消和卸载。 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cli = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function run(dataDirectory, script) {
  execFileSync(process.execPath, ["--import", "tsx", "--import", "./register-package-loader.mjs", "--input-type=module", "-e", script], {
    cwd: cli,
    env: { ...process.env, NODE_ENV: "test", LFAA_DATA_DIR: dataDirectory, JWT_SECRET: "" },
    encoding: "utf8",
    stdio: "pipe",
    timeout: 30000
  });
}

test("Settings 将通用凭据记录加密持久化，并按账户/插件地址隔离", () => {
  const parent = resolve(cli, "../../dist/.tmp");
  mkdirSync(parent, { recursive: true });
  const data = mkdtempSync(join(parent, "lfaa-credential-records-"));
  const imports = `
    import assert from 'node:assert/strict';
    import { Context } from '@deepseek-ai/cordis';
    import { database } from 'lfaa-storage-sqlite/src/database.js';
    import { configuration } from 'lfaa-storage-domain/src/configuration.js';
    const { sessionRecords } = await import('lfaa-session-persistence-jsonl/src/repository.js');
    const { retireLegacyFileTables } = await import('lfaa-storage-domain/src/migration.js');
    retireLegacyFileTables();
    const context = new Context();
    const credentialsFiber = await context.plugin(await import('lfaa-credentials/src/index.js'));
    const settingsFiber = await context.plugin(await import('lfaa-settings/src/index.js'));
    const reference = { providerId: 'fixture-provider', id: 'primary-account' };
  `;
  try {
    run(data, `${imports}
      database.prepare("INSERT INTO users(id,uid,username,password_salt,password_hash,role,is_super_admin) VALUES ('fixture-admin',1,'fixture-admin','test-salt','test-hash','admin',1),('fixture-member',2,'fixture-member','test-salt','test-hash','member',0),('fixture-other',3,'fixture-other','test-salt','test-hash','member',0)").run();
      const providerFiber = await context.plugin({ name: 'fixture-provider', inject: ['lfaaCredentials'], apply(ctx) { ctx.effect(() => ctx.lfaaCredentials.registerRecordOwner(ctx, ['fixture-agent'])); } });
      context.lfaaCredentials.commitRecord(providerFiber.ctx, 'fixture-member', reference, { kind: 'grant', payload: { accessToken: 'credential-record-private-value' } });
      assert.equal(configuration.listCredentialRecords('fixture-member').length, 1);
      assert.deepEqual(configuration.listCredentialRecords('fixture-other'), []);
      const ciphertext = database.prepare("SELECT ciphertext FROM configuration_credentials WHERE user_id='fixture-member'").get();
      assert.ok(ciphertext?.ciphertext);
      assert.equal(JSON.stringify(ciphertext).includes('credential-record-private-value'), false);
      await providerFiber.dispose();
      await settingsFiber.dispose();
      await credentialsFiber.dispose();
      configuration.close();
      sessionRecords.close();
    `);

    const configurationPath = join(data, "storages", "configuration.json");
    const persisted = readFileSync(configurationPath, "utf8");
    assert.equal(persisted.includes("credential-record-private-value"), false);
    assert.doesNotMatch(persisted, /"record_kind"\s*:\s*"grant"/u);

    run(data, `${imports}
      const providerFiber = await context.plugin({ name: 'fixture-provider', inject: ['lfaaCredentials'], apply(ctx) { ctx.effect(() => ctx.lfaaCredentials.registerRecordOwner(ctx, ['fixture-agent'])); } });
      let allowed;
      const agentFiber = await context.plugin({ name: 'fixture-agent', inject: ['lfaaCredentials'], apply(ctx) { allowed = ctx.lfaaCredentials.createConsumer(ctx); } });
      const unlistedFiber = await context.plugin({ name: 'unlisted-agent', inject: ['lfaaCredentials'], apply() {} });
      const record = allowed.readRecord('fixture-member', reference);
      assert.deepEqual(record, { kind: 'grant', payload: { accessToken: 'credential-record-private-value' } });
      assert.equal(allowed.readRecord('fixture-other', reference), null);
      assert.throws(() => context.lfaaCredentials.createConsumer(unlistedFiber.ctx).readRecord('fixture-member', reference), /未获准/u);
      const metadata = context.lfaaCredentials.listRecords(agentFiber.ctx, 'fixture-member');
      assert.deepEqual(metadata.map(item => [item.reference.providerId, item.reference.id, item.kind]), [['fixture-provider', 'primary-account', 'grant']]);
      await unlistedFiber.dispose();
      await agentFiber.dispose();
      await providerFiber.dispose();
      await settingsFiber.dispose();
      await credentialsFiber.dispose();
      configuration.close();
      sessionRecords.close();
    `);

    run(data, `${imports}
      database.prepare("UPDATE configuration_credentials SET record_id='swapped-account' WHERE user_id='fixture-member'").run();
      await settingsFiber.dispose();
      await credentialsFiber.dispose();
      configuration.close();
      sessionRecords.close();
    `);
    run(data, `${imports}
      assert.throws(() => context.lfaaSettings.readPluginCredentialRecord('fixture-member', { providerId: 'fixture-provider', id: 'swapped-account' }));
      await settingsFiber.dispose();
      await credentialsFiber.dispose();
      configuration.close();
      sessionRecords.close();
    `);
  } finally {
    assert.equal(dirname(resolve(data)), parent);
    assert.equal(existsSync(data), true);
    rmSync(data, { recursive: true, force: true });
  }
});

test("授权 Flow 按账户单飞，必须提交本次记录，取消与插件卸载会撤销尝试", async () => {
  const { Context } = await import("@deepseek-ai/cordis");
  const credentialsPlugin = await import("lfaa-credentials/src/index.js");
  const flowsPlugin = await import("lfaa-credential-flows/src/index.js");
  const context = new Context();
  const credentialFiber = await context.plugin(credentialsPlugin);
  const flowFiber = await context.plugin(flowsPlugin);
  const records = new Map();
  const storage = {
    get(ownerId, reference) { return records.get(`${ownerId}\0${reference.providerId}\0${reference.id}`) ?? null; },
    set(ownerId, reference, record) { records.set(`${ownerId}\0${reference.providerId}\0${reference.id}`, structuredClone(record)); },
    delete(ownerId, reference) { return records.delete(`${ownerId}\0${reference.providerId}\0${reference.id}`); },
    list(ownerId) {
      return [...records.entries()].filter(([key]) => key.startsWith(`${ownerId}\0`)).map(([key, record]) => {
        const [, providerId, id] = key.split("\0");
        return { reference: { providerId, id }, kind: record.kind, updatedAt: "2026-10-04T00:00:00.000Z" };
      });
    }
  };
  const settingsFiber = await context.plugin({ name: "lfaaSettings", inject: ["lfaaCredentials"], apply(ctx) { ctx.effect(() => ctx.lfaaCredentials.registerRecordStore(ctx, storage)); } });
  const service = context.lfaaCredentialFlows;
  const ref = { providerId: "fixture-provider", id: "primary-account" };
  const interaction = {
    notify(notice) { assert.equal(notice.message, "正在连接授权服务"); },
    async prompt(prompt) { assert.equal(prompt.kind, "secret"); return "user-provided-code"; }
  };

  try {
    const providerFiber = await context.plugin({
      name: "fixture-provider",
      inject: ["lfaaCredentialFlows"],
      apply(ctx) {
        ctx.effect(() => ctx.lfaaCredentialFlows.registerFlow(ctx, {
          referenceId: ref.id,
          label: "测试授权",
          methods: [{ id: "code", label: "输入验证码" }],
          consumers: ["fixture-agent"],
          async run(session) {
            await session.notify({ message: "正在连接授权服务" });
            const code = await session.prompt({ kind: "secret", title: "验证码", message: "输入一次性验证码" });
            session.commit({ kind: "grant", payload: { code } });
          }
        }));
      }
    });
    assert.deepEqual(await service.begin({ ownerId: "user-a", reference: ref, interaction }), { status: "authorized" });
    let consumer;
    const consumerFiber = await context.plugin({ name: "fixture-agent", inject: ["lfaaCredentials"], apply(ctx) { consumer = ctx.lfaaCredentials.createConsumer(ctx); } });
    assert.deepEqual(consumer.readRecord("user-a", ref), { kind: "grant", payload: { code: "user-provided-code" } });
    assert.equal(consumer.readRecord("user-b", ref), null);
    const otherConsumerFiber = await context.plugin({ name: "other-agent", inject: ["lfaaCredentials"], apply() {} });
    assert.throws(() => context.lfaaCredentials.createConsumer(otherConsumerFiber.ctx).readRecord("user-a", ref), /未获准/u);
    await otherConsumerFiber.dispose();
    assert.equal(service.describe("user-a", ref).inFlight, false);

    await providerFiber.dispose();
    assert.equal(service.describe("user-a", ref), null);

    let started;
    const startedPromise = new Promise(resolve => { started = resolve; });
    let capturedSession;
    const pendingProvider = await context.plugin({
      name: "pending-provider",
      inject: ["lfaaCredentialFlows"],
      apply(ctx) {
        ctx.effect(() => ctx.lfaaCredentialFlows.registerFlow(ctx, {
          referenceId: "pending",
          label: "可取消授权",
          methods: [{ id: "code", label: "验证码" }],
          consumers: ["fixture-agent"],
          run(session) { capturedSession = session; started(); return new Promise(() => {}); }
        }));
      }
    });
    const pendingRef = { providerId: "pending-provider", id: "pending" };
    const pendingInput = { ownerId: "user-a", reference: pendingRef, interaction };
    const pending = service.begin(pendingInput);
    await startedPromise;
    assert.equal(service.describe("user-a", pendingRef).inFlight, true);
    await assert.rejects(service.begin(pendingInput), error => error.code === "ALREADY_IN_FLIGHT");
    assert.equal(service.cancel("user-a", pendingRef), true);
    assert.deepEqual(await pending, { status: "cancelled" });
    assert.throws(() => capturedSession.commit({ kind: "grant", payload: { late: true } }), /取消/u);
    assert.equal(records.has(`user-a\0pending-provider\0pending`), false);

    const noCommitProvider = await context.plugin({
      name: "no-commit-provider",
      inject: ["lfaaCredentialFlows"],
      apply(ctx) {
        ctx.effect(() => ctx.lfaaCredentialFlows.registerFlow(ctx, {
          referenceId: "missing-record",
          label: "未提交流程",
          methods: [{ id: "manual", label: "手动" }],
          consumers: ["fixture-agent"],
          async run() {}
        }));
      }
    });
    await assert.rejects(service.begin({ ownerId: "user-a", reference: { providerId: "no-commit-provider", id: "missing-record" }, interaction }), error => error.code === "NOT_COMMITTED");
    await noCommitProvider.dispose();

    const unloadingStarted = new Promise(resolve => { started = resolve; });
    const unloadingProvider = await context.plugin({
      name: "unloading-provider",
      inject: ["lfaaCredentialFlows"],
      apply(ctx) {
        ctx.effect(() => ctx.lfaaCredentialFlows.registerFlow(ctx, {
          referenceId: "unload",
          label: "卸载时取消",
          methods: [{ id: "manual", label: "手动" }],
          consumers: ["fixture-agent"],
          run() { started(); return new Promise(() => {}); }
        }));
      }
    });
    const unloadingRef = { providerId: "unloading-provider", id: "unload" };
    const unloading = service.begin({ ownerId: "user-a", reference: unloadingRef, interaction });
    await unloadingStarted;
    await unloadingProvider.dispose();
    assert.deepEqual(await unloading, { status: "cancelled" });
    assert.equal(service.describe("user-a", unloadingRef), null);
    await pendingProvider.dispose();
  } finally {
    await flowFiber.dispose();
    await settingsFiber.dispose();
    await credentialFiber.dispose();
    await context.fiber.dispose();
  }
});
