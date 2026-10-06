/** 功能：回归凭据引用注册表。作用：验证账户隔离、真实插件身份白名单、只读元数据和卸载撤销。 */
import test from "node:test";
import assert from "node:assert/strict";
import { Context } from "@deepseek-ai/cordis";
import * as credentials from "lfaa-credentials/src/index.js";

test("凭据来源按活动插件身份和账户路由，不能伪造其他消费者", async () => {
  const context = new Context();
  const registryFiber = await context.plugin(credentials);
  const providerFiber = await context.plugin({
    name: "fixture-vault",
    inject: ["lfaaCredentials"],
    apply(ctx) {
      ctx.effect(() => ctx.lfaaCredentials.register(ctx, {
          consumers: ["fixture-agent"],
          resolve: (ownerId, referenceId) => ownerId === "owner-a" && referenceId === "account-a" ? "fixture-secret" : null,
          describe: (ownerId, referenceId) => ({ configured: ownerId === "owner-a" && referenceId === "account-a", source: "fixture", writable: false })
        }));
    }
  });
  let consumer;
  let otherConsumer;
  const consumerFiber = await context.plugin({
    name: "fixture-agent",
    inject: ["lfaaCredentials"],
    apply(ctx) { consumer = ctx.lfaaCredentials.createConsumer(ctx); }
  });
  const otherFiber = await context.plugin({
    name: "other-agent",
    inject: ["lfaaCredentials"],
    apply(ctx) { otherConsumer = ctx.lfaaCredentials.createConsumer(ctx); }
  });
  const reference = credentials.credentialReference("fixture-vault", "account-a");
  try {
    assert.equal(Object.isFrozen(reference), true);
    assert.equal(consumer.resolve("owner-a", reference), "fixture-secret");
    assert.equal(consumer.resolve("owner-b", reference), null);
    assert.deepEqual(consumer.describe("owner-a", reference), { configured: true, source: "fixture", writable: false });
    assert.throws(() => otherConsumer.resolve("owner-a", reference), /未获准/u);
    assert.throws(() => context.lfaaCredentials.commitRecord(consumerFiber.ctx, "owner-a", reference, { kind: "grant", payload: { token: "forbidden" } }), /只能写入自己所有/u);
    assert.throws(() => context.lfaaCredentials.createConsumer(context), /当前运行中的 Cordis 插件上下文/u);
    assert.deepEqual(context.lfaaCredentials.providers(), ["fixture-vault"]);
    assert.throws(() => context.lfaaCredentials.register(providerFiber.ctx, {
      consumers: ["fixture-agent"], resolve: () => null, describe: () => ({ configured: false, writable: false })
    }), /重复注册/u);
    assert.throws(() => credentials.credentialReference("Fixture", "account-a"), /来源标识无效/u);
    assert.throws(() => credentials.credentialReference("fixture-vault", "../secret"), /引用标识无效/u);

    await providerFiber.dispose();
    assert.equal(consumer.resolve("owner-a", reference), null);
    assert.deepEqual(consumer.describe("owner-a", reference), { configured: false, writable: false });
    assert.deepEqual(context.lfaaCredentials.providers(), []);
  } finally {
    await otherFiber.dispose();
    await consumerFiber.dispose();
    await providerFiber.dispose();
    await registryFiber.dispose();
    await context.fiber.dispose();
  }
});
