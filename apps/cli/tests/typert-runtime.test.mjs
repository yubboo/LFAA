/** 功能：验证 Typert Remote 插件注册表。作用：覆盖输入输出校验、重复登记失败关闭及贡献卸载清理。关联文件：packages/typert/protocol、registry、loader。 */
import assert from "node:assert/strict";
import test from "node:test";
import { Context } from "@deepseek-ai/cordis";
import registryPlugin from "lfaa-typert-registry/src/index.js";
import loaderPlugin from "lfaa-typert-loader/src/index.js";
import { createTypertContributionPlugin } from "lfaa-typert-loader/src/index.js";
import { assertTypertJsonValue, defineTypertMethod, TypertError } from "lfaa-typert-protocol/src/index.js";

const objectSchema = {
  parse(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("expected object");
    return value;
  }
};

test("Typert 贡献按插件 Fiber 登记、校验并随卸载撤销", async () => {
  const context = new Context();
  try {
    await context.plugin(registryPlugin);
    await context.plugin(loaderPlugin);
    const contributionPlugin = createTypertContributionPlugin({
      package: "lfaa-test-remote",
      methods: [defineTypertMethod({
        id: "session.list",
        namespace: "session",
        method: "list",
        input: objectSchema,
        output: objectSchema,
        authorize: call => call.principal.userId === "user-a",
        invoke(input, call) {
          return { userId: call.principal.userId, limit: input.limit };
        }
      })]
    });
    const fiber = await context.plugin(contributionPlugin);

    assert.deepEqual(context.lfaaTypertRegistry.list(), [{
      id: "session.list",
      package: "lfaa-test-remote",
      namespace: "session",
      method: "list"
    }]);
    assert.deepEqual(await context.lfaaTypertRegistry.invoke("session", "list", { limit: 8 }, {
      requestId: "request-1",
      principal: { userId: "user-a" },
      signal: new AbortController().signal
    }), { userId: "user-a", limit: 8 });
    await assert.rejects(
      context.lfaaTypertRegistry.invoke("session", "list", { limit: 8 }, {
        requestId: "request-forbidden",
        principal: { userId: "user-b" },
        signal: new AbortController().signal
      }),
      error => error instanceof TypertError && error.code === "forbidden"
    );

    await assert.rejects(
      context.lfaaTypertRegistry.invoke("session", "list", { limit: 8, nested: undefined }, {
        requestId: "request-2",
        principal: { userId: "user-a" },
        signal: new AbortController().signal
      }),
      (error) => error instanceof TypertError && error.code === "invalid_input"
    );

    const duplicate = createTypertContributionPlugin({
      package: "lfaa-test-duplicate",
      methods: [
        defineTypertMethod({ id: "session.other", namespace: "session", method: "other", input: objectSchema, output: objectSchema, authorize: () => true, invoke: () => ({}) }),
        defineTypertMethod({ id: "session.list.copy", namespace: "session", method: "list", input: objectSchema, output: objectSchema, authorize: () => true, invoke: () => ({}) })
      ]
    });
    await assert.rejects(async () => { await context.plugin(duplicate); }, (error) => error instanceof TypertError && error.code === "duplicate_method");
    assert.deepEqual(context.lfaaTypertRegistry.list().map(({ namespace, method }) => `${namespace}/${method}`), ["session/list"]);

    await fiber.dispose();
    assert.deepEqual(context.lfaaTypertRegistry.list(), []);
    await assert.rejects(
      context.lfaaTypertRegistry.invoke("session", "list", {}, {
        requestId: "request-3",
        principal: { userId: "user-a" },
        signal: new AbortController().signal
      }),
      (error) => error instanceof TypertError && error.code === "method_not_found"
    );
  } finally {
    await context.fiber.dispose();
  }
});

test("Typert 协议拒绝非有限数字与循环对象", async () => {
  const context = new Context();
  try {
    await context.plugin(registryPlugin);
    await context.plugin(loaderPlugin);
    const contribution = createTypertContributionPlugin({
      package: "lfaa-test-remote",
      methods: [defineTypertMethod({
        id: "echo.value",
        namespace: "echo",
        method: "value",
        input: { parse: (value) => value },
        output: { parse: (value) => value },
        authorize: () => true,
        invoke: (input) => input
      })]
    });
    await context.plugin(contribution);
    const circular = {};
    circular.self = circular;
    for (const value of [NaN, circular]) {
      await assert.rejects(
        context.lfaaTypertRegistry.invoke("echo", "value", value, {
          requestId: "request-4",
          principal: null,
          signal: new AbortController().signal
        }),
        (error) => error instanceof TypertError && error.code === "invalid_input"
      );
    }
  } finally {
    await context.fiber.dispose();
  }
});

test("Typert 协议对组合后的 JSON 载荷施加总字节上限", () => {
  const oversized = Array.from({ length: 5 }, () => "x".repeat(900_000));
  assert.throws(
    () => assertTypertJsonValue(oversized),
    error => error instanceof TypertError && error.code === "invalid_contribution" && /4 MiB/u.test(error.message)
  );
});
