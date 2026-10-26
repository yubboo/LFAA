/** 功能：回归 Agent/Coding Plan 初次加载套餐模型目录。作用：未选择模型时不得把空 modelId 发给服务端合同校验。关联文件：packages/client/ui-settings/src/SettingsPage.tsx、packages/api/remotes/src/route-contracts.ts。 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const settingsPage = readFileSync(resolve(repositoryRoot, "packages/client/ui-settings/src/SettingsPage.tsx"), "utf8");
const routeContracts = readFileSync(resolve(repositoryRoot, "packages/api/remotes/src/route-contracts.ts"), "utf8");

test("初次加载 Plan 模型目录时不发送空 modelId", () => {
  const runProbe = settingsPage.split("async function runProbe(): Promise<void> {")[1]?.split("async function runModelTest(): Promise<void>")[0] ?? "";
  assert.match(runProbe, /selectedProvider\.modelInput === "manual" && modelId\.length > 0 \? \{ modelId \} : \{\}/u);
  assert.doesNotMatch(runProbe, /\{ modelId: selectedModel \}/u);
  assert.match(runProbe, /套餐目录候选模型/u);
  assert.match(runProbe, /测试所选模型后再保存/u);
  assert.match(routeContracts, /modelId: Joi\.string\(\)\.trim\(\)\.min\(1\)\.max\(160\),/u);
});
