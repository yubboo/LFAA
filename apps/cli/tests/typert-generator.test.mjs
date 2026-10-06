/** 功能：验证 Typert TypeScript 生成器。作用：保证生成物稳定、可执行且遇到非 JSON 类型时失败关闭。 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { generateTypertRemoteContract } from "../../../packages/typert/generator/src/index.mjs";
import { productRuntimePackages } from "../../../scripts/harness-workspace.mjs";
import { accountControllerRemoteMethods, accountControllerRemoteSchemas } from "../../../packages/api/account-controller/src/client-contract.generated.ts";
import { createTypertJsonSchema } from "lfaa-typert-protocol/src/index.js";

const root = resolve(import.meta.dirname, "../../..");
const sourcePath = resolve(root, "packages/api/account-controller/src/client-contract.ts");
const generatedPath = resolve(root, "packages/api/account-controller/src/client-contract.generated.ts");

test("账户 Remote 源合同稳定生成 Host/Client 共用端点和 Schema", async () => {
  const sourceText = await readFile(sourcePath, "utf8");
  const generatedText = generateTypertRemoteContract({ sourceText, sourcePath, contractName: "AccountControllerRemoteContract" });
  assert.equal(generatedText, await readFile(generatedPath, "utf8"));
  assert.deepEqual(accountControllerRemoteMethods["auth/me"], {
    endpoint: "auth/me",
    namespace: "auth",
    method: "me"
  });
});

test("生成的 JSON Schema 在 Host 拒绝额外字段并校验嵌套账户形状", () => {
  const input = createTypertJsonSchema(accountControllerRemoteSchemas["auth/me"].input);
  const output = createTypertJsonSchema(accountControllerRemoteSchemas["auth/me"].output);
  assert.deepEqual(input.parse({}), {});
  assert.throws(() => input.parse({ ignored: true }), /JSON Schema/u);

  const valid = {
    user: {
      id: "00000000-0000-4000-8000-000000000000",
      uid: 1,
      username: "admin",
      email: null,
      role: "super_admin",
      createdAt: "2026-10-04T00:00:00.000Z"
    }
  };
  assert.deepEqual(output.parse(valid), valid);
  assert.throws(() => output.parse({ ...valid, extra: true }), /JSON Schema/u);
  assert.throws(() => output.parse({ user: { ...valid.user, role: "owner" } }), /JSON Schema/u);
});

test("生成器对 any 和含副作用的源文件失败关闭", () => {
  const sourcePath = resolve(root, "packages/typert/generator/fixture.ts");
  assert.throws(() => generateTypertRemoteContract({
    sourcePath,
    contractName: "UnsafeContract",
    sourceText: "export type UnsafeContract = { \"test/run\": { input: any; output: string } };"
  }), /不支持或无法无损映射/u);
  assert.throws(() => generateTypertRemoteContract({
    sourcePath,
    contractName: "ImportedContract",
    sourceText: "import type { User } from './user.js'; export type ImportedContract = { \"test/run\": { input: User; output: string } };"
  }), /只允许导出/u);
});

test("工程期生成器构建但不会进入产品 Host 运行树", () => {
  const runtimePackages = productRuntimePackages(root);
  assert.ok(runtimePackages.some((pkg) => pkg.path === "packages/interaction/user-questions"));
  assert.ok(!runtimePackages.some((pkg) => pkg.path === "packages/typert/generator"));
  assert.ok(runtimePackages.some((pkg) => pkg.path === "packages/typert/protocol"));
});
